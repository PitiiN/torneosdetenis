-- Migration to add missing notification types to the CHECK constraint
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type = any (
      array[
        'match_start'::text,
        'result'::text,
        'round_advance'::text,
        'info'::text,
        'registration'::text,
        'ranking_position_updated'::text,
        'ranking_category_updated'::text,
        'ranking_new_number_one'::text,
        'registration_request'::text,
        'new_tournament_published'::text,
        'next_match_defined'::text,
        'match_schedule_updated'::text,
        'registration_approved'::text,
        'tournament_finished'::text,
        'match_reminder_24h'::text
      ]
    )
  );
