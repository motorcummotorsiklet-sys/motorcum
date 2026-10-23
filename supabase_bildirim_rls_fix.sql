-- =====================================================
-- MOTORCUM — Bildirim & Push Yetkilendirme Scripti
-- Supabase Dashboard > SQL Editor kısmında çalıştırın
-- =====================================================

-- 1. Bildirim şablonları tablosu izinleri
ALTER TABLE bildirim_sablonlari DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE bildirim_sablonlari TO anon, authenticated, service_role;

-- 2. Dükkan entegrasyonları tablosu izinleri
ALTER TABLE dukkan_entegrasyonlari DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE dukkan_entegrasyonlari TO anon, authenticated, service_role;

-- 3. Push abonelikleri tablosu
CREATE TABLE IF NOT EXISTS push_abonelikleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  rol TEXT,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS'yi tamamen kapat ve anonim/giriş yapmış tüm istemcilere tam yazma izni ver
ALTER TABLE push_abonelikleri DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE push_abonelikleri TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "push_abonelikleri_herkese_acik" ON push_abonelikleri;
CREATE POLICY "push_abonelikleri_herkese_acik" ON push_abonelikleri
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);
