alter table public.users
  add column must_change_password boolean not null default false,
  add column birth_date date;

comment on column public.users.must_change_password is 'True when the account was created by the personal with a temporary password and the aluno has not set their own password yet. Drives the forced "Crie sua nova senha" first-login gate and the Cadastrado/Ativo status badge.';
comment on column public.users.birth_date is 'Optional, personal-entered at signup. Not used by any logic yet.';
