alter table public.products add column project_template_id uuid references public.project_templates(id);

alter table public.products drop constraint products_type_check;
alter table public.products add constraint products_type_check
  check (type = any (array[
    'consultoria','treino_pronto','receita','desafio','ebook_receitas',
    'substituicao_alimentar','outro','treino_template','planilha_treino',
    'projeto'
  ]));
