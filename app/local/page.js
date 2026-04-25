'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const LOCAL_PIN = '2222'

function isMagnum(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  return s === '150' || s === '150cl' || s === '1500' || s === '1500ml' || s.includes('magnum')
}

function dutyForSize(size) { return isMagnum(size) ? 6 : 3 }

function bottleSortKey(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  if (s.includes('37.5') || s.includes('half')) return 37.5
  if (isMagnum(s)) return 150
  if (s.includes('300') || s.includes('double')) return 300
  return 75
}

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
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [tooltip, setTooltip] = useState(null) // { id, text, x, y }

  function handlePin() {
    if (pinInput === LOCAL_PIN) { setPinError(false); setStage('name') }
    else { setPinError(true); setPinInput('') }
  }

  async function handleName() {
    if (!buyerName.trim()) return
    setLoading(true)
    const { data } = await supabase.from('studio').select('*, wines(*)').eq('include_in_local', true).eq('status', 'Available').order('created_at', { ascending: false })
    setWines(data || []); setLoading(false); setStage('browse')
  }

  function toggleWishlist(id, qty) {
    setWishlist(prev => { if (prev[id]) { const next = { ...prev }; delete next[id]; return next } return { ...prev, [id]: qty } })
  }
  function setWishlistQty(id, qty) { setWishlist(prev => ({ ...prev, [id]: qty })) }

  function getWineName(s) { return s.wines?.description || s.unlinked_description || 'Unknown wine' }
  function getWineVintage(s) { return s.wines?.vintage || s.unlinked_vintage || '' }
  function getWineRegion(s) { return s.wines?.region || '' }
  function getWineCountry(s) { return s.wines?.country || '' }
  function getWineColour(s) { return s.wines?.colour || s.colour || '' }
  function getWomenNote(s) { return s.wines?.women_note || '' }
  function getPrice(s) { const p = s.sale_price ?? s.dp_price; return p ? parseFloat(p) : null }

  function cycleSort(field) {
    if (sortCol === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(field); setSortDir('asc') }
  }

  function SortArrow({ field }) {
    if (sortCol !== field) return <span style={{ opacity: 0.35, fontSize: '10px', marginLeft: '3px' }}>↕</span>
    return <span style={{ fontSize: '10px', marginLeft: '3px', color: '#d4ad45' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function sendWishlist() {
    const items = Object.entries(wishlist).map(([id, qty]) => {
      const s = wines.find(w => w.id === id); if (!s) return null
      const price = getPrice(s)
      return `${qty} x ${getWineName(s)} ${getWineVintage(s)} — ${price ? `£${price.toFixed(2)}/bottle` : 'POA'}`
    }).filter(Boolean)
    if (!items.length) return
    const text = [`Bottles on Hand Wishlist — ${buyerName}`, new Date().toLocaleDateString('en-GB'), '', ...items, '', `Total bottles: ${Object.values(wishlist).reduce((a, b) => a + b, 0)}`].join('\n')
    const subject = encodeURIComponent(`Wishlist — ${buyerName} — ${new Date().toLocaleDateString('en-GB')}`)
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${subject}&body=${encodeURIComponent(text)}`
  }

  const filtered = wines
    .filter(s => {
      if (filterColour && getWineColour(s)?.toLowerCase() !== filterColour.toLowerCase()) return false
      if (search) {
        const q = search.toLowerCase()
        return [getWineName(s), getWineVintage(s), getWineRegion(s), getWineCountry(s)].join(' ').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortCol === 'name') { av = getWineName(a).toLowerCase(); bv = getWineName(b).toLowerCase() }
      else if (sortCol === 'vintage') { av = getWineVintage(a); bv = getWineVintage(b) }
      else if (sortCol === 'colour') { av = getWineColour(a).toLowerCase(); bv = getWineColour(b).toLowerCase() }
      else if (sortCol === 'region') { av = getWineRegion(a).toLowerCase(); bv = getWineRegion(b).toLowerCase() }
      else if (sortCol === 'country') { av = getWineCountry(a).toLowerCase(); bv = getWineCountry(b).toLowerCase() }
      else if (sortCol === 'format') { av = bottleSortKey(a.bottle_size || a.wines?.bottle_volume); bv = bottleSortKey(b.bottle_size || b.wines?.bottle_volume) }
      else if (sortCol === 'quantity') { av = a.quantity || 0; bv = b.quantity || 0 }
      else if (sortCol === 'price') { av = getPrice(a) || 0; bv = getPrice(b) || 0 }
      else if (sortCol === 'ws') { av = parseFloat(a.wines?.ws_lowest_per_bottle) || 0; bv = parseFloat(b.wines?.ws_lowest_per_bottle) || 0 }
      else { av = getWineName(a).toLowerCase(); bv = getWineName(b).toLowerCase() }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

  const wishlistCount = Object.keys(wishlist).length

  // Column header style helper
  function colHeader(field, label, align = 'left') {
    const active = sortCol === field
    return (
      <div
        onClick={() => cycleSort(field)}
        style={{
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: active ? '#d4ad45' : 'rgba(253,250,245,0.65)',
          fontWeight: active ? 600 : 400,
          transition: 'color 0.15s',
          padding: '0',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <SortArrow field={field} />
      </div>
    )
  }

  // PIN screen
  if (stage === 'pin') return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em', marginBottom: '8px' }}>Bottles on Hand</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.4)', marginBottom: '40px' }}>Ready to collect</div>
        <input type="password" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(false) }} onKeyDown={e => e.key === 'Enter' && handlePin()} placeholder="Enter PIN"
          style={{ width: '100%', background: 'rgba(253,250,245,0.07)', border: pinError ? '1px solid #c0392b' : '1px solid rgba(253,250,245,0.15)', color: 'var(--white)', padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: '16px', outline: 'none', textAlign: 'center', letterSpacing: '0.3em', boxSizing: 'border-box', marginBottom: '12px' }} />
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
        <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleName()} placeholder="Your name"
          style={{ width: '100%', background: 'rgba(253,250,245,0.07)', border: '1px solid rgba(253,250,245,0.15)', color: 'var(--white)', padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: '12px' }} />
        <button onClick={handleName} style={{ width: '100%', background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>Browse Wines</button>
      </div>
    </div>
  )

  // Browse screen
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: wishlistCount > 0 ? '80px' : '40px' }} onClick={() => setTooltip(null)}>

      {/* Custom tooltip portal */}
      {tooltip && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          left: Math.min(tooltip.x, window.innerWidth - 240),
          top: tooltip.y + 12,
          background: 'var(--ink)', color: 'var(--white)',
          padding: '10px 14px', maxWidth: '220px',
          fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          borderLeft: '3px solid #9b3a4a',
        }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '5px' }}>Women in Wine</div>
          {tooltip.text}
        </div>
      )}

      <div style={{ background: 'var(--ink)', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em' }}>Bottles on Hand</div>
        <button onClick={() => setStage('pin')} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(107,30,46,0.4) 0%, transparent 60%)', color: 'var(--white)', padding: '32px 24px 28px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '42px', fontWeight: 300, letterSpacing: '0.04em', color: '#d4ad45', marginBottom: '4px' }}>Cheers, {buyerName}!</div>
        <div style={{ fontSize: '11px', color: 'rgba(253,250,245,0.5)', letterSpacing: '0.1em', marginBottom: '6px' }}>Available for immediate collection — heart wines to build your wishlist</div>
        <div style={{ fontSize: '11px', color: 'rgba(253,250,245,0.75)', letterSpacing: '0.05em', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>Prices shown include DUTY, VAT and DELIVERY</div>
      </div>

      <div style={{ padding: '24px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines, region, country…"
            style={{ flex: 1, minWidth: '160px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
            <option value="Sparkling">Sparkling</option>
            <option value="Sweet">Sweet</option>
          </select>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', fontFamily: 'DM Mono, monospace' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} available — click any column heading to sort
        </div>

        {/* Wine list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)' }}>No wines available right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>

            {/* Clickable table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 60px 80px 60px 110px 36px',
              gap: '0',
              background: 'var(--ink)',
              padding: '12px 16px',
              position: 'sticky',
              top: '52px',
              zIndex: 50,
              borderBottom: '2px solid rgba(212,173,69,0.3)',
            }}>
              {colHeader('name', 'Wine')}
              {colHeader('format', 'Size')}
              {colHeader('quantity', 'Qty', 'center')}
              {colHeader('price', 'Price / btl', 'right')}
              {colHeader('vintage', 'Vintage', 'right')}
              {colHeader('ws', 'WS UK Avg', 'right')}
              <div></div>
            </div>

            {filtered.map(s => {
              const inWishlist = !!wishlist[s.id]
              const colour = getWineColour(s)
              const dotColor = colour?.toLowerCase().includes('red') ? '#8b2535' : colour?.toLowerCase().includes('white') ? '#c4a84f' : colour?.toLowerCase().includes('ros') ? '#d4748a' : colour?.toLowerCase().includes('spark') ? '#a8c4d4' : '#aaa'
              const price = getPrice(s)
              const isMag = isMagnum(s.bottle_size || s.wines?.bottle_volume || '')
              const sizeLabel = isMag ? '150cl' : s.bottle_size === '37.5' ? '37.5cl' : s.bottle_size === '300' ? '300cl' : '75cl'
              const ws = s.wines?.ws_lowest_per_bottle ? parseFloat(s.wines.ws_lowest_per_bottle) : null
              const duty = isMag ? 6 : 3
              const wsDp = ws ? (ws + duty) * 1.2 : null
              const wsDate = s.wines?.ws_price_date || null
              const isBelowWs = wsDp && price && price < wsDp
              const buyerNote = s.wines?.buyer_note || ''
              const womenNote = getWomenNote(s)
              const restaurantSpot = s.wines?.restaurant_spot || ''
              const country = getWineCountry(s)
              const region = getWineRegion(s)
              const locationParts = [region, country].filter(Boolean)

              return (
                <div key={s.id} style={{ background: 'var(--white)' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 60px 60px 80px 60px 110px 36px',
                    gap: '0',
                    padding: '14px 16px',
                    alignItems: 'start',
                    borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent'
                  }}>

                    {/* Wine name col */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '2px' }}></span>
                        {womenNote && (
                          <span
                            onClick={e => {
                              e.stopPropagation()
                              setTooltip(prev => prev?.id === s.id ? null : { id: s.id, text: womenNote, x: e.clientX, y: e.clientY })
                            }}
                            style={{ fontSize: '14px', cursor: 'pointer', flexShrink: 0, color: '#9b3a4a', lineHeight: 1 }}
                            title=""
                          >♀</span>
                        )}
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', lineHeight: 1.3, color: 'var(--ink)', fontWeight: isMag ? 700 : 400 }}>{getWineName(s)}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '13px', marginBottom: buyerNote ? '6px' : '0' }}>
                        {locationParts.join(' · ')}
                      </div>
                      {buyerNote && (
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55, paddingLeft: '13px', opacity: 0.85 }}>{buyerNote}</div>
                      )}
                      {restaurantSpot && (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8b2535', letterSpacing: '0.05em', paddingLeft: '13px', marginTop: '4px' }}>{restaurantSpot}</div>
                      )}
                    </div>

                    {/* Size col */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink)', fontWeight: isMag ? 600 : 400, paddingTop: '2px' }}>{sizeLabel}</div>

                    {/* Qty col */}
                    <div style={{ textAlign: 'center', paddingTop: '2px' }}>
                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setWishlistQty(s.id, Math.max(1, (wishlist[s.id] || 1) - 1))} style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>{wishlist[s.id]}</span>
                          <button onClick={() => setWishlistQty(s.id, Math.min(s.quantity, (wishlist[s.id] || 1) + 1))} style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{s.quantity}</span>
                      )}
                    </div>

                    {/* Price col */}
                    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>{price ? `£${price.toFixed(2)}` : 'POA'}</div>
                      {inWishlist && price && (
                        <div style={{ fontSize: '9px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>×{wishlist[s.id]} = £{(price * wishlist[s.id]).toFixed(2)}</div>
                      )}
                    </div>

                    {/* Vintage col */}
                    <div style={{ textAlign: 'right', paddingTop: '4px' }}>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: 'var(--wine)' }}>{getWineVintage(s)}</span>
                    </div>

                    {/* WS UK Avg col — price → date → above/below label */}
                    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                      {wsDp ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', fontWeight: 500 }}>£{wsDp.toFixed(2)}</div>
                          {wsDate && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(0,0,0,0.3)' }}>{wsDate}</div>}
                          {isBelowWs
                            ? <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#2a7a4b', fontWeight: 600, letterSpacing: '0.02em' }}>below WS UK avg</div>
                            : <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#b94040', fontWeight: 600, letterSpacing: '0.02em' }}>above WS UK avg</div>
                          }
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--border)' }}>—</div>
                      )}
                    </div>

                    {/* Heart col */}
                    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                      <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>{inWishlist ? '❤️' : '🤍'}</button>
                    </div>
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
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--white)' }}>{wishlistCount} wine{wishlistCount > 1 ? 's' : ''} · {Object.values(wishlist).reduce((a, b) => a + b, 0)} bottles</div>
          <button onClick={sendWishlist} style={{ background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>Send Wishlist</button>
        </div>
      )}
    </div>
  )
}
