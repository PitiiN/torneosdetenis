-- =============================================================================
-- ORGANIZATION FOLLOWERS
-- =============================================================================

begin;

create table if not exists public.organization_followers (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, organization_id)
);

-- RLS policies
alter table public.organization_followers enable row level security;

-- Users can read who they follow
drop policy if exists "Users can view their own follows" on public.organization_followers;
create policy "Users can view their own follows"
  on public.organization_followers
  for select
  using (auth.uid() = user_id);

-- Admins can read followers of their organization
drop policy if exists "Admins can view followers of their organization" on public.organization_followers;
create policy "Admins can view followers of their organization"
  on public.organization_followers
  for select
  using (public.is_org_admin(organization_id));

-- Users can follow organizations
drop policy if exists "Users can follow organizations" on public.organization_followers;
create policy "Users can follow organizations"
  on public.organization_followers
  for insert
  with check (auth.uid() = user_id);

-- Users can unfollow organizations
drop policy if exists "Users can unfollow organizations" on public.organization_followers;
create policy "Users can unfollow organizations"
  on public.organization_followers
  for delete
  using (auth.uid() = user_id);

-- RPC to get push targets for organization followers
create or replace function public.get_organization_follower_push_targets(
  p_organization_id uuid
)
returns table (
  user_id uuid,
  expo_push_token text
)
language sql
security definer
set search_path = public
as $$
  select 
    ofol.user_id,
    p.expo_push_token
  from public.organization_followers ofol
  join public.profiles p on p.id = ofol.user_id
  where ofol.organization_id = p_organization_id
    and p.expo_push_token is not null
    and p.notifications_enabled is distinct from false;
$$;

revoke all on function public.get_organization_follower_push_targets(uuid) from public;
grant execute on function public.get_organization_follower_push_targets(uuid) to authenticated;

commit;
