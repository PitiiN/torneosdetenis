INSERT INTO public.products (id, key, name, description, branding) VALUES
  ('11111111-1111-1111-1111-111111111111', 'father_mother_cup', 'Father & Mother Cup', 'Torneo de padres y madres', '{"primaryColor": "#00A3E0"}'),
  ('22222222-2222-2222-2222-222222222222', 'copa_f2_kids', 'Copa F2 Kids', 'Torneo infantil', '{"primaryColor": "#00A3E0"}'),
  ('33333333-3333-3333-3333-333333333333', 'americanos_padel', 'Americanos de Pádel', 'Torneos americanos de pádel', '{"primaryColor": "#00A3E0"}'),
  ('44444444-4444-4444-4444-444444444444', 'liga_verbo_divino', 'Liga Verbo Divino', 'Liga de ex alumnos', '{"primaryColor": "#00A3E0"}'),
  ('55555555-5555-5555-5555-555555555555', 'liga_ex_tabancura', 'Liga Ex Tabancura', 'Liga de ex alumnos', '{"primaryColor": "#00A3E0"}'),
  ('66666666-6666-6666-6666-666666666666', 'liga_el_polo', 'Liga El Polo', 'Liga polo', '{"primaryColor": "#00A3E0"}'),
  ('77777777-7777-7777-7777-777777777777', 'liga_everest', 'Liga Everest', 'Liga everest', '{"primaryColor": "#00A3E0"}')
ON CONFLICT (id) DO NOTHING;
