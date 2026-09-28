alter table public.project_activities drop constraint project_activities_activity_type_check;
alter table public.project_activities add constraint project_activities_activity_type_check
  check (activity_type in ('treino','programa','exercicio','video','conteudo','checklist','recovery'));
