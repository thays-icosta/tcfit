alter table products
  add column if not exists material_type text check (material_type in ('plano_alimentar', 'ebook_receita')),
  add column if not exists diet_tag text check (diet_tag in ('emagrecimento', 'ganho_de_massa', 'sem_gluten', 'vegetariano'));
