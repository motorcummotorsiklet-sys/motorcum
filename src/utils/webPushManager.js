// Web Push Abonelik ve Gönderim Yönetimi
import { supabase } from '../supabaseClient'
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
    let permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
    if (permission !== 'granted') {
      try {
        permission = await Notification.requestPermission()
      } catch (e) {
        console.warn('İzin isteme uyarısı:', e)
      }
    }

    if (permission !== 'granted') {
      return { success: false, reason: 'permission_' + permission }
    }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    // Anahtarları ayıkla
    const subJson = sub.toJSON ? sub.toJSON() : {}
    const endpoint = sub.endpoint
    let p256dh = subJson.keys?.p256dh || ''
    let auth = subJson.keys?.auth || ''

    if (!p256dh && sub.getKey) {
      try {
        const raw = sub.getKey('p256dh')
        if (raw) p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(raw)))
      } catch {}
    }
    if (!auth && sub.getKey) {
      try {
        const raw = sub.getKey('auth')
        if (raw) auth = btoa(String.fromCharCode.apply(null, new Uint8Array(raw)))
      } catch {}
    }

    const rol = (profile?.rol || 'admin').toLowerCase().trim()
    const userAgent = navigator.userAgent || 'mobile'

    let sbError = null
    // 1. İstemciden doğrudan Supabase veritabanına yaz (En hızlı ve garantili yol)
    if (endpoint && p256dh && auth) {
      try {
        const { error } = await supabase.from('push_abonelikleri').upsert({
          endpoint,
          p256dh,
          auth,
          user_id: profile?.id || null,
          rol,
          user_agent: userAgent,
          updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' })
        if (error) sbError = error.message
      } catch (sbErr) {
        sbError = sbErr.message
        console.warn('Supabase istemci kayıt uyarısı:', sbErr)
      }
    }

    // 2. Yedek olarak Vercel API'ye de bildir
    let apiWarning = null
    try {
      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          user_id: profile?.id || null,
          rol,
          userAgent
        })
      })
      const apiData = await res.json()
      if (apiData && !apiData.success && apiData.warning) {
        apiWarning = apiData.warning
      }
    } catch {}

    if (apiWarning || sbError) {
      return { success: false, warning: apiWarning || sbError }
    }

    return { success: true, sub }
  } catch (err) {
    console.warn('Web push abone olma hatası:', err)
    return { success: false, error: err.message }
  }
}

// Kilitli / arka plandaki telefonlara Web Push fırlatır
export const webPushTetikle = async ({ baslik, mesaj, url = '/dashboard', hedefRoller = [], olayTipi = null }) => {
  try {
    const res = await fetch('/api/push-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baslik,
        mesaj,
        url,
        hedefRoller,
        olayTipi
      })
    })
    return await res.json()
  } catch (err) {
    console.warn('Web push tetikleme hatası:', err)
    return { success: false, error: err.message }
  }
}
