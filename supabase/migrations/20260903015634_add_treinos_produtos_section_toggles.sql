alter table users add column if not exists show_treinos_prontos_section boolean default true;
alter table users add column if not exists show_produtos_avulsos_section boolean default true;

create or replace view personal_public_info as
select id, name, phone, pix_key, payment_link, avatar_url, show_treinos_prontos_section, show_produtos_avulsos_section
from users
where role = 'personal';
