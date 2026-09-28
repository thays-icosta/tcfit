create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  user_role text null,
  source text not null,
  message text not null,
  stack text null,
  component_stack text null,
  url text null,
  user_agent text null,
  extra jsonb null,
  resolved boolean not null default false
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

create policy error_logs_insert_any
  on public.error_logs
  for insert
  to anon, authenticated
  with check (true);
