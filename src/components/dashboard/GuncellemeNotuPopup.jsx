import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

const GuncellemeNotuPopup = () => {
  const { user, profile } = useAuth()
  const [okunmayanlar, setOkunmayanlar] = useState([])
  const [aktifIndex, setAktifIndex] = useState(0)
  const [gosteriliyor, setGosteriliyor] = useState(false)
  const [kapatiliyor, setKapatiliyor] = useState(false)

  useEffect(() => {
    if (!user || !profile) return
    fetchOkunmayanlar()
  }, [user, profile])

  const fetchOkunmayanlar = async () => {
    // Aktif notları çek
    const { data: tumNotlar } = await supabase
      .from('guncelleme_notlari')
      .select('*')
      .eq('aktif', true)
      .order('created_at', { ascending: false })

    if (!tumNotlar || tumNotlar.length === 0) return

    // Kullanıcının hangi notları gördüğünü çek
    const { data: gorulenler } = await supabase
      .from('kullanici_notlar_goruldu')
      .select('not_id')
      .eq('user_id', user.id)

    const gorulenIdler = new Set((gorulenler || []).map(g => g.not_id))

    // Kullanıcıya gösterilecek notları filtrele
    const userRol = profile?.rol || 'kullanici'
    const gosterilecek = tumNotlar.filter(not => {
      // Zaten gördüyse atla
      if (gorulenIdler.has(not.id)) return false

      // Hedef kontrolü
      const hedef = not.hedef_roller || ['hepsi']
      if (hedef.includes('hepsi')) return true
      if (hedef.includes('ozel')) return (not.hedef_kullanicilar || []).includes(user.id)
      if (hedef.includes(userRol)) return true

      return false
    })

    if (gosterilecek.length > 0) {
      setOkunmayanlar(gosterilecek)
      setAktifIndex(0)
      setTimeout(() => setGosteriliyor(true), 800) // login sonrası kısa gecikme
    }
  }

  const gorulduKaydet = async (notId) => {
    await supabase.from('kullanici_notlar_goruldu').insert({
      user_id: user.id,
      not_id: notId,
    }).then(() => {}) // hata olsa da devam et (unique constraint)
  }

  const handleKapat = async () => {
    // Tüm gösterilen notları görüldü olarak işaretle
    for (const not of okunmayanlar) {
      await gorulduKaydet(not.id)
    }
    setKapatiliyor(true)
    setTimeout(() => {
      setGosteriliyor(false)
      setKapatiliyor(false)
      setOkunmayanlar([])
    }, 300)
  }

  const handleSonraki = async () => {
    // Mevcut notu görüldü kaydet
    await gorulduKaydet(okunmayanlar[aktifIndex].id)
    if (aktifIndex < okunmayanlar.length - 1) {
      setAktifIndex(i => i + 1)
    } else {
      handleKapat()
    }
  }

  if (!gosteriliyor || okunmayanlar.length === 0) return null

  const aktifNot = okunmayanlar[aktifIndex]
  const toplamNot = okunmayanlar.length
  const sonNotMu = aktifIndex === toplamNot - 1

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      opacity: kapatiliyor ? 0 : 1,
      transition: 'opacity 0.3s',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        transform: kapatiliyor ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.3s',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #e5484d 0%, #c03030 100%)',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '38px', height: '38px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            🚀
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Güncelleme Notları
              {toplamNot > 1 && ` · ${aktifIndex + 1}/${toplamNot}`}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              {aktifNot.baslik}
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div style={{
          padding: '20px',
          maxHeight: '340px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aktifNot.icerik.split('\n').filter(s => s.trim()).map((satir, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <span style={{ color: '#e5484d', fontSize: '12px', marginTop: '2px', flexShrink: 0, lineHeight: 1 }}>&#9733;</span>
                <span>{satir.trim().replace(/^[•\-\*]\s*/, '')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {new Date(aktifNot.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {toplamNot > 1 && !sonNotMu && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleKapat}
              >
                Tümünü Kapat
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSonraki}
              style={{ minWidth: '100px' }}
            >
              {sonNotMu ? '✓ Anladım' : `Sonraki →`}
            </button>
          </div>
        </div>

        {/* Çoklu not göstergesi */}
        {toplamNot > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '6px',
            paddingBottom: '14px',
          }}>
            {okunmayanlar.map((_, i) => (
              <div key={i} style={{
                width: i === aktifIndex ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === aktifIndex ? '#e5484d' : 'var(--border)',
                transition: 'all .2s',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GuncellemeNotuPopup
