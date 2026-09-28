alter table products add column if not exists nutrition_tags text[];
alter table workout_templates add column if not exists workout_tags text[];

update workout_templates set workout_tags = array['academia'] where environment = 'academia' and workout_tags is null;
update workout_templates set workout_tags = array['em_casa'] where environment = 'casa' and workout_tags is null;
