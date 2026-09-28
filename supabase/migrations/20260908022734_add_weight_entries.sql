
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  entry_date date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now()
);

alter table public.weight_entries enable row level security;

create policy weight_select_own on public.weight_entries
  for select using (student_id = auth.uid());

create policy weight_select_personal on public.weight_entries
  for select using (exists (
    select 1 from public.users where users.id = weight_entries.student_id and users.personal_id = auth.uid()
  ));

create policy weight_insert_own on public.weight_entries
  for insert with check (student_id = auth.uid());

create policy weight_delete_own on public.weight_entries
  for delete using (student_id = auth.uid());
