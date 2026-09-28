alter table public.workouts
  add column previous_version_id uuid references public.workouts(id) on delete set null,
  add column version_group_id uuid,
  add column archived_at timestamptz;

create index idx_workouts_version_group_id on public.workouts(version_group_id) where version_group_id is not null;
create index idx_workouts_previous_version_id on public.workouts(previous_version_id) where previous_version_id is not null;

comment on column public.workouts.previous_version_id is 'The ficha (same letter/slot) this version replaced, when created via "+ Nova Semana". Null for the first version or fichas predating versioning.';
comment on column public.workouts.version_group_id is 'Shared tag across all fichas (A/B/C) created together in one "+ Nova Semana" action, so they display as one week/group. Null for ungrouped legacy fichas.';
comment on column public.workouts.archived_at is 'When this ficha was archived/superseded (active set to false by a version update). Null while active or if archived before this column existed.';
