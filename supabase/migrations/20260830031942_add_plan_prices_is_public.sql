alter table public.plan_prices
  add column if not exists is_public boolean not null default true;
