'use client'
export const dynamic = 'force-dynamic'
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
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle')
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
    setFiltered(result)
  }, [wines, search, filterColour, filterRegion, filterWomen])

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
      return [
        `${w.vintage}  ${w.description}`,
        `      ${w.region}${w.country ? ' · ' + w.country : ''} · ${w.colour}${w.bottle_format ? ' · ' + w.bottle_format : ''}${w.bottle_volume ? ' ' + w.bottle_volume : ''}`,
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
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: heartCount > 0 ? '80px' : '0' }}>

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
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
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

        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''} available
          {womenCount > 0 && !filterWomen && <span style={{ marginLeft: '12px', color: '#9b3a4a' }}>♀ {womenCount} women-led producer{womenCount !== 1 ? 's' : ''}</span>}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, marginBottom: '8px', color: 'var(--ink)' }}>No wines available</div>
            <div style={{ fontSize: '12px' }}>Check back soon — the selection is updated regularly.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filtered.map(w => {
              const hearted = !!hearts[w.id]
              const qty = hearts[w.id] || 1
              const maxQty = parseInt(w.quantity) || 1
              const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const hasBadges = !!(w.women_note || w.producer_note)
              const badgeCount = (w.women_note ? 1 : 0) + (w.producer_note ? 1 : 0)
              const leftPad = badgeCount === 2 ? '60px' : badgeCount === 1 ? '32px' : '0'

              return (
                <div key={w.id} style={{ background: 'var(--white)', border: `1px solid ${hearted ? 'var(--wine)' : 'var(--border)'}`, padding: '20px', position: 'relative', transition: 'box-shadow 0.2s, transform 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,20,16,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; setTooltip(null) }}>

                  {/* Heart button */}
                  <button onClick={() => toggleHeart(w.id)} style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>
                    {hearted ? '❤️' : '🤍'}
                  </button>

                  {/* Badge icons — ♀ and/or 🍷 */}
                  {hasBadges && (
                    <div style={{ position: 'absolute', top: '14px', left: '14px', display: 'flex', gap: '4px' }}>
                      {w.women_note && (
                        <button
                          onMouseEnter={e => showTooltip(e, w.women_note, 'women')}
                          onMouseLeave={() => setTooltip(null)}
                          style={{ background: 'rgba(155,58,74,0.08)', border: '1px solid rgba(155,58,74,0.3)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '11px', color: '#9b3a4a', padding: 0, flexShrink: 0 }}>
                          ♀
                        </button>
                      )}
                      {w.producer_note && (
                        <button
                          onMouseEnter={e => showTooltip(e, w.producer_note, 'producer')}
                          onMouseLeave={() => setTooltip(null)}
                          style={{ background: 'rgba(212,173,69,0.1)', border: '1px solid rgba(212,173,69,0.4)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '11px', padding: 0, flexShrink: 0 }}>
                          🍷
                        </button>
                      )}
                    </div>
                  )}

                  {/* Wine info */}
                  <div style={{ paddingLeft: leftPad, paddingRight: '28px' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300, color: 'var(--wine)', lineHeight: 1, marginBottom: '6px' }}>{w.vintage}</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.35, marginBottom: '8px' }}>{w.description}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: w.buyer_note ? '10px' : '14px', lineHeight: 1.6 }}>
                      <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, marginRight: '4px', verticalAlign: 'middle' }}></span>
                      {w.colour} &nbsp;·&nbsp; {w.region}
                      {w.bottle_format ? ` · ${w.bottle_format}` : ''}
                      {w.bottle_volume ? ` ${w.bottle_volume}` : ''}
                    </div>
                    {/* Buyer note — shown inline */}
                    {w.buyer_note && (
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.6, opacity: 0.8, marginBottom: '14px', borderLeft: '2px solid var(--border)', paddingLeft: '10px' }}>
                        {w.buyer_note}
                      </div>
                    )}
                  </div>

                  {/* Price + qty */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', fontWeight: 500, color: 'var(--ink)' }}>£{parseFloat(w.sale_price).toFixed(2)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }}>per bottle · in bond</div>
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
                    <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--wine)', fontWeight: 500 }}>
                      Subtotal: £{(parseFloat(w.sale_price) * qty).toFixed(2)}
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
