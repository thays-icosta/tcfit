
create table anamnese_questions (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references users(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('texto_curto','texto_longo','multipla_escolha','sim_nao')),
  options jsonb,
  required boolean not null default true,
  active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table anamnese_questions enable row level security;
create policy "anamnese_questions_select_all" on anamnese_questions for select using (true);
create policy "anamnese_questions_insert_own" on anamnese_questions for insert with check (personal_id = auth.uid());
create policy "anamnese_questions_update_own" on anamnese_questions for update using (personal_id = auth.uid());
create policy "anamnese_questions_delete_own" on anamnese_questions for delete using (personal_id = auth.uid());

create table anamnese_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references users(id) on delete cascade,
  personal_id uuid references users(id) on delete cascade,
  main_goal text,
  training_location text check (training_location in ('academia','casa')),
  health_issues text,
  pain_zones text[] default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table anamnese_responses enable row level security;
create policy "anamnese_responses_select_own" on anamnese_responses for select using (student_id = auth.uid());
create policy "anamnese_responses_select_personal" on anamnese_responses for select using (
  exists (select 1 from users u where u.id = anamnese_responses.student_id and u.personal_id = auth.uid())
);
create policy "anamnese_responses_insert_own" on anamnese_responses for insert with check (student_id = auth.uid());
create policy "anamnese_responses_update_own" on anamnese_responses for update using (student_id = auth.uid());

create table anamnese_answers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references anamnese_questions(id) on delete cascade,
  answer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, question_id)
);

alter table anamnese_answers enable row level security;
create policy "anamnese_answers_select_own" on anamnese_answers for select using (student_id = auth.uid());
create policy "anamnese_answers_select_personal" on anamnese_answers for select using (
  exists (select 1 from users u where u.id = anamnese_answers.student_id and u.personal_id = auth.uid())
);
create policy "anamnese_answers_insert_own" on anamnese_answers for insert with check (student_id = auth.uid());
create policy "anamnese_answers_update_own" on anamnese_answers for update using (student_id = auth.uid());

alter table users add column if not exists anamnese_completed_at timestamptz;
