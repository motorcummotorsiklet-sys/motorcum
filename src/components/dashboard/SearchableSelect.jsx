import { useState, useEffect, useRef } from 'react'

const SearchableSelect = ({ value, onChange, options, placeholder, onEkle, ekleLabel }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [ekleniyor, setEkleniyor] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  const selectOption = (opt) => {
    onChange(opt)
    setQuery(opt)
    setOpen(false)
  }

  const handleEkle = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!query.trim() || !onEkle) return
    setEkleniyor(true)
    await onEkle(query.trim().toUpperCase())
    setEkleniyor(false)
    setOpen(false)
  }

  const yaziListede = options.some(o => o.toLowerCase() === query.toLowerCase())
  const ekleGoster = onEkle && query.trim() && !yaziListede

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          background: 'var(--bg-base)', border: `1px solid ${open ? '#e63030' : 'var(--border)'}`,
          borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text-primary)',
          fontSize: '0.88rem', fontFamily: 'Inter, sans-serif', outline: 'none',
          width: '100%', transition: 'border-color 0.2s',
          boxShadow: open ? '0 0 0 3px rgba(230,48,48,0.12)' : 'none',
        }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px',
          zIndex: 99999, maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          {filtered.length === 0 && !ekleGoster && (
            <div style={{ padding: '0.65rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sonuç bulunamadı
            </div>
          )}
          {filtered.map(opt => (
            <div key={opt}
              onPointerDown={e => { e.preventDefault(); e.stopPropagation(); selectOption(opt) }}
              style={{
                padding: '0.65rem 0.9rem', color: value === opt ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none',
                background: value === opt ? 'rgba(230,48,48,0.15)' : 'transparent',
              }}
              onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = 'rgba(128,128,128,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = value === opt ? 'rgba(230,48,48,0.15)' : 'transparent' }}
            >
              {opt}
            </div>
          ))}
          {ekleGoster && (
            <div
              onPointerDown={handleEkle}
              style={{
                padding: '0.65rem 0.9rem',
                color: '#22c55e',
                fontSize: '0.85rem',
                cursor: ekleniyor ? 'wait' : 'pointer',
                userSelect: 'none',
                borderTop: filtered.length > 0 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontWeight: 500,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {ekleniyor ? '⏳' : '+'} {ekleLabel || 'Ekle'}: <strong>{query.trim().toUpperCase()}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
