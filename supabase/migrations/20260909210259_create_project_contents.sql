create table public.project_contents (
  id uuid primary key default gen_random_uuid(),
  project_template_id uuid not null references public.project_templates(id) on delete cascade,
  personal_id uuid not null references public.users(id),
  title text not null,
  subtitle text,
  order_index integer not null default 0,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_contents enable row level security;

create policy project_contents_select on public.project_contents
  for select using (
    personal_id = auth.uid()
    or exists (select 1 from public.project_templates t where t.id = project_contents.project_template_id and t.archived = false)
  );

create policy project_contents_insert_own on public.project_contents
  for insert with check (personal_id = auth.uid());

create policy project_contents_update_own on public.project_contents
  for update using (personal_id = auth.uid());

create policy project_contents_delete_own on public.project_contents
  for delete using (personal_id = auth.uid());
