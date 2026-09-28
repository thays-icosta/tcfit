
insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', true)
on conflict (id) do nothing;

create policy "product-files public read"
on storage.objects for select
using (bucket_id = 'product-files');

create policy "product-files auth insert"
on storage.objects for insert
with check (bucket_id = 'product-files' and auth.uid() is not null);

create policy "product-files auth update"
on storage.objects for update
using (bucket_id = 'product-files' and auth.uid() is not null);

create policy "product-files auth delete"
on storage.objects for delete
using (bucket_id = 'product-files' and auth.uid() is not null);
