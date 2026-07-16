import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

const YAKIT_TIPLERI = ['Benzin', 'Dizel', 'LPG', 'Elektrik', 'Hibrit']

const Araclar = () => {
  const [araclar, setAraclar] = useState([])
  const [musteriler, setMusteriler] = useState([])
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAcik, setModalAcik] = useState(false)
  const [form, setForm] = useState({ musteri_id: '', plaka: '', marka: '', model: '', yil: '', renk: '', sasi_no: '', motor_no: '', yakit_tipi: '', km: '', notlar: '' })
  const [error, setError] = useState('')
  const [kayitEdiliyor, setKayitEdiliyor] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [aracRes, musteriRes] = await Promise.all([
      supabase.from('araclar').select('*, musteriler(ad, soyad, telefon)').order('created_at', { ascending: false }),
      supabase.from('musteriler').select('id, ad, soyad').order('ad'),
    ])
    setAraclar(aracRes.data || [])
    setMusteriler(musteriRes.data || [])
    setLoading(false)
  }

  const handleKaydet = async () => {
    if (!form.musteri_id || !form.plaka || !form.marka || !form.model) return setError('Müşteri, plaka, marka ve model zorunludur.')
    setKayitEdiliyor(true)
    setError('')
    const { error } = await supabase.from('araclar').insert({
      ...form,
      plaka: form.plaka.toUpperCase(),
      km: form.km ? parseInt(form.km) : 0,
      yil: form.yil ? parseInt(form.yil) : null,
    })
    if (error) {
      setError(error.message.includes('unique') ? 'Bu plaka zaten kayıtlı.' : error.message)
    } else {
      setModalAcik(false)
      setForm({ musteri_id: '', plaka: '', marka: '', model: '', yil: '', renk: '', sasi_no: '', motor_no: '', yakit_tipi: '', km: '', notlar: '' })
      fetchData()
    }
    setKayitEdiliyor(false)
  }

  const filtrelenmis = araclar.filter(a =>
    `${a.plaka} ${a.marka} ${a.model} ${a.musteriler?.ad} ${a.musteriler?.soyad}`.toLowerCase().includes(arama.toLowerCase())
  )

  return (
    <div>
      <div className="search-bar">
        <input className="search-input" placeholder="Plaka, marka, model veya müşteri ara..." value={arama} onChange={e => setArama(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setModalAcik(true)}>+ Araç Ekle</button>
      </div>

      <div className="table-card">
        <div className="table-header">
          <span className="table-title">Araçlar ({filtrelenmis.length})</span>
        </div>
        {loading ? <div className="empty-state"><p>Yükleniyor...</p></div> :
         filtrelenmis.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏍️</div><p>Araç bulunamadı</p></div> : (
          <table>
            <thead>
              <tr>
                <th>Plaka</th>
                <th>Müşteri</th>
                <th>Marka / Model</th>
                <th>Yıl</th>
                <th>Yakıt</th>
                <th>KM</th>
                <th>Renk</th>
              </tr>
            </thead>
            <tbody>
              {filtrelenmis.map(a => (
                <tr key={a.id}>
                  <td style={{fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em'}}>{a.plaka}</td>
                  <td>{a.musteriler?.ad} {a.musteriler?.soyad}</td>
                  <td>{a.marka} {a.model}</td>
                  <td>{a.yil || '-'}</td>
                  <td>{a.yakit_tipi || '-'}</td>
                  <td>{a.km?.toLocaleString('tr-TR') || '0'} km</td>
                  <td>{a.renk || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAcik && (
        <div className="modal-overlay" onClick={() => setModalAcik(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Yeni Araç Ekle</span>
              <button className="modal-close" onClick={() => setModalAcik(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="field form-full">
                  <label>Müşteri *</label>
                  <select value={form.musteri_id} onChange={e => setForm({...form, musteri_id: e.target.value})}>
                    <option value="">Müşteri seçin</option>
                    {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad} {m.soyad}</option>)}
                  </select>
                </div>
                <div className="field"><label>Plaka *</label><input placeholder="34ABC123" value={form.plaka} onChange={e => setForm({...form, plaka: e.target.value})} /></div>
                <div className="field"><label>Marka *</label><input placeholder="Honda" value={form.marka} onChange={e => setForm({...form, marka: e.target.value})} /></div>
                <div className="field"><label>Model *</label><input placeholder="CB500" value={form.model} onChange={e => setForm({...form, model: e.target.value})} /></div>
                <div className="field"><label>Yıl</label><input type="number" placeholder="2020" value={form.yil} onChange={e => setForm({...form, yil: e.target.value})} /></div>
                <div className="field"><label>Renk</label><input placeholder="Siyah" value={form.renk} onChange={e => setForm({...form, renk: e.target.value})} /></div>
                <div className="field">
                  <label>Yakıt Tipi</label>
                  <select value={form.yakit_tipi} onChange={e => setForm({...form, yakit_tipi: e.target.value})}>
                    <option value="">Seçin</option>
                    {YAKIT_TIPLERI.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="field"><label>KM</label><input type="number" placeholder="15000" value={form.km} onChange={e => setForm({...form, km: e.target.value})} /></div>
                <div className="field"><label>Şasi No</label><input value={form.sasi_no} onChange={e => setForm({...form, sasi_no: e.target.value})} /></div>
                <div className="field"><label>Motor No</label><input value={form.motor_no} onChange={e => setForm({...form, motor_no: e.target.value})} /></div>
                <div className="field form-full"><label>Notlar</label><textarea value={form.notlar} onChange={e => setForm({...form, notlar: e.target.value})} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalAcik(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleKaydet} disabled={kayitEdiliyor}>{kayitEdiliyor ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Araclar
