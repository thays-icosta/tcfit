
alter table plan_prices add column if not exists monthly_equivalent_price numeric;
alter table plan_prices add column if not exists audience text check (audience in ('ela','ele'));
