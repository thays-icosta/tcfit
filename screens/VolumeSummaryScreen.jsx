import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';

function parseReps(repsStr) {
  if (!repsStr) return 10;
  const numbers = String(repsStr).match(/\d+/g);
  if (!numbers || numbers.length === 0) return 10;
  const nums = numbers.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

async function resolveActualExercises(supabase, setsRaw) {
  const substitutedIds = [...new Set((setsRaw || []).map((s) => s.substituted_exercise_id).filter(Boolean))];
  let substitutedMap = {};
  if (substitutedIds.length > 0) {
    const { data: subExercises } = await supabase.from('exercises').select('id, name, muscle_group').in('id', substitutedIds);
    (subExercises || []).forEach((e) => { substitutedMap[e.id] = e; });
  }
  return (setsRaw || []).map((s) => ({
    ...s,
    actualExercise: s.substituted_exercise_id ? substitutedMap[s.substituted_exercise_id] : s.workout_exercises?.exercises,
  }));
}

export default function VolumeSummaryScreen({ studentId, studentName, onClose }) {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState('semana');
  const [sessionsList, setSessionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailSession, setDetailSession] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period === 'semana' ? 7 : 30));

    const { data: sessionsRaw } = await supabase
      .from('workout_sessions')
      .select('id, started_at, finished_at, total_tonnage_kg, workouts (name)')
      .eq('student_id', studentId)
      .not('finished_at', 'is', null)
      .gte('finished_at', startDate.toISOString())
      .order('finished_at', { ascending: false });

    const sessionList = (sessionsRaw || [])
      .map((s) => ({
        id: s.id,
        name: s.workouts?.name || 'Treino',
        finishedAt: s.finished_at,
        startedAt: s.started_at,
        durationMin: Math.round((new Date(s.finished_at) - new Date(s.started_at)) / 60000),
        tonnage: Math.round(s.total_tonnage_kg || 0),
      }))
      .filter((s) => s.durationMin > 0 && s.tonnage > 0);

    setSessionsList(sessionList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [studentId, period]);

  const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const handleOpenSessionDetail = async (session) => {
    setLoadingDetail(true);
    setDetailSession({ session, exercises: [] });

    const { data: setsRaw } = await supabase
      .from('workout_session_sets')
      .select('id, load_used_kg, reps_done, substituted_exercise_id, workout_exercises (reps, exercises (name))')
      .eq('session_id', session.id);

    const sets = await resolveActualExercises(supabase, setsRaw);

    const byExercise = {};
    sets.forEach((s) => {
      const name = s.actualExercise?.name || 'Exercício';
      if (!byExercise[name]) byExercise[name] = { setsCount: 0, volume: 0 };
      byExercise[name].setsCount += 1;
      const reps = parseReps(s.reps_done || s.workout_exercises?.reps);
      byExercise[name].volume += (s.load_used_kg || 0) * reps;
    });

    setDetailSession({
      session,
      exercises: Object.entries(byExercise).map(([name, v]) => ({ name, setsCount: v.setsCount, volume: Math.round(v.volume) })),
    });
    setLoadingDetail(false);
  };

  if (detailSession) {
    const { session, exercises } = detailSession;
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top + 12, 24) }]}>
        <HeaderBack title="Detalhe da Sessão" onBack={() => setDetailSession(null)} />

        <View style={styles.detailHeaderCard}>
          <Text style={styles.detailWorkoutName}>{session.name}</Text>
          <Text style={styles.detailDate}>{formatDate(session.finishedAt)} · {session.durationMin}min</Text>
          <Text style={styles.detailVolumeBig}>{session.tonnage.toLocaleString('pt-BR')} kg</Text>
          <Text style={styles.detailVolumeLabel}>volume total da sessão</Text>
        </View>

        {loadingDetail ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
            <Text style={styles.sectionTitle}>Exercícios</Text>
            {exercises.map((ex) => (
              <View key={ex.name} style={styles.detailExerciseRow}>
                <Text style={styles.detailExerciseName}>{ex.name}</Text>
                <Text style={styles.detailExerciseStats}>{ex.setsCount} séries · Vol: {ex.volume.toLocaleString('pt-BR')}kg</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 12, 24) }]}>
      <HeaderBack title="Meu Histórico de Treinos" onBack={onClose} />

      {studentName && <Text style={styles.studentLabel}>{studentName}</Text>}

      <View style={[styles.periodRow, styles.periodRowSpacing]}>
        <TouchableOpacity
          style={[styles.periodButton, period === 'semana' && styles.periodButtonActive]}
          onPress={() => setPeriod('semana')}
        >
          <Text style={[styles.periodButtonText, period === 'semana' && styles.periodButtonTextActive]}>Semana</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'mes' && styles.periodButtonActive]}
          onPress={() => setPeriod('mes')}
        >
          <Text style={[styles.periodButtonText, period === 'mes' && styles.periodButtonTextActive]}>Mês</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Histórico de treinos do período</Text>

          {sessionsList.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum treino registrado nesse período.</Text>
          ) : (
            sessionsList.map((s) => (
              <TouchableOpacity key={s.id} style={styles.historyRow} onPress={() => handleOpenSessionDetail(s)}>
                <Text style={styles.historyRowText} numberOfLines={1}>
                  {formatDate(s.finishedAt)} · {s.name}
                </Text>
                <Text style={styles.historyRowVolume}>{s.tonnage.toLocaleString('pt-BR')} kg totais</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  studentLabel: { color: '#737373', fontSize: 12, marginBottom: 14 },
  periodRow: { flexDirection: 'row', backgroundColor: '#171717', borderRadius: 10, padding: 3, marginBottom: 18 },
  periodRowSpacing: { marginTop: 16 },
  periodButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  periodButtonActive: { backgroundColor: '#f97316' },
  periodButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  periodButtonTextActive: { color: '#0a0a0a' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 10, marginBottom: 10 },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 6 },
  historyRowText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  historyRowVolume: { color: '#f97316', fontSize: 13, fontWeight: '800' },
  detailHeaderCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 18, marginHorizontal: 16, marginBottom: 16, alignItems: 'center' },
  detailWorkoutName: { color: '#f5f5f5', fontSize: 15, fontWeight: '700' },
  detailDate: { color: '#737373', fontSize: 11, marginTop: 4, marginBottom: 14 },
  detailVolumeBig: { color: '#f97316', fontSize: 30, fontWeight: '800' },
  detailVolumeLabel: { color: '#525252', fontSize: 10, marginTop: 2 },
  detailExerciseRow: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 8 },
  detailExerciseName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  detailExerciseStats: { color: '#a3a3a3', fontSize: 11, marginTop: 3 },
});