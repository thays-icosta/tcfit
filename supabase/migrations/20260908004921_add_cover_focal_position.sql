
alter table public.workout_templates
  add column if not exists cover_focal_position text not null default 'topo'
  check (cover_focal_position in ('topo', 'centro', 'base'));

alter table public.products
  add column if not exists cover_focal_position text not null default 'topo'
  check (cover_focal_position in ('topo', 'centro', 'base'));

update public.products
set cover_focal_position = wt.cover_focal_position
from public.workout_templates wt
where products.source_template_id = wt.id;
