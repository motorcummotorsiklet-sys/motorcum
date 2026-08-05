import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import CustomSelect from '../../components/dashboard/CustomSelect'

// Türkiye telefon formatı
const formatTelefon = (tel) => {
  if (!tel) return ''
  const rakamlar = tel.toString().replace(/\D/g, '')
  if (rakamlar.length !== 11) return tel
  return `${rakamlar.slice(0,4)} ${rakamlar.slice(4,7)} ${rakamlar.slice(7,9)} ${rakamlar.slice(9,11)}`
}
const paraFormat = (v) => `₺${parseFloat(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
const tarihFormat = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '-'

// Doğum tarihi ile aynı standart maskeli tarih girişi: GG.AA.YYYY
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

// Bayi seçimi — isimle yazarak arama yapılabilir, id/isim ayrımını destekler
const BayiAramaSelect = ({ bayiler, value, onChange, placeholder }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const secili = bayiler.find(b => b.id === value)
    setQuery(secili ? secili.dukkan_adi : '')
  }, [value, bayiler])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [])

  const filtered = bayiler.filter(b => b.dukkan_adi.toLowerCase().includes(query.toLowerCase()))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange('') }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || 'Bayi adı yazın...'}
        autoComplete="off"
      />
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 9999, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
          <div
            onPointerDown={e => { e.preventDefault(); onChange(''); setQuery(''); setOpen(false) }}
            style={{ padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', color: !value ? 'var(--text-primary)' : 'var(--text-secondary)', background: !value ? 'rgba(230,48,48,0.15)' : 'transparent', fontWeight: !value ? 600 : 400 }}
          >
            Tüm Bayiler
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Bulunamadı</div>
          ) : filtered.map(b => (
            <div
              key={b.id}
              onPointerDown={e => { e.preventDefault(); onChange(b.id); setQuery(b.dukkan_adi); setOpen(false) }}
              style={{ padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', color: value === b.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: value === b.id ? 'rgba(230,48,48,0.15)' : 'transparent', fontWeight: value === b.id ? 600 : 400 }}
              onMouseEnter={e => { if (value !== b.id) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.background = value === b.id ? 'rgba(230,48,48,0.15)' : 'transparent' }}
            >
              {b.dukkan_adi}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Telefon numarası girişi — tek standart format: 0XXX XXX XX XX
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
    // Başında 0 yoksa otomatik ekle (532... yazınca 0532... olsun); zaten 0 ile başlıyorsa dokunma
    if (rakamlar.length > 0 && rakamlar[0] !== '0') rakamlar = '0' + rakamlar
    rakamlar = rakamlar.slice(0, 11)
    setMetin(rakamToGoster(rakamlar))
    onChange(rakamlar)
  }
  return <input value={metin} onChange={handleChange} placeholder={placeholder || '05XX XXX XX XX'} inputMode="numeric" maxLength={14} />
}

// Elle yazılan parça adı mevcut tanımlarda yoksa (büyük/küçük harf ve boşluk
// farkı gözetmeksizin) otomatik olarak Tanımlamalar'a ekler — İş Emirleri'ndeki
// ile birebir aynı mantık, aynı "parcalar" tablosunu paylaşırlar.
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

// Parça ara/seç — İş Emirleri'ndeki ile aynı bileşen: yazarken büyük harfe
// çevirir, tanımlı listeden de arayabilirsin.
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
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { const v = e.target.value.toUpperCase(); setQuery(v); setOpen(true); onManual(v) }}
        onFocus={() => setOpen(true)}
        placeholder="Parça adı yazın veya listeden seçin..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 9999, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
          {filtered.map(p => (
            <div key={p.id}
              onPointerDown={e => { e.preventDefault(); const isimBuyuk = p.isim.toUpperCase(); onChange(p.id, isimBuyuk, p.birim_fiyat); setQuery(isimBuyuk); setOpen(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: value === p.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: value === p.id ? 'rgba(229,72,77,.08)' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = value === p.id ? 'rgba(229,72,77,.08)' : 'transparent'}
            >
              <span>{p.isim} {p.kod && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({p.kod})</span>}</span>
              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 12 }}>₺{parseFloat(p.birim_fiyat || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const BayiHesaplari = () => {
  const { profile } = useAuth()
  const [bayiler, setBayiler] = useState([])
  const [toplamTahsilat, setToplamTahsilat] = useState(0)
  const [loading, setLoading] = useState(true)
  const [arama, setArama] = useState('')
  const [seciliBayi, setSeciliBayi] = useState(null)
  const [hareketler, setHareketler] = useState([])
  const [hareketTipFiltre, setHareketTipFiltre] = useState('hepsi')
  const [hareketBaslangic, setHareketBaslangic] = useState('')
  const [hareketBitis, setHareketBitis] = useState('')

  const [yeniBayiAcik, setYeniBayiAcik] = useState(false)
  const [raporAcik, setRaporAcik] = useState(false)
  const [raporBaslangic, setRaporBaslangic] = useState('')
  const [raporBitis, setRaporBitis] = useState('')
  const [raporBayiFiltre, setRaporBayiFiltre] = useState('')
  const [raporVerisi, setRaporVerisi] = useState([])
  const [raporDurumFiltre, setRaporDurumFiltre] = useState('hepsi')
  const [raporYukleniyor, setRaporYukleniyor] = useState(false)
  const [yeniBayi, setYeniBayi] = useState({ dukkan_adi: '', yetkili_kisi: '', telefon: '', adres: '', notlar: '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const [malVerAcik, setMalVerAcik] = useState(false)
  const [tahsilatAcik, setTahsilatAcik] = useState(false)
  const [parcaListesi, setParcaListesi] = useState([])
  const [malForm, setMalForm] = useState({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0, tarih: new Date().toISOString().slice(0,10), aciklama: '' })
  const [tahsilatForm, setTahsilatForm] = useState({ tutar: '', odeme_turu: 'nakit', tarih: new Date().toISOString().slice(0,10), aciklama: '' })
  const [duzenlenenId, setDuzenlenenId] = useState(null)

  const [silmeOnayId, setSilmeOnayId] = useState(null)
  const [bayiSilmeOnayId, setBayiSilmeOnayId] = useState(null)

  useEffect(() => { fetchBayiler(); fetchParcaListesi() }, [])

  const fetchParcaListesi = async () => {
    const { data } = await supabase.from('parcalar').select('*').eq('aktif', true).order('isim')
    setParcaListesi(data || [])
  }

  const fetchBayiler = async () => {
    setLoading(true)
    const { data: bayilerData } = await supabase.from('bayiler').select('*').order('dukkan_adi')
    const { data: hareketData } = await supabase.from('bayi_hareketleri').select('bayi_id, tip, tutar')

    const bakiyeMap = {}
    let toplamTahsilatToplami = 0
    ;(hareketData || []).forEach(h => {
      if (!bakiyeMap[h.bayi_id]) bakiyeMap[h.bayi_id] = 0
      bakiyeMap[h.bayi_id] += h.tip === 'mal' ? parseFloat(h.tutar || 0) : -parseFloat(h.tutar || 0)
      if (h.tip === 'tahsilat') toplamTahsilatToplami += parseFloat(h.tutar || 0)
    })

    const zenginlestirilmis = (bayilerData || []).map(b => ({ ...b, bakiye: bakiyeMap[b.id] || 0 }))
    zenginlestirilmis.sort((a, b) => b.bakiye - a.bakiye)
    setBayiler(zenginlestirilmis)
    setToplamTahsilat(toplamTahsilatToplami)
    setLoading(false)
  }

  const fetchHareketler = async (bayiId) => {
    const { data } = await supabase.from('bayi_hareketleri').select('*').eq('bayi_id', bayiId).order('tarih', { ascending: false }).order('created_at', { ascending: false })
    const liste = data || []
    setHareketler(liste)
    // Kalan Bakiye'yi taze veriden anında hesaplayıp seçili bayiye yansıt —
    // fetchBayiler() bitene kadar beklemeye gerek kalmaz, ekran hemen doğru gösterir.
    const yeniBakiye = liste.reduce((s, h) => s + (h.tip === 'mal' ? parseFloat(h.tutar || 0) : -parseFloat(h.tutar || 0)), 0)
    setSeciliBayi(prev => prev ? { ...prev, bakiye: yeniBakiye } : prev)
  }

  const bayiSec = async (b) => {
    setSeciliBayi(b)
    setHareketler([]) // eski bayinin hareketleri bir an bile görünmesin, taze veri gelene kadar boş kalsın
    setHareketTipFiltre('hepsi')
    setHareketBaslangic('')
    setHareketBitis('')
    await fetchHareketler(b.id)
  }

  const [bayiHata, setBayiHata] = useState('')

  const bayiKaydet = async () => {
    if (!yeniBayi.dukkan_adi.trim()) return
    setKaydediliyor(true)
    setBayiHata('')
    const { error } = await supabase.from('bayiler').insert({
      dukkan_adi: yeniBayi.dukkan_adi.trim().toUpperCase(),
      yetkili_kisi: yeniBayi.yetkili_kisi.trim() || null,
      telefon: yeniBayi.telefon.replace(/\D/g, '') || null,
      adres: yeniBayi.adres.trim() || null,
      notlar: yeniBayi.notlar.trim() || null,
    })
    if (error) {
      setBayiHata(error.message)
    } else {
      setYeniBayi({ dukkan_adi: '', yetkili_kisi: '', telefon: '', adres: '', notlar: '' })
      setYeniBayiAcik(false)
      fetchBayiler()
    }
    setKaydediliyor(false)
  }

  const bayiSil = async (id) => {
    if (bayiSilmeOnayId !== id) { setBayiSilmeOnayId(id); return }
    setBayiSilmeOnayId(null)
    await supabase.from('bayiler').delete().eq('id', id)
    if (seciliBayi?.id === id) setSeciliBayi(null)
    fetchBayiler()
  }

  const malVerKaydet = async () => {
    if (!malForm.parca_isim.trim() || !seciliBayi) return
    setKaydediliyor(true)
    let kaydedilecekIsim = malForm.parca_isim.trim().toUpperCase()
    if (!malForm.parca_id) {
      // Elle yazılmış, tanımlı listeden seçilmemiş — İş Emirleri'ndeki gibi
      // mevcutta yoksa otomatik Tanımlamalar'a ekle, varsa mevcudu kullan.
      const { parca_id, isim } = await parcaTaniminiGaranileGetir(malForm.parca_isim, malForm.birim_fiyat, parcaListesi)
      kaydedilecekIsim = isim
      if (parca_id) setParcaListesi(prev => [...prev, { id: parca_id, isim, birim_fiyat: malForm.birim_fiyat }])
    }
    const tutar = parseFloat(malForm.miktar || 0) * parseFloat(malForm.birim_fiyat || 0)
    const kayit = {
      bayi_id: seciliBayi.id,
      tip: 'mal',
      parca_isim: kaydedilecekIsim,
      miktar: parseFloat(malForm.miktar || 0),
      birim_fiyat: parseFloat(malForm.birim_fiyat || 0),
      tutar,
      tarih: malForm.tarih,
      aciklama: malForm.aciklama.trim() || null,
    }
    if (duzenlenenId) {
      await supabase.from('bayi_hareketleri').update(kayit).eq('id', duzenlenenId)
    } else {
      await supabase.from('bayi_hareketleri').insert({ ...kayit, created_by: profile?.id || null })
    }
    setMalForm({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0, tarih: new Date().toISOString().slice(0,10), aciklama: '' })
    setMalVerAcik(false)
    setDuzenlenenId(null)
    setKaydediliyor(false)
    await fetchHareketler(seciliBayi.id)
    fetchBayiler()
  }

  const tahsilatKaydet = async () => {
    if (!tahsilatForm.tutar || parseFloat(tahsilatForm.tutar) <= 0 || !seciliBayi) return
    setKaydediliyor(true)
    const kayit = {
      bayi_id: seciliBayi.id,
      tip: 'tahsilat',
      tutar: parseFloat(tahsilatForm.tutar),
      odeme_turu: tahsilatForm.odeme_turu,
      tarih: tahsilatForm.tarih,
      aciklama: tahsilatForm.aciklama.trim() || null,
    }
    if (duzenlenenId) {
      await supabase.from('bayi_hareketleri').update(kayit).eq('id', duzenlenenId)
    } else {
      await supabase.from('bayi_hareketleri').insert({ ...kayit, created_by: profile?.id || null })
    }
    setTahsilatForm({ tutar: '', odeme_turu: 'nakit', tarih: new Date().toISOString().slice(0,10), aciklama: '' })
    setTahsilatAcik(false)
    setDuzenlenenId(null)
    setKaydediliyor(false)
    await fetchHareketler(seciliBayi.id)
    fetchBayiler()
  }

  const hareketDuzenle = (h) => {
    setDuzenlenenId(h.id)
    if (h.tip === 'mal') {
      setMalForm({
        parca_id: '', // tanımlı listeden geldiyse tekrar eşleştirmeye çalışmıyoruz, kullanıcı isterse yeniden seçebilir
        parca_isim: h.parca_isim || '',
        miktar: h.miktar || 1,
        birim_fiyat: h.birim_fiyat || 0,
        tarih: h.tarih,
        aciklama: h.aciklama || '',
      })
      setMalVerAcik(true)
    } else {
      setTahsilatForm({
        tutar: h.tutar || '',
        odeme_turu: h.odeme_turu || 'nakit',
        tarih: h.tarih,
        aciklama: h.aciklama || '',
      })
      setTahsilatAcik(true)
    }
  }

  const bayiCiktiAl = () => {
    const liste = hareketlerFiltrelenmis
    const toplamMal = liste.filter(h => h.tip === 'mal').reduce((s, h) => s + parseFloat(h.tutar || 0), 0)
    const toplamTahsilatDonem = liste.filter(h => h.tip === 'tahsilat').reduce((s, h) => s + parseFloat(h.tutar || 0), 0)

    const satirlarHTML = liste.length > 0
      ? [...liste].reverse().map(h => `
          <tr>
            <td>${tarihFormat(h.tarih)}</td>
            <td>${h.tip === 'mal' ? `${h.parca_isim || ''} ${h.miktar ? `x${h.miktar}` : ''}` : `Tahsilat${h.odeme_turu ? ` (${h.odeme_turu})` : ''}`}</td>
            <td>${h.aciklama || ''}</td>
            <td style="text-align:right;color:${h.tip === 'mal' ? '#c0392b' : '#1e8449'}">${h.tip === 'mal' ? '+' : '−'}&#x20BA;${parseFloat(h.tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:#999;padding:16px">Kayıt yok</td></tr>`

    const filtreNotu = (hareketBaslangic || hareketBitis || hareketTipFiltre !== 'hepsi')
      ? `<div style="font-size:10.5px;color:#888;margin-top:2px">Filtre: ${hareketTipFiltre === 'hepsi' ? 'Tümü' : hareketTipFiltre === 'mal' ? 'Mal Verildi' : 'Tahsilat'}${hareketBaslangic ? ` · ${tarihFormat(hareketBaslangic)}'den` : ''}${hareketBitis ? ` · ${tarihFormat(hareketBitis)}'e kadar` : ''}</div>`
      : ''

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Cari Hesap Ekstresi — ${seciliBayi.dukkan_adi}</title><style>
*{box-sizing:border-box;margin:0;padding:0} @page{size:A4;margin:14mm;} @media print{body{margin:0}}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;padding:24px 28px;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2.5px solid #1a1a1a}
.header h1{font-size:18px;letter-spacing:.05em}
.header .sub{font-size:11px;color:#888;margin-top:2px}
.bayi-box{background:#f7f7f7;border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin-bottom:18px}
.bayi-box b{font-size:14px}
.bayi-box .detay{font-size:11px;color:#555;margin-top:3px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#f2f2f2;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#666;padding:7px 8px;border-bottom:1px solid #ddd}
td{padding:7px 8px;border-bottom:1px solid #eee;font-size:11.5px}
.ozet{display:flex;justify-content:flex-end;gap:24px;margin-top:8px}
.ozet div{text-align:right}
.ozet .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em}
.ozet .val{font-size:15px;font-weight:700}
.bakiye-box{margin-top:14px;padding:14px;background:#fdecea;border:1.5px solid #e5484d;border-radius:8px;text-align:right}
.bakiye-box .lbl{font-size:11px;color:#c0392b;text-transform:uppercase;letter-spacing:.05em}
.bakiye-box .val{font-size:22px;font-weight:800;color:#c0392b}
.footer{margin-top:24px;font-size:10px;color:#999;text-align:center}
</style></head><body>
  <div class="header">
    <div><h1>MOTORCUM</h1><div class="sub">Cari Hesap Ekstresi</div></div>
    <div style="text-align:right;font-size:11px;color:#888">Yazdırma Tarihi<br><b style="color:#1a1a1a">${new Date().toLocaleDateString('tr-TR')}</b></div>
  </div>
  <div class="bayi-box">
    <b>${seciliBayi.dukkan_adi}</b>
    <div class="detay">
      ${seciliBayi.yetkili_kisi ? `Yetkili: ${seciliBayi.yetkili_kisi}<br>` : ''}
      ${seciliBayi.telefon ? `Tel: ${formatTelefon(seciliBayi.telefon)}<br>` : ''}
      ${seciliBayi.adres ? `Adres: ${seciliBayi.adres}` : ''}
    </div>
    ${filtreNotu}
  </div>
  <table>
    <thead><tr><th style="width:14%">Tarih</th><th style="width:30%">İşlem</th><th style="width:32%">Açıklama</th><th style="width:24%;text-align:right">Tutar</th></tr></thead>
    <tbody>${satirlarHTML}</tbody>
  </table>
  <div class="ozet">
    <div><div class="lbl">Mal Verilen</div><div class="val" style="color:#c0392b">&#x20BA;${toplamMal.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div></div>
    <div><div class="lbl">Tahsilat</div><div class="val" style="color:#1e8449">&#x20BA;${toplamTahsilatDonem.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div></div>
  </div>
  <div class="bakiye-box">
    <div class="lbl">Güncel Kalan Bakiye</div>
    <div class="val">&#x20BA;${Math.abs(seciliBayi.bakiye).toLocaleString('tr-TR',{minimumFractionDigits:2})} ${seciliBayi.bakiye > 0 ? '(borçlu)' : seciliBayi.bakiye < 0 ? '(fazla ödemiş)' : ''}</div>
  </div>
  <div class="footer">MOTORCUM &middot; ${new Date().toLocaleString('tr-TR')}</div>
</body></html>`

    // Gizli bir iframe üzerinden yazdırma — hiç yeni pencere/sekme açmadığı için
    // popup engelleyiciye asla takılmaz.
    const eskiIframe = document.getElementById('bayi-cikti-iframe')
    if (eskiIframe) eskiIframe.remove()

    const iframe = document.createElement('iframe')
    iframe.id = 'bayi-cikti-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    iframe.srcdoc = html
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      }, 100)
    }
  }

  const hareketSil = async (id) => {
    if (silmeOnayId !== id) { setSilmeOnayId(id); return }
    setSilmeOnayId(null)
    await supabase.from('bayi_hareketleri').delete().eq('id', id)
    await fetchHareketler(seciliBayi.id)
    fetchBayiler()
  }

  const filtrelenmisBayiler = bayiler.filter(b =>
    b.dukkan_adi.toLowerCase().includes(arama.toLowerCase()) ||
    (b.yetkili_kisi || '').toLowerCase().includes(arama.toLowerCase())
  )

  const toplamAlacak = bayiler.reduce((s, b) => s + Math.max(b.bakiye, 0), 0)

  const raporGetir = async () => {
    setRaporYukleniyor(true)
    let sorgu = supabase.from('bayi_hareketleri').select('bayi_id, tip, tutar, tarih, bayiler(dukkan_adi)')
    if (raporBaslangic) sorgu = sorgu.gte('tarih', raporBaslangic)
    if (raporBitis) sorgu = sorgu.lte('tarih', raporBitis)
    if (raporBayiFiltre) sorgu = sorgu.eq('bayi_id', raporBayiFiltre)
    const { data } = await sorgu

    const grupMap = {}
    ;(data || []).forEach(h => {
      const isim = h.bayiler?.dukkan_adi || 'Bilinmeyen'
      if (!grupMap[isim]) grupMap[isim] = { isim, mal: 0, tahsilat: 0, hareketSayisi: 0 }
      if (h.tip === 'mal') grupMap[isim].mal += parseFloat(h.tutar || 0)
      else grupMap[isim].tahsilat += parseFloat(h.tutar || 0)
      grupMap[isim].hareketSayisi += 1
    })
    const liste = Object.values(grupMap).map(g => ({ ...g, net: g.mal - g.tahsilat }))
    liste.sort((a, b) => b.net - a.net)
    setRaporVerisi(liste)
    setRaporYukleniyor(false)
  }

  const raporVerisiFiltrelenmis = raporVerisi.filter(r => {
    if (raporDurumFiltre === 'borclu') return r.net > 0
    if (raporDurumFiltre === 'fazla_odemis') return r.net < 0
    return true
  })

  const hareketlerFiltrelenmis = hareketler.filter(h => {
    if (hareketTipFiltre !== 'hepsi' && h.tip !== hareketTipFiltre) return false
    if (hareketBaslangic && h.tarih < hareketBaslangic) return false
    if (hareketBitis && h.tarih > hareketBitis) return false
    return true
  })

  // ─── DETAY GÖRÜNÜMÜ ───
  if (seciliBayi) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSeciliBayi(null)} style={{ marginBottom: 14 }}>← Bayi Listesine Dön</button>

        <div className="table-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🏪 {seciliBayi.dukkan_adi}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {seciliBayi.yetkili_kisi && <span>👤 {seciliBayi.yetkili_kisi}</span>}
                {seciliBayi.telefon && <span>📞 {formatTelefon(seciliBayi.telefon)}</span>}
                {seciliBayi.adres && <span>📍 {seciliBayi.adres}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Kalan Bakiye</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: seciliBayi.bakiye > 0 ? '#e5484d' : seciliBayi.bakiye < 0 ? '#22c55e' : 'var(--text-muted)' }}>
                {paraFormat(Math.abs(seciliBayi.bakiye))}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {seciliBayi.bakiye > 0 ? 'sana borçlu' : seciliBayi.bakiye < 0 ? 'fazla ödemiş' : 'hesap kapalı'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '0 18px 16px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setDuzenlenenId(null); setMalForm({ parca_id: '', parca_isim: '', miktar: 1, birim_fiyat: 0, tarih: new Date().toISOString().slice(0,10), aciklama: '' }); setMalVerAcik(true) }}>📦 Mal Ver</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setDuzenlenenId(null); setTahsilatForm({ tutar: '', odeme_turu: 'nakit', tarih: new Date().toISOString().slice(0,10), aciklama: '' }); setTahsilatAcik(true) }}>💵 Tahsilat Ekle</button>
            <button className="btn btn-secondary btn-sm" onClick={bayiCiktiAl}>🖨️ Çıktı Al</button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header"><span className="table-title">📋 Hareket Geçmişi ({hareketlerFiltrelenmis.length}) <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>— düzenlemek için satıra tıkla</span></span></div>
          <div style={{ display: 'flex', gap: 8, padding: '12px 18px 0', flexWrap: 'wrap', alignItems: 'center' }}>
            {[{id:'hepsi',label:'Tümü'},{id:'mal',label:'📦 Mal Verildi'},{id:'tahsilat',label:'💵 Tahsilat'}].map(f => (
              <button key={f.id} onClick={() => setHareketTipFiltre(f.id)} style={{
                fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
                border: `1px solid ${hareketTipFiltre===f.id ? '#e5484d' : 'var(--border)'}`,
                background: hareketTipFiltre===f.id ? 'rgba(229,72,77,.1)' : 'var(--bg-elevated)',
                color: hareketTipFiltre===f.id ? '#e5484d' : 'var(--text-secondary)', cursor: 'pointer',
              }}>{f.label}</button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px 4px 12px' }}>
              <span style={{ fontSize: 12 }}>📅</span>
              <input type="date" value={hareketBaslangic} onChange={e => setHareketBaslangic(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', padding: '4px 0', width: 118 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
              <input type="date" value={hareketBitis} onChange={e => setHareketBitis(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', padding: '4px 0', width: 118 }} />
            </div>
            {(hareketBaslangic || hareketBitis || hareketTipFiltre !== 'hepsi') && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setHareketTipFiltre('hepsi'); setHareketBaslangic(''); setHareketBitis('') }}>✕ Temizle</button>
            )}
          </div>
          <div style={{ padding: '8px 0' }}>
            {hareketlerFiltrelenmis.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{hareketler.length === 0 ? 'Henüz hareket yok.' : 'Bu filtreye uyan hareket yok.'}</div>
            ) : hareketlerFiltrelenmis.map(h => (
              <div key={h.id} onClick={() => hareketDuzenle(h)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    background: h.tip === 'mal' ? 'rgba(229,72,77,.12)' : 'rgba(34,197,94,.12)',
                  }}>
                    {h.tip === 'mal' ? '📦' : '💵'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.tip === 'mal' ? `${h.parca_isim} — ${h.miktar} adet` : `Tahsilat${h.odeme_turu ? ` (${h.odeme_turu})` : ''}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {tarihFormat(h.tarih)}{h.aciklama ? ` · ${h.aciklama}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: h.tip === 'mal' ? '#e5484d' : '#22c55e', whiteSpace: 'nowrap' }}>
                    {h.tip === 'mal' ? '+' : '−'}{paraFormat(h.tutar)}
                  </span>
                  {silmeOnayId === h.id ? (
                    <span style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger btn-sm" onClick={() => hareketSil(h.id)}>Sil?</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSilmeOnayId(null)}>✕</button>
                    </span>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); hareketSil(h.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MAL VER MODAL */}
        {malVerAcik && (
          <div className="modal-overlay">
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{duzenlenenId ? '✏️ Mal Verişi Düzenle' : '📦 Mal Ver'} — {seciliBayi.dukkan_adi}</span>
                <button className="modal-close" onClick={() => { setMalVerAcik(false); setDuzenlenenId(null) }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="field">
                  <label>Parça Adı * (yazın veya tanımlı listeden seçin)</label>
                  <ParcaAramaSelect
                    parcaListesi={parcaListesi}
                    value={malForm.parca_id}
                    inputValue={malForm.parca_isim}
                    onChange={(id, isim, birimFiyat) => setMalForm(f => ({ ...f, parca_id: id, parca_isim: isim, birim_fiyat: birimFiyat }))}
                    onManual={(v) => setMalForm(f => ({ ...f, parca_isim: v, parca_id: '' }))}
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Miktar</label>
                    <input type="number" min="0" step="1" value={malForm.miktar} onFocus={e => e.target.select()} onChange={e => setMalForm(f => ({ ...f, miktar: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Birim Fiyat</label>
                    <input type="number" min="0" step="0.01" value={malForm.birim_fiyat} onFocus={e => e.target.select()} onChange={e => setMalForm(f => ({ ...f, birim_fiyat: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label>Tarih</label>
                  <TarihGirisi value={malForm.tarih} onChange={v => setMalForm(f => ({ ...f, tarih: v }))} />
                </div>
                <div className="field">
                  <label>Açıklama (opsiyonel)</label>
                  <input value={malForm.aciklama} onChange={e => setMalForm(f => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. irsaliye no" />
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Toplam</span>
                  <b style={{ color: '#e5484d' }}>{paraFormat(parseFloat(malForm.miktar||0) * parseFloat(malForm.birim_fiyat||0))}</b>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setMalVerAcik(false); setDuzenlenenId(null) }}>İptal</button>
                <button className="btn btn-primary" onClick={malVerKaydet} disabled={kaydediliyor || !malForm.parca_isim.trim()}>{kaydediliyor ? 'Kaydediliyor...' : (duzenlenenId ? 'Güncelle' : 'Kaydet')}</button>
              </div>
            </div>
          </div>
        )}

        {/* TAHSİLAT MODAL */}
        {tahsilatAcik && (
          <div className="modal-overlay">
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{duzenlenenId ? '✏️ Tahsilatı Düzenle' : '💵 Tahsilat Ekle'} — {seciliBayi.dukkan_adi}</span>
                <button className="modal-close" onClick={() => { setTahsilatAcik(false); setDuzenlenenId(null) }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="field">
                  <label>Tutar *</label>
                  <input type="number" min="0" step="0.01" value={tahsilatForm.tutar} onFocus={e => e.target.select()} onChange={e => setTahsilatForm(f => ({ ...f, tutar: e.target.value }))} placeholder="0" />
                </div>
                <div className="field">
                  <label>Ödeme Türü</label>
                  <CustomSelect
                    value={tahsilatForm.odeme_turu}
                    onChange={v => setTahsilatForm(f => ({ ...f, odeme_turu: v }))}
                    options={[{ value: 'nakit', label: 'Nakit' }, { value: 'havale', label: 'Havale/EFT' }, { value: 'kart', label: 'Kredi Kartı' }]}
                  />
                </div>
                <div className="field">
                  <label>Tarih</label>
                  <TarihGirisi value={tahsilatForm.tarih} onChange={v => setTahsilatForm(f => ({ ...f, tarih: v }))} />
                </div>
                <div className="field">
                  <label>Açıklama (opsiyonel)</label>
                  <input value={tahsilatForm.aciklama} onChange={e => setTahsilatForm(f => ({ ...f, aciklama: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setTahsilatAcik(false); setDuzenlenenId(null) }}>İptal</button>
                <button className="btn btn-primary" onClick={tahsilatKaydet} disabled={kaydediliyor || !tahsilatForm.tutar}>{kaydediliyor ? 'Kaydediliyor...' : (duzenlenenId ? 'Güncelle' : 'Kaydet')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── LİSTE GÖRÜNÜMÜ ───
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Toplam Bayi</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{bayiler.length}</div>
        </div>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Toplam Alacak</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e5484d' }}>{paraFormat(toplamAlacak)}</div>
        </div>
        <div className="table-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Toplam Tahsilat</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{paraFormat(toplamTahsilat)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="search-input" style={{ flex: 1, minWidth: 200 }} placeholder="Dükkan adı veya yetkili ara..." value={arama} onChange={e => setArama(e.target.value)} />
        <button className="btn btn-secondary" onClick={() => { const acilis = !raporAcik; setRaporAcik(acilis); if (acilis && raporVerisi.length === 0) raporGetir() }}>📊 Bayi Raporu</button>
        <button className="btn btn-primary" onClick={() => setYeniBayiAcik(true)}>+ Yeni Bayi</button>
      </div>

      {raporAcik && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-header"><span className="table-title">📊 Bayi Bazında Rapor</span></div>
          <div style={{ padding: '12px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px 4px 12px' }}>
              <span style={{ fontSize: 12 }}>📅</span>
              <input type="date" value={raporBaslangic} onChange={e => setRaporBaslangic(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', padding: '4px 0', width: 118 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
              <input type="date" value={raporBitis} onChange={e => setRaporBitis(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', padding: '4px 0', width: 118 }} />
            </div>
            <div style={{ minWidth: 180 }}>
              <CustomSelect
                value={raporBayiFiltre}
                onChange={setRaporBayiFiltre}
                placeholder="Tüm Bayiler"
                options={[{ value: '', label: 'Tüm Bayiler' }, ...bayiler.map(b => ({ value: b.id, label: b.dukkan_adi }))]}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={raporGetir} disabled={raporYukleniyor}>{raporYukleniyor ? 'Yükleniyor...' : 'Filtrele'}</button>
            {[{id:'hepsi',label:'Tümü'},{id:'borclu',label:'🔴 Borçlu'},{id:'fazla_odemis',label:'🟢 Fazla Ödemiş'}].map(f => (
              <button key={f.id} onClick={() => setRaporDurumFiltre(f.id)} style={{
                fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
                border: `1px solid ${raporDurumFiltre===f.id ? '#e5484d' : 'var(--border)'}`,
                background: raporDurumFiltre===f.id ? 'rgba(229,72,77,.1)' : 'var(--bg-elevated)',
                color: raporDurumFiltre===f.id ? '#e5484d' : 'var(--text-secondary)', cursor: 'pointer',
              }}>{f.label}</button>
            ))}
            {(raporBaslangic || raporBitis || raporBayiFiltre || raporDurumFiltre !== 'hepsi') && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setRaporBaslangic(''); setRaporBitis(''); setRaporBayiFiltre(''); setRaporDurumFiltre('hepsi') }}>✕ Temizle</button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--table-head-bg)' }}>
                  <th style={{ padding: '9px 18px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Bayi</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Mal Verilen</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Tahsilat</th>
                  <th style={{ padding: '9px 18px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Net (Kalan)</th>
                </tr>
              </thead>
              <tbody>
                {raporVerisiFiltrelenmis.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Seçili aralıkta/filtrede veri bulunamadı.</td></tr>
                ) : raporVerisiFiltrelenmis.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 18px', color: 'var(--text-primary)', fontWeight: 600 }}>{r.isim}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e5484d' }}>{paraFormat(r.mal)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e' }}>{paraFormat(r.tahsilat)}</td>
                    <td style={{ padding: '8px 18px', textAlign: 'right', fontWeight: 700, color: r.net > 0 ? '#e5484d' : r.net < 0 ? '#22c55e' : 'var(--text-muted)' }}>{paraFormat(Math.abs(r.net))}</td>
                  </tr>
                ))}
              </tbody>
              {raporVerisiFiltrelenmis.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '9px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>TOPLAM</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#e5484d' }}>{paraFormat(raporVerisiFiltrelenmis.reduce((s,r) => s+r.mal, 0))}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{paraFormat(raporVerisiFiltrelenmis.reduce((s,r) => s+r.tahsilat, 0))}</td>
                    <td style={{ padding: '9px 18px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{paraFormat(Math.abs(raporVerisiFiltrelenmis.reduce((s,r) => s+r.net, 0)))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
        ) : filtrelenmisBayiler.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Henüz bayi eklenmemiş.</div>
        ) : filtrelenmisBayiler.map(b => (
          <div key={b.id} onClick={() => bayiSec(b)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏪 {b.dukkan_adi}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                {b.yetkili_kisi && <span>{b.yetkili_kisi}</span>}
                {b.telefon && <span>{formatTelefon(b.telefon)}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: b.bakiye > 0 ? '#e5484d' : b.bakiye < 0 ? '#22c55e' : 'var(--text-muted)' }}>
                  {paraFormat(Math.abs(b.bakiye))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.bakiye > 0 ? 'borçlu' : b.bakiye < 0 ? 'fazla ödemiş' : 'kapalı'}</div>
              </div>
              {bayiSilmeOnayId === b.id ? (
                <span style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-danger btn-sm" onClick={() => bayiSil(b.id)}>Sil?</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setBayiSilmeOnayId(null)}>✕</button>
                </span>
              ) : (
                <button onClick={e => { e.stopPropagation(); bayiSil(b.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>🗑️</button>
              )}
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </div>
          </div>
        ))}
      </div>

      {/* YENİ BAYİ MODAL */}
      {yeniBayiAcik && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">+ Yeni Bayi</span>
              <button className="modal-close" onClick={() => setYeniBayiAcik(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field"><label>Dükkan Adı *</label><input value={yeniBayi.dukkan_adi} onChange={e => setYeniBayi(f => ({ ...f, dukkan_adi: e.target.value }))} placeholder="Örn. Aktaş Motosiklet" /></div>
              <div className="field"><label>Yetkili Kişi</label><input value={yeniBayi.yetkili_kisi} onChange={e => setYeniBayi(f => ({ ...f, yetkili_kisi: e.target.value }))} /></div>
              <div className="field"><label>Telefon</label><TelefonGirisi value={yeniBayi.telefon} onChange={v => setYeniBayi(f => ({ ...f, telefon: v }))} /></div>
              <div className="field"><label>Adres</label><input value={yeniBayi.adres} onChange={e => setYeniBayi(f => ({ ...f, adres: e.target.value }))} /></div>
              <div className="field"><label>Notlar</label><textarea value={yeniBayi.notlar} onChange={e => setYeniBayi(f => ({ ...f, notlar: e.target.value }))} /></div>
              {bayiHata && <div className="alert alert-error" style={{ marginTop: 10 }}>{bayiHata}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setYeniBayiAcik(false)}>İptal</button>
              <button className="btn btn-primary" onClick={bayiKaydet} disabled={kaydediliyor || !yeniBayi.dukkan_adi.trim()}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BayiHesaplari
