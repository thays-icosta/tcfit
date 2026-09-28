
create table diet_templates (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references users(id) on delete cascade,
  name text not null,
  notes text,
  goal_kcal numeric,
  goal_protein_g numeric,
  goal_carbs_g numeric,
  goal_fat_g numeric,
  created_at timestamptz not null default now()
);

create table diet_template_meals (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references diet_templates(id) on delete cascade,
  name text not null,
  meal_time text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table diet_template_meal_foods (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references diet_template_meals(id) on delete cascade,
  food_name text not null,
  quantity text,
  quantity_g numeric,
  calories_kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table diet_templates enable row level security;
alter table diet_template_meals enable row level security;
alter table diet_template_meal_foods enable row level security;

create policy diet_templates_all on diet_templates
  for all using (personal_id = auth.uid()) with check (personal_id = auth.uid());

create policy diet_template_meals_all on diet_template_meals
  for all using (exists (select 1 from diet_templates t where t.id = diet_template_meals.template_id and t.personal_id = auth.uid()))
  with check (exists (select 1 from diet_templates t where t.id = diet_template_meals.template_id and t.personal_id = auth.uid()));

create policy diet_template_meal_foods_all on diet_template_meal_foods
  for all using (exists (select 1 from diet_template_meals m join diet_templates t on t.id = m.template_id where m.id = diet_template_meal_foods.meal_id and t.personal_id = auth.uid()))
  with check (exists (select 1 from diet_template_meals m join diet_templates t on t.id = m.template_id where m.id = diet_template_meal_foods.meal_id and t.personal_id = auth.uid()));
