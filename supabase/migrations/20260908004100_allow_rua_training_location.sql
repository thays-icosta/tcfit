
alter table public.anamnese_responses drop constraint anamnese_responses_training_location_check;
alter table public.anamnese_responses add constraint anamnese_responses_training_location_check
  check (training_location = any (array['academia', 'casa', 'rua']));

alter table public.workout_templates drop constraint workout_templates_environment_check;
alter table public.workout_templates add constraint workout_templates_environment_check
  check (environment = any (array['academia', 'casa', 'rua']));
