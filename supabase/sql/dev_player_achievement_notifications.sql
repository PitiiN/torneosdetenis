create table if not exists public.player_achievement_notifications (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  notified_at timestamptz not null default now(),
  primary key (profile_id, achievement_id)
);

alter table public.player_achievement_notifications enable row level security;

drop policy if exists "player_achievement_notifications_select_own" on public.player_achievement_notifications;
create policy "player_achievement_notifications_select_own"
on public.player_achievement_notifications
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "player_achievement_notifications_insert_own" on public.player_achievement_notifications;
create policy "player_achievement_notifications_insert_own"
on public.player_achievement_notifications
for insert
to authenticated
with check (profile_id = auth.uid());

grant select, insert on public.player_achievement_notifications to authenticated;
