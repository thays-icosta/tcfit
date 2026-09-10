import { supabase } from './supabaseClient';

// Copies one template_sessions ("ficha") + its workout_template_exercises into
// a fresh workouts + workout_exercises row for a student. This is the single
// copy-on-assign primitive used by WorkoutBuilderScreen.handleApplyTemplate,
// ProgramDetailScreen.handleAddProgram, and ProjectDashboardScreen — never
// duplicate this loop elsewhere.
export async function copySessionToStudentWorkout(supabaseClient, {
  sessionId,
  sessionName,
  studentId,
  personalId,
  productId = null,
  phaseId = null,
}) {
  const client = supabaseClient || supabase;

  const { data: newWorkout, error } = await client
    .from('workouts')
    .insert({
      student_id: studentId,
      personal_id: personalId,
      name: sessionName,
      active: true,
      product_id: productId,
      phase_id: phaseId,
    })
    .select()
    .single();
  if (error || !newWorkout) throw error || new Error('no workout');

  const { data: templateItems } = await client
    .from('workout_template_exercises')
    .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
    .eq('session_id', sessionId);

  if (templateItems && templateItems.length > 0) {
    const copies = templateItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
    await client.from('workout_exercises').insert(copies);
  }

  return { workout: newWorkout, exerciseCount: templateItems?.length || 0 };
}
