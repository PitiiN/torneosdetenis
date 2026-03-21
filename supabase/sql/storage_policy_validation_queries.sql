-- Storage policy validation queries (third pass)
-- Run in Supabase SQL Editor after remediation.

-- -----------------------------------------------------------------------------
-- 1) Bucket exists and is private
-- -----------------------------------------------------------------------------
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'organizations';

-- -----------------------------------------------------------------------------
-- 2) storage.objects RLS state
-- -----------------------------------------------------------------------------
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'storage'
  and tablename = 'objects';

-- -----------------------------------------------------------------------------
-- 3) Exact expected policy names on storage.objects
-- -----------------------------------------------------------------------------
with expected(policyname) as (
  values
    ('organizations_assets_select_logos'),
    ('organizations_assets_select_avatars'),
    ('organizations_assets_insert_avatars'),
    ('organizations_assets_insert_logos'),
    ('organizations_assets_update_avatars'),
    ('organizations_assets_update_logos'),
    ('organizations_assets_delete_avatars'),
    ('organizations_assets_delete_logos')
)
select
  e.policyname as expected_policy,
  p.policyname as actual_policy,
  p.cmd,
  p.roles
from expected e
left join pg_policies p
  on p.schemaname = 'storage'
 and p.tablename = 'objects'
 and p.policyname = e.policyname
order by e.policyname;

-- -----------------------------------------------------------------------------
-- 4) Unexpected / suspicious policies on storage.objects
-- -----------------------------------------------------------------------------
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname not in (
    'organizations_assets_select_logos',
    'organizations_assets_select_avatars',
    'organizations_assets_insert_avatars',
    'organizations_assets_insert_logos',
    'organizations_assets_update_avatars',
    'organizations_assets_update_logos',
    'organizations_assets_delete_avatars',
    'organizations_assets_delete_logos'
  )
order by policyname;

-- -----------------------------------------------------------------------------
-- 5) Policy definitions (human review)
-- -----------------------------------------------------------------------------
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- -----------------------------------------------------------------------------
-- 6) Prefix sanity on existing objects (data quality check)
-- -----------------------------------------------------------------------------
select
  bucket_id,
  split_part(name, '/', 1) as root_prefix,
  count(*) as objects_count
from storage.objects
where bucket_id = 'organizations'
group by bucket_id, split_part(name, '/', 1)
order by objects_count desc;

-- -----------------------------------------------------------------------------
-- 7) Find potentially malformed keys for this bucket
-- -----------------------------------------------------------------------------
select
  id,
  name,
  owner,
  created_at
from storage.objects
where bucket_id = 'organizations'
  and (
    split_part(name, '/', 1) not in ('avatars', 'logos')
    or split_part(name, '/', 2) = ''
  )
order by created_at desc
limit 100;

-- -----------------------------------------------------------------------------
-- 8) Quick dependency check for policy helper functions
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.current_user_is_super_admin()') as current_user_is_super_admin_fn,
  to_regprocedure('public.is_org_admin(uuid)') as is_org_admin_fn;
