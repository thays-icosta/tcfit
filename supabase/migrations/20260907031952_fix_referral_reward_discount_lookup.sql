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
    select coalesce(referral_discount_pct, 10) into pct
    from public.users
    where id = new.personal_id;

    insert into public.referral_rewards (referrer_id, referred_id, discount_pct)
    values (new.referred_by, new.id, coalesce(pct, 10))
    on conflict (referred_id) do nothing;
  end if;
  return new;
end;
$$;
