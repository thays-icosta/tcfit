alter table plan_prices add column if not exists tier text check (tier in ('app','consultoria'));
