create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  source text default 'qrcode_landing',
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "leads_public_insert"
on public.leads for insert
to anon, authenticated
with check (true);

create policy "leads_authenticated_read"
on public.leads for select
to authenticated
using (true);
