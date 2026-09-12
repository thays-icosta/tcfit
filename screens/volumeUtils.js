// Helpers for the weekly volume-per-muscle-group table on the periodization
// screen. The personal sets an optional target per muscle group; the app
// only ever reports where the aluno stands against it — it never decides
// the target itself.

// Muscle groups that aren't tracked as discrete "séries" volume (cardio has
// no set count).
const EXCLUDED_MUSCLE_GROUPS = ['aerobico'];

export async function loadWeeklyVolumeTargets(supabase, studentId) {
  const { data } = await supabase
    .from('weekly_volume_targets')
    .select('muscle_group, target_series')
    .eq('student_id', studentId);
  const map = {};
  (data || []).forEach((t) => { map[t.muscle_group] = t.target_series; });
  return map;
}

export async function saveWeeklyVolumeTarget(supabase, { studentId, personalId, muscleGroup, targetSeries }) {
  return supabase
    .from('weekly_volume_targets')
    .upsert(
      { student_id: studentId, personal_id: personalId, muscle_group: muscleGroup, target_series: targetSeries },
      { onConflict: 'student_id,muscle_group' }
    );
}

// Resolves each set's real muscle group, accounting for exercise
// substitutions made mid-session — mirrors resolveActualExercises in
// VolumeSummaryScreen but only needs the muscle group, not the full exercise.
// Does one lookup for every substituted exercise, so call it once for a
// whole date range rather than per week.
export async function resolveSetsMuscleGroups(supabase, setRows) {
  const substitutedIds = [...new Set((setRows || []).map((s) => s.substituted_exercise_id).filter(Boolean))];
  let substitutedGroupById = {};
  if (substitutedIds.length > 0) {
    const { data } = await supabase.from('exercises').select('id, muscle_group').in('id', substitutedIds);
    (data || []).forEach((e) => { substitutedGroupById[e.id] = e.muscle_group; });
  }

  return (setRows || []).map((s) => ({
    ...s,
    muscleGroup: s.substituted_exercise_id
      ? substitutedGroupById[s.substituted_exercise_id]
      : s.workout_exercises?.exercises?.muscle_group,
  }));
}

// Pure: tallies already-resolved sets (e.g. one week's slice) by muscle group.
export function tallyByMuscleGroup(resolvedSets) {
  const counts = {};
  (resolvedSets || []).forEach((s) => {
    if (!s.muscleGroup || EXCLUDED_MUSCLE_GROUPS.includes(s.muscleGroup)) return;
    counts[s.muscleGroup] = (counts[s.muscleGroup] || 0) + 1;
  });
  return counts;
}

// green: hit the target (within a small tolerance below, or above without
// blowing past it too far). amber: meaningfully under. red: far under or
// well past double the target (a personal-set ceiling, not a guess).
export function getVolumeStatus(actual, target) {
  if (target == null) return null;
  if (actual >= target * 0.9 && actual <= target * 1.5) return { label: 'Dentro do planejado', color: '#22c55e' };
  if (actual >= target * 0.6) return { label: 'Atenção', color: '#f59e0b' };
  return { label: 'Revisar', color: '#ef4444' };
}
