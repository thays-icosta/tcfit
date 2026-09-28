
alter table public.workout_templates
  add column if not exists running_level text
  check (running_level in ('guia_aluno', '0_a_5km', '5_a_10km', 'maratona'));

alter table public.products
  add column if not exists running_level text
  check (running_level in ('guia_aluno', '0_a_5km', '5_a_10km', 'maratona'));

update public.products
set running_level = wt.running_level
from public.workout_templates wt
where products.source_template_id = wt.id and wt.running_level is not null;
