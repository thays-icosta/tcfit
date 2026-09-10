import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, TextInput } from 'react-native';
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
import PersonalProjectProgressSection from './PersonalProjectProgressSection';
import WaterLogModal from './WaterLogModal';
import PresencialSessionScreen from './PresencialSessionScreen';
import { PROGRAM_GOALS, PROGRAM_LEVELS, TRAINING_LOCATIONS, PAIN_ZONES, MUSCLE_FOCUS_OPTIONS } from './accessLevel';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Scores how well a template fits the student's anamnese: session count vs
// declared weekly availability, then level/environment/focus as tie-breakers.
// Returns 0 (no real match) rather than guessing when there's nothing to go on.
function scoreTemplateMatch(sessionCount, anamnese) {
  return (template) => {
    let score = 0;
    const days = anamnese.days_per_week;
    if (days != null && sessionCount[template.id]) {
      const n = sessionCount[template.id];
      if (days <= 3 && n <= 2) score += 3;
      else if (days === 4 && n >= 2 && n <= 4) score += 3;
      else if (days >= 5 && n >= 3) score += 3;
    }
    if (anamnese.experience_level && template.level === anamnese.experience_level) score += 2;
    if (anamnese.training_location && template.environment === anamnese.training_location) score += 2;
    if (anamnese.focus_muscle_group && template.focus_muscle_group === anamnese.focus_muscle_group) score += 4;
    return score;
  };
}

function mapMealNameToType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('café') || n.includes('cafe') || n.includes('manhã') || n.includes('manha')) return 'cafe';
  if (n.includes('almo')) return 'almoco';
  if (n.includes('lanche')) return 'lanche';
  if (n.includes('jant')) return 'jantar';
  if (n.includes('ceia')) return 'ceia';
  return 'lanche';
}

const ACCESS_LEVELS = [
  { value: 'plataforma_base', label: 'Plataforma Base' },
  { value: 'consultoria_vip', label: 'Consultoria VIP' },
];

const ATTENDANCE_MODES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Consultoria Online' },
];

export default function AlunoDetailScreen({ student, personalId, personalName, onClose }) {
  const [lastSession, setLastSession] = useState(null);
  const [diaryTotals, setDiaryTotals] = useState(null);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoalMl, setWaterGoalMl] = useState(2000);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [mealsCompleted, setMealsCompleted] = useState(0);
  const [mealsTotal, setMealsTotal] = useState(0);
  const [weekDaysCount, setWeekDaysCount] = useState(0);
  const [isOverdue, setIsOverdue] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAnamnese, setShowAnamnese] = useState(false);
  const [accessLevel, setAccessLevel] = useState(student.access_level || 'plataforma_base');
  const [savingAccessLevel, setSavingAccessLevel] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState(student.attendance_mode || 'online');
  const [savingAttendanceMode, setSavingAttendanceMode] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [detailTab, setDetailTab] = useState('resumo');

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase.from('users').update({ personal_notes: personalNotes.trim() || null }).eq('id', student.id);
    setSavingNotes(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  };

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

  const handleChangeAttendanceMode = async (mode) => {
    if (mode === attendanceMode) return;
    setSavingAttendanceMode(true);
    const { data, error } = await supabase.from('users').update({ attendance_mode: mode }).eq('id', student.id).select().maybeSingle();
    setSavingAttendanceMode(false);
    if (error) {
      showAlert('Erro', error.message);
    } else if (!data) {
      showAlert('Não foi possível atualizar', 'O tipo de atendimento não foi alterado. Tenta de novo em alguns instantes.');
    } else {
      setAttendanceMode(mode);
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
  const [showPresencialSession, setShowPresencialSession] = useState(false);
  const [anamnese, setAnamnese] = useState(null);
  const [suggestedTemplate, setSuggestedTemplate] = useState(null);
  const [applyingSuggestion, setApplyingSuggestion] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleAddWater = async (ml) => {
    await supabase.from('water_entries').insert({ student_id: student.id, entry_date: todayStr, amount_ml: ml });
    loadContent();
  };

  const loadContent = async () => {
    const { data: sessionRows } = await supabase
      .from('workout_sessions')
      .select('workouts (name)')
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

    const { data: studentRow } = await supabase.from('users').select('water_goal_ml, personal_notes').eq('id', student.id).single();
    setWaterGoalMl(studentRow?.water_goal_ml || 2000);
    setPersonalNotes(studentRow?.personal_notes || '');

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

    const { data: anamneseRow } = await supabase
      .from('anamnese_responses')
      .select('*')
      .eq('student_id', student.id)
      .maybeSingle();
    setAnamnese(anamneseRow || null);

    if (anamneseRow?.completed_at) {
      const { data: templateRows } = await supabase
        .from('workout_templates')
        .select('id, name, level, environment, focus_muscle_group')
        .eq('personal_id', personalId)
        .eq('archived', false);
      if (templateRows && templateRows.length > 0) {
        const { data: sessionRows } = await supabase
          .from('template_sessions')
          .select('template_id')
          .in('template_id', templateRows.map((t) => t.id));
        const counts = {};
        (sessionRows || []).forEach((r) => { counts[r.template_id] = (counts[r.template_id] || 0) + 1; });
        const scorer = scoreTemplateMatch(counts, anamneseRow);
        const ranked = templateRows
          .map((t) => ({ ...t, sessionCount: counts[t.id] || 0, score: scorer(t) }))
          .filter((t) => t.sessionCount > 0 && t.score > 0)
          .sort((a, b) => b.score - a.score);
        setSuggestedTemplate(ranked[0] || null);
      } else {
        setSuggestedTemplate(null);
      }
    } else {
      setSuggestedTemplate(null);
    }
  };

  useEffect(() => {
    loadContent();
  }, [student.id]);

  // Creates one workouts row per session in the template (Treino A, B, C...)
  // rather than merging every session's exercises into a single flat ficha.
  const handleApplySuggestedTemplate = async () => {
    if (!suggestedTemplate) return;
    setApplyingSuggestion(true);

    const { data: sessions } = await supabase
      .from('template_sessions')
      .select('id, name, order_index')
      .eq('template_id', suggestedTemplate.id)
      .order('order_index', { ascending: true });

    if (!sessions || sessions.length === 0) {
      setApplyingSuggestion(false);
      showAlert('Erro', 'Esse template não tem nenhuma sessão configurada.');
      return;
    }

    for (const session of sessions) {
      const { data: newWorkout, error } = await supabase
        .from('workouts')
        .insert({ id: uuidv4(), student_id: student.id, personal_id: personalId, name: session.name, active: true })
        .select()
        .single();
      if (error || !newWorkout) continue;

      const { data: templateItems } = await supabase
        .from('workout_template_exercises')
        .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
        .eq('session_id', session.id);

      if (templateItems && templateItems.length > 0) {
        const copies = templateItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
        await supabase.from('workout_exercises').insert(copies);
      }
    }

    await supabase.functions.invoke('send-user-push', {
      body: {
        userId: student.id,
        title: 'Ficha atualizada!',
        body: `${personalName || 'Seu personal'} atualizou seu treino! Abra o app para conferir sua nova ficha.`,
        data: { type: 'workout_updated' },
      },
    }).catch(() => {});

    setApplyingSuggestion(false);
    setSuggestionApplied(true);
    showAlert('Aplicado!', `"${suggestedTemplate.name}" criado com ${sessions.length} sessão(ões) pra ${student.name}.`);
  };

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
  if (showPresencialSession) {
    return (
      <PresencialSessionScreen
        student={student}
        personalId={personalId}
        onClose={() => setShowPresencialSession(false)}
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
            {student.email && <Text style={styles.studentEmail} numberOfLines={1}>{student.email}</Text>}
            {student.phone && <Text style={styles.studentEmail} numberOfLines={1}>{student.phone}</Text>}
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isOverdue && styles.statusDotInactive]} />
              <Text style={[styles.statusText, isOverdue && styles.statusTextInactive]}>{isOverdue ? 'Inativo' : 'Ativo'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.chatShortcutButton} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles-outline" size={18} color="#22c55e" />
          </TouchableOpacity>
        </View>

        {((anamnese?.pain_zones && anamnese.pain_zones.length > 0) || anamnese?.health_issues) && (
          <View style={styles.healthAlertRow}>
            {(anamnese.pain_zones || []).map((z) => (
              <View key={z} style={styles.healthAlertBadge}>
                <Ionicons name="warning-outline" size={11} color="#ef4444" />
                <Text style={styles.healthAlertBadgeText}>Dor: {PAIN_ZONES.find((p) => p.value === z)?.label || z}</Text>
              </View>
            ))}
            {anamnese.health_issues && (
              <View style={styles.healthAlertBadge}>
                <Ionicons name="warning-outline" size={11} color="#ef4444" />
                <Text style={styles.healthAlertBadgeText} numberOfLines={1}>{anamnese.health_issues}</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.anamneseButton} onPress={() => setShowAnamnese(true)}>
          <Ionicons name="clipboard-outline" size={16} color="#0F0F12" />
          <Text style={styles.anamneseButtonText}>Abrir Anamnese</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detailTabRow}>
        {[
          { value: 'resumo', label: 'Resumo' },
          { value: 'treino', label: 'Treino' },
          { value: 'evolucao', label: 'Evolução' },
          { value: 'comunicacao', label: 'Comunicação' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.detailTabButton, detailTab === tab.value && styles.detailTabButtonActive]}
            onPress={() => setDetailTab(tab.value)}
          >
            <Text style={[styles.detailTabText, detailTab === tab.value && styles.detailTabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {detailTab === 'resumo' && (
        <>
          <View style={styles.notesCard}>
            <View style={styles.anamneseSummaryHeader}>
              <Text style={styles.anamneseSummaryTitle}>Suas Observações</Text>
              {notesSaved && <Text style={styles.notesSavedLabel}>Salvo!</Text>}
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Só você vê isso. Ex: lesão no ombro esquerdo, prefere treinar de manhã..."
              placeholderTextColor="#525252"
              value={personalNotes}
              onChangeText={setPersonalNotes}
              multiline
            />
            <TouchableOpacity style={styles.notesSaveButton} onPress={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.notesSaveButtonText}>Salvar Observações</Text>}
            </TouchableOpacity>
          </View>

          {anamnese?.completed_at && (
            <View style={styles.anamneseSummaryCard}>
              <View style={styles.anamneseSummaryHeader}>
                <Text style={styles.anamneseSummaryTitle}>Resumo da Anamnese</Text>
                <TouchableOpacity onPress={() => setShowAnamnese(true)}>
                  <Text style={styles.anamneseSummaryLink}>Ver completa</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.anamneseSummaryRow}>
                <Ionicons name="flag-outline" size={13} color="#a3a3a3" />
                <Text style={styles.anamneseSummaryLine}>
                  {PROGRAM_GOALS.find((g) => g.value === anamnese.main_goal)?.label || '—'}
                  {anamnese.experience_level ? ` · ${PROGRAM_LEVELS.find((l) => l.value === anamnese.experience_level)?.label}` : ''}
                </Text>
              </View>
              <View style={styles.anamneseSummaryRow}>
                <Ionicons name="location-outline" size={13} color="#a3a3a3" />
                <Text style={styles.anamneseSummaryLine}>
                  {TRAINING_LOCATIONS.find((l) => l.value === anamnese.training_location)?.label || '—'}
                  {anamnese.days_per_week ? ` · ${anamnese.days_per_week}x/semana` : ''}
                </Text>
              </View>
              {anamnese.focus_muscle_group && (
                <View style={styles.anamneseSummaryRow}>
                  <Ionicons name="barbell-outline" size={13} color="#a3a3a3" />
                  <Text style={styles.anamneseSummaryLine}>
                    Foco: {MUSCLE_FOCUS_OPTIONS.find((m) => m.value === anamnese.focus_muscle_group)?.label}
                  </Text>
                </View>
              )}
            </View>
          )}

          <PersonalProjectProgressSection studentId={student.id} />

          <MetricsMiniCards
            caloriesConsumed={diaryTotals?.consumedKcal || 0}
            caloriesGoal={diaryTotals?.goalKcal}
            onPressCalories={() => setDietDiaryFor(true)}
            waterMl={waterMl}
            waterGoalMl={waterGoalMl}
            onPressWater={() => setShowWaterModal(true)}
            mealsCompleted={mealsCompleted}
            mealsTotal={mealsTotal}
            onPressHabits={() => setDietBuildingFor(true)}
            weeklyPercent={(weekDaysCount / 7) * 100}
            lastWorkoutLabel={lastSession?.workouts?.name}
            onPressFrequency={() => setWorkoutHistoryFor(true)}
          />

          <TouchableOpacity style={styles.dietButton} onPress={() => setDietBuildingFor(true)}>
            <Ionicons name="restaurant-outline" size={18} color="#0F0F12" />
            <Text style={styles.dietButtonText}>Montar / Editar Dieta</Text>
          </TouchableOpacity>

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

          <View style={styles.accessLevelBox}>
            <Text style={styles.accessLevelLabel}>Tipo de atendimento {savingAttendanceMode && '(salvando...)'}</Text>
            <View style={styles.accessLevelRow}>
              {ATTENDANCE_MODES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.accessLevelChip, attendanceMode === m.value && styles.attendanceModeChipActive]}
                  onPress={() => handleChangeAttendanceMode(m.value)}
                >
                  <Text style={[styles.accessLevelChipText, attendanceMode === m.value && styles.accessLevelChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {detailTab === 'treino' && (
        <>
          {suggestedTemplate && !suggestionApplied && (
            <View style={styles.suggestionCard}>
              <View style={styles.suggestionTitleRow}>
                <Ionicons name="bulb-outline" size={16} color="#FF6B00" />
                <Text style={styles.suggestionTitle}>Recomendação TCFIT</Text>
              </View>
              <Text style={styles.suggestionText}>
                {suggestedTemplate.name} (baseado em {anamnese.days_per_week ? `${anamnese.days_per_week}x/semana` : 'suas respostas'}
                {anamnese.experience_level ? ` e nível ${PROGRAM_LEVELS.find((l) => l.value === anamnese.experience_level)?.label?.toLowerCase()}` : ''})
              </Text>
              <View style={styles.suggestionButtonRow}>
                <TouchableOpacity style={styles.suggestionApplyButton} onPress={handleApplySuggestedTemplate} disabled={applyingSuggestion}>
                  {applyingSuggestion ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.suggestionApplyButtonText}>Aplicar esta ficha</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.suggestionCustomButton} onPress={() => setBuildingFor(true)}>
                  <Text style={styles.suggestionCustomButtonText}>Personalizar / Escolher outro</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.actionButtonWide} onPress={() => setBuildingFor(true)}>
            <Ionicons name="barbell-outline" size={22} color="#FF6B00" />
            <Text style={styles.actionLabelWide}>Treino Atual / Editar Ficha</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButtonWide} onPress={() => setWorkoutHistoryFor(true)}>
            <Ionicons name="time-outline" size={22} color="#a3a3a3" />
            <Text style={styles.actionLabelWide}>Histórico de Treinos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButtonWide} onPress={() => setShowPeriodization(true)}>
            <Ionicons name="calendar-outline" size={22} color="#a855f7" />
            <Text style={styles.actionLabelWide}>Periodização</Text>
          </TouchableOpacity>

          {attendanceMode === 'presencial' && (
            <TouchableOpacity style={styles.presencialButton} onPress={() => setShowPresencialSession(true)}>
              <Ionicons name="play-circle-outline" size={18} color="#0F0F12" />
              <Text style={styles.presencialButtonText}>Modo Aula Presencial</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {detailTab === 'evolucao' && (
        <>
          <WeightEvolutionChart studentId={student.id} />

          <TouchableOpacity style={styles.actionButtonWide} onPress={() => setAssessmentFor(true)}>
            <Ionicons name="clipboard-outline" size={22} color="#3b82f6" />
            <Text style={styles.actionLabelWide}>Avaliação Física</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.summaryButton} onPress={() => setShowSummary(true)}>
            <Ionicons name="stats-chart-outline" size={18} color="#0F0F12" />
            <Text style={styles.summaryButtonText}>Gerar Resumo Semanal</Text>
          </TouchableOpacity>
        </>
      )}

      {detailTab === 'comunicacao' && (
        <>
          <TouchableOpacity style={styles.actionButtonWide} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles-outline" size={22} color="#22c55e" />
            <Text style={styles.actionLabelWide}>Abrir Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.financeButton} onPress={() => setShowFinance(true)}>
            <Ionicons name="cash-outline" size={18} color="#eab308" />
            <Text style={styles.financeButtonText}>Ver Financeiro</Text>
          </TouchableOpacity>
        </>
      )}

      <WaterLogModal
        visible={showWaterModal}
        studentId={student.id}
        currentMl={waterMl}
        goalMl={waterGoalMl}
        onClose={() => setShowWaterModal(false)}
        onAdd={handleAddWater}
        onGoalChanged={setWaterGoalMl}
      />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50, paddingHorizontal: 16 },
  summaryHeaderCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, padding: 14, marginBottom: 16 },
  summaryHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F0F12', borderWidth: 2, borderColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 56, height: 56 },
  avatarLetter: { color: '#FF6B00', fontSize: 20, fontWeight: '800' },
  studentName: { color: '#F5F5F7', fontSize: 17, fontWeight: '800' },
  studentEmail: { color: '#737373', fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  statusDotInactive: { backgroundColor: '#ef4444' },
  statusText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  statusTextInactive: { color: '#ef4444' },
  chatShortcutButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center' },
  anamneseButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  anamneseButtonText: { color: '#0F0F12', fontSize: 12, fontWeight: '700' },
  healthAlertRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  healthAlertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  healthAlertBadgeText: { color: '#ef4444', fontSize: 10, fontWeight: '700' },
  anamneseSummaryCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 16 },
  anamneseSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  anamneseSummaryTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  anamneseSummaryLink: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },
  anamneseSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  anamneseSummaryLine: { color: '#a3a3a3', fontSize: 12, flexShrink: 1 },
  suggestionCard: { backgroundColor: 'rgba(255,107,0,0.08)', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 14, padding: 14, marginBottom: 16 },
  notesCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 16 },
  notesSavedLabel: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  notesInput: { color: '#F5F5F7', fontSize: 12, lineHeight: 17, minHeight: 60, textAlignVertical: 'top', marginBottom: 10 },
  notesSaveButton: { alignSelf: 'flex-start', backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  notesSaveButtonText: { color: '#0F0F12', fontSize: 12, fontWeight: '700' },
  suggestionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestionTitle: { color: '#FF6B00', fontSize: 13, fontWeight: '800' },
  suggestionText: { color: '#F5F5F7', fontSize: 12, marginTop: 6, lineHeight: 17 },
  suggestionButtonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  suggestionApplyButton: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  suggestionApplyButtonText: { color: '#0F0F12', fontSize: 12, fontWeight: '800' },
  suggestionCustomButton: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  suggestionCustomButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  accessLevelBox: { marginBottom: 16 },
  accessLevelLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' },
  accessLevelRow: { flexDirection: 'row', gap: 8 },
  accessLevelChip: { flex: 1, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  accessLevelChipActive: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  attendanceModeChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  accessLevelChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  accessLevelChipTextActive: { color: '#0F0F12' },
  detailTabRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  detailTabButton: { flex: 1, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  detailTabButtonActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  detailTabText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  detailTabTextActive: { color: '#0F0F12' },
  actionButtonWide: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  actionLabelWide: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  dietButton: { flexDirection: 'row', gap: 8, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  dietButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  summaryButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  summaryButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  presencialButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  presencialButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  financeButton: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#eab308', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  financeButtonText: { color: '#eab308', fontSize: 13, fontWeight: '700' },
});