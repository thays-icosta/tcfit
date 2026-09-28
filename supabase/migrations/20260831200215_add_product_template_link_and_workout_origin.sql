
alter table products add column if not exists template_id uuid references workout_templates(id) on delete set null;
alter table workouts add column if not exists product_id uuid references products(id) on delete set null;
