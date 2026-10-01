import { supabase } from './supabaseClient';

// Same "top of the range counts" convention progressionUtils.parseRepsTarget
// uses for suggesting loads — here we want a representative rep count for a
// volume *estimate*, so we average the range instead ("10-12" -> 11).
function parseRepsAverage(repsStr) {
  if (!repsStr) return null;
  const numbers = String(repsStr).match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  return numbers.map(Number).reduce((a, b) => a + b, 0) / numbers.length;
}

// sets × avg reps × load — the one formula every "volume" number in the app
// (this file's loadWorkoutSummaries, WorkoutBuilderScreen's ficha header)
// should go through, so a personal never sees two different volume figures
// for the same data. Returns 0 (not null) when load isn't set, so callers
// can sum freely without null-checking each exercise.
export function estimateExerciseVolumeKg({ sets, reps, load_kg }) {
  if (load_kg == null) return 0;
  const avgReps = parseRepsAverage(reps);
  if (avgReps == null) return 0;
  return (sets || 3) * avgReps * load_kg;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const EXERCISE_COLUMNS = 'exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes';

// "Copiar treino"/"Duplicar treino" — a plain, unversioned copy: a new
// active ficha with no weekday assigned (so it never collides with the
// original's day) and the same exercises, starting fresh (no
// previous_version_id/version_group_id, since it isn't replacing anything —
// that's what "+ Nova Semana" is for). Used by both the ficha editor's
// "Duplicar" and Planejamento da Semana's per-day "Duplicar" action, so
// there's one place this logic lives instead of two.
export async function duplicateWorkout(client, workout, { studentId, personalId }) {
  const c = client || supabase;
  const { data: newWorkout, error } = await c
    .from('workouts')
    .insert({ student_id: studentId, personal_id: personalId, name: `${workout.name} (cópia)`, active: true, phase_id: workout.phase_id || null })
    .select()
    .single();
  if (error || !newWorkout) throw error || new Error(`Falha ao duplicar "${workout.name}".`);

  const { data: originalItems } = await c.from('workout_exercises').select(EXERCISE_COLUMNS).eq('workout_id', workout.id);
  if (originalItems && originalItems.length > 0) {
    const copies = originalItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
    await c.from('workout_exercises').insert(copies);
  }

  return newWorkout;
}

// The student's current "week" — every active ficha. Deliberately the same
// active=true filter WorkoutBuilderScreen/PresencialSessionScreen/
// AlunoHomeScreen already use, so a "week" is never a new, separate concept
// from "the student's active fichas" — just this screen's way of presenting
// them grouped.
export async function loadCurrentWeekWorkouts(client, studentId) {
  const c = client || supabase;
  const { data } = await c
    .from('workouts')
    .select('id, name, weekday, notes, created_at, updated_at, version_group_id, previous_version_id')
    .eq('student_id', studentId)
    .eq('active', true)
    .order('created_at', { ascending: true });
  return data || [];
}

// Archived fichas grouped by version_group_id — fichas archived together via
// "+ Nova Semana" collapse into one week; older, ungrouped archived fichas
// (predating this feature, or archived individually) each show as their own
// single-ficha group rather than being hidden.
export async function loadWeekHistory(client, studentId) {
  const c = client || supabase;
  const { data } = await c
    .from('workouts')
    .select('id, name, weekday, version_group_id, previous_version_id, archived_at, created_at')
    .eq('student_id', studentId)
    .eq('active', false)
    .order('created_at', { ascending: false });

  const groups = new Map();
  (data || []).forEach((w) => {
    const key = w.version_group_id || `solo-${w.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  });

  const list = Array.from(groups.entries()).map(([key, items]) => {
    const starts = items.map((w) => w.created_at).filter(Boolean);
    const ends = items.map((w) => w.archived_at).filter(Boolean);
    return {
      key,
      workouts: items,
      startDate: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
      endDate: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null,
    };
  });
  list.sort((a, b) => (b.endDate || b.startDate || '').localeCompare(a.endDate || a.startDate || ''));
  return list;
}

// Loads exercise counts (and dominant muscle group) for a list of workout
// ids in one query, for the compact summary cards — mirrors
// AlunoHomeScreen.loadMuscleSummary's shape.
//
// Also returns a prescribed-volume estimate (sets × avg reps × load_kg) per
// workout — the same tonnage formula VolumeSummaryScreen uses for *executed*
// sets (load × reps), just applied to what's prescribed in the ficha, since
// a freshly-planned week has no logged sessions yet to compute real tonnage
// from. Rows with no load_kg set (bodyweight, or not filled in yet) simply
// don't contribute, rather than being counted as zero-effort.
export async function loadWorkoutSummaries(client, workoutIds) {
  const c = client || supabase;
  const summaries = {};
  for (const id of workoutIds) summaries[id] = { exerciseCount: 0, setCount: 0, muscleGroups: [], volumeKg: 0 };
  if (workoutIds.length === 0) return summaries;

  const { data } = await c
    .from('workout_exercises')
    .select('workout_id, sets, reps, load_kg, exercises (muscle_group)')
    .in('workout_id', workoutIds);

  const groupCounts = {};
  (data || []).forEach((row) => {
    const s = summaries[row.workout_id];
    if (!s) return;
    const sets = row.sets || 3;
    s.exerciseCount += 1;
    s.setCount += sets;
    s.volumeKg += estimateExerciseVolumeKg(row);
    const group = row.exercises?.muscle_group;
    if (group) {
      groupCounts[row.workout_id] = groupCounts[row.workout_id] || {};
      groupCounts[row.workout_id][group] = (groupCounts[row.workout_id][group] || 0) + 1;
    }
  });
  Object.keys(groupCounts).forEach((workoutId) => {
    const entries = Object.entries(groupCounts[workoutId]).sort((a, b) => b[1] - a[1]);
    summaries[workoutId].muscleGroups = entries.slice(0, 2).map(([g]) => g);
  });
  Object.values(summaries).forEach((s) => { s.volumeKg = Math.round(s.volumeKg); });
  return summaries;
}

// The core "+ Nova Semana" operation: for every currently-active ficha,
// create a new version (same name/weekday, tagged with a shared
// version_group_id + previous_version_id back to what it replaced) and
// archive the predecessor (active=false, archived_at=now, weekday cleared
// so it can never collide with the new version in Planejamento Semanal).
// mode:
//   'copy-current' — copy each ficha's own current exercises forward
//   'other-week'   — copy exercises from a chosen historical group, matched
//                    by ficha name (falls back to empty if no name match —
//                    reported back via the returned unmatchedNames)
//   'scratch'      — new fichas start with zero exercises
export async function createNewWeekVersion(client, { studentId, personalId, mode, sourceWorkouts = [] }) {
  const c = client || supabase;
  const current = await loadCurrentWeekWorkouts(c, studentId);
  if (current.length === 0) {
    throw new Error('Esse aluno não tem nenhuma ficha ativa pra basear a nova semana.');
  }

  const groupId = uuidv4();
  const created = [];
  const unmatchedNames = [];

  for (const src of current) {
    const { data: newWorkout, error } = await c
      .from('workouts')
      .insert({
        student_id: studentId,
        personal_id: personalId,
        name: src.name,
        weekday: src.weekday,
        active: true,
        version_group_id: groupId,
        previous_version_id: src.id,
      })
      .select()
      .single();
    if (error || !newWorkout) throw error || new Error(`Falha ao criar a nova versão de "${src.name}".`);

    let exerciseRows = null;
    if (mode === 'copy-current') {
      const { data } = await c.from('workout_exercises').select(EXERCISE_COLUMNS).eq('workout_id', src.id);
      exerciseRows = data;
    } else if (mode === 'other-week') {
      const match = sourceWorkouts.find((w) => w.name === src.name);
      if (match) {
        const { data } = await c.from('workout_exercises').select(EXERCISE_COLUMNS).eq('workout_id', match.id);
        exerciseRows = data;
      } else {
        // No ficha with this exact name in the chosen week (e.g. it was
        // renamed since) — the new version is still created so the week
        // stays complete, but empty and silently so is worse than empty and
        // flagged: callers surface unmatchedNames to the personal instead.
        unmatchedNames.push(src.name);
      }
    }

    if (exerciseRows && exerciseRows.length > 0) {
      const copies = exerciseRows.map((it) => ({ ...it, workout_id: newWorkout.id }));
      await c.from('workout_exercises').insert(copies);
    }

    const { error: archiveError } = await c
      .from('workouts')
      .update({ active: false, archived_at: new Date().toISOString(), weekday: null })
      .eq('id', src.id);
    if (archiveError) throw archiveError;

    created.push(newWorkout);
  }

  return { groupId, workouts: created, unmatchedNames };
}
