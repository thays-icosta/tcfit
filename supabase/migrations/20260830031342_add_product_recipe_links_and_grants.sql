alter table public.products
  add column if not exists recipe_ids uuid[] default '{}'::uuid[];

create table if not exists public.product_grants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  personal_id uuid not null references public.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (product_id, student_id)
);

alter table public.product_grants enable row level security;

create policy "product_grants_personal_manage"
on public.product_grants for all
using (personal_id = auth.uid())
with check (personal_id = auth.uid());

create policy "product_grants_student_read_own"
on public.product_grants for select
using (student_id = auth.uid());
