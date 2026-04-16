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
  const [sortCol, setSortCol] = useState('description')
  const [sortDir, setSortDir] = useState(1)
  const [hearts, setHearts] = useState({})
  const [userName, setUserName] = useState('')
  const [expandedNote, setExpandedNote] = useState(null)

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    const user = sessionStorage.getItem('user')
    if (role !== 'buyer' && role !== 'admin') { router.push('/'); return }
    setUserName(user || '')
    fetchWines()
  }, [])

  async function fetchWines() {
    setLoading(true)
    const { data, error } = await supabase
      .from('wines')
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, buyer_note, restaurant_spot, ws_lowest_per_bottle, flagged')
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
      result = result.filter(w => [w.description, w.region, w.country, w.vintage].join(' ').toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      let av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      if (sortCol === 'sale_price') {
        av = parseFloat(a.sale_price) || 0
        bv = parseFloat(b.sale_price) || 0
        if (av === 0 && bv !== 0) return 1
        if (bv === 0 && av !== 0) return -1
        return (av - bv) * sortDir
      }
      if (sortCol === 'vintage') {
        av = parseInt(a.vintage) || 0
        bv = parseInt(b.vintage) || 0
        if (av === 0) return 1
        if (bv === 0) return -1
        return (av - bv) * sortDir
      }
      return String(av).localeCompare(String(bv)) * sortDir
    })
    setFiltered(result)
  }, [wines, search, filterColour, filterRegion, filterWomen, sortCol, sortDir])

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
    const totalBottles = list.reduce((sum, w) => sum + (hearts[w.id] || 0), 0)
    const totalValue = list.reduce((sum, w) => sum + parseFloat(w.sale_price) * (hearts[w.id] || 1), 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const wineLines = list.map(w => {
      const qty = hearts[w.id] || 1
      const total = (parseFloat(w.sale_price) * qty).toFixed(2)
      return `${w.vintage}  ${w.description}\n      ${w.region}${w.country ? ' · ' + w.country : ''} · ${w.colour}${w.bottle_format ? ' · ' + w.bottle_format : ''}\n      £${parseFloat(w.sale_price).toFixed(2)} per bottle · Qty: ${qty} · Subtotal: £${total}`
    })

    const body = [
      `Wishlist — ${userName}`,
      date, '',
      wineLines.join('\n\n'), '',
      '─'.repeat(40),
      `${list.length} wine${list.length !== 1 ? 's' : ''} · ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''} · £${totalValue.toFixed(2)}`,
      '',
      'All prices per bottle, includes duty & VAT.',
    ].join('\n')

    const subject = `Wishlist — ${userName} · ${date}`
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  // Exceptional value: sale price ≤ WS DP × 1.10
  function isExceptionalValue(w) {
    if (!w.ws_lowest_per_bottle || !w.sale_price) return false
    const duty = (w.bottle_volume || '').includes('150') ? 6 : 3
    const wsDP = (parseFloat(w.ws_lowest_per_bottle) + duty) * 1.2
    return parseFloat(w.sale_price) <= wsDP * 1.10
  }

  function wsDP(w) {
    if (!w.ws_lowest_per_bottle) return null
    const duty = (w.bottle_volume || '').includes('150') ? 6 : 3
    return (parseFloat(w.ws_lowest_per_bottle) + duty) * 1.2
  }

  const dotColor = (colour) => {
    const c = (colour || '').toLowerCase()
    if (c.includes('red')) return '#8b2535'
    if (c.includes('white')) return '#d4c88a'
    if (c.includes('ros')) return '#d4748a'
    if (c.includes('spark')) return '#a8c4d4'
    if (c.includes('sweet')) return '#c4a85a'
    return '#aaa'
  }

  const regions = [...new Set(wines.map(w => w.region).filter(Boolean))].sort()
  const heartCount = Object.keys(hearts).length
  const totalBottles = Object.values(hearts).reduce((sum, q) => sum + q, 0)
  const totalValue = wines.filter(w => hearts[w.id]).reduce((sum, w) => sum + parseFloat(w.sale_price) * (hearts[w.id] || 1), 0)
  const womenCount = wines.filter(w => w.women_note).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--wine)', fontWeight: 300 }}>Loading selection…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: heartCount > 0 ? '80px' : '40px' }}>

      {/* Header */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(107,30,46,0.4) 0%, transparent 60%)', color: 'var(--white)', padding: '28px 28px 24px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', fontWeight: 300, letterSpacing: '0.04em', color: '#d4ad45', marginBottom: '3px' }}>
          Welcome, {userName}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(253,250,245,0.45)', letterSpacing: '0.1em' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} available · heart to build your wishlist
        </div>
      </div>

      {/* Filters + sort */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '12px 28px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: '52px', zIndex: 90 }}>
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
        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {womenCount > 0 && (
          <button onClick={() => setFilterWomen(v => !v)}
            style={{ background: filterWomen ? '#9b3a4a' : 'var(--cream)', color: filterWomen ? 'var(--white)' : '#9b3a4a', border: '1px solid #9b3a4a', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ♀ {filterWomen ? '✓ ' : ''}Women in wine
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ padding: '0 28px', paddingTop: '16px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300 }}>
            No wines match your filters.
          </div>
        ) : (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflowX: 'auto' }}>
            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 80px 120px 100px 90px 40px',
              gap: '0',
              background: 'var(--ink)',
              color: 'var(--white)',
              padding: '0',
            }}>
              {[
                { label: '', col: null },
                { label: 'Wine', col: 'description' },
                { label: 'Vintage', col: 'vintage' },
                { label: 'Region', col: 'region' },
                { label: 'Colour', col: 'colour' },
                { label: 'Price / btl', col: 'sale_price' },
                { label: '', col: null },
              ].map(({ label, col }, i) => (
                <div key={i}
                  onClick={col ? () => handleSort(col) : undefined}
                  style={{
                    padding: '10px 12px',
                    fontSize: '10px',
                    fontFamily: 'DM Mono, monospace',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontWeight: 400,
                    color: col && sortCol === col ? '#d4ad45' : 'rgba(253,250,245,0.55)',
                    cursor: col ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}>
                  {label}{col && sortIcon(col)}
                </div>
              ))}
            </div>

            {/* Rows */}
            {filtered.map((w, idx) => {
              const hearted = !!hearts[w.id]
              const qty = hearts[w.id] || 1
              const maxQty = parseInt(w.quantity) || 99
              const exceptional = isExceptionalValue(w)
              const wsDp = wsDP(w)
              const saving = exceptional && wsDp ? wsDp - parseFloat(w.sale_price) : null
              const isExpanded = expandedNote === w.id
              const hasNote = !!(w.buyer_note || w.restaurant_spot)

              return (
                <div key={w.id}>
                  {/* Main row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr 80px 120px 100px 90px 40px',
                      borderBottom: isExpanded ? 'none' : '1px solid #ede6d6',
                      background: hearted ? 'rgba(107,30,46,0.04)' : idx % 2 === 0 ? 'var(--white)' : 'rgba(250,247,242,0.6)',
                      cursor: hasNote ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onClick={hasNote ? () => setExpandedNote(isExpanded ? null : w.id) : undefined}
                    onMouseEnter={e => { if (!hearted) e.currentTarget.style.background = 'rgba(212,173,69,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = hearted ? 'rgba(107,30,46,0.04)' : idx % 2 === 0 ? 'var(--white)' : 'rgba(250,247,242,0.6)' }}
                  >
                    {/* Heart */}
                    <div style={{ padding: '14px 0 14px 10px', display: 'flex', alignItems: 'center' }}
                      onClick={e => { e.stopPropagation(); toggleHeart(w.id) }}>
                      <button style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                        {hearted ? '❤️' : '🤍'}
                      </button>
                    </div>

                    {/* Wine name */}
                    <div style={{ padding: '14px 12px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor(w.colour), flexShrink: 0, display: 'inline-block' }}></span>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>{w.description}</span>
                        {w.women_note && (
                          <span style={{ fontSize: '10px', color: '#9b3a4a', background: 'rgba(155,58,74,0.08)', border: '1px solid rgba(155,58,74,0.2)', padding: '1px 5px', borderRadius: '2px', flexShrink: 0 }}>♀</span>
                        )}
                        {exceptional && (
                          <span style={{ fontSize: '9px', background: 'rgba(45,106,79,0.1)', color: '#2d6a4f', border: '1px solid rgba(45,106,79,0.25)', padding: '1px 6px', borderRadius: '2px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em', flexShrink: 0 }}>
                            exceptional value
                          </span>
                        )}
                        {hasNote && (
                          <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '2px' }}>{isExpanded ? '▲' : '▼'}</span>
                        )}
                      </div>
                      {w.bottle_format && w.bottle_format !== 'Bottle' && (
                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '2px', paddingLeft: '14px' }}>
                          {w.bottle_format}{w.bottle_volume ? ` · ${w.bottle_volume}` : ''}
                        </div>
                      )}
                      {/* Qty stepper inline when hearted */}
                      {hearted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', paddingLeft: '14px' }}
                          onClick={e => e.stopPropagation()}>
                          <button onClick={() => setQuantity(w.id, qty - 1, maxQty)} disabled={qty <= 1}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty <= 1 ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => setQuantity(w.id, qty + 1, maxQty)} disabled={qty >= maxQty}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty >= maxQty ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', opacity: qty >= maxQty ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                          <span style={{ fontSize: '10px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                            £{(parseFloat(w.sale_price) * qty).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Vintage */}
                    <div style={{ padding: '14px 12px', fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--ink)', display: 'flex', alignItems: 'center' }}>
                      {w.vintage || '—'}
                    </div>

                    {/* Region */}
                    <div style={{ padding: '14px 12px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', lineHeight: 1.3 }}>
                      {w.region || '—'}
                    </div>

                    {/* Colour */}
                    <div style={{ padding: '14px 12px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                      {w.colour || '—'}
                    </div>

                    {/* Price */}
                    <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, color: 'var(--wine)', whiteSpace: 'nowrap' }}>
                        £{parseFloat(w.sale_price).toFixed(2)}
                      </div>
                      {exceptional && saving && (
                        <div style={{ fontSize: '9px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', marginTop: '2px', whiteSpace: 'nowrap' }}>
                          −£{saving.toFixed(2)} vs WS
                        </div>
                      )}
                    </div>

                    {/* Spacer */}
                    <div />
                  </div>

                  {/* Expanded note row */}
                  {isExpanded && hasNote && (
                    <div style={{ borderBottom: '1px solid #ede6d6', background: 'rgba(212,173,69,0.04)', padding: '12px 16px 16px 46px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {w.buyer_note && (
                        <div style={{ fontSize: '13px', fontFamily: 'Cormorant Garamond, serif', color: 'var(--ink)', lineHeight: 1.6, fontStyle: 'italic' }}>
                          {w.buyer_note}
                        </div>
                      )}
                      {w.restaurant_spot && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(107,30,46,0.07)', border: '1px solid rgba(107,30,46,0.2)', padding: '5px 10px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--wine)', alignSelf: 'flex-start' }}>
                          🍽 {w.restaurant_spot}
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', zIndex: 200, borderTop: '2px solid rgba(212,173,69,0.4)' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 300 }}>
              {heartCount} wine{heartCount !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#d4ad45', marginTop: '2px' }}>
              £{totalValue.toFixed(2)} total
            </div>
          </div>
          <button onClick={sendWishlist} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '11px 22px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            ✉ Send Wishlist
          </button>
        </div>
      )}
    </div>
  )
}
