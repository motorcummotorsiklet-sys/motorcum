import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { IconUsers, IconMotorbike, IconTool, IconLira, IconTrendUp } from '../../components/Icons'

const GenelBakis = ({ onIsEmriAc, onPlakaSorgulaAc, plakaSorgulaGorunur }) => {
  const { profile } = useAuth()
  const gizliRoller = ['teknisyen', 'kullanici']
  const rakamGizli = gizliRoller.includes(profile?.rol) || profile?.rol === 'admin'
  const [stats, setStats] = useState({
    toplamMusteri: 0, toplamArac: 0, aktifIsEmri: 0,
    bekleyenIsler: 0, bugunCiro: 0, bugunTamamlanan: 0,
  })
  const [sonIsler, setSonIsler] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile) fetchStats() }, [profile])

  const fetchStats = async () => {
    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)

    const sinirli = ['teknisyen', 'kullanici'].includes(profile?.rol)
    let personelId = null

    if (sinirli && profile?.email) {
      const { data: pData } = await supabase
        .from('personel').select('id').eq('email', profile.email).maybeSingle()
      personelId = pData?.id || null
    }

    let isQuery = supabase
      .from('is_emirleri')
      .select('id, durum, toplam_tutar, created_at, is_emri_no, musteri_id, arac_id, musteriler(ad,soyad), araclar(plaka,marka,model), personel(ad,soyad)')
      .order('created_at', { ascending: false }).limit(10)

    if (sinirli && personelId) isQuery = isQuery.eq('personel_id', personelId)
    else if (sinirli && !personelId) isQuery = isQuery.eq('personel_id', 'none')

    const [musteriler, araclar, isEmirleri, bugunTamamlanan] = await Promise.all([
      supabase.from('musteriler').select('id', { count: 'exact', head: true }),
      supabase.from('araclar').select('id', { count: 'exact', head: true }),
      isQuery,
      supabase.from('is_emirleri').select('id, toplam_tutar').in('durum', ['tamamlandi','teslim_edildi']).gte('updated_at', bugun.toISOString()),
    ])

    const tumIsler = isEmirleri.data || []
    const aktif = tumIsler.filter(i => ['bekliyor', 'devam_ediyor'].includes(i.durum)).length
    const bekleyen = tumIsler.filter(i => i.durum === 'bekliyor').length
    const bugunCiro = (bugunTamamlanan.data || []).reduce((s, i) => s + (i.toplam_tutar || 0), 0)

    setStats({
      toplamMusteri: musteriler.count || 0,
      toplamArac: araclar.count || 0,
      aktifIsEmri: aktif,
      bekleyenIsler: bekleyen,
      bugunCiro,
      bugunTamamlanan: bugunTamamlanan.data?.length || 0,
    })

    setSonIsler(tumIsler)
    setLoading(false)
  }

  const durumBadge = (durum) => {
    const map = {
      bekliyor: ['badge-bekliyor', 'Bekliyor'],
      devam_ediyor: ['badge-devam', 'Devam Ediyor'],
      tamamlandi: ['badge-tamamlandi', 'Tamamlandı'],
      teslim_edildi: ['badge-teslim', 'Teslim Edildi'],
      iptal: ['badge-iptal', 'İptal'],
    }
    const [cls, label] = map[durum] || ['badge-normal', durum]
    return <span className={`badge ${cls}`}>{label}</span>
  }

  if (loading) return <div className="empty-state"><p>Yükleniyor...</p></div>

  return (
    <div>
      {plakaSorgulaGorunur && (
        <div
          onClick={() => onPlakaSorgulaAc && onPlakaSorgulaAc()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            background: 'linear-gradient(135deg, rgba(229,72,77,.12), rgba(229,72,77,.04))',
            border: '1.5px solid rgba(229,72,77,.3)', borderRadius: 14,
            padding: '16px 20px', marginBottom: 20, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 30 }}>📷</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Plaka Sorgula</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Plakayı fotoğrafla, servis geçmişi anında gelsin</div>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Tara →</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Toplam Müşteri</span>
            <div className="stat-icon" style={{background:'rgba(229,72,77,.08)'}}><IconUsers size={15} color="#e5484d" /></div>
          </div>
          <div className="stat-value">{rakamGizli ? "***" : stats.toplamMusteri}</div>
          <div className="stat-sub">kayıtlı</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Kayıtlı Araç</span>
            <div className="stat-icon" style={{background:'rgba(59,130,246,.08)'}}><IconMotorbike size={15} color="#3b82f6" /></div>
          </div>
          <div className="stat-value">{rakamGizli ? "***" : stats.toplamArac}</div>
          <div className="stat-sub">araç</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Aktif İş Emri</span>
            <div className="stat-icon" style={{background:'rgba(245,166,35,.08)'}}><IconTool size={15} color="#f5a623" /></div>
          </div>
          <div className="stat-value" style={{color:'#f5a623'}}>{rakamGizli ? "***" : stats.aktifIsEmri}</div>
          <div className="stat-sub">{rakamGizli ? "---" : `${stats.bekleyenIsler} bekliyor`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Bugün Ciro</span>
            <div className="stat-icon" style={{background:'rgba(34,197,94,.08)'}}><IconLira size={15} color="#22c55e" /></div>
          </div>
          <div className="stat-value" style={{color:'#22c55e', fontSize:'1.3rem'}}>{rakamGizli ? "₺ ***" : `₺${stats.bugunCiro.toLocaleString('tr-TR')}`}</div>
          <div className="stat-sub up"><IconTrendUp size={10} color="#22c55e" />{rakamGizli ? "---" : `${stats.bugunTamamlanan} iş tamamlandı`}</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <span className="table-title">Son İş Emirleri <span style={{fontSize:'0.8rem',color:'var(--text-muted)',fontWeight:400}}>(Son 10)</span></span>
        </div>
        {sonIsler.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔧</div>
            <p>Henüz iş emri yok</p>
          </div>
        ) : (
          <>
            {/* Masaüstü */}
            <div className="desktop-only" style={{overflowX:'auto'}}>
              <table>
                <thead>
                  <tr>
                    <th>İş No</th>
                    <th>Müşteri</th>
                    <th>Araç</th>
                    <th>Teknisyen</th>
                    <th>Durum</th>
                    <th>Tutar</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {sonIsler.map(is => (
                    <tr key={is.id} style={{cursor:'pointer'}}
                      onClick={() => onIsEmriAc && onIsEmriAc(is)}>
                      <td style={{fontWeight:700, color:'var(--text-primary)'}}>#{is.is_emri_no}</td>
                      <td style={{color:'var(--text-primary)'}}>{is.musteriler?.ad} {is.musteriler?.soyad}</td>
                      <td>
                        <span style={{fontWeight:600, color:'#e5484d'}}>{is.araclar?.plaka}</span>
                        <span style={{color:'var(--text-muted)', fontSize:'0.78rem', marginLeft:4}}>{is.araclar?.marka}</span>
                      </td>
                      <td style={{color:'var(--text-secondary)'}}>{is.personel ? `${is.personel.ad} ${is.personel.soyad}` : '-'}</td>
                      <td>{durumBadge(is.durum)}</td>
                      <td style={{color:'#22c55e', fontWeight:600}}>{rakamGizli ? '***' : '₺' + (is.toplam_tutar || 0).toLocaleString('tr-TR')}</td>
                      <td style={{color:'var(--text-muted)'}}>{new Date(is.created_at).toLocaleDateString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil */}
            <div className="mobile-only" style={{padding:'8px'}}>
              {sonIsler.map(is => (
                <div key={is.id} onClick={() => onIsEmriAc && onIsEmriAc(is)}
                  style={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px',marginBottom:'8px',cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      <span style={{fontWeight:700,color:'var(--text-primary)',fontSize:'13px'}}>#{is.is_emri_no}</span>
                      {durumBadge(is.durum)}
                    </div>
                    <span style={{color:'#22c55e',fontWeight:700,fontSize:'14px'}}>₺{(is.toplam_tutar||0).toLocaleString('tr-TR')}</span>
                  </div>
                  <div style={{color:'var(--text-primary)',fontSize:'13px',fontWeight:500}}>{is.musteriler?.ad} {is.musteriler?.soyad}</div>
                  <div style={{color:'#e5484d',fontSize:'12px',fontWeight:600,marginTop:'4px'}}>
                    {is.araclar?.plaka} <span style={{color:'var(--text-muted)',fontWeight:400}}>{is.araclar?.marka}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default GenelBakis
