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

function Hook({ note }) {
  if (!note) return null
  return (
    <span style={{
      display: 'inline-block', verticalAlign: 'baseline',
      border: '1px solid var(--wine)', color: 'var(--wine)',
      padding: '1px 8px 2px', marginRight: '9px',
      fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', fontWeight: 600,
      letterSpacing: '0.01em', lineHeight: 1.3, whiteSpace: 'nowrap',
    }}>{note}</span>
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
  const [filterCountry, setFilterCountry] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterVintage, setFilterVintage] = useState('')
  const [sortCol, setSortCol] = useState('colour')
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
    supabase.from('studio').select('id', { count: 'exact', head: true }).eq('include_in_local', true).eq('status', 'Available').gt('quantity', 0)
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
      .select('*, wines(id, description, vintage, colour, region, country, buyer_note, producer_note, women_note, sommelier_note, bottle_volume)')
      .eq('include_in_local', true).eq('status', 'Available').gt('quantity', 0).order('created_at', { ascending: false })
    setWines(data || []); setLoading(false)
  }

  function toggleWishlist(id, qty) {
    setWishlist(prev => { if (prev[id]) { const next = { ...prev }; delete next[id]; return next }; return { ...prev, [id]: qty } })
  }
  function setWishlistQty(id, qty) { setWishlist(prev => ({ ...prev, [id]: qty })) }

  function getWineName(s) { return s.wines?.description || s.unlinked_description || 'Unknown wine' }
  // Split "Wine, Cuvée, Producer, Region" into a wine line and a producer line. Trailing region/country segments are dropped.
  function splitName(s) {
    const full = getWineName(s)
    const region = (getWineRegion(s) || '').toLowerCase(); const country = (getWineCountry(s) || '').toLowerCase()
    let parts = full.split(',').map(t => t.trim()).filter(Boolean)
    while (parts.length > 1 && [region, country].includes(parts[parts.length - 1].toLowerCase())) parts.pop()
    if (parts.length < 2) return { wine: full, producer: '' }
    return { wine: parts.slice(0, -1).join(', '), producer: parts[parts.length - 1] }
  }
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
    return <span style={{ fontSize: '10px', marginLeft: '3px', color: GOLD }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
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
      if (filterCountry && getWineCountry(s) !== filterCountry) return false
      if (filterRegion && getWineRegion(s) !== filterRegion) return false
      if (filterVintage && String(getWineVintage(s)) !== filterVintage) return false
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
      else { av = getWineName(a).toLowerCase(); bv = getWineName(b).toLowerCase() }
      if (typeof av === 'number') {
        if (av === bv && sortCol === 'colour') {
          // secondary sort by vintage when colour is equal
          const avv = getWineVintage(a); const bvv = getWineVintage(b)
          return sortDir === 'asc' ? String(avv).localeCompare(String(bvv)) : String(bvv).localeCompare(String(avv))
        }
        return sortDir === 'asc' ? av - bv : bv - av
      }
      if (av === bv && sortCol === 'colour') {
        // secondary sort by vintage when colour is equal
        const avv = getWineVintage(a); const bvv = getWineVintage(b)
        return sortDir === 'asc' ? String(avv).localeCompare(String(bvv)) : String(bvv).localeCompare(String(avv))
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

  const countryOptions = [...new Set(wines.map(getWineCountry).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const regionOptions = [...new Set(wines.filter(s => !filterCountry || getWineCountry(s) === filterCountry).map(getWineRegion).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const vintageOptions = [...new Set(wines.map(getWineVintage).filter(Boolean).map(String))].sort((a, b) => b.localeCompare(a))
  const anyFilter = !!(search || filterColour || filterCountry || filterRegion || filterVintage)
  function clearFilters() { setSearch(''); setFilterColour(''); setFilterCountry(''); setFilterRegion(''); setFilterVintage('') }
  const SORT_SELECT = [
    ['colour:asc', 'Colour'], ['name:asc', 'Name (A to Z)'], ['name:desc', 'Name (Z to A)'],
    ['price:asc', 'Price (low to high)'], ['price:desc', 'Price (high to low)'],
    ['vintage:asc', 'Vintage (oldest first)'], ['vintage:desc', 'Vintage (newest first)'],
    ['region:asc', 'Region'], ['format:desc', 'Size (largest first)'],
  ]
  function onSortSelect(v) { const [c, d] = v.split(':'); setSortCol(c); setSortDir(d) }
  function onCountryChange(v) { setFilterCountry(v); setFilterRegion('') }

  const wishlistCount = Object.keys(wishlist).length
  const GRID_DESKTOP = '3fr 120px 90px 70px 60px 48px 100px 56px'
  const GOLD = '#b8934a'
  const FIELD = { border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--ink)', padding: '9px 12px', fontFamily: SERIF, fontSize: '15px', outline: 'none', borderRadius: '2px', cursor: 'pointer', minWidth: '0' }
  const FIELD_LABEL = { fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '5px' }
  const SERIF = 'Cormorant Garamond, serif'
  const INFO = { fontFamily: SERIF, fontSize: '15px', lineHeight: 1.35, color: 'var(--muted)' }
  const INFO_INK = { ...INFO, color: 'var(--ink)' }
  const SELECT_MOBILE = { border: '1px solid var(--border)', background: 'var(--white)', padding: '10px 12px', fontFamily: SERIF, fontSize: '16px', outline: 'none', flex: 1, minWidth: 0, borderRadius: '2px' }

  function colHeader(field, label, align = 'left') {
    const active = sortCol === field
    return (
      <div onClick={() => cycleSort(field)} style={{
        textAlign: align, cursor: 'pointer', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: '3px',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        fontFamily: 'DM Mono, monospace', fontSize: '11px',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: active ? 'var(--ink)' : 'var(--muted)',
        fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      }}>
        {label}<SortArrow field={field} />
      </div>
    )
  }

  const SORT_OPTIONS = [
    ['name', 'Wine'], ['region', 'Region'], ['country', 'Country'],
    ['vintage', 'Vintage'], ['colour', 'Colour'], ['format', 'Size'],
    ['price', 'Price'], ['quantity', 'Qty'],
  ]

  const [typedName, setTypedName] = useState('')

  async function handleName() {
    if (!typedName.trim()) return
    // Use typed name for the greeting/wishlist, keep buyer record for editorial
    await loadWines(typedName.trim())
  }

  const currentMonth = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // ── PIN screen ────────────────────────────────────────────────────────────
  const GATE_WRAP = { minHeight: '100dvh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }
  const GATE_INPUT = { width: '100%', background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '16px', fontFamily: SERIF, fontSize: '20px', outline: 'none', textAlign: 'center', letterSpacing: '0.2em', boxSizing: 'border-box', marginBottom: '10px', borderRadius: '0' }
  const GATE_BUTTON = { width: '100%', background: 'var(--ink)', color: 'var(--cream)', border: 'none', padding: '16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }

  if (stage === 'pin') return (
    <div style={GATE_WRAP}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '360px' }}>
        <div style={{ fontFamily: SERIF, fontSize: '54px', fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1, marginBottom: '14px' }}>Bottles on Hand</div>
        <div style={{ fontFamily: SERIF, fontSize: '17px', fontStyle: 'italic', color: 'var(--muted)', marginBottom: '40px' }}>Private buyer access</div>

        {availableCount !== null && (
          <div style={{ fontFamily: SERIF, fontSize: '19px', color: 'var(--ink)', lineHeight: 1.3, marginBottom: '32px' }}>
            {availableCount} wine{availableCount !== 1 ? 's' : ''} in the studio right now
            <div style={{ fontSize: '14px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '2px' }}>updated {currentMonth}</div>
          </div>
        )}

        <input
          type="password" value={pinInput}
          onChange={e => { setPinInput(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && handlePin()}
          placeholder="PIN"
          style={{ ...GATE_INPUT, borderColor: pinError ? '#b94040' : 'var(--border)' }}
        />
        {pinError && <div style={{ fontFamily: SERIF, fontSize: '14px', fontStyle: 'italic', color: '#b94040', marginBottom: '10px' }}>That PIN isn't right. Try again.</div>}
        <button onClick={handlePin} style={GATE_BUTTON}>Enter the cellar</button>
      </div>
    </div>
  )

  // ── Name screen ─────────────────────────────────────────────────────────
  if (stage === 'name') return (
    <div style={GATE_WRAP}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '360px' }}>
        <div style={{ fontFamily: SERIF, fontSize: '54px', fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1, marginBottom: '14px' }}>Welcome</div>
        <div style={{ fontFamily: SERIF, fontSize: '17px', fontStyle: 'italic', color: 'var(--muted)', marginBottom: '40px' }}>What should we call you?</div>
        <input
          type="text" value={typedName}
          onChange={e => setTypedName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleName()}
          placeholder="Your name"
          autoFocus
          style={{ ...GATE_INPUT, letterSpacing: '0.02em' }}
        />
        <button onClick={handleName} style={GATE_BUTTON}>Browse the wines</button>
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
      <div style={{ background: 'var(--white)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 500, color: 'var(--ink)', letterSpacing: '0.01em' }}>Bottles on Hand</div>
        <button onClick={() => { setStage('pin'); setPinInput(''); setBuyer(null); setTypedName(''); setWines([]); setWishlist({}) }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '8px 12px', borderRadius: '2px' }}>Sign Out</button>
      </div>

      {/* Greeting */}
      <div style={{ padding: isMobile ? '22px 16px 14px' : '32px 28px 22px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Private buyer access</div>
        <div style={{ fontFamily: SERIF, fontSize: isMobile ? '34px' : '46px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.01em' }}>Cheers, {displayName}.</div>
        <div style={{ fontFamily: SERIF, fontSize: isMobile ? '16px' : '19px', fontStyle: 'italic', color: 'var(--muted)', marginTop: '8px' }}>
          {buyer?.editorial || 'Same day collection or delivery. Prices include duty, VAT and delivery.'}
        </div>
      </div>

      {/* Desktop filters */}
      {!isMobile && (
        <div style={{ margin: '0 28px 6px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '3px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={FIELD_LABEL}>Search</div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Wines, producers or regions" style={{ ...FIELD, width: '100%', boxSizing: 'border-box', cursor: 'text' }} />
          </div>
          <div>
            <div style={FIELD_LABEL}>Colour</div>
            <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={FIELD}>
              <option value="">All colours</option>
              <option value="Red">Red</option><option value="White">White</option><option value="Rosé">Rosé</option><option value="Sparkling">Sparkling</option><option value="Sweet">Sweet</option>
            </select>
          </div>
          <div>
            <div style={FIELD_LABEL}>Country</div>
            <select value={filterCountry} onChange={e => onCountryChange(e.target.value)} style={FIELD}>
              <option value="">All countries</option>
              {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={FIELD_LABEL}>Region</div>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={FIELD}>
              <option value="">All regions</option>
              {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div style={FIELD_LABEL}>Vintage</div>
            <select value={filterVintage} onChange={e => setFilterVintage(e.target.value)} style={FIELD}>
              <option value="">All vintages</option>
              {vintageOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={FIELD_LABEL}>Sort by</div>
            <select value={`${sortCol}:${sortDir}`} onChange={e => onSortSelect(e.target.value)} style={FIELD}>
              {SORT_SELECT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!SORT_SELECT.some(([v]) => v === `${sortCol}:${sortDir}`) && <option value={`${sortCol}:${sortDir}`}>Custom</option>}
            </select>
          </div>
          {anyFilter && <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: '9px 4px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap' }}>✕ Clear</button>}
        </div>
      )}

      <div style={{ padding: isMobile ? '14px' : '0' }}>

        {/* Mobile search */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Wines, producers or regions" style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', background: 'var(--white)', padding: '10px 12px', fontFamily: SERIF, fontSize: '16px', outline: 'none', boxSizing: 'border-box', borderRadius: '2px' }} />
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={SELECT_MOBILE}>
                <option value="">All Colours</option>
                <option value="Red">Red</option><option value="White">White</option><option value="Rosé">Rosé</option><option value="Sparkling">Sparkling</option><option value="Sweet">Sweet</option>
              </select>
              <select value={filterCountry} onChange={e => onCountryChange(e.target.value)} style={SELECT_MOBILE}>
                <option value="">All Countries</option>
                {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={SELECT_MOBILE}>
                <option value="">All Regions</option>
                {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterVintage} onChange={e => setFilterVintage(e.target.value)} style={SELECT_MOBILE}>
                <option value="">All Vintages</option>
                {vintageOptions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {anyFilter && <button onClick={clearFilters} style={{ background: 'none', border: 'none', padding: '0', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.06em' }}>✕ clear filters</button>}
          </div>
        )}

        {/* Mobile sort pills */}
        {isMobile && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '14px', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '0', paddingRight: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', width: 'max-content', paddingBottom: '4px' }}>
              {SORT_OPTIONS.map(([col, label]) => {
                const active = sortCol === col
                return (
                  <button key={col} onClick={() => cycleSort(col)} style={{ background: active ? 'var(--ink)' : 'var(--white)', color: active ? 'var(--cream)' : 'var(--muted)', border: '1px solid var(--border)', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap', minHeight: '36px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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

        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '8px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em', padding: isMobile ? '0' : '10px 28px 0' }}>
          {filtered.length} wine{filtered.length !== 1 ? 's' : ''}{!isMobile && <span style={{ opacity: 0.6 }}>  |  click a column heading to sort</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--muted)' }}>{anyFilter ? 'No wines match those filters.' : 'No wines available right now.'}</div>
        ) : isMobile ? (

          // ── MOBILE ────────────────────────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filtered.map(s => {
              const inWishlist = !!wishlist[s.id]
              const colour = getWineColour(s)
              const price = getPrice(s)
              const isMag = isMagnum(s.bottle_size || s.wines?.bottle_volume || '')
              const sizeLabel = isMag ? '150cl' : s.bottle_size === '37.5' ? '37.5cl' : s.bottle_size === '300' ? '300cl' : '75cl'
              const buyerNote = getBuyerNote(s)
              const producerNote = getProducerNote(s)
              const womenNote = getWomenNote(s)
              const sommelierNote = getSommelierNote(s)
              const region = getWineRegion(s)
              const country = getWineCountry(s)
              const metaParts = [region, country, getWineVintage(s), sizeLabel].filter(Boolean)
              const colourTag = colour ? `${colour} wine`.replace('Sparkling wine', 'Sparkling').replace('Sweet wine', 'Sweet') : 'Wine'
              const nameParts = splitName(s)
              const hasNote = !!(buyerNote || producerNote || sommelierNote)
              const noteVisible = hasNote && (showAllNotes || expandedNotes.has(s.id))
              const noteHinted = hasNote && !showAllNotes && !expandedNotes.has(s.id)

              return (
                <div key={s.id} style={{ background: 'var(--white)', borderLeft: inWishlist ? '4px solid var(--wine)' : '4px solid transparent', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, background: 'rgba(184,147,74,0.10)', padding: '3px 7px', borderRadius: '2px' }}>{colourTag}</span>
                          {womenNote && (<span onClick={e => { e.stopPropagation(); setTooltip(prev => prev?.id === s.id ? null : { id: s.id, text: womenNote, x: e.clientX, y: e.clientY }) }} style={{ fontFamily: SERIF, fontSize: '16px', cursor: 'pointer', color: '#9b3a4a', lineHeight: 1 }}>♀</span>)}
                        </div>
                        <div style={{ fontFamily: SERIF, fontSize: '19px', lineHeight: 1.25, color: 'var(--ink)', fontWeight: 600 }}>{nameParts.wine}{isMag ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--wine)', fontWeight: 700, marginLeft: '6px', letterSpacing: '0.06em' }}>MAG</span> : null}</div>
                        {nameParts.producer && <div style={{ ...INFO_INK, fontSize: '16px' }}>{nameParts.producer}</div>}
                      </div>
                    </div>
                    <button onClick={() => toggleWishlist(s.id, 1)} aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'} style={{ background: inWishlist ? 'var(--wine)' : GOLD, border: 'none', color: 'var(--white)', borderRadius: '50%', fontSize: '26px', fontWeight: 300, lineHeight: 1, cursor: 'pointer', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{inWishlist ? '−' : '+'}</button>
                  </div>


                  <div style={{ ...INFO, fontSize: '16px', marginBottom: '8px', paddingLeft: '0' }}>{metaParts.join(', ')}</div>

                  {noteVisible && (
                    <div style={{ paddingLeft: '0', marginBottom: '10px' }}>
                      {(sommelierNote || buyerNote) && <div style={{ fontFamily: SERIF, fontSize: '16px', color: 'var(--ink)', lineHeight: 1.55, marginBottom: producerNote ? '8px' : 0 }}><Hook note={sommelierNote} />{buyerNote}</div>}
                      {producerNote && <div style={{ fontFamily: SERIF, fontSize: '16px', color: 'var(--muted)', lineHeight: 1.55 }}>{producerNote}</div>}
                      {!showAllNotes && (<button onClick={e => { e.stopPropagation(); toggleNoteExpanded(s.id) }} style={{ marginTop: '6px', background: 'none', border: 'none', padding: '0', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.06em' }}>▲ hide</button>)}
                    </div>
                  )}
                  {noteHinted && (
                    <div style={{ paddingLeft: '0', marginBottom: '10px' }}>
                      {sommelierNote && <div style={{ marginBottom: '6px' }}><Hook note={sommelierNote} /></div>}
                      <button onClick={e => { e.stopPropagation(); toggleNoteExpanded(s.id) }} style={{ background: 'none', border: 'none', padding: '0', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.06em', opacity: 0.7 }}>▼ notes</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <div style={{ fontFamily: SERIF, fontSize: '21px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{price ? `£${price.toFixed(2)}` : 'POA'}</div>
                        {inWishlist && price && <div style={{ fontFamily: SERIF, fontSize: '14px', color: 'var(--wine)', marginTop: '3px' }}>×{wishlist[s.id]} = £{(price * wishlist[s.id]).toFixed(2)}</div>}
                      </div>
                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button onClick={() => setWishlistQty(s.id, Math.max(1, (wishlist[s.id] || 1) - 1))} style={{ width: '36px', height: '36px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 500, minWidth: '20px', textAlign: 'center' }}>{wishlist[s.id]}</span>
                          <button onClick={() => setWishlistQty(s.id, Math.min(s.quantity, (wishlist[s.id] || 1) + 1))} style={{ width: '36px', height: '36px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      ) : (
                        <div style={INFO}>{s.quantity} available</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        ) : (

          // ── DESKTOP ───────────────────────────────────────────────────────
          <div style={{ margin: '0 28px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID_DESKTOP, background: 'var(--cream)', padding: '11px 20px', position: 'sticky', top: '56px', zIndex: 50, borderBottom: '1px solid var(--border)' }}>
              {colHeader('name', 'Wine')}
              {colHeader('region', 'Region')}
              {colHeader('country', 'Country')}
              {colHeader('vintage', 'Vintage')}
              {colHeader('format', 'Size')}
              {colHeader('quantity', 'Qty', 'center')}
              {colHeader('price', 'Price / btl', 'right')}
              <div></div>
            </div>
            {filtered.map(s => {
              const inWishlist = !!wishlist[s.id]
              const colour = getWineColour(s)
              const price = getPrice(s)
              const isMag = isMagnum(s.bottle_size || s.wines?.bottle_volume || '')
              const sizeLabel = isMag ? '150cl' : s.bottle_size === '37.5' ? '37.5cl' : s.bottle_size === '300' ? '300cl' : '75cl'
              const buyerNote = getBuyerNote(s)
              const producerNote = getProducerNote(s)
              const womenNote = getWomenNote(s)
              const sommelierNote = getSommelierNote(s)
              const region = getWineRegion(s)
              const country = getWineCountry(s)
              const colourTag = colour ? `${colour} wine`.replace('Sparkling wine', 'Sparkling').replace('Sweet wine', 'Sweet') : 'Wine'
              const nameParts = splitName(s)
              return (
                <div key={s.id} style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID_DESKTOP, padding: '18px 20px', alignItems: 'baseline', borderLeft: inWishlist ? '3px solid var(--wine)' : '3px solid transparent' }}>
                    {/* Wine name + notes */}
                    <div style={{ paddingRight: '28px', borderRight: '1px solid var(--border)', marginRight: '20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, background: 'rgba(184,147,74,0.10)', padding: '3px 7px', borderRadius: '2px' }}>{colourTag}</span>
                        {womenNote && (
                          <span onClick={e => { e.stopPropagation(); setTooltip(prev => prev?.id === s.id ? null : { id: s.id, text: womenNote, x: e.clientX, y: e.clientY }) }}
                            style={{ cursor: 'pointer', color: '#9b3a4a', fontFamily: SERIF, fontSize: '15px', lineHeight: 1 }} title="Women in wine">♀</span>
                        )}
                      </div>
                      <div style={{ fontFamily: SERIF, fontSize: '19px', lineHeight: 1.25, color: 'var(--ink)', fontWeight: 600 }}>
                        {nameParts.wine}{isMag ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--wine)', fontWeight: 700, marginLeft: '6px', letterSpacing: '0.06em', verticalAlign: 'middle' }}>MAG</span> : null}
                      </div>
                      {nameParts.producer && <div style={{ ...INFO_INK, fontSize: '16px', marginTop: '2px' }}>{nameParts.producer}</div>}
                      {(sommelierNote || buyerNote) && <div style={{ fontFamily: SERIF, fontSize: '15px', color: 'var(--ink)', lineHeight: 1.5, marginTop: '8px', maxWidth: '68ch' }}><Hook note={sommelierNote} />{buyerNote}</div>}
                      {producerNote && <div style={{ fontFamily: SERIF, fontSize: '15px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px', maxWidth: '68ch' }}>{producerNote}</div>}
                    </div>
                    {/* Region */}
                    <div style={{ ...INFO, paddingRight: '8px' }}>{region || '—'}</div>
                    {/* Country */}
                    <div style={{ ...INFO, paddingRight: '8px' }}>{country || '—'}</div>
                    {/* Vintage */}
                    <div style={INFO_INK}>{getWineVintage(s)}</div>
                    {/* Size */}
                    <div style={{ ...INFO, color: isMag ? 'var(--ink)' : 'var(--muted)', fontWeight: isMag ? 600 : 400 }}>{sizeLabel}</div>
                    {/* Qty / stepper */}
                    <div style={{ textAlign: 'center' }}>
                      {inWishlist ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setWishlistQty(s.id, Math.max(1, (wishlist[s.id] || 1) - 1))} style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ ...INFO_INK, fontWeight: 600, minWidth: '16px', textAlign: 'center' }}>{wishlist[s.id]}</span>
                          <button onClick={() => setWishlistQty(s.id, Math.min(s.quantity, (wishlist[s.id] || 1) + 1))} style={{ width: '22px', height: '22px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      ) : (
                        <span style={INFO}>{s.quantity}</span>
                      )}
                    </div>
                    {/* Price */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...INFO_INK, fontWeight: 700 }}>{price ? `£${price.toFixed(2)}` : 'POA'}</div>
                      {inWishlist && price && <div style={{ fontFamily: SERIF, fontSize: '13px', color: 'var(--wine)', marginTop: '1px' }}>×{wishlist[s.id]} = £{(price * wishlist[s.id]).toFixed(2)}</div>}
                    </div>
                    {/* + button */}
                    <div style={{ textAlign: 'right', alignSelf: 'start' }}>
                      <button onClick={() => toggleWishlist(s.id, 1)} aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'} style={{ background: inWishlist ? 'var(--wine)' : GOLD, border: 'none', color: 'var(--white)', borderRadius: '50%', fontSize: '24px', fontWeight: 300, lineHeight: 1, cursor: 'pointer', width: '40px', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{inWishlist ? '−' : '+'}</button>
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--white)', padding: '14px 28px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, borderTop: '1px solid var(--border)', boxShadow: '0 -6px 24px rgba(0,0,0,0.08)' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '19px', color: 'var(--ink)', lineHeight: 1 }}>
              {wishlistCount} wine{wishlistCount > 1 ? 's' : ''} · {Object.values(wishlist).reduce((a, b) => a + b, 0)} bottle{Object.values(wishlist).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: '15px', color: 'var(--muted)', marginTop: '3px' }}>
              £{Object.entries(wishlist).reduce((sum, [id, qty]) => { const s = wines.find(w => w.id === id); const p = s ? getPrice(s) : null; return sum + (p ? p * qty : 0) }, 0).toFixed(2)} total
            </div>
          </div>
          <button onClick={sendWishlist} style={{ background: 'var(--ink)', color: 'var(--cream)', border: 'none', padding: '13px 22px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, minHeight: '48px' }}>Send wishlist</button>
        </div>
      )}
    </div>
  )
}
