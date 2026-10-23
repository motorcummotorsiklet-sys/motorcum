import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { bildirimGonder, bildirimSesiCal, broadcastAyarlarGuncellendi, isMobilCihaz } from '../../utils/pwaBildirim'
import { webPushAboneOl, webPushTetikle } from '../../utils/webPushManager'

const OLAYLAR = [
  { key: 'is_emri_olusturuldu', baslik: '🔧 İş Emri Oluşturuldu', aciklama: 'Araç servise alındığında müşteriye gider' },
  { key: 'is_emri_tamamlandi',  baslik: '✅ İş Emri Tamamlandı',   aciklama: 'Araç teslime hazır olduğunda müşteriye gider' },
  { key: 'odeme_alindi',        baslik: '💰 Ödeme Alındı',         aciklama: 'Ödeme kaydedildiğinde müşteriye gider' },
]

const YONETICI_OLAYLAR = [
  {
    key: 'is_emri_olusturuldu',
    baslik: '🔧 İş Emri Oluşturuldu',
    aciklama: 'Yeni iş emri açıldığında yönetici telefonuna bildirim gider',
    varsayilanBaslik: '🔧 Yeni İş Emri: {arac_plaka}',
    varsayilanIcerik: '#{is_emri_no} nolu araç servise alındı. Müşteri: {musteri_adi}',
    varsayilanRoller: ['admin', 'yönetici', 'usta', 'teknisyen'],
  },
  {
    key: 'is_emri_durum_degisti',
    baslik: '🔄 Statü Değişikliği',
    aciklama: 'İş emrinin durumu (Bekliyor, Devam Ediyor vb.) değiştiğinde bildirim gider',
    varsayilanBaslik: '🔄 Statü Değişti: {arac_plaka}',
    varsayilanIcerik: '#{is_emri_no} nolu aracın yeni durumu: {durum}.',
    varsayilanRoller: ['admin', 'yönetici', 'usta', 'teknisyen'],
  },
  {
    key: 'is_emri_tamamlandi',
    baslik: '✅ İş Emri Tamamlandı',
    aciklama: 'Araç hazır olduğunda yönetici telefonuna bildirim gider',
    varsayilanBaslik: '✅ Servis Tamamlandı: {arac_plaka}',
    varsayilanIcerik: '#{is_emri_no} nolu araç hazır. Toplam: {tutar}',
    varsayilanRoller: ['admin', 'yönetici', 'usta', 'teknisyen'],
  },
  {
    key: 'odeme_alindi',
    baslik: '💰 Ödeme Alındı',
    aciklama: 'Ödeme kaydedildiğinde yönetici telefonuna bildirim gider',
    varsayilanBaslik: '💰 Ödeme Alındı: {tutar}',
    varsayilanIcerik: '{arac_plaka} plakalı iş emri #{is_emri_no} için ödeme kaydedildi.',
    varsayilanRoller: ['admin', 'yönetici', 'usta', 'teknisyen'],
  },
]

const HEDEF_ROLLER = [
  { key: 'admin', label: 'Admin (Yönetici)' },
  { key: 'yönetici', label: 'Yönetici' },
  { key: 'usta', label: 'Usta' },
  { key: 'teknisyen', label: 'Teknisyen' },
]

const SMS_SAGLAYICILAR = {
  yok: { label: 'Kullanmıyorum', not: '', alanlar: [] },
  netgsm: {
    label: 'Netgsm', not: 'netgsm.com.tr üzerinden hesap açıp API bilgilerini "Ayarlar > API Bilgileri" kısmından alabilirsin.',
    alanlar: [
      { key: 'kullanici_adi', label: 'Kullanıcı Adı', tip: 'text' },
      { key: 'sifre', label: 'API Şifresi', tip: 'password' },
      { key: 'baslik', label: 'SMS Başlığı (onaylı gönderici adı)', tip: 'text' },
    ],
  },
  iletimerkezi: {
    label: 'İletimerkezi', not: 'iletimerkezi.com üzerinden hesap açıp API Key/Hash bilgilerini panelden alabilirsin.',
    alanlar: [
      { key: 'api_key', label: 'API Key', tip: 'password' },
      { key: 'api_hash', label: 'API Hash', tip: 'password' },
      { key: 'baslik', label: 'SMS Başlığı (onaylı gönderici adı)', tip: 'text' },
    ],
  },
  twilio: {
    label: 'Twilio', not: 'twilio.com üzerinden hesap açıp Console\'dan Account SID ve Auth Token alabilirsin. (Yurt dışı numaradan gönderim, Türkiye içi SMS için Netgsm/İletimerkezi genelde daha uygun.)',
    alanlar: [
      { key: 'account_sid', label: 'Account SID', tip: 'text' },
      { key: 'auth_token', label: 'Auth Token', tip: 'password' },
      { key: 'gonderen_numara', label: 'Gönderen Numara (+90...)', tip: 'text' },
    ],
  },
}

const EMAIL_YONTEMLERI = {
  yok: { label: 'Kullanmıyorum', not: '', alanlar: [] },
  smtp: {
    label: 'SMTP (Gmail, Yandex, kendi domain maili — hemen hemen her sağlayıcı)',
    not: 'Gmail kullanıyorsan normal şifren değil, "Uygulama Şifresi" (App Password) oluşturman gerekir.',
    alanlar: [
      { key: 'host', label: 'SMTP Sunucu (örn. smtp.gmail.com)', tip: 'text' },
      { key: 'port', label: 'Port (örn. 587)', tip: 'text' },
      { key: 'kullanici', label: 'E-posta Adresi', tip: 'text' },
      { key: 'sifre', label: 'Şifre / Uygulama Şifresi', tip: 'password' },
      { key: 'gonderen_isim', label: 'Gönderen Adı (müşteri e-postada bunu görür)', tip: 'text' },
    ],
  },
  resend: {
    label: 'Resend', not: 'resend.com üzerinden hesap açıp bir domain doğrulaman ve API Key almanız gerekir.',
    alanlar: [
      { key: 'api_key', label: 'API Key', tip: 'password' },
      { key: 'gonderen_eposta', label: 'Gönderen E-posta (doğrulanmış domain)', tip: 'text' },
    ],
  },
}


const YER_TUTUCULAR = [
  ['{musteri_adi}', 'Müşterinin adı soyadı'],
  ['{personel_adi}', 'İş emrine atanan personelin / ustanın adı soyadı'],
  ['{arac_plaka}', 'Aracın plakası'],
  ['{arac_marka_model}', 'Araç marka ve modeli'],
  ['{durum}', 'İş emrinin güncel durumu (Bekliyor, Devam Ediyor vb.)'],
  ['{tutar}', 'İş emri / ödeme tutarı'],
  ['{is_emri_no}', 'İş emri numarası'],
  ['{dukkan_adi}', 'Dükkanının adı'],
  ['{dukkan_telefon}', 'Dükkanının telefonu (varsa)'],
]

const ORNEK_DEGERLER = {
  '{musteri_adi}': 'AHMET YILMAZ',
  '{personel_adi}': 'MEHMET USTA',
  '{personel_ad_soyad}': 'MEHMET USTA',
  '{arac_plaka}': '34 AT 321',
  '{arac_marka_model}': 'Honda PCX 150',
  '{durum}': 'Devam Ediyor',
  '{tutar}': '₺1.850',
  '{is_emri_no}': '#142',
  '{dukkan_adi}': 'Motorcum Motosiklet Servisi',
  '{dukkan_telefon}': '0532 123 45 67',
}

const onizlemeUret = (metin) => {
  if (!metin) return ''
  let sonuc = metin
  for (const [yer, deger] of Object.entries(ORNEK_DEGERLER)) {
    sonuc = sonuc.replaceAll(yer, deger)
  }
  return sonuc
}

const Bildirimler = () => {
  const { profile } = useAuth()
  const [gorunum, setGorunum] = useState(() => {
    try {
      return localStorage.getItem('motorcum_bildirim_aktif_tab') || 'yonetici'
    } catch {
      return 'yonetici'
    }
  })
  const gorunumAyarla = (yeni) => {
    setGorunum(yeni)
    try {
      localStorage.setItem('motorcum_bildirim_aktif_tab', yeni)
    } catch {}
  }
  const [aktifTip, setAktifTip] = useState('sms') // 'sms' | 'email'
  const [aktifOlay, setAktifOlay] = useState('is_emri_olusturuldu')
  const [sablonlar, setSablonlar] = useState({}) // { 'sms:olay': {konu, icerik, aktif, id} }
  const [taslak, setTaslak] = useState({ konu: '', icerik: '', aktif: true, servis_formu_ekle: false })
  const [bagliCihazSayisi, setBagliCihazSayisi] = useState(0)
  const [loading, setLoading] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  // Yönetici Bildirimi Sekmesi State'leri
  const [aktifYoneticiOlay, setAktifYoneticiOlay] = useState(() => {
    try {
      return localStorage.getItem('motorcum_aktif_yonetici_olay') || 'is_emri_olusturuldu'
    } catch {
      return 'is_emri_olusturuldu'
    }
  })
  const aktifYoneticiOlayAyarla = (olayKey) => {
    setAktifYoneticiOlay(olayKey)
    try {
      localStorage.setItem('motorcum_aktif_yonetici_olay', olayKey)
    } catch {}
  }
  const [yoneticiTaslak, setYoneticiTaslak] = useState({
    baslik: '', icerik: '', roller: ['admin', 'yönetici'], ses: true, aktif: true
  })
  const [yoneticiKaydediliyor, setYoneticiKaydediliyor] = useState(false)
  const [izinDurumu, setIzinDurumu] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  })

  // Bağlantılar (kendi SMS/e-posta sağlayıcı ayarları)
  const [entegrasyon, setEntegrasyon] = useState({ sms_saglayici: 'yok', sms_ayarlar: {}, email_yontemi: 'yok', email_ayarlar: {} })
  const [entegrasyonKaydediliyor, setEntegrasyonKaydediliyor] = useState(false)
  const [testEposta, setTestEposta] = useState('')
  const [testGonderiliyor, setTestGonderiliyor] = useState(false)

  useEffect(() => { fetchSablonlar(); fetchEntegrasyon() }, [])
  useEffect(() => {
    const s = sablonlar[`${aktifTip}:${aktifOlay}`]
    setTaslak({ konu: s?.konu || '', icerik: s?.icerik || '', aktif: s?.aktif ?? true, servis_formu_ekle: s?.servis_formu_ekle ?? false })
  }, [aktifTip, aktifOlay, sablonlar])

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 2500) }

  const fetchEntegrasyon = async () => {
    const { data } = await supabase.from('dukkan_entegrasyonlari').select('*').eq('id', 1).maybeSingle()
    if (data) setEntegrasyon({ sms_saglayici: data.sms_saglayici || 'yok', sms_ayarlar: data.sms_ayarlar || {}, email_yontemi: data.email_yontemi || 'yok', email_ayarlar: data.email_ayarlar || {} })
  }

  const entegrasyonKaydet = async () => {
    setEntegrasyonKaydediliyor(true)
    const { error } = await supabase.from('dukkan_entegrasyonlari').upsert({
      id: 1,
      sms_saglayici: entegrasyon.sms_saglayici,
      sms_ayarlar: entegrasyon.sms_ayarlar,
      email_yontemi: entegrasyon.email_yontemi,
      email_ayarlar: entegrasyon.email_ayarlar,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) showMsg('Kaydedilemedi: ' + error.message, 'error')
    else showMsg('✅ Bağlantı ayarları kaydedildi.')
    setEntegrasyonKaydediliyor(false)
  }

  const smsAlanDegistir = (key, deger) => setEntegrasyon(prev => ({ ...prev, sms_ayarlar: { ...prev.sms_ayarlar, [key]: deger } }))
  const emailAlanDegistir = (key, deger) => setEntegrasyon(prev => ({ ...prev, email_ayarlar: { ...prev.email_ayarlar, [key]: deger } }))

  const testEpostaGonder = async () => {
    if (!testEposta.trim()) return showMsg('Test e-postasının gideceği bir adres yaz.', 'error')
    setTestGonderiliyor(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('bildirim-test-gonder', {
      body: { hedef_eposta: testEposta.trim() },
      headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
    })
    if (error || data?.error) {
      showMsg(data?.error || error.message || 'Test e-postası gönderilemedi.', 'error')
    } else {
      showMsg('✅ ' + (data?.message || 'Test e-postası gönderildi, gelen kutunu kontrol et.'))
    }
    setTestGonderiliyor(false)
  }

  const fetchSablonlar = async () => {
    setLoading(true)
    const { data } = await supabase.from('bildirim_sablonlari').select('*')
    const map = {}
    for (const row of (data || [])) map[`${row.tip}:${row.olay}`] = row
    setSablonlar(map)

    try {
      const { count } = await supabase
        .from('push_abonelikleri')
        .select('*', { count: 'exact', head: true })
      setBagliCihazSayisi(count || 0)
    } catch {}

    setLoading(false)
  }

  const kaydet = async () => {
    setKaydediliyor(true)
    const mevcut = sablonlar[`${aktifTip}:${aktifOlay}`]
    const payload = { tip: aktifTip, olay: aktifOlay, konu: taslak.konu || null, icerik: taslak.icerik, aktif: taslak.aktif, servis_formu_ekle: aktifTip === 'email' ? taslak.servis_formu_ekle : false, updated_at: new Date().toISOString() }

    const { data, error } = mevcut
      ? await supabase.from('bildirim_sablonlari').update(payload).eq('id', mevcut.id).select().single()
      : await supabase.from('bildirim_sablonlari').insert(payload).select().single()

    if (error) {
      showMsg('Kaydedilemedi: ' + error.message, 'error')
    } else {
      setSablonlar(prev => ({ ...prev, [`${aktifTip}:${aktifOlay}`]: data }))
      showMsg('✅ Şablon kaydedildi.')
    }
    setKaydediliyor(false)
  }

  const yerTutucuEkle = (yer) => {
    setTaslak(prev => ({ ...prev, icerik: prev.icerik + yer }))
  }

  // Yönetici taslağını localStorage ve veritabanından yükle
  useEffect(() => {
    const def = YONETICI_OLAYLAR.find(o => o.key === aktifYoneticiOlay) || YONETICI_OLAYLAR[0]

    let baslik = def.varsayilanBaslik
    let roller = def.varsayilanRoller
    let ses = true
    let icerik = def.varsayilanIcerik
    let aktif = true

    // 1. Önce LocalStorage'dan kontrol et (sayfa gidip gelse de kaybolmaz)
    try {
      const local = localStorage.getItem('motorcum_yonetici_bildirimleri')
      if (local) {
        const parsed = JSON.parse(local)
        if (parsed[aktifYoneticiOlay]) {
          const l = parsed[aktifYoneticiOlay]
          if (l.baslik) baslik = l.baslik
          if (l.icerik) icerik = l.icerik
          if (Array.isArray(l.roller)) roller = l.roller
          if (typeof l.ses === 'boolean') ses = l.ses
          if (typeof l.aktif === 'boolean') aktif = l.aktif
        }
      }
    } catch {}

    // 2. Varsa Supabase şablonundan üzerine yaz
    const s = sablonlar[`yonetici:${aktifYoneticiOlay}`]
    if (s?.konu) {
      try {
        if (s.konu.startsWith('{')) {
          const parsed = JSON.parse(s.konu)
          if (parsed.baslik) baslik = parsed.baslik
          if (Array.isArray(parsed.roller)) roller = parsed.roller
          if (typeof parsed.ses === 'boolean') ses = parsed.ses
        } else {
          baslik = s.konu
        }
      } catch {}
      if (s.icerik) icerik = s.icerik
      if (typeof s.aktif === 'boolean') aktif = s.aktif
    }

    setYoneticiTaslak({
      baslik,
      icerik,
      roller,
      ses,
      aktif,
    })
  }, [aktifYoneticiOlay, sablonlar])

  const izinIste = async () => {
    if (!isMobilCihaz()) {
      showMsg('ℹ️ Yönetici bildirimleri sadece mobil cihazlara (kilit ekranı ve bildirim çubuğu) gider. PC masaüstünde bildirim gösterilmez.')
      return
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      showMsg('Bu tarayıcı bildirimleri desteklemiyor.', 'error')
      return
    }
    try {
      const p = await Notification.requestPermission()
      setIzinDurumu(p)
      if (p === 'granted') {
        const subRes = await webPushAboneOl(profile)
        if (subRes.success) {
          showMsg('✅ Web Push kilit ekranı bildirimi başarıyla bağlandı! Tuş kilitliyken de bildirim gelecek.')
          fetchSablonlar()
        } else {
          showMsg('⚠️ Bildirim kaydı uyarısı: ' + (subRes.warning || subRes.error || 'Veritabanı RLS kısıtı olabilir. Lütfen Supabase SQL kodunu çalıştırın.'), 'error')
        }
      } else {
        showMsg('Bildirim izni reddedildi.', 'error')
      }
    } catch (e) {
      showMsg('İzin alınırken hata: ' + e.message, 'error')
    }
  }

  const testYoneticiBildirimi = async () => {
    const baslik = onizlemeUret(yoneticiTaslak.baslik || '🔧 Yeni İş Emri: {arac_plaka}')
    const mesaj = onizlemeUret(yoneticiTaslak.icerik || '#{is_emri_no} nolu araç servise alındı.')

    // Eğer PC'den test ediliyorsa: PC'de bildirim fırlatma, doğrudan hedef rollerin telefonlarına Web Push gönder
    if (!isMobilCihaz()) {
      await webPushTetikle({
        baslik,
        mesaj,
        url: '/dashboard',
        hedefRoller: yoneticiTaslak.roller
      })
      showMsg('✅ Test bildirimi seçili rollere ait telefonlara gönderildi! (PC versiyonda bildirim kapalıdır, telefonunuzu kontrol edin.)')
      return
    }

    // Mobil cihazda test ediliyorsa:
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showMsg('Bu tarayıcı bildirimleri desteklemiyor.', 'error')
      return
    }
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      setIzinDurumu(p)
      if (p !== 'granted') {
        showMsg('Lütfen önce bildirim izni verin.', 'error')
        return
      }
    }

    // Cihazın push aboneliğini tazele / kaydet
    webPushAboneOl(profile).catch(() => {})

    if (yoneticiTaslak.ses) {
      bildirimSesiCal()
    }
    
    // Hem yerel bildirim gönder hem Apple/Google Web Push fırlat
    await bildirimGonder(baslik, mesaj, '/dashboard')
    await webPushTetikle({
      baslik,
      mesaj,
      url: '/dashboard',
      hedefRoller: yoneticiTaslak.roller
    })

    showMsg('✅ Test bildirimi gönderildi! Telefonunuzun kilit ekranı ve bildirim çubuğunu kontrol edin.')
  }

  const yoneticiKaydet = async () => {
    setYoneticiKaydediliyor(true)

    // 1. Önce LocalStorage'a kaydet (ekran gidip gelse de asla sıfırlanmaz)
    let tumAyarlar = {}
    try {
      const mevcutLocal = localStorage.getItem('motorcum_yonetici_bildirimleri')
      if (mevcutLocal) tumAyarlar = JSON.parse(mevcutLocal)
    } catch {}

    tumAyarlar[aktifYoneticiOlay] = {
      baslik: yoneticiTaslak.baslik,
      icerik: yoneticiTaslak.icerik,
      roller: yoneticiTaslak.roller,
      ses: yoneticiTaslak.ses,
      aktif: yoneticiTaslak.aktif,
    }

    try {
      localStorage.setItem('motorcum_yonetici_bildirimleri', JSON.stringify(tumAyarlar))
    } catch {}

    // 2. Diğer tüm bağlı cihazlara (mobil/tablet/PC) anında canlı senkronize et
    broadcastAyarlarGuncellendi(tumAyarlar)

    // 3. Veritabanına da yazmayı dene
    const mevcut = sablonlar[`yonetici:${aktifYoneticiOlay}`]
    const konuData = JSON.stringify({
      baslik: yoneticiTaslak.baslik,
      roller: yoneticiTaslak.roller,
      ses: yoneticiTaslak.ses,
    })
    const payload = {
      tip: 'yonetici',
      olay: aktifYoneticiOlay,
      konu: konuData,
      icerik: yoneticiTaslak.icerik,
      aktif: yoneticiTaslak.aktif,
      servis_formu_ekle: false,
      updated_at: new Date().toISOString(),
    }

    let dbBasarili = false
    let dbHata = ''
    try {
      const { data, error } = mevcut
        ? await supabase.from('bildirim_sablonlari').update(payload).eq('id', mevcut.id).select().single()
        : await supabase.from('bildirim_sablonlari').insert(payload).select().single()

      if (!error && data) {
        setSablonlar(prev => ({ ...prev, [`yonetici:${aktifYoneticiOlay}`]: data }))
        dbBasarili = true
      } else if (error) {
        dbHata = error.message
      }
    } catch (e) {
      dbHata = e.message
    }

    if (dbBasarili) {
      showMsg('✅ Bildirim ayarları veritabanı tablosuna başarıyla kaydedildi!')
    } else {
      showMsg('⚠️ Ayarlar tarayıcıya alındı ancak Supabase RLS kısıtı tablolara yazmayı reddetti (' + dbHata + '). Kalıcı kayıt için lütfen SQL Editor\'da RLS iznini çalıştırın.', 'error')
    }
    setYoneticiKaydediliyor(false)
  }

  const rolToggle = (rolKey) => {
    setYoneticiTaslak(prev => {
      const varMi = prev.roller.includes(rolKey)
      return {
        ...prev,
        roller: varMi ? prev.roller.filter(r => r !== rolKey) : [...prev.roller, rolKey]
      }
    })
  }

  const yoneticiYerTutucuEkle = (yer) => {
    setYoneticiTaslak(prev => ({ ...prev, icerik: prev.icerik + yer }))
  }

  if (loading) return <div className="empty-state"><p>Yükleniyor...</p></div>

  return (
    <div>
      {msg.text && <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>{msg.text}</div>}

      {gorunum === 'sablonlar' && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: 'rgba(59,130,246,.08)',
          border: '1px solid rgba(59,130,246,.25)', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
        }}>
          ℹ️ Burada yazdığın metinler, müşterinin <strong>iletişim tercihine</strong> göre otomatik gönderilecek.
          Gönderim, <strong>senin kendi bağladığın SMS/e-posta hesabından</strong> yapılır — maliyet dükkanına
          aittir, platform üzerinden ekstra ücret alınmaz. Sağlayıcı bağlantısını <strong>"🔌 Bağlantılar"</strong> sekmesinden yap.
        </div>
      )}

      {gorunum === 'yonetici' && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: 'rgba(229,72,77,.08)',
          border: '1px solid rgba(229,72,77,.25)', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
        }}>
          📱 <strong>Yönetici & Usta Bildirimleri (PWA):</strong> İş emri oluşturulduğunda, durumu/statüsü değiştiğinde, tamamlandığında veya ödeme alındığında seçtiğiniz rollere telefon bildirimi ve sesli uyarı anlık olarak ulaşır.
        </div>
      )}

      {gorunum === 'baglantilar' && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: 'rgba(59,130,246,.08)',
          border: '1px solid rgba(59,130,246,.25)', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
        }}>
          🔌 Müşterilere SMS ve E-posta gönderebilmek için sağlayıcı API ve bağlantı ayarlarınızı buradan yapılandırabilirsiniz.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${gorunum === 'sablonlar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => gorunumAyarla('sablonlar')}>✏️ Müşteri Şablonları</button>
        <button className={`btn btn-sm ${gorunum === 'yonetici' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => gorunumAyarla('yonetici')}>📱 Yönetici Bildirimi</button>
        <button className={`btn btn-sm ${gorunum === 'baglantilar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => gorunumAyarla('baglantilar')}>🔌 Sağlayıcı Bağlantıları</button>
      </div>

      {gorunum === 'baglantilar' ? (
        <div className="bildirim-baglanti-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* SMS Bağlantısı */}
          <div className="table-card">
            <div className="table-header"><span className="table-title">📱 SMS Sağlayıcı</span></div>
            <div className="modal-body">
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Sağlayıcı Seç</label>
                <select className="field-select" value={entegrasyon.sms_saglayici} onChange={e => setEntegrasyon(prev => ({ ...prev, sms_saglayici: e.target.value }))}>
                  {Object.entries(SMS_SAGLAYICILAR).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                </select>
              </div>
              {SMS_SAGLAYICILAR[entegrasyon.sms_saglayici].not && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 10px', background: 'var(--bg-elevated, rgba(255,255,255,.03))', borderRadius: 8 }}>
                  💡 {SMS_SAGLAYICILAR[entegrasyon.sms_saglayici].not}
                </div>
              )}
              {SMS_SAGLAYICILAR[entegrasyon.sms_saglayici].alanlar.map(alan => (
                <div className="field" key={alan.key} style={{ marginBottom: 12 }}>
                  <label>{alan.label}</label>
                  <input
                    type={alan.tip}
                    value={entegrasyon.sms_ayarlar[alan.key] || ''}
                    onChange={e => smsAlanDegistir(alan.key, e.target.value)}
                  />
                </div>
              ))}
              {entegrasyon.sms_saglayici === 'yok' && (
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>SMS gönderimi kapalı. Bir sağlayıcı seçip bilgilerini gir.</p>
              )}
            </div>
          </div>

          {/* E-posta Bağlantısı */}
          <div className="table-card">
            <div className="table-header"><span className="table-title">✉️ E-posta Sağlayıcı</span></div>
            <div className="modal-body">
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Yöntem Seç</label>
                <select className="field-select" value={entegrasyon.email_yontemi} onChange={e => setEntegrasyon(prev => ({ ...prev, email_yontemi: e.target.value }))}>
                  {Object.entries(EMAIL_YONTEMLERI).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                </select>
              </div>
              {EMAIL_YONTEMLERI[entegrasyon.email_yontemi].not && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 10px', background: 'var(--bg-elevated, rgba(255,255,255,.03))', borderRadius: 8 }}>
                  💡 {EMAIL_YONTEMLERI[entegrasyon.email_yontemi].not}
                </div>
              )}
              {EMAIL_YONTEMLERI[entegrasyon.email_yontemi].alanlar.map(alan => (
                <div className="field" key={alan.key} style={{ marginBottom: 12 }}>
                  <label>{alan.label}</label>
                  <input
                    type={alan.tip}
                    value={entegrasyon.email_ayarlar[alan.key] || ''}
                    onChange={e => emailAlanDegistir(alan.key, e.target.value)}
                  />
                </div>
              ))}
              {entegrasyon.email_yontemi === 'yok' && (
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>E-posta gönderimi kapalı. Bir yöntem seçip bilgilerini gir.</p>
              )}

              {entegrasyon.email_yontemi !== 'yok' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    🧪 Bağlantıyı Test Et
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Ayarları önce kaydet, sonra bir e-posta adresine gerçek test maili gönder.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      placeholder="test@ornek.com"
                      value={testEposta}
                      onChange={e => setTestEposta(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-secondary" onClick={testEpostaGonder} disabled={testGonderiliyor} style={{ flexShrink: 0 }}>
                      {testGonderiliyor ? 'Gönderiliyor...' : '📤 Test Gönder'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={entegrasyonKaydet} disabled={entegrasyonKaydediliyor}>
              {entegrasyonKaydediliyor ? 'Kaydediliyor...' : '💾 Bağlantı Ayarlarını Kaydet'}
            </button>
          </div>
        </div>
      ) : gorunum === 'yonetici' ? (
        <>
          {/* Cihaz Bildirim İzni Durumu Kartı */}
          <div className="table-card" style={{ marginBottom: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: izinDurumu === 'granted' ? 'rgba(34,197,94,.15)' : izinDurumu === 'denied' ? 'rgba(239,68,68,.15)' : 'rgba(234,179,8,.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
              }}>
                {izinDurumu === 'granted' ? '🔔' : izinDurumu === 'denied' ? '🔕' : '⚠️'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {izinDurumu === 'granted'
                    ? 'Bu Cihazda Anlık Bildirimler Aktif'
                    : izinDurumu === 'denied'
                      ? 'Bildirim İzni Engellenmiş'
                      : 'Bildirim İzni Henüz Verilmedi'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {izinDurumu === 'granted'
                    ? 'Telefonunuz kilitliyken veya uygulama arka plandayken bildirim sesiyle anlık uyarı alırsınız.'
                    : izinDurumu === 'denied'
                      ? 'Tarayıcı veya telefon ayarlarınızdan Motorcum için bildirim iznini açmanız gerekir.'
                      : 'Yeni iş emri, tamamlama ve ödemeleri anında telefonunuzda görmek için izin verin.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {izinDurumu !== 'granted' && (
                <button className="btn btn-primary btn-sm" onClick={izinIste}>
                  🔔 Bildirim İznini Aç
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={testYoneticiBildirimi}>
                {isMobilCihaz() ? '🧪 Bu Cihazda Test Et' : '📱 Telefonlara Test Gönder'}
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: bagliCihazSayisi > 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: bagliCihazSayisi > 0 ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12.5,
            color: 'var(--text-main, #fff)',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{bagliCihazSayisi > 0 ? '📱' : '⚠️'}</span>
              <span>
                <strong>Kayıtlı Yönetici Telefonu:</strong> {bagliCihazSayisi > 0 ? `${bagliCihazSayisi} adet mobil cihaz bağlı (Kilitli telefona bildirim gider)` : 'Henüz sisteme bağlı telefon yok! Telefonunuzdan uygulamayı açıp bildirim izni verin.'}
              </span>
            </div>
            {isMobilCihaz() && izinDurumu !== 'granted' && (
              <button className="btn btn-primary btn-sm" onClick={izinIste} style={{ flexShrink: 0 }}>
                🔔 Bildirim İznini Aç
              </button>
            )}
          </div>

          <div className="bildirim-sablon-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
            {/* Olay listesi */}
            <div className="table-card">
              <div className="table-header"><span className="table-title">Bildirim Adımları</span></div>
              {YONETICI_OLAYLAR.map(o => {
                const s = sablonlar[`yonetici:${o.key}`]
                const secili = aktifYoneticiOlay === o.key
                const aktif = s ? s.aktif : true
                return (
                  <div
                    key={o.key}
                    onClick={() => aktifYoneticiOlayAyarla(o.key)}
                    style={{
                      padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      background: secili ? 'var(--bg-elevated, rgba(255,255,255,.04))' : 'transparent',
                      borderLeft: secili ? '2px solid var(--red, #e5484d)' : '2px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{o.baslik}</div>
                      {!aktif && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>pasif</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{o.aciklama}</div>
                  </div>
                )
              })}
            </div>

            {/* Olay Düzenleme & Ayarları */}
            <div className="table-card">
              <div className="table-header">
                <span className="table-title">{YONETICI_OLAYLAR.find(o => o.key === aktifYoneticiOlay)?.baslik} Ayarları</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={yoneticiTaslak.aktif}
                    onChange={e => setYoneticiTaslak(prev => ({ ...prev, aktif: e.target.checked }))}
                  />
                  Bu bildirim adımı aktif
                </label>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Bildirimi Alacak Roller */}
                <div className="field">
                  <label style={{ marginBottom: 6, display: 'block' }}>Bildirimi Alacak Roller (Telefonuna Bildirim Gidecek Kişiler)</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {HEDEF_ROLLER.map(rol => {
                      const secili = yoneticiTaslak.roller.includes(rol.key)
                      return (
                        <button
                          key={rol.key}
                          type="button"
                          onClick={() => rolToggle(rol.key)}
                          className={`btn btn-sm ${secili ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            opacity: secili ? 1 : 0.65,
                            border: secili ? '1px solid var(--red, #e5484d)' : '1px solid var(--border)'
                          }}
                        >
                          <span>{secili ? '✓' : '+'}</span>
                          <span>{rol.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Yalnızca bu role sahip kullanıcıların telefon veya bilgisayarlarına anlık bildirim düşer.
                  </div>
                </div>

                {/* Ses Uyarısı */}
                <div style={{ padding: '10px 14px', background: 'var(--bg-elevated, rgba(255,255,255,.02))', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={yoneticiTaslak.ses}
                      onChange={e => setYoneticiTaslak(prev => ({ ...prev, ses: e.target.checked }))}
                    />
                    🔔 Bildirim geldiğinde sesli uyarı çal
                  </label>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 24, marginTop: 2 }}>
                    Bildirim düştüğünde telefon hoparlöründen dikkat çekici 2 tonlu servis melodi sesi çalar.
                  </div>
                </div>

                {/* Bildirim Başlığı */}
                <div className="field">
                  <label>Bildirim Başlığı</label>
                  <input
                    type="text"
                    value={yoneticiTaslak.baslik}
                    onChange={e => setYoneticiTaslak(prev => ({ ...prev, baslik: e.target.value }))}
                    placeholder="Örn: 🔧 Yeni İş Emri: {arac_plaka}"
                  />
                </div>

                {/* Bildirim Mesajı */}
                <div className="field">
                  <label>Bildirim Mesajı</label>
                  <textarea
                    rows={3}
                    value={yoneticiTaslak.icerik}
                    onChange={e => setYoneticiTaslak(prev => ({ ...prev, icerik: e.target.value }))}
                    placeholder="Bildirim metnini yazın..."
                  />
                </div>

                {/* Yer Tutucular */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Yer Tutucular (Tıkla ve mesaja ekle):</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {YER_TUTUCULAR.map(([tag, acik]) => (
                      <button
                        key={tag}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title={acik}
                        onClick={() => yoneticiYerTutucuEkle(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobil Bildirim Önizlemesi */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>📱 Telefon Ekranı Bildirim Görünümü (Canlı Önizleme):</div>
                  <div style={{
                    maxWidth: 420,
                    background: '#18181b',
                    color: '#f4f4f5',
                    borderRadius: 14,
                    padding: '12px 14px',
                    border: '1px solid rgba(255,255,255,.15)',
                    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>🏍️</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7' }}>Motorcum Servis</span>
                      </div>
                      <span style={{ fontSize: 10.5, color: '#a1a1aa' }}>Şimdi</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 3 }}>
                      {onizlemeUret(yoneticiTaslak.baslik) || <span style={{ color: '#71717a' }}>Başlık girilmedi</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#d4d4d8', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {onizlemeUret(yoneticiTaslak.icerik) || <span style={{ color: '#71717a' }}>Mesaj metni girilmedi</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 10.5, color: '#a1a1aa' }}>
                      <span>🎯 Hedef Roller: {yoneticiTaslak.roller.length > 0 ? yoneticiTaslak.roller.join(', ') : 'Seçilmedi'}</span>
                      {yoneticiTaslak.ses && <span>🔔 Sesli</span>}
                    </div>
                  </div>
                </div>

                {/* Aksiyon Butonları */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={testYoneticiBildirimi}>
                    {isMobilCihaz() ? '🧪 Bu Bildirimi Cihazımda Test Et' : '📱 Seçili Rollere Test Gönder'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={yoneticiKaydet} disabled={yoneticiKaydediliyor}>
                    {yoneticiKaydediliyor ? 'Kaydediliyor...' : '💾 Ayarları Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
      <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${aktifTip === 'sms' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAktifTip('sms')}>📱 SMS</button>
        <button className={`btn btn-sm ${aktifTip === 'email' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAktifTip('email')}>✉️ E-posta</button>
      </div>

      <div className="bildirim-sablon-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* Olay listesi */}
        <div className="table-card">
          <div className="table-header"><span className="table-title">Olaylar</span></div>
          {OLAYLAR.map(o => {
            const s = sablonlar[`${aktifTip}:${o.key}`]
            const secili = aktifOlay === o.key
            return (
              <div
                key={o.key}
                onClick={() => setAktifOlay(o.key)}
                style={{
                  padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  background: secili ? 'var(--bg-elevated, rgba(255,255,255,.04))' : 'transparent',
                  borderLeft: secili ? '2px solid var(--red, #e5484d)' : '2px solid transparent',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{o.baslik}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{o.aciklama}</div>
                {s && !s.aktif && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⏸ pasif</span>}
              </div>
            )
          })}
        </div>

        {/* Şablon editörü */}
        <div className="table-card">
          <div className="table-header">
            <span className="table-title">{OLAYLAR.find(o => o.key === aktifOlay)?.baslik} — {aktifTip === 'sms' ? 'SMS' : 'E-posta'} Metni</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={taslak.aktif} onChange={e => setTaslak(prev => ({ ...prev, aktif: e.target.checked }))} />
              Bu bildirim aktif
            </label>
          </div>
          <div className="modal-body">
            {aktifTip === 'email' && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label>E-posta Konusu</label>
                <input value={taslak.konu} onChange={e => setTaslak(prev => ({ ...prev, konu: e.target.value }))} placeholder="Örn. Aracınız Hazır" />
              </div>
            )}

            <div className="field" style={{ marginBottom: 8 }}>
              <label>Mesaj İçeriği</label>
              <textarea
                rows={aktifTip === 'sms' ? 4 : 8}
                value={taslak.icerik}
                onChange={e => setTaslak(prev => ({ ...prev, icerik: e.target.value }))}
                placeholder="Mesaj metnini yaz, aşağıdaki yer tutuculardan ekleyebilirsin..."
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
              {aktifTip === 'sms' && (
                <div style={{ fontSize: 11, color: taslak.icerik.length > 160 ? 'var(--red, #e5484d)' : 'var(--text-muted)', marginTop: 4 }}>
                  {taslak.icerik.length} karakter {taslak.icerik.length > 160 ? '— 160 karakteri geçen SMS 2 parça olarak ücretlendirilir' : '/ 160'}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Yer Tutucu Ekle</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {YER_TUTUCULAR.map(([yer, aciklama]) => (
                  <button key={yer} type="button" className="btn btn-secondary btn-sm" title={aciklama} onClick={() => yerTutucuEkle(yer)}>
                    {yer}
                  </button>
                ))}
              </div>
            </div>

            {aktifTip === 'email' && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px',
                background: taslak.servis_formu_ekle ? 'rgba(34,197,94,.08)' : 'var(--bg-elevated, rgba(255,255,255,.03))',
                border: `1px solid ${taslak.servis_formu_ekle ? 'rgba(34,197,94,.3)' : 'var(--border)'}`,
                borderRadius: 10, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={taslak.servis_formu_ekle}
                  onChange={e => setTaslak(prev => ({ ...prev, servis_formu_ekle: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>📎 Servis formunu (PDF) e-postaya ekle</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    İşaretlersen, iş emrinin yazdırma çıktısı otomatik olarak bu e-postaya PDF eki olarak eklenir.
                  </div>
                </div>
              </label>
            )}

            <div style={{
              padding: '24px 14px', borderRadius: 10, background: 'var(--bg-elevated, rgba(255,255,255,.03))',
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'center' }}>
                📋 Önizleme — {aktifTip === 'sms' ? 'Müşterinin telefonunda böyle görünecek' : 'Müşterinin gelen kutusunda böyle görünecek'}
              </div>

              {aktifTip === 'sms' ? (
                /* ===== TELEFON MOCKUP ===== */
                <div style={{ maxWidth: 280, margin: '0 auto' }}>
                  <div style={{ background: '#1a1a1a', borderRadius: 30, padding: '12px 9px', boxShadow: '0 24px 50px -12px rgba(0,0,0,.6)' }}>
                    <div style={{ background: '#000', borderRadius: 20, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px 3px', fontSize: 10.5, color: '#fff', fontWeight: 600 }}>
                        <span>9:41</span>
                        <span>📶 🔋</span>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px 0 12px', borderBottom: '1px solid #262626' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#333', margin: '0 auto 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏪</div>
                        <div style={{ color: '#fff', fontSize: 11.5, fontWeight: 600 }}>{ORNEK_DEGERLER['{dukkan_adi}']}</div>
                      </div>
                      <div style={{ padding: '14px 10px', minHeight: 130 }}>
                        <div style={{
                          background: '#262626', color: '#fff', borderRadius: '16px 16px 16px 4px',
                          padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, maxWidth: '88%',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {onizlemeUret(taslak.icerik) || <span style={{ color: '#666' }}>Henüz metin yazılmadı.</span>}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#555', marginTop: 5, marginLeft: 2 }}>şimdi</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ===== E-POSTA MOCKUP ===== */
                <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 50px -12px rgba(0,0,0,.6)' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                      {onizlemeUret(taslak.konu) || <span style={{ color: '#aaa', fontWeight: 500 }}>(konu girilmedi)</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5484d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {ORNEK_DEGERLER['{dukkan_adi}'][0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{ORNEK_DEGERLER['{dukkan_adi}']}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>kime: musteri@ornek.com</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '18px 20px', fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap', minHeight: 100, wordBreak: 'break-word' }}>
                    {onizlemeUret(taslak.icerik) || <span style={{ color: '#aaa' }}>Henüz metin yazılmadı.</span>}
                  </div>
                  {taslak.servis_formu_ekle && (
                    <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📄</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>servis-formu-{ORNEK_DEGERLER['{is_emri_no}'].replace('#', '')}.pdf</div>
                        <div style={{ fontSize: 10.5, color: '#888' }}>PDF · Ek</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={kaydet} disabled={kaydediliyor}>
                {kaydediliyor ? 'Kaydediliyor...' : '💾 Şablonu Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

export default Bildirimler
