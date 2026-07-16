import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import SearchableSelect from '../../components/dashboard/SearchableSelect'
import CustomSelect from '../../components/dashboard/CustomSelect'
import RuhsatTarama from '../../components/dashboard/RuhsatTarama'

const KAN_GRUPLARI = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']
const YAKIT_TIPLERI = ['Benzin', 'Dizel', 'LPG', 'Elektrik', 'Hibrit']

// Türkiye telefon formatı: 0XXX XXX XX XX
const formatTelefon = (tel) => {
  if (!tel) return ''
  const rakamlar = tel.replace(/\D/g, '')
  if (rakamlar.length !== 11) return tel
  return `${rakamlar.slice(0,4)} ${rakamlar.slice(4,7)} ${rakamlar.slice(7,9)} ${rakamlar.slice(9,11)}`
}

// Türkiye plaka standart formatı: 34 TT 213 (il kodu · harfler · rakamlar)
// Nasıl girilirse girilsin aynı standart formata çevirir
const formatPlaka = (plaka) => {
  if (!plaka) return ''
  const temiz = plaka.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const eslesme = temiz.match(/^(\d{2})([A-Z]{1,3})(\d{2,4})$/)
  if (!eslesme) return temiz
  return `${eslesme[1]} ${eslesme[2]} ${eslesme[3]}`
}

// Doğum tarihi girişi — tek standart format: GG.AA.YYYY
// Nasıl yazarsa yazsın (sadece rakam) otomatik noktalar eklenir, rakamların yeri karışmaz
// value/onChange ISO formatında çalışır (YYYY-MM-DD), DB'ye böyle kaydedilir
const TarihGirisi = ({ value, onChange, readOnly }) => {
  const isoToGoster = (iso) => {
    if (!iso) return ''
    const parcalar = iso.split('-')
    if (parcalar.length !== 3) return ''
    const [y, m, d] = parcalar
    return `${d}.${m}.${y}`
  }

  const [metin, setMetin] = useState(isoToGoster(value))

  useEffect(() => { setMetin(isoToGoster(value)) }, [value])

  if (readOnly) {
    return <input readOnly value={metin || '-'} />
  }

  const handleChange = (e) => {
    const rakamlar = e.target.value.replace(/[^0-9]/g, '').slice(0, 8) // GGAAYYYY
    let goster = rakamlar
    if (rakamlar.length > 4) goster = `${rakamlar.slice(0,2)}.${rakamlar.slice(2,4)}.${rakamlar.slice(4)}`
    else if (rakamlar.length > 2) goster = `${rakamlar.slice(0,2)}.${rakamlar.slice(2)}`
    setMetin(goster)

    if (rakamlar.length === 0) {
      onChange('')
      return
    }
    if (rakamlar.length === 8) {
      const gun = rakamlar.slice(0, 2)
      const ay = rakamlar.slice(2, 4)
      const yil = rakamlar.slice(4, 8)
      const g = parseInt(gun, 10), a = parseInt(ay, 10), y = parseInt(yil, 10)
      if (g >= 1 && g <= 31 && a >= 1 && a <= 12 && y >= 1900 && y <= 2100) {
        onChange(`${yil}-${ay}-${gun}`)
      }
    }
  }

  return (
    <input
      value={metin}
      onChange={handleChange}
      placeholder="GG.AA.YYYY"
      inputMode="numeric"
      maxLength={10}
    />
  )
}

const useAracListeleri = () => {
  const [markalar, setMarkalar] = useState([])
  const [modeller, setModeller] = useState({})
  const [renkler, setRenkler] = useState([])

  const fetchListeler = useCallback(async () => {
    const [markaRes, modelRes, renkRes] = await Promise.all([
      supabase.from('arac_markalari').select('isim').order('isim'),
      supabase.from('arac_modelleri').select('marka_isim, isim').order('isim'),
      supabase.from('arac_renkleri').select('isim').order('isim'),
    ])
    setMarkalar((markaRes.data || []).map(m => m.isim))
    const modelMap = {}
    ;(modelRes.data || []).forEach(m => {
      if (!modelMap[m.marka_isim]) modelMap[m.marka_isim] = []
      modelMap[m.marka_isim].push(m.isim)
    })
    setModeller(modelMap)
    setRenkler((renkRes.data || []).map(r => r.isim))
  }, [])

  useEffect(() => { fetchListeler() }, [fetchListeler])
  return { markalar, modeller, renkler, yenile: fetchListeler }
}

const emptyArac = { plaka: '', marka: '', model: '', yil: '', renk: '', sasi_no: '', motor_no: '', yakit_tipi: '', km: '', notlar: '' }

const AracFormModal = ({ musteriId, aracData, onKaydet, onIptal }) => {
  const duzenleme = !!aracData
  const [form, setForm] = useState(duzenleme ? { ...aracData } : { ...emptyArac })
  const [error, setError] = useState('')
  const [kayitEdiliyor, setKayitEdiliyor] = useState(false)
  const { markalar, modeller, renkler, yenile } = useAracListeleri()
  const modelListesi = (form.marka && modeller[form.marka] ? [...modeller[form.marka]] : []).sort()

  const handleRuhsatDoldur = async (bilgiler) => {
    const yeniEklenenler = []

    // Marka kontrolü - sistemde yoksa ekle
    if (bilgiler.marka) {
      const markaUpper = bilgiler.marka.toUpperCase().trim()
      const { data: mevcutMarka } = await supabase
        .from('arac_markalari').select('isim').ilike('isim', markaUpper).single()
      if (!mevcutMarka) {
        await supabase.from('arac_markalari').insert({ isim: markaUpper })
        yeniEklenenler.push(`Marka: ${markaUpper}`)
      }
      bilgiler.marka = markaUpper

      // Model kontrolü - bu markada yoksa ekle
      if (bilgiler.model) {
        const modelUpper = bilgiler.model.toUpperCase().trim()
        const { data: mevcutModel } = await supabase
          .from('arac_modelleri').select('isim').eq('marka_isim', markaUpper).ilike('isim', modelUpper).single()
        if (!mevcutModel) {
          await supabase.from('arac_modelleri').insert({ marka_isim: markaUpper, isim: modelUpper })
          yeniEklenenler.push(`Model: ${markaUpper} / ${modelUpper}`)
        }
        bilgiler.model = modelUpper
      }

      // Renk kontrolü - sistemde yoksa ekle
      if (bilgiler.renk) {
        const renkUpper = bilgiler.renk.toUpperCase().trim()
        const { data: mevcutRenk } = await supabase
          .from('arac_renkleri').select('isim').ilike('isim', renkUpper).single()
        if (!mevcutRenk) {
          await supabase.from('arac_renkleri').insert({ isim: renkUpper })
          yeniEklenenler.push(`Renk: ${renkUpper}`)
        }
        bilgiler.renk = renkUpper
      }
    }

    if (yeniEklenenler.length > 0) {
      setError('') 
      // Bilgi mesajı olarak göster
      setTimeout(() => {
        alert('Tanimlamalara eklendi: ' + yeniEklenenler.join(', '))
      }, 300)
    }

    setForm(prev => ({
      ...prev,
      plaka: bilgiler.plaka ? formatPlaka(bilgiler.plaka) : prev.plaka,
      marka: bilgiler.marka || prev.marka,
      model: bilgiler.model || prev.model,
      yil: bilgiler.yil || prev.yil,
      renk: bilgiler.renk || prev.renk,
      sasi_no: bilgiler.sasi_no || prev.sasi_no,
      motor_no: bilgiler.motor_no || prev.motor_no,
      yakit_tipi: bilgiler.yakit_tipi || prev.yakit_tipi,
    }))
  }

  const handleKaydet = async () => {
    if (!form.plaka || !form.marka || !form.model) return setError('Plaka, marka ve model zorunludur.')
    setKayitEdiliyor(true)
    setError('')
    const payload = {
      ...form,
      plaka: formatPlaka(form.plaka.trim()),
      marka: form.marka.toUpperCase().trim(),
      model: form.model.toUpperCase().trim(),
      renk: form.renk?.toUpperCase().trim(),
      km: form.km ? parseInt(form.km) : 0,
      yil: form.yil ? parseInt(form.yil) : null,
    }
    let err
    if (duzenleme) {
      const res = await supabase.from('araclar').update(payload).eq('id', aracData.id)
      err = res.error
    } else {
      const res = await supabase.from('araclar').insert({ ...payload, musteri_id: musteriId })
      err = res.error
    }
    if (err) { setError(err.message.includes('unique') ? 'Bu plaka zaten kayıtlı.' : err.message); setKayitEdiliyor(false) }
    else onKaydet()
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <span className="modal-title">{duzenleme ? `Araç Düzenle — ${formatPlaka(aracData.plaka)}` : 'Araç Ekle'}</span>
          <button className="modal-close" onClick={onIptal}>✕</button>
        </div>
        <div className="modal-body">
          {!duzenleme && <RuhsatTarama onDoldur={handleRuhsatDoldur} markalar={markalar} modeller={modeller} />}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div className="field"><label>Plaka *</label><input placeholder="34 TT 213" value={form.plaka} onChange={e => setForm({ ...form, plaka: formatPlaka(e.target.value) })} /></div>
            <div className="field">
              <label>Yakıt Tipi</label>
              <CustomSelect value={form.yakit_tipi} onChange={v => setForm({ ...form, yakit_tipi: v })} options={YAKIT_TIPLERI} placeholder="Seçin" />
            </div>
            <div className="field"><label>Marka *</label><SearchableSelect value={form.marka} onChange={v => setForm({ ...form, marka: v, model: '' })} options={markalar} placeholder="Marka seçin..." ekleLabel="Marka Ekle" onEkle={async (yeniMarka) => { await supabase.from('arac_markalari').insert({ isim: yeniMarka }); await yenile(); setForm(f => ({ ...f, marka: yeniMarka, model: '' })) }} /></div>
            <div className="field"><label>Model *</label><SearchableSelect value={form.model} onChange={v => setForm({ ...form, model: v })} options={modelListesi} placeholder={form.marka ? 'Model seçin...' : 'Önce marka seçin'} ekleLabel="Model Ekle" onEkle={form.marka ? async (yeniModel) => { await supabase.from('arac_modelleri').insert({ marka_isim: form.marka, isim: yeniModel }); await yenile(); setForm(f => ({ ...f, model: yeniModel })) } : null} /></div>
            <div className="field"><label>Yıl</label><input type="number" placeholder="2020" min="1950" max="2030" value={form.yil} onChange={e => setForm({ ...form, yil: e.target.value })} /></div>
            <div className="field"><label>Renk</label><SearchableSelect value={form.renk} onChange={v => setForm({ ...form, renk: v })} options={renkler} placeholder="Renk seçin..." ekleLabel="Renk Ekle" onEkle={async (yeniRenk) => { await supabase.from('arac_renkleri').insert({ isim: yeniRenk }); await yenile(); setForm(f => ({ ...f, renk: yeniRenk })) }} /></div>
            <div className="field"><label>KM</label><input type="number" placeholder="15000" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} /></div>
            <div className="field">
              <label>Şasi No</label>
              <input value={form.sasi_no} onChange={e => setForm({ ...form, sasi_no: e.target.value.toUpperCase() })} placeholder="Şasi numarası" />
            </div>
            <div className="field"><label>Motor No</label><input value={form.motor_no} onChange={e => setForm({ ...form, motor_no: e.target.value.toUpperCase() })} /></div>
            <div className="field form-full"><label>Notlar</label><textarea value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onIptal}>İptal</button>
          <button className="btn btn-primary" onClick={handleKaydet} disabled={kayitEdiliyor}>{kayitEdiliyor ? 'Kaydediliyor...' : duzenleme ? '💾 Güncelle' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}

const MusteriForm = ({ onKaydet, onIptal }) => {
  const [form, setForm] = useState({ ad: '', soyad: '', telefon: '', email: '', tc: '', kan_grubu: '', dogum_tarihi: '', adres: '', notlar: '' })
  const [error, setError] = useState('')
  const [kayitEdiliyor, setKayitEdiliyor] = useState(false)

  const handleKaydet = async () => {
    if (!form.ad || !form.soyad) return setError('Ad ve soyad zorunludur.')
    setKayitEdiliyor(true)

    // Telefon numarası tekrar kontrolü
    if (form.telefon.trim()) {
      const { data: mevcutTel } = await supabase
        .from('musteriler').select('id').eq('telefon', form.telefon.trim()).single()
      if (mevcutTel) {
        setError('Bu telefon numarası zaten kayıtlı!')
        setKayitEdiliyor(false)
        return
      }
    }

    const temizForm = {
      ...form,
      ad: form.ad.toUpperCase().trim(),
      soyad: form.soyad.toUpperCase().trim(),
      email: form.email.toLowerCase().trim() || null,
      telefon: form.telefon.trim() || null,
      tc: form.tc.trim() || null,
      adres: form.adres.toUpperCase().trim() || null,
      notlar: form.notlar.trim() || null,
      dogum_tarihi: form.dogum_tarihi || null,
      kan_grubu: form.kan_grubu || null,
    }
    const { error } = await supabase.from('musteriler').insert(temizForm)
    if (error) { setError(error.message); setKayitEdiliyor(false) }
    else onKaydet()
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <div className="modal-header">
          <span className="modal-title">Yeni Müşteri Ekle</span>
          <button className="modal-close" onClick={onIptal}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div className="field"><label>Ad *</label><input placeholder="Adı" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} /></div>
            <div className="field"><label>Soyad *</label><input placeholder="Soyadı" value={form.soyad} onChange={e => setForm({ ...form, soyad: e.target.value })} /></div>
            <div className="field"><label>Telefon</label><input placeholder="05xx xxx xx xx" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} /></div>
            <div className="field"><label>E-posta</label><input type="email" placeholder="ornek@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>TC Kimlik No</label><input placeholder="12345678901" maxLength={11} value={form.tc} onChange={e => setForm({ ...form, tc: e.target.value })} /></div>
            <div className="field">
              <label>Kan Grubu</label>
              <CustomSelect value={form.kan_grubu} onChange={v => setForm({ ...form, kan_grubu: v })} options={KAN_GRUPLARI} placeholder="Seçin" />
            </div>
            <div className="field"><label>Doğum Tarihi</label><TarihGirisi value={form.dogum_tarihi} onChange={v => setForm({ ...form, dogum_tarihi: v })} /></div>
            <div className="field"><label>Adres</label><input placeholder="Adres" value={form.adres} onChange={e => setForm({ ...form, adres: e.target.value })} /></div>
            <div className="field form-full"><label>Notlar</label><textarea placeholder="Ek notlar..." value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onIptal}>İptal</button>
          <button className="btn btn-primary" onClick={handleKaydet} disabled={kayitEdiliyor}>{kayitEdiliyor ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}

const MusteriDetay = ({ musteri: initialMusteri, onGeri, onIsEmriAc }) => {
  const [musteri, setMusteri] = useState(initialMusteri)
  const [araclar, setAraclar] = useState([])
  const [aracSilmeOnayId, setAracSilmeOnayId] = useState(null)
  const [isler, setIsler] = useState([])
  const [aracFormu, setAracFormu] = useState(false)
  const [duzenleArac, setDuzenleArac] = useState(null)
  const [aktifTab, setAktifTab] = useState('araclar')
  const [duzenle, setDuzenle] = useState(false)
  const [editForm, setEditForm] = useState({ ...initialMusteri })
  const [guncelleniyor, setGuncelleniyor] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchDetay() }, [])

  const handleAracSil = async (arac) => {
    if (aracSilmeOnayId !== arac.id) { setAracSilmeOnayId(arac.id); return }
    setAracSilmeOnayId(null)
    await supabase.from('araclar').delete().eq('id', arac.id)
    fetchDetay()
  }

  const fetchDetay = async () => {
    const [aracRes, isRes] = await Promise.all([
      supabase.from('araclar').select('*').eq('musteri_id', musteri.id).order('created_at', { ascending: false }),
      supabase.from('is_emirleri').select('*, musteriler(ad, soyad, telefon), araclar(plaka, marka, model, yil, renk, km), personel(ad, soyad)').eq('musteri_id', musteri.id).order('created_at', { ascending: false }),
    ])
    setAraclar(aracRes.data || [])
    setIsler(isRes.data || [])
  }

  const handleGuncelle = async () => {
    setGuncelleniyor(true)
    const { error } = await supabase.from('musteriler').update({
      ad: editForm.ad?.toUpperCase().trim(),
      soyad: editForm.soyad?.toUpperCase().trim(),
      telefon: editForm.telefon?.trim(),
      email: editForm.email?.toLowerCase().trim(),
      tc: editForm.tc?.trim(),
      kan_grubu: editForm.kan_grubu,
      dogum_tarihi: editForm.dogum_tarihi || null,
      adres: editForm.adres?.toUpperCase().trim(),
      notlar: editForm.notlar?.trim(),
      sms_izni: !!editForm.sms_izni,
      email_izni: !!editForm.email_izni,
    }).eq('id', musteri.id)
    if (error) { setMsg('Hata: ' + error.message) }
    else { setMusteri({ ...musteri, ...editForm }); setDuzenle(false); setMsg('✅ Güncellendi!'); setTimeout(() => setMsg(''), 3000) }
    setGuncelleniyor(false)
  }

  const durumBadge = (durum) => {
    const map = { bekliyor: ['badge-bekliyor', 'Bekliyor'], devam_ediyor: ['badge-devam', 'Devam Ediyor'], tamamlandi: ['badge-tamamlandi', 'Tamamlandı'], teslim_edildi: ['badge-teslim', 'Teslim Edildi'], iptal: ['badge-iptal', 'İptal'] }
    const [cls, label] = map[durum] || ['badge-normal', durum]
    return <span className={`badge ${cls}`}>{label}</span>
  }

  const tabs = [
    { id: 'araclar', label: `🏍️ Araçlar`, count: araclar.length },
    { id: 'isler', label: `🔧 İşlemler`, count: isler.length },
    { id: 'bilgiler', label: `👤 Bilgiler`, count: null },
  ]

  return (
    <div>
      {(aracFormu || duzenleArac) && (
        <AracFormModal musteriId={musteri.id} aracData={duzenleArac}
          onKaydet={() => { setAracFormu(false); setDuzenleArac(null); fetchDetay() }}
          onIptal={() => { setAracFormu(false); setDuzenleArac(null) }} />
      )}

      {/* Üst başlık */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={onGeri}>← Geri</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${musteri.ad} ${musteri.soyad}`}>{musteri.ad} {musteri.soyad}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
            {musteri.telefon && <span>📞 {formatTelefon(musteri.telefon)}</span>}
            {musteri.kan_grubu && <span>🩸 {musteri.kan_grubu}</span>}
            {araclar.length > 0 && <span>🏍️ {araclar.length} araç</span>}
          </div>
        </div>
      </div>

      {/* Tab menü */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1rem', overflow: 'hidden', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setAktifTab(tab.id)} style={{
            background: 'none', border: 'none', color: aktifTab === tab.id ? '#e63030' : '#555',
            fontFamily: 'Inter,sans-serif', fontSize: '0.85rem', fontWeight: 600,
            padding: '0.6rem 1rem', cursor: 'pointer',
            borderBottom: aktifTab === tab.id ? '2px solid #e63030' : '2px solid transparent',
            marginBottom: '-1px', whiteSpace: 'nowrap'
          }}>
            {tab.label} {tab.count !== null && <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* ARAÇLAR */}
      {aktifTab === 'araclar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAracFormu(true)}>+ Araç Ekle</button>
          </div>
          {araclar.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🏍️</div><p>Kayıtlı araç yok</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {araclar.map(a => (
                <div key={a.id} className="table-card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '0.05em' }}>{formatPlaka(a.plaka)}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{a.marka} {a.model}</span>
                        {a.yil && <span className="badge badge-normal">{a.yil}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        {a.yakit_tipi && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>⛽ {a.yakit_tipi}</span>}
                        {a.renk && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>🎨 {a.renk}</span>}
                        {a.km > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>📍 {a.km.toLocaleString('tr-TR')} km</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'5px'}}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDuzenleArac(a)}>✏️ Düzenle</button>
                      {aracSilmeOnayId === a.id ? (
                        <span style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-danger btn-sm" onClick={() => handleAracSil(a)}>Emin misin?</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setAracSilmeOnayId(null)}>✕</button>
                        </span>
                      ) : (
                        <button className="btn btn-danger btn-sm" onClick={() => handleAracSil(a)}>🗑️</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* İŞ GEÇMİŞİ */}
      {aktifTab === 'isler' && (
        <div className="table-card">
          {isler.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">🔧</div><p>İş geçmişi yok</p></div>
            : <>
                {/* Masaüstü tablo */}
                <div className="desktop-only" style={{overflowX:'auto'}}>
                  <table>
                    <thead><tr><th>İş No</th><th>Araç</th><th>Teknisyen</th><th>Durum</th><th>Tutar</th><th>Tarih</th></tr></thead>
                    <tbody>
                      {isler.map(is => (
                        <tr key={is.id} style={{cursor:'pointer'}} onClick={() => onIsEmriAc && onIsEmriAc(is)}>
                          <td style={{fontWeight:700,color:'var(--text-primary)'}}>#{is.is_emri_no}</td>
                          <td>{formatPlaka(is.araclar?.plaka)} <span style={{color:'var(--text-muted)',fontSize:'0.75rem'}}>{is.araclar?.marka}</span></td>
                          <td style={{color:'var(--text-secondary)'}}>{is.personel ? `${is.personel.ad} ${is.personel.soyad}` : '-'}</td>
                          <td>{durumBadge(is.durum)}</td>
                          <td style={{color:'#22c55e',fontWeight:600}}>₺{(is.toplam_tutar||0).toLocaleString('tr-TR')}</td>
                          <td style={{color:'var(--text-muted)'}}>{new Date(is.created_at).toLocaleDateString('tr-TR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobil kartlar */}
                <div className="mobile-only" style={{padding:'8px'}}>
                  {isler.map(is => (
                    <div key={is.id} onClick={() => onIsEmriAc && onIsEmriAc(is)}
                      style={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',marginBottom:'8px',cursor:'pointer'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <span style={{fontWeight:700,color:'var(--text-primary)',fontSize:'13px'}}>#{is.is_emri_no}</span>
                          {durumBadge(is.durum)}
                        </div>
                        <span style={{color:'#22c55e',fontWeight:700,fontSize:'14px'}}>₺{(is.toplam_tutar||0).toLocaleString('tr-TR')}</span>
                      </div>
                      <div style={{color:'#e5484d',fontSize:'12px',fontWeight:600}}>{formatPlaka(is.araclar?.plaka)} <span style={{color:'var(--text-muted)',fontWeight:400}}>{is.araclar?.marka}</span></div>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}>
                        <span style={{color:'var(--text-muted)',fontSize:'11px'}}>{is.personel ? `${is.personel.ad} ${is.personel.soyad}` : '-'}</span>
                        <span style={{color:'var(--text-muted)',fontSize:'11px'}}>{new Date(is.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
          }
        </div>
      )}

      {/* BİLGİLER */}
      {aktifTab === 'bilgiler' && (
        <div className="table-card">
          <div className="table-header">
            <span className="table-title">Müşteri Bilgileri</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { setDuzenle(!duzenle); setEditForm({ ...musteri }) }}>
              {duzenle ? '✕ İptal' : '✏️ Düzenle'}
            </button>
          </div>
          <div className="modal-body">
            {msg && <div className={`alert ${msg.startsWith('Hata') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>{msg}</div>}
            <div className="form-grid">
              <div className="field"><label>Ad</label><input readOnly={!duzenle} value={duzenle ? editForm.ad || '' : musteri.ad || ''} onChange={e => setEditForm({ ...editForm, ad: e.target.value })} /></div>
              <div className="field"><label>Soyad</label><input readOnly={!duzenle} value={duzenle ? editForm.soyad || '' : musteri.soyad || ''} onChange={e => setEditForm({ ...editForm, soyad: e.target.value })} /></div>
              <div className="field"><label>Telefon</label><input readOnly={!duzenle} value={duzenle ? editForm.telefon || '' : (musteri.telefon ? formatTelefon(musteri.telefon) : '-')} onChange={e => setEditForm({ ...editForm, telefon: e.target.value })} /></div>
              <div className="field"><label>E-posta</label><input readOnly={!duzenle} value={duzenle ? editForm.email || '' : musteri.email || '-'} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="field"><label>TC Kimlik No</label><input readOnly={!duzenle} value={duzenle ? editForm.tc || '' : musteri.tc || '-'} onChange={e => setEditForm({ ...editForm, tc: e.target.value })} /></div>
              <div className="field">
                <label>Kan Grubu</label>
                {duzenle ? <CustomSelect value={editForm.kan_grubu || ''} onChange={v => setEditForm({ ...editForm, kan_grubu: v })} options={KAN_GRUPLARI} placeholder="Seçin" /> : <input readOnly value={musteri.kan_grubu || '-'} />}
              </div>
              <div className="field"><label>Doğum Tarihi</label><TarihGirisi readOnly={!duzenle} value={duzenle ? editForm.dogum_tarihi || '' : musteri.dogum_tarihi} onChange={v => setEditForm({ ...editForm, dogum_tarihi: v })} /></div>
              <div className="field"><label>Adres</label><input readOnly={!duzenle} value={duzenle ? editForm.adres || '' : musteri.adres || '-'} onChange={e => setEditForm({ ...editForm, adres: e.target.value })} /></div>
              <div className="field form-full">
                <label>İletişim Tercihi</label>
                {duzenle ? (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {[
                      { key: 'sms_izni', label: 'SMS', icon: '📱' },
                      { key: 'email_izni', label: 'E-posta', icon: '📧' },
                    ].map(({ key, label, icon }) => {
                      const secili = !!editForm[key]
                      return (
                        <label
                          key={key}
                          onClick={() => setEditForm({ ...editForm, [key]: !secili })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', userSelect: 'none',
                            padding: '9px 16px', borderRadius: '10px',
                            border: `1.5px solid ${secili ? '#e5484d' : 'var(--border)'}`,
                            background: secili ? 'rgba(229,72,77,.1)' : 'var(--bg-elevated)',
                            transition: 'all .15s ease',
                          }}
                        >
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                            border: `2px solid ${secili ? '#e5484d' : 'var(--border)'}`,
                            background: secili ? '#e5484d' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s ease',
                          }}>
                            {secili && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>}
                          </div>
                          <span style={{ fontSize: '1rem' }}>{icon}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: secili ? 700 : 500, color: secili ? '#e5484d' : 'var(--text-secondary)' }}>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ marginTop: '4px' }}>
                    {(musteri.sms_izni || musteri.email_izni) ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {musteri.sms_izni && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', border: '1.5px solid rgba(229,72,77,.35)', background: 'rgba(229,72,77,.1)', color: '#e5484d', fontWeight: 600, fontSize: '0.85rem' }}>📱 SMS</span>
                        )}
                        {musteri.email_izni && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', border: '1.5px solid rgba(229,72,77,.35)', background: 'rgba(229,72,77,.1)', color: '#e5484d', fontWeight: 600, fontSize: '0.85rem' }}>📧 E-posta</span>
                        )}
                      </div>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                        padding: '7px 14px', borderRadius: '20px',
                        border: '1.5px solid var(--border)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem',
                      }}>
                        🔕 Hiç Biri
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="field form-full"><label>Notlar</label><textarea readOnly={!duzenle} style={!duzenle ? {color:"var(--text-primary)",opacity:0.85} : {}} value={duzenle ? editForm.notlar || '' : musteri.notlar || '-'} onChange={e => setEditForm({ ...editForm, notlar: e.target.value })} /></div>
            </div>
            {duzenle && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleGuncelle} disabled={guncelleniyor}>{guncelleniyor ? 'Kaydediliyor...' : '💾 Güncelle'}</button>
            </div>}
          </div>
        </div>
      )}
    </div>
  )
}

const Musteriler = ({ onIsEmriAc }) => {
  const [musteriler, setMusteriler] = useState([])
  const [araclar, setAraclar] = useState([])
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [musteriFormu, setMusteriFormu] = useState(false)
  const [seciliMusteri, setSeciliMusteri] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async (aramaQuery = '') => {
    setLoading(true)
    const [aracRes] = await Promise.all([
      supabase.from('araclar').select('musteri_id, plaka'),
    ])
    setAraclar(aracRes.data || [])

    if (aramaQuery.trim()) {
      // Plaka araması — araclar tablosundan musteri_id bul
      const { data: plakaRes } = await supabase
        .from('araclar')
        .select('musteri_id')
        .ilike('plaka', `%${aramaQuery}%`)
      const plakaMusteri = (plakaRes || []).map(a => a.musteri_id)

      // Müşteri alanlarında ara
      const { data: musteriRes } = await supabase
        .from('musteriler').select('*')
        .or(`ad.ilike.%${aramaQuery}%,soyad.ilike.%${aramaQuery}%,telefon.ilike.%${aramaQuery}%,tc.ilike.%${aramaQuery}%,email.ilike.%${aramaQuery}%`)
        .order('ad').order('soyad')
        .limit(100)

      // Plaka eşleşenleri de ekle (tekrar olmasın)
      let birlesmis = musteriRes || []
      if (plakaMusteri.length > 0) {
        const { data: plakaMusRes } = await supabase
          .from('musteriler').select('*')
          .in('id', plakaMusteri)
        const mevcutIdler = new Set(birlesmis.map(m => m.id))
        const ekstra = (plakaMusRes || []).filter(m => !mevcutIdler.has(m.id))
        birlesmis = [...birlesmis, ...ekstra]
      }
      setMusteriler(birlesmis)
    } else {
      // Arama yoksa son 10 müşteri
      const { data } = await supabase
        .from('musteriler').select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setMusteriler(data || [])
    }
    setLoading(false)
  }

  const getPlakalari = (musteriId) => araclar.filter(a => a.musteri_id === musteriId).map(a => formatPlaka(a.plaka)).join(', ')
  const getPlakaListesi = (musteriId) => araclar.filter(a => a.musteri_id === musteriId).map(a => formatPlaka(a.plaka))

  const filtrelenmis = musteriler

  if (seciliMusteri) {
    return <MusteriDetay musteri={seciliMusteri} onGeri={() => { setSeciliMusteri(null); fetchData() }} onIsEmriAc={onIsEmriAc} />
  }

  return (
    <div>
      {musteriFormu && <MusteriForm onKaydet={() => { setMusteriFormu(false); fetchData() }} onIptal={() => setMusteriFormu(false)} />}

      <div className="search-bar">
        <input className="search-input" placeholder="Ad, soyad, telefon, plaka, TC..." value={arama} onChange={e => { setArama(e.target.value); fetchData(e.target.value) }} />
        <button className="btn btn-primary" onClick={() => setMusteriFormu(true)}>+ Müşteri</button>
      </div>

      <div className="table-card">
        <div className="table-header">
          <span className="table-title">Müşteriler {arama ? `(${filtrelenmis.length} sonuç)` : `(Son ${filtrelenmis.length})`}</span>
        </div>
        {loading ? <div className="empty-state"><p>Yükleniyor...</p></div> :
          filtrelenmis.length === 0 ? <div className="empty-state"><div className="empty-state-icon">👥</div><p>{arama ? 'Eşleşen bulunamadı' : 'Henüz müşteri yok'}</p></div> : (
            <>
              {/* MASAÜSTÜ TABLO */}
              <div className="desktop-only" style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Plaka</th><th>TC</th><th>Kan Grubu</th><th>Kayıt</th><th></th></tr></thead>
                  <tbody>
                    {filtrelenmis.map(m => (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setSeciliMusteri(m)}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${m.ad} ${m.soyad}`}>{m.ad} {m.soyad}</td>
                        <td>{m.telefon ? formatTelefon(m.telefon) : '-'}</td>
                        <td style={{ maxWidth: '150px' }}>
                          {(() => {
                            const plakalar = getPlakaListesi(m.id)
                            if (plakalar.length === 0) return '-'
                            const gosterilen = plakalar.slice(0, 2)
                            const fazla = plakalar.length - gosterilen.length
                            return (
                              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }} title={plakalar.join(', ')}>
                                {gosterilen.map((p, i) => (
                                  <span key={i} style={{ fontWeight: 600, letterSpacing: '0.03em', color: '#e63030', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{p}{i < gosterilen.length - 1 ? ',' : ''}</span>
                                ))}
                                {fazla > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>+{fazla}</span>
                                )}
                              </span>
                            )
                          })()}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{m.tc || '-'}</td>
                        <td>{m.kan_grubu ? <span className="badge badge-devam">{m.kan_grubu}</span> : '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleDateString('tr-TR')}</td>
                        <td><button className="btn btn-secondary btn-sm">→</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBİL KART LİSTESİ */}
              <div className="mobile-only" style={{ padding: '0.5rem' }}>
                {filtrelenmis.map(m => (
                  <div key={m.id} onClick={() => setSeciliMusteri(m)}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${m.ad} ${m.soyad}`}>{m.ad} {m.soyad}</div>
                      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        {m.telefon && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>📞 {formatTelefon(m.telefon)}</span>}
                        {(() => {
                          const plakalar = getPlakaListesi(m.id)
                          if (plakalar.length === 0) return null
                          const gosterilen = plakalar.slice(0, 1)
                          const fazla = plakalar.length - gosterilen.length
                          return (
                            <span style={{ color: '#e63030', fontSize: '0.78rem', fontWeight: 600 }} title={plakalar.join(', ')}>
                              🏍️ {gosterilen.join(', ')}{fazla > 0 && ` +${fazla}`}
                            </span>
                          )
                        })()}
                        {m.kan_grubu && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>🩸 {m.kan_grubu}</span>}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem', flexShrink: 0 }}>›</span>
                  </div>
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  )
}

export default Musteriler
