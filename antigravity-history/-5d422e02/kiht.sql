-- ============================================
-- 001_initial_schema.sql
-- Escuela de Tenis — Core Tables
-- ============================================

-- Enable extensions needed for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================
-- Trigger function: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Table: profiles
-- ============================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('admin', 'coach', 'student')),
  rut           TEXT UNIQUE,
  birth_date    DATE,
  address       TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: courts
-- ============================================
CREATE TABLE public.courts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  surface     TEXT NOT NULL DEFAULT 'clay'
                CHECK (surface IN ('clay', 'hard', 'grass', 'carpet')),
  is_indoor   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Table: class_categories
-- ============================================
CREATE TABLE public.class_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  level       INTEGER NOT NULL DEFAULT 1,
  color       TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Table: classes
-- ============================================
CREATE TABLE public.classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  coach_id        UUID NOT NULL REFERENCES public.profiles(id),
  court_id        UUID NOT NULL REFERENCES public.courts(id),
  category_id     UUID REFERENCES public.class_categories(id),

  -- Schedule
  start_datetime  TIMESTAMPTZ NOT NULL,
  end_datetime    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (end_datetime - start_datetime)) / 60) STORED,

  -- Recurrence (deferred to v1.1)
  is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT,
  recurrence_end_date DATE,
  parent_class_id UUID REFERENCES public.classes(id),

  -- Capacity and pricing
  max_students    INTEGER NOT NULL DEFAULT 6,
  price           DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'CLP',

  -- Status
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  cancellation_reason TEXT,

  -- Metadata
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: end must be after start
  CONSTRAINT classes_valid_time CHECK (end_datetime > start_datetime)
);

-- Anti-overlap constraint per court (only for scheduled/in_progress)
ALTER TABLE public.classes
ADD CONSTRAINT classes_no_overlap_per_court
EXCLUDE USING gist (
  court_id WITH =,
  tstzrange(start_datetime, end_datetime, '[)') WITH &&
)
WHERE (status IN ('scheduled', 'in_progress'));

CREATE INDEX idx_classes_start_datetime ON public.classes(start_datetime);
CREATE INDEX idx_classes_coach_id ON public.classes(coach_id);
CREATE INDEX idx_classes_status ON public.classes(status);
CREATE INDEX idx_classes_court_id ON public.classes(court_id);

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: enrollments
-- ============================================
CREATE TABLE public.enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.profiles(id),

  status        TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'waitlist')),

  attendance    TEXT DEFAULT NULL
                  CHECK (attendance IN ('present', 'absent', 'late', 'excused')),
  attended_at   TIMESTAMPTZ,

  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  enrolled_by   UUID REFERENCES public.profiles(id),

  UNIQUE (class_id, student_id)
);

CREATE INDEX idx_enrollments_class_id ON public.enrollments(class_id);
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_status ON public.enrollments(status);

-- ============================================
-- Table: payment_plans
-- ============================================
CREATE TABLE public.payment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  classes_count   INTEGER NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'CLP',
  validity_days   INTEGER NOT NULL DEFAULT 30,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Table: payments
-- ============================================
CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id),
  class_id        UUID REFERENCES public.classes(id),
  plan_id         UUID REFERENCES public.payment_plans(id),
  enrollment_id   UUID REFERENCES public.enrollments(id),

  amount          DECIMAL(10,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'CLP',
  discount        DECIMAL(10,2) DEFAULT 0,
  final_amount    DECIMAL(10,2) GENERATED ALWAYS AS (amount - COALESCE(discount, 0)) STORED,

  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'overdue', 'refunded', 'cancelled')),

  payment_method  TEXT CHECK (payment_method IN ('cash', 'transfer', 'card', 'other')),
  payment_reference TEXT,

  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,

  description     TEXT,
  notes           TEXT,

  registered_by   UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_student_id ON public.payments(student_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: notifications
-- ============================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL
                CHECK (type IN ('class_reminder', 'payment_due', 'class_cancelled',
                                'enrollment_confirmed', 'class_updated', 'general')),
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- ============================================
-- Table: class_reschedules (rain/force majeure)
-- ============================================
CREATE TABLE public.class_reschedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  replacement_class_id  UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  reason                TEXT NOT NULL,
  rescheduled_by        UUID NOT NULL REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (original_class_id),
  UNIQUE (replacement_class_id)
);

CREATE INDEX idx_class_reschedules_original ON public.class_reschedules(original_class_id);

-- ============================================
-- Table: student_credits (v1.1 — structure only)
-- ============================================
CREATE TABLE public.student_credits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount            DECIMAL(10,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'CLP',
  reason            TEXT NOT NULL,
  related_payment_id UUID REFERENCES public.payments(id),
  related_class_id   UUID REFERENCES public.classes(id),
  expires_at         DATE,
  created_by         UUID REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_credits_student ON public.student_credits(student_id);
