import { useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import { bildirimGonder, bildirimSesiCal, yerTutucuDoldur, normalizeRol, isMobilCihaz } from '../../utils/pwaBildirim'
import { webPushAboneOl } from '../../utils/webPushManager'

const VARSAYILAN_AYARLAR = {
  is_emri_olusturuldu: {
    aktif: true,
    baslik: '🔧 Yeni İş Emri: {arac_plaka}',
    icerik: '#{is_emri_no} nolu araç servise alındı. Müşteri: {musteri_adi}',
    roller: ['admin', 'yönetici', 'usta', 'teknisyen'],
    ses: true,
  },
  is_emri_durum_degisti: {
    aktif: true,
    baslik: '🔄 Statü Değişti: {arac_plaka}',
    icerik: '#{is_emri_no} nolu aracın durumu: {durum}. Müşteri: {musteri_adi}',
    roller: ['admin', 'yönetici', 'usta', 'teknisyen'],
    ses: true,
  },
  is_emri_tamamlandi: {
    aktif: true,
    baslik: '✅ Servis Tamamlandı: {arac_plaka}',
    icerik: '#{is_emri_no} nolu araç teslime hazır. Toplam: {tutar}',
    roller: ['admin', 'yönetici', 'usta', 'teknisyen'],
    ses: true,
  },
  odeme_alindi: {
    aktif: true,
    baslik: '💰 Ödeme Alındı: {tutar}',
    icerik: '{arac_plaka} plakalı iş emri #{is_emri_no} için ödeme kaydedildi.',
    roller: ['admin', 'yönetici', 'usta', 'teknisyen'],
    ses: true,
  },
}

export const useYoneticiBildirimleri = (profile) => {
  const ayarlarRef = useRef(VARSAYILAN_AYARLAR)
  const sonBildirilenlerRef = useRef(new Set())
  const sonDurumlarRef = useRef(new Map())
  const ilkYuklemeBittiRef = useRef(false)

  // 1. Ayarları önce localStorage'dan, sonra Supabase'den yükle
  const ayarlarYukle = async () => {
    // A) LocalStorage
    try {
      const local = localStorage.getItem('motorcum_yonetici_bildirimleri')
      if (local) {
        const parsed = JSON.parse(local)
        ayarlarRef.current = { ...VARSAYILAN_AYARLAR, ...parsed }
      }
    } catch {}

    // B) Supabase veritabanı
    try {
      const { data } = await supabase
        .from('bildirim_sablonlari')
        .select('*')
        .eq('tip', 'yonetici')

      if (data && data.length > 0) {
        const yeniAyarlar = { ...ayarlarRef.current }
        for (const row of data) {
          let baslik = yeniAyarlar[row.olay]?.baslik || ''
          let roller = yeniAyarlar[row.olay]?.roller || ['admin', 'yönetici', 'usta', 'teknisyen']
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
        try {
          localStorage.setItem('motorcum_yonetici_bildirimleri', JSON.stringify(yeniAyarlar))
        } catch {}
      }
    } catch (e) {
      console.warn('Yönetici bildirim ayarları yüklenemedi:', e)
    }
  }

  useEffect(() => {
    if (!profile?.rol) return

    ayarlarYukle()

    // MOBİL CİHAZDA İZİN VERİLMİŞSE OTOMATİK OLARAK PUSH'A ABONE YAP
    if (isMobilCihaz() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      webPushAboneOl(profile).catch((e) => console.warn('Otomatik mobil push aboneliği:', e))
    }

    // Olayı işle ve cihaz bildirimini tetikle
    const bildirimiIsle = async (olayTipi, veri) => {
      // YALNIZCA MOBİL CİHAZLARDA ÇALIŞIR (PC versiyonda sağ altta bildirim çıkmaz)
      if (!isMobilCihaz()) return

      const ayar = ayarlarRef.current[olayTipi]
      if (!ayar || !ayar.aktif) return

      // Rol kontrolü: Kullanıcının rolü hedef rollerde var mı?
      const kullaniciRoluNorm = normalizeRol(profile.rol)
      const hedefRollerNorm = (ayar.roller || []).map(normalizeRol)

      // Eğer kullanıcı admin veya yöneticiyse veya rol listede varsa gönder
      const eslesme = hedefRollerNorm.includes(kullaniciRoluNorm) ||
        (kullaniciRoluNorm === 'admin') ||
        (kullaniciRoluNorm === 'yonetici' && hedefRollerNorm.some(r => r.includes('yonetici')))

      if (!eslesme) return

      const baslik = yerTutucuDoldur(ayar.baslik, veri)
      const mesaj = yerTutucuDoldur(ayar.icerik, veri)

      // 1. Sesli uyarı çal
      if (ayar.ses) {
        bildirimSesiCal()
      }

      // 2. Telefon / PWA sistem bildirimi gönder (Kilit ekranı ve bildirim çubuğu)
      await bildirimGonder(baslik, mesaj, '/dashboard')
    }

    // --- SUPABASE REALTIME KANALI (BROADCAST + POSTGRES_CHANGES) ---
    const channel = supabase.channel('motorcum-yonetici-bildirimleri')

    // 1. Broadcast Dinleyicisi (PC veya başka telefondan gelen anlık eylem sinyali)
    channel.on('broadcast', { event: 'is_emri_olay' }, async ({ payload }) => {
      if (!payload || !payload.olayTipi) return

      const anahtar = `${payload.isEmriId || 'yeni'}:${payload.olayTipi}:${payload.durum || ''}:${payload.timestamp || ''}`
      if (sonBildirilenlerRef.current.has(anahtar)) return
      sonBildirilenlerRef.current.add(anahtar)

      await bildirimiIsle(payload.olayTipi, payload)
    })

    // 2. Ayar Senkronizasyonu Dinleyicisi
    channel.on('broadcast', { event: 'ayarlar_guncellendi' }, ({ payload }) => {
      if (payload?.ayarlar) {
        ayarlarRef.current = { ...ayarlarRef.current, ...payload.ayarlar }
        try {
          localStorage.setItem('motorcum_yonetici_bildirimleri', JSON.stringify(ayarlarRef.current))
        } catch {}
      }
    })

    // 3. Postgres Changes Yedek Dinleyicisi
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'is_emirleri' },
      async (payload) => {
        if (!payload.new || !payload.new.id) return
        const isId = payload.new.id

        // Detayları çek
        let musteriAdi = 'Müşteri'
        let aracPlaka = 'Araç'
        let aracMarkaModel = ''
        let personelAdi = ''
        try {
          const { data: d } = await supabase
            .from('is_emirleri')
            .select('musteriler(ad,soyad), araclar(plaka,marka,model), personel(ad,soyad)')
            .eq('id', isId)
            .maybeSingle()
          if (d?.musteriler) musteriAdi = `${d.musteriler.ad || ''} ${d.musteriler.soyad || ''}`.trim()
          if (d?.araclar) {
            aracPlaka = d.araclar.plaka || aracPlaka
            aracMarkaModel = `${d.araclar.marka || ''} ${d.araclar.model || ''}`.trim()
          }
          if (d?.personel) {
            personelAdi = `${d.personel.ad || ''} ${d.personel.soyad || ''}`.trim()
          }
        } catch {}

        const ortakVeri = {
          isEmriId: isId,
          isEmriNo: payload.new.is_emri_no,
          durum: payload.new.durum,
          tutar: payload.new.toplam_tutar,
          musteriAdi,
          plaka: aracPlaka,
          markaModel: aracMarkaModel,
          personelAdi,
        }

        if (payload.eventType === 'INSERT') {
          const anahtar = `${isId}:olusturuldu`
          if (!sonBildirilenlerRef.current.has(anahtar)) {
            sonBildirilenlerRef.current.add(anahtar)
            await bildirimiIsle('is_emri_olusturuldu', ortakVeri)
          }
        } else if (payload.eventType === 'UPDATE') {
          const yeniDurum = payload.new.durum
          const anahtarDurum = `${isId}:durum:${yeniDurum}`
          if (!sonBildirilenlerRef.current.has(anahtarDurum)) {
            sonBildirilenlerRef.current.add(anahtarDurum)
            if (yeniDurum === 'tamamlandi') {
              await bildirimiIsle('is_emri_tamamlandi', ortakVeri)
            } else {
              await bildirimiIsle('is_emri_durum_degisti', ortakVeri)
            }
          }

          if (['odendi', 'kismi'].includes(payload.new.odeme_durumu)) {
            const anahtarOdeme = `${isId}:odeme:${payload.new.odeme_durumu}:${payload.new.odenen_tutar}`
            if (!sonBildirilenlerRef.current.has(anahtarOdeme)) {
              sonBildirilenlerRef.current.add(anahtarOdeme)
              await bildirimiIsle('odeme_alindi', ortakVeri)
            }
          }
        }
      }
    )

    channel.subscribe()

    // --- 4. PERİYODİK POLING (MOBİLDE WEBSOCKET KOPMALARINA KARŞI YEDEK KORUMA) ---
    // Her 6 saniyede son iş emirlerini kontrol eder
    const kontrolPeriyodu = setInterval(async () => {
      try {
        const { data: sonIsler } = await supabase
          .from('is_emirleri')
          .select('id, is_emri_no, durum, odeme_durumu, toplam_tutar, odenen_tutar, updated_at, musteriler(ad, soyad), araclar(plaka, marka, model), personel(ad, soyad)')
          .order('created_at', { ascending: false })
          .limit(10)

        if (!sonIsler || sonIsler.length === 0) return

        if (!ilkYuklemeBittiRef.current) {
          // İlk yüklemede mevcut durumları hafızaya al, bildirim fırlatma
          sonIsler.forEach(is => {
            sonDurumlarRef.current.set(is.id, { durum: is.durum, odeme: is.odeme_durumu })
          })
          ilkYuklemeBittiRef.current = true
          return
        }

        for (const is of sonIsler) {
          const onceki = sonDurumlarRef.current.get(is.id)
          const musteriAdi = is.musteriler ? `${is.musteriler.ad || ''} ${is.musteriler.soyad || ''}`.trim() : 'Müşteri'
          const plaka = is.araclar?.plaka || 'Plaka'
          const markaModel = is.araclar ? `${is.araclar.marka || ''} ${is.araclar.model || ''}`.trim() : ''
          const personelAdi = is.personel ? `${is.personel.ad || ''} ${is.personel.soyad || ''}`.trim() : ''

          const veri = {
            isEmriId: is.id,
            isEmriNo: is.is_emri_no,
            durum: is.durum,
            tutar: is.toplam_tutar,
            musteriAdi,
            plaka,
            markaModel,
            personelAdi,
          }

          // A) Yeni iş emri kontrolü (telefon kapalıyken veya uyurken oluşturulduysa)
          if (!onceki && ilkYuklemeBittiRef.current) {
            const anahtar = `${is.id}:olusturuldu`
            if (!sonBildirilenlerRef.current.has(anahtar)) {
              sonBildirilenlerRef.current.add(anahtar)
              await bildirimiIsle('is_emri_olusturuldu', veri)
            }
          } else if (onceki) {
            // B) Durum değişmiş mi?
            if (onceki.durum !== is.durum) {
              const anahtar = `${is.id}:durum:${is.durum}`
              if (!sonBildirilenlerRef.current.has(anahtar)) {
                sonBildirilenlerRef.current.add(anahtar)
                if (is.durum === 'tamamlandi') {
                  await bildirimiIsle('is_emri_tamamlandi', veri)
                } else {
                  await bildirimiIsle('is_emri_durum_degisti', veri)
                }
              }
            }

            // C) Ödeme durumu değişmiş mi?
            if (onceki.odeme !== is.odeme_durumu && ['odendi', 'kismi'].includes(is.odeme_durumu)) {
              const anahtar = `${is.id}:odeme:${is.odeme_durumu}:${is.odenen_tutar || is.toplam_tutar}`
              if (!sonBildirilenlerRef.current.has(anahtar)) {
                sonBildirilenlerRef.current.add(anahtar)
                await bildirimiIsle('odeme_alindi', veri)
              }
            }
          }

          // Durumu güncelle
          sonDurumlarRef.current.set(is.id, { durum: is.durum, odeme: is.odeme_durumu })
        }
      } catch (err) {
        // Sessiz hata
      }
    }, 6000)

    return () => {
      clearInterval(kontrolPeriyodu)
      supabase.removeChannel(channel)
    }
  }, [profile?.rol])
}
