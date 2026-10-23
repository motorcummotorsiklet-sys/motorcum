// PWA & Web Bildirim Yardımcı Modülü

// Sesli uyarı: Web Audio API ile harici dosya indirmeden temiz 2 tonlu melodi çalar
export const bildirimSesiCal = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // İki tonlu hoş servis melodisi (Mi5 -> La5)
    osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12) // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch (err) {
    // Ses engellenmişse hata fırlatmaz
  }
}

// Sistem / Telefon Bildirimi Gönderme (PWA destekli)
export const bildirimGonder = async (baslik, mesaj, url = '/dashboard') => {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  const options = {
    body: mesaj,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
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
  const harita = {
    '{musteri_adi}': veri.musteri_adi || 'Müşteri',
    '{arac_plaka}': veri.arac_plaka || 'Plaka',
    '{arac_marka_model}': veri.arac_marka_model || 'Araç',
    '{tutar}': veri.tutar ? `₺${parseFloat(veri.tutar).toLocaleString('tr-TR')}` : '₺0',
    '{is_emri_no}': veri.is_emri_no ? `#${veri.is_emri_no}` : '',
    '{dukkan_adi}': veri.dukkan_adi || 'MOTORCUM Servis',
    '{dukkan_telefon}': veri.dukkan_telefon || '',
  }

  let sonuc = sablon
  for (const [key, val] of Object.entries(harita)) {
    sonuc = sonuc.replaceAll(key, val)
  }
  return sonuc
}
