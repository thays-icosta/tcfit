import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import WorkoutBuilderScreen from './WorkoutBuilderScreen';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';
import {
  loadCurrentWeekWorkouts,
  loadWeekHistory,
  loadWorkoutSummaries,
  createNewWeekVersion,
} from './workoutVersioning';

const WEEKDAY_SHORT = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function weekRangeLabel(group) {
  const start = formatDate(group.startDate);
  const end = formatDate(group.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `A partir de ${start}`;
  return 'Sem data';
}

export default function WorkoutProgramManagerScreen({ studentId, studentName, personalId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('overview'); // 'overview' | 'builder' | 'history-detail'
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [showOtherWeekPicker, setShowOtherWeekPicker] = useState(false);

  const [historyDetailGroup, setHistoryDetailGroup] = useState(null);
  const [historyDetailItems, setHistoryDetailItems] = useState(null);
  const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false);

  const loadAll = async () => {
    const [current, hist] = await Promise.all([
      loadCurrentWeekWorkouts(supabase, studentId),
      loadWeekHistory(supabase, studentId),
    ]);
    setCurrentWeek(current);
    setHistory(hist);
    const ids = current.map((w) => w.id);
    setSummaries(await loadWorkoutSummaries(supabase, ids));
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [studentId]);

  const handleNewWeek = () => {
    if (currentWeek.length === 0) {
      showAlert('Ops', 'Cria a primeira ficha desse aluno antes de iniciar uma nova semana.');
      return;
    }
    showAlert(
      '+ Nova Semana',
      'Como você quer montar a prescrição desta semana?',
      [
        { text: 'Copiar semana atual', onPress: () => runNewWeek('copy-current') },
        { text: 'Usar outra semana como base', onPress: () => setShowOtherWeekPicker(true) },
        { text: 'Criar do zero', onPress: () => runNewWeek('scratch') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const runNewWeek = async (mode, sourceWorkouts = []) => {
    setCreatingWeek(true);
    try {
      await createNewWeekVersion(supabase, { studentId, personalId, mode, sourceWorkouts });
      await loadAll();
      setView('builder');
    } catch (e) {
      console.error('Erro ao criar nova semana:', e);
      showAlert('Ops', 'Não foi possível criar a nova semana agora. Tenta de novo em instantes.');
    }
    setCreatingWeek(false);
  };

  const handlePickOtherWeek = async (group) => {
    setShowOtherWeekPicker(false);
    await runNewWeek('other-week', group.workouts);
  };

  const handleOpenHistoryDetail = async (group) => {
    setHistoryDetailGroup(group);
    setHistoryDetailItems(null);
    setLoadingHistoryDetail(true);
    setView('history-detail');
    const workoutIds = group.workouts.map((w) => w.id);
    const { data } = await supabase
      .from('workout_exercises')
      .select('workout_id, order_index, sets, reps, load_kg, exercises (name, muscle_group)')
      .in('workout_id', workoutIds)
      .order('order_index', { ascending: true });
    const byWorkout = {};
    (data || []).forEach((row) => {
      byWorkout[row.workout_id] = byWorkout[row.workout_id] || [];
      byWorkout[row.workout_id].push(row);
    });
    setHistoryDetailItems(byWorkout);
    setLoadingHistoryDetail(false);
  };

  if (view === 'builder') {
    return (
      <WorkoutBuilderScreen
        studentId={studentId}
        studentName={studentName}
        personalId={personalId}
        onClose={() => { setView('overview'); loadAll(); }}
      />
    );
  }

  if (view === 'history-detail' && historyDetailGroup) {
    return (
      <View style={styles.container}>
        <HeaderBack title={`Semana ${weekRangeLabel(historyDetailGroup)}`} onBack={() => setView('overview')} style={{ paddingHorizontal: 16 }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          <View style={styles.readOnlyBanner}>
            <Ionicons name="lock-closed-outline" size={13} color="#737373" />
            <Text style={styles.readOnlyBannerText}>Semana arquivada — somente leitura, pra preservar o histórico.</Text>
          </View>
          {loadingHistoryDetail ? (
            <ActivityIndicator color="#FF6B00" style={{ marginTop: 20 }} />
          ) : (
            historyDetailGroup.workouts.map((w) => {
              const exs = historyDetailItems?.[w.id] || [];
              return (
                <View key={w.id} style={styles.fichaCard}>
                  <Text style={styles.fichaCardName}>{w.name}</Text>
                  {exs.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum exercício registrado.</Text>
                  ) : (
                    exs.map((ex) => (
                      <View key={`${w.id}-${ex.order_index}`} style={styles.historyExerciseRow}>
                        <Text style={styles.historyExerciseName}>{ex.exercises?.name}</Text>
                        <Text style={styles.historyExerciseMeta}>
                          {ex.sets || 3}x{ex.reps || '-'}{ex.load_kg != null ? ` · ${ex.load_kg}kg` : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title={`Treino · ${studentName}`} onBack={onClose} style={{ paddingHorizontal: 16 }} />
      {loading ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.sectionTitle}>SEMANA ATUAL</Text>

          {currentWeek.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma ficha ativa ainda. Toque em &quot;Editar Semana Atual&quot; pra criar a primeira.</Text>
          ) : (
            currentWeek.map((w) => {
              const s = summaries[w.id] || { exerciseCount: 0, setCount: 0, muscleGroups: [] };
              return (
                <View key={w.id} style={styles.fichaCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fichaCardName}>{w.name}</Text>
                    <Text style={styles.fichaCardMeta}>
                      {w.weekday != null ? `${WEEKDAY_SHORT[w.weekday]} · ` : ''}
                      {s.exerciseCount} exercício{s.exerciseCount !== 1 ? 's' : ''} · {s.setCount} série{s.setCount !== 1 ? 's' : ''}
                    </Text>
                    {s.muscleGroups.length > 0 && (
                      <Text style={styles.fichaCardMuscles}>{s.muscleGroups.join(' · ')}</Text>
                    )}
                  </View>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusBadgeText}>ATIVO</Text>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={() => setView('builder')}>
            <Ionicons name="barbell-outline" size={16} color="#0F0F12" />
            <Text style={styles.primaryButtonText}>Editar Semana Atual</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleNewWeek} disabled={creatingWeek}>
            {creatingWeek ? (
              <ActivityIndicator color="#FF6B00" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={16} color="#FF6B00" />
                <Text style={styles.secondaryButtonText}>+ Nova Semana</Text>
              </>
            )}
          </TouchableOpacity>

          {history.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>HISTÓRICO DE SEMANAS</Text>
              {history.map((group) => (
                <TouchableOpacity key={group.key} style={styles.historyRow} onPress={() => handleOpenHistoryDetail(group)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyRowDate}>{weekRangeLabel(group)}</Text>
                    <Text style={styles.historyRowNames} numberOfLines={1}>{group.workouts.map((w) => w.name).join(' · ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {showOtherWeekPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Usar qual semana como base?</Text>
              <TouchableOpacity onPress={() => setShowOtherWeekPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma semana no histórico ainda.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {history.map((group) => (
                  <TouchableOpacity key={group.key} style={styles.historyRow} onPress={() => handlePickOtherWeek(group)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyRowDate}>{weekRangeLabel(group)}</Text>
                      <Text style={styles.historyRowNames} numberOfLines={1}>{group.workouts.map((w) => w.name).join(' · ')}</Text>
                    </View>
                    <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  sectionTitle: { color: '#737373', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', marginVertical: 16 },
  fichaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 10 },
  fichaCardName: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  fichaCardMeta: { color: '#a3a3a3', fontSize: 11, marginTop: 3 },
  fichaCardMuscles: { color: '#FF6B00', fontSize: 10, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  statusBadgeText: { color: '#22c55e', fontSize: 9, fontWeight: '800' },
  primaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, marginTop: 6, marginBottom: 10 },
  primaryButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  secondaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 12, paddingVertical: 13 },
  secondaryButtonText: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, padding: 12, marginBottom: 8 },
  historyRowDate: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  historyRowNames: { color: '#737373', fontSize: 11, marginTop: 2 },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C1C22', borderRadius: 8, padding: 10, marginBottom: 14 },
  readOnlyBannerText: { color: '#737373', fontSize: 10, flexShrink: 1 },
  historyExerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#0F0F12', paddingVertical: 8 },
  historyExerciseName: { color: '#d4d4d4', fontSize: 12, flex: 1 },
  historyExerciseMeta: { color: '#737373', fontSize: 11, marginLeft: 8 },
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '75%' },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
});
