create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.users(id),
  type text not null check (type in ('entrada', 'saida')),
  amount numeric not null,
  description text,
  category text,
  entry_date date not null,
  created_at timestamptz not null default now()
);

alter table public.finance_entries enable row level security;

create policy finance_entries_select_own on public.finance_entries
  for select using (personal_id = auth.uid());

create policy finance_entries_insert_own on public.finance_entries
  for insert with check (personal_id = auth.uid());

create policy finance_entries_update_own on public.finance_entries
  for update using (personal_id = auth.uid());

create policy finance_entries_delete_own on public.finance_entries
  for delete using (personal_id = auth.uid());
