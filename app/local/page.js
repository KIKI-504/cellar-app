'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const LOCAL_PIN = '2222'

const dotColor = (colour) => {
  const c = (colour || '').toLowerCase()
  if (c.includes('red')) return '#8b2535'
  if (c.includes('white')) return '#d4c88a'
  if (c.includes('ros')) return '#d4748a'
  if (c.includes('spark')) return '#a8c4d4'
  if (c.includes('sweet')) return '#c4a85a'
  return '#aaa'
}

export default function LocalPage() {
  const [stage, setStage] = useState('pin') // pin | name | browse
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(false)
  const [hearts, setHearts] = useState({})
  const [search, setSearch] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [sortCol, setSortCol] = useState('description')
  const [sortDir, setSortDir] = useState(1)
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
      .select('*, wines(id, description, vintage, colour, region, country, bottle_format, bottle_volume, women_note, buyer_note, restaurant_spot, ws_lowest_per_bottle, source_id)')
      .eq('status', 'Available')
      .gt('quantity', 0)
      .order('created_at', { ascending: false })
    setWines(data || [])
    setLoading(false)
    setStage('browse')
  }

  // Helpers
  function getName(s) { return s.wines?.description || s.unlinked_description || 'Unknown wine' }
  function getVintage(s) { return s.wines?.vintage || s.unlinked_vintage || '' }
  function getRegion(s) { return s.wines?.region || '' }
  function getColour(s) { return s.wines?.colour || s.colour || '' }
  function getFormat(s) { return s.wines?.bottle_format || '' }
  function getPrice(s) {
    const p = s.sale_price ?? s.dp_price
    return p ? parseFloat(p) : null
  }
  function getBuyerNote(s) { return s.wines?.buyer_note || '' }
  function getRestaurantSpot(s) { return s.wines?.restaurant_spot || '' }
  function getWomenNote(s) { return s.wines?.women_note || '' }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function sortIcon(col) {
    if (sortCol !== col) return <span style={{ opacity: 0.25, fontSize: '9px', marginLeft: '3px' }}>⇅</span>
    return <span style={{ fontSize: '9px', color: '#d4ad45', marginLeft: '3px' }}>{sortDir === 1 ? '↑' : '↓'}</span>
  }

  function toggleHeart(id) {
    setHearts(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = 1
      return next
    })
  }

  function setQuantity(id, qty, max) {
    const capped = Math.min(Math.max(1, parseInt(qty) || 1), max)
    setHearts(prev => ({ ...prev, [id]: capped }))
  }

  function sendWishlist() {
    const list = wines.filter(w => hearts[w.id])
    if (!list.length) return
    const totalBottles = list.reduce((sum, s) => sum + (hearts[s.id] || 0), 0)
    const totalValue = list.reduce((sum, s) => {
      const price = getPrice(s)
      return sum + (price || 0) * (hearts[s.id] || 1)
    }, 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const wineLines = list.map(s => {
      const qty = hearts[s.id] || 1
      const price = getPrice(s)
      const total = price ? (price * qty).toFixed(2) : 'POA'
      return `${getVintage(s)}  ${getName(s)}\n      ${getRegion(s)} · ${getColour(s)}\n      ${price ? `£${price.toFixed(2)} per bottle` : 'POA'} · Qty: ${qty}${price ? ` · Subtotal: £${total}` : ''}`
    })

    const body = [
      `Bottles On Hand — ${buyerName}`,
      date, '',
      'Available for immediate collection.',
      '',
      wineLines.join('\n\n'), '',
      '─'.repeat(40),
      `${list.length} wine${list.length !== 1 ? 's' : ''} · ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''}${totalValue > 0 ? ` · £${totalValue.toFixed(2)}` : ''}`,
      '',
      'All prices per bottle, includes duty & VAT.',
    ].join('\n')

    const subject = `Bottles On Hand — ${buyerName} · ${date}`
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const filtered = wines
    .filter(s => {
      if (filterColour && !getColour(s).toLowerCase().includes(filterColour.toLowerCase())) return false
      if (search) {
        const q = search.toLowerCase()
        return [getName(s), getVintage(s), getRegion(s)].join(' ').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sortCol === 'sale_price') {
        const av = getPrice(a) || 0
        const bv = getPrice(b) || 0
        if (av === 0 && bv !== 0) return 1
        if (bv === 0 && av !== 0) return -1
        return (av - bv) * sortDir
      }
      if (sortCol === 'vintage') {
        const av = parseInt(getVintage(a)) || 0
        const bv = parseInt(getVintage(b)) || 0
        if (av === 0) return 1; if (bv === 0) return -1
        return (av - bv) * sortDir
      }
      if (sortCol === 'description') return getName(a).localeCompare(getName(b)) * sortDir
      if (sortCol === 'colour') return getColour(a).localeCompare(getColour(b)) * sortDir
      if (sortCol === 'region') return getRegion(a).localeCompare(getRegion(b)) * sortDir
      return 0
    })

  const heartCount = Object.keys(hearts).length
  const totalBottles = Object.values(hearts).reduce((sum, q) => sum + q, 0)
  const totalValue = wines.filter(s => hearts[s.id]).reduce((sum, s) => {
    const price = getPrice(s)
    return sum + (price || 0) * (hearts[s.id] || 1)
  }, 0)

  // ── PIN screen ───────────────────────────────────────────────────────────────
  if (stage === 'pin') return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(212,173,69,0.6)', marginBottom: '10px' }}>Belle Année Wines</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '34px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.05em', marginBottom: '6px' }}>Bottles On Hand</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.35)', marginBottom: '40px' }}>Available for immediate collection</div>
        <input
          type="password"
          value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && handlePin()}
          placeholder="Enter PIN"
          autoFocus
          style={{ width: '100%', background: 'rgba(253,250,245,0.07)', border: pinError ? '1px solid #c0392b' : '1px solid rgba(253,250,245,0.15)', color: 'var(--white)', padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: '16px', outline: 'none', textAlign: 'center', letterSpacing: '0.3em', boxSizing: 'border-box', marginBottom: '12px' }}
        />
        {pinError && <div style={{ fontSize: '11px', color: '#c0392b', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>Incorrect PIN</div>}
        <button onClick={handlePin} style={{ width: '100%', background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>Enter</button>
      </div>
    </div>
  )

  // ── Name screen ──────────────────────────────────────────────────────────────
  if (stage === 'name') return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '34px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.05em', marginBottom: '8px' }}>Welcome</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.4)', marginBottom: '40px' }}>What's your name?</div>
        <input
          type="text"
          value={buyerName}
          onChange={e => setBuyerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleName()}
          placeholder="Your name"
          autoFocus
          style={{ width: '100%', background: 'rgba(253,250,245,0.07)', border: '1px solid rgba(253,250,245,0.15)', color: 'var(--white)', padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: '12px' }}
        />
        <button onClick={handleName} disabled={loading} style={{ width: '100%', background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
          {loading ? 'Loading…' : 'Browse Wines'}
        </button>
      </div>
    </div>
  )

  // ── Browse screen ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: heartCount > 0 ? '80px' : '40px' }}>

      {/* Header */}
      <div style={{ background: 'var(--ink)', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.08em' }}>Bottles On Hand</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(253,250,245,0.5)', letterSpacing: '0.1em' }}>{buyerName}</div>
      </div>

      {/* Hero strip */}
      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 70% 50%, rgba(107,30,46,0.35) 0%, transparent 60%)', padding: '20px 24px 18px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(212,173,69,0.7)', marginBottom: '4px' }}>Available for immediate collection</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'rgba(253,250,245,0.45)', letterSpacing: '0.05em' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} · heart to build your wishlist
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: '52px', zIndex: 90 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search wines…"
          style={{ flex: 1, minWidth: '160px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}
        />
        <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
          <option value="">All Colours</option>
          <option value="Red">Red</option>
          <option value="White">White</option>
          <option value="Rosé">Rosé</option>
          <option value="Sparkling">Sparkling</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ padding: '16px 24px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)', fontWeight: 300 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--muted)', fontWeight: 300 }}>
            No wines available right now.
          </div>
        ) : (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflowX: 'auto' }}>
            {/* Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 120px 100px 90px 80px', background: 'var(--ink)' }}>
              {[
                { label: '', col: null },
                { label: 'Wine', col: 'description' },
                { label: 'Vintage', col: 'vintage' },
                { label: 'Region', col: 'region' },
                { label: 'Colour', col: 'colour' },
                { label: 'Price / btl', col: 'sale_price' },
                { label: 'Available', col: null },
              ].map(({ label, col }, i) => (
                <div key={i} onClick={col ? () => handleSort(col) : undefined}
                  style={{ padding: '10px 12px', fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 400, color: col && sortCol === col ? '#d4ad45' : 'rgba(253,250,245,0.55)', cursor: col ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {label}{col && sortIcon(col)}
                </div>
              ))}
            </div>

            {/* Rows */}
            {filtered.map((s, idx) => {
              const hearted = !!hearts[s.id]
              const qty = hearts[s.id] || 1
              const maxQty = parseInt(s.quantity) || 99
              const price = getPrice(s)
              const colour = getColour(s)
              const buyerNote = getBuyerNote(s)
              const restaurantSpot = getRestaurantSpot(s)
              const womenNote = getWomenNote(s)
              const hasNote = !!(buyerNote || restaurantSpot)
              const isExpanded = expandedNote === s.id
              const isMagnum = getFormat(s) === 'Magnum' || s.bottle_size === '150'

              return (
                <div key={s.id}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 120px 100px 90px 80px', borderBottom: isExpanded ? 'none' : '1px solid #ede6d6', background: hearted ? 'rgba(107,30,46,0.04)' : idx % 2 === 0 ? 'var(--white)' : 'rgba(250,247,242,0.6)', cursor: hasNote ? 'pointer' : 'default', transition: 'background 0.1s' }}
                    onClick={hasNote ? () => setExpandedNote(isExpanded ? null : s.id) : undefined}
                    onMouseEnter={e => { if (!hearted) e.currentTarget.style.background = 'rgba(212,173,69,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = hearted ? 'rgba(107,30,46,0.04)' : idx % 2 === 0 ? 'var(--white)' : 'rgba(250,247,242,0.6)' }}
                  >
                    {/* Heart */}
                    <div style={{ padding: '14px 0 14px 10px', display: 'flex', alignItems: 'center' }}
                      onClick={e => { e.stopPropagation(); toggleHeart(s.id) }}>
                      <button style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                        {hearted ? '❤️' : '🤍'}
                      </button>
                    </div>

                    {/* Wine name */}
                    <div style={{ padding: '14px 12px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor(colour), flexShrink: 0, display: 'inline-block' }}></span>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>{getName(s)}</span>
                        {womenNote && (
                          <span style={{ fontSize: '10px', color: '#9b3a4a', background: 'rgba(155,58,74,0.08)', border: '1px solid rgba(155,58,74,0.2)', padding: '1px 5px', borderRadius: '2px', flexShrink: 0 }}>♀</span>
                        )}
                        {isMagnum && (
                          <span style={{ fontSize: '9px', background: 'rgba(107,30,46,0.08)', color: 'var(--wine)', border: '1px solid rgba(107,30,46,0.2)', padding: '1px 6px', borderRadius: '2px', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>Magnum</span>
                        )}
                        {hasNote && (
                          <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '2px' }}>{isExpanded ? '▲' : '▼'}</span>
                        )}
                      </div>
                      {hearted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', paddingLeft: '14px' }}
                          onClick={e => e.stopPropagation()}>
                          <button onClick={() => setQuantity(s.id, qty - 1, maxQty)} disabled={qty <= 1}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty <= 1 ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => setQuantity(s.id, qty + 1, maxQty)} disabled={qty >= maxQty}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty >= maxQty ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', opacity: qty >= maxQty ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                          {price && (
                            <span style={{ fontSize: '10px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                              £{(price * qty).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Vintage */}
                    <div style={{ padding: '14px 12px', fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--ink)', display: 'flex', alignItems: 'center' }}>
                      {getVintage(s) || '—'}
                    </div>

                    {/* Region */}
                    <div style={{ padding: '14px 12px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', lineHeight: 1.3 }}>
                      {getRegion(s) || '—'}
                    </div>

                    {/* Colour */}
                    <div style={{ padding: '14px 12px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                      {colour || '—'}
                    </div>

                    {/* Price */}
                    <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, color: price ? 'var(--wine)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {price ? `£${price.toFixed(2)}` : 'POA'}
                      </div>
                    </div>

                    {/* Qty available */}
                    <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>
                        {s.quantity} btl{s.quantity !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Expanded note */}
                  {isExpanded && hasNote && (
                    <div style={{ borderBottom: '1px solid #ede6d6', background: 'rgba(212,173,69,0.04)', padding: '12px 16px 16px 46px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {buyerNote && (
                        <div style={{ fontSize: '13px', fontFamily: 'Cormorant Garamond, serif', color: 'var(--ink)', lineHeight: 1.6, fontStyle: 'italic' }}>
                          {buyerNote}
                        </div>
                      )}
                      {restaurantSpot && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(107,30,46,0.07)', border: '1px solid rgba(107,30,46,0.2)', padding: '5px 10px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--wine)', alignSelf: 'flex-start' }}>
                          🍽 {restaurantSpot}
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
      {heartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', zIndex: 200, borderTop: '2px solid rgba(212,173,69,0.4)' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 300 }}>
              {heartCount} wine{heartCount !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}
            </div>
            {totalValue > 0 && (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#d4ad45', marginTop: '2px' }}>
                £{totalValue.toFixed(2)} total
              </div>
            )}
          </div>
          <button onClick={sendWishlist} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '11px 22px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            ✉ Send Wishlist
          </button>
        </div>
      )}
    </div>
  )
}
