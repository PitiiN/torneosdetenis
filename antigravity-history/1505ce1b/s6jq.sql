-- ============================================
-- 003_functions.sql
-- Escuela de Tenis — Functions, Triggers, Views
-- ============================================

-- ============================================
-- Trigger: auto-create profile on auth signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- View: classes_with_availability
-- ============================================
CREATE OR REPLACE VIEW public.classes_with_availability AS
SELECT
  c.*,
  p.full_name AS coach_name,
  p.avatar_url AS coach_avatar,
  ct.name AS court_name,
  ct.surface AS court_surface,
  cc.name AS category_name,
  cc.color AS category_color,
  cc.level AS category_level,
  COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'confirmed'), 0) AS enrolled_count,
  c.max_students - COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'confirmed'), 0) AS available_spots,
  COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'waitlist'), 0) AS waitlist_count
FROM public.classes c
JOIN public.profiles p ON c.coach_id = p.id
JOIN public.courts ct ON c.court_id = ct.id
LEFT JOIN public.class_categories cc ON c.category_id = cc.id
LEFT JOIN public.enrollments e ON c.id = e.class_id
GROUP BY c.id, p.full_name, p.avatar_url, ct.name, ct.surface, cc.name, cc.color, cc.level;

-- ============================================
-- Function: get available classes in date range
-- ============================================
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

-- ============================================
-- Function: student payment summary
-- ============================================
CREATE OR REPLACE FUNCTION get_student_payment_summary(p_student_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_paid', COALESCE(SUM(final_amount) FILTER (WHERE status = 'paid'), 0),
    'total_pending', COALESCE(SUM(final_amount) FILTER (WHERE status = 'pending'), 0),
    'total_overdue', COALESCE(SUM(final_amount) FILTER (WHERE status = 'overdue'), 0),
    'payments_count', COUNT(*),
    'overdue_count', COUNT(*) FILTER (WHERE status = 'overdue')
  ) INTO result
  FROM public.payments
  WHERE student_id = p_student_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
