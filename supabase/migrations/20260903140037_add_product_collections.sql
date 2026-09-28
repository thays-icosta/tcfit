
create table product_collections (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  cover_image_url text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table product_collections enable row level security;

create policy product_collections_select_all on product_collections for select using (true);
create policy product_collections_insert_own on product_collections for insert with check (personal_id = auth.uid());
create policy product_collections_update_own on product_collections for update using (personal_id = auth.uid());
create policy product_collections_delete_own on product_collections for delete using (personal_id = auth.uid());

alter table products add column collection_id uuid references product_collections(id) on delete set null;
