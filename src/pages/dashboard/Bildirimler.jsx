import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

const OLAYLAR = [
  { key: 'is_emri_olusturuldu', baslik: '🔧 İş Emri Oluşturuldu', aciklama: 'Araç servise alındığında müşteriye gider' },
  { key: 'is_emri_tamamlandi',  baslik: '✅ İş Emri Tamamlandı',   aciklama: 'Araç teslime hazır olduğunda müşteriye gider' },
  { key: 'odeme_alindi',        baslik: '💰 Ödeme Alındı',         aciklama: 'Ödeme kaydedildiğinde müşteriye gider' },
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
  ['{arac_plaka}', 'Aracın plakası'],
  ['{arac_marka_model}', 'Araç marka ve modeli'],
  ['{tutar}', 'İş emri / ödeme tutarı'],
  ['{is_emri_no}', 'İş emri numarası'],
  ['{dukkan_adi}', 'Dükkanının adı'],
  ['{dukkan_telefon}', 'Dükkanının telefonu (varsa)'],
]

const ORNEK_DEGERLER = {
  '{musteri_adi}': 'AHMET YILMAZ',
  '{arac_plaka}': '34 AT 321',
  '{arac_marka_model}': 'Honda PCX 150',
  '{tutar}': '₺1.850',
  '{is_emri_no}': '#142',
  '{dukkan_adi}': 'Vadi Motosiklet Servisi',
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
  const [gorunum, setGorunum] = useState('sablonlar') // 'sablonlar' | 'baglantilar'
  const [aktifTip, setAktifTip] = useState('sms') // 'sms' | 'email'
  const [aktifOlay, setAktifOlay] = useState('is_emri_olusturuldu')
  const [sablonlar, setSablonlar] = useState({}) // { 'sms:olay': {konu, icerik, aktif, id} }
  const [taslak, setTaslak] = useState({ konu: '', icerik: '', aktif: true, servis_formu_ekle: false })
  const [loading, setLoading] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

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

  if (loading) return <div className="empty-state"><p>Yükleniyor...</p></div>

  return (
    <div>
      {msg.text && <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>{msg.text}</div>}

      <div style={{
        marginBottom: 16, padding: '12px 16px', background: 'rgba(59,130,246,.08)',
        border: '1px solid rgba(59,130,246,.25)', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
      }}>
        ℹ️ Burada yazdığın metinler, müşterinin <strong>iletişim tercihine</strong> göre otomatik gönderilecek.
        Gönderim, <strong>senin kendi bağladığın SMS/e-posta hesabından</strong> yapılır — maliyet dükkanına
        aittir, platform üzerinden ekstra ücret alınmaz. Sağlayıcı bağlantısını <strong>"🔌 Bağlantılar"</strong> sekmesinden yap.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${gorunum === 'sablonlar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGorunum('sablonlar')}>✏️ Mesaj Şablonları</button>
        <button className={`btn btn-sm ${gorunum === 'baglantilar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGorunum('baglantilar')}>🔌 Bağlantılar</button>
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
