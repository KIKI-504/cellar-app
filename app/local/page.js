'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function isMagnum(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  return s === '150' || s === '150cl' || s === '1500' || s === '1500ml' || s.includes('magnum')
}

function bottleSortKey(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  if (s.includes('37.5') || s.includes('half')) return 37.5
  if (isMagnum(s)) return 150
  if (s.includes('300') || s.includes('double')) return 300
  return 75
}

function SommelierHook({ note }) {
  if (!note) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: '#d4ad45', color: '#1a1008',
      padding: '3px 10px 3px 7px',
      fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)',
      whiteSpace: 'nowrap', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      ▶ {note}
    </div>
  )
}

export default function LocalPage() {
  const [stage, setStage] = useState('pin')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [buyer, setBuyer] = useState(null) // { name, display_name, editorial }
  const [wines, setWines] = useState([])
  const [availableCount, setAvailableCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [wishlist, setWishlist] = useState({})
  const [search, setSearch] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [tooltip, setTooltip] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState(new Set())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch count for login screen
  useEffect(() => {
    supabase.from('studio').select('id', { count: 'exact', head: true }).eq('include_in_local', true).eq('status', 'Available')
      .then(({ count }) => setAvailableCount(count || 0))
  }, [])

  function toggleNoteExpanded(id) {
    setExpandedNotes(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleShowAllNotes() { setShowAllNotes(prev => !prev); setExpandedNotes(new Set()) }

  async function handlePin() {
    if (!pinInput.trim()) return
    const { data } = await supabase.from('local_access').select('name, display_name, editorial').eq('pin', pinInput.trim()).maybeSingle()
    if (!data) { setPinError(true); setPinInput('') }
    else { setPinError(false); setBuyer(data); setStage('name') }
  }

  async function loadWines(nameOverride) {
    if (nameOverride) setTypedName(nameOverride)
    setLoading(true); setStage('browse')
    const { data } = await supabase.from('studio')
      .select('*, wines(id, description, vintage, colour, region, country, buyer_note, producer_note, women_note, sommelier_note, ws_lowest_per_bottle, ws_price_date, bottle_volume)')
      .eq('include_in_local', true).eq('status', 'Available').order('created_at', { ascending: false })
    setWines(data || []); setLoading(false)
  }

  function toggleWishlist(id, qty) {
    setWishlist(prev => { if (prev[id]) { const next = { ...prev }; delete next[id]; return next }; return { ...prev, [id]: qty } })
  }
  function setWishlistQty(id, qty) { setWishlist(prev => ({ ...prev, [id]: qty })) }

  function getWineName(s) { return s.wines?.description || s.unlinked_description || 'Unknown wine' }
  function getWineVintage(s) { return s.wines?.vintage || s.unlinked_vintage || '' }
  function getWineRegion(s) { return s.wines?.region || '' }
  function getWineCountry(s) { return s.wines?.country || '' }
  function getWineColour(s) { return s.wines?.colour || s.colour || '' }
  function getWomenNote(s) { return s.wines?.women_note || '' }
  function getSommelierNote(s) { return s.wines?.sommelier_note || '' }
  function getBuyerNote(s) { return s.wines?.buyer_note || '' }
  function getProducerNote(s) { return s.wines?.producer_note || '' }
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
      return `${qty} × ${getWineName(s)} ${getWineVintage(s)} — ${price ? `£${price.toFixed(2)}/btl` : 'POA'}`
    }).filter(Boolean)
    if (!items.length) return
    const totalBottles = Object.values(wishlist).reduce((a, b) => a + b, 0)
    const totalValue = Object.entries(wishlist).reduce((sum, [id, qty]) => {
      const s = wines.find(w => w.id === id); const price = s ? getPrice(s) : null; return sum + (price ? price * qty : 0)
    }, 0)
    const displayName = typedName || buyer?.display_name || buyer?.name || 'Guest'
    const text = [
      `Bottles on Hand Wishlist — ${displayName}`,
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      '',
      ...items,
      '',
      `${items.length} wine${items.length !== 1 ? 's' : ''} · ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''} · £${totalValue.toFixed(2)}`,
      '',
      'Please reply to confirm availability.',
    ].join('\n')
    const subject = encodeURIComponent(`Wishlist — ${displayName} — ${new Date().toLocaleDateString('en-GB')}`)
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${subject}&body=${encodeURIComponent(text)}`
  }

  const filtered = wines
    .filter(s => {
      if (filterColour && getWineColour(s)?.toLowerCase() !== filterColour.toLowerCase()) return false
      if (search) { const q = search.toLowerCase(); return [getWineName(s), getWineVintage(s), getWineRegion(s), getWineCountry(s)].join(' ').toLowerCase().includes(q) }
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortCol === 'name')          { av = getWineName(a).toLowerCase();    bv = getWineName(b).toLowerCase() }
      else if (sortCol === 'vintage')  { av = getWineVintage(a);               bv = getWineVintage(b) }
      else if (sortCol === 'colour')   { av = getWineColour(a).toLowerCase();  bv = getWineColour(b).toLowerCase() }
      else if (sortCol === 'region')   { av = getWineRegion(a).toLowerCase();  bv = getWineRegion(b).toLowerCase() }
      else if (sortCol === 'country')  { av = getWineCountry(a).toLowerCase(); bv = getWineCountry(b).toLowerCase() }
      else if (sortCol === 'format')   { av = bottleSortKey(a.bottle_size || a.wines?.bottle_volume); bv = bottleSortKey(b.bottle_size || b.wines?.bottle_volume) }
      else if (sortCol === 'quantity') { av = a.quantity || 0;                 bv = b.quantity || 0 }
      else if (sortCol === 'price')    { av = getPrice(a) || 0;                bv = getPrice(b) || 0 }
      else if (sortCol === 'ws')       { av = parseFloat(a.wines?.ws_lowest_per_bottle) || 0; bv = parseFloat(b.wines?.ws_lowest_per_bottle) || 0 }
      else { av = getWineName(a).toLowerCase(); bv = getWineName(b).toLowerCase() }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

  const wishlistCount = Object.keys(wishlist).length
  const GRID_DESKTOP = '2fr 90px 90px 60px 60px 80px 60px 110px 44px'

  function colHeader(field, label, align = 'left') {
    const active = sortCol === field
    return (
      <div onClick={() => cycleSort(field)} style={{
        textAlign: align, cursor: 'pointer', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: '3px',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        fontFamily: 'DM Mono, monospace', fontSize: '11px',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: active ? '#d4ad45' : 'rgba(253,250,245,0.65)',
        fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      }}>
        {label}<SortArrow field={field} />
      </div>
    )
  }

  const SORT_OPTIONS = [
    ['name', 'Wine'], ['region', 'Region'], ['country', 'Country'],
    ['vintage', 'Vintage'], ['colour', 'Colour'], ['format', 'Size'],
    ['price', 'Price'], ['ws', 'WS Avg'], ['quantity', 'Qty'],
  ]

  const [typedName, setTypedName] = useState('')

  async function handleName() {
    if (!typedName.trim()) return
    // Use typed name for the greeting/wishlist, keep buyer record for editorial
    await loadWines(typedName.trim())
  }

  const currentMonth = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // ── PIN screen ────────────────────────────────────────────────────────────
  if (stage === 'pin') return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 50% 45%, #3a2a0a 0%, #1a1008 55%, #0e0a04 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '380px' }}>

        {/* Wordmark */}
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '52px', fontWeight: 300, color: '#c9a84c', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '10px' }}>Bottles on Hand</div>
        <div style={{ width: '48px', height: '1px', background: 'rgba(201,168,76,0.35)', margin: '0 auto 12px' }}></div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.55)', marginBottom: '36px' }}>Private Buyer Access</div>

        {/* Count */}
        {availableCount !== null && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', color: '#c9a84c', letterSpacing: '0.02em', lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600 }}>{availableCount}</span>
              <span style={{ fontWeight: 300 }}> wines currently available</span>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.4)', marginTop: '6px' }}>Updated {currentMonth}</div>
          </div>
        )}

        {/* Second divider */}
        <div style={{ width: '48px', height: '1px', background: 'rgba(201,168,76,0.25)', margin: '28px auto 28px' }}></div>

        {/* PIN input */}
        <input
          type="password" value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && handlePin()}
          placeholder="ENTER PIN"
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: pinError ? '1px solid #c0392b' : '1px solid rgba(201,168,76,0.18)', color: 'rgba(201,168,76,0.7)', padding: '18px', fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', textAlign: 'center', letterSpacing: '0.3em', boxSizing: 'border-box', marginBottom: '10px', borderRadius: '3px' }}
        />
        {pinError && <div style={{ fontSize: '11px', color: '#c0392b', fontFamily: 'DM Mono, monospace', marginBottom: '10px', letterSpacing: '0.06em' }}>Incorrect PIN — please try again</div>}
        <button onClick={handlePin} style={{ width: '100%', background: '#c9a84c', color: '#1a1008', border: 'none', padding: '18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, borderRadius: '3px' }}>Enter Cellar →</button>

        {/* Footer */}
        <div style={{ marginTop: '48px', fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.25)' }}>Private Buyer Access</div>
      </div>
    </div>
  )

  // ── Name screen ─────────────────────────────────────────────────────────
  if (stage === 'name') return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 50% 45%, #3a2a0a 0%, #1a1008 55%, #0e0a04 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '380px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '52px', fontWeight: 300, color: '#c9a84c', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '10px' }}>Welcome</div>
        <div style={{ width: '48px', height: '1px', background: 'rgba(201,168,76,0.35)', margin: '0 auto 12px' }}></div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.55)', marginBottom: '40px' }}>What's your name?</div>
        <input
          type="text" value={typedName}
          onChange={e => setTypedName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleName()}
          placeholder="YOUR NAME"
          autoFocus
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.18)', color: 'rgba(201,168,76,0.85)', padding: '18px', fontFamily: 'DM Mono, monospace', fontSize: '14px', outline: 'none', textAlign: 'center', letterSpacing: '0.15em', boxSizing: 'border-box', marginBottom: '10px', borderRadius: '3px' }}
        />
        <button onClick={handleName} style={{ width: '100%', background: '#c9a84c', color: '#1a1008', border: 'none', padding: '18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, borderRadius: '3px' }}>Browse Wines →</button>
        <div style={{ marginTop: '48px', fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.25)' }}>Private Buyer Access</div>
      </div>
    </div>
  )

  // ── Browse screen ────────────────────────────────────────────────────────
  const displayName = typedName || buyer?.display_name || buyer?.name || 'there'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)', paddingBottom: wishlistCount > 0 ? 'calc(80px + env(safe-area-inset-bottom))' : 'calc(40px + env(safe-area-inset-bottom))' }} onClick={() => setTooltip(null)}>

      {/* Women note tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', zIndex: 9999, left: Math.min(tooltip.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 260), top: tooltip.y + 16, background: 'var(--ink)', color: 'var(--white)', padding: '14px 16px', maxWidth: '260px', fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.6, boxShadow: '0 4px 24px rgba(0,0,0,0.45)', pointerEvents: 'none', borderLeft: '3px solid #9b3a4a' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '6px' }}>Women in Wine</div>
          {tooltip.text}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: 'var(--ink)', padding: '0 20px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.1em' }}>Bottles on Hand</div>
        <button onClick={() => { setStage('pin'); setPinInput(''); setBuyer(null); setTypedName(''); setWines([]); setWishlist({}) }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '8px 12px' }}>Sign Out</button>
      </div>

      {/* Hero — compact */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', padding: isMobile ? '16px 20px 20px' : '20px 28px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '900px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '24px' : '28px', fontWeight: 400, color: '#d4ad45', letterSpacing: '0.01em', lineHeight: 1 }}>Cheers, {displayName}.</span>
              {buyer?.editorial && <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: 'rgba(253,250,245,0.6)', fontStyle: 'italic' }}>{buyer.editorial}</span>}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(253,250,245,0.35)', marginTop: '6px', letterSpacing: '0.08em' }}>
              Same day collection or delivery · + to wishlist · <span style={{ color: 'rgba(201,96,122,0.7)' }}>♀</span> women in wine · Prices include duty, VAT & delivery
            </div>
          </div>
          {/* Search inline in header on desktop */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: '200px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--white)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', borderRadius: '2px' }} />
              <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(253,250,245,0.7)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', cursor: 'pointer', borderRadius: '2px' }}>
                <option value="">All colours</option>
                <option value="Red">Red</option><option value="White">White</option><option value="Rosé">Rosé</option><option value="Sparkling">Sparkling</option><option value="Sweet">Sweet</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: isMobile ? '14px' : '0' }}>

        {/* Mobile search */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines, region, country…" style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', background: 'var(--white)', padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
            <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '16px', outline: 'none', width: '100%' }}>
              <option value="">All Colours</option>
              <option value="Red">Red</option><option value="White">White</option><option value="Rosé">Rosé</option><option value="Sparkling">Sparkling</option><option value="Sweet">Sweet</option>
            </select>
          </div>
        )}

        {/* Mobile sort pills */}
        {isMobile && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '14px', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '16px', paddingRight: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', width: 'max-content', paddingBottom: '4px' }}>
              {SORT_OPTIONS.map(([col, label]) => {
                const active = sortCol === col
                return (
                  <button key={col} onClick={() => cycleSort(col)} style={{ background: active ? 'var(--ink)' : 'var(--white)', color: active ? '#d4ad45' : 'var(--muted)', border: '1px solid var(--border)', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap', minHeight: '36px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                )
              })}
              <div style={{ width: '1px', background: 'var(--border)', margin: '4px 2px', flexShrink: 0 }} />
              <button onClick={toggleShowAllNotes} style={{ background: showAllNotes ? 'var(--wine)' : 'var(--white)', color: showAllNotes ? 'var(--white)' : 'var(--muted)', border: showAllNotes ? '1px solid var(--wine)' : '1px solid var(--border)', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap', minHeight: '36px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                ✦ Notes {showAllNotes ? 'on' : 'off'}
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '8px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em', padding: isMobile ? '0' : '12px 16px 0' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''}{!isMobile && <span style={{ opacity: 0.6 }}> · click column headings to sort</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--muted)' }}>No wines available right now.</div>
        ) : isMobile ? (

          // ── MOBILE ────────────────────────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
              const buyerNote = getBuyerNote(s)
              const producerNote = getProducerNote(s)
              const womenNote = getWomenNote(s)
              const sommelierNote = getSommelierNote(s)
              const region = getWineRegion(s)
              const country = getWineCountry(s)
              const locationParts = [region, country].filter(Boolean)
              const hasNote = !!(buyerNote || producerNote)
              const noteVisible = hasNote && (showAllNotes || expandedNotes.has(s.id))
              const noteHinted = hasNote && !showAllNotes && !expandedNotes.has(s.id)

              return (
                <div key={s.id} style={{ background: 'var(--white)', borderLeft: inWishlist ? '4px solid var(--wine)' : '4px solid transparent', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '7px' }}></span>
                      {womenNote && (<span onClick={e => { e.stopPropagation(); setTooltip(prev => prev?.id === s.id ? null : { id: s.id, text: womenNote, x: e.clientX, y: e.clientY }) }} style={{ fontSize: '16px', cursor: 'pointer', flexShrink: 0, color: '#9b3a4a', lineHeight: 1, marginTop: '4px' }}>♀</span>)}
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '19px', lineHeight: 1.25, color: 'var(--ink)', fontWeight: isMag ? 700 : 400 }}>{getWineName(s)}</span>
                    </div>
                    <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: inWishlist ? 'var(--wine)' : 'var(--white)', border: inWishlist ? '2px solid var(--wine)' : '2px solid var(--border)', color: inWishlist ? 'var(--white)' : 'var(--ink)', borderRadius: '4px', fontSize: '26px', fontWeight: 300, lineHeight: 1, cursor: 'pointer', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{inWishlist ? '−' : '+'}</button>
                  </div>

                  {sommelierNote && <div style={{ paddingLeft: '16px', marginBottom: '8px' }}><SommelierHook note={sommelierNote} /></div>}

                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', paddingLeft: '16px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {getWineVintage(s) && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', fontWeight: 500 }}>{getWineVintage(s)}</span>}
                    {getWineVintage(s) && locationParts.length > 0 && <span style={{ opacity: 0.35 }}>·</span>}
                    {locationParts.length > 0 && <span>{locationParts.join(' · ')}</span>}
                    {(getWineVintage(s) || locationParts.length > 0) && <span style={{ opacity: 0.35 }}>·</span>}
                    <span style={{ fontWeight: isMag ? 600 : 400, color: isMag ? 'var(--ink)' : 'var(--muted)' }}>{sizeLabel}</span>
                  </div>

                  {noteVisible && (
                    <div style={{ paddingLeft: '16px', marginBottom: '10px' }}>
                      {buyerNote && <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.65, marginBottom: producerNote ? '8px' : 0 }}>{buyerNote}</div>}
                      {producerNote && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6 }}>{producerNote}</div>}
                      {!showAllNotes && (<button onClick={e => { e.stopPropagation(); toggleNoteExpanded(s.id) }} style={{ marginTop: '6px', background: 'none', border: 'none', padding: '0', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.06em' }}>▲ hide</button>)}
                    </div>
                  )}
                  {noteHinted && (
                    <div style={{ paddingLeft: '16px', marginBottom: '10px' }}>
                      <button onClick={e => { e.stopPropagation(); toggleNoteExpanded(s.id) }} style={{ background: 'none', border: 'none', padding: '0', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.06em', opacity: 0.7 }}>▼ notes</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', paddingLeft: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{price ? `£${price.toFixed(2)}` : 'POA'}</div>
                        {inWishlist && price && <div style={{ fontSize: '10px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>×{wishlist[s.id]} = £{(price * wishlist[s.id]).toFixed(2)}</div>}
                      </div>
                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button onClick={() => setWishlistQty(s.id, Math.max(1, (wishlist[s.id] || 1) - 1))} style={{ width: '36px', height: '36px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 500, minWidth: '20px', textAlign: 'center' }}>{wishlist[s.id]}</span>
                          <button onClick={() => setWishlistQty(s.id, Math.min(s.quantity, (wishlist[s.id] || 1) + 1))} style={{ width: '36px', height: '36px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{s.quantity} avail</div>
                      )}
                    </div>
                    {wsDp && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', fontWeight: 500 }}>WS £{wsDp.toFixed(2)}</div>
                        {wsDate && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(0,0,0,0.3)' }}>{wsDate}</div>}
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: isBelowWs ? '#2a7a4b' : '#b94040', fontWeight: 600 }}>{isBelowWs ? 'below' : 'above'} WS UK avg</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

        ) : (

          // ── DESKTOP ───────────────────────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID_DESKTOP, background: 'var(--ink)', padding: '9px 16px', position: 'sticky', top: '52px', zIndex: 50, borderBottom: '1px solid rgba(212,173,69,0.2)' }}>
              {colHeader('name', 'Wine')}
              {colHeader('region', 'Region')}
              {colHeader('country', 'Country')}
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
              const buyerNote = getBuyerNote(s)
              const producerNote = getProducerNote(s)
              const womenNote = getWomenNote(s)
              const sommelierNote = getSommelierNote(s)
              const region = getWineRegion(s)
              const country = getWineCountry(s)
              return (
                <div key={s.id} style={{ background: 'var(--white)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID_DESKTOP, padding: '11px 16px', alignItems: 'start', borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent' }}>
                    {/* Wine name + notes */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '5px' }}></span>
                        {womenNote && (
                          <span onClick={e => { e.stopPropagation(); setTooltip(prev => prev?.id === s.id ? null : { id: s.id, text: womenNote, x: e.clientX, y: e.clientY }) }}
                            style={{ fontSize: '14px', cursor: 'pointer', flexShrink: 0, color: '#9b3a4a', lineHeight: 1, marginTop: '2px' }}>♀</span>
                        )}
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', lineHeight: 1.25, color: 'var(--ink)', fontWeight: isMag ? 700 : 400 }}>{getWineName(s)}</span>
                      </div>
                      {sommelierNote && <div style={{ paddingLeft: '13px', marginTop: '5px', marginBottom: '6px' }}><SommelierHook note={sommelierNote} /></div>}
                      {buyerNote && <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '12px', color: 'rgba(26,16,8,0.8)', lineHeight: 1.55, paddingLeft: '13px', marginTop: '4px' }}>{buyerNote}</div>}
                      {producerNote && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', lineHeight: 1.5, paddingLeft: '13px', marginTop: '4px' }}>{producerNote}</div>}
                    </div>
                    {/* Region */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', paddingTop: '3px', paddingRight: '8px' }}>{region || '—'}</div>
                    {/* Country */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', paddingTop: '3px', paddingRight: '8px' }}>{country || '—'}</div>
                    {/* Size */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: isMag ? 'var(--ink)' : 'var(--muted)', fontWeight: isMag ? 600 : 400, paddingTop: '2px' }}>{sizeLabel}</div>
                    {/* Qty / stepper */}
                    <div style={{ textAlign: 'center', paddingTop: '2px' }}>
                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setWishlistQty(s.id, Math.max(1, (wishlist[s.id] || 1) - 1))} style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>{wishlist[s.id]}</span>
                          <button onClick={() => setWishlistQty(s.id, Math.min(s.quantity, (wishlist[s.id] || 1) + 1))} style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{s.quantity}</span>
                      )}
                    </div>
                    {/* Price */}
                    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{price ? `£${price.toFixed(2)}` : 'POA'}</div>
                      {inWishlist && price && <div style={{ fontSize: '9px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>×{wishlist[s.id]} = £{(price * wishlist[s.id]).toFixed(2)}</div>}
                    </div>
                    {/* Vintage */}
                    <div style={{ textAlign: 'right', paddingTop: '4px' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>{getWineVintage(s)}</span>
                    </div>
                    {/* WS avg */}
                    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                      {wsDp ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', fontWeight: 500 }}>£{wsDp.toFixed(2)}</div>
                          {wsDate && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(0,0,0,0.3)' }}>{wsDate}</div>}
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: isBelowWs ? '#2a7a4b' : '#b94040', fontWeight: 600 }}>{isBelowWs ? 'below' : 'above'} WS UK avg</div>
                        </div>
                      ) : <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--border)' }}>—</div>}
                    </div>
                    {/* + button */}
                    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
                      <button onClick={() => toggleWishlist(s.id, 1)} style={{ background: inWishlist ? 'var(--wine)' : 'var(--white)', border: inWishlist ? '2px solid var(--wine)' : '2px solid var(--border)', color: inWishlist ? 'var(--white)' : 'var(--ink)', borderRadius: '4px', fontSize: '22px', fontWeight: 300, lineHeight: 1, cursor: 'pointer', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{inWishlist ? '−' : '+'}</button>
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', padding: '14px 24px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.3)' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'var(--white)', lineHeight: 1 }}>
              {wishlistCount} wine{wishlistCount > 1 ? 's' : ''} · {Object.values(wishlist).reduce((a, b) => a + b, 0)} bottle{Object.values(wishlist).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(212,173,69,0.7)', marginTop: '3px', letterSpacing: '0.06em' }}>
              £{Object.entries(wishlist).reduce((sum, [id, qty]) => { const s = wines.find(w => w.id === id); const p = s ? getPrice(s) : null; return sum + (p ? p * qty : 0) }, 0).toFixed(2)} total
            </div>
          </div>
          <button onClick={sendWishlist} style={{ background: '#d4ad45', color: '#1a1008', border: 'none', padding: '13px 22px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, minHeight: '48px' }}>Send Wishlist →</button>
        </div>
      )}
    </div>
  )
}
