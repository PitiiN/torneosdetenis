-- ============================================
-- Migration: class_overhaul
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Clean up old categories, keep only Inicial, Intermedio, Avanzado
-- First update any classes that reference categories being deleted
UPDATE public.classes SET category_id = NULL WHERE category_id IN (
  SELECT id FROM public.class_categories WHERE name NOT IN ('Intermedio', 'Avanzado')
);

DELETE FROM public.class_categories WHERE name NOT IN ('Intermedio', 'Avanzado');

-- Ensure 'Inicial' exists
INSERT INTO public.class_categories (name, level, color, description)
SELECT 'Inicial', 1, '#22C55E', 'Nivel inicial'
WHERE NOT EXISTS (SELECT 1 FROM public.class_categories WHERE name = 'Inicial');

-- Ensure Intermedio level/color
UPDATE public.class_categories SET level = 2, color = '#F59E0B' WHERE name = 'Intermedio';

-- Ensure Avanzado level/color
UPDATE public.class_categories SET level = 3, color = '#EF4444' WHERE name = 'Avanzado';

-- 2. Add student_category to profiles
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN student_category TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add check constraint separately to avoid errors if it already exists
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_student_category_check
    CHECK (student_category IN ('Inicial', 'Intermedio', 'Avanzado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Make coach_id nullable
ALTER TABLE public.classes ALTER COLUMN coach_id DROP NOT NULL;

-- 4. Add court2_category_id (each class uses both courts, each with its own category)
DO $$ BEGIN
  ALTER TABLE public.classes ADD COLUMN court2_category_id UUID REFERENCES public.class_categories(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Add auto_cancelled flag
DO $$ BEGIN
  ALTER TABLE public.classes ADD COLUMN auto_cancelled BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Drop and recreate view (can't add columns with CREATE OR REPLACE)
-- First drop dependent function that references the view
DROP FUNCTION IF EXISTS get_available_classes(DATE, DATE, UUID);
DROP VIEW IF EXISTS public.classes_with_availability;
CREATE VIEW public.classes_with_availability AS
SELECT
  c.*,
  p.full_name AS coach_name,
  p.avatar_url AS coach_avatar,
  ct.name AS court_name,
  ct.surface AS court_surface,
  cc.name AS category_name,
  cc.color AS category_color,
  cc.level AS category_level,
  cc2.name AS court2_category_name,
  cc2.color AS court2_category_color,
  cc2.level AS court2_category_level,
  COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'confirmed'), 0) AS enrolled_count,
  c.max_students - COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'confirmed'), 0) AS available_spots,
  COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'waitlist'), 0) AS waitlist_count
FROM public.classes c
LEFT JOIN public.profiles p ON c.coach_id = p.id
JOIN public.courts ct ON c.court_id = ct.id
LEFT JOIN public.class_categories cc ON c.category_id = cc.id
LEFT JOIN public.class_categories cc2 ON c.court2_category_id = cc2.id
LEFT JOIN public.enrollments e ON c.id = e.class_id
GROUP BY c.id, p.full_name, p.avatar_url, ct.name, ct.surface, cc.name, cc.color, cc.level, cc2.name, cc2.color, cc2.level;

-- 7. Ensure notification types include new ones
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('class_reminder', 'payment_due', 'class_cancelled',
                  'enrollment_confirmed', 'class_updated', 'general',
                  'weather_cancellation', 'auto_cancel'));

-- 8. Recreate get_available_classes function (was dropped with the view)
CREATE OR REPLACE FUNCTION get_available_classes(
  p_start_date DATE,
  p_end_date DATE,
  p_student_id UUID DEFAULT NULL
)
RETURNS TABLE (
  class_id UUID,
  title TEXT,
  description TEXT,
  coach_name TEXT,
  coach_avatar TEXT,
  court_name TEXT,
  category_name TEXT,
  category_color TEXT,
  category_level INTEGER,
  court2_category_name TEXT,
  court2_category_color TEXT,
  court2_category_level INTEGER,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  duration_minutes INTEGER,
  price DECIMAL,
  max_students INTEGER,
  enrolled_count BIGINT,
  available_spots BIGINT,
  is_enrolled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.title,
    ca.description,
    ca.coach_name,
    ca.coach_avatar,
    ca.court_name,
    ca.category_name,
    ca.category_color,
    ca.category_level,
    ca.court2_category_name,
    ca.court2_category_color,
    ca.court2_category_level,
    ca.start_datetime,
    ca.end_datetime,
    ca.duration_minutes,
    ca.price,
    ca.max_students,
    ca.enrolled_count,
    ca.available_spots,
    CASE
      WHEN p_student_id IS NOT NULL THEN
        EXISTS(
          SELECT 1 FROM public.enrollments e
          WHERE e.class_id = ca.id
          AND e.student_id = p_student_id
          AND e.status = 'confirmed'
        )
      ELSE FALSE
    END AS is_enrolled
  FROM public.classes_with_availability ca
  WHERE
    ca.start_datetime::DATE >= p_start_date
    AND ca.start_datetime::DATE <= p_end_date
    AND ca.status = 'scheduled'
  ORDER BY ca.start_datetime ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
