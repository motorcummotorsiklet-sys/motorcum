import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import CustomSelect from '../../components/dashboard/CustomSelect'

const formatTelefon = (tel) => {
  if (!tel) return ''
  const r = tel.toString().replace(/\D/g, '')
  if (r.length !== 11) return tel
  return `${r.slice(0,4)} ${r.slice(4,7)} ${r.slice(7,9)} ${r.slice(9,11)}`
}
const paraFormat = (v) => `₺${parseFloat(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
const tarihFormat = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '-'

// Telefon girişi — 0XXX XXX XX XX
const TelefonGirisi = ({ value, onChange, placeholder }) => {
  const rakamToGoster = (raw) => {
    const r = (raw || '').replace(/\D/g, '').slice(0, 11)
    if (r.length > 9) return `${r.slice(0,4)} ${r.slice(4,7)} ${r.slice(7,9)} ${r.slice(9,11)}`
    if (r.length > 7) return `${r.slice(0,4)} ${r.slice(4,7)} ${r.slice(7,9)}`
    if (r.length > 4) return `${r.slice(0,4)} ${r.slice(4,7)}`
    return r
  }
  const [metin, setMetin] = useState(rakamToGoster(value))
  useEffect(() => { setMetin(rakamToGoster(value)) }, [value])
  const handleChange = (e) => {
    let rakamlar = e.target.value.replace(/\D/g, '')
    if (rakamlar.length > 0 && rakamlar[0] !== '0') rakamlar = '0' + rakamlar
    rakamlar = rakamlar.slice(0, 11)
    setMetin(rakamToGoster(rakamlar))
    onChange(rakamlar)
  }
  return <input value={metin} onChange={handleChange} placeholder={placeholder || '05XX XXX XX XX'} inputMode="numeric" maxLength={14} />
}

// Tarih girişi — GG.AA.YYYY
const TarihGirisi = ({ value, onChange }) => {
  const isoToGoster = (iso) => {
    if (!iso) return ''
    const p = iso.split('-')
    if (p.length !== 3) return ''
    return `${p[2]}.${p[1]}.${p[0]}`
  }
  const [metin, setMetin] = useState(isoToGoster(value))
  useEffect(() => { setMetin(isoToGoster(value)) }, [value])
  const handleChange = (e) => {
    const rakamlar = e.target.value.replace(/[^0-9]/g, '').slice(0, 8)
    let goster = rakamlar
    if (rakamlar.length > 4) goster = `${rakamlar.slice(0,2)}.${rakamlar.slice(2,4)}.${rakamlar.slice(4)}`
    else if (rakamlar.length > 2) goster = `${rakamlar.slice(0,2)}.${rakamlar.slice(2)}`
    setMetin(goster)
    if (rakamlar.length === 8) {
      const gun = rakamlar.slice(0,2), ay = rakamlar.slice(2,4), yil = rakamlar.slice(4,8)
      const g = parseInt(gun,10), a = parseInt(ay,10), y = parseInt(yil,10)
      if (g>=1 && g<=31 && a>=1 && a<=12 && y>=1900 && y<=2100) onChange(`${yil}-${ay}-${gun}`)
    }
  }
  return <input value={metin} onChange={handleChange} placeholder="GG.AA.YYYY" inputMode="numeric" maxLength={10} />
}

// Tutar girişi — binlik ayraç (nokta) otomatik eklenir, örn. 1.234.567
const TutarGirisi = ({ value, onChange, placeholder }) => {
  const sayiyaCevir = (str) => {
    if (!str) return 0
    const temiz = str.toString().replace(/\./g, '').replace(',', '.')
    return parseFloat(temiz) || 0
  }
  const formatlaGoster = (num) => {
    if (num === '' || num === null || num === undefined || num === 0) return ''
    const [tam, ondalik] = num.toString().split('.')
    const tamFormatli = Number(tam).toLocaleString('tr-TR')
    return ondalik ? `${tamFormatli},${ondalik}` : tamFormatli
  }

  const [metin, setMetin] = useState(value ? formatlaGoster(value) : '')

  useEffect(() => {
    // Dışarıdan (örn. formu sıfırlarken) value boşaltılırsa görüneni de temizle
    if (!value) setMetin('')
  }, [value])

  const handleChange = (e) => {
    let raw = e.target.value.replace(/[^0-9,]/g, '')
    const parts = raw.split(',')
    let tamKisim = (parts[0] || '').replace(/^0+(?=\d)/, '')
    let ondalikKisim = parts.length > 1 ? parts[1].slice(0, 2) : undefined

    const tamFormatli = tamKisim ? Number(tamKisim).toLocaleString('tr-TR') : ''
    const goster = ondalikKisim !== undefined ? `${tamFormatli},${ondalikKisim}` : tamFormatli
    setMetin(goster)

    const sayisalDeger = sayiyaCevir(`${tamKisim || '0'}${ondalikKisim !== undefined ? ',' + ondalikKisim : ''}`)
    onChange(sayisalDeger)
  }

  return <input value={metin} onChange={handleChange} placeholder={placeholder || '0'} inputMode="decimal" style={{ textAlign: 'right' }} />
}

const BOS_FORM = {
  tur: 'motor', marka: '', model: '', yil: '', plaka: '', km: '', renk: '',
  satici_adi: '', satici_telefon: '', alis_tarihi: new Date().toISOString().slice(0,10), alis_fiyati: '',
  notlar: '',
}

const AracTicaret = () => {
  const { profile } = useAuth()
  const [araclar, setAraclar] = useState([])
  const [loading, setLoading] = useState(true)
  const [arama, setArama] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('hepsi')
  const [turFiltre, setTurFiltre] = useState('hepsi')

  const [seciliArac, setSeciliArac] = useState(null)
  const [giderler, setGiderler] = useState([])

  const [yeniAracAcik, setYeniAracAcik] = useState(false)
  const [yeniArac, setYeniArac] = useState(BOS_FORM)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')

  const [satAcik, setSatAcik] = useState(false)
  const [satForm, setSatForm] = useState({ alici_adi: '', alici_telefon: '', satis_tarihi: new Date().toISOString().slice(0,10), satis_fiyati: '' })

  const [giderAcik, setGiderAcik] = useState(false)
  const [giderForm, setGiderForm] = useState({ aciklama: '', tutar: '', tarih: new Date().toISOString().slice(0,10) })

  const [silmeOnayId, setSilmeOnayId] = useState(null)
  const [giderSilmeOnayId, setGiderSilmeOnayId] = useState(null)

  const [belgeler, setBelgeler] = useState([])
  const [belgeTip, setBelgeTip] = useState('ruhsat')
  const [belgeYukleniyor, setBelgeYukleniyor] = useState(false)
  const [belgeHata, setBelgeHata] = useState('')
  const [belgeSilmeOnayId, setBelgeSilmeOnayId] = useState(null)

  const [raporAcik, setRaporAcik] = useState(false)
  const [raporBaslangic, setRaporBaslangic] = useState('')
  const [raporBitis, setRaporBitis] = useState('')

  useEffect(() => { fetchAraclar() }, [])

  const fetchAraclar = async () => {
    setLoading(true)
    const { data: aracData } = await supabase.from('arac_ticaret').select('*').order('created_at', { ascending: false })
    const { data: giderData } = await supabase.from('arac_ticaret_giderler').select('arac_id, tutar')

    const giderMap = {}
    ;(giderData || []).forEach(g => {
      giderMap[g.arac_id] = (giderMap[g.arac_id] || 0) + parseFloat(g.tutar || 0)
    })

    const zengin = (aracData || []).map(a => {
      const giderToplam = giderMap[a.id] || 0
      const kar = a.durum === 'satildi' ? parseFloat(a.satis_fiyati || 0) - parseFloat(a.alis_fiyati || 0) - giderToplam : null
      return { ...a, gider_toplam: giderToplam, kar }
    })
    setAraclar(zengin)
    setLoading(false)
  }

  const fetchGiderler = async (aracId) => {
    const { data } = await supabase.from('arac_ticaret_giderler').select('*').eq('arac_id', aracId).order('tarih', { ascending: false })
    setGiderler(data || [])
  }

  const fetchBelgeler = async (aracId) => {
    const { data } = await supabase.from('arac_ticaret_belgeler').select('*').eq('arac_id', aracId).order('created_at', { ascending: false })
    setBelgeler(data || [])
  }

  const belgeYukle = async (e) => {
    const dosya = e.target.files[0]
    if (!dosya || !seciliArac) return
    setBelgeHata('')
    setBelgeYukleniyor(true)

    const uzanti = dosya.name.split('.').pop()
    const dosyaYolu = `${seciliArac.id}/${Date.now()}.${uzanti}`

    const { error: yuklemeHatasi } = await supabase.storage.from('arac-belgeler').upload(dosyaYolu, dosya)
    if (yuklemeHatasi) {
      setBelgeHata('Yükleme başarısız: ' + yuklemeHatasi.message)
      setBelgeYukleniyor(false)
      e.target.value = ''
      return
    }

    const { data: urlData } = supabase.storage.from('arac-belgeler').getPublicUrl(dosyaYolu)

    const { error: kayitHatasi } = await supabase.from('arac_ticaret_belgeler').insert({
      arac_id: seciliArac.id,
      tip: belgeTip,
      dosya_url: urlData.publicUrl,
      dosya_yolu: dosyaYolu,
      dosya_adi: dosya.name,
    })
    if (kayitHatasi) setBelgeHata('Kayıt başarısız: ' + kayitHatasi.message)

    e.target.value = ''
    setBelgeYukleniyor(false)
    await fetchBelgeler(seciliArac.id)
  }

  const belgeSil = async (belge) => {
    if (belgeSilmeOnayId !== belge.id) { setBelgeSilmeOnayId(belge.id); return }
    setBelgeSilmeOnayId(null)
    await supabase.storage.from('arac-belgeler').remove([belge.dosya_yolu])
    await supabase.from('arac_ticaret_belgeler').delete().eq('id', belge.id)
    await fetchBelgeler(seciliArac.id)
  }

  const aracSec = async (a) => {
    setSeciliArac(a)
    setGiderler([])
    setBelgeler([])
    await Promise.all([fetchGiderler(a.id), fetchBelgeler(a.id)])
  }

  const aracKaydet = async () => {
    if (!yeniArac.marka.trim() || !yeniArac.satici_adi.trim() || !yeniArac.alis_fiyati) {
      setHata('Marka, satıcı adı ve alış fiyatı zorunludur.')
      return
    }
    setKaydediliyor(true)
    setHata('')
    const { error } = await supabase.from('arac_ticaret').insert({
      tur: yeniArac.tur,
      marka: yeniArac.marka.trim().toUpperCase(),
      model: yeniArac.model.trim().toUpperCase() || null,
      yil: yeniArac.yil.trim() || null,
      plaka: yeniArac.plaka.trim().toUpperCase() || null,
      km: yeniArac.km ? parseInt(yeniArac.km) : null,
      renk: yeniArac.renk.trim().toUpperCase() || null,
      satici_adi: yeniArac.satici_adi.trim().toUpperCase(),
      satici_telefon: yeniArac.satici_telefon.replace(/\D/g, '') || null,
      alis_tarihi: yeniArac.alis_tarihi,
      alis_fiyati: parseFloat(yeniArac.alis_fiyati || 0),
      notlar: yeniArac.notlar.trim() || null,
      durum: 'stokta',
      created_by: profile?.id || null,
    })
    if (error) {
      setHata(error.message)
    } else {
      setYeniArac(BOS_FORM)
      setYeniAracAcik(false)
      fetchAraclar()
    }
    setKaydediliyor(false)
  }

  const aracSil = async (id) => {
    if (silmeOnayId !== id) { setSilmeOnayId(id); return }
    setSilmeOnayId(null)
    await supabase.from('arac_ticaret').delete().eq('id', id)
    if (seciliArac?.id === id) setSeciliArac(null)
    fetchAraclar()
  }

  const satisKaydet = async () => {
    if (!satForm.satis_fiyati || !seciliArac) return
    setKaydediliyor(true)
    await supabase.from('arac_ticaret').update({
      durum: 'satildi',
      alici_adi: satForm.alici_adi.trim().toUpperCase() || null,
      alici_telefon: satForm.alici_telefon.replace(/\D/g, '') || null,
      satis_tarihi: satForm.satis_tarihi,
      satis_fiyati: parseFloat(satForm.satis_fiyati || 0),
    }).eq('id', seciliArac.id)
    setSatAcik(false)
    setKaydediliyor(false)
    const { data } = await supabase.from('arac_ticaret').select('*').eq('id', seciliArac.id).single()
    if (data) setSeciliArac(prev => ({ ...prev, ...data }))
    fetchAraclar()
  }

  const satisIptalEt = async () => {
    if (!seciliArac) return
    await supabase.from('arac_ticaret').update({
      durum: 'stokta', alici_adi: null, alici_telefon: null, satis_tarihi: null, satis_fiyati: null,
    }).eq('id', seciliArac.id)
    setSeciliArac(prev => ({ ...prev, durum: 'stokta', alici_adi: null, alici_telefon: null, satis_tarihi: null, satis_fiyati: null, kar: null }))
    fetchAraclar()
  }

  const giderEkle = async () => {
    if (!giderForm.aciklama.trim() || !giderForm.tutar || !seciliArac) return
    setKaydediliyor(true)
    await supabase.from('arac_ticaret_giderler').insert({
      arac_id: seciliArac.id,
      aciklama: giderForm.aciklama.trim(),
      tutar: parseFloat(giderForm.tutar),
      tarih: giderForm.tarih,
    })
    setGiderForm({ aciklama: '', tutar: '', tarih: new Date().toISOString().slice(0,10) })
    setGiderAcik(false)
    setKaydediliyor(false)
    await fetchGiderler(seciliArac.id)
    fetchAraclar()
  }

  const giderSil = async (id) => {
    if (giderSilmeOnayId !== id) { setGiderSilmeOnayId(id); return }
    setGiderSilmeOnayId(null)
    await supabase.from('arac_ticaret_giderler').delete().eq('id', id)
    await fetchGiderler(seciliArac.id)
    fetchAraclar()
  }

  // ─── Özet ("cüzdan") kartları ───
  const stoktakiler = araclar.filter(a => a.durum === 'stokta')
  const satilanlar = araclar.filter(a => a.durum === 'satildi')
  const stokYatirim = stoktakiler.reduce((s, a) => s + parseFloat(a.alis_fiyati || 0) + a.gider_toplam, 0)
  const toplamKar = satilanlar.reduce((s, a) => s + (a.kar || 0), 0)

  // ─── Filtrelenmiş liste ───
  const filtrelenmis = araclar.filter(a => {
    if (durumFiltre !== 'hepsi' && a.durum !== durumFiltre) return false
    if (turFiltre !== 'hepsi' && a.tur !== turFiltre) return false
    const aramaMetni = `${a.marka} ${a.model} ${a.plaka} ${a.satici_adi}`.toLowerCase()
    if (arama && !aramaMetni.includes(arama.toLowerCase())) return false
    return true
  })

  // ─── Rapor ───
  const raporVerisi = satilanlar.filter(a => {
    if (raporBaslangic && a.satis_tarihi < raporBaslangic) return false
    if (raporBitis && a.satis_tarihi > raporBitis) return false
    return true
  })
  const raporToplamKar = raporVerisi.reduce((s, a) => s + (a.kar || 0), 0)
  const raporToplamSatis = raporVerisi.reduce((s, a) => s + parseFloat(a.satis_fiyati || 0), 0)
  const raporToplamAlis = raporVerisi.reduce((s, a) => s + parseFloat(a.alis_fiyati || 0) + a.gider_toplam, 0)

  // ═══════════════════════ DETAY GÖRÜNÜMÜ ═══════════════════════
  if (seciliArac) {
    const giderToplam = giderler.reduce((s, g) => s + parseFloat(g.tutar || 0), 0)
    const guncelKar = seciliArac.durum === 'satildi'
      ? parseFloat(seciliArac.satis_fiyati || 0) - parseFloat(seciliArac.alis_fiyati || 0) - giderToplam
      : null

    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSeciliArac(null)} style={{ marginBottom: 14 }}>← Listeye Dön</button>

        <div className="table-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {seciliArac.tur === 'motor' ? '🏍️' : '🚗'} {seciliArac.marka} {seciliArac.model} {seciliArac.yil && `(${seciliArac.yil})`}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {seciliArac.plaka && <span style={{ fontWeight: 600, color: '#e5484d' }}>{seciliArac.plaka}</span>}
                {seciliArac.km && <span>📍 {parseInt(seciliArac.km).toLocaleString('tr-TR')} km</span>}
                {seciliArac.renk && <span>🎨 {seciliArac.renk}</span>}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
              background: seciliArac.durum === 'satildi' ? 'rgba(34,197,94,.12)' : 'rgba(240,166,59,.12)',
              color: seciliArac.durum === 'satildi' ? '#22c55e' : '#f5a623',
            }}>
              {seciliArac.durum === 'satildi' ? '✓ SATILDI' : '📦 STOKTA'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: seciliArac.durum === 'satildi' ? '1fr 1fr' : '1fr', gap: 12, padding: '0 18px 16px' }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>📥 Alım Bilgileri</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{seciliArac.satici_adi}</div>
              {seciliArac.satici_telefon && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatTelefon(seciliArac.satici_telefon)}</div>}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{tarihFormat(seciliArac.alis_tarihi)}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e5484d', marginTop: 6 }}>{paraFormat(seciliArac.alis_fiyati)}</div>
            </div>
            {seciliArac.durum === 'satildi' && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>📤 Satış Bilgileri</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{seciliArac.alici_adi || '-'}</div>
                {seciliArac.alici_telefon && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatTelefon(seciliArac.alici_telefon)}</div>}
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{tarihFormat(seciliArac.satis_tarihi)}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginTop: 6 }}>{paraFormat(seciliArac.satis_fiyati)}</div>
              </div>
            )}
          </div>

          {guncelKar !== null && (
            <div style={{
              margin: '0 18px 16px', padding: '14px', borderRadius: 10, textAlign: 'right',
              background: guncelKar >= 0 ? 'rgba(34,197,94,.08)' : 'rgba(229,72,77,.08)',
              border: `1.5px solid ${guncelKar >= 0 ? 'rgba(34,197,94,.35)' : 'rgba(229,72,77,.35)'}`,
            }}>
              <div style={{ fontSize: 11, color: guncelKar >= 0 ? '#22c55e' : '#e5484d', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {guncelKar >= 0 ? 'Net Kâr' : 'Net Zarar'} <span style={{ fontWeight: 400, opacity: .8 }}>(giderler dahil)</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: guncelKar >= 0 ? '#22c55e' : '#e5484d' }}>{paraFormat(Math.abs(guncelKar))}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, padding: '0 18px 16px', flexWrap: 'wrap' }}>
            {seciliArac.durum === 'stokta' ? (
              <button className="btn btn-primary btn-sm" onClick={() => { setSatForm({ alici_adi: '', alici_telefon: '', satis_tarihi: new Date().toISOString().slice(0,10), satis_fiyati: '' }); setSatAcik(true) }}>💰 Sat</button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={satisIptalEt}>↩️ Satışı İptal Et</button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setGiderAcik(true)}>+ Gider Ekle</button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header"><span className="table-title">🧾 Giderler ({giderler.length}) — Toplam {paraFormat(giderToplam)}</span></div>
          <div style={{ padding: '8px 0' }}>
            {giderler.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Gider eklenmemiş.</div>
            ) : giderler.map(g => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{g.aciklama}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tarihFormat(g.tarih)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#e5484d' }}>-{paraFormat(g.tutar)}</span>
                  {giderSilmeOnayId === g.id ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => giderSil(g.id)}>Sil?</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setGiderSilmeOnayId(null)}>✕</button>
                    </span>
                  ) : (
                    <button onClick={() => giderSil(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="table-card" style={{ marginTop: 16 }}>
          <div className="table-header"><span className="table-title">📎 Belgeler (Ruhsat / Noter) ({belgeler.length})</span></div>
          <div style={{ padding: '14px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 150 }}>
              <CustomSelect
                value={belgeTip}
                onChange={setBelgeTip}
                options={[
                  { value: 'ruhsat', label: '📄 Ruhsat' },
                  { value: 'noter', label: '📝 Noter Evrakı' },
                  { value: 'diger', label: '📎 Diğer' },
                ]}
              />
            </div>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
              {belgeYukleniyor ? 'Yükleniyor...' : '+ Fotoğraf Yükle'}
              <input type="file" accept="image/*" onChange={belgeYukle} disabled={belgeYukleniyor} style={{ display: 'none' }} />
            </label>
          </div>
          {belgeHata && <div className="alert alert-error" style={{ margin: '12px 18px' }}>{belgeHata}</div>}
          <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            {belgeler.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: 10 }}>Henüz belge yüklenmemiş.</div>
            ) : belgeler.map(b => (
              <div key={b.id} style={{ position: 'relative' }}>
                <a href={b.dosya_url} target="_blank" rel="noopener noreferrer">
                  <img src={b.dosya_url} alt={b.dosya_adi} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                </a>
                <span style={{
                  position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                  background: 'rgba(0,0,0,.65)', color: '#fff',
                }}>
                  {b.tip === 'ruhsat' ? 'RUHSAT' : b.tip === 'noter' ? 'NOTER' : 'DİĞER'}
                </span>
                {belgeSilmeOnayId === b.id ? (
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3 }}>
                    <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => belgeSil(b)}>Sil?</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => setBelgeSilmeOnayId(null)}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => belgeSil(b)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.65)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 11, padding: '2px 6px' }}>🗑️</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {seciliArac.notlar && (
          <div className="table-card" style={{ marginTop: 16, padding: '12px 18px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Not</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{seciliArac.notlar}</div>
          </div>
        )}

        {/* SAT MODAL */}
        {satAcik && (
          <div className="modal-overlay">
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">💰 Satış Bilgileri — {seciliArac.marka} {seciliArac.model}</span>
                <button className="modal-close" onClick={() => setSatAcik(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="field"><label>Alıcı Adı</label><input value={satForm.alici_adi} onChange={e => setSatForm(f => ({ ...f, alici_adi: e.target.value }))} /></div>
                <div className="field"><label>Alıcı Telefon</label><TelefonGirisi value={satForm.alici_telefon} onChange={v => setSatForm(f => ({ ...f, alici_telefon: v }))} /></div>
                <div className="field"><label>Satış Tarihi</label><TarihGirisi value={satForm.satis_tarihi} onChange={v => setSatForm(f => ({ ...f, satis_tarihi: v }))} /></div>
                <div className="field"><label>Satış Fiyatı *</label><TutarGirisi value={satForm.satis_fiyati} onChange={v => setSatForm(f => ({ ...f, satis_fiyati: v }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSatAcik(false)}>İptal</button>
                <button className="btn btn-primary" onClick={satisKaydet} disabled={kaydediliyor || !satForm.satis_fiyati}>{kaydediliyor ? 'Kaydediliyor...' : 'Satışı Onayla'}</button>
              </div>
            </div>
          </div>
        )}

        {/* GİDER EKLE MODAL */}
        {giderAcik && (
          <div className="modal-overlay">
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">🧾 Gider Ekle</span>
                <button className="modal-close" onClick={() => setGiderAcik(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="field"><label>Açıklama *</label><input value={giderForm.aciklama} onChange={e => setGiderForm(f => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. Boya, nakliye, yedek parça..." /></div>
                <div className="field"><label>Tutar *</label><TutarGirisi value={giderForm.tutar} onChange={v => setGiderForm(f => ({ ...f, tutar: v }))} /></div>
                <div className="field"><label>Tarih</label><TarihGirisi value={giderForm.tarih} onChange={v => setGiderForm(f => ({ ...f, tarih: v }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setGiderAcik(false)}>İptal</button>
                <button className="btn btn-primary" onClick={giderEkle} disabled={kaydediliyor || !giderForm.aciklama.trim() || !giderForm.tutar}>{kaydediliyor ? 'Kaydediliyor...' : 'Ekle'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════ LİSTE GÖRÜNÜMÜ ═══════════════════════
  return (
    <div>
      {/* Cüzdan özet kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>📦 Stokta</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{stoktakiler.length}</div>
        </div>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>💼 Stok Yatırımı</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f5a623' }}>{paraFormat(stokYatirim)}</div>
        </div>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>✓ Satılan</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{satilanlar.length}</div>
        </div>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>💰 Toplam Net Kâr</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: toplamKar >= 0 ? '#22c55e' : '#e5484d' }}>{paraFormat(Math.abs(toplamKar))}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="search-input" style={{ flex: 1, minWidth: 200 }} placeholder="Marka, model, plaka veya satıcı ara..." value={arama} onChange={e => setArama(e.target.value)} />
        <button className="btn btn-secondary" onClick={() => setRaporAcik(!raporAcik)}>📊 Rapor</button>
        <button className="btn btn-primary" onClick={() => { setYeniArac(BOS_FORM); setHata(''); setYeniAracAcik(true) }}>+ Yeni Alım</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{id:'hepsi',label:'Tümü'},{id:'stokta',label:'📦 Stokta'},{id:'satildi',label:'✓ Satıldı'}].map(f => (
          <button key={f.id} onClick={() => setDurumFiltre(f.id)} style={{
            fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
            border: `1px solid ${durumFiltre===f.id ? '#e5484d' : 'var(--border)'}`,
            background: durumFiltre===f.id ? 'rgba(229,72,77,.1)' : 'var(--bg-elevated)',
            color: durumFiltre===f.id ? '#e5484d' : 'var(--text-secondary)', cursor: 'pointer',
          }}>{f.label}</button>
        ))}
        <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        {[{id:'hepsi',label:'Tümü'},{id:'motor',label:'🏍️ Motor'},{id:'araba',label:'🚗 Araba'}].map(f => (
          <button key={f.id} onClick={() => setTurFiltre(f.id)} style={{
            fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
            border: `1px solid ${turFiltre===f.id ? '#e5484d' : 'var(--border)'}`,
            background: turFiltre===f.id ? 'rgba(229,72,77,.1)' : 'var(--bg-elevated)',
            color: turFiltre===f.id ? '#e5484d' : 'var(--text-secondary)', cursor: 'pointer',
          }}>{f.label}</button>
        ))}
      </div>

      {/* RAPOR PANELİ */}
      {raporAcik && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-header"><span className="table-title">📊 Satış Raporu</span></div>
          <div style={{ padding: '12px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' }}>
              <span style={{ fontSize: 12 }}>📅</span>
              <input type="date" value={raporBaslangic} onChange={e => setRaporBaslangic(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', padding: '4px 0', width: 118 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
              <input type="date" value={raporBitis} onChange={e => setRaporBitis(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', padding: '4px 0', width: 118 }} />
            </div>
            {(raporBaslangic || raporBitis) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setRaporBaslangic(''); setRaporBitis('') }}>✕ Temizle</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '0 18px 18px' }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Satılan Araç</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{raporVerisi.length}</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Satış</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{paraFormat(raporToplamSatis)}</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Maliyet</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e5484d' }}>{paraFormat(raporToplamAlis)}</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Kâr</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: raporToplamKar >= 0 ? '#22c55e' : '#e5484d' }}>{paraFormat(Math.abs(raporToplamKar))}</div>
            </div>
          </div>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
        ) : filtrelenmis.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Kayıt bulunamadı.</div>
        ) : filtrelenmis.map(a => (
          <div key={a.id} onClick={() => aracSec(a)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                {a.tur === 'motor' ? '🏍️' : '🚗'} {a.marka} {a.model} {a.yil && `(${a.yil})`}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                {a.plaka && <span style={{ color: '#e5484d', fontWeight: 600 }}>{a.plaka}</span>}
                <span>Satıcı: {a.satici_adi}</span>
                <span>{tarihFormat(a.alis_tarihi)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {a.durum === 'satildi' ? (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: a.kar >= 0 ? '#22c55e' : '#e5484d' }}>
                    {a.kar >= 0 ? '+' : '-'}{paraFormat(Math.abs(a.kar))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.kar >= 0 ? 'kâr' : 'zarar'}</div>
                </div>
              ) : (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>{paraFormat(a.alis_fiyati)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>alış</div>
                </div>
              )}
              <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); aracSec(a) }}>Detay →</button>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap',
                background: a.durum === 'satildi' ? 'rgba(34,197,94,.12)' : 'rgba(240,166,59,.12)',
                color: a.durum === 'satildi' ? '#22c55e' : '#f5a623',
              }}>
                {a.durum === 'satildi' ? 'SATILDI' : 'STOKTA'}
              </span>
              {silmeOnayId === a.id ? (
                <span style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-danger btn-sm" onClick={() => aracSil(a.id)}>Sil?</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSilmeOnayId(null)}>✕</button>
                </span>
              ) : (
                <button onClick={e => { e.stopPropagation(); aracSil(a.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>🗑️</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* YENİ ALIM MODAL */}
      {yeniAracAcik && (
        <div className="modal-overlay">
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">+ Yeni Alım</span>
              <button className="modal-close" onClick={() => setYeniAracAcik(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field form-full">
                <label>Tür</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{id:'motor',label:'🏍️ Motor'},{id:'araba',label:'🚗 Araba'}].map(t => (
                    <button key={t.id} type="button" onClick={() => setYeniArac(f => ({ ...f, tur: t.id }))} style={{
                      flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${yeniArac.tur===t.id ? '#e5484d' : 'var(--border)'}`,
                      background: yeniArac.tur===t.id ? 'rgba(229,72,77,.1)' : 'var(--bg-elevated)',
                      color: yeniArac.tur===t.id ? '#e5484d' : 'var(--text-secondary)',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div className="field"><label>Marka *</label><input value={yeniArac.marka} onChange={e => setYeniArac(f => ({ ...f, marka: e.target.value }))} placeholder="Örn. Honda" /></div>
                <div className="field"><label>Model</label><input value={yeniArac.model} onChange={e => setYeniArac(f => ({ ...f, model: e.target.value }))} /></div>
                <div className="field"><label>Yıl</label><input value={yeniArac.yil} onChange={e => setYeniArac(f => ({ ...f, yil: e.target.value }))} placeholder="2022" /></div>
                <div className="field"><label>Plaka</label><input value={yeniArac.plaka} onChange={e => setYeniArac(f => ({ ...f, plaka: e.target.value }))} /></div>
                <div className="field"><label>KM</label><input type="number" value={yeniArac.km} onChange={e => setYeniArac(f => ({ ...f, km: e.target.value }))} /></div>
                <div className="field"><label>Renk</label><input value={yeniArac.renk} onChange={e => setYeniArac(f => ({ ...f, renk: e.target.value }))} /></div>
              </div>
              <div className="form-grid">
                <div className="field"><label>Satıcı Adı *</label><input value={yeniArac.satici_adi} onChange={e => setYeniArac(f => ({ ...f, satici_adi: e.target.value }))} placeholder="Kimden alındı" /></div>
                <div className="field"><label>Satıcı Telefon</label><TelefonGirisi value={yeniArac.satici_telefon} onChange={v => setYeniArac(f => ({ ...f, satici_telefon: v }))} /></div>
                <div className="field"><label>Alış Tarihi</label><TarihGirisi value={yeniArac.alis_tarihi} onChange={v => setYeniArac(f => ({ ...f, alis_tarihi: v }))} /></div>
                <div className="field"><label>Alış Fiyatı *</label><TutarGirisi value={yeniArac.alis_fiyati} onChange={v => setYeniArac(f => ({ ...f, alis_fiyati: v }))} /></div>
              </div>
              <div className="field form-full"><label>Notlar</label><textarea value={yeniArac.notlar} onChange={e => setYeniArac(f => ({ ...f, notlar: e.target.value }))} /></div>
              {hata && <div className="alert alert-error">{hata}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setYeniAracAcik(false)}>İptal</button>
              <button className="btn btn-primary" onClick={aracKaydet} disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AracTicaret
