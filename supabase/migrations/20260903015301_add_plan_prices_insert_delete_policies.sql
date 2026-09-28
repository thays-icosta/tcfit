create policy plan_prices_insert_personal on plan_prices for insert
  with check (exists (select 1 from users where users.id = auth.uid() and users.role = 'personal'));

create policy plan_prices_delete_personal on plan_prices for delete
  using (exists (select 1 from users where users.id = auth.uid() and users.role = 'personal'));
