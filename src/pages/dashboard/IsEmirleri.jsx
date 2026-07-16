import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { IconTool, IconClock, IconLira, IconClipboard, IconTrendUp, IconAlert, IconPlus, IconSearch, IconFilter } from '../../components/Icons'
import CustomSelect from '../../components/dashboard/CustomSelect'

const DURUMLAR = ['bekliyor', 'devam_ediyor', 'tamamlandi', 'teslim_edildi', 'iptal']
const DURUMLAR_TR = { bekliyor: 'Bekliyor', devam_ediyor: 'Devam Ediyor', tamamlandi: 'Tamamlandı', teslim_edildi: 'Teslim Edildi', iptal: 'İptal' }
const IS_TIPLERI = ['Bakım', 'Arıza Giderme', 'Periyodik Bakım', 'Kaza Hasarı', 'Modifikasyon', 'Diğer']
const ODEME_TURLERI = ['Nakit', 'Kredi Kartı', 'Havale/EFT']

// Elle yazılan parça adı mevcut tanımlarda yoksa (büyük/küçük harf ve boşluk
// farkı gözetmeksizin) otomatik olarak Tanımlamalar'a ekler. Zaten varsa
// mevcut kaydı kullanır, tekrar eklemez.
const parcaTaniminiGaranileGetir = async (isim, birimFiyat, parcaListesi) => {
  const buyukIsim = isim.trim().toUpperCase()
  const normalizeEt = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ')
  const eslesen = parcaListesi.find(p => normalizeEt(p.isim) === normalizeEt(buyukIsim))
  if (eslesen) return { parca_id: eslesen.id, isim: eslesen.isim }

  const { data, error } = await supabase.from('parcalar').insert({
    isim: buyukIsim,
    birim_fiyat: parseFloat(birimFiyat || 0),
    birim: 'adet',
    aktif: true,
  }).select().single()

  if (error || !data) return { parca_id: null, isim: buyukIsim }
  return { parca_id: data.id, isim: data.isim }
}

// Türkiye telefon formatı: 0XXX XXX XX XX
const formatTelefon = (tel) => {
  if (!tel) return ''
  const rakamlar = tel.replace(/\D/g, '')
  if (rakamlar.length !== 11) return tel
  return `${rakamlar.slice(0,4)} ${rakamlar.slice(4,7)} ${rakamlar.slice(7,9)} ${rakamlar.slice(9,11)}`
}

// Türkiye plaka standart formatı: 34 TT 213 (il kodu · harfler · rakamlar)
const formatPlaka = (plaka) => {
  if (!plaka) return ''
  const temiz = plaka.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const eslesme = temiz.match(/^(\d{2})([A-Z]{1,3})(\d{2,4})$/)
  if (!eslesme) return plaka
  return `${eslesme[1]} ${eslesme[2]} ${eslesme[3]}`
}

// Aranabilir müşteri dropdown
const MusteriSelect = ({ musteriler, araclar = [], value, onChange }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const sec = musteriler.find(m => m.id === value)
    if (sec) setQuery(`${sec.ad} ${sec.soyad}`)
    else setQuery('')
  }, [value, musteriler])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [])

  // Müşteri id -> o müşteriye ait plakalar (boşluksuz+temiz, arama için)
  const musteriPlakalari = {}
  araclar.forEach(a => {
    if (!a.musteri_id) return
    const temiz = (a.plaka || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    musteriPlakalari[a.musteri_id] = (musteriPlakalari[a.musteri_id] || '') + ' ' + temiz
  })

  const aramaTemiz = query.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const filtered = musteriler.filter(m => {
    const adUy = `${m.ad} ${m.soyad} ${m.telefon || ''}`.toLowerCase().includes(query.toLowerCase())
    const plakaUy = aramaTemiz.length >= 2 && (musteriPlakalari[m.id] || '').includes(aramaTemiz)
    return adUy || plakaUy
  })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onChange('') }}
        onFocus={() => setOpen(true)}
        placeholder="Müşteri adı yazın..."
        autoComplete="off"
        style={{ background:'var(--input-bg)', border:`1px solid ${open?'#e63030':'var(--border)'}`, borderRadius:'8px', padding:'0.65rem 0.9rem', color:'var(--text-primary)', fontSize:'0.88rem', fontFamily:'Inter,sans-serif', outline:'none', width:'100%' }}
      />
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'8px', zIndex:9999, maxHeight:'200px', overflowY:'auto', boxShadow:'var(--shadow)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'0.65rem', color:'var(--text-muted)', fontSize:'0.85rem' }}>Müşteri bulunamadı</div>
          ) : filtered.map(m => (
            <div key={m.id}
              onPointerDown={e => { e.preventDefault(); onChange(m.id); setQuery(`${m.ad} ${m.soyad}`); setOpen(false) }}
              style={{ padding:'0.65rem 0.9rem', fontFamily:'Inter, sans-serif', fontStyle:'normal', color: value===m.id ? 'var(--text-primary)':'var(--text-secondary)', fontSize:'0.85rem', cursor:'pointer', background: value===m.id ? 'rgba(230,48,48,0.15)':'transparent', userSelect:'none' }}
              onMouseEnter={e => { if(value!==m.id) e.currentTarget.style.background='var(--bg-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.background = value===m.id ? 'rgba(230,48,48,0.15)':'transparent' }}>
              <div style={{ fontWeight: value===m.id ? 600 : 400 }}>{m.ad} {m.soyad}</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'2px' }}>
                {m.telefon && <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{m.telefon}</span>}
                {(musteriPlakalari[m.id] || '').trim().split(' ').filter(Boolean).map((p, i) => (
                  <span key={i} style={{ fontSize:'0.68rem', color:'#e5484d', fontWeight:600 }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const IsEmriForm = ({ onKaydet, onIptal }) => {
  const [aktifTab, setAktifTab] = useState('genel')
  const [musteriler, setMusteriler] = useState([])
  const [araclar, setAraclar] = useState([])
  const [musteriAraclari, setMusteriAraclari] = useState([])
  const [personel, setPersonel] = useState([])
  const [parcaListesi, setParcaListesi] = useState([])
  const [error, setError] = useState('')
  const [kayitEdiliyor, setKayitEdiliyor] = useState(false)

  // Varsayılan tahmini çıkış bugün
  const bugunStr = () => {
    const now = new Date()
    now.setHours(now.getHours() + 2)
    return now.toISOString().slice(0, 16)
  }

  const [form, setForm] = useState({
    musteri_id: '', arac_id: '', personel_id: '', is_tipi: 'Bakım',
    oncelik: 'normal', arac_km: '', tahmini_cikis: bugunStr(),
    sikayet: '', yapilan_isler: '', notlar: '',
    toplam_tutar: '', odeme_durumu: 'odenmedi', odeme_turu: ''
  })
  const [parcalar, setParcalar] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('musteriler').select('id, ad, soyad, telefon').order('ad'),
      supabase.from('araclar').select('id, plaka, marka, model, musteri_id'),
      supabase.from('personel').select('id, ad, soyad').eq('aktif', true).order('ad'),
      supabase.from('parcalar').select('*').eq('aktif', true).order('isim'),
    ]).then(([m, a, p, prc]) => {
      setMusteriler(m.data || [])
      setAraclar(a.data || [])
      setPersonel(p.data || [])
      setParcaListesi(prc.data || [])
    })
  }, [])

  const handleMusteriSec = (id) => {
    setForm(f => ({ ...f, musteri_id: id, arac_id: '' }))
    setMusteriAraclari(araclar.filter(a => a.musteri_id === id))
  }

  const parcaListeRef = useRef(null)
  const [parcaForm, setParcaForm] = useState({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0 })

  const parcaEkle = async () => {
    if (!parcaForm.parca_isim) return
    let eklenecekParca = { ...parcaForm }
    if (!parcaForm.parca_id) {
      const { parca_id, isim } = await parcaTaniminiGaranileGetir(parcaForm.parca_isim, parcaForm.birim_fiyat, parcaListesi)
      eklenecekParca = { ...parcaForm, parca_id, parca_isim: isim }
      if (parca_id) setParcaListesi(prev => [...prev, { id: parca_id, isim, birim_fiyat: parcaForm.birim_fiyat }])
    }
    const toplam = parseFloat(eklenecekParca.birim_fiyat || 0) * parseFloat(eklenecekParca.miktar || 1)
    const yeniParcalar = [...parcalar, { ...eklenecekParca, toplam }]
    setParcalar(yeniParcalar)
    const yeniToplam = yeniParcalar.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)
    setForm(f => ({ ...f, toplam_tutar: yeniToplam.toFixed(2) }))
    setParcaForm({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0 })
    setTimeout(() => {
      if (parcaListeRef.current) parcaListeRef.current.scrollTop = parcaListeRef.current.scrollHeight
    }, 50)
  }

  const parcaSil = (idx) => {
    const yeni = parcalar.filter((_, i) => i !== idx)
    setParcalar(yeni)
    const yeniToplam = yeni.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)
    setForm(f => ({ ...f, toplam_tutar: yeniToplam.toFixed(2) }))
  }

  const parcaGuncelle = (idx, field, value) => {
    const yeni = [...parcalar]
    yeni[idx][field] = value
    if (field === 'parca_id') {
      const sec = parcaListesi.find(p => p.id === value)
      if (sec) { yeni[idx].parca_isim = sec.isim; yeni[idx].birim_fiyat = sec.birim_fiyat; yeni[idx].toplam = sec.birim_fiyat * yeni[idx].miktar }
    }
    if (field === 'miktar' || field === 'birim_fiyat') {
      yeni[idx].toplam = parseFloat(yeni[idx].miktar || 0) * parseFloat(yeni[idx].birim_fiyat || 0)
    }
    setParcalar(yeni)
    const toplamParca = yeni.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)
    setForm(f => ({ ...f, toplam_tutar: toplamParca.toFixed(2) }))
  }

  const handleKaydet = async () => {
    if (!form.musteri_id || !form.arac_id) return setError('Müşteri ve araç seçimi zorunludur.')
    setKayitEdiliyor(true); setError('')
    const { data: isEmri, error: isErr } = await supabase.from('is_emirleri').insert({
      musteri_id: form.musteri_id, arac_id: form.arac_id,
      personel_id: form.personel_id || null, oncelik: form.oncelik,
      arac_km: form.arac_km ? parseInt(form.arac_km) : null,
      tahmini_cikis: form.tahmini_cikis || null,
      sikayet: form.sikayet,
      yapilan_isler: form.is_tipi + (form.yapilan_isler ? '\n' + form.yapilan_isler : ''),
      notlar: form.notlar,
      toplam_tutar: parcalar.reduce((s,p)=>s+parseFloat(p.toplam||0),0),
      odeme_durumu: form.odeme_durumu,
      odeme_turu: form.odeme_turu || null,
    }).select().single()
    if (isErr) { setError(isErr.message); setKayitEdiliyor(false); return }
    if (parcalar.length > 0 && isEmri) {
      await supabase.from('is_emri_parcalari').insert(
        parcalar.filter(p => p.parca_isim).map(p => ({
          is_emri_id: isEmri.id, parca_id: p.parca_id || null,
          parca_isim: p.parca_isim, miktar: parseFloat(p.miktar || 1),
          birim_fiyat: parseFloat(p.birim_fiyat || 0), toplam: parseFloat(p.toplam || 0),
        }))
      )
    }
    onKaydet(); setKayitEdiliyor(false)
  }

  const tabStyle = (id) => ({
    background:'none', border:'none', color: aktifTab===id ? '#e5484d':'var(--text-muted)',
    fontFamily:'Inter,sans-serif', fontSize:'clamp(11px, 2.5vw, 13px)', fontWeight:600,
    padding:'0.5rem clamp(6px, 2vw, 14px)', cursor:'pointer',
    borderBottom: aktifTab===id ? '2px solid #e5484d':'2px solid transparent',
    marginBottom:'-1px', whiteSpace:'nowrap', flex:1, textAlign:'center'
  })

  const odemeAktif = form.odeme_durumu === 'kismi' || form.odeme_durumu === 'odendi'

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <span className="modal-title">Yeni İş Emri</span>
          <button className="modal-close" onClick={onIptal}>✕</button>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--card-bg)' }}>
          {['genel','islem','parcalar','odeme'].map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setAktifTab(t)}>
              {t==='genel'?'📋 Genel':t==='islem'?'🔧 İşlem':t==='parcalar'?`🔩 Parça (${parcalar.length})`:'💰 Ödeme'}
            </button>
          ))}
        </div>
        <div className="modal-body" style={{overflowY:'auto', flex:1}}>
          {error && <div className="alert alert-error">{error}</div>}

          {aktifTab === 'genel' && (
            <div className="form-grid">
              <div className="field form-full">
                <label>Müşteri *</label>
                <MusteriSelect musteriler={musteriler} araclar={araclar} value={form.musteri_id} onChange={handleMusteriSec} />
              </div>
              <div className="field form-full">
                <label>Araç *</label>
                <CustomSelect
                  value={form.arac_id}
                  onChange={v => setForm({...form, arac_id: v})}
                  disabled={!form.musteri_id}
                  placeholder={form.musteri_id ? 'Araç seçin' : 'Önce müşteri seçin'}
                  options={musteriAraclari.map(a => ({ value: a.id, label: `${formatPlaka(a.plaka)} — ${a.marka} ${a.model}` }))}
                />
              </div>
              <div className="field">
                <label>Teknisyen</label>
                <CustomSelect
                  value={form.personel_id}
                  onChange={v => setForm({...form, personel_id: v})}
                  placeholder="Seçin"
                  options={personel.map(p => ({ value: p.id, label: `${p.ad} ${p.soyad}` }))}
                />
              </div>
              <div className="field">
                <label>Öncelik</label>
                <CustomSelect
                  value={form.oncelik}
                  onChange={v => setForm({...form, oncelik: v})}
                  options={[
                    { value: 'düşük', label: 'Düşük' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'yüksek', label: 'Yüksek' },
                    { value: 'acil', label: 'Acil' },
                  ]}
                />
              </div>
              <div className="field">
                <label>Araç KM</label>
                <input type="number" placeholder="15000" value={form.arac_km} onChange={e => setForm({...form, arac_km: e.target.value})} />
              </div>
              <div className="field">
                <label>Tahmini Çıkış</label>
                <input type="datetime-local" value={form.tahmini_cikis} onChange={e => setForm({...form, tahmini_cikis: e.target.value})} />
              </div>
            </div>
          )}

          {aktifTab === 'islem' && (
            <div className="form-grid">
              <div className="field form-full">
                <label>İşlem Tipi</label>
                <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.25rem' }}>
                  {IS_TIPLERI.map(t => (
                    <button key={t} type="button" onClick={() => setForm({...form, is_tipi: t})}
                      className={`btn btn-sm ${form.is_tipi===t ? 'btn-primary':'btn-secondary'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="field form-full">
                <label>Müşteri Şikayeti / Arıza Tanımı</label>
                <textarea rows={3} placeholder="Müşterinin bildirdiği sorun..." value={form.sikayet} onChange={e => setForm({...form, sikayet: e.target.value})} />
              </div>
              <div className="field form-full">
                <label>Yapılan İşlemler</label>
                <textarea rows={4} placeholder="Yapılan işlemleri detaylı yazın..." value={form.yapilan_isler} onChange={e => setForm({...form, yapilan_isler: e.target.value})} />
              </div>
              <div className="field form-full">
                <label>Notlar</label>
                <textarea rows={2} placeholder="Ek notlar..." value={form.notlar} onChange={e => setForm({...form, notlar: e.target.value})} />
              </div>
            </div>
          )}

          {aktifTab === 'parcalar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* TEK EKLEME FORMU */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Parça Ekle</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', alignItems: 'flex-end' }}>
                  <div className="field" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label>Parça Ara / Seç</label>
                    <ParcaAramaSelect
                      parcaListesi={parcaListesi}
                      value={parcaForm.parca_id}
                      inputValue={parcaForm.parca_isim}
                      onChange={(id, isim, fiyat) => setParcaForm(f => ({ ...f, parca_id: id, parca_isim: isim, birim_fiyat: fiyat }))}
                      onManual={(isim) => setParcaForm(f => ({ ...f, parca_id: '', parca_isim: isim }))}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Miktar</label>
                    <input type="number" min="1" step="0.5" value={parcaForm.miktar} className="no-spinner"
                      onChange={e => setParcaForm(f => ({ ...f, miktar: e.target.value }))} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Birim Fiyat</label>
                    <input type="number" min="0" step="0.01" value={parcaForm.birim_fiyat} className="no-spinner"
                      onFocus={e => e.target.select()}
                      onChange={e => setParcaForm(f => ({ ...f, birim_fiyat: e.target.value }))} />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={parcaEkle}
                    style={{ height: '38px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
                    + Ekle
                  </button>
                </div>
              </div>

              {/* EKLENEN PARÇALAR LİSTESİ */}
              {parcalar.length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem' }}>
                  <div className="empty-state-icon">🔩</div>
                  <p>Henüz parça eklenmedi</p>
                </div>
              ) : (
                <div ref={parcaListeRef} style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Parça</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '60px' }}>Adet</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '90px' }}>Fiyat</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '90px' }}>Toplam</th>
                        <th style={{ width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcalar.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 8px', color: 'var(--text-primary)' }}>{p.parca_isim}</td>
                          <td style={{ textAlign: 'center', padding: '7px 8px', color: 'var(--text-secondary)' }}>{p.miktar}</td>
                          <td style={{ textAlign: 'right', padding: '7px 8px', color: 'var(--text-secondary)' }}>₺{parseFloat(p.birim_fiyat||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                          <td style={{ textAlign: 'right', padding: '7px 8px', color: '#22c55e', fontWeight: 600 }}>₺{parseFloat(p.toplam||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                          <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                            <button type="button" onClick={() => parcaSil(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e5484d', fontSize: '14px', padding: '2px 4px' }}>
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>Parça Toplamı</td>
                        <td style={{ textAlign: 'right', padding: '8px 8px', color: '#22c55e', fontWeight: 700, fontSize: '14px' }}>₺{parcalar.reduce((s,p)=>s+parseFloat(p.toplam||0),0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {aktifTab === 'odeme' && (
            <div className="form-grid">
              <div className="field form-full">
                <label>Toplam Tutar (₺)</label>
                <input readOnly disabled value={`₺${parcalar.reduce((s,p)=>s+parseFloat(p.toplam||0),0).toLocaleString('tr-TR',{minimumFractionDigits:2})}`} style={{fontSize:'1.2rem',fontWeight:700,color:'#22c55e',cursor:'not-allowed',opacity:0.85}} />
                <span style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'4px',display:'block'}}>Parça sekmesinden eklenen parçalardan otomatik hesaplanır</span>
              </div>
              <div className="field form-full">
                <label>Ödeme Durumu</label>
                <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem' }}>
                  {[['odenmedi','Ödenmedi'],['kismi','Kısmi Ödeme'],['odendi','Ödendi']].map(([val,label]) => (
                    <button key={val} type="button" onClick={() => setForm({...form, odeme_durumu: val, odeme_turu: val==='odenmedi' ? '' : form.odeme_turu})}
                      className={`btn btn-sm ${form.odeme_durumu===val ? 'btn-primary':'btn-secondary'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="field form-full">
                <label>Ödeme Türü</label>
                <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.25rem' }}>
                  {ODEME_TURLERI.map(o => (
                    <button key={o} type="button"
                      onClick={() => odemeAktif && setForm({...form, odeme_turu: o})}
                      className={`btn btn-sm ${form.odeme_turu===o ? 'btn-primary':'btn-secondary'}`}
                      style={{ opacity: odemeAktif ? 1 : 0.3, cursor: odemeAktif ? 'pointer':'not-allowed' }}>{o}</button>
                  ))}
                </div>
                {!odemeAktif && <p style={{color:'var(--text-muted)',fontSize:'0.75rem',marginTop:'0.4rem'}}>Ödeme durumunu "Kısmi" veya "Ödendi" seçince aktif olur</p>}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onIptal}>İptal</button>
          <button className="btn btn-primary" onClick={handleKaydet} disabled={kayitEdiliyor}>{kayitEdiliyor ? 'Kaydediliyor...' : '✅ İş Emri Oluştur'}</button>
        </div>
      </div>
    </div>
  )
}


const ServisFormuModal = ({ is: isEmri, onKapat }) => {
  const [parcalar, setParcalar] = useState([])
  const [printBlocked, setPrintBlocked] = useState(false)

  useEffect(() => {
    supabase.from('is_emri_parcalari').select('*').eq('is_emri_id', isEmri.id).order('created_at')
      .then(({ data }) => setParcalar(data || []))
  }, [isEmri.id])

  const [tutarGizle, setTutarGizle] = useState(false)

  const handlePrint = async () => {
    // Parçaları taze çek
    const { data: tazeParcalar } = await supabase
      .from('is_emri_parcalari').select('*').eq('is_emri_id', isEmri.id).order('created_at')
    const guncelParcalar = tazeParcalar || []
    const genelToplam = guncelParcalar.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)

    const fiyatGoster = !tutarGizle

    const SAYFA_SATIR = 12
    const kolonSayisi = fiyatGoster ? 4 : 2
    const theadHTML = fiyatGoster
      ? `<thead>
          <tr><th colspan="4" style="background:#fff;color:#888;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:10px 8px 4px;border-bottom:1px solid #e0e0e0">Parcalar ve Islem Bedeli</th></tr>
          <tr><th style="width:44%">Parca / Islem</th><th style="width:14%;text-align:center">Miktar</th><th style="width:21%;text-align:right">Birim Fiyat</th><th style="width:21%;text-align:right">Tutar</th></tr>
         </thead>`
      : `<thead>
          <tr><th colspan="2" style="background:#fff;color:#888;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:10px 8px 4px;border-bottom:1px solid #e0e0e0">Parcalar ve Islem Bedeli</th></tr>
          <tr><th style="width:60%">Parca / Islem</th><th style="width:40%;text-align:center">Miktar</th></tr>
         </thead>`

    const satirHTML = (p) => fiyatGoster
      ? `<tr><td>${p.parca_isim}</td><td style="text-align:center">${p.miktar}</td><td style="text-align:right">&#x20BA;${parseFloat(p.birim_fiyat||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td><td style="text-align:right">&#x20BA;${parseFloat(p.toplam||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td></tr>`
      : `<tr><td>${p.parca_isim}</td><td style="text-align:center">${p.miktar}</td></tr>`

    // 12'li gruplara böl, her grup ayrı tablo
    const gruplar = []
    for (let i = 0; i < guncelParcalar.length; i += SAYFA_SATIR) {
      gruplar.push(guncelParcalar.slice(i, i + SAYFA_SATIR))
    }
    if (gruplar.length === 0) gruplar.push([])

    const parcalarHTML = gruplar.map((grup, gi) => {
      const sonGrup = gi === gruplar.length - 1
      const toplamSatir = sonGrup && fiyatGoster
        ? `<tr class="tot-row"><td colspan="${kolonSayisi - 1}" style="text-align:right;font-size:11px">Genel Toplam</td><td style="text-align:right;color:#e5484d;font-size:15px">&#x20BA;${(genelToplam > 0 ? genelToplam : (isEmri.toplam_tutar||0)).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td></tr>`
        : ''
      const satirlar = grup.length > 0
        ? grup.map(p => satirHTML(p)).join('')
        : `<tr><td colspan="${kolonSayisi}" style="text-align:center;color:#999;padding:12px">Parca kaydi yok</td></tr>`
      return `<table style="${gi > 0 ? 'page-break-before:always' : ''}">${theadHTML}<tbody>${satirlar}${toplamSatir}</tbody></table>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Servis Formu #${isEmri.is_emri_no}</title><style>
*{box-sizing:border-box;margin:0;padding:0} @page{size:A4;margin:10mm;} @media print{body{margin:0} thead{display:table-header-group} tfoot{display:table-footer-group} a[href]:after{content:none!important}}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;padding:24px 28px;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2.5px solid #1a1a1a}
.logo-area{display:flex;align-items:center;gap:12px}
.logo-img{width:52px;height:52px;object-fit:contain}
.brand{font-size:20px;font-weight:700;letter-spacing:.12em;color:#1a1a1a}
.brand-sub{font-size:10px;color:#666;margin-top:3px}
.doc-info{text-align:right}
.doc-title{font-size:11px;font-weight:700;color:#e5484d;text-transform:uppercase;letter-spacing:.06em}
.doc-no{font-size:26px;font-weight:700;color:#1a1a1a;margin-top:2px}
.doc-date{font-size:10px;color:#888;margin-top:3px}
.status-ok{display:inline-block;background:#e8f8ef;border:1px solid #86efb5;border-radius:20px;padding:3px 12px;font-size:10px;font-weight:700;color:#166534;margin-top:6px}
.sec-title{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.1em;margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #e0e0e0}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.mt8{margin-top:8px}
.fbox{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:6px;padding:8px 11px}
.flbl{font-size:8.5px;color:#999;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
.fval{font-size:12.5px;font-weight:600;color:#1a1a1a}
.fval.red{color:#e5484d}
.fval.green{color:#22a05b}
.notlar{background:#fffbf0;border:1px solid #f0e0a0;border-radius:6px;padding:9px 12px;font-size:11.5px;color:#555;line-height:1.6;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:5px}
thead{display:table-header-group}
thead th{background:#1a1a1a;color:#fff;padding:5px 8px;text-align:left;font-size:10px;font-weight:600}
tbody td{padding:5px 8px;border-bottom:1px solid #f0f0f0;color:#333}
tbody tr{page-break-inside:avoid}
.tot-row td{background:#f5f5f5;font-weight:700;border-top:2px solid #ddd;color:#1a1a1a;page-break-inside:avoid}
.onay-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:5px}
.onay-box{border:1.5px solid #ddd;border-radius:7px;padding:14px}
.onay-t{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.07em;margin-bottom:28px}
.onay-b{border-top:1px solid #ccc;padding-top:7px;font-size:9px;color:#aaa;text-align:center}
.footer{margin-top:18px;padding-top:10px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;font-size:9px;color:#bbb}
@media print{
  .footer{position:fixed;bottom:5mm;left:10mm;right:10mm;background:#fff;border-top:1px solid #ddd}
  body{margin-bottom:20mm}
}
.page-footer{position:running(footer);font-size:9px;color:#bbb;text-align:center}
@media print{.onay-grid{page-break-inside:avoid}.imza-her-sayfa{display:block} @page{@bottom-center{content:element(footer)}}}
@media print{@page{margin:10mm;size:A4;} @page{margin-top:10mm;margin-bottom:10mm;} body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}} @media print{a[href]:after{content:none!important}} * { -webkit-print-color-adjust: exact; }
</style></head><body>
<div class="header">
  <div class="logo-area">
    <img src="${window.location.origin}/logo.png" class="logo-img" onerror="this.style.display='none'">
    <div><div class="brand">MOTORCUM</div><div class="brand-sub">Motor Servis Yonetim Sistemi</div></div>
  </div>
  <div class="doc-info">
    <div class="doc-title">Servis Formu</div>
    <div class="doc-no">#${isEmri.is_emri_no}</div>
    <div class="doc-date">${new Date(isEmri.created_at).toLocaleDateString('tr-TR')}</div>
    <div><span class="status-ok">&#10003; Tamamlandi</span></div>
  </div>
</div>
<!-- Her sayfada tekrar eden mini header -->
<div style="display:none" class="page-header" id="ph">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:6px">
    <div style="font-size:11px;font-weight:700;color:#1a1a1a">MOTORCUM &mdash; Servis Formu</div>
    <div style="font-size:11px;color:#888">#${isEmri.is_emri_no} &middot; ${formatPlaka(isEmri.araclar?.plaka)||''} &middot; ${isEmri.musteriler?.ad||''} ${isEmri.musteriler?.soyad||''}</div>
  </div>
</div>
<div class="sec-title">Musteri Bilgileri</div>
<div class="two-col">
  <div class="fbox"><div class="flbl">Ad Soyad</div><div class="fval">${isEmri.musteriler?.ad||''} ${isEmri.musteriler?.soyad||''}</div></div>
  <div class="fbox"><div class="flbl">Telefon</div><div class="fval">${isEmri.musteriler?.telefon||'-'}</div></div>
</div>
<div class="sec-title">Arac Bilgileri</div>
<div class="three-col">
  <div class="fbox"><div class="flbl">Plaka</div><div class="fval red">${formatPlaka(isEmri.araclar?.plaka)||'-'}</div></div>
  <div class="fbox"><div class="flbl">Marka / Model</div><div class="fval">${isEmri.araclar?.marka||''} ${isEmri.araclar?.model||''}</div></div>
  <div class="fbox"><div class="flbl">Yil / Renk</div><div class="fval">${isEmri.araclar?.yil||'-'} / ${isEmri.araclar?.renk||'-'}</div></div>
</div>
<div class="two-col mt8">
  <div class="fbox"><div class="flbl">Kilometre</div><div class="fval">${isEmri.arac_km?Number(isEmri.arac_km).toLocaleString('tr-TR')+' km':'-'}</div></div>
  <div class="fbox"><div class="flbl">Teknisyen</div><div class="fval">${isEmri.personel?isEmri.personel.ad+' '+isEmri.personel.soyad:'-'}</div></div>
</div>
${isEmri.sikayet?'<div class="sec-title">Musteri Sikayeti</div><div class="notlar">'+isEmri.sikayet+'</div>':''}
${isEmri.yapilan_isler?'<div class="sec-title">Yapilan Islemler</div><div class="notlar">'+isEmri.yapilan_isler+'</div>':''}
${parcalarHTML}
<div class="sec-title">Odeme Bilgisi</div>
<div class="three-col">
  <div class="fbox"><div class="flbl">Odeme Durumu</div><div class="fval ${isEmri.odeme_durumu==='odendi'?'green':''}">${isEmri.odeme_durumu==='odendi'?'&#10003; Odendi':isEmri.odeme_durumu==='kismi'?'Kismi':'-'}</div></div>
  <div class="fbox"><div class="flbl">Odeme Turu</div><div class="fval">${isEmri.odeme_turu||'-'}</div></div>
  <div class="fbox"><div class="flbl">Tarih</div><div class="fval">${new Date(isEmri.created_at).toLocaleDateString('tr-TR')}</div></div>
</div>
${isEmri.notlar?'<div class="sec-title">Notlar</div><div class="notlar">'+isEmri.notlar+'</div>':''}
<div style="page-break-inside:avoid;margin-top:16px">
  <div class="sec-title">Onay</div>
  <div class="onay-grid">
    <div class="onay-box"><div class="onay-t">Yetkili Imza</div><div class="onay-b">Ad Soyad / Kase</div></div>
    <div class="onay-box"><div class="onay-t">Musteri Imzasi</div><div class="onay-b">Araci teslim aldim</div></div>
  </div>
</div>
<div class="footer">
  <div>MOTORCUM Servis Yonetim Sistemi</div>
  <div>Is Emri #${isEmri.is_emri_no} &middot; ${new Date().toLocaleString('tr-TR')}</div>
</div>
</body></html>`

    // iframe ile print - popup engelini aşar
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:white'
    document.body.appendChild(iframe)
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    iframe.contentWindow.focus()
    setTimeout(() => {
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 600)
    setPrintBlocked(false)
  }

  return (
    <div className="modal-overlay" onClick={onKapat}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:420}}>
        <div className="modal-header">
          <span className="modal-title">🖨️ İş Emri #{isEmri.is_emri_no} — Servis Formu</span>
          <button className="modal-close" onClick={onKapat}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:'8px',padding:'12px',marginBottom:'12px',fontSize:'12px',color:'var(--text-secondary)',lineHeight:1.6}}>
            <div style={{fontWeight:600,color:'var(--text-primary)',marginBottom:'6px'}}>📋 Form içeriği:</div>
            <div>✓ Müşteri bilgileri</div>
            <div>✓ Araç bilgileri (plaka, marka, model, km)</div>
            <div>✓ Müşteri şikayeti ve yapılan işlemler</div>
            <div>✓ Parçalar ve tutar ({parcalar.length} kalem)</div>
            <div>✓ Ödeme bilgisi</div>
            <div>✓ İmza alanları</div>
          </div>
          <div style={{display:'flex',gap:'8px',flexDirection:'column'}}>
            <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',userSelect:'none',padding:'8px 12px',background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:'8px'}}>
              <input type="checkbox" checked={tutarGizle} onChange={e => setTutarGizle(e.target.checked)} style={{width:'15px',height:'15px',accentColor:'#e5484d'}} />
              <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Çıktıda tutarları gizle</span>
            </label>
            <button className="btn btn-primary" style={{width:'100%',height:40,fontSize:'13px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
              onClick={handlePrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
              Çıktı Al
            </button>
            {printBlocked && (
              <div style={{background:'rgba(245,166,35,.1)',border:'1px solid rgba(245,166,35,.3)',borderRadius:'7px',padding:'10px 12px',fontSize:'12px',color:'#f5a623',lineHeight:1.5}}>
                ⚠️ Tarayıcı popup'u engelledi. Adres çubuğunun sağındaki <strong>popup engeli ikonuna</strong> tıklayıp <strong>"motorcum.vercel.app için her zaman izin ver"</strong> seçeneğini seçin, sonra tekrar deneyin.
              </div>
            )}
            <button className="btn btn-secondary" style={{width:'100%',height:40,fontSize:'13px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
              onClick={() => alert('Bu özellik yakında: Müşterinin iletişim tercihine göre (SMS / Mail) servis formu gönderilecek.')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.4a16 16 0 0 0 5.55 5.55l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92"/></svg>
              Müşteriye Bildirim Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ParcaAramaSelect = ({ parcaListesi, value, inputValue, onChange, onManual }) => {
  const [query, setQuery] = useState(inputValue || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setQuery(inputValue || '') }, [inputValue])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [])

  const filtered = parcaListesi.filter(p =>
    p.isim.toLowerCase().includes(query.toLowerCase()) ||
    (p.kod && p.kod.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div ref={ref} style={{position:'relative'}}>
      <input
        value={query}
        onChange={e => { const v = e.target.value.toUpperCase(); setQuery(v); setOpen(true); onManual(v) }}
        onFocus={() => setOpen(true)}
        placeholder="Parça adı yazın veya listeden seçin..."
        autoComplete="off"
        style={{background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:'7px', padding:'7px 10px', color:'var(--text-primary)', fontSize:'13px', fontFamily:'Inter,sans-serif', outline:'none', width:'100%', transition:'border-color .12s'}}
      />
      {open && filtered.length > 0 && (
        <div style={{position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'8px', zIndex:9999, maxHeight:'200px', overflowY:'auto', boxShadow:'var(--shadow)'}}>
          {filtered.map(p => (
            <div key={p.id}
              onPointerDown={e => { e.preventDefault(); const isimBuyuk = p.isim.toUpperCase(); onChange(p.id, isimBuyuk, p.birim_fiyat); setQuery(isimBuyuk); setOpen(false) }}
              style={{padding:'8px 12px', cursor:'pointer', fontFamily:'Inter, sans-serif', fontStyle:'normal', fontSize:'12.5px', display:'flex', justifyContent:'space-between', alignItems:'center', color: value===p.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: value===p.id ? 'rgba(229,72,77,.08)' : 'transparent'}}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = value===p.id ? 'rgba(229,72,77,.08)' : 'transparent'}
            >
              <span>{p.isim} {p.kod && <span style={{color:'var(--text-muted)',fontSize:'11px'}}>({p.kod})</span>}</span>
              <span style={{color:'#22c55e', fontWeight:600, fontSize:'12px'}}>₺{parseFloat(p.birim_fiyat||0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ParcaYonetim = ({ isEmriId, parcalar, setParcalar, kapali = false, onTutarGuncelle, fiyatGizli = false }) => {
  const [parcaListesi, setParcaListesi] = useState([])
  const [yeniParca, setYeniParca] = useState({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0 })
  const [ekleniyor, setEkleniyor] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [silmeOnayId, setSilmeOnayId] = useState(null)

  useEffect(() => {
    supabase.from('parcalar').select('*').eq('aktif', true).order('isim')
      .then(({ data }) => setParcaListesi(data || []))
  }, [])

  const handleParcaSec = (id) => {
    const sec = parcaListesi.find(p => p.id === id)
    if (sec) setYeniParca(prev => ({ ...prev, parca_id: id, parca_isim: sec.isim, birim_fiyat: sec.birim_fiyat }))
    else setYeniParca(prev => ({ ...prev, parca_id: id }))
  }

  const handleEkle = async () => {
    if (!yeniParca.parca_isim.trim()) return
    setEkleniyor(true)
    let kaydedilecek = { ...yeniParca }
    if (!yeniParca.parca_id) {
      const { parca_id, isim } = await parcaTaniminiGaranileGetir(yeniParca.parca_isim, yeniParca.birim_fiyat, parcaListesi)
      kaydedilecek = { ...yeniParca, parca_id, parca_isim: isim }
      if (parca_id) setParcaListesi(prev => [...prev, { id: parca_id, isim, birim_fiyat: yeniParca.birim_fiyat }])
    }
    const toplam = parseFloat(kaydedilecek.miktar || 1) * parseFloat(kaydedilecek.birim_fiyat || 0)
    const { data, error } = await supabase.from('is_emri_parcalari').insert({
      is_emri_id: isEmriId,
      parca_id: kaydedilecek.parca_id || null,
      parca_isim: kaydedilecek.parca_isim,
      miktar: parseFloat(kaydedilecek.miktar || 1),
      birim_fiyat: parseFloat(kaydedilecek.birim_fiyat || 0),
      toplam,
    }).select().single()
    if (!error && data) {
      const yeniParcalar = [...parcalar, data]
      setParcalar(yeniParcalar)
      // Toplam tutarı güncelle (parça toplamı + işçilik)
      const yeniToplam = yeniParcalar.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)
      await supabase.from('is_emirleri').update({ toplam_tutar: yeniToplam }).eq('id', isEmriId)
      if (onTutarGuncelle) onTutarGuncelle(yeniToplam)
      setYeniParca({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0 })
      setFormAcik(false)
    }
    setEkleniyor(false)
  }

  const handleSil = async (id) => {
    if (silmeOnayId !== id) { setSilmeOnayId(id); return }
    setSilmeOnayId(null)
    await supabase.from('is_emri_parcalari').delete().eq('id', id)
    const kalanlar = parcalar.filter(p => p.id !== id)
    setParcalar(kalanlar)
    const yeniToplam = kalanlar.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)
    await supabase.from('is_emirleri').update({ toplam_tutar: yeniToplam }).eq('id', isEmriId)
    if (onTutarGuncelle) onTutarGuncelle(yeniToplam)
  }

  const handleGuncelle = async (id, field, value) => {
    const p = parcalar.find(p => p.id === id)
    if (!p) return
    const yeniMiktar = field === 'miktar' ? parseFloat(value || 1) : parseFloat(p.miktar || 1)
    const yeniFiyat = field === 'birim_fiyat' ? parseFloat(value || 0) : parseFloat(p.birim_fiyat || 0)
    const yeniToplam = yeniMiktar * yeniFiyat
    await supabase.from('is_emri_parcalari').update({
      [field]: field === 'miktar' ? yeniMiktar : yeniFiyat,
      toplam: yeniToplam
    }).eq('id', id)
    const guncellenmis = parcalar.map(p => p.id === id ? { ...p, [field]: field === 'miktar' ? yeniMiktar : yeniFiyat, toplam: yeniToplam } : p)
    setParcalar(guncellenmis)
    const yeniToplamTutar = guncellenmis.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)
    await supabase.from('is_emirleri').update({ toplam_tutar: yeniToplamTutar }).eq('id', isEmriId)
    if (onTutarGuncelle) onTutarGuncelle(yeniToplamTutar)
  }

  const toplam = parcalar.reduce((s, p) => s + parseFloat(p.toplam || 0), 0)

  const listeRef = useRef(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* SABİT EKLEME FORMU */}
      {!kapali && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>Parça Ekle</div>
          <div style={{ display: 'grid', gridTemplateColumns: fiyatGizli ? 'repeat(auto-fit, minmax(130px, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label>Parça Ara / Seç</label>
              <ParcaAramaSelect
                parcaListesi={parcaListesi}
                value={yeniParca.parca_id}
                inputValue={yeniParca.parca_isim}
                onChange={(id, isim, fiyat) => setYeniParca(p => ({...p, parca_id: id, parca_isim: isim, birim_fiyat: fiyat}))}
                onManual={(isim) => setYeniParca(p => ({...p, parca_id: '', parca_isim: isim}))}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Miktar</label>
              <input type="number" min="1" step="0.5" value={yeniParca.miktar} className="no-spinner" onChange={e => setYeniParca(p => ({ ...p, miktar: e.target.value }))} />
            </div>
            {!fiyatGizli && (
              <div className="field" style={{ margin: 0 }}>
                <label>Birim Fiyat</label>
                <input type="number" min="0" step="0.01" value={yeniParca.birim_fiyat} className="no-spinner"
                  onFocus={e => e.target.select()}
                  onChange={e => setYeniParca(p => ({ ...p, birim_fiyat: e.target.value }))} />
              </div>
            )}
            <button className="btn btn-primary" onClick={handleEkle} disabled={ekleniyor}
              style={{ height: '38px', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
              {ekleniyor ? '...' : '+ Ekle'}
            </button>
          </div>
        </div>
      )}

      {/* PARÇA LİSTESİ */}
      {parcalar.length === 0 ? (
        <div className="empty-state" style={{ padding: '1rem' }}>
          <div className="empty-state-icon">🔩</div><p>Parça kaydı yok</p>
        </div>
      ) : (
        <div ref={listeRef} style={{ maxHeight: '220px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Parça</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '55px' }}>Adet</th>
                {!fiyatGizli && <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '90px' }}>Fiyat</th>}
                {!fiyatGizli && <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '90px' }}>Toplam</th>}
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {parcalar.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: 500 }}>{p.parca_isim}</td>
                  <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                    {kapali ? p.miktar : (
                      <input type="number" min="0.5" step="0.5" defaultValue={p.miktar}
                        onFocus={e => e.target.select()}
                        onBlur={e => handleGuncelle(p.id, 'miktar', e.target.value)}
                        style={{ width: '70px', textAlign: 'center', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '12px', MozAppearance: 'textfield', appearance: 'textfield' }} className="no-spinner"
                      />
                    )}
                  </td>
                  {!fiyatGizli && (
                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>
                      {kapali ? `₺${parseFloat(p.birim_fiyat||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}` : (
                        <input type="number" min="0" step="0.01" defaultValue={p.birim_fiyat}
                          onFocus={e => e.target.select()}
                          onBlur={e => handleGuncelle(p.id, 'birim_fiyat', e.target.value)}
                          style={{ width: '95px', textAlign: 'right', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '12px', MozAppearance: 'textfield', appearance: 'textfield' }} className="no-spinner"
                        />
                      )}
                    </td>
                  )}
                  {!fiyatGizli && (
                    <td style={{ textAlign: 'right', padding: '7px 8px', color: '#22c55e', fontWeight: 600 }}>₺{parseFloat(p.toplam||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                  )}
                  <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                    {!kapali && (
                      silmeOnayId === p.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                          <button type="button" onClick={() => handleSil(p.id)}
                            title="Onayla, sil"
                            style={{ background: '#e5484d', border: 'none', borderRadius: '5px', cursor: 'pointer', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 8px' }}>
                            Sil?
                          </button>
                          <button type="button" onClick={() => setSilmeOnayId(null)}
                            title="Vazgeç"
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px', padding: '4px 6px' }}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => handleSil(p.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e5484d', fontSize: '14px', padding: '2px 4px' }}>
                          🗑️
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {!fiyatGizli && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>Toplam</td>
                  <td style={{ textAlign: 'right', padding: '8px 8px', color: '#22c55e', fontWeight: 700, fontSize: '14px' }}>₺{toplam.toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

const IsEmriDetay = ({ is: initialIs, onKapat, onDurumGuncelle, onGuncellendi, onYazdir }) => {
  const { profile } = useAuth()
  const fiyatGizliTeknisyen = profile?.rol === 'teknisyen'
  const [isEmri, setIsEmri] = useState(initialIs)
  const [parcalar, setParcalar] = useState([])
  const [aktifTab, setAktifTab] = useState('detay')
  const [personelList, setPersonelList] = useState([])
  const [duzenle, setDuzenle] = useState(false)
  const [form, setForm] = useState({
    personel_id: initialIs.personel_id || '',
    sikayet: initialIs.sikayet || '',
    yapilan_isler: initialIs.yapilan_isler || '',
    notlar: initialIs.notlar || '',
    arac_km: initialIs.arac_km || '',
    toplam_tutar: initialIs.toplam_tutar || '',
    odeme_durumu: initialIs.odeme_durumu || 'odenmedi',
    odeme_turu: initialIs.odeme_turu || '',
    tahmini_cikis: initialIs.tahmini_cikis ? initialIs.tahmini_cikis.slice(0,16) : '',
  })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [msg, setMsg] = useState('')

  const kapali = ['tamamlandi', 'teslim_edildi', 'iptal'].includes(isEmri.durum)

  useEffect(() => {
    supabase.from('is_emri_parcalari').select('*').eq('is_emri_id', isEmri.id).order('created_at')
      .then(({ data }) => setParcalar(data || []))
    supabase.from('personel').select('id, ad, soyad').eq('aktif', true).order('ad')
      .then(({ data }) => setPersonelList(data || []))
  }, [isEmri.id])

  // Düzenle moduna girerken form'u GÜNCEL isEmri verisiyle senkronla
  // (Parça eklenip-silinip sonra Düzenle'ye basılırsa stale veri kullanılmasın)
  // Düzenle moduna girerken form'u GÜNCEL isEmri verisiyle senkronla
  // (Parça eklenip-silinip sonra Düzenle'ye basılırsa stale veri kullanılmasın)
  const duzenleAc = () => {
    setForm({
      personel_id: isEmri.personel_id || '',
      sikayet: isEmri.sikayet || '',
      yapilan_isler: isEmri.yapilan_isler || '',
      notlar: isEmri.notlar || '',
      arac_km: isEmri.arac_km || '',
      toplam_tutar: isEmri.toplam_tutar || '',
      odeme_durumu: isEmri.odeme_durumu || 'odenmedi',
      odeme_turu: isEmri.odeme_turu || '',
      tahmini_cikis: isEmri.tahmini_cikis ? isEmri.tahmini_cikis.slice(0,16) : '',
    })
    setDuzenle(true)
  }

  const handleKaydet = async () => {
    setKaydediliyor(true)
    const { error } = await supabase.from('is_emirleri').update({
      personel_id: form.personel_id || null,
      sikayet: form.sikayet,
      yapilan_isler: form.yapilan_isler,
      notlar: form.notlar,
      arac_km: form.arac_km ? parseInt(form.arac_km) : null,
      odeme_durumu: form.odeme_durumu,
      odeme_turu: form.odeme_turu || null,
      tahmini_cikis: form.tahmini_cikis || null,
    }).eq('id', isEmri.id)
    if (!error) {
      const yeniPersonel = personelList.find(p => p.id === form.personel_id)
      setIsEmri(prev => ({ ...prev, ...form, personel: yeniPersonel || prev.personel }))
      setDuzenle(false)
      setMsg('✅ Kaydedildi!')
      setTimeout(() => setMsg(''), 3000)
      if (onGuncellendi) onGuncellendi()
    }
    setKaydediliyor(false)
  }

  const handleDurumDegistir = async (yeniDurum) => {
    await supabase.from('is_emirleri').update({ durum: yeniDurum }).eq('id', isEmri.id)
    setIsEmri(prev => ({ ...prev, durum: yeniDurum }))
    if (onDurumGuncelle) onDurumGuncelle(isEmri.id, yeniDurum, null)
  }

  const handleOdemeDegistir = async (yeniOdeme) => {
    const updates = { odeme_durumu: yeniOdeme }
    if (yeniOdeme === 'odendi') updates.odenen_tutar = isEmri.toplam_tutar
    if (yeniOdeme === 'odenmedi') updates.odenen_tutar = 0
    await supabase.from('is_emirleri').update(updates).eq('id', isEmri.id)
    setIsEmri(prev => ({ ...prev, odeme_durumu: yeniOdeme, odenen_tutar: updates.odenen_tutar ?? prev.odenen_tutar }))
    setForm(prev => ({ ...prev, odeme_durumu: yeniOdeme }))
    if (onDurumGuncelle) onDurumGuncelle(isEmri.id, null, yeniOdeme)
  }

  const durumBadge = (d) => {
    const map = { bekliyor:['badge-bekliyor','Bekliyor'], devam_ediyor:['badge-devam','Devam Ediyor'], tamamlandi:['badge-tamamlandi','Tamamlandı'], teslim_edildi:['badge-teslim','Teslim Edildi'], iptal:['badge-iptal','İptal'] }
    const [cls,label] = map[d]||['badge-normal',d]
    return <span className={`badge ${cls}`}>{label}</span>
  }

  const odemeBadge = (d) => {
    const map = { odenmedi:['badge-odenmedi','Ödenmedi'], kismi:['badge-kismi','Kısmi'], odendi:['badge-odendi','Ödendi'] }
    const [cls,label] = map[d]||['badge-normal',d]
    return <span className={`badge ${cls}`}>{label}</span>
  }

  const tabStyle = (id) => ({
    background:'none', border:'none',
    color: aktifTab===id ? '#e5484d':'var(--text-muted)',
    fontFamily:'Inter,sans-serif', fontSize:'clamp(11px, 2.5vw, 13px)', fontWeight:600,
    padding:'0.5rem clamp(8px, 2vw, 16px)', cursor:'pointer',
    borderBottom: aktifTab===id ? '2px solid #e5484d':'2px solid transparent',
    marginBottom:'-1px', whiteSpace:'nowrap', transition:'color .12s', flex:1, textAlign:'center'
  })

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <div>
            <span className="modal-title">İş Emri #{isEmri.is_emri_no}</span>
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.3rem', alignItems:'center' }}>
              {durumBadge(isEmri.durum)}
              {odemeBadge(isEmri.odeme_durumu)}
              {kapali && <span style={{fontSize:'0.75rem',color:'var(--text-muted)',background:'var(--bg-elevated)',padding:'2px 8px',borderRadius:'20px',border:'1px solid var(--border)'}}>🔒 Kilitli</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onKapat}>✕</button>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <button style={tabStyle('detay')} onClick={() => setAktifTab('detay')}>📋 Detay</button>
          <button style={tabStyle('parcalar')} onClick={() => setAktifTab('parcalar')}>🔩 Parça ({parcalar.length})</button>
          <button style={tabStyle('islemler')} onClick={() => setAktifTab('islemler')}>🔧 İşlem</button>
          <button style={tabStyle('durum')} onClick={() => setAktifTab('durum')}>🔄 Durum</button>
        </div>

        <div className="modal-body">
          {msg && <div className="alert alert-success" style={{marginBottom:'0.75rem'}}>{msg}</div>}

          {/* DETAY SEKMESİ */}
          {aktifTab === 'detay' && (
            <div>
              {!kapali && (
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.75rem',gap:'0.5rem'}}>
                  {duzenle
                    ? <>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDuzenle(false)}>İptal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleKaydet} disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : '💾 Kaydet'}</button>
                      </>
                    : <button className="btn btn-secondary btn-sm" onClick={duzenleAc}>✏️ Düzenle</button>
                  }
                </div>
              )}
              <div className="form-grid">
                <div className="field"><label>Müşteri</label><input readOnly value={`${isEmri.musteriler?.ad||''} ${isEmri.musteriler?.soyad||''}`} /></div>
                <div className="field">
                  <label>Telefon</label>
                  {isEmri.musteriler?.telefon ? (
                    <a href={`tel:${isEmri.musteriler.telefon}`} style={{ textDecoration:'none' }}>
                      <input readOnly value={formatTelefon(isEmri.musteriler.telefon)} style={{ cursor:'pointer', color:'#e5484d' }} />
                    </a>
                  ) : (
                    <input readOnly value="-" />
                  )}
                </div>
                <div className="field"><label>Araç</label><input readOnly value={`${formatPlaka(isEmri.araclar?.plaka)||''} — ${isEmri.araclar?.marka||''} ${isEmri.araclar?.model||''}`} /></div>
                <div className="field"><label>Kayıt Tarihi</label><input readOnly value={new Date(isEmri.created_at).toLocaleString('tr-TR')} /></div>
                <div className="field">
                  <label>Tahmini Çıkış</label>
                  {duzenle
                    ? <input type="datetime-local" value={form.tahmini_cikis} onChange={e => setForm(f => ({...f, tahmini_cikis: e.target.value}))} />
                    : <input readOnly value={isEmri.tahmini_cikis ? new Date(isEmri.tahmini_cikis).toLocaleString('tr-TR') : '-'} />
                  }
                </div>
                <div className="field">
                  <label>Araç KM</label>
                  {duzenle
                    ? <input type="number" value={form.arac_km} onChange={e => setForm(f => ({...f, arac_km: e.target.value}))} />
                    : <input readOnly value={isEmri.arac_km || '-'} />
                  }
                </div>
                {!fiyatGizliTeknisyen && (
                  <div className="field">
                    <label>Toplam Tutar (₺)</label>
                    <input readOnly disabled value={`₺${(isEmri.toplam_tutar||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}`} style={{color:'#22c55e',fontWeight:700,cursor:'not-allowed',opacity:0.85}} />
                    <span style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'4px',display:'block'}}>Parça sekmesinden düzenlenir</span>
                  </div>
                )}
                <div className="field form-full">
                  <label>Müşteri Şikayeti</label>
                  {duzenle
                    ? <textarea rows={2} value={form.sikayet} onChange={e => setForm(f => ({...f, sikayet: e.target.value}))} />
                    : <textarea readOnly rows={2} value={isEmri.sikayet || '-'} />
                  }
                </div>
                <div className="field form-full">
                  <label>Yapılan İşlemler</label>
                  {duzenle
                    ? <textarea rows={3} value={form.yapilan_isler} onChange={e => setForm(f => ({...f, yapilan_isler: e.target.value}))} />
                    : <textarea readOnly rows={3} value={isEmri.yapilan_isler || '-'} />
                  }
                </div>
                <div className="field form-full">
                  <label>Notlar</label>
                  {duzenle
                    ? <textarea rows={2} value={form.notlar} onChange={e => setForm(f => ({...f, notlar: e.target.value}))} />
                    : <textarea readOnly rows={2} value={isEmri.notlar || '-'} />
                  }
                </div>
              </div>
            </div>
          )}

          {/* PARÇALAR SEKMESİ */}
          {aktifTab === 'parcalar' && (
            <ParcaYonetim isEmriId={isEmri.id} parcalar={parcalar} setParcalar={setParcalar} kapali={kapali} fiyatGizli={fiyatGizliTeknisyen} onTutarGuncelle={(t) => setIsEmri(prev => ({...prev, toplam_tutar: t}))} />
          )}

          {/* İŞLEMLER SEKMESİ */}
          {aktifTab === 'islemler' && (
            <div className="form-grid">
              <div className="field form-full">
                <label>Teknisyen / Sorumlu</label>
                {duzenle && !kapali ? (
                  <CustomSelect value={form.personel_id || ''} onChange={v => setForm(f => ({...f, personel_id: v}))} placeholder="— Seçin"
                    options={personelList.map(p => ({ value: p.id, label: `${p.ad} ${p.soyad}` }))} />
                ) : (
                  <input readOnly value={isEmri.personel ? `${isEmri.personel.ad} ${isEmri.personel.soyad}` : '-'} />
                )}
              </div>
              <div className="field form-full">
                <label>Müşteri Şikayeti</label>
                {duzenle
                  ? <textarea rows={2} value={form.sikayet} onChange={e => setForm(f => ({...f, sikayet: e.target.value}))} />
                  : <textarea readOnly rows={2} value={isEmri.sikayet || '-'} />
                }
              </div>
              <div className="field form-full">
                <label>Yapılan İşlemler</label>
                {duzenle
                  ? <textarea rows={3} value={form.yapilan_isler} onChange={e => setForm(f => ({...f, yapilan_isler: e.target.value}))} />
                  : <textarea readOnly rows={3} value={isEmri.yapilan_isler || '-'} />
                }
              </div>
              <div className="field form-full">
                <label>Notlar</label>
                {duzenle
                  ? <textarea rows={2} value={form.notlar} onChange={e => setForm(f => ({...f, notlar: e.target.value}))} />
                  : <textarea readOnly rows={2} value={isEmri.notlar || '-'} />
                }
              </div>
              {!kapali && (
                <div className="field form-full" style={{display:'flex',justifyContent:'flex-end',gap:'0.5rem'}}>
                  {duzenle
                    ? <>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDuzenle(false)}>İptal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleKaydet} disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : '💾 Kaydet'}</button>
                      </>
                    : <button className="btn btn-secondary btn-sm" onClick={duzenleAc}>✏️ Düzenle</button>
                  }
                </div>
              )}
            </div>
          )}

          {/* DURUM SEKMESİ */}
          {aktifTab === 'durum' && (
            <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>

              {/* MÜŞTERİ İLETİŞİM - tamamlandı/teslim edildi durumunda göster */}
              {['tamamlandi','teslim_edildi'].includes(isEmri.durum) && isEmri.musteriler?.telefon && (
                <div style={{
                  background: 'rgba(34,197,94,.08)',
                  border: '1px solid rgba(34,197,94,.2)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}>
                  <div>
                    <div style={{fontSize:'10px',fontWeight:600,color:'#22c55e',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'2px'}}>
                      📞 Müşteri İletişim
                    </div>
                    <div style={{fontSize:'14px',fontWeight:600,color:'var(--text-primary)'}}>
                      {isEmri.musteriler?.ad} {isEmri.musteriler?.soyad}
                    </div>
                    <div style={{fontSize:'13px',color:'var(--text-secondary)'}}>
                      {formatTelefon(isEmri.musteriler.telefon)}
                    </div>
                  </div>
                  <a href={`tel:${isEmri.musteriler.telefon}`} className="btn btn-primary btn-sm" style={{textDecoration:'none', whiteSpace:'nowrap'}}>
                    📞 Ara
                  </a>
                </div>
              )}

              {/* İŞ EMRİ DURUMU */}
              <div>
                <div style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'8px'}}>
                  İş Emri Durumu
                </div>
                {kapali ? (
                  <div>
                    <div className="alert alert-error" style={{marginBottom:'0.75rem'}}>🔒 Bu iş emri kapalı — durum değiştirilemez.</div>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      <button className="btn btn-secondary btn-sm" onClick={async () => {
                        if (window.confirm('Bu iş emrini yeniden açmak istediğinize emin misiniz?')) {
                          await handleDurumDegistir('devam_ediyor')
                        }
                      }}>🔓 Yeniden Aç</button>
                      {['tamamlandi','teslim_edildi'].includes(isEmri.durum) && (
                        <button className="btn btn-primary btn-sm" style={{display:'flex',alignItems:'center',gap:'5px'}}
                          onClick={async () => {
                            const { data: taze } = await supabase
                              .from('is_emirleri')
                              .select('*, musteriler(ad, soyad, telefon), araclar(plaka, marka, model, yil, renk, km), personel(ad, soyad)')
                              .eq('id', isEmri.id)
                              .single()
                            onYazdir && onYazdir(taze || isEmri)
                          }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
                          Çıktı Al
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                    {DURUMLAR.map(d => (
                      <button key={d}
                        className={`btn btn-sm ${isEmri.durum===d?'btn-primary':'btn-secondary'}`}
                        onClick={() => handleDurumDegistir(d)}>
                        {DURUMLAR_TR[d]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ÖDEME DURUMU */}
              <div>
                <div style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'8px'}}>
                  Ödeme Durumu
                </div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {[['odenmedi','Ödenmedi','#e5484d'],['kismi','Kısmi Ödeme','#f5a623'],['odendi','Ödendi','#22c55e']].map(([val,label,color]) => (
                    <button key={val} type="button"
                      className={`btn btn-sm ${isEmri.odeme_durumu===val ? 'btn-primary' : 'btn-secondary'}`}
                      style={isEmri.odeme_durumu===val ? {background:color,borderColor:color} : {}}
                      onClick={() => handleOdemeDegistir(val)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ÖDEME TÜRÜ */}
              {isEmri.odeme_durumu !== 'odenmedi' && (
                <div>
                  <div style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'8px'}}>
                    Ödeme Türü
                  </div>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {ODEME_TURLERI.map(o => (
                      <button key={o} type="button"
                        className={`btn btn-sm ${isEmri.odeme_turu===o ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={async () => {
                          await supabase.from('is_emirleri').update({odeme_turu: o}).eq('id', isEmri.id)
                          setIsEmri(prev => ({ ...prev, odeme_turu: o }))
                          setForm(prev => ({ ...prev, odeme_turu: o }))
                          onGuncellendi && onGuncellendi()
                        }}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* KISMİ ÖDEME TUTARI */}
              {isEmri.odeme_durumu === 'kismi' && (
                <div>
                  <div style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'8px'}}>
                    Ödenen Tutar
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={isEmri.odenen_tutar || 0}
                      onBlur={async (e) => {
                        const tutar = parseFloat(e.target.value || 0)
                        await supabase.from('is_emirleri').update({odenen_tutar: tutar}).eq('id', isEmri.id)
                        setIsEmri(prev => ({ ...prev, odenen_tutar: tutar }))
                        onGuncellendi && onGuncellendi()
                      }}
                      style={{
                        background:'var(--bg-base)', border:'1px solid var(--border)',
                        borderRadius:'8px', padding:'8px 12px', color:'var(--text-primary)',
                        fontSize:'14px', fontWeight:600, width:'150px', outline:'none'
                      }}
                    />
                    <span style={{fontSize:'12px',color:'var(--text-muted)'}}>
                      / ₺{(isEmri.toplam_tutar||0).toLocaleString('tr-TR')} toplam
                    </span>
                  </div>
                  <div style={{fontSize:'11px',color:'#f5a623',marginTop:'6px'}}>
                    Kalan: ₺{((isEmri.toplam_tutar||0) - (isEmri.odenen_tutar||0)).toLocaleString('tr-TR')}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const IsEmirleri = ({ acikIsEmri, onAcikIsEmriTemizle }) => {
  const { profile } = useAuth()
  const rakamGizli = ['teknisyen', 'kullanici', 'admin'].includes(profile?.rol)
  const sinirliGorus = ['teknisyen', 'kullanici'].includes(profile?.rol)
  const [isler, setIsler] = useState([])
  const [kisiselPersonelId, setKisiselPersonelId] = useState(null)
  const [arama, setArama] = useState('')
  const [musteriFiltre, setMusteriFiltre] = useState('')
  const [personelFiltre, setPersonelFiltre] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('')
  const [odemeFiltre, setOdemeFiltre] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAcik, setModalAcik] = useState(false)
  const [detayModal, setDetayModal] = useState(null)
  const [yazdirModal, setYazdirModal] = useState(null)
  const [musteriler, setMusteriler] = useState([])
  const [personelList, setPersonelList] = useState([])

  useEffect(() => { if (profile) fetchData() }, [profile])

  useEffect(() => {
    if (acikIsEmri) {
      setDetayModal(acikIsEmri)
      if (onAcikIsEmriTemizle) onAcikIsEmriTemizle()
    }
  }, [acikIsEmri])

  const fetchData = async () => {
    if (!profile) return

    const sinirli = ['teknisyen', 'kullanici'].includes(profile?.rol)

    // Sinirli rol ise önce personel tablosundan kendi id'sini bul
    let personelId = null
    if (sinirli && profile?.email) {
      const { data: pData } = await supabase
        .from('personel')
        .select('id')
        .eq('email', profile.email)
        .maybeSingle()
      personelId = pData?.id || null
      setKisiselPersonelId(personelId)
    }

    let isQuery = supabase
      .from('is_emirleri')
      .select('*, musteriler(ad, soyad, telefon), araclar(plaka, marka, model, yil, renk, km), personel(ad, soyad)')
      .order('created_at', { ascending: false })

    // Sinirli rol ise sadece kendi işlerini getir
    if (sinirli) {
      if (personelId) {
        isQuery = isQuery.eq('personel_id', personelId)
      } else {
        // Personel kaydı yoksa hiç iş gösterme
        setIsler([])
        setMusteriler([])
        setPersonelList([])
        setLoading(false)
        return
      }
    }

    const [isRes, mRes, pRes] = await Promise.all([
      isQuery,
      supabase.from('musteriler').select('id, ad, soyad').order('ad'),
      supabase.from('personel').select('id, ad, soyad').eq('aktif', true).order('ad'),
    ])
    setIsler(isRes.data || [])
    setMusteriler(mRes.data || [])
    setPersonelList(pRes.data || [])
    setLoading(false)
  }

  const handleDurumGuncelle = async (id, yeniDurum, yeniOdeme) => {
    const g = {}
    if (yeniDurum) g.durum = yeniDurum
    if (yeniOdeme) g.odeme_durumu = yeniOdeme
    await supabase.from('is_emirleri').update(g).eq('id', id)
    fetchData()
    if (detayModal?.id === id) setDetayModal(prev => ({...prev, ...g}))
  }

  const durumBadge = (d) => {
    const map = { bekliyor:['badge-bekliyor','Bekliyor'], devam_ediyor:['badge-devam','Devam Ediyor'], tamamlandi:['badge-tamamlandi','Tamamlandı'], teslim_edildi:['badge-teslim','Teslim Edildi'], iptal:['badge-iptal','İptal'] }
    const [cls,label] = map[d]||['badge-normal',d]
    return <span className={`badge ${cls}`}>{label}</span>
  }

  // Aktif işler: bekliyor + devam_ediyor — tümü göster
  const aktifIsler = isler.filter(i => {
    const q = arama.toLowerCase()
    const aramaUy = !q || `${i.musteriler?.ad} ${i.musteriler?.soyad} ${i.araclar?.plaka} ${i.is_emri_no}`.toLowerCase().includes(q)
    const musteriUy = !musteriFiltre || i.musteri_id === musteriFiltre
    const personelUy = !personelFiltre || i.personel_id === personelFiltre
    const odemeUy = !odemeFiltre || i.odeme_durumu === odemeFiltre
    return aramaUy && musteriUy && personelUy && odemeUy && ['bekliyor', 'devam_ediyor'].includes(i.durum)
  })

  // Tamamlanan işler: tamamlandi + teslim_edildi + iptal — son 15
  const tamamlananIsler = isler.filter(i => {
    const q = arama.toLowerCase()
    const aramaUy = !q || `${i.musteriler?.ad} ${i.musteriler?.soyad} ${i.araclar?.plaka} ${i.is_emri_no}`.toLowerCase().includes(q)
    const musteriUy = !musteriFiltre || i.musteri_id === musteriFiltre
    const personelUy = !personelFiltre || i.personel_id === personelFiltre
    const odemeUy = !odemeFiltre || i.odeme_durumu === odemeFiltre
    return aramaUy && musteriUy && personelUy && odemeUy && ['tamamlandi', 'teslim_edildi', 'iptal'].includes(i.durum)
  }).slice(0, 15)


  const bekleyen = isler.filter(i => i.durum === 'bekliyor').length
  const devam = isler.filter(i => i.durum === 'devam_ediyor').length
  const tahsilat = isler.filter(i => i.odeme_durumu === 'odenmedi').reduce((s,i) => s+(i.toplam_tutar||0), 0)

  return (
    <div>
      {modalAcik && <IsEmriForm onKaydet={() => { setModalAcik(false); fetchData() }} onIptal={() => setModalAcik(false)} />}
      {yazdirModal && <ServisFormuModal is={yazdirModal} onKapat={() => setYazdirModal(null)} />}
      {detayModal && <IsEmriDetay is={detayModal} onKapat={() => { setDetayModal(null); fetchData() }} onDurumGuncelle={handleDurumGuncelle} onGuncellendi={fetchData} onYazdir={(is) => { setDetayModal(null); setTimeout(() => setYazdirModal(is), 100) }} />}

      <div className="stats-grid" style={{ marginBottom:'1rem' }}>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Bekleyen</span>
            <div className="stat-icon" style={{background:'rgba(245,166,35,.08)'}}><IconClock size={15} color="#f5a623" /></div>
          </div>
          <div className="stat-value" style={{color:'#f5a623'}}>{bekleyen}</div>
          <div className="stat-sub up"><IconTrendUp size={10} color="#22c55e" />aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Devam Eden</span>
            <div className="stat-icon" style={{background:'rgba(59,130,246,.08)'}}><IconTool size={15} color="#3b82f6" /></div>
          </div>
          <div className="stat-value" style={{color:'#3b82f6'}}>{devam}</div>
          <div className="stat-sub">servis</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Bekleyen Tahsilat</span>
            <div className="stat-icon" style={{background:'rgba(229,72,77,.08)'}}><IconLira size={15} color="#e5484d" /></div>
          </div>
          <div className="stat-value" style={{color:'#e5484d', fontSize:'1.3rem'}}>{rakamGizli ? "₺ ***" : `₺${tahsilat.toLocaleString('tr-TR')}`}</div>
          <div className="stat-sub dn"><IconAlert size={10} color="#e5484d" />ödenmedi</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Toplam İş</span>
            <div className="stat-icon" style={{background:'rgba(255,255,255,.04)'}}><IconClipboard size={15} color="#4a5068" /></div>
          </div>
          <div className="stat-value" style={{color:'var(--text-primary)'}}>{rakamGizli ? "***" : isler.length}</div>
          <div className="stat-sub">bu ay</div>
        </div>
      </div>

      {/* Filtreler */}
      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.75rem' }}>
        <input className="search-input" style={{flex:2,minWidth:'150px'}} placeholder="İş no, müşteri, plaka..." value={arama} onChange={e => setArama(e.target.value)} />
        <CustomSelect
          style={{ flex:1, minWidth:'120px' }}
          value={personelFiltre}
          onChange={setPersonelFiltre}
          placeholder="Tüm Personel"
          options={[{ value:'', label:'Tüm Personel' }, ...personelList.map(p => ({ value: p.id, label: `${p.ad} ${p.soyad}` }))]}
        />
        <CustomSelect
          style={{ flex:1, minWidth:'130px' }}
          value={odemeFiltre}
          onChange={setOdemeFiltre}
          placeholder="Tüm Ödemeler"
          options={[
            { value:'', label:'Tüm Ödemeler' },
            { value:'odenmedi', label:'Ödenmedi' },
            { value:'kismi', label:'Kısmi Ödeme' },
            { value:'odendi', label:'Ödendi' },
          ]}
        />
        <button className="btn btn-primary" onClick={() => setModalAcik(true)}>+ İş Emri</button>
      </div>

      {/* AKTİF İŞ EMİRLERİ */}
      <div className="table-card" style={{marginBottom:'1rem'}}>
        <div className="table-header">
          <span className="table-title">⏳ Aktif İş Emirleri <span style={{fontSize:'0.85rem',color:'var(--text-muted)',fontWeight:400}}>({aktifIsler.length})</span></span>
          {(musteriFiltre||personelFiltre||arama||odemeFiltre) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setArama(''); setMusteriFiltre(''); setPersonelFiltre(''); setDurumFiltre(''); setOdemeFiltre('') }}>Temizle</button>
          )}
        </div>
        {loading ? <div className="empty-state"><p>Yükleniyor...</p></div> :
         aktifIsler.length === 0 ? <div className="empty-state"><div className="empty-state-icon">✅</div><p>Aktif iş emri yok</p></div> : (
          <>
          <div className="desktop-only" style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>İş No</th><th>Müşteri</th><th>Araç</th><th>Teknisyen</th><th>Durum</th><th>Ödeme</th><th>Tutar</th><th>Tarih</th><th></th></tr></thead>
              <tbody>
                {aktifIsler.map(is => (
                  <tr key={is.id} onClick={() => setDetayModal(is)} style={{cursor:'pointer'}} onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{fontWeight:700,color:'var(--text-primary)'}}>#{is.is_emri_no}</td>
                    <td style={{color:'var(--text-primary)'}}>{is.musteriler?.ad} {is.musteriler?.soyad}</td>
                    <td><span style={{fontWeight:600,color:'#e5484d'}}>{formatPlaka(is.araclar?.plaka)}</span> <span style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>{is.araclar?.marka}</span></td>
                    <td style={{color:'var(--text-secondary)'}}>{is.personel ? `${is.personel.ad} ${is.personel.soyad}` : '-'}</td>
                    <td>{durumBadge(is.durum)}</td>
                    <td><span className={`badge ${is.odeme_durumu==='odendi'?'badge-odendi':is.odeme_durumu==='kismi'?'badge-kismi':'badge-odenmedi'}`}>{is.odeme_durumu==='odendi'?'Ödendi':is.odeme_durumu==='kismi'?'Kısmi':'Ödenmedi'}</span></td>
                    <td style={{color:'#22c55e',fontWeight:600}}>{rakamGizli ? '***' : '₺' + (is.toplam_tutar||0).toLocaleString('tr-TR')}</td>
                    <td style={{color:'var(--text-muted)'}}>{new Date(is.created_at).toLocaleDateString('tr-TR')}</td>
                    <td style={{display:'flex',gap:'4px',alignItems:'center'}}>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setDetayModal(is) }}>Detay</button>
                      <button className="btn btn-secondary btn-sm" title="Yazdır" onClick={(e) => { e.stopPropagation(); setYazdirModal(is) }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-only" style={{padding:'8px'}}>
            {aktifIsler.map(is => (
              <div key={is.id} onClick={() => setDetayModal(is)} style={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',marginBottom:'8px',cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <span style={{fontWeight:700,color:'var(--text-primary)',fontSize:'13px'}}>#{is.is_emri_no}</span>
                    {durumBadge(is.durum)}
                  </div>
                  <span style={{color:'#22c55e',fontWeight:700,fontSize:'14px'}}>₺{(is.toplam_tutar||0).toLocaleString('tr-TR')}</span>
                </div>
                <div style={{color:'var(--text-primary)',fontSize:'13px',fontWeight:500}}>{is.musteriler?.ad} {is.musteriler?.soyad}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'4px'}}>
                  <span style={{color:'#e5484d',fontSize:'12px',fontWeight:600}}>{formatPlaka(is.araclar?.plaka)} <span style={{color:'var(--text-muted)',fontWeight:400}}>{is.araclar?.marka}</span></span>
                  <span className={`badge ${is.odeme_durumu==='odendi'?'badge-odendi':is.odeme_durumu==='kismi'?'badge-kismi':'badge-odenmedi'}`}>{is.odeme_durumu==='odendi'?'Ödendi':is.odeme_durumu==='kismi'?'Kısmi':'Ödenmedi'}</span>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* GEÇMİŞ İŞ EMİRLERİ */}
      <div className="table-card">
        <div className="table-header">
          <span className="table-title">📋 Geçmiş İş Emirleri <span style={{fontSize:'0.85rem',color:'var(--text-muted)',fontWeight:400}}>(Son 15)</span></span>
        </div>
        {tamamlananIsler.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">📋</div><p>Tamamlanan iş emri yok</p></div>
          : (<>
              <div className="desktop-only" style={{overflowX:'auto'}}>
                <table>
                  <thead><tr><th>İş No</th><th>Müşteri</th><th>Araç</th><th>Teknisyen</th><th>Durum</th><th>Ödeme</th><th>Tutar</th><th>Tarih</th><th></th></tr></thead>
                  <tbody>
                    {tamamlananIsler.map(is => (
                      <tr key={is.id} style={{opacity:is.durum==='iptal'?0.55:1,cursor:'pointer'}} onClick={() => setDetayModal(is)} onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                        <td style={{fontWeight:700,color:'var(--text-primary)'}}>#{is.is_emri_no}</td>
                        <td style={{color:'var(--text-primary)'}}>{is.musteriler?.ad} {is.musteriler?.soyad}</td>
                        <td><span style={{fontWeight:600,color:'#e5484d'}}>{formatPlaka(is.araclar?.plaka)}</span> <span style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>{is.araclar?.marka}</span></td>
                        <td style={{color:'var(--text-secondary)'}}>{is.personel ? `${is.personel.ad} ${is.personel.soyad}` : '-'}</td>
                        <td>{durumBadge(is.durum)}</td>
                        <td><span className={`badge ${is.odeme_durumu==='odendi'?'badge-odendi':is.odeme_durumu==='kismi'?'badge-kismi':'badge-odenmedi'}`}>{is.odeme_durumu==='odendi'?'Ödendi':is.odeme_durumu==='kismi'?'Kısmi':'Ödenmedi'}</span></td>
                        <td style={{color:'#22c55e',fontWeight:600}}>{rakamGizli ? '***' : '₺' + (is.toplam_tutar||0).toLocaleString('tr-TR')}</td>
                        <td style={{color:'var(--text-muted)'}}>{new Date(is.created_at).toLocaleDateString('tr-TR')}</td>
                        <td style={{display:'flex',gap:'4px',alignItems:'center'}}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetayModal(is)}>Detay</button>
                        {['tamamlandi','teslim_edildi'].includes(is.durum) ? (
                          <button className="btn btn-secondary btn-sm" title="Yazdır" onClick={(e) => { e.stopPropagation(); setYazdirModal(is) }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" title="İş emri tamamlanmadan çıktı alınamaz" disabled style={{opacity:0.35,cursor:'not-allowed'}} onClick={(e) => { e.stopPropagation(); alert('İş emri tamamlanmadan çıktı alınamaz. Lütfen önce durumu "Tamamlandı" veya "Teslim Edildi" olarak güncelleyin.') }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                        )}
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-only" style={{padding:'8px'}}>
                {tamamlananIsler.map(is => (
                  <div key={is.id} onClick={() => setDetayModal(is)} style={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',marginBottom:'8px',cursor:'pointer',opacity:is.durum==='iptal'?0.6:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <span style={{fontWeight:700,color:'var(--text-primary)',fontSize:'13px'}}>#{is.is_emri_no}</span>
                        {durumBadge(is.durum)}
                      </div>
                      <span style={{color:'#22c55e',fontWeight:700,fontSize:'14px'}}>₺{(is.toplam_tutar||0).toLocaleString('tr-TR')}</span>
                    </div>
                    <div style={{color:'var(--text-primary)',fontSize:'13px',fontWeight:500}}>{is.musteriler?.ad} {is.musteriler?.soyad}</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'4px'}}>
                      <span style={{color:'#e5484d',fontSize:'12px',fontWeight:600}}>{formatPlaka(is.araclar?.plaka)} <span style={{color:'var(--text-muted)',fontWeight:400}}>{is.araclar?.marka}</span></span>
                      <span className={`badge ${is.odeme_durumu==='odendi'?'badge-odendi':is.odeme_durumu==='kismi'?'badge-kismi':'badge-odenmedi'}`}>{is.odeme_durumu==='odendi'?'Ödendi':is.odeme_durumu==='kismi'?'Kısmi':'Ödenmedi'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>)
        }
      </div>

    </div>
  )
}

export default IsEmirleri
