
create policy users_update_own_students on public.users
  for update
  using (personal_id = auth.uid() and role = 'aluno')
  with check (personal_id = auth.uid() and role = 'aluno');
