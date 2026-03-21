-- ============================================
-- 004_seed_data.sql
-- Escuela de Tenis — Initial Data
-- ============================================

-- Class categories
INSERT INTO public.class_categories (name, level, color, description) VALUES
  ('Iniciación', 1, '#22C55E', 'Para personas que nunca han jugado tenis'),
  ('Básico', 2, '#3B82F6', 'Fundamentos del tenis'),
  ('Intermedio', 3, '#F59E0B', 'Mejora técnica y táctica'),
  ('Avanzado', 4, '#EF4444', 'Alto rendimiento competitivo'),
  ('Competición', 5, '#8B5CF6', 'Preparación para torneos');

-- Courts
INSERT INTO public.courts (name, surface, is_indoor, description) VALUES
  ('Cancha 1', 'clay', FALSE, 'Cancha principal de arcilla — exterior'),
  ('Cancha 2', 'clay', FALSE, 'Cancha secundaria de arcilla — exterior');

-- Payment plans
INSERT INTO public.payment_plans (name, description, classes_count, price, validity_days) VALUES
  ('Plan 4 clases', '4 clases al mes', 4, 60000, 30),
  ('Plan 8 clases', '8 clases al mes — el más popular', 8, 110000, 30),
  ('Plan 12 clases', '12 clases al mes — máximo progreso', 12, 150000, 30),
  ('Clase suelta', 'Una clase individual sin plan', 1, 18000, 7);
