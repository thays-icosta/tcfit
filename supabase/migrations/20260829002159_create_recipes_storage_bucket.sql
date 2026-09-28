insert into storage.buckets (id, name, public)
values ('recipes', 'recipes', true)
on conflict (id) do nothing;

create policy "recipes_public_read"
on storage.objects for select
using (bucket_id = 'recipes');

create policy "recipes_upload_authenticated"
on storage.objects for insert
with check (bucket_id = 'recipes' and auth.uid() is not null);

create policy "recipes_update_authenticated"
on storage.objects for update
using (bucket_id = 'recipes' and auth.uid() is not null);
