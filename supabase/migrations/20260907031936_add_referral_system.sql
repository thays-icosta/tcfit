alter table public.users
  add column if not exists referral_code text null,
  add column if not exists referred_by uuid null references public.users(id),
  add column if not exists referral_discount_pct integer null default 10;

create unique index if not exists users_referral_code_unique on public.users (referral_code) where referral_code is not null;

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id),
  referred_id uuid not null unique references public.users(id),
  discount_pct integer not null,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.referral_rewards enable row level security;

create policy referral_rewards_select_referrer
  on public.referral_rewards for select
  to authenticated
  using (referrer_id = auth.uid());

create policy referral_rewards_select_personal
  on public.referral_rewards for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.id = referral_rewards.referred_id and u.personal_id = auth.uid()
  ));

create policy referral_rewards_update_personal
  on public.referral_rewards for update
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.id = referral_rewards.referred_id and u.personal_id = auth.uid()
  ));

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  tries int := 0;
begin
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.users where referral_code = new_code);
    tries := tries + 1;
    exit when tries > 10;
  end loop;
  return new_code;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  ref_owner uuid;
  new_role text;
begin
  new_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  ref_code := nullif(new.raw_user_meta_data->>'referral_code', '');
  ref_owner := null;
  if ref_code is not null then
    select id into ref_owner from public.users where referral_code = upper(ref_code);
  end if;

  insert into public.users (id, email, name, role, personal_id, referred_by, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new_role,
    nullif(new.raw_user_meta_data->>'personal_id', '')::uuid,
    ref_owner,
    case when new_role = 'aluno' then public.generate_referral_code() else null end
  );
  return new;
end;
$$;

update public.users set referral_code = public.generate_referral_code()
where role = 'aluno' and referral_code is null;

create or replace function public.handle_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pct integer;
begin
  if new.access_level = 'consultoria_vip'
     and (old.access_level is distinct from 'consultoria_vip')
     and new.referred_by is not null then
    select coalesce(referrer.referral_discount_pct, 10) into pct
    from public.users referrer
    join public.users student on student.personal_id = referrer.id
    where referrer.id = (select personal_id from public.users where id = new.id)
    limit 1;

    insert into public.referral_rewards (referrer_id, referred_id, discount_pct)
    values (new.referred_by, new.id, coalesce(pct, 10))
    on conflict (referred_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_access_level_consultoria_vip on public.users;
create trigger on_access_level_consultoria_vip
  after update of access_level on public.users
  for each row
  execute function public.handle_referral_reward();
