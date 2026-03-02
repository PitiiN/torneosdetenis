alter table public.categories
  add column if not exists price_amount integer,
  add column if not exists currency text not null default 'clp';

alter table public.categories
  drop constraint if exists categories_price_amount_check;

alter table public.categories
  add constraint categories_price_amount_check
  check (price_amount is null or price_amount >= 0);

alter table public.categories
  drop constraint if exists categories_currency_check;

alter table public.categories
  add constraint categories_currency_check
  check (lower(currency) = 'clp');

update public.categories
set currency = 'clp'
where currency is null;

drop policy if exists categories_update_admin_organizer on public.categories;
create policy categories_update_admin_organizer
on public.categories
for update
to authenticated
using (public.is_admin_or_organizer(auth.uid()))
with check (public.is_admin_or_organizer(auth.uid()));
