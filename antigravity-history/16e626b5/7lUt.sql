-- ============================================
-- 005_enrollment_limits.sql
-- Escuela de Tenis — Enrollment Limit Check
-- ============================================

-- Function to get remaining classes for a student based on paid plans
CREATE OR REPLACE FUNCTION get_student_class_allowance(p_student_id UUID)
RETURNS TABLE(
  total_paid_classes INT,
  used_classes INT,
  remaining_classes INT,
  active_plan_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH paid_plans AS (
    SELECT 
      COALESCE(SUM(pp.classes_count), 0)::INT AS total_classes,
      p.plan_id,
      pp.name AS plan_name
    FROM payments p
    JOIN payment_plans pp ON pp.id = p.plan_id
    WHERE p.student_id = p_student_id 
      AND p.status = 'paid'
      AND p.paid_at >= date_trunc('month', NOW())
    GROUP BY p.plan_id, pp.name
  ),
  used AS (
    SELECT COUNT(*)::INT AS cnt
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    WHERE e.student_id = p_student_id
      AND e.status = 'confirmed'
      AND c.start_datetime >= date_trunc('month', NOW())
      AND c.start_datetime < date_trunc('month', NOW()) + INTERVAL '1 month'
  )
  SELECT 
    COALESCE((SELECT SUM(total_classes) FROM paid_plans), 0)::INT AS total_paid_classes,
    (SELECT cnt FROM used) AS used_classes,
    (COALESCE((SELECT SUM(total_classes) FROM paid_plans), 0) - (SELECT cnt FROM used))::INT AS remaining_classes,
    (SELECT plan_name FROM paid_plans LIMIT 1) AS active_plan_name;
END;
$$;
