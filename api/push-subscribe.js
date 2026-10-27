import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://okmamrrpoezghjrwfism.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aBRHI5YeeGtRnyN0f92rkw_IC4XgOJg'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { subscription, user_id, rol, userAgent } = req.body || {}

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Geçersiz abonelik verisi.' })
    }

    const endpoint = subscription.endpoint
    const p256dh = subscription.keys.p256dh
    const auth = subscription.keys.auth
    const uaString = userAgent || req.headers['user-agent'] || ''
    const lowUA = uaString.toLowerCase()

    // PC / Masaüstü ortamlarını aboneliğe ekleme (yalnızca mobil cihazlar)
    const isMasaustu = lowUA.includes('windows nt') || (lowUA.includes('macintosh') && !lowUA.includes('mobile')) || (lowUA.includes('x11') && !lowUA.includes('android'))
    if (isMasaustu) {
      // Varsa eski masaüstü kaydını da sil
      await supabase.from('push_abonelikleri').delete().eq('endpoint', endpoint)
      return res.status(200).json({ success: true, message: 'PC/Masaüstü aboneliği atlandı.' })
    }

    let finalRol = (rol || 'admin').toLowerCase().trim()
    if (user_id) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', user_id)
          .maybeSingle()
        if (prof?.rol) {
          finalRol = prof.rol.toLowerCase().trim()
        }
      } catch (_) {}
    }

    const payload = {
      endpoint,
      p256dh,
      auth,
      user_id: user_id || null,
      rol: finalRol,
      user_agent: uaString,
      updated_at: new Date().toISOString()
    }

    // push_abonelikleri tablosuna ekle / güncelle
    const { data, error } = await supabase
      .from('push_abonelikleri')
      .upsert(payload, { onConflict: 'endpoint' })
      .select()

    if (error) {
      console.warn('Push abonelik DB hatası:', error.message)
      return res.status(200).json({
        success: false,
        warning: 'Veritabanı tablosu henüz hazır değil veya RLS kısıtı var: ' + error.message,
        payload
      })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('push-subscribe error:', err)
    return res.status(500).json({ error: err.message })
  }
}
