alter table public.anamnese_responses
  add column if not exists focus_muscle_group text null;

alter table public.workout_templates
  add column if not exists focus_muscle_group text null;
