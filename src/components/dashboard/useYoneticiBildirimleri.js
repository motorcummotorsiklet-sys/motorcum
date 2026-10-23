import { useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import { bildirimGonder, bildirimSesiCal, yerTutucuDoldur } from '../../utils/pwaBildirim'

const VARSAYILAN_AYARLAR = {
  is_emri_olusturuldu: {
    aktif: true,
    baslik: '🔧 Yeni İş Emri: {arac_plaka}',
    icerik: '#{is_emri_no} nolu araç servise alındı. Müşteri: {musteri_adi}',
    roller: ['admin', 'yönetici'],
    ses: true,
  },
  is_emri_tamamlandi: {
    aktif: true,
    baslik: '✅ Servis Tamamlandı: {arac_plaka}',
    icerik: '#{is_emri_no} nolu araç hazır. Toplam: {tutar}',
    roller: ['admin', 'yönetici'],
    ses: true,
  },
  odeme_alindi: {
    aktif: true,
    baslik: '💰 Ödeme Alındı: {tutar}',
    icerik: '{arac_plaka} plakalı iş emri #{is_emri_no} için ödeme kaydedildi.',
    roller: ['admin', 'yönetici'],
    ses: true,
  },
}

export const useYoneticiBildirimleri = (profile) => {
  const ayarlarRef = useRef(VARSAYILAN_AYARLAR)
  const sonBildirilenlerRef = useRef(new Set())

  // Ayarları veritabanından çek ve güncel tut
  const ayarlarYukle = async () => {
    try {
      const { data } = await supabase
        .from('bildirim_sablonlari')
        .select('*')
        .eq('tip', 'yonetici')

      if (data && data.length > 0) {
        const yeniAyarlar = { ...VARSAYILAN_AYARLAR }
        for (const row of data) {
          let baslik = yeniAyarlar[row.olay]?.baslik || ''
          let roller = yeniAyarlar[row.olay]?.roller || ['admin', 'yönetici']
          let ses = true

          try {
            if (row.konu && row.konu.startsWith('{')) {
              const parsed = JSON.parse(row.konu)
              if (parsed.baslik) baslik = parsed.baslik
              if (Array.isArray(parsed.roller)) roller = parsed.roller
              if (typeof parsed.ses === 'boolean') ses = parsed.ses
            } else if (row.konu) {
              baslik = row.konu
            }
          } catch {}

          yeniAyarlar[row.olay] = {
            aktif: row.aktif ?? true,
            baslik,
            icerik: row.icerik || yeniAyarlar[row.olay]?.icerik || '',
            roller,
            ses,
          }
        }
        ayarlarRef.current = yeniAyarlar
      }
    } catch (e) {
      console.warn('Yönetici bildirim ayarları yüklenemedi:', e)
    }
  }

  useEffect(() => {
    if (!profile?.rol) return

    ayarlarYukle()

    // Olayı işle ve bildirim gönder
    const bildirimiIsle = async (olayTipi, isEmriData) => {
      const ayar = ayarlarRef.current[olayTipi]
      if (!ayar || !ayar.aktif) return

      // Rol kontrolü: Kullanıcının rolü bu bildirimin hedef rollerinde var mı?
      const kullaniciRolu = (profile.rol || '').toLowerCase().trim()
      const hedefRoller = (ayar.roller || []).map(r => r.toLowerCase().trim())
      if (!hedefRoller.includes(kullaniciRolu)) return

      // Araç ve müşteri detaylarını çek
      let musteriAdi = 'Müşteri'
      let aracPlaka = 'Araç'
      let aracMarkaModel = ''
      let isEmriNo = isEmriData.is_emri_no || ''
      let tutar = isEmriData.toplam_tutar || 0

      try {
        const { data: detay } = await supabase
          .from('is_emirleri')
          .select('is_emri_no, toplam_tutar, musteriler(ad, soyad), araclar(plaka, marka, model)')
          .eq('id', isEmriData.id)
          .maybeSingle()

        if (detay) {
          if (detay.is_emri_no) isEmriNo = detay.is_emri_no
          if (detay.toplam_tutar) tutar = detay.toplam_tutar
          if (detay.musteriler) {
            musteriAdi = `${detay.musteriler.ad || ''} ${detay.musteriler.soyad || ''}`.trim() || musteriAdi
          }
          if (detay.araclar) {
            aracPlaka = detay.araclar.plaka || aracPlaka
            aracMarkaModel = `${detay.araclar.marka || ''} ${detay.araclar.model || ''}`.trim()
          }
        }
      } catch (e) {
        console.warn('Bildirim detay çekme hatası:', e)
      }

      const veri = {
        musteri_adi: musteriAdi,
        arac_plaka: aracPlaka,
        arac_marka_model: aracMarkaModel,
        is_emri_no: isEmriNo,
        tutar: tutar,
      }

      const baslik = yerTutucuDoldur(ayar.baslik, veri)
      const mesaj = yerTutucuDoldur(ayar.icerik, veri)

      // Sesli uyarı
      if (ayar.ses) {
        bildirimSesiCal()
      }

      // Telefon / PWA bildirimi
      await bildirimGonder(baslik, mesaj, '/dashboard')
    }

    // Supabase Realtime kanalı ile iş emirlerini anlık dinle
    const channel = supabase
      .channel('motorcum-yonetici-bildirimleri')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'is_emirleri' },
        async (payload) => {
          if (!payload.new || !payload.new.id) return
          const isId = payload.new.id

          if (payload.eventType === 'INSERT') {
            const anahtar = `${isId}:olusturuldu`
            if (!sonBildirilenlerRef.current.has(anahtar)) {
              sonBildirilenlerRef.current.add(anahtar)
              await bildirimiIsle('is_emri_olusturuldu', payload.new)
            }
          } else if (payload.eventType === 'UPDATE') {
            // İş tamamlandı kontrolü
            if (payload.new.durum === 'tamamlandi') {
              const anahtar = `${isId}:tamamlandi`
              if (!sonBildirilenlerRef.current.has(anahtar)) {
                sonBildirilenlerRef.current.add(anahtar)
                await bildirimiIsle('is_emri_tamamlandi', payload.new)
              }
            }

            // Ödeme alındı kontrolü
            if (['odendi', 'kismi'].includes(payload.new.odeme_durumu)) {
              const anahtar = `${isId}:odeme:${payload.new.odeme_durumu}:${payload.new.odenen_tutar || payload.new.toplam_tutar}`
              if (!sonBildirilenlerRef.current.has(anahtar)) {
                sonBildirilenlerRef.current.add(anahtar)
                await bildirimiIsle('odeme_alindi', payload.new)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.rol])
}
