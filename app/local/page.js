'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const LOCAL_PIN = '2222'

export default function LocalPage() {
  const [stage, setStage] = useState('pin') // pin | name | browse
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(false)
  const [wishlist, setWishlist] = useState({})
  const [search, setSearch] = useState('')
  const [filterColour, setFilterColour] = useState('')

  function handlePin() {
    if (pinInput === LOCAL_PIN) {
      setPinError(false)
      setStage('name')
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  async function handleName() {
    if (!buyerName.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('studio')
      .select('*, wines(*)')
      .eq('include_in_local', true)
      .eq('status', 'Available')
      .order('created_at', { ascending: false })
    setWines(data || [])
    setLoading(false)
    setStage('browse')
  }

  function toggleWishlist(id, qty) {
    setWishlist(prev => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: qty }
    })
  }

  function setWishlistQty(id, qty) {
    setWishlist(prev => ({ ...prev, [id]: qty }))
  }

  // Helper: get display name for a studio entry
  function getWineName(s) {
    return s.wines?.description || s.unlinked_description || 'Unknown wine'
  }

  // Helper: get display vintage
  function getWineVintage(s) {
    return s.wines?.vintage || s.unlinked_vintage || ''
  }

  // Helper: get display region
  function getWineRegion(s) {
    return s.wines?.region || ''
  }

  // Helper: get display colour
  function getWineColour(s) {
    return s.wines?.colour || ''
  }

  // Helper: get display price — sale_price first, then dp_price, then null
  function getPrice(s) {
    const p = s.sale_price ?? s.dp_price
    return p ? parseFloat(p) : null
  }

  function downloadWishlist() {
    const items = Object.entries(wishlist).map(([id, qty]) => {
      const s = wines.find(w => w.id === id)
      if (!s) return null
      const price = getPrice(s)
      return `${qty} x ${getWineName(s)} ${getWineVintage(s)} — ${price ? `£${price.toFixed(2)}/bottle` : 'POA'}`
    }).filter(Boolean)
    if (!items.length) return
    const text = [
      `Local Sales Wishlist — ${buyerName}`,
      `${new Date().toLocaleDateString('en-GB')}`,
      '',
      ...items,
      '',
      `Total bottles: ${Object.values(wishlist).reduce((a, b) => a + b, 0)}`
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `local-wishlist-${buyerName.replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = wines.filter(s => {
    if (filterColour && getWineColour(s)?.toLowerCase() !== filterColour.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      return [getWineName(s), getWineVintage(s), getWineRegion(s)].join(' ').toLowerCase().includes(q)
    }
    return true
  })

  const wishlistCount = Object.keys(wishlist).length

  // PIN screen
  if (stage === 'pin') return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em', marginBottom: '8px' }}>Local Sales</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.4)', marginBottom: '40px' }}>Ready to collect</div>
        <input
          type="password"
          value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && handlePin()}
          placeholder="Enter PIN"
          style={{ width: '100%', background: 'rgba(253,250,245,0.07)', border: pinError ? '1px solid #c0392b' : '1px solid rgba(253,250,245,0.15)', color: 'var(--white)', padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: '16px', outline: 'none', textAlign: 'center', letterSpacing: '0.3em', boxSizing: 'border-box', marginBottom: '12px' }}
        />
        {pinError && <div style={{ fontSize: '11px', color: '#c0392b', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>Incorrect PIN</div>}
        <button onClick={handlePin} style={{ width: '100%', background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>Enter</button>
      </div>
    </div>
  )

  // Name screen
  if (stage === 'name') return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em', marginBottom: '8px' }}>Welcome</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.4)', marginBottom: '40px' }}>What's your name?</div>
        <input
          type="text"
          value={buyerName}
          onChange={e => setBuyerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleName()}
          placeholder="Your name"
          style={{ width: '100%', background: 'rgba(253,250,245,0.07)', border: '1px solid rgba(253,250,245,0.15)', color: 'var(--white)', padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: '12px' }}
        />
        <button onClick={handleName} style={{ width: '100%', background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>Browse Wines</button>
      </div>
    </div>
  )

  // Browse screen
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Header */}
      <div style={{ background: 'var(--ink)', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em' }}>Local Sales</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(253,250,245,0.5)', letterSpacing: '0.1em' }}>{buyerName}</div>
      </div>

      <div style={{ padding: '24px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 300 }}>Available Now</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Ready to collect · {wines.length} wines</div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ flex: 1, minWidth: '160px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
        </div>

        {/* Wine cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)' }}>No wines available right now.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {filtered.map(s => {
              const w = s.wines
              const inWishlist = !!wishlist[s.id]
              const colour = getWineColour(s)
              const dotColor = colour?.toLowerCase().includes('red') ? '#8b2535' : colour?.toLowerCase().includes('white') ? '#c4a84f' : colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const price = getPrice(s)
              const isUnlinked = !s.wine_id
              return (
                <div key={s.id} style={{ background: 'var(--white)', border: inWishlist ? '1px solid var(--wine)' : '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', lineHeight: 1.3 }}>{getWineName(s)}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '16px' }}>
                      {getWineVintage(s)}{getWineVintage(s) && getWineRegion(s) ? ' · ' : ''}{getWineRegion(s)}
                      {w?.bottle_format === 'Magnum' || s.bottle_size === '150' ? <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(107,30,46,0.1)', color: 'var(--wine)', padding: '1px 5px' }}>Magnum</span> : null}
                      {s.bottle_size === '37.5' ? <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(107,30,46,0.1)', color: 'var(--wine)', padding: '1px 5px' }}>Half</span> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 500 }}>
                        {price ? `£${price.toFixed(2)}` : 'POA'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{s.quantity} available</div>
                    </div>
                    {inWishlist ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="number" min="1" max={s.quantity} value={wishlist[s.id]}
                          onChange={e => setWishlistQty(s.id, Math.min(parseInt(e.target.value) || 1, s.quantity))}
                          style={{ width: '48px', border: '1px solid var(--wine)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', textAlign: 'center' }} />
                        <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♥</button>
                      </div>
                    ) : (
                      <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: 'none', border: '1px solid var(--border)', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♡</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Wishlist bar */}
      {wishlistCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--white)' }}>
            {wishlistCount} wine{wishlistCount > 1 ? 's' : ''} · {Object.values(wishlist).reduce((a, b) => a + b, 0)} bottles
          </div>
          <button onClick={downloadWishlist} style={{ background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>↓ Save Wishlist</button>
        </div>
      )}
    </div>
  )
}
