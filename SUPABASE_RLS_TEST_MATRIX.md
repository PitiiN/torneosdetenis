# Supabase RLS Test Matrix (Second Pass)

## Test setup
- Create at least these actors:
  - `player_a` (Org A)
  - `player_b` (Org A)
  - `organizer_a` (role organizer, Org A)
  - `organizer_b` (role organizer, Org B)
  - `super_admin`
- Create tournaments in Org A and Org B with mixed statuses (`draft`, `open`, `in_progress`, `finished`).
- Seed registrations/matches crossing those tournaments.

## Matrix

| # | Actor | Resource | Action | Expected | Verification |
|---|---|---|---|---|---|
| 1 | `player_a` | `profiles` (`player_a`) | SELECT self | ALLOW | `from('profiles').select(...).eq('id', player_a_id)` returns row |
| 2 | `player_a` | `profiles` (`player_b`) | SELECT peer private profile | DENY | same query with `player_b_id` returns 0 rows |
| 3 | `organizer_a` | `profiles` (Org A users) | SELECT org profiles | ALLOW | select by `org_id=org_a` returns rows |
| 4 | `organizer_a` | `profiles` (Org B users) | SELECT cross-org profiles | DENY | select by `org_id=org_b` returns 0 rows |
| 5 | `player_a` | `profiles` | INSERT with `role='admin'` | DENY / FORCED PLAYER | insert should fail or row forced to player/null org |
| 6 | `player_a` | `profiles` | UPDATE own `role` / `is_super_admin` | DENY | update should error via trigger |
| 7 | `player_a` | `organizations` table | SELECT direct | DENY | `from('organizations').select('*')` returns 0 rows |
| 8 | `player_a` | `organizations_public` view | SELECT list | ALLOW | `from('organizations_public').select('id,name')` returns rows |
| 9 | `player_a` | `registrations` (own) | INSERT for open tournament | ALLOW | insert with own token succeeds |
| 10 | `player_a` | `registrations` | INSERT with `is_paid=true` | DENY EFFECTIVE TAMPER | inserted row persists with `is_paid=false` |
| 11 | `player_a` | `registrations` | INSERT for `draft` tournament | DENY | insert fails (`registration is closed`) |
| 12 | `player_a` | `registrations` (other player) | INSERT/UPDATE as other user | DENY | fails (`cannot register another player` / policy denial) |
| 13 | `player_a` | `registrations` (own active) | UPDATE status -> `cancelled` | ALLOW | succeeds while tournament active |
| 14 | `player_a` | `registrations` (own active) | UPDATE status -> `confirmed` (manual tamper) | DENY | fails (`players can only cancel...`) |
| 15 | `player_a` | `registrations` (own finished tournament) | UPDATE/DELETE | DENY | denied by policy tournament-status guard |
| 16 | `organizer_a` | `registrations` (Org A tournament) | UPDATE `is_paid` / `fee_amount` | ALLOW | update succeeds |
| 17 | `organizer_a` | `registrations` (Org B tournament) | UPDATE finance fields | DENY | policy denial |
| 18 | `player_a` | `matches` | INSERT/UPDATE/DELETE | DENY | policy denial on write actions |
| 19 | `organizer_a` | `matches` (Org A tournament) | UPDATE score/winner | ALLOW | update succeeds |
| 20 | `organizer_b` | `matches` (Org A tournament) | UPDATE score/winner | DENY | policy denial |
| 21 | `player_a` | `audit_logs` | SELECT | DENY | 0 rows / policy denial |
| 22 | `super_admin` | `audit_logs` | SELECT | ALLOW | rows visible |
| 23 | `player_a` | `storage.objects` avatars own path | SELECT via signed URL | ALLOW | signed URL generation works for `avatars/{player_a}/...` |
| 24 | `player_a` | `storage.objects` avatars other user path | SELECT via signed URL | DENY | signed URL generation fails |
| 25 | `player_a` | `storage.objects` upload logo path Org A | INSERT | DENY | upload blocked by org-admin check |
| 26 | `organizer_a` | `storage.objects` upload logo path Org A | INSERT | ALLOW | upload succeeds |
| 27 | `organizer_a` | `storage.objects` upload logo path Org B | INSERT | DENY | blocked by org-admin check |
| 28 | `player_a` | `public_profiles` view | SELECT id/name/avatar | ALLOW | `from('public_profiles').select('id,name')` returns rows |

## SQL inspection checks (metadata)

Run these in SQL editor to verify configuration state:

```sql
-- RLS enabled on core tables
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','organizations','tournaments','registrations','matches','audit_logs');

-- Policies currently active
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- SECURITY DEFINER functions
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by 1,2;
```

## Notes
- Execute actor tests using real JWT contexts (Supabase client per user), not only SQL editor as owner.
- For storage tests, validate both direct list/read and signed URL flows from app code paths.
