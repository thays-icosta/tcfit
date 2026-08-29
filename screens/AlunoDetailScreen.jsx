import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import WorkoutBuilderScreen from './WorkoutBuilderScreen';
import DietBuilderScreen from './DietBuilderScreen';
import PhysicalAssessmentScreen from './PhysicalAssessmentScreen';
import StudentWorkoutHistoryScreen from './StudentWorkoutHistoryScreen';
import StudentDietDiaryViewScreen from './StudentDietDiaryViewScreen';
import VolumeSummaryScreen from './VolumeSummaryScreen';
import WeeklyPeriodizationScreen from './WeeklyPeriodizationScreen';
import PersonalFinanceScreen from './PersonalFinanceScreen';

function getRpeTag(pse) {
  if (!pse) return null;
  if (pse <= 2) return { label: 'Leve', color: '#22c55e' };
  if (pse === 3) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Intenso', color: '#ef4444' };
}

export default function AlunoDetailScreen({ student, personalId, onClose }) {
  const [lastSession, setLastSession] = useState(null);
  const [diaryTotals, setDiaryTotals] = useState(null);
  const [loading, setLoading] = useState(true);

  const [buildingFor, setBuildingFor] = useState(false);
  const [dietBuildingFor, setDietBuildingFor] = useState(false);
  const [assessmentFor, setAssessmentFor] = useState(false);
  const [workoutHistoryFor, setWorkoutHistoryFor] = useState(false);
  const [dietDiaryFor, setDietDiaryFor] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showPeriodization, setShowPeriodization] = useState(false);
  const [showFinance, setShowFinance] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const loadContent = async () => {
    const { data: sessionRows } = await supabase
      .from('workout_sessions')
      .select('id, started_at, finished_at, pse, total_tonnage_kg, workouts (name)')
      .eq('student_id', student.id)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1);
    setLastSession(sessionRows && sessionRows.length > 0 ? sessionRows[0] : null);

    const { data: goalRows } = await supabase
      .from('diets')
      .select('goal_kcal')
      .eq('student_id', student.id)
      .eq('active', true)
      .not('goal_kcal', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const goalKcal = goalRows && goalRows.length > 0 ? goalRows[0].goal_kcal : null;

    const { data: entries } = await supabase
      .from('food_diary_entries')
      .select('calories_kcal')
      .eq('student_id', student.id)
      .eq('entry_date', todayStr);
    const consumedKcal = (entries || []).reduce((sum, e) => sum + (e.calories_kcal || 0), 0);
    setDiaryTotals({ goalKcal, consumedKcal });

    setLoading(false);
  };

  useEffect(() => {
    loadContent();
  }, [student.id]);

  if (buildingFor) {
    return (
      <WorkoutBuilderScreen
        studentId={student.id}
        studentName={student.name}
        personalId={personalId}
        onClose={() => { setBuildingFor(false); loadContent(); }}
      />
    );
  }
  if (dietBuildingFor) {
    return (
      <DietBuilderScreen
        studentId={student.id}
        studentName={student.name}
        personalId={personalId}
        onClose={() => { setDietBuildingFor(false); loadContent(); }}
      />
    );
  }
  if (assessmentFor) {
    return (
      <PhysicalAssessmentScreen
        studentId={student.id}
        studentName={student.name}
        personalId={personalId}
        onClose={() => setAssessmentFor(false)}
      />
    );
  }
  if (workoutHistoryFor) {
    return (
      <StudentWorkoutHistoryScreen
        studentId={student.id}
        studentName={student.name}
        onClose={() => setWorkoutHistoryFor(false)}
      />
    );
  }
  if (dietDiaryFor) {
    return (
      <StudentDietDiaryViewScreen
        studentId={student.id}
        studentName={student.name}
        onClose={() => setDietDiaryFor(false)}
      />
    );
  }
  if (showSummary) {
    return (
      <VolumeSummaryScreen
        studentId={student.id}
        studentName={student.name}
        onClose={() => setShowSummary(false)}
      />
    );
  }
  if (showPeriodization) {
    return (
      <WeeklyPeriodizationScreen
        studentId={student.id}
        studentName={student.name}
        personalId={personalId}
        isPersonal={true}
        onClose={() => setShowPeriodization(false)}
      />
    );
  }
  if (showFinance) {
    return (
      <PersonalFinanceScreen
        personalId={personalId}
        filterStudentId={student.id}
        filterStudentName={student.name}
        onClose={() => setShowFinance(false)}
      />
    );
  }

  const lastDurationMin = lastSession && lastSession.finished_at
    ? Math.round((new Date(lastSession.finished_at) - new Date(lastSession.started_at)) / 60000)
    : null;
  const lastRpeTag = lastSession ? getRpeTag(lastSession.pse) : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.studentHeader}>
        <View style={styles.avatarCircle}>
          {student.avatar_url ? (
            <Image source={{ uri: student.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarLetter}>{student.name?.charAt(0).toUpperCase() || '?'}</Text>
          )}
        </View>
        <Text style={styles.studentName}>{student.name}</Text>
        <Text style={styles.studentEmail}>{student.email}</Text>
      </View>

      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setBuildingFor(true)}>
          <Ionicons name="barbell-outline" size={22} color="#f97316" />
          <Text style={styles.actionLabel}>Treino</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setDietBuildingFor(true)}>
          <Ionicons name="restaurant-outline" size={22} color="#22c55e" />
          <Text style={styles.actionLabel}>Dieta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setAssessmentFor(true)}>
          <Ionicons name="clipboard-outline" size={22} color="#3b82f6" />
          <Text style={styles.actionLabel}>Avaliação</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowPeriodization(true)}>
          <Ionicons name="calendar-outline" size={22} color="#a855f7" />
          <Text style={styles.actionLabel}>Periodização</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.summaryButton} onPress={() => setShowSummary(true)}>
        <Ionicons name="stats-chart-outline" size={18} color="#0a0a0a" />
        <Text style={styles.summaryButtonText}>Gerar Resumo Semanal</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.financeButton} onPress={() => setShowFinance(true)}>
        <Ionicons name="cash-outline" size={18} color="#eab308" />
        <Text style={styles.financeButtonText}>Ver Financeiro</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView>
          <Text style={styles.blockLabel}>Último treino</Text>
          {!lastSession ? (
            <Text style={styles.emptyText}>Nenhum treino finalizado ainda.</Text>
          ) : (
            <View style={styles.sessionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionName}>{lastSession.workouts?.name}</Text>
                <Text style={styles.sessionDate}>
                  {formatDate(lastSession.finished_at)}
                  {lastSession.total_tonnage_kg != null ? ` · ${Math.round(lastSession.total_tonnage_kg)}kg` : ''}
                </Text>
              </View>
              <View style={styles.sessionStats}>
                {lastDurationMin != null && <Text style={styles.sessionStat}>{lastDurationMin}min</Text>}
                {lastRpeTag && (
                  <View style={[styles.rpeTag, { borderColor: lastRpeTag.color }]}>
                    <Text style={[styles.rpeTagText, { color: lastRpeTag.color }]}>{lastRpeTag.label}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          <TouchableOpacity onPress={() => setWorkoutHistoryFor(true)}>
            <Text style={styles.viewMoreLink}>Ver histórico completo →</Text>
          </TouchableOpacity>

          <View style={styles.sectionDivider} />

          <Text style={styles.blockLabel}>Diário alimentar de hoje</Text>
          {!diaryTotals ? (
            <ActivityIndicator color="#f97316" size="small" style={{ marginTop: 6 }} />
          ) : (
            <TouchableOpacity onPress={() => setDietDiaryFor(true)} style={styles.diaryBarBox}>
              <Text style={styles.diaryBarText}>
                {Math.round(diaryTotals.consumedKcal)}{diaryTotals.goalKcal ? ` / ${diaryTotals.goalKcal}` : ''} kcal
              </Text>
              {diaryTotals.goalKcal && (
                <View style={styles.diaryBarTrack}>
                  <View style={[styles.diaryBarFill, { width: `${Math.min(100, (diaryTotals.consumedKcal / diaryTotals.goalKcal) * 100)}%` }]} />
                </View>
              )}
              <Text style={styles.viewMoreLink}>Ver diário completo →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { marginBottom: 8 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  studentHeader: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#171717', borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 },
  avatarImage: { width: 72, height: 72 },
  avatarLetter: { color: '#f97316', fontSize: 26, fontWeight: '800' },
  studentName: { color: '#f5f5f5', fontSize: 19, fontWeight: '800' },
  studentEmail: { color: '#737373', fontSize: 12, marginTop: 2 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  actionButton: { width: '48%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  actionLabel: { color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginTop: 6 },
  summaryButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  summaryButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  financeButton: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#eab308', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  financeButtonText: { color: '#eab308', fontSize: 13, fontWeight: '700' },
  blockLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  emptyText: { color: '#525252', fontSize: 12, marginBottom: 8 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 8 },
  sessionName: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  sessionDate: { color: '#525252', fontSize: 10, marginTop: 2 },
  sessionStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionStat: { color: '#a3a3a3', fontSize: 10 },
  rpeTag: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rpeTagText: { fontSize: 9, fontWeight: '700' },
  viewMoreLink: { color: '#f97316', fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  sectionDivider: { height: 1, backgroundColor: '#171717', marginBottom: 12 },
  diaryBarBox: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 30 },
  diaryBarText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  diaryBarTrack: { height: 6, backgroundColor: '#0a0a0a', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  diaryBarFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },
});