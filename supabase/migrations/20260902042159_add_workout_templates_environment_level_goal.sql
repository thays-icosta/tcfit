alter table workout_templates
  add column if not exists environment text check (environment in ('academia', 'casa')),
  add column if not exists level text check (level in ('iniciante', 'intermediario', 'avancado')),
  add column if not exists goal text;
