import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  IconDashboard, IconUsers, IconTool, IconUser,
  IconSettings, IconChart, IconLogout, IconMenu
} from '../Icons'

// Admin ikonu
const IconShield = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

// Bildirim (zil) ikonu
const IconBell = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

// Çarşaf/detay rapor ikonu
const IconTable = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
)

// Bayi/dükkan (cari hesap) ikonu
const IconStore = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l1.5-5h15L21 9"/>
    <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/>
    <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>
    <path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20"/>
  </svg>
)

// Araç alım-satım (el değiştirme) ikonu
const IconSwap = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 22l-4-4 4-4"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)

const NAV = [
  {
    section: 'Genel',
    items: [{ id: 'genel', Icon: IconDashboard, label: 'Genel Bakış' }]
  },
  {
    section: 'Yönetim',
    items: [
      { id: 'musteriler',  Icon: IconUsers,    label: 'Müşteriler' },
      { id: 'is-emirleri', Icon: IconTool,     label: 'İş Emirleri' },
      { id: 'personel',    Icon: IconUser,     label: 'Personel' },
      { id: 'bayi-hesaplari', Icon: IconStore, label: 'Bayi Hesapları', adminSiniri: true },
      { id: 'arac-ticaret',   Icon: IconSwap,  label: 'Araç Alım-Satım', adminSiniri: true },
    ]
  },
  {
    section: 'Sistem',
    items: [
      { id: 'tanimlamalar', Icon: IconSettings, label: 'Tanımlamalar' },
      { id: 'bildirimler',  Icon: IconBell,      label: 'Bildirimler', ustaPlusSiniri: true },
    ]
  },
  {
    section: 'Analiz',
    items: [
      { id: 'raporlar',     Icon: IconChart, label: 'Özet Rapor', ustaPlusSiniri: true },
      { id: 'detay-rapor',  Icon: IconTable, label: 'Detay Rapor', ustaPlusSiniri: true },
    ]
  }
]

const ADMIN_NAV = {
  section: 'Admin',
  items: [
    { id: 'yonetici-paneli', Icon: IconShield, label: 'Yönetici Paneli', adminOnly: true }
  ]
}

const Sidebar = ({ activePage, setActivePage, profile, mobileOpen, setMobileOpen }) => {
  const { signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [cikisOnay, setCikisOnay] = useState(false)

  const handleSignOut = async () => {
    if (!cikisOnay) { setCikisOnay(true); return }
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials = profile
    ? `${(profile.ad || '')[0] || ''}${(profile.soyad || '')[0] || ''}`.toUpperCase()
    : '?'

  const ustaPlusMi = ['admin', 'usta', 'yönetici'].includes(profile?.rol)
  const adminMi = ['admin', 'yönetici'].includes(profile?.rol)
  const navGruplari = [
    ...NAV.map(g => ({
      ...g,
      items: g.items.filter(item => (!item.ustaPlusSiniri || ustaPlusMi) && (!item.adminSiniri || adminMi))
    })),
    ...(isAdmin ? [ADMIN_NAV] : [])
  ].filter(g => g.items.length > 0)

  return (
    <>
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:99 }} />
      )}

      <div className={`sidebar${mobileOpen ? ' sidebar-mobil-acik' : ''}`}>
        <div className="sidebar-brand" onClick={() => { setActivePage('genel'); setMobileOpen(false) }}
          style={{ cursor: 'pointer' }}>
          <img
            src="/logo.png"
            alt="Motorcum"
            style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'contain' }}
            onError={e => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
          <div className="sidebar-logo" style={{ display: 'none' }}>
            <IconTool size={17} color="#fff" />
          </div>
          <span>MOTORCUM</span>
        </div>

        <nav className="sidebar-nav">
          {navGruplari.map(group => (
            <div key={group.section} className="nav-section">
              <div className="nav-section-title" style={group.section === 'Admin' ? { color: '#e5484d' } : {}}>
                {group.section === 'Admin' ? '🔒 ' : ''}{group.section}
              </div>
              {group.items.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  className={`nav-item ${activePage === id ? 'active' : ''}`}
                  onClick={() => { setActivePage(id); setMobileOpen(false) }}
                  style={id === 'yonetici-paneli' ? {
                    background: activePage === id ? 'rgba(229,72,77,0.15)' : 'transparent',
                  } : {}}
                >
                  <Icon size={15} color={activePage === id ? '#e5484d' : id === 'yonetici-paneli' ? '#e5484d80' : '#4a5068'} />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{profile ? `${profile.ad} ${profile.soyad}` : 'Kullanıcı'}</div>
              <div className="user-email">
                {profile?.kullanici_adi || 'kullanici'}
                {isAdmin && <span style={{ marginLeft: '4px', color: '#e5484d', fontSize: '9px', fontWeight: 700 }}>ADMIN</span>}
              </div>
            </div>
          </div>
          {cikisOnay ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="signout-btn" onClick={handleSignOut} style={{ flex: 1, background: 'rgba(229,72,77,.15)', color: '#e5484d', fontWeight: 700 }}>
                Emin misin?
              </button>
              <button className="signout-btn" onClick={() => setCikisOnay(false)} style={{ flex: 0 }}>
                ✕
              </button>
            </div>
          ) : (
            <button className="signout-btn" onClick={handleSignOut}>
              <IconLogout size={13} color="currentColor" />
              Çıkış Yap
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default Sidebar
