alter table public.users
  add column if not exists access_level text not null default 'plataforma_base'
  check (access_level in ('plataforma_base', 'consultoria_vip'));

alter table public.products
  add column if not exists required_access_level text
  check (required_access_level in ('plataforma_base', 'consultoria_vip'));
