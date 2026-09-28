
-- Aluno's onboarding "Universo Feminino/Masculino" profile selection (also used as the
-- default biological sex for the anamnese macro calculator).
alter table public.users
  add column if not exists gender text check (gender in ('masculino', 'feminino'));

-- Target-audience tag for workout templates, independent of the existing
-- multi-select workout_tags used for landing-page pill filters.
alter table public.workout_templates
  add column if not exists target_audience text not null default 'unissex'
  check (target_audience in ('feminino', 'masculino', 'unissex'));

-- Mirrored onto products so the aluno's Hub de Programas (which reads from
-- products, not workout_templates) can filter by it too.
alter table public.products
  add column if not exists target_audience text
  check (target_audience in ('feminino', 'masculino', 'unissex'));

update public.products
set target_audience = wt.target_audience
from public.workout_templates wt
where products.source_template_id = wt.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ref_code text;
  ref_owner uuid;
  new_role text;
  new_gender text;
begin
  new_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  ref_code := nullif(new.raw_user_meta_data->>'referral_code', '');
  ref_owner := null;
  new_gender := nullif(new.raw_user_meta_data->>'gender', '');
  if new_gender not in ('masculino', 'feminino') then
    new_gender := null;
  end if;
  if ref_code is not null then
    select id into ref_owner from public.users where referral_code = upper(ref_code);
  end if;

  insert into public.users (id, email, name, role, personal_id, referred_by, referral_code, gender)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new_role,
    nullif(new.raw_user_meta_data->>'personal_id', '')::uuid,
    ref_owner,
    case when new_role = 'aluno' then public.generate_referral_code() else null end,
    new_gender
  );
  return new;
end;
$function$;
