alter table if exists public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_whatsapp text,
  add column if not exists social_links text,
  add column if not exists photos_drive_url text;

do $$
begin
  if to_regclass('public.organizations') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'organizations_contact_email_format_chk'
         and conrelid = 'public.organizations'::regclass
     ) then
    alter table public.organizations
      add constraint organizations_contact_email_format_chk
      check (
        contact_email is null
        or (
          length(contact_email) <= 120
          and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        )
      );
  end if;

  if to_regclass('public.organizations') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'organizations_contact_whatsapp_format_chk'
         and conrelid = 'public.organizations'::regclass
     ) then
    alter table public.organizations
      add constraint organizations_contact_whatsapp_format_chk
      check (
        contact_whatsapp is null
        or (
          length(contact_whatsapp) <= 30
          and contact_whatsapp ~ '^[0-9+()\\-\\s]*$'
        )
      );
  end if;

  if to_regclass('public.organizations') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'organizations_social_links_length_chk'
         and conrelid = 'public.organizations'::regclass
     ) then
    alter table public.organizations
      add constraint organizations_social_links_length_chk
      check (
        social_links is null
        or length(social_links) <= 500
      );
  end if;

  if to_regclass('public.organizations') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'organizations_photos_drive_url_format_chk'
         and conrelid = 'public.organizations'::regclass
     ) then
    alter table public.organizations
      add constraint organizations_photos_drive_url_format_chk
      check (
        photos_drive_url is null
        or (
          length(photos_drive_url) <= 500
          and photos_drive_url ~* '^https?://.+'
        )
      );
  end if;
end;
$$;
