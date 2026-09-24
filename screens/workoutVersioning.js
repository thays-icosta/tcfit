import { supabase } from './supabaseClient';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const EXERCISE_COLUMNS = 'exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes';

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
export async function loadWorkoutSummaries(client, workoutIds) {
  const c = client || supabase;
  const summaries = {};
  for (const id of workoutIds) summaries[id] = { exerciseCount: 0, setCount: 0, muscleGroups: [] };
  if (workoutIds.length === 0) return summaries;

  const { data } = await c
    .from('workout_exercises')
    .select('workout_id, sets, exercises (muscle_group)')
    .in('workout_id', workoutIds);

  const groupCounts = {};
  (data || []).forEach((row) => {
    const s = summaries[row.workout_id];
    if (!s) return;
    s.exerciseCount += 1;
    s.setCount += row.sets || 3;
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
//                    by ficha name (falls back to empty if no name match)
//   'scratch'      — new fichas start with zero exercises
export async function createNewWeekVersion(client, { studentId, personalId, mode, sourceWorkouts = [] }) {
  const c = client || supabase;
  const current = await loadCurrentWeekWorkouts(c, studentId);
  if (current.length === 0) {
    throw new Error('Esse aluno não tem nenhuma ficha ativa pra basear a nova semana.');
  }

  const groupId = uuidv4();
  const created = [];

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

  return { groupId, workouts: created };
}
