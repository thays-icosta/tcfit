import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal } from 'react-native';
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
  duplicateWorkout,
} from './workoutVersioning';
import { loadExerciseLoadHistory, suggestNextLoad } from './progressionUtils';

// Same convention as WorkoutBuilderScreen's picker: value matches JS
// Date.getDay() (0 = Sunday), ordered Mon→Sun here only for display.
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function weekRangeLabel(group) {
  if (!group) return '';
  if (group.isCurrent) {
    const start = formatDate(group.startDate);
    return start ? `${start} → hoje` : 'Semana atual';
  }
  const start = formatDate(group.startDate);
  const end = formatDate(group.endDate);
  if (start && end) return `${start} → ${end}`;
  if (start) return `A partir de ${start}`;
  return 'Sem data';
}

// Reads/writes workouts.weekday directly — the same column the ficha
// builder's own "Dia da Semana" picker writes to, so assigning a day here
// or there always shows up in both places. No new table.
export default function WeeklyPlanScreen({ studentId, studentName, personalId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(null); // null = viewing current week

  const [summaries, setSummaries] = useState({});
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [progressionCount, setProgressionCount] = useState(null); // loaded async, current week only

  const [editingWorkoutId, setEditingWorkoutId] = useState(null); // opens WorkoutBuilderScreen on a specific ficha
  const [showBuilder, setShowBuilder] = useState(false); // opens WorkoutBuilderScreen with no specific ficha
  const [assigningDay, setAssigningDay] = useState(null);
  const [savingDay, setSavingDay] = useState(false);
  const [duplicatingWorkoutId, setDuplicatingWorkoutId] = useState(null);

  const [creatingWeek, setCreatingWeek] = useState(false);
  const [showOtherWeekPicker, setShowOtherWeekPicker] = useState(false);

  const [viewingWorkout, setViewingWorkout] = useState(null); // { workout, items } — read-only history detail
  const [loadingViewDetail, setLoadingViewDetail] = useState(false);

  const loadAll = async () => {
    const [current, hist] = await Promise.all([
      loadCurrentWeekWorkouts(supabase, studentId),
      loadWeekHistory(supabase, studentId),
    ]);
    setCurrentWeek(current);
    setHistory(hist);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [studentId]);

  const viewingCurrent = historyIndex == null;
  const viewedGroup = viewingCurrent
    ? { isCurrent: true, startDate: currentWeek.map((w) => w.created_at).filter(Boolean).sort()[0] || null, workouts: currentWeek }
    : history[historyIndex];
  const viewedWorkouts = viewedGroup?.workouts || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummariesLoading(true);
      const ids = viewedWorkouts.map((w) => w.id);
      const s = await loadWorkoutSummaries(supabase, ids);
      if (!cancelled) {
        setSummaries(s);
        setSummariesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewingCurrent, historyIndex, currentWeek, history]);

  // Loaded after the rest of the screen, in the background — walks every
  // distinct exercise in the current week's fichas through the same
  // progression logic EditExerciseModal already uses, so this count never
  // disagrees with what the personal sees when editing a single exercise.
  useEffect(() => {
    if (!viewingCurrent || currentWeek.length === 0) { setProgressionCount(null); return; }
    let cancelled = false;
    setProgressionCount(null);
    (async () => {
      const workoutIds = currentWeek.map((w) => w.id);
      const { data } = await supabase
        .from('workout_exercises')
        .select('exercise_id, reps')
        .in('workout_id', workoutIds);
      const seen = new Map();
      (data || []).forEach((row) => { if (row.exercise_id && !seen.has(row.exercise_id)) seen.set(row.exercise_id, row.reps); });
      const entries = [...seen.entries()];
      if (entries.length === 0) { if (!cancelled) setProgressionCount(0); return; }
      const results = await Promise.all(entries.map(async ([exerciseId, reps]) => {
        const loadHistory = await loadExerciseLoadHistory(supabase, { studentId, exerciseId, limit: 1 });
        const suggestion = suggestNextLoad(loadHistory, reps);
        return !!suggestion && suggestion.suggestedLoad > suggestion.lastLoad;
      }));
      if (!cancelled) setProgressionCount(results.filter(Boolean).length);
    })();
    return () => { cancelled = true; };
  }, [viewingCurrent, currentWeek, studentId]);

  const goPrevious = () => {
    if (viewingCurrent) {
      if (history.length > 0) setHistoryIndex(0);
    } else if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };
  const goNext = () => {
    if (!viewingCurrent) {
      if (historyIndex === 0) setHistoryIndex(null);
      else setHistoryIndex(historyIndex - 1);
    }
  };
  const canGoPrevious = viewingCurrent ? history.length > 0 : historyIndex < history.length - 1;
  const canGoNext = !viewingCurrent;

  const handleNewWeek = () => {
    if (currentWeek.length === 0) {
      showAlert('Ops', 'Cria a primeira ficha desse aluno antes de iniciar uma nova semana.');
      return;
    }
    showAlert(
      'Como deseja criar a nova semana?',
      null,
      [
        { text: 'Copiar semana anterior', onPress: () => runNewWeek('copy-current') },
        { text: 'Usar outra semana como base', onPress: () => setShowOtherWeekPicker(true) },
        { text: 'Começar do zero', onPress: () => runNewWeek('scratch') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const runNewWeek = async (mode, sourceWorkouts = []) => {
    setCreatingWeek(true);
    try {
      const result = await createNewWeekVersion(supabase, { studentId, personalId, mode, sourceWorkouts });
      setHistoryIndex(null);
      await loadAll();
      if (result.unmatchedNames?.length > 0) {
        showAlert(
          'Semana criada, mas com atenção',
          `"${result.unmatchedNames.join('", "')}" não tinha uma ficha com o mesmo nome na semana escolhida como base, então foi criada em branco. Adicione os exercícios manualmente.`
        );
      }
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

  const handleAssign = async (workoutId, weekday) => {
    setSavingDay(true);
    await supabase.from('workouts').update({ weekday }).eq('id', workoutId);
    setSavingDay(false);
    setAssigningDay(null);
    loadAll();
  };

  const handleUnassign = async (workoutId) => {
    setSavingDay(true);
    await supabase.from('workouts').update({ weekday: null }).eq('id', workoutId);
    setSavingDay(false);
    setAssigningDay(null);
    loadAll();
  };

  // "Duplicar" quick action per day — creates an unassigned copy of that
  // day's ficha (same reused duplicateWorkout as the ficha editor), which
  // the personal can then assign to another day via the pencil icon.
  const handleDuplicateDay = async (workout) => {
    setDuplicatingWorkoutId(workout.id);
    try {
      await duplicateWorkout(supabase, workout, { studentId, personalId });
      await loadAll();
    } catch (e) {
      showAlert('Erro', e?.message || 'Não foi possível duplicar essa ficha.');
    }
    setDuplicatingWorkoutId(null);
  };

  const handleOpenHistoryWorkout = async (workout) => {
    setViewingWorkout({ workout, items: null });
    setLoadingViewDetail(true);
    const { data } = await supabase
      .from('workout_exercises')
      .select('order_index, sets, reps, load_kg, exercises (name, muscle_group)')
      .eq('workout_id', workout.id)
      .order('order_index', { ascending: true });
    setViewingWorkout({ workout, items: data || [] });
    setLoadingViewDetail(false);
  };

  if (editingWorkoutId) {
    return (
      <WorkoutBuilderScreen
        studentId={studentId}
        studentName={studentName}
        personalId={personalId}
        initialWorkoutId={editingWorkoutId}
        onClose={() => { setEditingWorkoutId(null); loadAll(); }}
      />
    );
  }
  if (showBuilder) {
    return (
      <WorkoutBuilderScreen
        studentId={studentId}
        studentName={studentName}
        personalId={personalId}
        onClose={() => { setShowBuilder(false); loadAll(); }}
      />
    );
  }

  const unassignedInView = viewedWorkouts.filter((w) => w.weekday == null);
  const dayAssigningWorkout = assigningDay != null ? viewedWorkouts.find((w) => w.weekday === assigningDay) : null;
  const summaryTotals = viewedWorkouts.reduce(
    (acc, w) => {
      const s = summaries[w.id] || { exerciseCount: 0, setCount: 0, muscleGroups: [], volumeKg: 0 };
      acc.setCount += s.setCount;
      acc.volumeKg += s.volumeKg;
      s.muscleGroups.forEach((g) => acc.muscleGroups.add(g));
      return acc;
    },
    { setCount: 0, volumeKg: 0, muscleGroups: new Set() }
  );

  return (
    <View style={styles.container}>
      <HeaderBack title="Planejamento da Semana" onBack={onClose} style={{ paddingHorizontal: 16 }} />
      <Text style={styles.subtitle}>{studentName}</Text>

      {loading ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          <View style={styles.weekNavRow}>
            <TouchableOpacity onPress={goPrevious} disabled={!canGoPrevious} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={canGoPrevious ? '#F5F5F7' : '#2B2B36'} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.weekRangeText}>{weekRangeLabel(viewedGroup)}</Text>
              {viewingCurrent ? (
                <Text style={styles.weekBadgeCurrent}>SEMANA ATUAL</Text>
              ) : (
                <Text style={styles.weekBadgeArchived}>🔒 HISTÓRICO · SOMENTE LEITURA</Text>
              )}
            </View>
            <TouchableOpacity onPress={goNext} disabled={!canGoNext} hitSlop={10}>
              <Ionicons name="chevron-forward" size={22} color={canGoNext ? '#F5F5F7' : '#2B2B36'} />
            </TouchableOpacity>
          </View>

          {viewedWorkouts.length === 0 && viewingCurrent ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>Esse aluno ainda não tem nenhuma ficha ativa.</Text>
              <TouchableOpacity style={styles.editFichasButton} onPress={() => setShowBuilder(true)}>
                <Ionicons name="add-circle-outline" size={16} color="#0F0F12" />
                <Text style={styles.editFichasButtonText}>Criar Primeira Ficha</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.summaryPanel}>
                {summariesLoading ? (
                  <ActivityIndicator color="#FF6B00" size="small" />
                ) : (
                  <>
                    <View style={styles.summaryRow}>
                      <SummaryPill label="Treinos" value={String(viewedWorkouts.length)} />
                      <SummaryPill label="Séries" value={String(summaryTotals.setCount)} />
                      <SummaryPill label="Volume" value={summaryTotals.volumeKg > 0 ? `${summaryTotals.volumeKg.toLocaleString('pt-BR')}kg` : '—'} />
                      {viewingCurrent && (
                        <SummaryPill
                          label="Progressão"
                          value={progressionCount == null ? '…' : String(progressionCount)}
                        />
                      )}
                    </View>
                    {summaryTotals.muscleGroups.size > 0 && (
                      <Text style={styles.summaryMuscles}>{[...summaryTotals.muscleGroups].join(' · ')}</Text>
                    )}
                  </>
                )}
              </View>

              {WEEKDAY_OPTIONS.map((day) => {
                const workout = viewedWorkouts.find((w) => w.weekday === day.value);
                const isToday = viewingCurrent && new Date().getDay() === day.value;
                const s = workout ? (summaries[workout.id] || { exerciseCount: 0, setCount: 0, muscleGroups: [] }) : null;
                return (
                  <View key={day.value} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                    <View style={styles.dayCardHeader}>
                      <Text style={styles.dayLabel}>{day.label}{isToday ? ' · HOJE' : ''}</Text>
                      {workout && viewingCurrent && (
                        <View style={styles.dayCardHeaderActions}>
                          <TouchableOpacity onPress={() => handleDuplicateDay(workout)} hitSlop={10} disabled={duplicatingWorkoutId === workout.id}>
                            {duplicatingWorkoutId === workout.id ? (
                              <ActivityIndicator color="#525252" size="small" />
                            ) : (
                              <Ionicons name="copy-outline" size={16} color="#525252" />
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setAssigningDay(day.value)} hitSlop={10}>
                            <Ionicons name="create-outline" size={16} color="#525252" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {workout ? (
                      <TouchableOpacity
                        style={styles.dayCardBody}
                        onPress={() => (viewingCurrent ? setEditingWorkoutId(workout.id) : handleOpenHistoryWorkout(workout))}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.workoutName}>{workout.name}</Text>
                        {s.muscleGroups.length > 0 && (
                          <Text style={styles.workoutMuscles}>{s.muscleGroups.join(' + ')}</Text>
                        )}
                        <Text style={styles.workoutMeta}>
                          {s.exerciseCount} exercício{s.exerciseCount !== 1 ? 's' : ''} • {s.setCount} série{s.setCount !== 1 ? 's' : ''}
                        </Text>
                      </TouchableOpacity>
                    ) : viewingCurrent ? (
                      <TouchableOpacity style={styles.restCard} onPress={() => setAssigningDay(day.value)}>
                        <Text style={styles.restText}>DESCANSO</Text>
                        <Text style={styles.restHint}>+ Atribuir ficha</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.restCard}>
                        <Text style={styles.restText}>DESCANSO</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {viewingCurrent && (
                <>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowBuilder(true)}>
                    <Ionicons name="create-outline" size={16} color="#FF6B00" />
                    <Text style={styles.secondaryButtonText}>Editar / Criar Fichas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.editFichasButton} onPress={handleNewWeek} disabled={creatingWeek}>
                    {creatingWeek ? (
                      <ActivityIndicator color="#0F0F12" size="small" />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={16} color="#0F0F12" />
                        <Text style={styles.editFichasButtonText}>+ Criar Nova Semana</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={assigningDay != null} transparent animationType="fade" onRequestClose={() => setAssigningDay(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {WEEKDAY_OPTIONS.find((d) => d.value === assigningDay)?.label}
            </Text>
            {dayAssigningWorkout && (
              <TouchableOpacity
                style={styles.removeDayOption}
                onPress={() => handleUnassign(dayAssigningWorkout.id)}
                disabled={savingDay}
              >
                {savingDay ? <ActivityIndicator color="#ef4444" size="small" /> : (
                  <>
                    <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                    <Text style={styles.removeDayOptionText}>Remover &quot;{dayAssigningWorkout.name}&quot; desse dia</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {unassignedInView.length === 0 ? (
              <Text style={styles.emptyText}>
                {dayAssigningWorkout ? 'Nenhuma outra ficha disponível pra trocar.' : 'Todas as fichas já têm um dia, ou ainda não existe nenhuma. Toque em "Editar / Criar Fichas" pra criar uma nova.'}
              </Text>
            ) : (
              unassignedInView.map((w) => (
                <TouchableOpacity key={w.id} style={styles.fichaOption} onPress={() => handleAssign(w.id, assigningDay)} disabled={savingDay}>
                  <Text style={styles.fichaOptionText}>{w.name}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setAssigningDay(null)}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={viewingWorkout != null} transparent animationType="fade" onRequestClose={() => setViewingWorkout(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.modalTitle}>{viewingWorkout?.workout?.name}</Text>
              <TouchableOpacity onPress={() => setViewingWorkout(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
            <View style={styles.readOnlyBanner}>
              <Ionicons name="lock-closed-outline" size={13} color="#737373" />
              <Text style={styles.readOnlyBannerText}>Semana arquivada — somente leitura, pra preservar o histórico.</Text>
            </View>
            {loadingViewDetail ? (
              <ActivityIndicator color="#FF6B00" style={{ marginVertical: 16 }} />
            ) : (
              <ScrollView style={{ maxHeight: 340 }}>
                {(viewingWorkout?.items || []).length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum exercício registrado.</Text>
                ) : (
                  viewingWorkout.items.map((ex, idx) => (
                    <View key={idx} style={styles.historyExerciseRow}>
                      <Text style={styles.historyExerciseName}>{ex.exercises?.name}</Text>
                      <Text style={styles.historyExerciseMeta}>
                        {ex.sets || 3}x{ex.reps || '-'}{ex.load_kg != null ? ` · ${ex.load_kg}kg` : ''}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {showOtherWeekPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.modalTitle}>Usar qual semana como base?</Text>
              <TouchableOpacity onPress={() => setShowOtherWeekPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma semana no histórico ainda.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {history.map((group) => (
                  <TouchableOpacity key={group.key} style={styles.fichaOption} onPress={() => handlePickOtherWeek(group)}>
                    <Text style={styles.fichaOptionText}>{weekRangeLabel(group)}</Text>
                    <Text style={styles.historyRowNames} numberOfLines={1}>{group.workouts.map((w) => w.name).join(' · ')}</Text>
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

function SummaryPill({ label, value }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillValue}>{value}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  subtitle: { color: '#a3a3a3', fontSize: 12, paddingHorizontal: 16, marginBottom: 14 },

  weekNavRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  weekRangeText: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  weekBadgeCurrent: { color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  weekBadgeArchived: { color: '#737373', fontSize: 9, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },

  summaryPanel: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryPill: { flex: 1, minWidth: 70, alignItems: 'center' },
  summaryPillValue: { color: '#FF6B00', fontSize: 17, fontWeight: '800' },
  summaryPillLabel: { color: '#737373', fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  summaryMuscles: { color: '#a3a3a3', fontSize: 11, marginTop: 10, textAlign: 'center', textTransform: 'capitalize' },

  emptyStateBox: { alignItems: 'center', paddingVertical: 30 },

  dayCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 10 },
  dayCardToday: { borderColor: '#FF6B00' },
  dayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayCardHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayLabel: { color: '#525252', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayCardBody: {},
  workoutName: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  workoutMuscles: { color: '#FF6B00', fontSize: 12, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },
  workoutMeta: { color: '#a3a3a3', fontSize: 11, marginTop: 4 },
  restCard: { alignItems: 'center', paddingVertical: 6 },
  restText: { color: '#525252', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  restHint: { color: '#3b82f6', fontSize: 11, fontWeight: '600', marginTop: 4 },

  secondaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  secondaryButtonText: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
  editFichasButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  editFichasButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },

  emptyText: { color: '#737373', fontSize: 12, textAlign: 'center', marginVertical: 10, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#1C1C22', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '800', marginBottom: 14 },
  removeDayOption: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10 },
  removeDayOptionText: { color: '#ef4444', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  fichaOption: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  fichaOptionText: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  modalCancelButton: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },

  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F0F12', borderRadius: 8, padding: 10, marginBottom: 14 },
  readOnlyBannerText: { color: '#737373', fontSize: 10, flexShrink: 1 },
  historyExerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#0F0F12', paddingVertical: 8 },
  historyExerciseName: { color: '#d4d4d4', fontSize: 12, flex: 1 },
  historyExerciseMeta: { color: '#737373', fontSize: 11, marginLeft: 8 },
  historyRowNames: { color: '#737373', fontSize: 11, marginTop: 2 },

  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '75%' },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
});
