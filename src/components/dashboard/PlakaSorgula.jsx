import { useState, useRef } from 'react'
import { supabase } from '../../supabaseClient'

const formatPlaka = (plaka) => {
  if (!plaka) return ''
  const temiz = plaka.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const eslesme = temiz.match(/^(\d{2})([A-Z]{1,3})(\d{2,4})$/)
  if (!eslesme) return plaka
  return `${eslesme[1]} ${eslesme[2]} ${eslesme[3]}`
}
const normalizeEt = (p) => (p || '').toString().toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '')
const formatTelefon = (tel) => {
  if (!tel) return ''
  const r = tel.toString().replace(/\D/g, '')
  if (r.length !== 11) return tel
  return `${r.slice(0,4)} ${r.slice(4,7)} ${r.slice(7,9)} ${r.slice(9,11)}`
}
const tarihFormat = (t) => t ? new Date(t).toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'
const DURUM_LABEL = { bekliyor: 'Bekliyor', devam_ediyor: 'Devam Ediyor', tamamlandi: 'Tamamlandı', teslim_edildi: 'Teslim Edildi', iptal: 'İptal' }
const DURUM_RENK = { bekliyor: '#f5a623', devam_ediyor: '#3b82f6', tamamlandi: '#22c55e', teslim_edildi: '#22c55e', iptal: '#e5484d' }

const PlakaSorgula = ({ acik, onKapat, onIsEmriAc }) => {
  const [durum, setDurum] = useState('idle') // idle | yukleniyor | sonuc | bulunamadi | hata
  const [hataMesaj, setHataMesaj] = useState('')
  const [okunanPlaka, setOkunanPlaka] = useState('')
  const [aranan, setAranan] = useState('')
  const [manuelPlaka, setManuelPlaka] = useState('')
  const [aracBilgi, setAracBilgi] = useState(null)
  const [isEmirleri, setIsEmirleri] = useState([])
  const inputRef = useRef(null)

  const sifirla = () => {
    setDurum('idle')
    setHataMesaj('')
    setOkunanPlaka('')
    setManuelPlaka('')
    setAracBilgi(null)
    setIsEmirleri([])
  }

  const kapat = () => {
    sifirla()
    onKapat()
  }

  const plakaAra = async (plakaMetni) => {
    setDurum('yukleniyor')
    const hedefNormalize = normalizeEt(plakaMetni)

    const { data: araclar, error } = await supabase.from('araclar').select('*, musteriler(id, ad, soyad, telefon)')

    if (error) {
      setDurum('hata')
      setHataMesaj('Veritabanı hatası: ' + error.message)
      return
    }

    // Önce tam eşleşme dene (boşluk/büyük-küçük harf farkı zaten normalize ile yok sayılıyor)
    let bulunan = (araclar || []).find(a => normalizeEt(a.plaka) === hedefNormalize)

    // Tam eşleşme yoksa daha esnek dene: biri diğerini içeriyorsa da eşleştir
    // (örn. OCR/elle yazımda bir karakter eksik/fazla gelmiş olabilir)
    if (!bulunan && hedefNormalize.length >= 5) {
      bulunan = (araclar || []).find(a => {
        const aracNormalize = normalizeEt(a.plaka)
        return aracNormalize.length >= 5 && (aracNormalize.includes(hedefNormalize) || hedefNormalize.includes(aracNormalize))
      })
    }

    if (!bulunan) {
      setDurum('bulunamadi')
      setOkunanPlaka(formatPlaka(plakaMetni))
      setAranan(hedefNormalize)
      return
    }

    setAracBilgi(bulunan)
    const { data: isler } = await supabase
      .from('is_emirleri')
      .select('*, personel(ad, soyad)')
      .eq('arac_id', bulunan.id)
      .order('created_at', { ascending: false })

    setIsEmirleri(isler || [])
    setOkunanPlaka(formatPlaka(bulunan.plaka))
    setDurum('sonuc')
  }

  const handleDosya = async (e) => {
    const dosya = e.target.files[0]
    if (!dosya) return
    setDurum('yukleniyor')
    setHataMesaj('')

    try {
      const { base64, mediaType } = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const maxW = 1200
            let w = img.width, h = img.height
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
            canvas.width = w; canvas.height = h
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, w, h)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
            resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
          }
          img.onerror = () => reject(new Error('Görsel yüklenemedi'))
          img.src = reader.result
        }
        reader.onerror = () => reject(new Error('Dosya okuma hatası'))
        reader.readAsDataURL(dosya)
      })

      const response = await fetch('/api/plaka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      if (!response.ok) throw new Error('Sunucu hatası: ' + response.status)
      const data = await response.json()

      if (data.ok && data.plaka) {
        await plakaAra(data.plaka)
      } else {
        setDurum('hata')
        setHataMesaj(data.error || 'Plaka okunamadı, manuel girebilirsin.')
      }
    } catch (err) {
      setDurum('hata')
      setHataMesaj('Hata: ' + err.message)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const manuelAra = () => {
    if (!manuelPlaka.trim()) return
    plakaAra(manuelPlaka)
  }

  if (!acik) return null

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📷 Plaka Sorgula</span>
          <button className="modal-close" onClick={kapat}>✕</button>
        </div>
        <div className="modal-body">

          {(durum === 'idle' || durum === 'yukleniyor' || durum === 'hata') && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleDosya}
                style={{ display: 'none' }}
              />
              <div style={{
                border: `1.5px dashed ${durum === 'hata' ? '#e5484d' : durum === 'yukleniyor' ? '#3b82f6' : 'var(--border)'}`,
                borderRadius: 10, padding: '28px 16px', textAlign: 'center',
                background: durum === 'hata' ? 'rgba(229,72,77,.06)' : durum === 'yukleniyor' ? 'rgba(59,130,246,.06)' : 'var(--bg-elevated)',
              }}>
                {durum === 'yukleniyor' ? (
                  <div style={{ color: '#3b82f6', fontSize: 14 }}>⏳ Plaka okunuyor...</div>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🏍️</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Plaka Fotoğrafı Çek</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>Kamerayı plakaya doğrult, sistem otomatik okuyup servis geçmişini getirsin</div>
                    <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>📷 Kamerayı Aç</button>
                    {durum === 'hata' && <div style={{ color: '#e5484d', fontSize: 12, marginTop: 10 }}>⚠️ {hataMesaj}</div>}
                  </>
                )}
              </div>

              {durum !== 'yukleniyor' && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <input
                    value={manuelPlaka}
                    onChange={e => setManuelPlaka(e.target.value.toUpperCase())}
                    placeholder="ya da plakayı elle yaz — 34 TT 213"
                    style={{ flex: 1 }}
                    onKeyDown={e => e.key === 'Enter' && manuelAra()}
                  />
                  <button className="btn btn-secondary" onClick={manuelAra} disabled={!manuelPlaka.trim()}>Ara</button>
                </div>
              )}
            </>
          )}

          {durum === 'bulunamadi' && (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>{okunanPlaka}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Bu plakaya ait kayıt sistemde bulunamadı.</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10.5, marginTop: 8, fontFamily: 'monospace' }}>Aranan: {aranan}</div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={sifirla}>← Tekrar Dene</button>
            </div>
          )}

          {durum === 'sonuc' && aracBilgi && (
            <div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e5484d' }}>{okunanPlaka}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>{aracBilgi.marka} {aracBilgi.model} {aracBilgi.yil && `(${aracBilgi.yil})`}</div>
                {aracBilgi.musteriler && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>👤 {aracBilgi.musteriler.ad} {aracBilgi.musteriler.soyad}</span>
                    {aracBilgi.musteriler.telefon && (
                      <a href={`tel:${aracBilgi.musteriler.telefon}`} style={{ color: '#22c55e', fontWeight: 600, textDecoration: 'none' }}>
                        📞 {formatTelefon(aracBilgi.musteriler.telefon)} · Ara
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Servis Geçmişi ({isEmirleri.length})
              </div>

              {isEmirleri.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>Bu araca ait iş emri kaydı yok.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {isEmirleri.map(is => (
                    <div
                      key={is.id}
                      onClick={() => { if (onIsEmriAc) { onIsEmriAc(is); kapat() } }}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', cursor: onIsEmriAc ? 'pointer' : 'default' }}
                      onMouseEnter={e => { if (onIsEmriAc) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>📅 {tarihFormat(is.created_at)}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${DURUM_RENK[is.durum]}18`, color: DURUM_RENK[is.durum] }}>
                          {DURUM_LABEL[is.durum] || is.durum}
                        </span>
                      </div>
                      {is.sikayet && <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}><b>Şikayet:</b> {is.sikayet}</div>}
                      {is.yapilan_isler && <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 2 }}><b>Yapılan:</b> {is.yapilan_isler}</div>}
                      {is.personel && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>🔧 {is.personel.ad} {is.personel.soyad}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={sifirla}>← Başka Plaka Sorgula</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default PlakaSorgula
