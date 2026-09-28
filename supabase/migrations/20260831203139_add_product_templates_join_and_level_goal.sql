
alter table products add column if not exists level text;
alter table products add column if not exists goal text;

create table if not exists product_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  template_id uuid not null references workout_templates(id) on delete cascade,
  personal_id uuid not null references users(id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table product_templates enable row level security;

create policy "product_templates_select_all" on product_templates for select using (true);
create policy "product_templates_insert_own" on product_templates for insert with check (personal_id = auth.uid());
create policy "product_templates_update_own" on product_templates for update using (personal_id = auth.uid());
create policy "product_templates_delete_own" on product_templates for delete using (personal_id = auth.uid());
