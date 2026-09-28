
alter table anamnese_responses add column if not exists sex text check (sex in ('masculino','feminino'));
alter table anamnese_responses add column if not exists weight_kg numeric;
alter table anamnese_responses add column if not exists height_cm numeric;
alter table anamnese_responses add column if not exists age integer;
alter table anamnese_responses add column if not exists calc_goal_kcal integer;
alter table anamnese_responses add column if not exists calc_goal_protein_g integer;
alter table anamnese_responses add column if not exists calc_goal_carbs_g integer;
alter table anamnese_responses add column if not exists calc_goal_fat_g integer;
alter table anamnese_responses add column if not exists calc_adjusted_by_personal boolean not null default false;
