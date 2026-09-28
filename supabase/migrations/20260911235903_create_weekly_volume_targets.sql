create table weekly_volume_targets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  personal_id uuid not null references users(id) on delete cascade,
  muscle_group text not null,
  target_series integer not null,
  created_at timestamptz not null default now(),
  unique (student_id, muscle_group)
);

alter table weekly_volume_targets enable row level security;

create policy weekly_volume_targets_select on weekly_volume_targets
for select
using (personal_id = auth.uid() or student_id = auth.uid());

create policy weekly_volume_targets_insert_personal on weekly_volume_targets
for insert
with check (personal_id = auth.uid());

create policy weekly_volume_targets_update_personal on weekly_volume_targets
for update
using (personal_id = auth.uid());

create policy weekly_volume_targets_delete_personal on weekly_volume_targets
for delete
using (personal_id = auth.uid());
