'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function BuyerPage() {
  const router = useRouter()
  const [wines, setWines] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterWomen, setFilterWomen] = useState(false)
  const [hearts, setHearts] = useState({})
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const [sortCol, setSortCol] = useState('description')
  const [sortDir, setSortDir] = useState(1)
  const [editingNote, setEditingNote] = useState(null)
  const [editingSpot, setEditingSpot] = useState(null)
  const [noteVal, setNoteVal] = useState('')
  const [spotVal, setSpotVal] = useState('')

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    const user = sessionStorage.getItem('user')
    const email = sessionStorage.getItem('email') || ''
    if (role !== 'buyer' && role !== 'admin') { router.push('/'); return }
    setUserName(user || '')
    setUserEmail(email)
    setIsAdmin(role === 'admin')
    fetchWines()
  }, [])

  async function fetchWines() {
    setLoading(true)
    const { data, error } = await supabase
      .from('wines')
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, ws_lowest_per_bottle, buyer_note, restaurant_spot, purchase_price_per_bottle')
      .order('description')
    if (error) { console.error(error) }
    else {
      const buyerWines = (data || []).filter(w => w.include_in_buyer_view === true && w.sale_price !== null)
      setWines(buyerWines)
      setFiltered(buyerWines)
    }
    setLoading(false)
  }

  useEffect(() => {
    let result = [...wines]
    if (filterColour) result = result.filter(w => w.colour?.toLowerCase().includes(filterColour.toLowerCase()))
    if (filterRegion) result = result.filter(w => w.region === filterRegion)
    if (filterWomen) result = result.filter(w => w.women_note)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(w => [w.description, w.region, w.country, w.vintage, w.colour].join(' ').toLowerCase().includes(q))
    }
    // Sort
    result.sort((a, b) => {
      let av, bv
      if (sortCol === 'vintage') {
        av = parseInt(a.vintage) || 0; bv = parseInt(b.vintage) || 0
        return (av - bv) * sortDir
      }
      if (sortCol === 'sale_price') {
        av = parseFloat(a.sale_price) || 0; bv = parseFloat(b.sale_price) || 0
        return (av - bv) * sortDir
      }
      av = (a[sortCol] || '').toLowerCase()
      bv = (b[sortCol] || '').toLowerCase()
      return av < bv ? -sortDir : av > bv ? sortDir : 0
    })
    setFiltered(result)
  }, [wines, search, filterColour, filterRegion, filterWomen, sortCol, sortDir])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function sortIcon(col) {
    if (sortCol !== col) return <span style={{ opacity: 0.35, fontSize: '9px' }}>↕</span>
    return <span style={{ fontSize: '9px', color: '#d4ad45' }}>{sortDir === 1 ? '↑' : '↓'}</span>
  }

  // Value badge: sale price is within 10% of WS ex-duty
  // Normally a buyer would pay WS ex-duty + £3 duty + 20% VAT = (WS + 3) * 1.2
  // If our sale_price ≤ WS * 1.10, that's genuinely exceptional value
  function isExceptionalValue(w) {
    if (!w.ws_lowest_per_bottle || !w.sale_price) return false
    const ws = parseFloat(w.ws_lowest_per_bottle)
    const sale = parseFloat(w.sale_price)
    return sale <= ws * 1.10
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

  function buildWishlistText() {
    const list = wines.filter(w => hearts[w.id])
    const totalBottles = list.reduce((sum, w) => sum + (hearts[w.id] || 0), 0)
    const totalValue = list.reduce((sum, w) => sum + parseFloat(w.sale_price) * (hearts[w.id] || 1), 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const divider = '─'.repeat(50)
    const wineLines = list.map(w => {
      const qty = hearts[w.id] || 1
      const total = (parseFloat(w.sale_price) * qty).toFixed(2)
      return [
        `${w.vintage}  ${w.description}`,
        `      ${w.region}${w.country ? ' · ' + w.country : ''} · ${w.colour}${w.bottle_format ? ' · ' + w.bottle_format : ''}${w.bottle_volume ? ' ' + w.bottle_volume : ''}`,
        `      £${parseFloat(w.sale_price).toFixed(2)} per bottle · Qty: ${qty} · Subtotal: £${total}`,
      ].join('\n')
    })
    return [
      `WISHLIST — ${userName.toUpperCase()}`,
      date, '',
      'WINES SELECTED',
      divider, '',
      wineLines.join('\n\n'), '',
      divider,
      `TOTAL: ${list.length} wine${list.length !== 1 ? 's' : ''} · ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''} · £${totalValue.toFixed(2)}`,
      '',
      'All prices per bottle, in bond (ex-duty and VAT).',
      'Please reply to confirm availability.',
    ].join('\n')
  }

  function emailWishlist() {
    const body = buildWishlistText()
    const subject = `Wine Wishlist — ${userName} — ${new Date().toLocaleDateString('en-GB')}`
    const mailto = `mailto:jessica.bride@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
  }

  // Admin: save buyer note
  async function saveBuyerNote(id) {
    const { error } = await supabase.from('wines').update({ buyer_note: noteVal.trim() || null }).eq('id', id)
    if (!error) {
      setWines(prev => prev.map(w => w.id === id ? { ...w, buyer_note: noteVal.trim() || null } : w))
      setEditingNote(null)
    }
  }

  // Admin: save restaurant spot
  async function saveRestaurantSpot(id) {
    const { error } = await supabase.from('wines').update({ restaurant_spot: spotVal.trim() || null }).eq('id', id)
    if (!error) {
      setWines(prev => prev.map(w => w.id === id ? { ...w, restaurant_spot: spotVal.trim() || null } : w))
      setEditingSpot(null)
    }
  }

  const regions = [...new Set(wines.map(w => w.region).filter(Boolean))].sort()
  const heartCount = Object.keys(hearts).length
  const totalBottles = Object.values(hearts).reduce((sum, q) => sum + q, 0)
  const womenCount = wines.filter(w => w.women_note).length

  const sortOptions = [
    { col: 'description', label: 'Wine A→Z' },
    { col: 'vintage',     label: 'Vintage' },
    { col: 'region',      label: 'Region' },
    { col: 'colour',      label: 'Colour' },
    { col: 'sale_price',  label: 'Price' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading selection…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: heartCount > 0 ? '80px' : '0' }}>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', top: tooltip.y, left: tooltip.x, zIndex: 1000, background: 'var(--ink)', color: 'var(--white)', padding: '10px 14px', maxWidth: '280px', fontSize: '11px', lineHeight: 1.6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4748a', marginBottom: '5px' }}>♀ Women in wine</div>
          {tooltip.text}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(107,30,46,0.4) 0%, transparent 60%)', color: 'var(--white)', padding: '32px 28px 28px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, letterSpacing: '0.04em', color: '#d4ad45', marginBottom: '4px' }}>Welcome, {userName}</div>
        <div style={{ fontSize: '11px', color: 'rgba(253,250,245,0.5)', letterSpacing: '0.1em' }}>Browse our current selection — heart wines to build your wishlist</div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines, region, vintage…" style={{ flex: 1, minWidth: '200px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {womenCount > 0 && (
            <button onClick={() => setFilterWomen(v => !v)}
              style={{ background: filterWomen ? '#9b3a4a' : 'var(--white)', color: filterWomen ? 'var(--white)' : '#9b3a4a', border: '1px solid #9b3a4a', padding: '9px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ♀ Women in wine {filterWomen ? '✓' : ''}
            </button>
          )}
        </div>

        {/* Sort pills */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', marginRight: '4px' }}>SORT</span>
          {sortOptions.map(({ col, label }) => (
            <button key={col} onClick={() => handleSort(col)}
              style={{
                padding: '5px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em',
                cursor: 'pointer', border: '1px solid var(--border)',
                background: sortCol === col ? 'var(--ink)' : 'var(--white)',
                color: sortCol === col ? '#d4ad45' : 'var(--muted)',
                whiteSpace: 'nowrap',
              }}>
              {label} {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} available
          {womenCount > 0 && !filterWomen && <span style={{ marginLeft: '12px', color: '#9b3a4a' }}>♀ {womenCount} women-led producer{womenCount !== 1 ? 's' : ''}</span>}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, marginBottom: '8px', color: 'var(--ink)' }}>No wines found</div>
            <div style={{ fontSize: '12px' }}>Try adjusting your search or filters.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filtered.map(w => {
              const hearted = !!hearts[w.id]
              const qty = hearts[w.id] || 1
              const maxQty = parseInt(w.quantity) || 1
              const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const exceptional = isExceptionalValue(w)
              const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
              const sale = parseFloat(w.sale_price)
              // What buyer would normally pay: (WS + duty) * 1.2
              const isMag = (w.bottle_volume || '').includes('150') || (w.bottle_volume || '').includes('300') || (w.bottle_format || '').toLowerCase().includes('magnum')
              const duty = isMag ? 6 : 3
              const normalMarketDP = ws ? ((ws + duty) * 1.2) : null
              const saving = normalMarketDP ? (normalMarketDP - sale) : null

              return (
                <div key={w.id} style={{
                  background: 'var(--white)',
                  border: `1px solid ${hearted ? 'var(--wine)' : exceptional ? 'rgba(45,106,79,0.4)' : 'var(--border)'}`,
                  padding: '20px', position: 'relative', transition: 'box-shadow 0.2s, transform 0.15s',
                  boxShadow: exceptional ? '0 0 0 1px rgba(45,106,79,0.15)' : 'none',
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,20,16,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = exceptional ? '0 0 0 1px rgba(45,106,79,0.15)' : 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>

                  {/* Heart button */}
                  <button onClick={() => toggleHeart(w.id)} style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>
                    {hearted ? '❤️' : '🤍'}
                  </button>

                  {/* Women badge */}
                  {w.women_note && (
                    <div style={{ position: 'absolute', top: '14px', left: '14px' }}>
                      <button
                        onMouseEnter={e => { const rect = e.currentTarget.getBoundingClientRect(); setTooltip({ text: w.women_note, x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 8 }) }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setTooltip(tooltip ? null : { text: w.women_note, x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 8 }) }}
                        style={{ background: 'rgba(155,58,74,0.08)', border: '1px solid rgba(155,58,74,0.3)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '11px', color: '#9b3a4a', padding: 0 }}>
                        ♀
                      </button>
                    </div>
                  )}

                  {/* Exceptional value badge */}
                  {exceptional && (
                    <div style={{ position: 'absolute', top: w.women_note ? '44px' : '14px', left: '14px' }}>
                      <div style={{ background: 'rgba(45,106,79,0.1)', border: '1px solid rgba(45,106,79,0.35)', padding: '2px 7px', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                        ✦ Exceptional value
                      </div>
                    </div>
                  )}

                  {/* Wine details */}
                  <div style={{ paddingLeft: (w.women_note || exceptional) ? '0' : '0', paddingRight: '28px', paddingTop: (w.women_note || exceptional) ? '32px' : '0' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300, color: 'var(--wine)', lineHeight: 1, marginBottom: '6px' }}>{w.vintage}</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.35, marginBottom: '8px', paddingRight: '12px' }}>{w.description}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px', lineHeight: 1.6 }}>
                      <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, marginRight: '4px', verticalAlign: 'middle' }}></span>
                      {w.colour} &nbsp;·&nbsp; {w.region}
                      {w.bottle_format ? ` · ${w.bottle_format}` : ''}
                      {w.bottle_volume ? ` ${w.bottle_volume}` : ''}
                    </div>
                  </div>

                  {/* Price — sits directly under wine name/details */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', fontWeight: 500, color: 'var(--ink)' }}>£{sale.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.08em', marginTop: '2px' }}>Per bottle · includes duty &amp; VAT</div>
                      {exceptional && normalMarketDP && saving && (
                        <div style={{ marginTop: '6px', fontSize: '10px', color: '#2d6a4f', lineHeight: 1.5 }}>
                          <span style={{ fontFamily: 'DM Mono, monospace' }}>
                            Normal market rate: £{normalMarketDP.toFixed(2)}<br />
                            You save: £{saving.toFixed(2)} per bottle
                          </span>
                        </div>
                      )}
                    </div>
                    {hearted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => setQuantity(w.id, qty - 1, maxQty)} disabled={qty <= 1}
                          style={{ width: '24px', height: '24px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty <= 1 ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '14px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => setQuantity(w.id, qty + 1, maxQty)} disabled={qty >= maxQty}
                          style={{ width: '24px', height: '24px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty >= maxQty ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '14px', opacity: qty >= maxQty ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>/ {maxQty}</span>
                      </div>
                    )}
                  </div>

                  {hearted && (
                    <div style={{ marginBottom: '10px', fontSize: '11px', color: 'var(--wine)', fontWeight: 500 }}>
                      Subtotal: £{(sale * qty).toFixed(2)}
                    </div>
                  )}

                  {/* Buyer note (from Jessica) — bottom of card */}
                  {w.buyer_note && !isAdmin && (
                    <div style={{ background: 'rgba(212,173,69,0.08)', border: '1px solid rgba(212,173,69,0.25)', padding: '8px 10px', marginBottom: '8px', fontSize: '11px', color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>
                      {w.buyer_note}
                    </div>
                  )}

                  {/* Admin: editable buyer note */}
                  {isAdmin && (
                    <div style={{ marginBottom: '8px' }}>
                      {editingNote === w.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <textarea
                            value={noteVal}
                            onChange={e => setNoteVal(e.target.value)}
                            placeholder="Add a note for buyers — e.g. seasonal, rare, can't be found anywhere else in the UK…"
                            autoFocus
                            style={{ width: '100%', minHeight: '64px', border: '1px solid rgba(212,173,69,0.5)', background: 'rgba(212,173,69,0.05)', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => saveBuyerNote(w.id)} style={{ background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.08em' }}>Save</button>
                            <button onClick={() => setEditingNote(null)} style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingNote(w.id); setNoteVal(w.buyer_note || '') }}
                          style={{ background: w.buyer_note ? 'rgba(212,173,69,0.08)' : 'none', border: `1px solid ${w.buyer_note ? 'rgba(212,173,69,0.3)' : 'var(--border)'}`, padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: w.buyer_note ? '#7a5e10' : 'var(--muted)', width: '100%', textAlign: 'left', letterSpacing: '0.05em' }}>
                          {w.buyer_note ? `✎ ${w.buyer_note}` : '+ Add buyer note'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Restaurant spot — bottom of card */}
                  {w.restaurant_spot && !isAdmin && (
                    <div style={{ background: 'rgba(107,30,46,0.05)', border: '1px solid rgba(107,30,46,0.2)', padding: '8px 10px', fontSize: '11px', color: 'var(--wine)', lineHeight: 1.5 }}>
                      🍽 {w.restaurant_spot}
                    </div>
                  )}

                  {/* Admin: editable restaurant spot */}
                  {isAdmin && (
                    <div>
                      {editingSpot === w.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            value={spotVal}
                            onChange={e => setSpotVal(e.target.value)}
                            placeholder="e.g. Spotted at Core by Clare Smyth for £850/bottle"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveRestaurantSpot(w.id); if (e.key === 'Escape') setEditingSpot(null) }}
                            style={{ width: '100%', border: '1px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => saveRestaurantSpot(w.id)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.08em' }}>Save</button>
                            <button onClick={() => setEditingSpot(null)} style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingSpot(w.id); setSpotVal(w.restaurant_spot || '') }}
                          style={{ background: w.restaurant_spot ? 'rgba(107,30,46,0.05)' : 'none', border: `1px solid ${w.restaurant_spot ? 'rgba(107,30,46,0.2)' : 'var(--border)'}`, padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: w.restaurant_spot ? 'var(--wine)' : 'var(--muted)', width: '100%', textAlign: 'left', letterSpacing: '0.05em' }}>
                          {w.restaurant_spot ? `🍽 ${w.restaurant_spot}` : '+ Add restaurant spot'}
                        </button>
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', zIndex: 200 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>
            {heartCount} wine{heartCount !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}
          </div>
          <button onClick={emailWishlist}
            style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            ✉ Send Wishlist
          </button>
        </div>
      )}
    </div>
  )
}
