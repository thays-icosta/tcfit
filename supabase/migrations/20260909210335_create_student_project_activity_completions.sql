create table public.student_project_activity_completions (
  id uuid primary key default gen_random_uuid(),
  student_project_id uuid not null references public.student_projects(id) on delete cascade,
  activity_id uuid not null references public.project_activities(id),
  day_in_phase integer not null,
  student_id uuid not null references public.users(id),
  personal_id uuid not null references public.users(id),
  workout_id uuid references public.workouts(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_project_id, activity_id, day_in_phase)
);

alter table public.student_project_activity_completions enable row level security;

create policy spac_select_own on public.student_project_activity_completions
  for select using (student_id = auth.uid());

create policy spac_select_personal on public.student_project_activity_completions
  for select using (
    exists (select 1 from public.users u where u.id = student_project_activity_completions.student_id and u.personal_id = auth.uid())
  );

create policy spac_insert_own on public.student_project_activity_completions
  for insert with check (student_id = auth.uid());

create policy spac_update_own on public.student_project_activity_completions
  for update using (student_id = auth.uid());
