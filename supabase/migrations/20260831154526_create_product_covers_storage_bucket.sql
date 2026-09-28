insert into storage.buckets (id, name, public)
values ('product-covers', 'product-covers', true)
on conflict (id) do nothing;

create policy "product_covers_public_read"
on storage.objects for select
using (bucket_id = 'product-covers');

create policy "product_covers_upload_authenticated"
on storage.objects for insert
with check (bucket_id = 'product-covers' and auth.uid() is not null);

create policy "product_covers_update_authenticated"
on storage.objects for update
using (bucket_id = 'product-covers' and auth.uid() is not null);
