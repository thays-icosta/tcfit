
alter table workout_templates add column if not exists cover_image_url text;
alter table workout_templates add column if not exists category text;

create table if not exists template_sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  personal_id uuid not null references users(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table template_sessions enable row level security;
create policy "template_sessions_select_all" on template_sessions for select using (true);
create policy "template_sessions_insert_own" on template_sessions for insert with check (personal_id = auth.uid());
create policy "template_sessions_update_own" on template_sessions for update using (personal_id = auth.uid());
create policy "template_sessions_delete_own" on template_sessions for delete using (personal_id = auth.uid());

alter table workout_template_exercises add column if not exists session_id uuid references template_sessions(id) on delete cascade;

alter table products add column if not exists source_template_id uuid references workout_templates(id) on delete set null;

-- Backfill: give every existing template-with-exercises a default "Treino A" session,
-- and point its existing exercises at that session so nothing already built breaks.
insert into template_sessions (template_id, personal_id, name, order_index)
select wt.id, wt.personal_id, 'Treino A', 0
from workout_templates wt
where exists (select 1 from workout_template_exercises wte where wte.template_id = wt.id)
and not exists (select 1 from template_sessions ts where ts.template_id = wt.id);

update workout_template_exercises wte
set session_id = ts.id
from template_sessions ts
where ts.template_id = wte.template_id and wte.session_id is null;
