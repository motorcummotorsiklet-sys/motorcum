// Web Push Abonelik ve Gönderim Yönetimi
import { isMobilCihaz } from './pwaBildirim'

export const VAPID_PUBLIC_KEY = 'BD0IZFgURrjaMSRDH8ZNlR5PTzf0g1E9OFbzKufouZpW8JTxcCxjBQjyJM48e1cTMuW8ptW6_xumtR88xm5e8J0'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Cihazı Apple / Google Web Push servisine kaydeder (YALNIZCA MOBİL CİHAZLAR)
export const webPushAboneOl = async (profile) => {
  if (typeof window === 'undefined') return { success: false, reason: 'no_window' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, reason: 'unsupported' }
  }

  // PC / Masaüstü cihazları kaydetme; varsa önceden kalan aboneliği kaldır
  if (!isMobilCihaz()) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
      }
    } catch {}
    return { success: false, reason: 'desktop_skipped' }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, reason: 'permission_denied' }
    }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    // Backend'e aboneliği kaydet
    const res = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub,
        user_id: profile?.id || null,
        rol: profile?.rol || 'admin',
        userAgent: navigator.userAgent
      })
    })

    const data = await res.json()
    return { success: true, sub, data }
  } catch (err) {
    console.warn('Web push abone olma hatası:', err)
    return { success: false, error: err.message }
  }
}

// Kilitli / arka plandaki telefonlara Web Push fırlatır
export const webPushTetikle = async ({ baslik, mesaj, url = '/dashboard', hedefRoller = [] }) => {
  try {
    const res = await fetch('/api/push-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baslik,
        mesaj,
        url,
        hedefRoller
      })
    })
    return await res.json()
  } catch (err) {
    console.warn('Web push tetikleme hatası:', err)
    return { success: false, error: err.message }
  }
}
