// PWA & Web Bildirim Yardımcı Modülü
import { supabase } from '../supabaseClient'
import { webPushTetikle } from './webPushManager'

export const DURUMLAR_TR = {
  bekliyor: 'Bekliyor',
  devam_ediyor: 'Devam Ediyor',
  tamamlandi: 'Tamamlandı',
  teslim_edildi: 'Teslim Edildi',
  iptal: 'İptal',
}

// Mobil cihaz tespiti (PC / Masaüstü ortamında bildirim çıkmaması için)
export const isMobilCihaz = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase()
  
  // Kesin mobil işletim sistemleri
  const mobilRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i
  if (mobilRegex.test(ua)) return true

  // iPadOS veya dokunmatik mobil cihazlar (Windows hariç)
  if (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && !ua.includes('windows nt')) {
    return true
  }

  return false
}

// Türkçe karakterleri normalize eden fonksiyon (rol karşılaştırması için)
export const normalizeRol = (r) => {
  if (!r) return ''
  return r
    .toString()
    .toLowerCase()
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .trim()
}

// Sesli uyarı: Web Audio API ile harici dosya indirmeden temiz 2 tonlu melodi çalar
export const bildirimSesiCal = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // İki tonlu hoş servis melodisi (Mi5 -> La5)
    osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12) // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch (err) {
    // Ses engellenmişse hata fırlatmaz
  }
}

// Sistem / Telefon Bildirimi Gönderme (YALNIZCA MOBİL CİHAZLARDA ÇALIŞIR - PC'DE SAĞ ALTTA BİLDİRİM ÇIKMAZ)
export const bildirimGonder = async (baslik, mesaj, url = '/dashboard') => {
  if (typeof window === 'undefined') return false

  // PC / Masaüstü ortamında bildirim gösterilmez, sadece mobil
  if (!isMobilCihaz()) {
    return false
  }

  // Web Notification izni yoksa bile çalışır vaziyette tut
  if (!('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  const options = {
    body: mesaj,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [250, 100, 250],
    tag: 'motorcum-' + Date.now(),
    renotify: true,
    data: { url: url || '/dashboard' }
  }

  // 1. Öncelik: Service Worker ile gönder (PWA telefonlarda kilit ekranına düşer)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        await reg.showNotification(baslik, options)
        return true
      }
    } catch (e) {
      console.warn('SW bildirim hatası:', e)
    }
  }

  // 2. Yedek: Standart tarayıcı bildirimi
  try {
    new Notification(baslik, options)
    return true
  } catch (e) {
    console.warn('Standart bildirim hatası:', e)
  }
  return false
}

// Şablon yer tutucularını gerçek verilerle doldurur
export const yerTutucuDoldur = (sablon, veri = {}) => {
  if (!sablon) return ''
  const personelAdi = veri.personel_adi || veri.personelAdi || veri.ustaAdi || veri.personel || ''
  const harita = {
    '{musteri_adi}': veri.musteri_adi || veri.musteriAdi || 'Müşteri',
    '{personel_adi}': personelAdi || 'Personel',
    '{personel_ad_soyad}': personelAdi || 'Personel',
    '{arac_plaka}': veri.arac_plaka || veri.plaka || 'Plaka',
    '{arac_marka_model}': veri.arac_marka_model || veri.markaModel || 'Araç',
    '{durum}': DURUMLAR_TR[veri.durum] || veri.durum || 'Güncellendi',
    '{tutar}': veri.tutar ? `₺${parseFloat(veri.tutar).toLocaleString('tr-TR')}` : '₺0',
    '{is_emri_no}': veri.is_emri_no || veri.isEmriNo ? `#${veri.is_emri_no || veri.isEmriNo}` : '',
    '{dukkan_adi}': veri.dukkan_adi || 'MOTORCUM Servis',
    '{dukkan_telefon}': veri.dukkan_telefon || '',
  }

  let sonuc = sablon
  for (const [key, val] of Object.entries(harita)) {
    sonuc = sonuc.replaceAll(key, val)
  }
  return sonuc
}

// PC veya mobilde bir iş emri eylemi gerçekleştiğinde hem ekrandaki cihazlara hem de tuş kilitli telefonlara bildirim gönderir
export const broadcastYoneticiBildirimi = async (olayData) => {
  const olayTipi = olayData?.olayTipi
  if (!olayTipi) return

  // 1. Ayarları Supabase veya LocalStorage'dan al
  let ayar = null
  try {
    const local = localStorage.getItem('motorcum_yonetici_bildirimleri')
    if (local) {
      const parsed = JSON.parse(local)
      if (parsed[olayTipi]) ayar = parsed[olayTipi]
    }
  } catch {}

  // Local'de yoksa veya en güncelini teyit etmek için Supabase'den çek
  try {
    const { data: sablon } = await supabase
      .from('bildirim_sablonlari')
      .select('*')
      .eq('tip', 'yonetici')
      .eq('olay', olayTipi)
      .maybeSingle()

    if (sablon) {
      let baslik = ''
      let roller = ['admin', 'yönetici']
      let ses = true
      try {
        if (sablon.konu && sablon.konu.startsWith('{')) {
          const parsed = JSON.parse(sablon.konu)
          baslik = parsed.baslik || ''
          roller = parsed.roller || roller
          ses = typeof parsed.ses === 'boolean' ? parsed.ses : true
        } else if (sablon.konu) {
          baslik = sablon.konu
        }
      } catch {}

      ayar = {
        aktif: sablon.aktif ?? true,
        baslik: baslik || ayar?.baslik,
        icerik: sablon.icerik || ayar?.icerik,
        roller: Array.isArray(roller) ? roller : ['admin'],
        ses
      }
    }
  } catch (err) {
    console.warn('Şablon kontrol hatası:', err)
  }

  // EĞER BU BİLDİRİM ADIMI AYARLARDAN PASİF YAPILMIŞSA KESİNLİKLE BİLDİRİM GÖNDERME!
  if (ayar && ayar.aktif === false) {
    console.log(`Bildirim adımı (${olayTipi}) kullanıcı tarafından pasif yapılmış, gönderilmedi.`)
    return
  }

  const hedefRoller = (ayar?.roller && ayar.roller.length > 0) ? ayar.roller : (olayData.roller || ['admin'])

  // Şablondaki başlık ve içeriği yer tutucularla doldur (kullanıcının özelleştirdiği şablonu uygula)
  let sablonBaslik = ayar?.baslik || olayData.baslik
  let sablonIcerik = ayar?.icerik || olayData.mesaj

  if (!sablonBaslik) {
    if (olayTipi === 'is_emri_olusturuldu') {
      sablonBaslik = `🔧 Yeni İş Emri: {arac_plaka}`
      sablonIcerik = `#{is_emri_no} nolu araç servise alındı. Müşteri: {musteri_adi}`
    } else if (olayTipi === 'is_emri_tamamlandi') {
      sablonBaslik = `✅ Servis Tamamlandı: {arac_plaka}`
      sablonIcerik = `#{is_emri_no} nolu araç teslime hazır. Toplam: {tutar}`
    } else if (olayTipi === 'odeme_alindi') {
      sablonBaslik = `💰 Ödeme Alındı: {tutar}`
      sablonIcerik = `{arac_plaka} plakalı iş emri #{is_emri_no} için ödeme kaydedildi.`
    } else {
      sablonBaslik = `🔄 Statü Değişti: {arac_plaka}`
      sablonIcerik = `#{is_emri_no} nolu aracın durumu: {durum}. Müşteri: {musteri_adi}`
    }
  }

  const sonBaslik = yerTutucuDoldur(sablonBaslik, olayData)
  const sonMesaj = yerTutucuDoldur(sablonIcerik, olayData)

  // 1. Ekranı açık / bağlı cihazlara anlık WebSocket ile ilet
  try {
    const channel = supabase.channel('motorcum-yonetici-bildirimleri')
    if (channel.state !== 'joined') {
      await channel.subscribe()
    }
    await channel.send({
      type: 'broadcast',
      event: 'is_emri_olay',
      payload: {
        ...olayData,
        baslik: sonBaslik,
        mesaj: sonMesaj,
        roller: hedefRoller,
        timestamp: Date.now()
      }
    })
  } catch (err) {
    console.warn('Yönetici bildirim broadcast hatası:', err)
  }

  // 2. Tuş kilitli / arka plandaki telefonlara resmi Apple/Google Web Push ile kilit ekranı uyarısı gönder
  try {
    await webPushTetikle({
      baslik: sonBaslik,
      mesaj: sonMesaj,
      url: '/dashboard',
      hedefRoller,
      olayTipi
    })
  } catch (err) {
    console.warn('Web push gönderim hatası:', err)
  }
}

// Bildirim ayarları kaydedildiğinde tüm cihazların ayarını senkronize eder
export const broadcastAyarlarGuncellendi = async (yeniAyarlar) => {
  try {
    const channel = supabase.channel('motorcum-yonetici-bildirimleri')
    if (channel.state !== 'joined') {
      await channel.subscribe()
    }
    await channel.send({
      type: 'broadcast',
      event: 'ayarlar_guncellendi',
      payload: {
        ayarlar: yeniAyarlar,
        timestamp: Date.now()
      }
    })
  } catch (err) {
    console.warn('Ayar senkronizasyon broadcast hatası:', err)
  }
}
