-- ============================================
-- 006_payment_receipts.sql
-- Escuela de Tenis — Payment Receipts & Approval
-- ============================================

-- Payment receipts table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id),
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  classes_granted INT DEFAULT 0,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_student ON payment_receipts(student_id);
CREATE INDEX idx_receipts_status ON payment_receipts(status);

ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_view_own_receipts" ON payment_receipts
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "students_insert_receipts" ON payment_receipts
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "admins_view_all_receipts" ON payment_receipts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admins_update_receipts" ON payment_receipts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Update class allowance function to use receipts
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
  WITH granted AS (
    SELECT COALESCE(SUM(classes_granted), 0)::INT AS total
    FROM payment_receipts
    WHERE student_id = p_student_id 
      AND status = 'approved'
      AND created_at >= date_trunc('month', NOW())
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
    (SELECT total FROM granted) AS total_paid_classes,
    (SELECT cnt FROM used) AS used_classes,
    ((SELECT total FROM granted) - (SELECT cnt FROM used))::INT AS remaining_classes,
    'Comprobantes aprobados'::TEXT AS active_plan_name;
END;
$$;
