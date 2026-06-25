-- Migration to add registration_rejected notification type to the CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (
    ARRAY[
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
      'registration_rejected'::text,
      'tournament_finished'::text,
      'match_reminder_24h'::text
    ]
  )
);
