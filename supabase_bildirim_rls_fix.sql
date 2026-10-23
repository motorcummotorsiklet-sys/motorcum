-- =====================================================
-- MOTORCUM — Bildirim Şablonları & Web Push RLS İzni
-- Supabase Dashboard > SQL Editor kısmında çalıştırın
-- =====================================================

-- 1. Bildirim şablonları tablosunun yazma kısıtını kaldır
ALTER TABLE bildirim_sablonlari DISABLE ROW LEVEL SECURITY;

-- 2. Dükkan entegrasyonları tablosunun yazma kısıtını kaldır
ALTER TABLE dukkan_entegrasyonlari DISABLE ROW LEVEL SECURITY;

-- 3. Kilitli / arka plandaki telefonlara Web Push bildirim tablosu
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

ALTER TABLE push_abonelikleri DISABLE ROW LEVEL SECURITY;
