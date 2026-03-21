# Supabase Security Deep Review (Second Pass)

## Scope and baseline
- Baseline reviewed: first-pass hardening + current app data access patterns.
- Focus of this pass: exploitable residual risk in RLS, SQL functions/triggers, storage policies, signed URLs, and mobile query paths.
- Primary artifacts hardened:
  - `supabase/migrations/20260318123000_security_privacy_hardening.sql`
  - `supabase/migrations/20260319143000_supabase_security_second_pass.sql`
  - Mobile queries in `app/(tabs)/*`
  - Storage URL resolver in `src/services/storage.ts`

## Inventory (repo-derived)

### Schemas
- `public`
- `app_private` (created, currently no tables in repo migration)
- `storage` (Supabase-managed)
- `auth` (Supabase-managed)

### Tables (explicitly used or hardened)
- `public.profiles`
- `public.organizations`
- `public.tournaments`
- `public.registrations`
- `public.matches`
- `public.audit_logs`
- `storage.objects`
- `storage.buckets`

### Views (second pass)
- `public.organizations_public` (safe read surface)
- `public.public_profiles` (safe read surface)

### Functions (security-relevant)
- Access helpers (`SECURITY DEFINER`):
  - `public.current_user_role()`
  - `public.current_user_org_id()`
  - `public.current_user_is_super_admin()`
  - `public.is_org_admin(uuid)`
  - `public.is_tournament_admin(uuid)`
- Integrity / lifecycle:
  - `public.handle_new_auth_user_profile()`
  - `public.prevent_profile_privilege_escalation()`
  - `public.clear_push_token_when_disabled()`
  - `public.registrations_server_enforcer()`
  - `public.validate_match_winners()`
  - `public.enforce_profile_insert_defaults()` (added second pass)
  - `public.set_row_updated_at()`
- Audit:
  - `public.audit_payload(text,jsonb)`
  - `public.audit_log_changes()`
  - `public.purge_expired_audit_logs(integer)`

### Triggers (security/integrity)
- `set_*_updated_at` on core tables
- `trg_auth_user_profile`
- `trg_profiles_prevent_privilege_escalation`
- `trg_profiles_clear_push_token`
- `trg_profiles_enforce_insert_defaults` (second pass)
- `trg_registrations_server_enforcer`
- `trg_matches_validate_winners`
- `trg_audit_profiles`
- `trg_audit_tournaments`
- `trg_audit_registrations`
- `trg_audit_matches`

### Buckets and storage policies
- Bucket: `organizations` (private).
- Object path model:
  - `avatars/{user_id}/{random}.{ext}`
  - `logos/{organization_id}/{random}.{ext}`
- Policy families:
  - Read logos (authenticated).
  - Read avatars (owner/super-admin).
  - Insert/update/delete avatars by owner.
  - Insert/update/delete logos by org admin.
  - Extension and size checks.

### Columns and ownership primitives
- Ownership / tenancy keys:
  - `profiles.id`, `profiles.org_id`, `profiles.role`, `profiles.is_super_admin`
  - `tournaments.organization_id`
  - `registrations.player_id`, `registrations.tournament_id`
  - `matches.tournament_id`, `matches.player_*_id`
- Sensitive columns (high attention):
  - `profiles.phone`
  - `profiles.location`
  - `profiles.expo_push_token`
  - `profiles.role` / `profiles.is_super_admin`
  - registration finance fields (`fee_amount`, `is_paid`)
  - `audit_logs.*`

## Exploitable findings and fixes applied in this pass

### 1) Profile over-read risk (lateral PII read)
**Previous risk:** participant-to-participant profile read path could expose private profile columns if queried directly.  
**Fixes:**
- Tightened `profiles_select_policy` to:
  - self,
  - super admin,
  - same-org admin/organizer only.
- Added `public.public_profiles` view (id/name/avatar only) for broad non-sensitive reads.
- Updated mobile reads to use `public_profiles` where public identity data is needed.

### 2) Organization table broad read surface
**Previous risk:** `organizations` table was readable by all authenticated users (`using (true)`), which is unsafe if sensitive columns are added later.  
**Fixes:**
- Tightened `organizations_select_policy` to org admin/super-admin only.
- Added `public.organizations_public` view for safe non-sensitive organization listing.
- Migrated mobile public reads to `organizations_public`.

### 3) Profile insert privilege escalation window
**Previous risk:** non-super users could attempt crafted profile insert with privileged role flags if row-creation assumptions failed.  
**Fixes:**
- Hardened `profiles_insert_policy` with strict non-privileged constraints.
- Added `enforce_profile_insert_defaults()` trigger:
  - for non-super callers, force `role='player'`, `org_id=null`, `is_super_admin=false`.

### 4) Registration state tampering (finance/state abuse)
**Previous risk:** non-manager registration inserts/updates could still carry attacker-supplied status/payment semantics.  
**Fixes:**
- Strengthened `registrations_server_enforcer()`:
  - non-managers cannot set `is_paid=true`,
  - non-managers cannot set arbitrary status,
  - non-managers can only transition to `cancelled` (and cannot reopen cancelled records).
- Tightened registration update/delete policies to active tournament windows for player self-actions.

### 5) Excessive SQL function exposure as RPC surface
**Previous risk:** internal trigger/helper functions remained broadly executable by PUBLIC role inheritance.  
**Fixes:**
- Revoked PUBLIC execute from internal functions (trigger-only and internal utility functions).
- Kept explicit execute grants only where needed for auth-side predicates and service flows.

### 6) Signed URL exposure window and scope
**Previous risk:** signed URL helper allowed any bucket path attempt and long TTL default.  
**Fixes:**
- `src/services/storage.ts`:
  - default signed URL TTL reduced to 300s,
  - allowed prefixes constrained to `avatars` and `logos`.

## Frontend mobile data access hardening (second pass)
- `app/(tabs)/index.tsx`:
  - reads from `organizations_public`.
- `app/(tabs)/players.tsx`:
  - org label from `organizations_public`;
  - ranking names from `public_profiles`.
- `app/(tabs)/tournaments.tsx`:
  - org header from `organizations_public`.
- `app/(tabs)/finance.tsx`:
  - org name from `organizations_public`.
- `app/(tabs)/profile.tsx`:
  - profile query changed from `select('*')` to explicit minimal columns.
  - org context list from `organizations_public`.
- `app/(tabs)/tournaments/[id].tsx`:
  - removed direct profile joins for player listing;
  - now resolves player names through `public_profiles`.

## Security Definer and search_path audit
- All access-control `SECURITY DEFINER` functions pin `search_path = public`.
- Internal helper/trigger functions are no longer broadly executable through PUBLIC grants.
- No user-supplied dynamic SQL paths were found in exposed callable functions.

## Storage deep check status
- Bucket privacy target: private (`public=false`) for `organizations`.
- Read separation implemented:
  - logos readable to authenticated.
  - avatars restricted to owner/super-admin.
- Write separation implemented by path ownership and org-admin checks.
- MIME/extension and size constraints implemented in policy layer.
- Note: if migration role cannot own/alter `storage.objects`, storage policy operations require privileged run in project SQL editor (owner context).

## Table-by-table RLS status summary

| Table | SELECT | INSERT | UPDATE | DELETE | Residual risk |
|---|---|---|---|---|---|
| `profiles` | self / same-org admin / super-admin | self constrained / super-admin | self / super-admin + trigger anti-escalation | super-admin | private fields still in same table (mitigated by policy + view usage) |
| `organizations` | org admin / super-admin | super-admin | org admin | super-admin | direct table reads now intentionally narrow |
| `tournaments` | published + admin + participant | org admin | tournament admin | tournament admin | verify future sensitive columns before exposing via app |
| `registrations` | owner / tournament admin | owner (active tournament) / admin | owner (active only, cancel-only semantics) / admin | owner (active only) / admin | validate business status matrix in prod |
| `matches` | published + participant + admin | admin | admin | admin | ensure no future sensitive columns added without review |
| `audit_logs` | super-admin only | trigger-driven | none | none | operational retention policy still needs scheduled execution |

## Gaps identified (schema not present in repo)
- No explicit tables/migrations found for:
  - `notifications` (DB table),
  - `payments`,
  - `transactions`,
  - dedicated `rankings` table.
- App derives finance/ranking from `registrations`/`matches`/`tournaments`.
- If these tables exist in remote DB, they must be reviewed with equivalent RLS and policy strictness.

## Residual risks and manual validation pending
1. Storage DDL/policy statements may still require owner-role execution in some environments.
2. Existing production data should be validated against new stricter policy paths (especially organizer workflows).
3. If additional sensitive columns exist in `organizations`/`profiles` remotely, validate grants and app query paths.
4. Realtime channels are not currently used in this repo; if enabled remotely, validate replication/RLS scopes.

## Files changed in this deep pass
- SQL:
  - `supabase/migrations/20260319143000_supabase_security_second_pass.sql`
  - `supabase/migrations/20260318123000_security_privacy_hardening.sql` (owner-safe storage block handling)
- Client access:
  - `app/(tabs)/index.tsx`
  - `app/(tabs)/players.tsx`
  - `app/(tabs)/tournaments.tsx`
  - `app/(tabs)/finance.tsx`
  - `app/(tabs)/profile.tsx`
  - `app/(tabs)/tournaments/[id].tsx`
  - `src/services/storage.ts`
