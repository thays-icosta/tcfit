create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.users(id),
  name text not null,
  description text,
  total_days integer not null,
  cover_image_url text,
  ebook_pdf_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.project_templates enable row level security;

create policy project_templates_select on public.project_templates
  for select using (personal_id = auth.uid() or archived = false);

create policy project_templates_insert_own on public.project_templates
  for insert with check (personal_id = auth.uid());

create policy project_templates_update_own on public.project_templates
  for update using (personal_id = auth.uid());

create policy project_templates_delete_own on public.project_templates
  for delete using (personal_id = auth.uid());
