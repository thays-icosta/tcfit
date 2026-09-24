// Pure helpers for suggesting the next training load from a student's
// logged set history — mirrors the manual progression a personal already
// does by eye (bump the load once the prescribed reps are hit, hold
// otherwise), just reading data that's already saved in workout_session_sets.

function parseRepsNumber(repsStr) {
  if (!repsStr) return null;
  const numbers = String(repsStr).match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  return Math.round(numbers.map(Number).reduce((a, b) => a + b, 0) / numbers.length);
}

// "10-12" -> 12: the top of the prescribed range is the bar to clear before
// the load goes up. A single number ("10") is its own target.
function parseRepsTarget(repsStr) {
  if (!repsStr) return null;
  const numbers = String(repsStr).match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  return Math.max(...numbers.map(Number));
}

function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

// Epley formula — a widely-used estimate of one-rep max from a lighter,
// higher-rep set. Shown only as a progress indicator (e.g. "1RM estimado
// 90kg"), never as a suggestion to actually test a real 1RM.
export function estimate1RM(loadKg, reps) {
  if (loadKg == null || !reps || reps <= 0) return null;
  if (reps === 1) return Math.round(loadKg * 10) / 10;
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10;
}

// One row per finished session: the heaviest logged set for this exercise
// that session (tie-broken by the higher rep count), newest first.
export function topSetsBySession(sets) {
  const bySession = {};
  sets.forEach((s) => {
    if (s.load == null) return;
    const current = bySession[s.sessionId];
    if (!current || s.load > current.load || (s.load === current.load && (s.repsNum || 0) > (current.repsNum || 0))) {
      bySession[s.sessionId] = s;
    }
  });
  return Object.values(bySession).sort((a, b) => new Date(b.date) - new Date(a.date));
}

const LOAD_INCREMENT_KG = 2.5;
const LOAD_INCREMENT_KG_LIGHT = 1;

// history: output of topSetsBySession (newest first). prescribedReps: the
// ficha's current reps field (e.g. "10-12"), used only to judge whether the
// last session already earned a bump.
export function suggestNextLoad(history, prescribedReps) {
  if (!history || history.length === 0) return null;
  const last = history[0];
  if (last.load == null) return null;
  const target = parseRepsTarget(prescribedReps);
  const hitTarget = target == null || (last.repsNum != null && last.repsNum >= target);
  const increment = last.load >= 20 ? LOAD_INCREMENT_KG : LOAD_INCREMENT_KG_LIGHT;
  return {
    lastLoad: last.load,
    lastReps: last.repsNum,
    hitTarget,
    suggestedLoad: hitTarget ? roundToHalf(last.load + increment) : last.load,
  };
}

// Every workout_exercises.id for this student+exercise, across EVERY ficha
// version (active or archived via "+ Nova Semana"/arquivar) — without this,
// "last time"/progression would look reset to zero right after a new week
// is created, even though the student's real history is sitting under the
// now-archived ficha's workout_exercise rows.
export async function resolveWorkoutExerciseIdsForExercise(supabase, { studentId, exerciseId }) {
  const { data } = await supabase
    .from('workout_exercises')
    .select('id, workouts!inner(student_id)')
    .eq('exercise_id', exerciseId)
    .eq('workouts.student_id', studentId);
  return (data || []).map((r) => r.id);
}

// Loads the last `limit` finished sessions' top set for one exercise,
// spanning every ficha version the student has ever had it on (see
// resolveWorkoutExerciseIdsForExercise). Returns [] if never logged.
export async function loadExerciseLoadHistory(supabase, { studentId, exerciseId, limit = 6 }) {
  const workoutExerciseIds = await resolveWorkoutExerciseIdsForExercise(supabase, { studentId, exerciseId });
  if (workoutExerciseIds.length === 0) return [];

  const { data: setRows } = await supabase
    .from('workout_session_sets')
    .select('session_id, load_used_kg, reps_done')
    .in('workout_exercise_id', workoutExerciseIds)
    .not('load_used_kg', 'is', null);

  if (!setRows || setRows.length === 0) return [];

  const sessionIds = [...new Set(setRows.map((s) => s.session_id))];
  const { data: sessionRows } = await supabase
    .from('workout_sessions')
    .select('id, started_at')
    .in('id', sessionIds)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit);

  const sessionDateById = {};
  (sessionRows || []).forEach((s) => { sessionDateById[s.id] = s.started_at; });

  const sets = setRows
    .filter((s) => sessionDateById[s.session_id])
    .map((s) => ({
      sessionId: s.session_id,
      date: sessionDateById[s.session_id],
      load: s.load_used_kg,
      reps: s.reps_done,
      repsNum: parseRepsNumber(s.reps_done),
    }));

  return topSetsBySession(sets);
}
