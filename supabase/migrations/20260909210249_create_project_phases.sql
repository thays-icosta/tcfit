create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_template_id uuid not null references public.project_templates(id) on delete cascade,
  personal_id uuid not null references public.users(id),
  name text not null,
  order_index integer not null default 0,
  duration_days integer not null,
  cycle_length_days integer not null,
  created_at timestamptz not null default now()
);

alter table public.project_phases enable row level security;

create policy project_phases_select on public.project_phases
  for select using (
    personal_id = auth.uid()
    or exists (select 1 from public.project_templates t where t.id = project_phases.project_template_id and t.archived = false)
  );

create policy project_phases_insert_own on public.project_phases
  for insert with check (personal_id = auth.uid());

create policy project_phases_update_own on public.project_phases
  for update using (personal_id = auth.uid());

create policy project_phases_delete_own on public.project_phases
  for delete using (personal_id = auth.uid());
