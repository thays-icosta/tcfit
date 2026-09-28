delete from exercises
where id in ('22357076-088f-4ff2-ab9d-21ca5c9d399d', '57d25908-e639-47a3-aa17-84d6204ae348');

create unique index if not exists exercises_personal_id_lower_name_unique
  on exercises (personal_id, lower(name))
  where personal_id is not null;
