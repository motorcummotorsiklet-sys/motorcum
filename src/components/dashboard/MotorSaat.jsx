import { useState, useEffect } from 'react'

const MotorSaat = () => {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const saat = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const tarih = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', weekday: 'long' })

  // Saniye ibresi açısı (0-360)
  const saniyeAcisi = now.getSeconds() * 6

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '6px 14px 6px 10px',
    }}>
      {/* Mini gösterge / hız göstergesi görünümü */}
      <div style={{ position: 'relative', width: '30px', height: '30px', flexShrink: 0 }}>
        <svg width="30" height="30" viewBox="0 0 30 30">
          {/* Dış çember - gösterge paneli */}
          <circle cx="15" cy="15" r="13" fill="none" stroke="var(--border)" strokeWidth="2" />
          {/* Kademeli çizgiler */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30) * (Math.PI / 180)
            const x1 = 15 + 10 * Math.sin(angle)
            const y1 = 15 - 10 * Math.cos(angle)
            const x2 = 15 + 12 * Math.sin(angle)
            const y2 = 15 - 12 * Math.cos(angle)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5484d" strokeWidth="1" opacity="0.5" />
          })}
          {/* Dönen ibre - saniyeye göre */}
          <line
            x1="15" y1="15"
            x2={15 + 9 * Math.sin(saniyeAcisi * Math.PI / 180)}
            y2={15 - 9 * Math.cos(saniyeAcisi * Math.PI / 180)}
            stroke="#e5484d"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ transition: 'all 0.9s cubic-bezier(0.4, 2.3, 0.6, 1)' }}
          />
          {/* Merkez nokta */}
          <circle cx="15" cy="15" r="1.8" fill="#e5484d" />
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {saat}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
          {tarih}
        </span>
      </div>
    </div>
  )
}

export default MotorSaat
