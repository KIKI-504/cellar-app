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
            {/* Table header — mirrors Buyer View */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 100px 80px 40px', gap: '0', background: 'var(--ink)', color: 'rgba(253,250,245,0.5)', padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <div>Wine</div>
              <div>Size</div>
              <div style={{ textAlign: 'center' }}>Qty</div>
              <div style={{ textAlign: 'right' }}>Price / btl</div>
              <div style={{ textAlign: 'right' }}>WS Avg</div>
              <div></div>
            </div>

            {filtered.map(s => {
              const inWishlist = !!wishlist[s.id]
              const colour = getWineColour(s)
              const dotColor = colour?.toLowerCase().includes('red') ? '#8b2535' : colour?.toLowerCase().includes('white') ? '#c4a84f' : colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const price = getPrice(s)
              const buyerNote = s.wines?.buyer_note || ''
              const restaurantSpot = s.wines?.restaurant_spot || ''
              const isNoteOpen = expandedNote === s.id
              const sizeLabel = isMagnum(s.bottle_size) ? '150cl' : s.bottle_size === '37.5' ? '37.5cl' : s.bottle_size === '300' ? '300cl' : '75cl'
              const isMag = isMagnum(s.bottle_size)

              // WS comparison
              const ws = s.wines?.ws_lowest_per_bottle ? parseFloat(s.wines.ws_lowest_per_bottle) : null
              const wsDate = s.wines?.ws_price_date || null
              const duty = dutyForSize(s.bottle_size)
              const wsDp = ws ? (ws + duty) * 1.2 : null
              const isBelowWs = price && wsDp ? price < wsDp : false
              const saving = isBelowWs ? (wsDp - price).toFixed(2) : null

              return (
                <div key={s.id} style={{ background: 'var(--white)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 100px 80px 40px', gap: '0', padding: '14px 16px', alignItems: 'center', borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent' }}>

                    {/* Wine name col */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', lineHeight: 1.3, color: 'var(--ink)', fontWeight: isMag ? 700 : 400 }}>{getWineName(s)}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '13px' }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--wine)', marginRight: '6px' }}>{getWineVintage(s)}</span>
                        {getWineRegion(s)}
                      </div>
                      {(buyerNote || restaurantSpot) && (
                        <button onClick={() => setExpandedNote(isNoteOpen ? null : s.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', padding: '4px 0 0 13px', textTransform: 'uppercase' }}>
                          {isNoteOpen ? '▲ hide' : '▼ notes'}
                        </button>
                      )}
                    </div>

                    {/* Size col */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink)', fontWeight: isMag ? 600 : 400 }}>{sizeLabel}</div>

                    {/* Qty col */}
                    <div style={{ textAlign: 'center' }}>
                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setWishlistQty(s.id, Math.max(1, (wishlist[s.id] || 1) - 1))}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>{wishlist[s.id]}</span>
                          <button onClick={() => setWishlistQty(s.id, Math.min(s.quantity, (wishlist[s.id] || 1) + 1))}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{s.quantity} avail</span>
                      )}
                    </div>

                    {/* Price col */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>
                        {price ? `£${price.toFixed(2)}` : 'POA'}
                      </div>
                      {isBelowWs && (
                        <div style={{ fontSize: '9px', color: '#2a7a4b', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>−£{saving} vs WS avg</div>
                      )}
                      {inWishlist && price && (
                        <div style={{ fontSize: '9px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>×{wishlist[s.id]} = £{(price * wishlist[s.id]).toFixed(2)}</div>
                      )}
                    </div>

                    {/* WS avg col */}
                    <div style={{ textAlign: 'right' }}>
                      {isBelowWs ? (
                        <div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#2a7a4b', fontWeight: 600, letterSpacing: '0.04em' }}>Lower Than WS</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>£{wsDp.toFixed(2)}</div>
                        </div>
                      ) : wsDp ? (
                        <div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>£{wsDp.toFixed(2)}</div>
                          {wsDate && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--border)' }}>{wsDate}</div>}
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--border)' }}>—</div>
                      )}
                    </div>

                    {/* Heart col */}
                    <div style={{ textAlign: 'right' }}>
                      <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>
                        {inWishlist ? '❤️' : '🤍'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded notes */}
                  {isNoteOpen && (buyerNote || restaurantSpot) && (
                    <div style={{ padding: '0 16px 14px 29px', background: 'var(--cream)', borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent' }}>
                      {buyerNote && (
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6, marginBottom: restaurantSpot ? '8px' : 0 }}>
                          {buyerNote}
                        </div>
                      )}
                      {restaurantSpot && (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8b2535', letterSpacing: '0.05em' }}>
                          Local List Pricing: {restaurantSpot}
                        </div>
                      )}
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
