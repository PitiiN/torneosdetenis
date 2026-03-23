begin;

do $$
declare
  has_contact_email boolean;
  has_contact_whatsapp boolean;
  has_social_links boolean;
  has_photos_drive_url boolean;
  view_sql text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'contact_email'
  ) into has_contact_email;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'contact_whatsapp'
  ) into has_contact_whatsapp;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'social_links'
  ) into has_social_links;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'photos_drive_url'
  ) into has_photos_drive_url;

  view_sql :=
    'create or replace view public.organizations_public ' ||
    'with (security_barrier = true) as ' ||
    'select ' ||
      'o.id, ' ||
      'o.name, ' ||
      'o.slug, ' ||
      'o.logo_url, ' ||
      'o.created_at, ' ||
      case when has_contact_email then 'o.contact_email' else 'null::text as contact_email' end || ', ' ||
      case when has_contact_whatsapp then 'o.contact_whatsapp' else 'null::text as contact_whatsapp' end || ', ' ||
      case when has_social_links then 'o.social_links' else 'null::text as social_links' end || ', ' ||
      case when has_photos_drive_url then 'o.photos_drive_url' else 'null::text as photos_drive_url' end || ' ' ||
    'from public.organizations o';

  execute view_sql;
end
$$;

revoke all on public.organizations_public from public;
grant select on public.organizations_public to authenticated;
grant select on public.organizations_public to service_role;

commit;
