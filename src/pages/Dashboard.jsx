import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { APP_VERSION, APP_AUTHOR } from '../version'
import Sidebar from '../components/dashboard/Sidebar'
import GuncellemeNotuPopup from '../components/dashboard/GuncellemeNotuPopup'
import GenelBakis from './dashboard/GenelBakis'
import Musteriler from './dashboard/Musteriler'
import IsEmirleri from './dashboard/IsEmirleri'
import Personel from './dashboard/Personel'
import Raporlar from './dashboard/Raporlar'
import DetayRapor from './dashboard/DetayRapor'
import Bildirimler from './dashboard/Bildirimler'
import BayiHesaplari from './dashboard/BayiHesaplari'
import AracTicaret from './dashboard/AracTicaret'
import Tanimlamalar from './dashboard/Tanimlamalar'
import YoneticiPaneli from './dashboard/YoneticiPaneli'
import { IconDashboard, IconUsers, IconTool, IconSettings, IconChart, IconLogout, IconMenu } from '../components/Icons'
import ThemeToggle from '../components/ThemeToggle'
import MotorSaat from '../components/dashboard/MotorSaat'
import '../styles/dashboard.css'

const PAGE_TITLES = {
  'genel':            ['Genel Bakış',       'Hoş geldiniz'],
  'musteriler':       ['Müşteriler',         'Kayıtlı müşteriler'],
  'is-emirleri':      ['İş Emirleri',        'Servis takibi'],
  'personel':         ['Personel',           'Çalışan yönetimi'],
  'bayi-hesaplari':   ['Bayi Hesapları',     'Mal verilen dükkanların cari hesabı'],
  'arac-ticaret':     ['Araç Alım-Satım',    'Motor/araba ticareti — ayrı kâr-zarar takibi'],
  'tanimlamalar':     ['Tanımlamalar',       'Marka, model ve parça yönetimi'],
  'bildirimler':      ['Bildirimler',        'SMS ve e-posta şablonları'],
  'raporlar':         ['Özet Rapor',         'İstatistik ve analizler'],
  'detay-rapor':      ['Detay Rapor',        'Kendi raporunu oluştur'],
  'yonetici-paneli':  ['Yönetici Paneli',   '🔒 Sadece admin'],
}

const BOTTOM_NAV = [
  { id: 'genel',        Icon: IconDashboard, label: 'Genel' },
  { id: 'musteriler',   Icon: IconUsers,     label: 'Müşteriler' },
  { id: 'is-emirleri',  Icon: IconTool,      label: 'İş Emirleri', center: true },
  { id: 'raporlar',     Icon: IconChart,     label: 'Raporlar' },
  { id: 'cikis',        Icon: IconLogout,    label: 'Çıkış' },
]

const Dashboard = () => {
  const [activePage, setActivePage] = useState('genel')
  const [acikIsEmri, setAcikIsEmri] = useState(null)
  const [profile, setProfile] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cikisArmed, setCikisArmed] = useState(false)
  const { user, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    }
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Admin koruma: yönetici paneline sadece admin erişebilir
  const ustaPlusMi = ['admin', 'usta', 'yönetici'].includes(profile?.rol)
  const adminMi = ['admin', 'yönetici'].includes(profile?.rol)

  const handleSetActivePage = (page) => {
    if (page === 'yonetici-paneli' && !isAdmin) return
    setActivePage(page)
  }

  const renderPage = () => {
    switch (activePage) {
      case 'genel':           return <GenelBakis onIsEmriAc={(is) => { setAcikIsEmri(is); setActivePage('is-emirleri') }} />
      case 'musteriler':      return <Musteriler onIsEmriAc={(is) => { setAcikIsEmri(is); setActivePage('is-emirleri') }} />
      case 'is-emirleri':     return <IsEmirleri acikIsEmri={acikIsEmri} onAcikIsEmriTemizle={() => setAcikIsEmri(null)} />
      case 'personel':        return <Personel />
      case 'bayi-hesaplari':  return adminMi ? <BayiHesaplari /> : <div className="empty-state"><p>Bu sayfaya erişim yetkiniz yok.</p></div>
      case 'arac-ticaret':    return adminMi ? <AracTicaret /> : <div className="empty-state"><p>Bu sayfaya erişim yetkiniz yok.</p></div>
      case 'tanimlamalar':    return <Tanimlamalar />
      case 'bildirimler':     return ustaPlusMi ? <Bildirimler /> : <div className="empty-state"><p>Bu sayfaya erişim yetkiniz yok.</p></div>
      case 'raporlar':        return ustaPlusMi ? <Raporlar /> : <div className="empty-state"><p>Bu sayfaya erişim yetkiniz yok.</p></div>
      case 'detay-rapor':     return ustaPlusMi ? <DetayRapor /> : <div className="empty-state"><p>Bu sayfaya erişim yetkiniz yok.</p></div>
      case 'yonetici-paneli': return isAdmin ? <YoneticiPaneli /> : <div className="empty-state"><p>Erişim yetkiniz yok.</p></div>
      default:                return <GenelBakis />
    }
  }

  const [title, subtitle] = PAGE_TITLES[activePage] || ['Dashboard', '']

  return (
    <div className="dashboard-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={handleSetActivePage}
        profile={profile}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="dashboard-main">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Menüyü aç">
              <IconMenu size={20} />
            </button>
            <div>
              <div className="topbar-title">{title}</div>
              <div className="topbar-subtitle">{subtitle}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div className="desktop-only"><MotorSaat /></div>
            <ThemeToggle />
          </div>
        </div>
        <div className="page-content">{renderPage()}</div>
      </div>

      {/* Mobil alt menü */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          {BOTTOM_NAV.map(({ id, Icon, label, center }) => {
            const isActive = activePage === id
            const isCikis = id === 'cikis'
            const cikisOnayGosteriliyor = isCikis && cikisArmed
            return (
              <button
                key={id}
                className={`bottom-nav-item ${isActive ? 'active' : ''} ${center ? 'center-nav' : ''} ${isCikis ? 'logout' : ''}`}
                onClick={() => {
                  if (isCikis) {
                    if (cikisArmed) { setCikisArmed(false); handleSignOut() }
                    else { setCikisArmed(true); setTimeout(() => setCikisArmed(false), 3000) }
                  } else {
                    handleSetActivePage(id)
                  }
                }}
              >
                <span className="nav-icon-mobile">
                  <Icon
                    size={20}
                    color={cikisOnayGosteriliyor ? '#e5484d' : isActive && center ? '#fff' : isActive ? '#e5484d' : 'var(--text-muted)'}
                  />
                </span>
                <span className="nav-label-mobile" style={cikisOnayGosteriliyor ? { color: '#e5484d', fontWeight: 700 } : {}}>
                  {cikisOnayGosteriliyor ? 'Emin misin?' : label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Güncelleme notu popup - login sonrası */}
      <GuncellemeNotuPopup />

      <div className="version-badge">v{APP_VERSION} · <span>{APP_AUTHOR}</span></div>
    </div>
  )
}

export default Dashboard
