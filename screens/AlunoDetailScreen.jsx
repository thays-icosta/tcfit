import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import WorkoutBuilderScreen from './WorkoutBuilderScreen';
import DietBuilderScreen from './DietBuilderScreen';
import PhysicalAssessmentScreen from './PhysicalAssessmentScreen';
import StudentWorkoutHistoryScreen from './StudentWorkoutHistoryScreen';
import StudentDietDiaryViewScreen from './StudentDietDiaryViewScreen';
import VolumeSummaryScreen from './VolumeSummaryScreen';
import WeeklyPeriodizationScreen from './WeeklyPeriodizationScreen';
import PersonalFinanceScreen from './PersonalFinanceScreen';
import ChatScreen from './ChatScreen';
import AnamneseViewScreen from './AnamneseViewScreen';
import { HeaderBack } from './Header';
import MetricsMiniCards from './MetricsMiniCards';
import WeightEvolutionChart from './WeightEvolutionChart';

function mapMealNameToType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('café') || n.includes('cafe') || n.includes('manhã') || n.includes('manha')) return 'cafe';
  if (n.includes('almo')) return 'almoco';
  if (n.includes('lanche')) return 'lanche';
  if (n.includes('jant')) return 'jantar';
  if (n.includes('ceia')) return 'ceia';
  return 'lanche';
}

function getRpeTag(pse) {
  if (!pse) return null;
  if (pse <= 2) return { label: 'Leve', color: '#22c55e' };
  if (pse === 3) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Intenso', color: '#ef4444' };
}

const ACCESS_LEVELS = [
  { value: 'plataforma_base', label: 'Plataforma Base' },
  { value: 'consultoria_vip', label: 'Consultoria VIP' },
];

export default function AlunoDetailScreen({ student, personalId, onClose }) {
  const [lastSession, setLastSession] = useState(null);
  const [diaryTotals, setDiaryTotals] = useState(null);
  const [waterMl, setWaterMl] = useState(0);
  const [mealsCompleted, setMealsCompleted] = useState(0);
  const [mealsTotal, setMealsTotal] = useState(0);
  const [weekDaysCount, setWeekDaysCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOverdue, setIsOverdue] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAnamnese, setShowAnamnese] = useState(false);
  const [accessLevel, setAccessLevel] = useState(student.access_level || 'plataforma_base');
  const [savingAccessLevel, setSavingAccessLevel] = useState(false);

  const handleChangeAccessLevel = async (level) => {
    if (level === accessLevel) return;
    setSavingAccessLevel(true);
    const { data, error } = await supabase.from('users').update({ access_level: level }).eq('id', student.id).select().maybeSingle();
    setSavingAccessLevel(false);
    if (error) {
      showAlert('Erro', error.message);
    } else if (!data) {
      showAlert('Não foi possível atualizar', 'O nível de acesso não foi alterado. Tenta de novo em alguns instantes.');
    } else {
      setAccessLevel(level);
    }
  };

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

    const { data: activeDietRows } = await supabase
      .from('diets')
      .select('id, goal_kcal')
      .eq('student_id', student.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    const activeDiet = activeDietRows && activeDietRows.length > 0 ? activeDietRows[0] : null;
    const goalKcal = activeDiet?.goal_kcal ?? null;

    const { data: entries } = await supabase
      .from('food_diary_entries')
      .select('calories_kcal, meal_type')
      .eq('student_id', student.id)
      .eq('entry_date', todayStr);
    const consumedKcal = (entries || []).reduce((sum, e) => sum + (e.calories_kcal || 0), 0);
    setDiaryTotals({ goalKcal, consumedKcal });

    if (activeDiet) {
      const { data: mealRows } = await supabase.from('diet_meals').select('name').eq('diet_id', activeDiet.id);
      const consumedMealTypes = new Set((entries || []).map((e) => e.meal_type));
      setMealsTotal((mealRows || []).length);
      setMealsCompleted((mealRows || []).filter((m) => consumedMealTypes.has(mapMealNameToType(m.name))).length);
    } else {
      setMealsTotal(0);
      setMealsCompleted(0);
    }

    const { data: waterRows } = await supabase
      .from('water_entries')
      .select('amount_ml')
      .eq('student_id', student.id)
      .eq('entry_date', todayStr);
    setWaterMl((waterRows || []).reduce((sum, w) => sum + w.amount_ml, 0));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: weekCompletions } = await supabase
      .from('workout_completions')
      .select('completed_at')
      .eq('student_id', student.id)
      .gte('completed_at', sevenDaysAgo.toISOString());
    const uniqueDays = new Set((weekCompletions || []).map((c) => c.completed_at.slice(0, 10)));
    setWeekDaysCount(uniqueDays.size);

    const { data: overdueRows } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', student.id)
      .eq('paid', false)
      .lt('due_date', todayStr)
      .limit(1);
    setIsOverdue((overdueRows || []).length > 0);

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
  if (showChat) {
    return (
      <ChatScreen
        personalId={personalId}
        studentId={student.id}
        currentUserId={personalId}
        otherName={student.name}
        otherAvatarUrl={student.avatar_url}
        onClose={() => setShowChat(false)}
      />
    );
  }
  if (showAnamnese) {
    return <AnamneseViewScreen studentId={student.id} onClose={() => setShowAnamnese(false)} />;
  }

  const lastDurationMin = lastSession && lastSession.finished_at
    ? Math.round((new Date(lastSession.finished_at) - new Date(lastSession.started_at)) / 60000)
    : null;
  const lastRpeTag = lastSession ? getRpeTag(lastSession.pse) : null;

  return (
    <View style={styles.container}>
      <HeaderBack onBack={onClose} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.summaryHeaderCard}>
        <View style={styles.summaryHeaderTop}>
          <View style={styles.avatarCircle}>
            {student.avatar_url ? (
              <Image source={{ uri: student.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarLetter}>{student.name?.charAt(0).toUpperCase() || '?'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{student.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isOverdue && styles.statusDotInactive]} />
              <Text style={[styles.statusText, isOverdue && styles.statusTextInactive]}>{isOverdue ? 'Inativo' : 'Ativo'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.chatShortcutButton} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles-outline" size={18} color="#22c55e" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.anamneseButton} onPress={() => setShowAnamnese(true)}>
          <Ionicons name="clipboard-outline" size={16} color="#0a0a0a" />
          <Text style={styles.anamneseButtonText}>Abrir Anamnese</Text>
        </TouchableOpacity>
      </View>

      <MetricsMiniCards
        caloriesConsumed={diaryTotals?.consumedKcal || 0}
        caloriesGoal={diaryTotals?.goalKcal}
        waterMl={waterMl}
        mealsCompleted={mealsCompleted}
        mealsTotal={mealsTotal}
        weeklyPercent={(weekDaysCount / 7) * 100}
      />

      <WeightEvolutionChart studentId={student.id} />

      <View style={styles.accessLevelBox}>
        <Text style={styles.accessLevelLabel}>Nível de acesso {savingAccessLevel && '(salvando...)'}</Text>
        <View style={styles.accessLevelRow}>
          {ACCESS_LEVELS.map((lvl) => (
            <TouchableOpacity
              key={lvl.value}
              style={[styles.accessLevelChip, accessLevel === lvl.value && styles.accessLevelChipActive]}
              onPress={() => handleChangeAccessLevel(lvl.value)}
            >
              <Text style={[styles.accessLevelChipText, accessLevel === lvl.value && styles.accessLevelChipTextActive]}>{lvl.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
        <>
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
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  summaryHeaderCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, padding: 14, marginBottom: 16 },
  summaryHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0a0a0a', borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 56, height: 56 },
  avatarLetter: { color: '#f97316', fontSize: 20, fontWeight: '800' },
  studentName: { color: '#f5f5f5', fontSize: 17, fontWeight: '800' },
  studentEmail: { color: '#737373', fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  statusDotInactive: { backgroundColor: '#ef4444' },
  statusText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  statusTextInactive: { color: '#ef4444' },
  chatShortcutButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  anamneseButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  anamneseButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  accessLevelBox: { marginBottom: 16 },
  accessLevelLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' },
  accessLevelRow: { flexDirection: 'row', gap: 8 },
  accessLevelChip: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  accessLevelChipActive: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  accessLevelChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  accessLevelChipTextActive: { color: '#0a0a0a' },
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