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
import PlakaSorgula from '../components/dashboard/PlakaSorgula'
import { useYoneticiBildirimleri } from '../components/dashboard/useYoneticiBildirimleri'
import { isMobilCihaz } from '../utils/pwaBildirim'
import { webPushAboneOl } from '../utils/webPushManager'
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
  const [activePage, setActivePage] = useState(() => window.history.state?.page || sessionStorage.getItem('motorcum_aktif_sayfa') || 'genel')
  const [acikIsEmri, setAcikIsEmri] = useState(null)
  const [profile, setProfile] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cikisArmed, setCikisArmed] = useState(false)
  const [plakaSorgulaAcik, setPlakaSorgulaAcik] = useState(false)
  const [bildirimIzinDurumu, setBildirimIzinDurumu] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default'
  })
  const { user, profile: authProfile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()

  const mobilBildirimIzinVer = async () => {
    if (typeof Notification === 'undefined') return
    try {
      const p = await Notification.requestPermission()
      setBildirimIzinDurumu(p)
      if (p === 'granted') {
        await webPushAboneOl(authProfile || profile)
      }
    } catch (e) {
      console.warn('İzin hatası:', e)
    }
  }

  // Yönetici PWA anlık telefon bildirim dinleyicisi
  useYoneticiBildirimleri(authProfile || profile)

  useEffect(() => {
    if (user && !authProfile) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    }
  }, [user, authProfile])

  // Sayfa yenilenince (F5 / mobil yenile) aynı ekranda kalınsın diye her
  // sayfa değişiminde sessionStorage'a da yazıyoruz — bu, tarayıcı sekmesi
  // kapanana kadar kalıcı, useState'in ilk değeri de buradan okunuyor.
  useEffect(() => {
    sessionStorage.setItem('motorcum_aktif_sayfa', activePage)
  }, [activePage])

  // Dashboard içindeki sayfa geçişleri (Müşteriler → İş Emirleri gibi) tarayıcı
  // geçmişine hiç yansımıyordu — bu yüzden geri tuşu doğrudan login'e (uygulamadan
  // dışarı) atıyordu. Her sayfa değişiminde tarayıcı geçmişine bir kayıt ekleyip,
  // geri/ileri tuşlarını dinleyerek dashboard İÇİNDE bir önceki sayfaya dönmesini
  // sağlıyoruz. URL hep "/dashboard" kalır, sadece geçmiş state'i kullanılır.
  useEffect(() => {
    if (!window.history.state?.page) {
      window.history.replaceState({ page: activePage }, '')
    }
    const handlePopState = (e) => {
      const sayfa = e.state?.page || sessionStorage.getItem('motorcum_aktif_sayfa') || 'genel'
      setActivePage(sayfa)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSignOut = async () => {
    sessionStorage.removeItem('motorcum_aktif_sayfa')
    await signOut()
    navigate('/login', { replace: true })
  }

  // Admin koruma: yönetici paneline sadece admin erişebilir
  const ustaPlusMi = ['admin', 'usta', 'yönetici'].includes(profile?.rol)
  const adminMi = ['admin', 'yönetici'].includes(profile?.rol)

  const handleSetActivePage = (page) => {
    if (page === 'yonetici-paneli' && !isAdmin) return
    if (page === activePage) return
    window.history.pushState({ page }, '')
    setActivePage(page)
  }

  const renderPage = () => {
    switch (activePage) {
      case 'genel':           return <GenelBakis onIsEmriAc={(is) => { setAcikIsEmri(is); handleSetActivePage('is-emirleri') }} onPlakaSorgulaAc={adminMi ? () => setPlakaSorgulaAcik(true) : null} plakaSorgulaGorunur={adminMi} />
      case 'musteriler':      return <Musteriler onIsEmriAc={(is) => { setAcikIsEmri(is); handleSetActivePage('is-emirleri') }} />
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
            {adminMi && (
              <button
                onClick={() => setPlakaSorgulaAcik(true)}
                title="Plaka Sorgula"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  background: 'rgba(229,72,77,.1)', border: '1px solid rgba(229,72,77,.3)',
                  borderRadius: 20, padding: '6px 12px', color: '#e5484d', fontSize: 13, fontWeight: 600,
                }}
              >
                📷 <span className="desktop-only">Plaka Sorgula</span>
              </button>
            )}
            <div className="desktop-only"><MotorSaat /></div>
            <ThemeToggle />
          </div>
        </div>
        {adminMi && (
          <PlakaSorgula acik={plakaSorgulaAcik} onKapat={() => setPlakaSorgulaAcik(false)} onIsEmriAc={(is) => { setAcikIsEmri(is); handleSetActivePage('is-emirleri') }} />
        )}
        {isMobilCihaz() && bildirimIzinDurumu !== 'granted' && (
          <div style={{
            margin: '12px 14px 0 14px',
            background: 'linear-gradient(135deg, rgba(229,72,77,0.18), rgba(229,72,77,0.06))',
            border: '1px solid rgba(229,72,77,0.35)',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #fff)' }}>Kilit Ekranı Bildirimlerini Aç</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #aaa)', lineHeight: 1.3 }}>
                  İş emirlerini kilit ekranında görebilmek için izin verin.
                </div>
              </div>
            </div>
            <button
              onClick={mobilBildirimIzinVer}
              style={{
                background: '#e5484d',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              İzin Ver
            </button>
          </div>
        )}
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
