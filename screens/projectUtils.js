// Pure day/phase resolution helpers for the "Projetos" feature (self-paced
// multi-day programs, e.g. "Quadríceps Grandes e Fortes — 90 Dias"). Mirrors
// the style of periodizationUtils.js, but current_day is an explicit stored
// counter (advanced only by app logic when a day's activities are done),
// never derived from calendar time.

// Given the ordered project_phases (each with duration_days) and an absolute
// project day (1..total_days), find which phase contains it and the
// day-in-phase (1-indexed).
export function getPhaseForDay(phases, currentDay) {
  let cumulative = 0;
  for (const phase of phases) {
    const start = cumulative + 1;
    const end = cumulative + phase.duration_days;
    if (currentDay >= start && currentDay <= end) {
      return { phase, dayInPhase: currentDay - start + 1, startDay: start, endDay: end };
    }
    cumulative = end;
  }
  return null;
}

// Maps a day-in-phase to a 1-indexed cycle day (repeats every cycleLengthDays).
export function resolveCycleDay(dayInPhase, cycleLengthDays) {
  const mod = dayInPhase % cycleLengthDays;
  return mod === 0 ? cycleLengthDays : mod;
}

// Union of repeating (cycle_day match) + one-off (absolute_day match)
// activities scheduled for a given day-in-phase.
export function getActivitiesForDay(activities, dayInPhase, cycleLengthDays) {
  const cycleDay = resolveCycleDay(dayInPhase, cycleLengthDays);
  const repeating = activities.filter((a) => a.cycle_day != null && a.cycle_day === cycleDay);
  const pinned = activities.filter((a) => a.absolute_day != null && a.absolute_day === dayInPhase);
  return [...repeating, ...pinned].sort((a, b) => a.order_index - b.order_index);
}

// High-level resolve: given a student_projects row + all phases + all
// activities (grouped by phase_id), returns what to render today.
export function resolveProjectDay(studentProject, phases, activitiesByPhaseId) {
  const resolved = getPhaseForDay(phases, studentProject.current_day);
  if (!resolved) return { finished: true };
  const { phase, dayInPhase } = resolved;
  const todaysActivities = getActivitiesForDay(activitiesByPhaseId[phase.id] || [], dayInPhase, phase.cycle_length_days);
  return { finished: false, phase, dayInPhase, todaysActivities };
}

// "Is today done?" — a day with no scheduled activity (rest day) counts as
// complete. Treino/programa activities are done if their completion row has
// completed_at set OR their stored workout_id is in workoutCompletedIds (a
// Set of workout_id's freshly read from workout_completions — reconciliation
// happens by the caller before this check, since WorkoutPlayerScreen's
// completion write can be delayed by its offline queue).
export function isDayComplete(todaysActivities, completionsForDay, workoutCompletedIds) {
  if (todaysActivities.length === 0) return true;
  return todaysActivities.every((activity) => {
    const completion = completionsForDay.find((c) => c.activity_id === activity.id);
    if (!completion) return false;
    if (activity.activity_type === 'treino' || activity.activity_type === 'programa') {
      return completion.completed_at != null || (completion.workout_id && workoutCompletedIds.has(completion.workout_id));
    }
    return completion.completed_at != null;
  });
}

// Advance current_day by +1, capped at total_days.
export function computeNextDay(currentDay, totalDays) {
  const next = currentDay + 1;
  return next > totalDays ? { done: true, nextDay: currentDay } : { done: false, nextDay: next };
}

// Builds the full day-by-day timeline (every day 1..total_days across every
// phase), each with its resolved activities and a status relative to the
// student's current_day: 'done' (already passed — self-paced guarantees it
// was fully completed to get past it), 'current', or 'locked' (not reached
// yet, per "não liberar a jornada de forma confusa").
export function buildFullTimeline(phases, activitiesByPhaseId, currentDay) {
  const timeline = [];
  let cumulative = 0;
  for (const phase of phases) {
    const phaseDays = [];
    for (let dayInPhase = 1; dayInPhase <= phase.duration_days; dayInPhase++) {
      const absoluteDay = cumulative + dayInPhase;
      const activities = getActivitiesForDay(activitiesByPhaseId[phase.id] || [], dayInPhase, phase.cycle_length_days);
      const status = absoluteDay < currentDay ? 'done' : absoluteDay === currentDay ? 'current' : 'locked';
      phaseDays.push({ dayInPhase, absoluteDay, activities, status });
    }
    timeline.push({ phase, days: phaseDays });
    cumulative += phase.duration_days;
  }
  return timeline;
}

// "Conquistas" — badges derived purely from stats already computed for the
// dashboard/celebration screens, no separate table (nothing to duplicate or
// get out of sync).
export const ACHIEVEMENT_DEFS = [
  { key: 'primeiro_treino', label: 'Primeiro treino', test: (s) => s.treinosConcluidos >= 1 },
  { key: 'sete_dias', label: '7 dias', test: (s) => s.currentDay >= 7 || s.diasAtivos >= 7 },
  { key: 'trinta_dias', label: '30 dias', test: (s) => s.currentDay >= 30 || s.diasAtivos >= 30 },
  { key: 'metade', label: '50% concluído', test: (s) => s.currentDay / s.totalDays >= 0.5 },
  { key: 'completo', label: 'Dias concluídos', test: (s) => s.finished },
];

export function computeAchievements(stats) {
  return ACHIEVEMENT_DEFS.map((def) => ({
    key: def.key,
    label: def.key === 'completo' ? `${stats.totalDays} dias concluídos` : def.label,
    achieved: def.test(stats),
  }));
}

// Longest run of consecutive completed day_in_phase-ordered entries, and the
// current run ending at the most recent one — used for "sequência atual" /
// "sequência máxima". `days` is a sorted-ascending array of distinct
// absolute project-day numbers on which at least one activity was completed.
export function computeStreaks(days) {
  if (!days || days.length === 0) return { current: 0, max: 0 };
  let max = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > max) max = run;
  }
  // "current" = the run ending at the last completed day.
  let current = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] === days[i - 1] + 1) current += 1;
    else break;
  }
  return { current, max };
}
