import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import '../styles/auth.css'

const KAN_GRUPLARI = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']

// Doğum tarihi girişi — tek standart format: GG.AA.YYYY
const TarihGirisi = ({ value, onChange }) => {
  const [metin, setMetin] = useState('')

  const handleChange = (e) => {
    const rakamlar = e.target.value.replace(/[^0-9]/g, '').slice(0, 8)
    let goster = rakamlar
    if (rakamlar.length > 4) goster = `${rakamlar.slice(0,2)}.${rakamlar.slice(2,4)}.${rakamlar.slice(4)}`
    else if (rakamlar.length > 2) goster = `${rakamlar.slice(0,2)}.${rakamlar.slice(2)}`
    setMetin(goster)

    if (rakamlar.length === 0) { onChange(''); return }
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

const Register = () => {
  const [form, setForm] = useState({
    ad: '', soyad: '', kullaniciAdi: '', kanGrubu: '',
    tc: '', email: '', telefon: '', dogumTarihi: '',
    sifre: '', sifreTekrar: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.sifre !== form.sifreTekrar) return setError('Şifreler eşleşmiyor.')
    if (form.sifre.length < 6) return setError('Şifre en az 6 karakter olmalı.')
    if (!form.ad.trim() || !form.soyad.trim()) return setError('Ad ve soyad zorunludur.')
    if (!form.kullaniciAdi.trim()) return setError('Kullanıcı adı zorunludur.')

    setLoading(true)

    // Kullanıcı adı kontrolü
    const { data: existing } = await supabase
      .from('profiles')
      .select('kullanici_adi')
      .eq('kullanici_adi', form.kullaniciAdi.toLowerCase().trim())
      .maybeSingle()

    if (existing) {
      setError('Bu kullanıcı adı zaten kullanılıyor.')
      setLoading(false)
      return
    }

    // Supabase signUp — auth.users + auth.identities otomatik oluşur
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.sifre,
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('Bu e-posta adresi zaten kayıtlı.')
      } else if (signUpError.message.includes('rate limit')) {
        setError('Çok fazla deneme yapıldı, lütfen birkaç dakika bekleyin.')
      } else {
        setError('Kayıt hatası: ' + signUpError.message)
      }
      setLoading(false)
      return
    }

    if (!data?.user?.id) {
      setError('Kullanıcı oluşturulamadı, lütfen tekrar deneyin.')
      setLoading(false)
      return
    }

    // Trigger profiles'a id+email+rol+aktif yazdı
    // Şimdi geri kalan bilgileri UPDATE ile ekle
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ad: form.ad.trim(),
        soyad: form.soyad.trim(),
        kullanici_adi: form.kullaniciAdi.toLowerCase().trim(),
        kan_grubu: form.kanGrubu || null,
        tc: form.tc || null,
        telefon: form.telefon || null,
        dogum_tarihi: form.dogumTarihi || null,
      })
      .eq('id', data.user.id)

    if (updateError) {
      setError('Profil hatası: ' + updateError.message)
      setLoading(false)
      return
    }

    // personel tablosuna da ekle
    await supabase.from('personel').insert({
      ad: form.ad.trim(),
      soyad: form.soyad.trim(),
      telefon: form.telefon || null,
      email: form.email.trim(),
      rol: 'teknisyen',
      aktif: false,
    })

    // Otomatik session açılmasın — pasif kullanıcı login olamaz
    await supabase.auth.signOut()

    setSuccess('Kaydınız alındı! Yöneticiniz hesabınızı onayladıktan sonra giriş yapabilirsiniz.')
    setForm({
      ad: '', soyad: '', kullaniciAdi: '', kanGrubu: '',
      tc: '', email: '', telefon: '', dogumTarihi: '',
      sifre: '', sifreTekrar: ''
    })
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">
          <img src="/logo.png" alt="Motorcum Logo" />
          <h1>MOTORCUM</h1>
          <p>Yeni Hesap Oluştur</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>Ad *</label>
              <input name="ad" type="text" placeholder="Adınız" value={form.ad} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Soyad *</label>
              <input name="soyad" type="text" placeholder="Soyadınız" value={form.soyad} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Kullanıcı Adı *</label>
              <input name="kullaniciAdi" type="text" placeholder="kullanici_adi" value={form.kullaniciAdi} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Kan Grubu</label>
              <select name="kanGrubu" value={form.kanGrubu} onChange={handleChange}>
                <option value="">Seçin</option>
                {KAN_GRUPLARI.map(kg => <option key={kg} value={kg}>{kg}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>TC Kimlik No</label>
              <input name="tc" type="text" placeholder="12345678901" maxLength={11} value={form.tc} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Doğum Tarihi</label>
              <TarihGirisi value={form.dogumTarihi} onChange={v => setForm({ ...form, dogumTarihi: v })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>E-posta *</label>
              <input name="email" type="email" placeholder="ornek@email.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input name="telefon" type="tel" placeholder="05xx xxx xx xx" value={form.telefon} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Şifre *</label>
              <input name="sifre" type="password" placeholder="En az 6 karakter" value={form.sifre} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Şifre Tekrar *</label>
              <input name="sifreTekrar" type="password" placeholder="••••••••" value={form.sifreTekrar} onChange={handleChange} required />
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && (
            <div className="auth-success" style={{ textAlign: 'center', lineHeight: 1.6 }}>
              ✅ {success}
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Zaten hesabın var mı? Giriş yap</Link>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          background: 'rgba(245,166,35,.08)',
          border: '1px solid rgba(245,166,35,.2)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#f5a623',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          ⚠️ Kayıt olduktan sonra yönetici onayı gereklidir.
        </div>
      </div>
    </div>
  )
}

export default Register
