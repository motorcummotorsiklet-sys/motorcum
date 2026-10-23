-- =====================================================
-- MOTORCUM — Bildirim Şablonları & Entegrasyonlar RLS İzni
-- Supabase Dashboard > SQL Editor kısmında çalıştırın
-- =====================================================

-- bildirim_sablonlari tablosunun yazma kısıtını kaldır
ALTER TABLE bildirim_sablonlari DISABLE ROW LEVEL SECURITY;

-- dukkan_entegrasyonlari tablosunun yazma kısıtını kaldır
ALTER TABLE dukkan_entegrasyonlari DISABLE ROW LEVEL SECURITY;
