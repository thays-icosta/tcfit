import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';
import { resolveProjectDay, isDayComplete, computeNextDay, computeStreaks, computeAchievements } from './projectUtils';
import { copySessionToStudentWorkout } from './workoutAssignment';
import WorkoutPlayerScreen from './WorkoutPlayerScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import ProjectContentScreen from './ProjectContentScreen';
import ProjectCelebrationScreen from './ProjectCelebrationScreen';
import ProjectTimelineScreen from './ProjectTimelineScreen';
import WeightEvolutionChart from './WeightEvolutionChart';

const ACCENT = '#FF6B00';

// The "Dia X de Total" dashboard for one student's run of a Projeto. Never
// duplicates workout/exercise data — "Começar Treino" copies a ficha into the
// student's own workouts exactly like ProgramDetailScreen/WorkoutBuilderScreen
// already do, and completion is reconciled by reading workout_completions.
export default function ProjectDashboardScreen({ studentProjectId, studentId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [studentProject, setStudentProject] = useState(null);
  const [template, setTemplate] = useState(null);
  const [resolvedDay, setResolvedDay] = useState(null);
  const [completionsForDay, setCompletionsForDay] = useState([]);
  const [finished, setFinished] = useState(false);
  const [startingActivityId, setStartingActivityId] = useState(null);
  const [playingWorkout, setPlayingWorkout] = useState(null);
  const [viewingVideo, setViewingVideo] = useState(null); // { activity, exercise }
  const [viewingContent, setViewingContent] = useState(null); // { activity, content }
  const [stats, setStats] = useState({ treinosConcluidos: 0, diasAtivos: 0, sequenciaAtual: 0 });
  const [showTimeline, setShowTimeline] = useState(false);

  const refreshAndAdvance = useCallback(async () => {
    setLoading(true);
    const { data: spRow } = await supabase.from('student_projects').select('*').eq('id', studentProjectId).single();
    if (!spRow) { setLoading(false); return; }

    const { data: templateRow } = await supabase.from('project_templates').select('*').eq('id', spRow.project_template_id).single();
    const { data: phaseRows } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_template_id', spRow.project_template_id)
      .order('order_index', { ascending: true });
    const phaseIds = (phaseRows || []).map((p) => p.id);
    const { data: activityRows } = phaseIds.length > 0
      ? await supabase.from('project_activities').select('*').in('phase_id', phaseIds)
      : { data: [] };
    const activitiesByPhaseId = {};
    (activityRows || []).forEach((a) => {
      (activitiesByPhaseId[a.phase_id] = activitiesByPhaseId[a.phase_id] || []).push(a);
    });

    let currentSp = spRow;
    let resolved = resolveProjectDay(currentSp, phaseRows || [], activitiesByPhaseId);
    let lastCompletions = [];
    let guard = 0;
    const guardMax = (templateRow?.total_days || 1) + 2;

    while (!resolved.finished && guard < guardMax) {
      guard += 1;
      const todaysActivities = resolved.todaysActivities;
      const activityIds = todaysActivities.map((a) => a.id);
      const { data: completions } = activityIds.length > 0
        ? await supabase
            .from('student_project_activity_completions')
            .select('*')
            .eq('student_project_id', currentSp.id)
            .eq('day_in_phase', resolved.dayInPhase)
            .in('activity_id', activityIds)
        : { data: [] };
      let completionsForToday = completions || [];

      // Recovery days need no student action — auto-mark them done so the
      // "fall through empty/rest days" advance loop treats them like a rest
      // day, while still leaving a completion row so the timeline can show
      // "Recuperação" for that day instead of nothing.
      const pendingRecovery = todaysActivities.filter(
        (a) => a.activity_type === 'recovery' && !completionsForToday.some((c) => c.activity_id === a.id)
      );
      if (pendingRecovery.length > 0) {
        const nowIso = new Date().toISOString();
        const rows = pendingRecovery.map((a) => ({
          student_project_id: currentSp.id,
          activity_id: a.id,
          day_in_phase: resolved.dayInPhase,
          student_id: currentSp.student_id,
          personal_id: currentSp.personal_id,
          completed_at: nowIso,
        }));
        const { data: inserted } = await supabase.from('student_project_activity_completions').insert(rows).select();
        completionsForToday = [...completionsForToday, ...(inserted || [])];
      }

      const pendingWorkoutIds = completionsForToday.filter((c) => c.workout_id && !c.completed_at).map((c) => c.workout_id);
      let workoutCompletedIds = new Set();
      if (pendingWorkoutIds.length > 0) {
        const { data: wc } = await supabase.from('workout_completions').select('workout_id').in('workout_id', pendingWorkoutIds);
        workoutCompletedIds = new Set((wc || []).map((w) => w.workout_id));
        const nowIso = new Date().toISOString();
        for (const c of completionsForToday) {
          if (c.workout_id && workoutCompletedIds.has(c.workout_id) && !c.completed_at) {
            await supabase.from('student_project_activity_completions').update({ completed_at: nowIso }).eq('id', c.id);
          }
        }
        completionsForToday = completionsForToday.map((c) =>
          c.workout_id && workoutCompletedIds.has(c.workout_id) && !c.completed_at ? { ...c, completed_at: nowIso } : c
        );
      }

      lastCompletions = completionsForToday;

      if (!isDayComplete(todaysActivities, completionsForToday, workoutCompletedIds)) {
        break;
      }

      const { done, nextDay } = computeNextDay(currentSp.current_day, templateRow.total_days);
      if (done) {
        const nowIso = new Date().toISOString();
        await supabase.from('student_projects').update({ completed_at: nowIso, active: false }).eq('id', currentSp.id);
        currentSp = { ...currentSp, completed_at: nowIso, active: false };
        resolved = { finished: true };
        break;
      }
      await supabase.from('student_projects').update({ current_day: nextDay }).eq('id', currentSp.id);
      currentSp = { ...currentSp, current_day: nextDay };
      resolved = resolveProjectDay(currentSp, phaseRows || [], activitiesByPhaseId);
    }

    setStudentProject(currentSp);
    setTemplate(templateRow);

    if (resolved.finished) {
      setFinished(true);
    } else {
      setResolvedDay(resolved);
      setCompletionsForDay(lastCompletions);
    }

    // Progress stats: treinos concluídos (distinct completed workout_id's),
    // dias ativos (distinct day_in_phase's with at least one completion),
    // sequência atual (from projectUtils.computeStreaks over distinct
    // absolute project-days that had a completion).
    const { data: allCompletions } = await supabase
      .from('student_project_activity_completions')
      .select('workout_id, completed_at, day_in_phase, activity_id')
      .eq('student_project_id', currentSp.id)
      .not('completed_at', 'is', null);
    const treinosConcluidos = new Set((allCompletions || []).filter((c) => c.workout_id).map((c) => c.workout_id)).size;
    const diasAtivos = new Set((allCompletions || []).map((c) => `${c.day_in_phase}`)).size;
    setStats({ treinosConcluidos, diasAtivos, sequenciaAtual: computeStreaks([...new Set((allCompletions || []).map((c) => c.day_in_phase))].sort((a, b) => a - b)).current });

    setLoading(false);
  }, [studentProjectId]);

  useEffect(() => { refreshAndAdvance(); }, [refreshAndAdvance]);

  const handleStartTreino = async (activity) => {
    setStartingActivityId(activity.id);
    try {
      const { workout } = await copySessionToStudentWorkout(supabase, {
        sessionId: activity.ref_session_id,
        sessionName: activity.title,
        studentId,
        personalId: studentProject.personal_id,
        productId: studentProject.product_id,
      });
      await supabase.from('student_project_activity_completions').insert({
        student_project_id: studentProject.id,
        activity_id: activity.id,
        day_in_phase: resolvedDay.dayInPhase,
        student_id: studentId,
        personal_id: studentProject.personal_id,
        workout_id: workout.id,
        completed_at: null,
      });
      setStartingActivityId(null);
      setPlayingWorkout(workout);
    } catch {
      setStartingActivityId(null);
      showAlert('Erro', 'Não foi possível iniciar o treino agora. Tenta de novo.');
    }
  };

  const handleOpenVideoActivity = async (activity) => {
    const { data: exercise } = await supabase.from('exercises').select('*').eq('id', activity.ref_exercise_id).single();
    if (!exercise) return;
    setViewingVideo({ activity, exercise });
  };

  const handleCloseVideoActivity = async () => {
    const activity = viewingVideo?.activity;
    setViewingVideo(null);
    if (!activity) return;
    await supabase.from('student_project_activity_completions').upsert({
      student_project_id: studentProject.id,
      activity_id: activity.id,
      day_in_phase: resolvedDay.dayInPhase,
      student_id: studentId,
      personal_id: studentProject.personal_id,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'student_project_id,activity_id,day_in_phase' });
    refreshAndAdvance();
  };

  const handleOpenContentActivity = async (activity) => {
    const { data: content } = await supabase.from('project_contents').select('*').eq('id', activity.content_id).single();
    if (!content) return;
    setViewingContent({ activity, content });
  };

  const handleFinishContentActivity = async () => {
    const activity = viewingContent?.activity;
    setViewingContent(null);
    if (!activity) return;
    await supabase.from('student_project_activity_completions').upsert({
      student_project_id: studentProject.id,
      activity_id: activity.id,
      day_in_phase: resolvedDay.dayInPhase,
      student_id: studentId,
      personal_id: studentProject.personal_id,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'student_project_id,activity_id,day_in_phase' });
    refreshAndAdvance();
  };

  const isActivityDone = (activity) => {
    const completion = completionsForDay.find((c) => c.activity_id === activity.id);
    return !!completion?.completed_at;
  };

  if (playingWorkout) {
    return (
      <WorkoutPlayerScreen
        workout={playingWorkout}
        studentId={studentId}
        onExit={() => { setPlayingWorkout(null); refreshAndAdvance(); }}
        onNavigateTab={() => { setPlayingWorkout(null); refreshAndAdvance(); }}
      />
    );
  }

  if (viewingVideo) {
    return (
      <ExerciseVideoScreen
        videoUrl={viewingVideo.exercise.video_url}
        exerciseName={viewingVideo.exercise.name}
        onClose={handleCloseVideoActivity}
      />
    );
  }

  if (viewingContent) {
    return (
      <ProjectContentScreen
        content={viewingContent.content}
        template={template}
        onClose={() => setViewingContent(null)}
        onMarkDone={handleFinishContentActivity}
        alreadyDone={isActivityDone(viewingContent.activity)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (showTimeline) {
    return <ProjectTimelineScreen studentProjectId={studentProjectId} onClose={() => setShowTimeline(false)} />;
  }

  if (finished || !resolvedDay) {
    return <ProjectCelebrationScreen studentProject={studentProject} template={template} onClose={onClose} />;
  }

  const pct = Math.min(100, Math.max(0, Math.round((studentProject.current_day / template.total_days) * 100)));
  const pendingActivities = resolvedDay.todaysActivities.filter((a) => !isActivityDone(a));
  const nextActivity = pendingActivities[0] || resolvedDay.todaysActivities[0];
  const contentActivity = resolvedDay.todaysActivities.find((a) => a.activity_type === 'conteudo' || a.activity_type === 'checklist');

  return (
    <View style={styles.container}>
      <HeaderBack title={template.name} onBack={onClose} style={{ paddingHorizontal: 16 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.dayLabel}>Dia {studentProject.current_day} de {template.total_days}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pctLabel}>{pct}%</Text>
        </View>

        {resolvedDay.todaysActivities.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dia de descanso</Text>
            <Text style={styles.cardSubtitle}>Nenhuma atividade marcada pra hoje.</Text>
          </View>
        ) : (
          <>
            {nextActivity && !isActivityDone(nextActivity) && (nextActivity.activity_type === 'treino' || nextActivity.activity_type === 'programa') && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Próxima Atividade</Text>
                <Text style={styles.activityName}>{nextActivity.title}</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => handleStartTreino(nextActivity)} disabled={startingActivityId === nextActivity.id}>
                  {startingActivityId === nextActivity.id ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.primaryButtonText}>Começar Treino</Text>}
                </TouchableOpacity>
              </View>
            )}

            {nextActivity && !isActivityDone(nextActivity) && (nextActivity.activity_type === 'exercicio' || nextActivity.activity_type === 'video') && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Próxima Atividade</Text>
                <Text style={styles.activityName}>{nextActivity.title}</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => handleOpenVideoActivity(nextActivity)}>
                  <Text style={styles.primaryButtonText}>Ver Vídeo</Text>
                </TouchableOpacity>
              </View>
            )}

            {contentActivity && !isActivityDone(contentActivity) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Conteúdo de Hoje</Text>
                <Text style={styles.activityName}>{contentActivity.title}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => handleOpenContentActivity(contentActivity)}>
                  <Ionicons name="book-outline" size={16} color={ACCENT} />
                  <Text style={styles.secondaryButtonText}>Ler Conteúdo</Text>
                </TouchableOpacity>
              </View>
            )}

            {resolvedDay.todaysActivities.every((a) => isActivityDone(a)) && (
              <View style={styles.card}>
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                <Text style={styles.cardSubtitle}>Tudo feito por hoje. Volte amanhã pro próximo dia.</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Minha Evolução</Text>
          <WeightEvolutionChart studentId={studentId} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progresso</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.treinosConcluidos}</Text>
              <Text style={styles.statLabel}>Treinos concluídos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.diasAtivos}</Text>
              <Text style={styles.statLabel}>Dias ativos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.sequenciaAtual}</Text>
              <Text style={styles.statLabel}>Sequência atual</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conquistas</Text>
          <View style={styles.badgeGrid}>
            {computeAchievements({
              treinosConcluidos: stats.treinosConcluidos,
              diasAtivos: stats.diasAtivos,
              currentDay: studentProject.current_day,
              totalDays: template.total_days,
              finished: !!studentProject.completed_at,
            }).map((a) => (
              <View key={a.key} style={[styles.badge, a.achieved && styles.badgeAchieved]}>
                <Ionicons name={a.achieved ? 'trophy' : 'trophy-outline'} size={16} color={a.achieved ? ACCENT : '#525252'} />
                <Text style={[styles.badgeText, a.achieved && styles.badgeTextAchieved]}>{a.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.timelineLink} onPress={() => setShowTimeline(true)}>
          <Ionicons name="calendar-outline" size={16} color={ACCENT} />
          <Text style={styles.timelineLinkText}>Ver linha do tempo dos {template.total_days} dias</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 16, marginBottom: 14 },
  dayLabel: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  track: { height: 6, backgroundColor: '#0F0F12', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: ACCENT },
  pctLabel: { color: '#a3a3a3', fontSize: 12, marginTop: 6, fontWeight: '600' },
  cardTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  cardSubtitle: { color: '#737373', fontSize: 12, marginTop: 4 },
  activityName: { color: '#F5F5F7', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ACCENT, borderRadius: 10, paddingVertical: 12 },
  secondaryButtonText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: '#F5F5F7', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#737373', fontSize: 10, marginTop: 4, textAlign: 'center' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  badgeAchieved: { borderColor: ACCENT },
  badgeText: { color: '#525252', fontSize: 11, fontWeight: '600' },
  badgeTextAchieved: { color: '#F5F5F7' },
  timelineLink: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingVertical: 14, marginBottom: 20 },
  timelineLinkText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
});
