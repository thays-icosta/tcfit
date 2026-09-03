import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [volumeByMuscle, setVolumeByMuscle] = useState({});
  const [kgByMuscle, setKgByMuscle] = useState({});
  const [sessionsList, setSessionsList] = useState([]);
  const [totalTonnage, setTotalTonnage] = useState(0);
  const [frequencyDays, setFrequencyDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
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

    const sessionIds = sessionList.map((s) => s.id);
    const uniqueDays = new Set(sessionList.map((s) => s.finishedAt.slice(0, 10)));
    setFrequencyDays(uniqueDays.size);

    const tonnage = sessionList.reduce((sum, s) => sum + s.tonnage, 0);
    setTotalTonnage(Math.round(tonnage));
    setSessionsList(sessionList);

    if (sessionIds.length > 0) {
      const { data: setsRaw } = await supabase
        .from('workout_session_sets')
        .select('id, load_used_kg, reps_done, substituted_exercise_id, workout_exercises (reps, exercises (name, muscle_group))')
        .in('session_id', sessionIds);

      const sets = await resolveActualExercises(supabase, setsRaw);

      const muscleCounts = {};
      const muscleKg = {};
      sets.forEach((s) => {
        const group = s.actualExercise?.muscle_group || 'outro';
        muscleCounts[group] = (muscleCounts[group] || 0) + 1;

        const reps = parseReps(s.reps_done || s.workout_exercises?.reps);
        muscleKg[group] = (muscleKg[group] || 0) + (s.load_used_kg || 0) * reps;
      });
      setVolumeByMuscle(muscleCounts);
      setKgByMuscle(muscleKg);
    } else {
      setVolumeByMuscle({});
      setKgByMuscle({});
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [studentId, period]);

  const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const muscleEntries = Object.entries(volumeByMuscle).sort((a, b) => b[1] - a[1]);
  const maxVolume = muscleEntries.length > 0 ? muscleEntries[0][1] : 1;
  const periodSuffix = period === 'semana' ? 'séries semanais' : 'séries no mês';

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

  const handleShare = async () => {
    let text = `📊 Resumo ${period === 'semana' ? 'Semanal' : 'Mensal'}${studentName ? ` — ${studentName}` : ''}\n\n`;
    text += `📅 ${period === 'semana' ? `Dias treinados: ${frequencyDays}/7` : `Treinos realizados: ${sessionsList.length}`}\n`;
    text += `🏋️ Volume total: ${totalTonnage}kg\n\n`;
    text += `Séries por grupo muscular:\n`;
    muscleEntries.forEach(([group, count]) => {
      text += `• ${group}: ${count} ${periodSuffix} · ${Math.round(kgByMuscle[group] || 0)}kg\n`;
    });
    try {
      await Share.share({ message: text });
    } catch (e) {}
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
      <HeaderBack title="Resumo Semanal" onBack={onClose} />

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
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{period === 'semana' ? `${frequencyDays}/7` : sessionsList.length}</Text>
              <Text style={styles.statLabel}>{period === 'semana' ? 'dias treinados' : 'treinos realizados'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalTonnage.toLocaleString('pt-BR')}kg</Text>
              <Text style={styles.statLabel}>volume total</Text>
            </View>
          </View>

          <View style={styles.muscleSectionCard}>
            <Text style={styles.muscleSectionTitle}>Séries por grupo muscular</Text>
            {muscleEntries.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum treino registrado nesse período.</Text>
            ) : (
              muscleEntries.map(([group, count]) => (
                <View key={group} style={styles.muscleRow}>
                  <Text style={styles.muscleHeadline}>
                    <Text style={styles.muscleHeadlineName}>{group}</Text>
                    <Text style={styles.muscleHeadlineBullet}> • </Text>
                    <Text style={styles.muscleHeadlineCount}>{count} {periodSuffix}</Text>
                  </Text>
                  <View style={styles.volumeBarTrack}>
                    <View style={[styles.volumeBarFill, { width: `${(count / maxVolume) * 100}%` }]} />
                  </View>
                  <Text style={styles.muscleKgText}>{Math.round(kgByMuscle[group] || 0)} kg totais</Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.historyHeader} onPress={() => setHistoryExpanded(!historyExpanded)}>
            <Text style={styles.sectionTitle}>Histórico de treinos do período</Text>
            <Ionicons name={historyExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#737373" />
          </TouchableOpacity>

          {historyExpanded && (
            sessionsList.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum treino registrado nesse período.</Text>
            ) : (
              sessionsList.map((s) => (
                <TouchableOpacity key={s.id} style={styles.historyRow} onPress={() => handleOpenSessionDetail(s)}>
                  <Text style={styles.historyRowText} numberOfLines={1}>
                    {formatDate(s.finishedAt)} · {s.name}
                  </Text>
                  <Text style={styles.historyRowVolume}>{s.tonnage.toLocaleString('pt-BR')} kg</Text>
                </TouchableOpacity>
              ))
            )
          )}

          {muscleEntries.length > 0 && (
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>📤 Compartilhar Resumo</Text>
            </TouchableOpacity>
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  statValue: { color: '#f97316', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 4 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 10, marginBottom: 10 },
  muscleSectionCard: { backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 14, padding: 14, marginBottom: 20 },
  muscleSectionTitle: { color: '#22c55e', fontSize: 13, fontWeight: '800', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  muscleRow: { marginBottom: 16 },
  muscleHeadline: { marginBottom: 6 },
  muscleHeadlineName: { color: '#f5f5f5', fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  muscleHeadlineBullet: { color: '#525252', fontSize: 13, fontWeight: '800' },
  muscleHeadlineCount: { color: '#22c55e', fontSize: 13, fontWeight: '800' },
  volumeBarTrack: { height: 10, backgroundColor: '#0a0a0a', borderRadius: 5, overflow: 'hidden', marginBottom: 5 },
  volumeBarFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 5 },
  muscleKgText: { color: '#a3a3a3', fontSize: 11 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 6 },
  historyRowText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  historyRowVolume: { color: '#f97316', fontSize: 13, fontWeight: '800' },
  shareButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  shareButtonText: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  detailHeaderCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 18, marginHorizontal: 16, marginBottom: 16, alignItems: 'center' },
  detailWorkoutName: { color: '#f5f5f5', fontSize: 15, fontWeight: '700' },
  detailDate: { color: '#737373', fontSize: 11, marginTop: 4, marginBottom: 14 },
  detailVolumeBig: { color: '#f97316', fontSize: 30, fontWeight: '800' },
  detailVolumeLabel: { color: '#525252', fontSize: 10, marginTop: 2 },
  detailExerciseRow: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 8 },
  detailExerciseName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  detailExerciseStats: { color: '#a3a3a3', fontSize: 11, marginTop: 3 },
});