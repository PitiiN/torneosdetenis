begin;

-- Deletes all tournaments and any related rows that reference them via tournament_id.
do $$
declare
  rec record;
begin
  if to_regclass('public.tournaments') is null then
    return;
  end if;

  for rec in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tournament_id'
      and table_name <> 'tournaments'
  loop
    execute format(
      'delete from %I.%I where tournament_id in (select id from public.tournaments)',
      rec.table_schema,
      rec.table_name
    );
  end loop;

  delete from public.tournaments;
end
$$;

commit;
