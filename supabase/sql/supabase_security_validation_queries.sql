-- Supabase security validation queries (second pass)
-- Run in SQL editor as an administrative role.

-- 1) RLS state on core tables
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'organizations', 'tournaments', 'registrations', 'matches', 'audit_logs')
order by tablename;

-- 2) Policy inventory
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 3) SECURITY DEFINER functions
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by n.nspname, p.proname;

-- 4) Exposed helper views
select
  table_schema,
  table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('organizations_public', 'public_profiles')
order by table_name;

-- 5) Function privilege check for internal trigger helpers
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'set_row_updated_at',
    'handle_new_auth_user_profile',
    'prevent_profile_privilege_escalation',
    'clear_push_token_when_disabled',
    'enforce_profile_insert_defaults',
    'registrations_server_enforcer',
    'validate_match_winners',
    'audit_payload',
    'audit_log_changes'
  )
order by routine_name, grantee;

-- 6) Storage bucket status
select id, name, public
from storage.buckets
where id = 'organizations';

-- 7) Policy count guardrail (quick sanity check)
select
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'organizations', 'tournaments', 'registrations', 'matches', 'audit_logs')
group by tablename
order by tablename;
