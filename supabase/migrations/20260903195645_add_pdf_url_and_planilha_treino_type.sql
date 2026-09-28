
alter table products add column pdf_url text;

alter table products drop constraint products_type_check;
alter table products add constraint products_type_check
  check (type = any (array['consultoria','treino_pronto','receita','desafio','ebook_receitas','substituicao_alimentar','outro','treino_template','planilha_treino']));
