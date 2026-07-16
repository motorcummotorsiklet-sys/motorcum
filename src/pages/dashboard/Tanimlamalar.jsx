import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import CustomSelect from '../../components/dashboard/CustomSelect'

const PARCA_KATEGORILERI = ['Motor', 'Fren', 'Elektrik', 'Süspansiyon', 'Şanzıman', 'Kaporta', 'Egzoz', 'Filtre', 'Yağ', 'Lastik', 'Zincir', 'Aydınlatma', 'Diğer']

const AracTanimlamalari = () => {
  const [aktifTab, setAktifTab] = useState('markalar')
  const [markalar, setMarkalar] = useState([])
  const [modeller, setModeller] = useState([])
  const [renkler, setRenkler] = useState([])
  const [loading, setLoading] = useState(true)
  const [yeniMarka, setYeniMarka] = useState('')
  const [markaFiltre, setMarkaFiltre] = useState('')
  const [modelFiltre, setModelFiltre] = useState('')
  const [markaFiltreSec, setMarkaFiltreSec] = useState('')
  const [renkFiltre, setRenkFiltre] = useState('')
  const [yeniRenk, setYeniRenk] = useState('')
  const [yeniModel, setYeniModel] = useState({ marka_isim: '', isim: '' })
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [silmeOnay, setSilmeOnay] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [markaRes, modelRes, renkRes] = await Promise.all([
      supabase.from('arac_markalari').select('*').order('isim'),
      supabase.from('arac_modelleri').select('*').order('marka_isim').order('isim'),
      supabase.from('arac_renkleri').select('*').order('isim'),
    ])
    setMarkalar(markaRes.data || [])
    setModeller(modelRes.data || [])
    setRenkler(renkRes.data || [])
    setLoading(false)
  }

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text:'',type:'' }), 3000) }

  const markaEkle = async () => {
    if (!yeniMarka.trim()) return
    const { error } = await supabase.from('arac_markalari').insert({ isim: yeniMarka.trim() })
    if (error) showMsg(error.message.includes('unique') ? 'Bu marka zaten var.' : error.message, 'error')
    else { setYeniMarka(''); fetchAll(); showMsg('Marka eklendi!') }
  }
  const markaSil = async (id) => {
    if (silmeOnay !== `marka-${id}`) { setSilmeOnay(`marka-${id}`); return }
    setSilmeOnay(null)
    await supabase.from('arac_markalari').delete().eq('id', id)
    fetchAll(); showMsg('Silindi.')
  }
  const modelEkle = async () => {
    if (!yeniModel.marka_isim || !yeniModel.isim.trim()) return showMsg('Marka ve model adı zorunludur.', 'error')
    const { error } = await supabase.from('arac_modelleri').insert({ marka_isim: yeniModel.marka_isim, isim: yeniModel.isim.trim() })
    if (error) showMsg(error.message.includes('unique') ? 'Bu model zaten var.' : error.message, 'error')
    else { setYeniModel({ marka_isim: yeniModel.marka_isim, isim:'' }); fetchAll(); showMsg('Model eklendi!') }
  }
  const modelSil = async (id) => {
    if (silmeOnay !== `model-${id}`) { setSilmeOnay(`model-${id}`); return }
    setSilmeOnay(null)
    await supabase.from('arac_modelleri').delete().eq('id', id)
    fetchAll(); showMsg('Silindi.')
  }
  const renkEkle = async () => {
    if (!yeniRenk.trim()) return
    const { error } = await supabase.from('arac_renkleri').insert({ isim: yeniRenk.trim() })
    if (error) showMsg(error.message.includes('unique') ? 'Bu renk zaten var.' : error.message, 'error')
    else { setYeniRenk(''); fetchAll(); showMsg('Renk eklendi!') }
  }
  const renkSil = async (id) => {
    if (silmeOnay !== `renk-${id}`) { setSilmeOnay(`renk-${id}`); return }
    setSilmeOnay(null)
    await supabase.from('arac_renkleri').delete().eq('id', id)
    fetchAll(); showMsg('Silindi.')
  }

  const tabStyle = (id) => ({
    background:'none', border:'none', color: aktifTab===id ? '#e63030':'#555',
    fontFamily:'Inter,sans-serif', fontSize:'0.82rem', fontWeight:600,
    padding:'0.5rem 0.9rem', cursor:'pointer',
    borderBottom: aktifTab===id ? '2px solid #e63030':'2px solid transparent',
    marginBottom:'-1px', whiteSpace:'nowrap'
  })

  return (
    <div>
      {msg.text && <div className={`alert ${msg.type==='error'?'alert-error':'alert-success'}`} style={{marginBottom:'1rem'}}>{msg.text}</div>}
      <div style={{ display:'flex', borderBottom:'1px solid #1e1e1e', marginBottom:'1rem', overflowX:'auto' }}>
        <button style={tabStyle('markalar')} onClick={() => setAktifTab('markalar')}>🏷️ Markalar ({markalar.length})</button>
        <button style={tabStyle('modeller')} onClick={() => setAktifTab('modeller')}>📋 Modeller ({modeller.length})</button>
        <button style={tabStyle('renkler')} onClick={() => setAktifTab('renkler')}>🎨 Renkler ({renkler.length})</button>
      </div>

      {aktifTab === 'markalar' && (
        <div>
          <div className="table-card" style={{marginBottom:'1rem'}}>
            <div className="modal-body">
              <div style={{display:'flex',gap:'0.75rem'}}>
                <input className="search-input" placeholder="Yeni marka..." value={yeniMarka} onChange={e => setYeniMarka(e.target.value)} onKeyDown={e => e.key==='Enter'&&markaEkle()} style={{flex:1}} />
                <button className="btn btn-primary" onClick={markaEkle}>+ Ekle</button>
              </div>
            </div>
          </div>
          <div className="table-card">
            <div className="table-header">
              <span className="table-title">Markalar ({markalar.filter(m => m.isim.toLowerCase().includes(markaFiltre.toLowerCase())).length})</span>
              <input className="search-input" placeholder="Marka ara..." value={markaFiltre} onChange={e => setMarkaFiltre(e.target.value)} style={{width:180}} />
            </div>
            {loading ? <div className="empty-state"><p>Yükleniyor...</p></div> : markalar.length === 0 ? <div className="empty-state"><p>Henüz marka yok</p></div> :
              <table><thead><tr><th>Marka</th><th>Eklenme</th><th></th></tr></thead>
                <tbody>{markalar.filter(m => m.isim.toLowerCase().includes(markaFiltre.toLowerCase())).map(m => <tr key={m.id}><td style={{color:'var(--text-primary)',fontWeight:500}}>{m.isim}</td><td style={{color:'var(--text-muted)'}}>{new Date(m.created_at).toLocaleDateString('tr-TR')}</td><td>{silmeOnay === `marka-${m.id}` ? <span style={{display:'flex',gap:'4px'}}><button className="btn btn-danger btn-sm" onClick={() => markaSil(m.id)}>Emin misin?</button><button className="btn btn-secondary btn-sm" onClick={() => setSilmeOnay(null)}>✕</button></span> : <button className="btn btn-danger btn-sm" onClick={() => markaSil(m.id)}>Sil</button>}</td></tr>)}</tbody>
              </table>}
          </div>
        </div>
      )}

      {aktifTab === 'modeller' && (
        <div>
          <div className="table-card" style={{marginBottom:'1rem'}}>
            <div className="modal-body">
              <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
                <CustomSelect
                  style={{ flex:1, minWidth:'150px' }}
                  value={yeniModel.marka_isim}
                  onChange={v => setYeniModel({...yeniModel, marka_isim: v})}
                  placeholder="Marka seçin"
                  options={markalar.map(m => ({ value: m.isim, label: m.isim }))}
                />
                <input className="search-input" placeholder="Model adı..." value={yeniModel.isim} onChange={e => setYeniModel({...yeniModel, isim: e.target.value})} onKeyDown={e => e.key==='Enter'&&modelEkle()} style={{flex:2,minWidth:'150px'}} />
                <button className="btn btn-primary" onClick={modelEkle}>+ Ekle</button>
              </div>
            </div>
          </div>
          <div className="table-card">
            <div className="table-header" style={{flexWrap:'wrap',gap:'6px'}}>
              <span className="table-title">
                Modeller ({modeller.filter(m =>
                  (!markaFiltreSec || m.marka_isim === markaFiltreSec) &&
                  (!modelFiltre || m.isim.toLowerCase().includes(modelFiltre.toLowerCase()))
                ).length})
              </span>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                <CustomSelect
                  style={{ width:150 }}
                  value={markaFiltreSec}
                  onChange={setMarkaFiltreSec}
                  placeholder="Tüm Markalar"
                  options={[{ value:'', label:'Tüm Markalar' }, ...markalar.map(m => ({ value: m.isim, label: m.isim }))]}
                />
                <input className="search-input" placeholder="Model ara..." value={modelFiltre} onChange={e => setModelFiltre(e.target.value)} style={{width:150}} />
                {(markaFiltreSec || modelFiltre) && (
                  <button className="btn btn-secondary btn-sm" onClick={() => { setMarkaFiltreSec(''); setModelFiltre('') }}>Temizle</button>
                )}
              </div>
            </div>
            {modeller.length === 0 ? <div className="empty-state"><p>Henüz model yok</p></div> :
              <table><thead><tr><th>Marka</th><th>Model</th><th></th></tr></thead>
                <tbody>{modeller.filter(m =>
                  (!markaFiltreSec || m.marka_isim === markaFiltreSec) &&
                  (!modelFiltre || m.isim.toLowerCase().includes(modelFiltre.toLowerCase()))
                ).map(m => <tr key={m.id}><td><span className="badge badge-devam">{m.marka_isim}</span></td><td style={{color:'var(--text-primary)',fontWeight:500}}>{m.isim}</td><td>{silmeOnay === `model-${m.id}` ? <span style={{display:'flex',gap:'4px'}}><button className="btn btn-danger btn-sm" onClick={() => modelSil(m.id)}>Emin misin?</button><button className="btn btn-secondary btn-sm" onClick={() => setSilmeOnay(null)}>✕</button></span> : <button className="btn btn-danger btn-sm" onClick={() => modelSil(m.id)}>Sil</button>}</td></tr>)}</tbody>
              </table>}
          </div>
        </div>
      )}

      {aktifTab === 'renkler' && (
        <div>
          <div className="table-card" style={{marginBottom:'1rem'}}>
            <div className="modal-body">
              <div style={{display:'flex',gap:'0.75rem'}}>
                <input className="search-input" placeholder="Yeni renk..." value={yeniRenk} onChange={e => setYeniRenk(e.target.value)} onKeyDown={e => e.key==='Enter'&&renkEkle()} style={{flex:1}} />
                <button className="btn btn-primary" onClick={renkEkle}>+ Ekle</button>
              </div>
            </div>
          </div>
          <div className="table-card">
            <div className="table-header">
              <span className="table-title">Renkler ({renkler.filter(r => r.isim.toLowerCase().includes(renkFiltre.toLowerCase())).length})</span>
              <input className="search-input" placeholder="Renk ara..." value={renkFiltre} onChange={e => setRenkFiltre(e.target.value)} style={{width:160}} />
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem',padding:'1rem 1.5rem'}}>
              {renkler.filter(r => r.isim.toLowerCase().includes(renkFiltre.toLowerCase())).map(r => (
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:'0.4rem',background: silmeOnay === `renk-${r.id}` ? 'rgba(229,72,77,.12)' : 'var(--bg-elevated)',border: `1px solid ${silmeOnay === `renk-${r.id}` ? '#e5484d' : 'var(--border)'}`,borderRadius:'20px',padding:'0.35rem 0.75rem'}}>
                  <span style={{color:'var(--text-primary)',fontSize:'0.85rem'}}>{r.isim}</span>
                  <button onClick={() => renkSil(r.id)} title={silmeOnay === `renk-${r.id}` ? 'Onayla, sil' : 'Sil'}
                    style={{background:'none',border:'none',color: silmeOnay === `renk-${r.id}` ? '#e5484d' : 'var(--text-muted)',cursor:'pointer',fontSize: silmeOnay === `renk-${r.id}` ? '0.7rem' : '0.8rem',fontWeight: silmeOnay === `renk-${r.id}` ? 700 : 400,padding:0,lineHeight:1}}>
                    {silmeOnay === `renk-${r.id}` ? 'Sil?' : '✕'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const IsEmriTanimlamalari = () => {
  const [parcalar, setParcalar] = useState([])
  const [loading, setLoading] = useState(true)
  const [parcaArama, setParcaArama] = useState('')
  const [parcaKategoriFiltre, setParcaKategoriFiltre] = useState('')
  const [yeniParca, setYeniParca] = useState({ kod:'', isim:'', kategori:'', birim:'adet', birim_fiyat:'' })
  const [msg, setMsg] = useState({ text:'', type:'' })
  const [silmeOnayId, setSilmeOnayId] = useState(null)

  useEffect(() => { fetchParcalar() }, [])

  const fetchParcalar = async () => {
    const { data } = await supabase.from('parcalar').select('*').eq('aktif', true).order('kategori').order('isim')
    setParcalar(data || [])
    setLoading(false)
  }

  const showMsg = (text, type='success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text:'',type:'' }), 3000) }

  const parcaEkle = async () => {
    if (!yeniParca.isim.trim()) return showMsg('Parça adı zorunludur.', 'error')
    const { error } = await supabase.from('parcalar').insert({ ...yeniParca, isim: yeniParca.isim.trim().toUpperCase(), kod: yeniParca.kod.trim().toUpperCase()||null, birim_fiyat: parseFloat(yeniParca.birim_fiyat||0) })
    if (error) showMsg(error.message, 'error')
    else { setYeniParca({ kod:'', isim:'', kategori:'', birim:'adet', birim_fiyat:'' }); fetchParcalar(); showMsg('Parça eklendi!') }
  }

  const parcaSil = async (id) => {
    if (silmeOnayId !== id) { setSilmeOnayId(id); return }
    setSilmeOnayId(null)
    await supabase.from('parcalar').update({ aktif: false }).eq('id', id)
    fetchParcalar(); showMsg('Parça silindi.')
  }

  return (
    <div>
      {msg.text && <div className={`alert ${msg.type==='error'?'alert-error':'alert-success'}`} style={{marginBottom:'1rem'}}>{msg.text}</div>}
      <div className="table-card" style={{marginBottom:'1rem'}}>
        <div className="table-header"><span className="table-title">Yeni Parça Ekle</span></div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field"><label>Parça Adı *</label><input placeholder="Yağ filtresi, Ön balata..." value={yeniParca.isim} onChange={e => setYeniParca({...yeniParca, isim: e.target.value})} /></div>
            <div className="field"><label>Parça Kodu</label><input placeholder="OEM kodu..." value={yeniParca.kod} onChange={e => setYeniParca({...yeniParca, kod: e.target.value})} /></div>
            <div className="field">
              <label>Kategori</label>
              <CustomSelect
                value={yeniParca.kategori}
                onChange={v => setYeniParca({...yeniParca, kategori: v})}
                placeholder="Seçin"
                options={PARCA_KATEGORILERI}
              />
            </div>
            <div className="field">
              <label>Birim</label>
              <CustomSelect
                value={yeniParca.birim}
                onChange={v => setYeniParca({...yeniParca, birim: v})}
                options={[
                  { value:'adet', label:'Adet' },
                  { value:'litre', label:'Litre' },
                  { value:'metre', label:'Metre' },
                  { value:'takım', label:'Takım' },
                  { value:'set', label:'Set' },
                ]}
              />
            </div>
            <div className="field"><label>Birim Fiyat (₺)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={yeniParca.birim_fiyat} onChange={e => setYeniParca({...yeniParca, birim_fiyat: e.target.value})} /></div>
            <div className="field" style={{display:'flex',alignItems:'flex-end'}}>
              <button className="btn btn-primary" onClick={parcaEkle} style={{width:'100%'}}>+ Parça Ekle</button>
            </div>
          </div>
        </div>
      </div>
      <div className="table-card">
        <div className="table-header">
          <span className="table-title">Parça Listesi ({parcalar.filter(p => {
            const aramaUy = !parcaArama || p.isim.toLowerCase().includes(parcaArama.toLowerCase()) || (p.kod||'').toLowerCase().includes(parcaArama.toLowerCase())
            const kategoriUy = !parcaKategoriFiltre || p.kategori === parcaKategoriFiltre
            return aramaUy && kategoriUy
          }).length}/{parcalar.length})</span>
        </div>
        {/* Filtreler */}
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',padding:'0 0 12px 0'}}>
          <input
            className="search-input"
            style={{flex:2,minWidth:'160px'}}
            placeholder="Parça adı veya kod ara..."
            value={parcaArama}
            onChange={e => setParcaArama(e.target.value)}
          />
          <CustomSelect
            style={{ flex:1, minWidth:'130px' }}
            value={parcaKategoriFiltre}
            onChange={setParcaKategoriFiltre}
            placeholder="Tüm Kategoriler"
            options={[{ value:'', label:'Tüm Kategoriler' }, ...[...new Set(parcalar.map(p => p.kategori).filter(Boolean))].sort().map(k => ({ value:k, label:k }))]}
          />
          {(parcaArama || parcaKategoriFiltre) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setParcaArama(''); setParcaKategoriFiltre('') }}>
              Temizle
            </button>
          )}
        </div>
        {loading ? <div className="empty-state"><p>Yükleniyor...</p></div> : parcalar.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🔩</div><p>Henüz parça tanımlanmamış</p></div> :
          <table>
            <thead><tr><th>Parça Adı</th><th>Kod</th><th>Kategori</th><th>Birim</th><th>Fiyat</th><th></th></tr></thead>
            <tbody>{parcalar.filter(p => {
              const aramaUy = !parcaArama || p.isim.toLowerCase().includes(parcaArama.toLowerCase()) || (p.kod||'').toLowerCase().includes(parcaArama.toLowerCase())
              const kategoriUy = !parcaKategoriFiltre || p.kategori === parcaKategoriFiltre
              return aramaUy && kategoriUy
            }).map(p => (
              <tr key={p.id}>
                <td style={{color:'var(--text-primary)',fontWeight:500}}>{p.isim}</td>
                <td style={{color:'var(--text-muted)'}}>{p.kod||'-'}</td>
                <td>{p.kategori ? <span className="badge badge-normal">{p.kategori}</span> : '-'}</td>
                <td style={{color:'var(--text-secondary)'}}>{p.birim}</td>
                <td style={{color:'#22c55e',fontWeight:600}}>₺{parseFloat(p.birim_fiyat||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                <td>{silmeOnayId === p.id ? <span style={{display:'flex',gap:'4px'}}><button className="btn btn-danger btn-sm" onClick={() => parcaSil(p.id)}>Emin misin?</button><button className="btn btn-secondary btn-sm" onClick={() => setSilmeOnayId(null)}>✕</button></span> : <button className="btn btn-danger btn-sm" onClick={() => parcaSil(p.id)}>Sil</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        }
      </div>
    </div>
  )
}

const Tanimlamalar = () => {
  const [anaTab, setAnaTab] = useState('arac')

  const anaTabStyle = (id) => ({
    background: anaTab===id ? '#1a1a1a' : 'none',
    border: '1px solid',
    borderColor: anaTab===id ? '#e63030' : '#2a2a2a',
    borderRadius: '8px',
    color: anaTab===id ? '#fff' : '#666',
    fontFamily: 'Inter,sans-serif', fontSize:'0.88rem', fontWeight:600,
    padding: '0.6rem 1.25rem', cursor:'pointer', transition:'all 0.15s'
  })

  return (
    <div>
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <button style={anaTabStyle('arac')} onClick={() => setAnaTab('arac')}>🏍️ Araç Tanımlamaları</button>
        <button style={anaTabStyle('isemri')} onClick={() => setAnaTab('isemri')}>🔩 Parça Tanımlamaları</button>
      </div>
      {anaTab === 'arac' && <AracTanimlamalari />}
      {anaTab === 'isemri' && <IsEmriTanimlamalari />}
    </div>
  )
}

export default Tanimlamalar
