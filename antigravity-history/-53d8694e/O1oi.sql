-- ============================================
-- 007_reviews_and_avatars.sql
-- Escuela de Tenis — Reviews + Storage
-- ============================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  is_read BOOLEAN DEFAULT FALSE,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_student ON reviews(student_id);
CREATE INDEX idx_reviews_read ON reviews(is_read);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_view_own_reviews" ON reviews FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "students_insert_reviews" ON reviews FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "admins_view_all_reviews" ON reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admins_update_reviews" ON reviews FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "authenticated_upload_avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "public_read_avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "authenticated_update_avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
