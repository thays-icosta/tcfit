create table session_personal_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  personal_id uuid not null references users(id) on delete cascade,
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

alter table session_personal_notes enable row level security;

-- Private to the personal only — never readable by the student, unlike
-- workout_sessions.student_notes which is the aluno's own post-treino note.
create policy session_personal_notes_select_personal on session_personal_notes
for select
using (personal_id = auth.uid());

create policy session_personal_notes_insert_personal on session_personal_notes
for insert
with check (personal_id = auth.uid());

create policy session_personal_notes_update_personal on session_personal_notes
for update
using (personal_id = auth.uid());

create policy session_personal_notes_delete_personal on session_personal_notes
for delete
using (personal_id = auth.uid());
