import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BD0IZFgURrjaMSRDH8ZNlR5PTzf0g1E9OFbzKufouZpW8JTxcCxjBQjyJM48e1cTMuW8ptW6_xumtR88xm5e8J0'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '2GvmHTVdejSfAMK7mtYYx19VWR7byTZfwGqcAKjy1fY'
const VAPID_SUBJECT = 'mailto:info@motorcum.com'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://okmamrrpoezghjrwfism.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aBRHI5YeeGtRnyN0f92rkw_IC4XgOJg'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { baslik, mesaj, url, hedefRoller, olayTipi, isEmriId } = req.body || {}

    if (!baslik || !mesaj) {
      return res.status(400).json({ error: 'Başlık ve mesaj zorunludur.' })
    }

    let aktifRoller = null

    // Olay tipi belirtilmişse Supabase'den aktiflik ve hedef rolleri al
    if (olayTipi) {
      const { data: sablon } = await supabase
        .from('bildirim_sablonlari')
        .select('*')
        .eq('tip', 'yonetici')
        .eq('olay', olayTipi)
        .maybeSingle()

      if (sablon) {
        if (sablon.aktif === false) {
          return res.status(200).json({
            success: true,
            sentCount: 0,
            message: `Olay tipi (${olayTipi}) ayarlardan pasif yapıldığı için bildirim gönderilmedi.`
          })
        }

        try {
          if (sablon.konu && typeof sablon.konu === 'string' && sablon.konu.startsWith('{')) {
            const parsed = JSON.parse(sablon.konu)
            if (Array.isArray(parsed.roller) && parsed.roller.length > 0) {
              aktifRoller = parsed.roller
            }
          }
        } catch (_) {}
      }
    }

    // Hedef roller: Öncelikle şablonda seçili roller, yoksa istekten gelen roller, yoksa varsayılan admin/yönetici
    const sonHedefRoller = (aktifRoller && aktifRoller.length > 0)
      ? aktifRoller
      : (Array.isArray(hedefRoller) && hedefRoller.length > 0 ? hedefRoller : ['admin', 'yönetici'])

    // 1. Veritabanından kayıtlı tüm mobil push aboneliklerini çek
    const { data: abonelikler, error: dbErr } = await supabase
      .from('push_abonelikleri')
      .select('*')

    if (dbErr || !abonelikler || abonelikler.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'Kayıtlı mobil push abonesi bulunamadı veya tablo henüz boş.'
      })
    }

    // 2. Rol filtrelemesi & YALNIZCA MOBİL CİHAZ FİLTRESİ (PC / Masaüstü cihazlara bildirim gitmez)
    const norm = (s) => (s || '').toLowerCase().replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').trim()
    const hedefRollerNorm = sonHedefRoller.map(norm)

    const gonderilecekAboneler = abonelikler.filter((abone) => {
      // Masaüstü Windows PC abonelerini engelle (yalnızca mobil telefonlar)
      const ua = (abone.user_agent || '').toLowerCase()
      if (ua.includes('windows nt')) return false

      const r = norm(abone.rol)
      if (!r) return false

      // Kesin rol eşleşmesi: Yalnızca ayarlarda seçili rollerdeki telefonlara bildirim gider
      return hedefRollerNorm.some(hedef => {
        if (hedef === r) return true
        if (hedef.includes('yonetici') && r.includes('yonetici')) return true
        return false
      })
    })

    if (gonderilecekAboneler.length === 0) {
      return res.status(200).json({ success: true, sentCount: 0, message: 'Hedef rollere uygun abone yok.' })
    }

    // 3. Apple ve Google Push sunucularına bildirim paketini gönder
    const tag = isEmriId ? `is-${isEmriId}` : `bildirim-${olayTipi || 'genel'}`
    const notificationPayload = JSON.stringify({
      title: baslik,
      body: mesaj,
      url: url || '/dashboard',
      tag,
      isEmriId,
      timestamp: Date.now()
    })

    let sentCount = 0
    const silinecekler = []

    await Promise.all(
      gonderilecekAboneler.map(async (abone) => {
        const pushSubscription = {
          endpoint: abone.endpoint,
          keys: {
            p256dh: abone.p256dh,
            auth: abone.auth
          }
        }

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload, {
            urgency: 'high',
            TTL: 60 * 60 * 24 // 24 saat geçerli
          })
          sentCount++
        } catch (pushErr) {
          // 410 (Gone) veya 404 (Not Found): Kullanıcı bildirim iznini kapatmış veya PWA'yı silmiş
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            silinecekler.push(abone.endpoint)
          } else {
            console.warn('Push gönderim hatası:', pushErr.statusCode, pushErr.message)
          }
        }
      })
    )

    // Eski / geçersiz abonelikleri temizle
    if (silinecekler.length > 0) {
      await supabase.from('push_abonelikleri').delete().in('endpoint', silinecekler)
    }

    return res.status(200).json({ success: true, sentCount })
  } catch (err) {
    console.error('push-send handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
