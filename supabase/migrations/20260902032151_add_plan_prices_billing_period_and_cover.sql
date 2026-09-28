alter table plan_prices
  add column if not exists billing_period text check (billing_period in ('mensal', 'trimestral')),
  add column if not exists cover_image_url text;
