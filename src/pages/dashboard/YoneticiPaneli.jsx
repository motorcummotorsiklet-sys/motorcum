import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

const ROLLER = ['hepsi', 'kullanici', 'teknisyen', 'usta', 'yönetici', 'admin']
const ROL_LABEL = { hepsi: 'Herkese', kullanici: 'Kullanıcı', teknisyen: 'Teknisyen', usta: 'Usta', yönetici: 'Yönetici', admin: 'Admin' }

const YoneticiPaneli = () => {
  const [notlar, setNotlar] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [formAcik, setFormAcik] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const [form, setForm] = useState({
    baslik: '',
    icerik: '',
    aktif: true,
    hedef_tipi: 'rol', // 'rol' veya 'kullanici'
    secili_roller: ['hepsi'],
    secili_kullanicilar: [],
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const [okunduBilgisi, setOkunduBilgisi] = useState({}) // { not_id: [user_id, ...] }

  const fetchAll = async () => {
    setLoading(true)
    const [notRes, kulRes, gorulduRes] = await Promise.all([
      supabase.from('guncelleme_notlari').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, ad, soyad, kullanici_adi, rol').order('ad'),
      supabase.from('kullanici_notlar_goruldu').select('not_id, user_id'),
    ])
    setNotlar(notRes.data || [])
    setKullanicilar(kulRes.data || [])

    // okundu bilgisini not_id bazında grupla
    const goruldu = {}
    for (const g of (gorulduRes.data || [])) {
      if (!goruldu[g.not_id]) goruldu[g.not_id] = []
      goruldu[g.not_id].push(g.user_id)
    }
    setOkunduBilgisi(goruldu)
    setLoading(false)
  }

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const resetForm = () => {
    setForm({
      baslik: '',
      icerik: '',
      aktif: true,
      hedef_tipi: 'rol',
      secili_roller: ['hepsi'],
      secili_kullanicilar: [],
    })
    setFormAcik(false)
  }

  const toggleRol = (rol) => {
    if (rol === 'hepsi') {
      setForm(f => ({ ...f, secili_roller: ['hepsi'] }))
      return
    }
    setForm(f => {
      const mevcut = f.secili_roller.filter(r => r !== 'hepsi')
      if (mevcut.includes(rol)) {
        const yeni = mevcut.filter(r => r !== rol)
        return { ...f, secili_roller: yeni.length === 0 ? ['hepsi'] : yeni }
      } else {
        return { ...f, secili_roller: [...mevcut, rol] }
      }
    })
  }

  const toggleKullanici = (id) => {
    setForm(f => {
      const mevcut = f.secili_kullanicilar
      if (mevcut.includes(id)) return { ...f, secili_kullanicilar: mevcut.filter(k => k !== id) }
      return { ...f, secili_kullanicilar: [...mevcut, id] }
    })
  }

  const handleKaydet = async () => {
    if (!form.baslik.trim() || !form.icerik.trim()) {
      showMsg('Başlık ve içerik zorunludur.', 'error')
      return
    }
    if (form.hedef_tipi === 'kullanici' && form.secili_kullanicilar.length === 0) {
      showMsg('En az bir kullanıcı seçin.', 'error')
      return
    }
    setKaydediliyor(true)

    // hedef_roller alanını belirle
    let hedefRoller
    let hedefKullanicilar = null
    if (form.hedef_tipi === 'kullanici') {
      // Kullanıcı bazlı: seçilen kullanıcı ID'lerini direkt kaydet
      hedefRoller = ['ozel']
      hedefKullanicilar = form.secili_kullanicilar
    } else {
      hedefRoller = form.secili_roller
    }

    const { data: yeniNot, error } = await supabase.from('guncelleme_notlari').insert({
      baslik: form.baslik.trim(),
      icerik: form.icerik.trim(),
      aktif: form.aktif,
      hedef_roller: hedefRoller,
      hedef_kullanicilar: hedefKullanicilar,
    }).select().single()

    if (error) {
      showMsg('Kayıt hatası: ' + error.message, 'error')
      setKaydediliyor(false)
      return
    }


    showMsg('✅ Güncelleme notu kaydedildi!')
    resetForm()
    fetchAll()
    setKaydediliyor(false)
  }

  const handleAktifToggle = async (not) => {
    await supabase.from('guncelleme_notlari').update({ aktif: !not.aktif }).eq('id', not.id)
    setNotlar(prev => prev.map(n => n.id === not.id ? { ...n, aktif: !n.aktif } : n))
  }

  const handleSil = async (id) => {
    if (!confirm('Bu güncelleme notunu silmek istediğinize emin misiniz?')) return
    await supabase.from('guncelleme_notlari').delete().eq('id', id)
    setNotlar(prev => prev.filter(n => n.id !== id))
    showMsg('Silindi.')
  }

  const formatTarih = (iso) => new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  if (loading) return <div className="empty-state"><p>Yükleniyor...</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* MSG */}
      {msg.text && (
        <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {/* GÜNCELLEME NOTLARI */}
      <div className="table-card">
        <div className="table-header">
          <span className="table-title">📢 Güncelleme Notları</span>
          <button className="btn btn-primary btn-sm" onClick={() => setFormAcik(true)}>
            + Yeni Not
          </button>
        </div>

        {/* YENİ NOT FORMU */}
        {formAcik && (
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            margin: '0 0 1rem 0',
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '14px' }}>
              📝 Yeni Güncelleme Notu
            </div>

            <div className="form-grid">
              {/* Başlık */}
              <div className="field form-full">
                <label>Başlık *</label>
                <input
                  type="text"
                  placeholder="Örn: v1.0.105 — Yeni Özellikler"
                  value={form.baslik}
                  onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))}
                />
              </div>

              {/* İçerik */}
              <div className="field form-full">
                <label>İçerik * <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>(madde madde yazabilirsiniz)</span></label>
                <textarea
                  rows={8}
                  placeholder={"• Yönetici Paneli eklendi\n• Güncelleme notları özelliği eklendi\n• Admin kullanıcı yönetimi geliştirildi"}
                  value={form.icerik}
                  onChange={e => setForm(f => ({ ...f, icerik: e.target.value }))}
                  style={{ fontSize: '13px', lineHeight: '1.6', minHeight: '160px' }}
                />
              </div>

              {/* Yeni not olarak işaretle */}
              <div className="field form-full">
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setForm(f => ({ ...f, aktif: !f.aktif }))}
                >
                  <div style={{
                    width: '18px', height: '18px',
                    borderRadius: '5px',
                    border: `2px solid ${form.aktif ? '#e5484d' : 'var(--border)'}`,
                    background: form.aktif ? '#e5484d' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all .15s'
                  }}>
                    {form.aktif && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>}
                  </div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                    Yeni not olarak işaretle
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    (işaretliyse login olan kullanıcılar bir kez görecek)
                  </span>
                </label>
              </div>

              {/* Hedef seçimi */}
              <div className="field form-full">
                <label>Kimlere Gösterilsin?</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { val: 'rol', label: '👥 Role Göre' },
                    { val: 'kullanici', label: '👤 Kullanıcı Seç' }
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn btn-sm ${form.hedef_tipi === val ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setForm(f => ({ ...f, hedef_tipi: val }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {form.hedef_tipi === 'rol' && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ROLLER.map(rol => {
                      const secili = form.secili_roller.includes(rol)
                      return (
                        <button
                          key={rol}
                          type="button"
                          className={`btn btn-sm ${secili ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleRol(rol)}
                        >
                          {ROL_LABEL[rol]}
                        </button>
                      )
                    })}
                  </div>
                )}

                {form.hedef_tipi === 'kullanici' && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '10px',
                  }}>
                    {kullanicilar.map(k => {
                      const secili = form.secili_kullanicilar.includes(k.id)
                      return (
                        <label
                          key={k.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', userSelect: 'none',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: secili ? 'rgba(229,72,77,.1)' : 'transparent',
                            border: `1px solid ${secili ? '#e5484d40' : 'transparent'}`,
                            transition: 'all .12s',
                          }}
                          onClick={() => toggleKullanici(k.id)}
                        >
                          <div style={{
                            width: '15px', height: '15px',
                            borderRadius: '4px',
                            border: `2px solid ${secili ? '#e5484d' : 'var(--border)'}`,
                            background: secili ? '#e5484d' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all .12s',
                          }}>
                            {secili && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {k.ad} {k.soyad}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              @{k.kullanici_adi} · {k.rol || 'kullanıcı'}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={resetForm}>İptal</button>
              <button className="btn btn-primary" onClick={handleKaydet} disabled={kaydediliyor}>
                {kaydediliyor ? 'Kaydediliyor...' : '📤 Yayınla'}
              </button>
            </div>
          </div>
        )}

        {/* NOT LİSTESİ */}
        {notlar.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📢</div>
            <p>Henüz güncelleme notu yok</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
            {notlar.map(not => (
              <div key={not.id} style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${not.aktif ? 'rgba(229,72,77,.3)' : 'var(--border)'}`,
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
              }}>
                {/* Aktif toggle */}
                <div
                  title={not.aktif ? 'Yeni not (tıkla: pasif yap)' : 'Pasif (tıkla: aktif yap)'}
                  onClick={() => handleAktifToggle(not)}
                  style={{
                    marginTop: '2px',
                    width: '18px', height: '18px',
                    borderRadius: '5px',
                    border: `2px solid ${not.aktif ? '#e5484d' : 'var(--border)'}`,
                    background: not.aktif ? '#e5484d' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, cursor: 'pointer', transition: 'all .15s'
                  }}
                >
                  {not.aktif && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                      {not.baslik}
                    </span>
                    {not.aktif
                      ? <span style={{ fontSize: '10px', background: 'rgba(229,72,77,.15)', color: '#e5484d', borderRadius: '20px', padding: '2px 8px', fontWeight: 600 }}>YENİ</span>
                      : <span style={{ fontSize: '10px', background: 'var(--bg-base)', color: 'var(--text-muted)', borderRadius: '20px', padding: '2px 8px' }}>Pasif</span>
                    }
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {formatTarih(not.created_at)}
                    </span>
                  </div>

                  {/* Hedef */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    👥 Hedef:{' '}
                    {not.hedef_roller?.includes('hepsi') ? 'Herkes' :
                     not.hedef_roller?.includes('ozel')
                       ? `Seçili kullanıcılar: ${(not.hedef_kullanicilar || []).map(id => {
                           const k = kullanicilar.find(k => k.id === id)
                           return k ? `${k.ad} ${k.soyad}` : '?'
                         }).join(', ') || 'yok'}`
                       : not.hedef_roller?.map(r => ROL_LABEL[r] || r).join(', ')}
                  </div>

                  {/* Okundu takibi */}
                  {(() => {
                    // Bu nota hedeflenen gerçek kullanıcı listesi
                    const hedefKullaniciListesi = not.hedef_roller?.includes('hepsi')
                      ? kullanicilar
                      : not.hedef_roller?.includes('ozel')
                        ? kullanicilar.filter(k => (not.hedef_kullanicilar || []).includes(k.id))
                        : kullanicilar.filter(k => not.hedef_roller?.includes(k.rol))

                    const goruldu = okunduBilgisi[not.id] || []
                    const toplamKullanici = hedefKullaniciListesi.length
                    const okuyanlar = hedefKullaniciListesi.filter(k => goruldu.includes(k.id))
                    return (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          👁️ <strong style={{ color: 'var(--text-secondary)' }}>{okuyanlar.length}/{toplamKullanici}</strong> kullanıcı okudu
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {hedefKullaniciListesi.map(k => {
                            const okudu = goruldu.includes(k.id)
                            return (
                              <span key={k.id} title={okudu ? `${k.ad} ${k.soyad} okudu` : `${k.ad} ${k.soyad} okumadı`} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 500,
                                background: okudu ? 'rgba(34,197,94,.12)' : 'rgba(100,100,120,.1)',
                                color: okudu ? '#22c55e' : 'var(--text-muted)',
                                border: `1px solid ${okudu ? 'rgba(34,197,94,.25)' : 'var(--border)'}`,
                              }}>
                                {okudu ? '✓' : '○'} {k.kullanici_adi || k.ad}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* İçerik */}
                  <div style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: '7px',
                    padding: '10px 12px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    {not.icerik.split('\n').filter(s => s.trim()).map((satir, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <span style={{ color: '#e5484d', fontSize: '11px', marginTop: '2px', flexShrink: 0, lineHeight: 1 }}>&#9733;</span>
                        <span>{satir.trim().replace(/^[•\-\*]\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sil */}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleSil(not.id)}
                  style={{ flexShrink: 0 }}
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default YoneticiPaneli
