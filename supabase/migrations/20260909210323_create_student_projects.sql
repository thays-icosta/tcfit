create table public.student_projects (
  id uuid primary key default gen_random_uuid(),
  project_template_id uuid not null references public.project_templates(id),
  product_id uuid references public.products(id),
  student_id uuid not null references public.users(id),
  personal_id uuid not null references public.users(id),
  current_day integer not null default 1,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_id, project_template_id)
);

alter table public.student_projects enable row level security;

create policy student_projects_select on public.student_projects
  for select using (student_id = auth.uid() or personal_id = auth.uid());

create policy student_projects_insert on public.student_projects
  for insert with check (student_id = auth.uid() or personal_id = auth.uid());

create policy student_projects_update on public.student_projects
  for update using (student_id = auth.uid() or personal_id = auth.uid());
