create table public.project_activities (
  id uuid primary key default gen_random_uuid(),
  project_template_id uuid not null references public.project_templates(id) on delete cascade,
  phase_id uuid not null references public.project_phases(id) on delete cascade,
  personal_id uuid not null references public.users(id),
  activity_type text not null check (activity_type in ('treino','programa','exercicio','video','conteudo','checklist')),
  cycle_day integer,
  absolute_day integer,
  title text not null,
  order_index integer not null default 0,
  ref_session_id uuid references public.template_sessions(id),
  ref_template_id uuid references public.workout_templates(id),
  ref_exercise_id uuid references public.exercises(id),
  content_id uuid references public.project_contents(id),
  created_at timestamptz not null default now(),
  constraint project_activities_day_check check (
    (cycle_day is not null and absolute_day is null) or
    (cycle_day is null and absolute_day is not null)
  )
);

create index project_activities_phase_cycle_idx on public.project_activities(phase_id, cycle_day);
create index project_activities_phase_absolute_idx on public.project_activities(phase_id, absolute_day);

alter table public.project_activities enable row level security;

create policy project_activities_select on public.project_activities
  for select using (
    personal_id = auth.uid()
    or exists (select 1 from public.project_templates t where t.id = project_activities.project_template_id and t.archived = false)
  );

create policy project_activities_insert_own on public.project_activities
  for insert with check (personal_id = auth.uid());

create policy project_activities_update_own on public.project_activities
  for update using (personal_id = auth.uid());

create policy project_activities_delete_own on public.project_activities
  for delete using (personal_id = auth.uid());
