import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { APP_VERSION, APP_AUTHOR } from '../version'
import '../styles/auth.css'

const Login = () => {
  const [kullaniciAdi, setKullaniciAdi] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(kullaniciAdi, password)
    if (error) setError('Kullanıcı adı veya şifre hatalı.')
    else navigate('/dashboard', { replace: true })
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Motorcum Logo" />
          <h1>MOTORCUM</h1>
          <p>Müşteri Portalı</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Kullanıcı Adı</label>
            <input type="text" placeholder="kullanici_adi" value={kullaniciAdi} onChange={e => setKullaniciAdi(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Şifre</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Şifremi unuttum</Link>
          <span>·</span>
          <Link to="/register">Hesap oluştur</Link>
        </div>
      </div>

      <div className="auth-signature">
        <p>v{APP_VERSION} · Geliştirici: <span>{APP_AUTHOR}</span></p>
      </div>
    </div>
  )
}

export default Login
