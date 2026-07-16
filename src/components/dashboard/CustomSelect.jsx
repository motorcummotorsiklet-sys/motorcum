import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Native <select> yerine kullanılır — açık/koyu modda garantili okunaklı,
// tarayıcı/işletim sistemi native popup rengine bağımlı değil.
// Açılan liste Portal ile document.body'ye render edilir — bu sayede
// modal'ın overflow:hidden/auto ayarından etkilenmez, asla kırpılmaz/taşmaz.
// options: ['A','B'] gibi string dizisi ya da [{value,label}] formatında olabilir.
const CustomSelect = ({ value, onChange, options, placeholder = 'Seçin', disabled = false, style = {} }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef(null)
  const listRef = useRef(null)

  const updatePos = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const maxListHeight = 220
    const asagiBosluk = window.innerHeight - r.bottom
    const yukariAcilsin = asagiBosluk < maxListHeight && r.top > maxListHeight
    setPos({
      top: yukariAcilsin ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      acilisYonu: yukariAcilsin ? 'up' : 'down',
    })
  }

  useEffect(() => { if (open) updatePos() }, [open])

  useEffect(() => {
    const disariTikla = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return
      if (listRef.current && listRef.current.contains(e.target)) return
      setOpen(false)
    }
    const yenidenKonumla = () => { if (open) updatePos() }
    document.addEventListener('pointerdown', disariTikla)
    window.addEventListener('resize', yenidenKonumla)
    window.addEventListener('scroll', yenidenKonumla, true)
    return () => {
      document.removeEventListener('pointerdown', disariTikla)
      window.removeEventListener('resize', yenidenKonumla)
      window.removeEventListener('scroll', yenidenKonumla, true)
    }
  }, [open])

  const norm = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const secili = norm.find(o => o.value === value)

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--input-bg)', border: `1px solid ${open ? '#e63030' : 'var(--border)'}`,
          borderRadius: '6px', padding: '7px 10px',
          color: secili ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '12px', fontFamily: 'Inter, sans-serif',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secili ? secili.label : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginLeft: '6px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'fixed',
            top: pos.acilisYonu === 'up' ? undefined : pos.top,
            bottom: pos.acilisYonu === 'up' ? (window.innerHeight - pos.top) : undefined,
            left: pos.left,
            width: pos.width,
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px',
            zIndex: 99999, maxHeight: '220px', overflowY: 'auto', boxShadow: 'var(--shadow)',
            fontFamily: 'Inter, sans-serif', fontStyle: 'normal',
          }}
        >
          {norm.map(o => (
            <div
              key={o.value}
              onPointerDown={e => { e.preventDefault(); onChange(o.value); setOpen(false) }}
              style={{
                padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontStyle: 'normal',
                color: value === o.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: value === o.value ? 'rgba(230,48,48,0.15)' : 'transparent',
                fontWeight: value === o.value ? 600 : 400,
              }}
              onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.background = value === o.value ? 'rgba(230,48,48,0.15)' : 'transparent' }}
            >
              {o.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export default CustomSelect
