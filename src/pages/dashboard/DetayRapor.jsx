import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Türkiye plaka standart formatı
const formatPlaka = (plaka) => {
  if (!plaka) return ''
  const temiz = plaka.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const eslesme = temiz.match(/^(\d{2})([A-Z]{1,3})(\d{2,4})$/)
  if (!eslesme) return plaka
  return `${eslesme[1]} ${eslesme[2]} ${eslesme[3]}`
}

// Türkiye telefon formatı
const formatTelefon = (tel) => {
  if (!tel) return ''
  const rakamlar = tel.toString().replace(/\D/g, '')
  if (rakamlar.length !== 11) return tel
  return `${rakamlar.slice(0,4)} ${rakamlar.slice(4,7)} ${rakamlar.slice(7,9)} ${rakamlar.slice(9,11)}`
}

const DURUM_LABEL = { bekliyor: 'Bekliyor', devam_ediyor: 'Devam Ediyor', tamamlandi: 'Tamamlandı', teslim_edildi: 'Teslim Edildi', iptal: 'İptal' }
const ODEME_LABEL = { odendi: 'Ödendi', kismi: 'Kısmi', odenmedi: 'Ödenmedi' }

// ─── Alan kataloğu — "İş Emri Bazlı" modda kullanılır ───
// tablo: 'is_emirleri' | 'musteriler' | 'araclar' | 'personel' | 'ozet'
// 'ozet' tipi is_emri_parcalari'ndan satır çoğaltmadan hesaplanan özet alanlardır (parça sayısı, toplam parça tutarı vb.)
const ALAN_KATALOGU_ISEMRI = [
  { key: 'is_emri_no',    label: 'İş Emri No',        tablo: 'is_emirleri', kolon: 'is_emri_no',   kategori: 'İş Emri', tip: 'sayi' },
  { key: 'durum',         label: 'Durum',              tablo: 'is_emirleri', kolon: 'durum',        kategori: 'İş Emri', tip: 'durum' },
  { key: 'oncelik',       label: 'Öncelik',            tablo: 'is_emirleri', kolon: 'oncelik',      kategori: 'İş Emri', tip: 'metin' },
  { key: 'sikayet',       label: 'Müşteri Şikayeti',   tablo: 'is_emirleri', kolon: 'sikayet',      kategori: 'İş Emri', tip: 'metin' },
  { key: 'yapilan_isler', label: 'Yapılan İşler',      tablo: 'is_emirleri', kolon: 'yapilan_isler',kategori: 'İş Emri', tip: 'metin' },
  { key: 'ie_notlar',     label: 'İş Emri Notu',       tablo: 'is_emirleri', kolon: 'notlar',       kategori: 'İş Emri', tip: 'metin' },
  { key: 'toplam_tutar',  label: 'Toplam Tutar',       tablo: 'is_emirleri', kolon: 'toplam_tutar', kategori: 'İş Emri', tip: 'tutar' },
  { key: 'odenen_tutar',  label: 'Ödenen Tutar',       tablo: 'is_emirleri', kolon: 'odenen_tutar', kategori: 'İş Emri', tip: 'tutar' },
  { key: 'odeme_durumu',  label: 'Ödeme Durumu',       tablo: 'is_emirleri', kolon: 'odeme_durumu', kategori: 'İş Emri', tip: 'odeme' },
  { key: 'odeme_turu',    label: 'Ödeme Türü',         tablo: 'is_emirleri', kolon: 'odeme_turu',   kategori: 'İş Emri', tip: 'metin' },
  { key: 'ie_arac_km',    label: 'İş Emrindeki KM',    tablo: 'is_emirleri', kolon: 'arac_km',      kategori: 'İş Emri', tip: 'sayi' },
  { key: 'tahmini_cikis', label: 'Tahmini Çıkış',      tablo: 'is_emirleri', kolon: 'tahmini_cikis',kategori: 'İş Emri', tip: 'tarihsaat' },
  { key: 'created_at',    label: 'Oluşturulma Tarihi', tablo: 'is_emirleri', kolon: 'created_at',   kategori: 'İş Emri', tip: 'tarihsaat' },

  { key: 'parca_sayisi',    label: 'Parça Sayısı (özet)',       tablo: 'ozet', kolon: 'parca_sayisi',    kategori: 'İş Emri', tip: 'sayi' },
  { key: 'parca_listesi',   label: 'Parça Listesi (özet)',      tablo: 'ozet', kolon: 'parca_listesi',   kategori: 'İş Emri', tip: 'metin' },
  { key: 'parca_toplam',    label: 'Toplam Parça Tutarı (özet)',tablo: 'ozet', kolon: 'parca_toplam',    kategori: 'İş Emri', tip: 'tutar' },
  { key: 'ozf_parca_icerir',label: 'Parça İçeriyor (sadece koşul)', tablo: 'ozel_filtre', kolon: 'parca_isim', kategori: 'İş Emri', tip: 'metin', sadeceKosul: true },

  { key: 'musteri_ad',      label: 'Müşteri Adı',      tablo: 'musteriler', kolon: 'ad',         kategori: 'Müşteri', tip: 'metin' },
  { key: 'musteri_soyad',   label: 'Müşteri Soyadı',   tablo: 'musteriler', kolon: 'soyad',      kategori: 'Müşteri', tip: 'metin' },
  { key: 'musteri_telefon', label: 'Müşteri Telefon',  tablo: 'musteriler', kolon: 'telefon',    kategori: 'Müşteri', tip: 'telefon' },
  { key: 'musteri_email',   label: 'Müşteri E-posta',  tablo: 'musteriler', kolon: 'email',      kategori: 'Müşteri', tip: 'metin' },
  { key: 'musteri_tc',      label: 'Müşteri TC',       tablo: 'musteriler', kolon: 'tc',         kategori: 'Müşteri', tip: 'metin' },
  { key: 'musteri_kan',     label: 'Müşteri Kan Grubu',tablo: 'musteriler', kolon: 'kan_grubu',  kategori: 'Müşteri', tip: 'metin' },

  { key: 'arac_plaka',  label: 'Plaka',       tablo: 'araclar', kolon: 'plaka',      kategori: 'Araç', tip: 'plaka' },
  { key: 'arac_marka',  label: 'Marka',       tablo: 'araclar', kolon: 'marka',      kategori: 'Araç', tip: 'metin' },
  { key: 'arac_model',  label: 'Model',       tablo: 'araclar', kolon: 'model',      kategori: 'Araç', tip: 'metin' },
  { key: 'arac_yil',    label: 'Yıl',         tablo: 'araclar', kolon: 'yil',        kategori: 'Araç', tip: 'metin' },
  { key: 'arac_renk',   label: 'Renk',        tablo: 'araclar', kolon: 'renk',       kategori: 'Araç', tip: 'metin' },
  { key: 'arac_km',     label: 'Araç KM',     tablo: 'araclar', kolon: 'km',         kategori: 'Araç', tip: 'sayi' },
  { key: 'arac_yakit',  label: 'Yakıt Tipi',  tablo: 'araclar', kolon: 'yakit_tipi', kategori: 'Araç', tip: 'metin' },

  { key: 'personel_ad',    label: 'Teknisyen Adı',    tablo: 'personel', kolon: 'ad',    kategori: 'Personel', tip: 'metin' },
  { key: 'personel_soyad', label: 'Teknisyen Soyadı', tablo: 'personel', kolon: 'soyad', kategori: 'Personel', tip: 'metin' },
  { key: 'personel_rol',   label: 'Teknisyen Rolü',   tablo: 'personel', kolon: 'rol',   kategori: 'Personel', tip: 'metin' },
]

// ─── "Parça Bazlı" modda kullanılan katalog — temel satır artık bir parça kalemi ───
const ALAN_KATALOGU_PARCA = [
  { key: 'p_parca_isim',   label: 'Parça Adı',    tablo: 'is_emri_parcalari', kolon: 'parca_isim',  kategori: 'Parça', tip: 'metin' },
  { key: 'p_miktar',       label: 'Miktar',        tablo: 'is_emri_parcalari', kolon: 'miktar',      kategori: 'Parça', tip: 'sayi', toplanabilir: true },
  { key: 'p_birim_fiyat',  label: 'Birim Fiyat',   tablo: 'is_emri_parcalari', kolon: 'birim_fiyat', kategori: 'Parça', tip: 'tutar' },
  { key: 'p_toplam',       label: 'Satır Tutarı',  tablo: 'is_emri_parcalari', kolon: 'toplam',      kategori: 'Parça', tip: 'tutar', toplanabilir: true },

  { key: 'p_is_emri_no',   label: 'İş Emri No',    tablo: 'is_emirleri', kolon: 'is_emri_no', kategori: 'İş Emri', tip: 'sayi' },
  { key: 'p_durum',        label: 'Durum',         tablo: 'is_emirleri', kolon: 'durum',       kategori: 'İş Emri', tip: 'durum' },
  { key: 'p_created_at',   label: 'İş Emri Tarihi',tablo: 'is_emirleri', kolon: 'created_at',  kategori: 'İş Emri', tip: 'tarihsaat' },

  { key: 'p_musteri_ad',    label: 'Müşteri Adı',    tablo: 'musteriler', kolon: 'ad',    kategori: 'Müşteri', tip: 'metin' },
  { key: 'p_musteri_soyad', label: 'Müşteri Soyadı', tablo: 'musteriler', kolon: 'soyad', kategori: 'Müşteri', tip: 'metin' },

  { key: 'p_arac_plaka', label: 'Plaka', tablo: 'araclar', kolon: 'plaka', kategori: 'Araç', tip: 'plaka' },
  { key: 'p_arac_marka', label: 'Marka', tablo: 'araclar', kolon: 'marka', kategori: 'Araç', tip: 'metin' },
  { key: 'p_arac_model', label: 'Model', tablo: 'araclar', kolon: 'model', kategori: 'Araç', tip: 'metin' },

  { key: 'p_personel_ad',    label: 'Teknisyen Adı',    tablo: 'personel', kolon: 'ad',    kategori: 'Personel', tip: 'metin' },
  { key: 'p_personel_soyad', label: 'Teknisyen Soyadı', tablo: 'personel', kolon: 'soyad', kategori: 'Personel', tip: 'metin' },
]

const KATEGORI_RENK = { 'İş Emri': '#e5484d', 'Müşteri': '#3b82f6', 'Araç': '#f5a623', 'Personel': '#22c55e', 'Parça': '#a855f7' }

// Alan tipine göre kullanılabilecek koşul operatörleri
const OPERATORLER = {
  metin:     [{ id: 'icerir', label: 'içeriyor' }, { id: 'esittir', label: 'eşittir' }],
  sayi:      [{ id: 'esittir', label: '=' }, { id: 'buyuk', label: '>' }, { id: 'kucuk', label: '<' }],
  tutar:     [{ id: 'esittir', label: '=' }, { id: 'buyuk', label: '>' }, { id: 'kucuk', label: '<' }],
  tarihsaat: [{ id: 'sonra', label: 'sonrası' }, { id: 'once', label: 'öncesi' }],
  durum:     [{ id: 'esittir', label: 'eşittir' }],
  odeme:     [{ id: 'esittir', label: 'eşittir' }],
  plaka:     [{ id: 'icerir', label: 'içeriyor' }],
  telefon:   [{ id: 'icerir', label: 'içeriyor' }],
}

// Görüntülenen kolonlara göre birebir aynı satırları tekilleştirir (DISTINCT).
// Sadece az sayıda kolon seçildiğinde (örn. sadece personel adı) tekrar eden
// satırları tek satıra indirir.
const tekillestir = (satirlar, alanlar) => {
  const gorulen = new Set()
  return satirlar.filter(s => {
    const anahtar = JSON.stringify(alanlar.map(a => s[a.key]))
    if (gorulen.has(anahtar)) return false
    gorulen.add(anahtar)
    return true
  })
}

const degerFormatla = (deger, tip) => {
  if (deger === null || deger === undefined || deger === '') return '-'
  switch (tip) {
    case 'tutar': return `₺${parseFloat(deger).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
    case 'durum': return DURUM_LABEL[deger] || deger
    case 'odeme': return ODEME_LABEL[deger] || deger
    case 'plaka': return formatPlaka(deger)
    case 'telefon': return formatTelefon(deger)
    case 'tarihsaat': return new Date(deger).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    default: return deger.toString()
  }
}

let kosulSayac = 0

const DetayRapor = () => {
  const { profile } = useAuth()
  const [mod, setMod] = useState('is_emri') // 'is_emri' | 'parca'
  const [seciliAlanlar, setSeciliAlanlar] = useState([])
  const [surukleneKaynak, setSurukleneKaynak] = useState(null)
  const [sonuc, setSonuc] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [kosullar, setKosullar] = useState([]) // [{id, alanKey, operator, deger, deger2}]
  const [kayitliRaporlar, setKayitliRaporlar] = useState([])
  const [kaydetPenceresiAcik, setKaydetPenceresiAcik] = useState(false)
  const [yeniRaporIsim, setYeniRaporIsim] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => { kayitliRaporlariGetir() }, [])

  const kayitliRaporlariGetir = async () => {
    const { data } = await supabase.from('kayitli_raporlar').select('*').order('created_at', { ascending: false })
    setKayitliRaporlar(data || [])
  }

  const [kaydetHata, setKaydetHata] = useState('')

  const raporuKaydet = async () => {
    if (!yeniRaporIsim.trim()) return
    setKaydediliyor(true)
    setKaydetHata('')
    const { error } = await supabase.from('kayitli_raporlar').insert({
      isim: yeniRaporIsim.trim(),
      mod,
      alanlar: seciliAlanlar,
      kosullar: kosullar.map(({ alanKey, operator, deger }) => ({ alanKey, operator, deger })),
      created_by: profile?.id || null,
    })
    if (error) {
      setKaydetHata(error.message)
    } else {
      setYeniRaporIsim('')
      setKaydetPenceresiAcik(false)
      kayitliRaporlariGetir()
    }
    setKaydediliyor(false)
  }

  const kayitliRaporuYukle = (rapor) => {
    setMod(rapor.mod)
    setSeciliAlanlar(rapor.alanlar || [])
    setKosullar((rapor.kosullar || []).map(k => ({ ...k, id: ++kosulSayac })))
    setSonuc(null)
  }

  const kayitliRaporuSil = async (id, e) => {
    e.stopPropagation()
    await supabase.from('kayitli_raporlar').delete().eq('id', id)
    kayitliRaporlariGetir()
  }

  const katalog = mod === 'parca' ? ALAN_KATALOGU_PARCA : ALAN_KATALOGU_ISEMRI
  const kategoriler = [...new Set(katalog.map(a => a.kategori))]

  const modDegistir = (yeniMod) => {
    setMod(yeniMod)
    setSeciliAlanlar([])
    setKosullar([])
    setSonuc(null)
  }

  const alanEkle = (key) => {
    if (seciliAlanlar.includes(key)) return
    setSeciliAlanlar(prev => [...prev, key])
  }
  const alanCikar = (key) => setSeciliAlanlar(prev => prev.filter(k => k !== key))

  const handleDropKatalogdan = (e) => {
    e.preventDefault()
    if (surukleneKaynak?.kaynak === 'katalog') alanEkle(surukleneKaynak.key)
    setSurukleneKaynak(null)
  }

  const handleDropSiraDegistir = (hedefKey) => {
    if (!surukleneKaynak || surukleneKaynak.kaynak !== 'secili' || surukleneKaynak.key === hedefKey) return
    setSeciliAlanlar(prev => {
      const yeni = prev.filter(k => k !== surukleneKaynak.key)
      const hedefIdx = yeni.indexOf(hedefKey)
      yeni.splice(hedefIdx, 0, surukleneKaynak.key)
      return yeni
    })
    setSurukleneKaynak(null)
  }

  // ─── Koşullar (esnek filtre oluşturucu) ───
  const kosulEkle = () => {
    const ilkAlan = katalog.find(a => a.tablo !== 'ozet')
    setKosullar(prev => [...prev, { id: ++kosulSayac, alanKey: ilkAlan.key, operator: OPERATORLER[ilkAlan.tip][0].id, deger: '' }])
  }
  const kosulSil = (id) => setKosullar(prev => prev.filter(k => k.id !== id))
  const kosulGuncelle = (id, alan, deger) => setKosullar(prev => prev.map(k => {
    if (k.id !== id) return k
    const yeni = { ...k, [alan]: deger }
    // Alan değişince operatör de o alanın tipine uygun ilk seçeneğe dönsün
    if (alan === 'alanKey') {
      const alanNesnesi = katalog.find(a => a.key === deger)
      yeni.operator = OPERATORLER[alanNesnesi.tip]?.[0]?.id || 'esittir'
      yeni.deger = ''
    }
    return yeni
  }))

  const raporuOlustur = async () => {
    if (seciliAlanlar.length === 0) { setHata('En az bir alan seçmelisin.'); return }
    setHata(''); setYukleniyor(true); setSonuc(null)

    const alanNesneleri = seciliAlanlar.map(k => katalog.find(a => a.key === k))
    // "Parça İçeriyor" gibi özel filtreler normal kolon filtresi değildir, ayrı işlenir
    const ozelKosullar = kosullar.filter(k => katalog.find(a => a.key === k.alanKey)?.tablo === 'ozel_filtre' && k.deger !== '')
    const normalKosullar = kosullar.filter(k => !ozelKosullar.includes(k))

    // Koşullarda kullanılan ama rapora eklenmeyen alanlar da select'e dahil edilmeli (filtre için gerekiyor)
    const kosulAlanNesneleri = normalKosullar.map(k => katalog.find(a => a.key === k.alanKey)).filter(Boolean)
    const tumAlanlar = [...alanNesneleri]
    kosulAlanNesneleri.forEach(a => { if (!tumAlanlar.find(x => x.key === a.key)) tumAlanlar.push(a) })

    // Hangi tabloların hangi kolonları gerekiyor + join'in !inner olması gerekip gerekmediği (o tabloda koşul varsa)
    const innerGerekli = new Set(kosulAlanNesneleri.filter(a => a.tablo !== (mod === 'parca' ? 'is_emri_parcalari' : 'is_emirleri')).map(a => a.tablo))

    // "Parça İçeriyor" filtresi varsa önce hangi iş emirlerinin bu parçayı içerdiğini bul
    let parcaIcerirIdListesi = null
    if (mod === 'is_emri' && ozelKosullar.length > 0) {
      let altSorgu = supabase.from('is_emri_parcalari').select('is_emri_id')
      ozelKosullar.forEach(k => { altSorgu = altSorgu.ilike('parca_isim', `%${k.deger}%`) })
      const { data: eslesenler } = await altSorgu
      parcaIcerirIdListesi = [...new Set((eslesenler || []).map(r => r.is_emri_id))]
      if (parcaIcerirIdListesi.length === 0) {
        setSonuc({ alanlar: alanNesneleri, satirlar: [], mod })
        setYukleniyor(false)
        return
      }
    }

    if (mod === 'is_emri') {
      const ieKolonlar = new Set(['id', 'is_emri_no'])
      const musteriKolonlar = new Set(), aracKolonlar = new Set(), personelKolonlar = new Set()
      let parcaOzetGerekli = false

      tumAlanlar.forEach(a => {
        if (a.tablo === 'is_emirleri') ieKolonlar.add(a.kolon)
        else if (a.tablo === 'musteriler') musteriKolonlar.add(a.kolon)
        else if (a.tablo === 'araclar') aracKolonlar.add(a.kolon)
        else if (a.tablo === 'personel') personelKolonlar.add(a.kolon)
        else if (a.tablo === 'ozet') parcaOzetGerekli = true
      })

      let selectStr = [...ieKolonlar].join(',')
      if (musteriKolonlar.size > 0) selectStr += `,musteriler${innerGerekli.has('musteriler') ? '!inner' : ''}(${[...musteriKolonlar].join(',')})`
      if (aracKolonlar.size > 0) selectStr += `,araclar${innerGerekli.has('araclar') ? '!inner' : ''}(${[...aracKolonlar].join(',')})`
      if (personelKolonlar.size > 0) selectStr += `,personel${innerGerekli.has('personel') ? '!inner' : ''}(${[...personelKolonlar].join(',')})`

      let sorgu = supabase.from('is_emirleri').select(selectStr).order('created_at', { ascending: false })
      sorgu = kosullariUygula(sorgu, normalKosullar, katalog)
      if (parcaIcerirIdListesi) sorgu = sorgu.in('id', parcaIcerirIdListesi)

      const { data, error } = await sorgu.limit(1000)
      if (error) { setHata('Rapor oluşturulamadı: ' + error.message); setYukleniyor(false); return }

      let parcaOzetMap = {}
      if (parcaOzetGerekli && (data || []).length > 0) {
        const isEmriIdler = data.map(r => r.id)
        const { data: parcaData } = await supabase.from('is_emri_parcalari').select('is_emri_id, parca_isim, miktar, toplam').in('is_emri_id', isEmriIdler)
        ;(parcaData || []).forEach(p => {
          if (!parcaOzetMap[p.is_emri_id]) parcaOzetMap[p.is_emri_id] = { sayi: 0, liste: [], toplam: 0 }
          parcaOzetMap[p.is_emri_id].sayi += 1
          parcaOzetMap[p.is_emri_id].liste.push(`${p.parca_isim} x${p.miktar}`)
          parcaOzetMap[p.is_emri_id].toplam += parseFloat(p.toplam || 0)
        })
      }

      let satirlar = (data || []).map(row => {
        const satir = {}
        alanNesneleri.forEach(a => {
          if (a.tablo === 'ozet') {
            const ozet = parcaOzetMap[row.id]
            if (a.kolon === 'parca_sayisi') satir[a.key] = ozet?.sayi || 0
            else if (a.kolon === 'parca_listesi') satir[a.key] = ozet?.liste.join(', ') || ''
            else if (a.kolon === 'parca_toplam') satir[a.key] = ozet?.toplam || 0
          } else {
            const kaynak = a.tablo === 'is_emirleri' ? row : row[a.tablo]
            satir[a.key] = kaynak ? kaynak[a.kolon] : null
          }
        })
        return satir
      })
      satirlar = tekillestir(satirlar, alanNesneleri)
      setSonuc({ alanlar: alanNesneleri, satirlar, mod })
    } else {
      // ─── PARÇA BAZLI MOD ───
      const pKolonlar = new Set(['id'])
      const ieKolonlar = new Set(), musteriKolonlar = new Set(), aracKolonlar = new Set(), personelKolonlar = new Set()

      tumAlanlar.forEach(a => {
        if (a.tablo === 'is_emri_parcalari') pKolonlar.add(a.kolon)
        else if (a.tablo === 'is_emirleri') ieKolonlar.add(a.kolon)
        else if (a.tablo === 'musteriler') musteriKolonlar.add(a.kolon)
        else if (a.tablo === 'araclar') aracKolonlar.add(a.kolon)
        else if (a.tablo === 'personel') personelKolonlar.add(a.kolon)
      })

      let ieAltSelect = [...ieKolonlar].join(',')
      if (musteriKolonlar.size > 0) ieAltSelect += `,musteriler${innerGerekli.has('musteriler') ? '!inner' : ''}(${[...musteriKolonlar].join(',')})`
      if (aracKolonlar.size > 0) ieAltSelect += `,araclar${innerGerekli.has('araclar') ? '!inner' : ''}(${[...aracKolonlar].join(',')})`
      if (personelKolonlar.size > 0) ieAltSelect += `,personel${innerGerekli.has('personel') ? '!inner' : ''}(${[...personelKolonlar].join(',')})`

      let selectStr = [...pKolonlar].join(',')
      if (ieAltSelect) selectStr += `,is_emirleri${innerGerekli.has('is_emirleri') ? '!inner' : ''}(${ieAltSelect})`

      let sorgu = supabase.from('is_emri_parcalari').select(selectStr).order('created_at', { ascending: false })
      sorgu = kosullariUygulaParca(sorgu, normalKosullar, katalog)

      const { data, error } = await sorgu.limit(1000)
      if (error) { setHata('Rapor oluşturulamadı: ' + error.message); setYukleniyor(false); return }

      let satirlar = (data || []).map(row => {
        const satir = {}
        alanNesneleri.forEach(a => {
          if (a.tablo === 'is_emri_parcalari') satir[a.key] = row[a.kolon]
          else if (a.tablo === 'is_emirleri') satir[a.key] = row.is_emirleri ? row.is_emirleri[a.kolon] : null
          else {
            const ie = row.is_emirleri
            satir[a.key] = ie && ie[a.tablo] ? ie[a.tablo][a.kolon] : null
          }
        })
        return satir
      })
      // Not: Parça bazlı modda otomatik distinct uygulanmaz — aynı parça/miktar farklı
      // iş emirlerinde tekrar edebilir, distinct toplam hesabını yanlış küçültür.
      setSonuc({ alanlar: alanNesneleri, satirlar, mod })
    }

    setYukleniyor(false)
  }

  // Basit (is_emirleri temel tablolu) sorgular için koşul uygulayıcı
  const kosullariUygula = (sorgu, kosullar, katalog) => {
    kosullar.forEach(k => {
      const a = katalog.find(x => x.key === k.alanKey)
      if (!a || k.deger === '') return
      const alanYolu = a.tablo === 'is_emirleri' ? a.kolon : `${a.tablo}.${a.kolon}`
      sorgu = uygulaOperator(sorgu, alanYolu, k.operator, k.deger, a.tip)
    })
    return sorgu
  }
  // Parça bazlı (nested is_emirleri) sorgular için koşul uygulayıcı
  const kosullariUygulaParca = (sorgu, kosullar, katalog) => {
    kosullar.forEach(k => {
      const a = katalog.find(x => x.key === k.alanKey)
      if (!a || k.deger === '') return
      let alanYolu
      if (a.tablo === 'is_emri_parcalari') alanYolu = a.kolon
      else if (a.tablo === 'is_emirleri') alanYolu = `is_emirleri.${a.kolon}`
      else alanYolu = `is_emirleri.${a.tablo}.${a.kolon}`
      sorgu = uygulaOperator(sorgu, alanYolu, k.operator, k.deger, a.tip)
    })
    return sorgu
  }
  const uygulaOperator = (sorgu, yol, operator, deger, tip) => {
    if (operator === 'icerir') return sorgu.ilike(yol, `%${deger}%`)
    if (operator === 'esittir') return tip === 'metin' ? sorgu.ilike(yol, deger) : sorgu.eq(yol, deger)
    if (operator === 'buyuk') return sorgu.gt(yol, deger)
    if (operator === 'kucuk') return sorgu.lt(yol, deger)
    if (operator === 'sonra') return sorgu.gte(yol, new Date(deger).toISOString())
    if (operator === 'once') return sorgu.lt(yol, new Date(deger).toISOString())
    return sorgu
  }

  const csvIndir = () => {
    if (!sonuc) return
    const basliklar = sonuc.alanlar.map(a => a.label).join(';')
    const satirlar = sonuc.satirlar.map(s =>
      sonuc.alanlar.map(a => `"${degerFormatla(s[a.key], a.tip).toString().replace(/"/g, '""')}"`).join(';')
    )
    const csv = '\uFEFF' + [basliklar, ...satirlar].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `detay-rapor-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toplamSatiri = sonuc && sonuc.mod === 'parca'
    ? sonuc.alanlar.some(a => a.toplanabilir)
    : false

  return (
    <div>
      <div style={{
        marginBottom: 16, padding: '12px 16px', background: 'rgba(59,130,246,.08)',
        border: '1px solid rgba(59,130,246,.25)', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
      }}>
        ℹ️ Soldaki alanları <strong>sağdaki kutuya sürükle</strong>, istediğin kadar <strong>koşul</strong> ekle ve
        <strong> "Raporu Oluştur"</strong> butonuna bas. Parça bazında analiz (örn. "kaç litre yağ kullanıldı") için
        aşağıdan <strong>"Parça Bazlı"</strong> modu seç.
      </div>

      {/* Rapor tipi seçimi */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${mod === 'is_emri' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => modDegistir('is_emri')}>
          🔧 İş Emri Bazlı
        </button>
        <button className={`btn btn-sm ${mod === 'parca' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => modDegistir('parca')}>
          🔩 Parça Bazlı
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 6 }}>
          {mod === 'is_emri'
            ? 'Her satır bir iş emri. Parça bilgisi özet olarak gelir (sayı, liste, toplam) — satır çoğalmaz.'
            : 'Her satır bir parça kalemi. "Motor Yağı" gibi filtreleyip miktarları toplayabilirsin.'}
        </span>
      </div>

      <div className="detay-rapor-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, marginBottom: 16 }}>
        {/* Sol panel - kayıtlı raporlar + alan kataloğu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {kayitliRaporlar.length > 0 && (
            <div className="table-card">
              <div className="table-header"><span className="table-title">📁 Kayıtlı Raporlar</span></div>
              <div style={{ padding: '8px', maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {kayitliRaporlar.map(r => (
                  <div
                    key={r.id}
                    onClick={() => kayitliRaporuYukle(r)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                      padding: '7px 9px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  >
                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.mod === 'parca' ? '🔩' : '🔧'} {r.isim}
                    </span>
                    <button onClick={e => kayitliRaporuSil(r.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        <div className="table-card">
          <div className="table-header"><span className="table-title">📋 Kullanılabilir Alanlar</span></div>
          <div style={{ padding: '10px 12px', maxHeight: '460px', overflowY: 'auto' }}>
            {kategoriler.map(kat => (
              <div key={kat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: KATEGORI_RENK[kat], textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  {kat}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {katalog.filter(a => a.kategori === kat && !a.sadeceKosul).map(a => {
                    const seciliMi = seciliAlanlar.includes(a.key)
                    return (
                      <div
                        key={a.key}
                        draggable={!seciliMi}
                        onDragStart={() => setSurukleneKaynak({ key: a.key, kaynak: 'katalog' })}
                        onClick={() => alanEkle(a.key)}
                        style={{
                          padding: '7px 10px', borderRadius: 7, fontSize: 12,
                          background: seciliMi ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                          border: `1px solid ${seciliMi ? 'var(--border)' : KATEGORI_RENK[kat] + '40'}`,
                          color: seciliMi ? 'var(--text-disabled)' : 'var(--text-primary)',
                          cursor: seciliMi ? 'default' : 'grab',
                          opacity: seciliMi ? 0.5 : 1,
                          userSelect: 'none',
                        }}
                      >
                        {seciliMi ? '✓ ' : '⠿ '}{a.label}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Sağ panel - grid alanı + koşullar + sonuç */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sürükle-bırak grid alanı */}
          <div
            className="table-card"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropKatalogdan}
            style={{ minHeight: 110 }}
          >
            <div className="table-header"><span className="table-title">🎯 Rapor Kolonları (sürükle-bırak)</span></div>
            <div style={{ padding: '14px', display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 60 }}>
              {seciliAlanlar.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12.5, padding: '10px 0' }}>
                  Buraya sol taraftan alan sürükle, ya da alana tıkla.
                </div>
              )}
              {seciliAlanlar.map((key, idx) => {
                const a = katalog.find(x => x.key === key)
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => setSurukleneKaynak({ key, kaynak: 'secili' })}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDropSiraDegistir(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 6px 6px 12px', borderRadius: 20,
                      background: `${KATEGORI_RENK[a.kategori]}18`,
                      border: `1px solid ${KATEGORI_RENK[a.kategori]}50`,
                      fontSize: 12, fontWeight: 600, color: KATEGORI_RENK[a.kategori],
                      cursor: 'grab',
                    }}
                  >
                    <span style={{ opacity: 0.5, fontSize: 10 }}>{idx + 1}</span>
                    {a.label}
                    <button onClick={() => alanCikar(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✕</button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Koşullar - esnek filtre oluşturucu */}
          <div className="table-card">
            <div className="table-header">
              <span className="table-title">🔍 Koşullar {kosullar.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({kosullar.length})</span>}</span>
              <button className="btn btn-secondary btn-sm" onClick={kosulEkle}>+ Koşul Ekle</button>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '180px', overflowY: 'auto' }}>
              {kosullar.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Koşul eklenmedi — tüm kayıtlar gelecek. İstersen "+ Koşul Ekle" ile filtre koy.</div>
              )}
              {kosullar.map(k => {
                const alanNesnesi = katalog.find(a => a.key === k.alanKey)
                const opsiyonlar = OPERATORLER[alanNesnesi?.tip] || OPERATORLER.metin
                return (
                  <div key={k.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="field-select" style={{ flex: '1.3 1 0', minWidth: 0, fontSize: 11.5, padding: '5px 7px' }} value={k.alanKey} onChange={e => kosulGuncelle(k.id, 'alanKey', e.target.value)}>
                      {katalog.filter(a => a.tablo !== 'ozet').map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                    <select className="field-select" style={{ flex: '0.8 1 0', minWidth: 0, fontSize: 11.5, padding: '5px 7px' }} value={k.operator} onChange={e => kosulGuncelle(k.id, 'operator', e.target.value)}>
                      {opsiyonlar.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    {alanNesnesi?.tip === 'durum' ? (
                      <select className="field-select" style={{ flex: '1 1 0', minWidth: 0, fontSize: 11.5, padding: '5px 7px' }} value={k.deger} onChange={e => kosulGuncelle(k.id, 'deger', e.target.value)}>
                        <option value="">Seçin</option>
                        {Object.entries(DURUM_LABEL).map(([kk,v]) => <option key={kk} value={kk}>{v}</option>)}
                      </select>
                    ) : alanNesnesi?.tip === 'odeme' ? (
                      <select className="field-select" style={{ flex: '1 1 0', minWidth: 0, fontSize: 11.5, padding: '5px 7px' }} value={k.deger} onChange={e => kosulGuncelle(k.id, 'deger', e.target.value)}>
                        <option value="">Seçin</option>
                        {Object.entries(ODEME_LABEL).map(([kk,v]) => <option key={kk} value={kk}>{v}</option>)}
                      </select>
                    ) : alanNesnesi?.tip === 'tarihsaat' ? (
                      <input type="date" style={{ flex: '1 1 0', minWidth: 0, fontSize: 11.5, padding: '5px 7px' }} value={k.deger} onChange={e => kosulGuncelle(k.id, 'deger', e.target.value)} />
                    ) : (
                      <input type={alanNesnesi?.tip === 'sayi' || alanNesnesi?.tip === 'tutar' ? 'number' : 'text'} placeholder="değer" style={{ flex: '1 1 0', minWidth: 0, fontSize: 11.5, padding: '5px 7px' }} value={k.deger} onChange={e => kosulGuncelle(k.id, 'deger', e.target.value)} />
                    )}
                    <button onClick={() => kosulSil(k.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, flexShrink: 0, padding: '0 2px' }}>✕</button>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button className="btn btn-secondary" onClick={() => setKaydetPenceresiAcik(true)} disabled={seciliAlanlar.length === 0}>
                  💾 Bu Raporu Kaydet
                </button>
                <button className="btn btn-primary" onClick={raporuOlustur} disabled={yukleniyor}>
                  {yukleniyor ? 'Oluşturuluyor...' : '📊 Raporu Oluştur'}
                </button>
              </div>
            </div>
            {hata && <div className="alert alert-error" style={{ margin: '0 14px 14px' }}>{hata}</div>}
          </div>
        </div>
      </div>

      {/* Sonuç - çarşaf liste */}
      {sonuc && (
        <div className="table-card">
          <div className="table-header">
            <span className="table-title">📄 Rapor Sonucu ({sonuc.satirlar.length} satır)</span>
            <button className="btn btn-secondary btn-sm" onClick={csvIndir}>⬇️ CSV İndir</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--table-head-bg)' }}>
                  {sonuc.alanlar.map(a => (
                    <th key={a.key} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sonuc.satirlar.length === 0 ? (
                  <tr><td colSpan={sonuc.alanlar.length} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Sonuç bulunamadı.</td></tr>
                ) : sonuc.satirlar.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {sonuc.alanlar.map(a => {
                      const tamDeger = degerFormatla(s[a.key], a.tip)
                      return (
                        <td key={a.key} title={tamDeger} style={{ padding: '8px 12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tamDeger}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {toplamSatiri && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)' }}>
                    {sonuc.alanlar.map(a => (
                      <td key={a.key} style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {a.toplanabilir
                          ? degerFormatla(sonuc.satirlar.reduce((s, r) => s + (parseFloat(r[a.key]) || 0), 0), a.tip)
                          : (sonuc.alanlar.indexOf(a) === 0 ? 'TOPLAM' : '')}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Raporu Kaydet penceresi */}
      {kaydetPenceresiAcik && (
        <div className="modal-overlay" onClick={() => setKaydetPenceresiAcik(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <span className="modal-title">💾 Raporu Kaydet</span>
              <button className="modal-close" onClick={() => setKaydetPenceresiAcik(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Rapor Adı</label>
                <input
                  autoFocus
                  value={yeniRaporIsim}
                  onChange={e => setYeniRaporIsim(e.target.value)}
                  placeholder="Örn. Aylık Personel Performansı"
                  onKeyDown={e => e.key === 'Enter' && raporuKaydet()}
                />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                {seciliAlanlar.length} kolon, {kosullar.length} koşul kaydedilecek.
              </div>
              {kaydetHata && <div className="alert alert-error" style={{ marginTop: 12 }}>{kaydetHata}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={raporuKaydet} disabled={kaydediliyor || !yeniRaporIsim.trim()}>
                  {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetayRapor
