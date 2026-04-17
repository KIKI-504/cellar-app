'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const LOCAL_PIN = '2222'

function isMagnum(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  return s === '150' || s === '150cl' || s === '1500' || s.includes('magnum')
}

function dutyForSize(size) { return isMagnum(size) ? 6 : 3 }

export default function LocalPage() {
  const [stage, setStage] = useState('pin')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(false)
  const [wishlist, setWishlist] = useState({})
  const [search, setSearch] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [expandedNote, setExpandedNote] = useState(null)

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
      if (prev[id]) { const next = { ...prev }; delete next[id]; return next }
      return { ...prev, [id]: qty }
    })
  }

  function setWishlistQty(id, qty) {
    setWishlist(prev => ({ ...prev, [id]: qty }))
  }

  function getWineName(s) { return s.wines?.description || s.unlinked_description || 'Unknown wine' }
  function getWineVintage(s) { return s.wines?.vintage || s.unlinked_vintage || '' }
  function getWineRegion(s) { return s.wines?.region || '' }
  function getWineColour(s) { return s.wines?.colour || '' }
  function getPrice(s) {
    const p = s.sale_price ?? s.dp_price
    return p ? parseFloat(p) : null
  }

  function sendWishlist() {
    const items = Object.entries(wishlist).map(([id, qty]) => {
      const s = wines.find(w => w.id === id)
      if (!s) return null
      const price = getPrice(s)
      return `${qty} x ${getWineName(s)} ${getWineVintage(s)} — ${price ? `£${price.toFixed(2)}/bottle` : 'POA'}`
    }).filter(Boolean)
    if (!items.length) return
    const text = [
      `Bottles on Hand Wishlist — ${buyerName}`,
      new Date().toLocaleDateString('en-GB'), '',
      ...items, '',
      `Total bottles: ${Object.values(wishlist).reduce((a, b) => a + b, 0)}`
    ].join('\n')
    const subject = encodeURIComponent(`Wishlist — ${buyerName} — ${new Date().toLocaleDateString('en-GB')}`)
    const body = encodeURIComponent(text)
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${subject}&body=${body}`
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
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em', marginBottom: '8px' }}>Bottles on Hand</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.4)', marginBottom: '40px' }}>Ready to collect</div>
        <input
          type="password" value={pinInput}
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
          type="text" value={buyerName}
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
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: wishlistCount > 0 ? '80px' : '40px' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em' }}>Bottles on Hand</div>
        <button onClick={() => setStage('pin')} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      {/* Hero greeting */}
      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(107,30,46,0.4) 0%, transparent 60%)', color: 'var(--white)', padding: '32px 24px 28px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '42px', fontWeight: 300, letterSpacing: '0.04em', color: '#d4ad45', marginBottom: '4px' }}>Cheers, {buyerName}!</div>
        <div style={{ fontSize: '11px', color: 'rgba(253,250,245,0.5)', letterSpacing: '0.1em' }}>Available for immediate collection — heart wines to build your wishlist</div>
      </div>

      <div style={{ padding: '24px' }}>

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

        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', fontFamily: 'DM Mono, monospace' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} available
        </div>

        {/* Wine list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)' }}>No wines available right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
            {filtered.map(s => {
              const inWishlist = !!wishlist[s.id]
              const colour = getWineColour(s)
              const dotColor = colour?.toLowerCase().includes('red') ? '#8b2535' : colour?.toLowerCase().includes('white') ? '#c4a84f' : colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const price = getPrice(s)
              const buyerNote = s.wines?.buyer_note || ''
              const isNoteOpen = expandedNote === s.id

              // WS comparison
              const ws = s.wines?.ws_lowest_per_bottle ? parseFloat(s.wines.ws_lowest_per_bottle) : null
              const duty = dutyForSize(s.bottle_size)
              const wsDP = ws ? (ws + duty) * 1.2 : null
              const isBelowWs = price && wsDP ? price <= wsDP * 1.10 : false
              const saving = isBelowWs ? (wsDP - price).toFixed(2) : null

              // Bottle size label
              const sizeLabel = isMagnum(s.bottle_size) ? '150cl' : s.bottle_size === '37.5' ? '37.5cl' : s.bottle_size === '300' ? '300cl' : '75cl'

              return (
                <div key={s.id} style={{ background: 'var(--white)', borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>

                    {/* Wine info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', lineHeight: 1.3, color: 'var(--ink)' }}>{getWineName(s)}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '13px' }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--wine)', marginRight: '6px' }}>{getWineVintage(s)}</span>
                        {getWineRegion(s)}
                        <span style={{ marginLeft: '8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--ink)' }}>{sizeLabel}</span>
                      </div>
                      {buyerNote && (
                        <button onClick={() => setExpandedNote(isNoteOpen ? null : s.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', padding: '4px 0 0 13px', textTransform: 'uppercase' }}>
                          {isNoteOpen ? '▲ hide' : '▼ notes'}
                        </button>
                      )}
                    </div>

                    {/* Price + wishlist */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500, color: 'var(--ink)' }}>
                          {price ? `£${price.toFixed(2)}` : 'POA'}
                        </div>
                        {isBelowWs && (
                          <div style={{ fontSize: '9px', color: '#2a7a4b', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>
                            Lower than WS avg · −£{saving}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{s.quantity} avail</div>
                      </div>

                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input type="number" min="1" max={s.quantity} value={wishlist[s.id]}
                            onChange={e => setWishlistQty(s.id, Math.min(parseInt(e.target.value) || 1, s.quantity))}
                            style={{ width: '44px', border: '1px solid var(--wine)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', textAlign: 'center' }} />
                          <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>❤️</button>
                        </div>
                      ) : (
                        <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>🤍</button>
                      )}
                    </div>
                  </div>

                  {/* Expanded notes */}
                  {isNoteOpen && buyerNote && (
                    <div style={{ padding: '0 16px 14px 29px', background: 'var(--cream)', borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6 }}>
                        {buyerNote}
                      </div>
                    </div>
                  )}
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
          <button onClick={sendWishlist} style={{ background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>Send Wishlist</button>
        </div>
      )}
    </div>
  )
}
