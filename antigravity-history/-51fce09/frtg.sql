-- ============================================
-- 002_rls_policies.sql
-- Escuela de Tenis — Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_reschedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_credits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper: get current user role
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- POLICIES: profiles
-- ========================
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: courts
-- ========================
CREATE POLICY "courts_select_authenticated"
  ON public.courts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "courts_admin_manage"
  ON public.courts FOR ALL
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: class_categories
-- ========================
CREATE POLICY "categories_select_authenticated"
  ON public.class_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "categories_admin_manage"
  ON public.class_categories FOR ALL
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: classes
-- ========================
CREATE POLICY "classes_select_authenticated"
  ON public.classes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "classes_insert_admin_coach"
  ON public.classes FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "classes_update_admin_or_own_coach"
  ON public.classes FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
    OR coach_id = auth.uid()
  );

CREATE POLICY "classes_delete_admin"
  ON public.classes FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: enrollments
-- ========================
CREATE POLICY "enrollments_select_own_or_staff"
  ON public.enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'coach')
  );

CREATE POLICY "enrollments_insert_own_or_admin"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "enrollments_update_own_or_admin"
  ON public.enrollments FOR UPDATE
  USING (
    student_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "enrollments_delete_admin"
  ON public.enrollments FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: payment_plans
-- ========================
CREATE POLICY "payment_plans_select_authenticated"
  ON public.payment_plans FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "payment_plans_admin_manage"
  ON public.payment_plans FOR ALL
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: payments
-- ========================
CREATE POLICY "payments_select_own_or_admin"
  ON public.payments FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "payments_insert_admin"
  ON public.payments FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "payments_update_admin"
  ON public.payments FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "payments_delete_admin"
  ON public.payments FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: notifications
-- ========================
CREATE POLICY "notifications_own"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin_or_system"
  ON public.notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ========================
-- POLICIES: class_reschedules
-- ========================
CREATE POLICY "reschedules_select_authenticated"
  ON public.class_reschedules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reschedules_admin_manage"
  ON public.class_reschedules FOR ALL
  USING (public.get_my_role() = 'admin');

-- ========================
-- POLICIES: student_credits
-- ========================
CREATE POLICY "credits_select_own_or_admin"
  ON public.student_credits FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "credits_admin_manage"
  ON public.student_credits FOR ALL
  USING (public.get_my_role() = 'admin');
