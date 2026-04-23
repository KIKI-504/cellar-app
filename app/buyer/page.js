'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function formatBottleSize(volume, format) {
  if (!volume && !format) return '75cl'
  const v = String(volume || format || '').toLowerCase().replace(/\s/g, '')
  if (v === '150' || v === '150cl' || v === '1500' || v === '1500ml' || v.includes('magnum')) return '150cl'
  if (v === '300' || v === '300cl' || v === '3000' || v === '3000ml' || v.includes('double')) return '300cl'
  if (v === '37.5' || v === '37.5cl' || v === '375' || v === '375ml' || v.includes('half')) return '37.5cl'
  return '75cl'
}

function bottleSortKey(volume, format) {
  const s = formatBottleSize(volume, format)
  if (s === '37.5cl') return 37.5
  if (s === '150cl') return 150
  if (s === '300cl') return 300
  return 75
}

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
  const [sortDir, setSortDir] = useState('asc')
  const [hearts, setHearts] = useState({})
  const [userName, setUserName] = useState('')
  const [expanded, setExpanded] = useState({})
  const [tooltip, setTooltip] = useState(null) // { text, x, y, type: 'women' | 'producer' }

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
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle, restaurant_spot')
      .order('description')
    if (error) { console.error(error) }
    else {
      const buyerWines = (data || []).filter(w => w.include_in_buyer_view === true && w.sale_price !== null)
      setWines(buyerWines)
      setFiltered(buyerWines)
    }
    setLoading(false)
  }

  function cycleSort(field) {
    if (sortCol === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(field); setSortDir('asc') }
  }

  function sortIcon(field) {
    if (sortCol !== field) return <span style={{ opacity: 0.4, fontSize: '9px' }}>↕</span>
    return <span style={{ fontSize: '9px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
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
      let av, bv
      if (sortCol === 'description') { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase() }
      else if (sortCol === 'vintage') { av = a.vintage || ''; bv = b.vintage || '' }
      else if (sortCol === 'colour') { av = (a.colour || '').toLowerCase(); bv = (b.colour || '').toLowerCase() }
      else if (sortCol === 'region') { av = (a.region || '').toLowerCase(); bv = (b.region || '').toLowerCase() }
      else if (sortCol === 'format') { av = bottleSortKey(a.bottle_volume, a.bottle_format); bv = bottleSortKey(b.bottle_volume, b.bottle_format) }
      else if (sortCol === 'quantity') { av = parseInt(a.quantity) || 0; bv = parseInt(b.quantity) || 0 }
      else if (sortCol === 'sale_price') { av = parseFloat(a.sale_price) || 0; bv = parseFloat(b.sale_price) || 0 }
      else if (sortCol === 'ws') { av = parseFloat(a.ws_lowest_per_bottle) || 0; bv = parseFloat(b.ws_lowest_per_bottle) || 0 }
      else { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase() }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    setFiltered(result)
  }, [wines, search, filterColour, filterRegion, filterWomen, sortCol, sortDir])

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

  function toggleExpanded(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function showTooltip(e, text, type) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ text, type, x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 8 })
  }

  function sendWishlist() {
    const list = wines.filter(w => hearts[w.id])
    const totalBottles = list.reduce((sum, w) => sum + (hearts[w.id] || 0), 0)
    const totalValue = list.reduce((sum, w) => sum + parseFloat(w.sale_price) * (hearts[w.id] || 1), 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const divider = '─'.repeat(50)

    const wineLines = list.map(w => {
      const qty = hearts[w.id] || 1
      const total = (parseFloat(w.sale_price) * qty).toFixed(2)
      const size = formatBottleSize(w.bottle_volume, w.bottle_format)
      return [
        `${w.vintage}  ${w.description}`,
        `      ${w.region}${w.country ? ' · ' + w.country : ''} · ${w.colour} · ${size}`,
        `      £${parseFloat(w.sale_price).toFixed(2)} per bottle · Qty: ${qty} · Subtotal: £${total}`,
      ].join('\n')
    })

    const body = [
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

    const subject = encodeURIComponent(`Wishlist — ${userName} — ${new Date().toLocaleDateString('en-GB')}`)
    const encodedBody = encodeURIComponent(body)
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${subject}&body=${encodedBody}`
  }

  const regions = [...new Set(wines.map(w => w.region).filter(Boolean))].sort()
  const heartCount = Object.keys(hearts).length
  const totalBottles = Object.values(hearts).reduce((sum, q) => sum + q, 0)
  const womenCount = wines.filter(w => w.women_note).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading selection…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: heartCount > 0 ? '80px' : '40px' }}>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', top: tooltip.y, left: tooltip.x, zIndex: 1000, background: 'var(--ink)', color: 'var(--white)', padding: '10px 14px', maxWidth: '280px', fontSize: '11px', lineHeight: 1.6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: tooltip.type === 'women' ? '#d4748a' : '#d4ad45', marginBottom: '5px' }}>
            {tooltip.type === 'women' ? '♀ Women in wine' : '🍷 Producer'}
          </div>
          {tooltip.text}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      {/* Header */}
      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(107,30,46,0.4) 0%, transparent 60%)', color: 'var(--white)', padding: '32px 28px 28px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, letterSpacing: '0.04em', color: '#d4ad45', marginBottom: '10px' }}>Cheers, {userName}!</div>
        <div style={{ fontSize: '11px', color: 'rgba(253,250,245,0.45)', letterSpacing: '0.06em', lineHeight: 2 }}>
          🤍 Heart wines to build your wishlist
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          Hover <span style={{ color: '#d4748a' }}>♀</span> for women winemaker info
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          Hover <span style={{ color: '#d4ad45' }}>🍷</span> for producer info
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines…" style={{ flex: 1, minWidth: '200px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
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

        {/* Sort bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginRight: '2px' }}>Sort:</span>
          {[['description','Wine'],['vintage','Vintage'],['colour','Colour'],['region','Region'],['format','Format'],['quantity','Qty'],['sale_price','Price'],['ws','WS Avg']].map(([col, label]) => (
            <button key={col} onClick={() => cycleSort(col)}
              style={{ background: sortCol === col ? 'var(--ink)' : 'var(--white)', color: sortCol === col ? '#d4ad45' : 'var(--muted)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {label} {sortIcon(col)}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} available
          {womenCount > 0 && !filterWomen && <span style={{ marginLeft: '12px', color: '#9b3a4a' }}>♀ {womenCount} women-led producer{womenCount !== 1 ? 's' : ''}</span>}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', marginBottom: '8px' }}>No wines match your filters</div>
            <div style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>Try adjusting your search or filters</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 110px 90px 40px', background: 'var(--ink)', color: 'rgba(253,250,245,0.5)', padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <div>Wine</div>
              <div>Size</div>
              <div style={{ textAlign: 'center' }}>Qty</div>
              <div style={{ textAlign: 'right' }}>Price / btl</div>
              <div style={{ textAlign: 'right' }}>WS Avg</div>
              <div></div>
            </div>

            {filtered.map(w => {
              const hearted = !!hearts[w.id]
              const qty = hearts[w.id] || 1
              const maxQty = parseInt(w.quantity) || 1
              const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const size = formatBottleSize(w.bottle_volume, w.bottle_format)
              const isMag = size === '150cl' || size === '300cl'
              const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
              const duty = isMag ? 6 : 3
              const wsDp = ws ? (ws + duty) * 1.2 : null
              const salePrice = parseFloat(w.sale_price)
              const isBelowWs = wsDp && salePrice < wsDp
              const saving = isBelowWs ? (wsDp - salePrice).toFixed(2) : null
              const isExpanded = expanded[w.id]
              const hasNotes = !!(w.buyer_note || w.restaurant_spot)

              return (
                <div key={w.id} style={{ background: 'var(--white)' }}>

                  {/* Main row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 110px 90px 40px', padding: '14px 16px', alignItems: 'center', borderLeft: hearted ? '3px solid var(--wine)' : '3px solid transparent' }}>

                    {/* Wine name col */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.3 }}>{w.description}</span>
                        {w.women_note && (
                          <button
                            onMouseEnter={e => showTooltip(e, w.women_note, 'women')}
                            onMouseLeave={() => setTooltip(null)}
                            style={{ background: 'none', border: 'none', color: '#9b3a4a', fontSize: '12px', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>♀</button>
                        )}
                        {w.producer_note && (
                          <button
                            onMouseEnter={e => showTooltip(e, w.producer_note, 'producer')}
                            onMouseLeave={() => setTooltip(null)}
                            style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, opacity: 0.7 }}>🍷</button>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.04em', paddingLeft: '13px' }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--wine)', marginRight: '6px' }}>{w.vintage}</span>
                        {w.region}{w.country ? ` · ${w.country}` : ''}
                      </div>
                      {hasNotes && (
                        <button onClick={() => toggleExpanded(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', padding: '4px 0 0 13px', textTransform: 'uppercase' }}>
                          {isExpanded ? '▲ hide' : '▼ notes'}
                        </button>
                      )}
                    </div>

                    {/* Size */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink)', fontWeight: isMag ? 600 : 400 }}>{size}</div>

                    {/* Qty */}
                    <div style={{ textAlign: 'center' }}>
                      {hearted ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setQuantity(w.id, qty - 1, maxQty)} disabled={qty <= 1}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty <= 1 ? 'default' : 'pointer', fontSize: '14px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => setQuantity(w.id, qty + 1, maxQty)} disabled={qty >= maxQty}
                            style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty >= maxQty ? 'default' : 'pointer', fontSize: '14px', opacity: qty >= maxQty ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{maxQty} avail</span>
                      )}
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>£{salePrice.toFixed(2)}</div>
                      {isBelowWs && (
                        <div style={{ fontSize: '9px', color: '#2a7a4b', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>−£{saving} vs WS avg</div>
                      )}
                      {hearted && (
                        <div style={{ fontSize: '9px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>×{qty} = £{(salePrice * qty).toFixed(2)}</div>
                      )}
                    </div>

                    {/* WS avg */}
                    <div style={{ textAlign: 'right' }}>
                      {isBelowWs ? (
                        <div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#2a7a4b', fontWeight: 600, letterSpacing: '0.04em' }}>Below WS</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>£{wsDp.toFixed(2)}</div>
                        </div>
                      ) : wsDp ? (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>£{wsDp.toFixed(2)}</div>
                      ) : (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--border)' }}>—</div>
                      )}
                    </div>

                    {/* Heart */}
                    <div style={{ textAlign: 'right' }}>
                      <button onClick={() => toggleHeart(w.id)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>
                        {hearted ? '❤️' : '🤍'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded notes */}
                  {isExpanded && hasNotes && (
                    <div style={{ padding: '0 16px 16px 29px', borderLeft: hearted ? '3px solid var(--wine)' : '3px solid transparent', background: 'var(--cream)' }}>
                      {w.buyer_note && (
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6, marginBottom: w.restaurant_spot ? '10px' : '0' }}>
                          {w.buyer_note}
                        </div>
                      )}
                      {w.restaurant_spot && (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8b2535', letterSpacing: '0.05em' }}>
                          {w.restaurant_spot}
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', zIndex: 200 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>{heartCount} wine{heartCount !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}</div>
          <button onClick={sendWishlist} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Send Wishlist</button>
        </div>
      )}
    </div>
  )
}
