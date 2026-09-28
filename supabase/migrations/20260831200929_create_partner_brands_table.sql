
create table partner_brands (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references users(id) on delete cascade,
  name text not null,
  logo_url text,
  coupon_code text,
  affiliate_link text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table partner_brands enable row level security;

create policy "partner_brands_select_all" on partner_brands for select using (true);
create policy "partner_brands_insert_own" on partner_brands for insert with check (personal_id = auth.uid());
create policy "partner_brands_update_own" on partner_brands for update using (personal_id = auth.uid());
create policy "partner_brands_delete_own" on partner_brands for delete using (personal_id = auth.uid());

alter table users add column if not exists show_partners_section boolean not null default true;
