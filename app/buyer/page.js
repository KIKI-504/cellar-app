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
  const [prevSort, setPrevSort] = useState(null) // for region toggle
  const [selected, setSelected] = useState({})
  const [expanded, setExpanded] = useState({})
  const [tooltip, setTooltip] = useState(null)

  const [buyerName, setBuyerName] = useState('')
  const [buyerDisplayName, setBuyerDisplayName] = useState('')
  const [buyerEditorial, setBuyerEditorial] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [buyerAccessId, setBuyerAccessId] = useState(null)
  const [showTerms, setShowTerms] = useState(true)

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    const pin = sessionStorage.getItem('pin')
    if (role !== 'buyer' && role !== 'admin') { router.push('/'); return }
    setIsAdmin(role === 'admin')
    resolveBuyerAndFetch(role, pin)
  }, [])

  async function resolveBuyerAndFetch(role, pin) {
    setLoading(true)
    if (role === 'admin') {
      setBuyerDisplayName('Master Buyer View')
      setBuyerName('Admin')
      const { data } = await supabase
        .from('wines')
        .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle')
        .eq('include_in_buyer_view', true)
        .not('sale_price', 'is', null)
        .order('description')
      setWines(data || []); setFiltered(data || []); setLoading(false); return
    }

    const { data: buyer } = await supabase
      .from('buyer_access')
      .select('id, name, display_name, editorial')
      .eq('pin', pin)
      .maybeSingle()

    if (!buyer) {
      setBuyerDisplayName('Current Selection'); setBuyerName('Guest')
      const { data } = await supabase
        .from('wines')
        .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle')
        .eq('include_in_buyer_view', true)
        .not('sale_price', 'is', null)
        .order('description')
      setWines(data || []); setFiltered(data || []); setLoading(false); return
    }

    setBuyerAccessId(buyer.id)
    setBuyerName(buyer.name)
    setBuyerDisplayName(buyer.display_name || buyer.name)
    setBuyerEditorial(buyer.editorial || '')

    const { data: assignments } = await supabase
      .from('buyer_wine_assignments')
      .select('wine_id')
      .eq('buyer_access_id', buyer.id)

    if (!assignments || assignments.length === 0) {
      setWines([]); setFiltered([]); setLoading(false); return
    }

    const wineIds = assignments.map(a => a.wine_id)
    const { data: wineData } = await supabase
      .from('wines')
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle')
      .in('id', wineIds)
      .not('sale_price', 'is', null)
      .order('description')

    setWines(wineData || []); setFiltered(wineData || []); setLoading(false)
  }

  function cycleSort(field) {
    if (sortCol === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(field); setSortDir('asc') }
  }

  // Toggle region sort — if already sorted by region, go back to previous sort
  function toggleRegionSort() {
    if (sortCol === 'region') {
      const p = prevSort || { col: 'description', dir: 'asc' }
      setSortCol(p.col); setSortDir(p.dir); setPrevSort(null)
    } else {
      setPrevSort({ col: sortCol, dir: sortDir })
      setSortCol('region'); setSortDir('asc')
    }
  }

  function sortArrow(field) {
    if (sortCol !== field) return <span style={{ opacity: 0.3 }}>↕</span>
    return <span style={{ color: 'var(--wine)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
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

  function toggleSelected(id) {
    setSelected(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]; else next[id] = 1
      return next
    })
  }

  function setQuantity(id, qty, max) {
    const capped = Math.min(Math.max(1, parseInt(qty) || 1), max)
    setSelected(prev => ({ ...prev, [id]: capped }))
  }

  function toggleExpanded(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function showTooltip(e, text, type) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ text, type, x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 8 })
  }

  function sendWishlist() {
    const list = wines.filter(w => selected[w.id])
    const totalBottles = list.reduce((sum, w) => sum + (selected[w.id] || 0), 0)
    const totalValue = list.reduce((sum, w) => sum + parseFloat(w.sale_price) * (selected[w.id] || 1), 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const divider = '─'.repeat(50)
    const wineLines = list.map(w => {
      const qty = selected[w.id] || 1
      const total = (parseFloat(w.sale_price) * qty).toFixed(2)
      const size = formatBottleSize(w.bottle_volume, w.bottle_format)
      return [`${w.vintage}  ${w.description}`, `      ${w.region}${w.country ? ' · ' + w.country : ''} · ${w.colour} · ${size}`, `      £${parseFloat(w.sale_price).toFixed(2)} per bottle · Qty: ${qty} · Subtotal: £${total}`].join('\n')
    })
    const body = [`WISHLIST — ${buyerDisplayName.toUpperCase()}`, date, '', 'WINES SELECTED', divider, '', wineLines.join('\n\n'), '', divider, `TOTAL: ${list.length} wine${list.length !== 1 ? 's' : ''} · ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''} · £${totalValue.toFixed(2)}`, '', 'All prices per bottle, duty and VAT paid.', 'Please reply to confirm availability.'].join('\n')
    const subject = encodeURIComponent(`Wishlist — ${buyerDisplayName} — ${new Date().toLocaleDateString('en-GB')}`)
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${subject}&body=${encodeURIComponent(body)}`
  }

  // ── Print price list ────────────────────────────────────────────────────────
  function printPriceList() {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    // Print in current sort order (so if sorted by region, prints by region)
    const rows = filtered.map(w => {
      const size = formatBottleSize(w.bottle_volume, w.bottle_format)
      const isMag = size === '150cl' || size === '300cl'
      const duty = isMag ? 6 : 3
      const salePrice = parseFloat(w.sale_price)
      const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
      const wsDp = ws ? (ws + duty) * 1.2 : null
      const isBelowWs = wsDp && salePrice < wsDp
      const saving = isBelowWs ? (wsDp - salePrice).toFixed(2) : null
      const qty = parseInt(w.quantity) || 0
      const col = (w.colour || '').toLowerCase()
      const dotCol = col.includes('red') ? '#8b2535' : col.includes('white') ? '#b5a430' : col.includes('ros') ? '#d4748a' : col.includes('spark') ? '#5a8fa8' : '#aaa'

      return `<tr>
        <td style="padding:9px 10px 9px 0;border-bottom:1px solid #ede6d6;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotCol};margin-right:5px;vertical-align:middle;"></span>
          <span style="font-family:'Cormorant Garamond',serif;font-size:14px;font-weight:500;vertical-align:middle;">${w.description}${w.women_note ? ' <span style="color:#9b3a4a;font-size:12px;">♀</span>' : ''}</span>
        </td>
        <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${w.vintage || '—'}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${w.region || '—'}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${w.colour || '—'}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:${isMag ? '12px' : '11px'};font-weight:${isMag ? '700' : '400'};color:${isMag ? '#1a1008' : '#7a6652'};">${size}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;text-align:center;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${qty}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:#1a1008;">£${salePrice.toFixed(2)}</td>
        <td style="padding:9px 0 9px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${wsDp ? '£' + wsDp.toFixed(2) : '—'}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${buyerDisplayName}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'DM Mono', monospace; color: #1a1008; background: #fff; padding: 40px 48px; font-size: 12px; }
      @media print { body { padding: 20px 28px; } }
    </style>
    </head><body>

    <div style="margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #1a1008;">
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
        <div style="text-align:right;">
          <div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:300;letter-spacing:0.08em;color:#7a6652;">Belle Année</div>
          <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#c8b89a;margin-top:1px;">Wines &amp; Studio</div>
        </div>
      </div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:300;letter-spacing:0.02em;color:#1a1008;margin-bottom:4px;">${buyerDisplayName}</div>
      ${buyerName && buyerName !== buyerDisplayName && buyerName !== 'Admin' && buyerName !== 'Guest'
        ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;margin-bottom:4px;">For ${buyerName}</div>`
        : ''}
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:#c8b89a;">${date}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #1a1008;">
          <th style="padding:7px 10px 7px 0;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Wine</th>
          <th style="padding:7px 8px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Vintage</th>
          <th style="padding:7px 8px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Region</th>
          <th style="padding:7px 8px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Colour</th>
          <th style="padding:7px 8px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Size</th>
          <th style="padding:7px 8px;text-align:center;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Avail</th>
          <th style="padding:7px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Price / btl</th>
          <th style="padding:7px 0 7px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Market Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #ede6d6;display:flex;justify-content:space-between;align-items:baseline;">
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:#c8b89a;letter-spacing:0.06em;">
        ${wines.length} wine${wines.length !== 1 ? 's' : ''} · All prices per bottle · Duty and VAT paid
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:#c8b89a;letter-spacing:0.06em;">
        jessica.bride@gmail.com
      </div>
    </div>

    </body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none;'
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 3000)
    }
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
  }

  const regions = [...new Set(wines.map(w => w.region).filter(Boolean))].sort()
  const selectedCount = Object.keys(selected).length
  const totalBottles = Object.values(selected).reduce((sum, q) => sum + q, 0)
  const womenCount = wines.filter(w => w.women_note).length
  const sortingByRegion = sortCol === 'region'
  const CONTENT = '1400px'

  const colHead = (label, field, align = 'left') => (
    <div onClick={() => cycleSort(field)}
      style={{ textAlign: align, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', color: sortCol === field ? 'var(--wine)' : 'var(--muted)', transition: 'color 0.15s' }}>
      {label} {sortArrow(field)}
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading selection…</div>
    </div>
  )

  // ── Design tokens ────────────────────────────────────────────────
  const C = {
    inkDeep: '#1b070d',
    ink: '#34101c',
    wine: '#6e1f2e',
    gold: '#c6a15b',
    cream: '#f4efe6',
    card: '#fbf8f1',
    line: '#e7decd',
    text: '#352a20',
    muted: '#9a8c76',
    white: '#fffdf9',
  }
  const GRID = '1fr 90px 90px 70px 130px 130px 56px'
  const heroGrad = 'linear-gradient(100deg, #3a0e1a 0%, #2a0a12 46%, #15060b 100%)'

  // ── Per-client hero image + title / date split ───────────────────
  const heroSlug = (buyerName && buyerName !== 'Admin' && buyerName !== 'Guest')
    ? buyerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : ''
  const heroImg = heroSlug ? '/clients/' + heroSlug + '.png' : ''
  const dashIdx = buyerDisplayName.lastIndexOf(' - ')
  const titleMain = dashIdx > -1 ? buyerDisplayName.slice(0, dashIdx) : buyerDisplayName
  const titleDate = dashIdx > -1 ? buyerDisplayName.slice(dashIdx + 3).toUpperCase() : ''
  const titleRest = (heroSlug && titleMain.startsWith(buyerName)) ? titleMain.slice(buyerName.length).trim() : ''
  const editorialText = buyerEditorial || ''

  // ── Inline icons ─────────────────────────────────────────────────
  const ic = { width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const IconBox = (<svg viewBox="0 0 24 24" {...ic}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>)
  const IconCheck = (<svg viewBox="0 0 24 24" {...ic}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9z" /><path d="M9 13l2 2 4-4" /></svg>)
  const IconCal = (<svg viewBox="0 0 24 24" {...ic}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>)
  const IconGlass = (<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={C.gold} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10l-1 7a4 4 0 0 1-8 0L7 3z" /><path d="M12 17v3M9 21h6" /></svg>)
  const IconSearch = (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>)
  const IconPrinter = (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="1" /><path d="M7 17h10v4H7z" /></svg>)

  const pillar = (icon, title, body) => (
    <div style={{ display: 'flex', gap: '14px' }}>
      <div style={{ color: C.wine, flexShrink: 0, marginTop: '2px' }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500, color: C.text, marginBottom: '4px' }}>{title}</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15.5px', color: '#5c4f3f', lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  )

  const headCell = (label, field, align = 'left') => (
    <div onClick={() => cycleSort(field)}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', cursor: 'pointer', userSelect: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: sortCol === field ? C.gold : 'rgba(255,253,249,0.72)' }}>
      {label}<span style={{ fontSize: '9px', opacity: sortCol === field ? 1 : 0.45 }}>{sortCol === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </div>
  )

  const pillBtn = (active) => ({ background: active ? C.wine : C.white, color: active ? C.white : C.text, border: '1px solid ' + (active ? C.wine : C.line), borderRadius: '999px', padding: '11px 18px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', cursor: 'pointer', whiteSpace: 'nowrap', outline: 'none' })

  return (
    <div style={{ minHeight: '100vh', background: C.cream, paddingBottom: selectedCount > 0 ? '88px' : '48px' }}>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', top: tooltip.y, left: tooltip.x, zIndex: 1000, background: C.inkDeep, color: C.white, padding: '10px 14px', maxWidth: '280px', fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.5, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', borderRadius: '8px', pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: tooltip.type === 'women' ? '#e0a4b2' : C.gold, marginBottom: '5px' }}>
            {tooltip.type === 'women' ? '♀ Women in wine' : 'Producer note'}
          </div>
          {tooltip.text}
        </div>
      )}

      {/* Nav */}
      <header style={{ background: C.inkDeep, color: C.white, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: CONTENT, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '14px 40px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 400, color: C.white, lineHeight: 1 }}>Belle Année</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold, marginTop: '3px' }}>Wines &amp; Studio</div>
          </div>
          <nav style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
            {['Wines', 'Buyers', 'About', 'Services', 'Contact'].map(item => (
              <span key={item} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', color: item === 'Buyers' ? C.white : 'rgba(255,253,249,0.62)', borderBottom: item === 'Buyers' ? '2px solid ' + C.gold : '2px solid transparent', paddingBottom: '3px', cursor: 'default' }}>{item}</span>
            ))}
          </nav>
          {wines.length > 0 ? (
            <button onClick={printPriceList}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,253,249,0.08)', border: '1px solid rgba(255,253,249,0.45)', color: C.white, fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', padding: '9px 18px', borderRadius: '9px', cursor: 'pointer' }}>
              {IconPrinter} Print
            </button>
          ) : <div style={{ width: '90px' }} />}
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: heroGrad, color: C.white }}>
        <div style={{ position: 'relative', maxWidth: CONTENT, margin: '0 auto', padding: '60px 40px 76px', minHeight: '300px', overflow: 'hidden' }}>
          {heroImg && (
            <img src={heroImg} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
              style={{ position: 'absolute', right: '0', bottom: '0', height: '118%', maxWidth: '52%', objectFit: 'contain', objectPosition: 'right bottom', pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(21,6,11,0.92) 0%, rgba(21,6,11,0.72) 38%, rgba(21,6,11,0) 64%)' }} />
          <div style={{ position: 'relative', maxWidth: '640px' }}>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '52px', fontWeight: 400, lineHeight: 1.08, color: C.white, margin: 0 }}>{titleRest ? (<>{buyerName}<br />{titleRest}</>) : titleMain}</h1>
            {titleDate && (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', letterSpacing: '0.22em', color: C.gold, marginTop: '14px' }}>{titleDate}</div>
            )}
            {editorialText && (
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '21px', fontWeight: 400, color: 'rgba(255,253,249,0.84)', lineHeight: 1.45, margin: '20px 0 0', maxWidth: '520px' }}>{editorialText}</p>
            )}
          </div>
        </div>
      </section>

      {/* How this works — floating card */}
      <div style={{ background: C.cream }}>
        <div style={{ maxWidth: CONTENT, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ marginTop: '-44px', background: C.card, borderRadius: '18px', boxShadow: '0 20px 50px rgba(40,12,20,0.16)', padding: '32px 38px', position: 'relative', zIndex: 5 }}>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: '74px', height: '74px', borderRadius: '50%', background: C.wine, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IconGlass}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: C.wine, fontWeight: 500, marginBottom: '20px' }}>How this works</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '34px' }}>
                  {pillar(IconBox, 'Flexible quantities', 'You choose how many bottles to take. Except that if a wine is offered as a set of 12, please take at least 6. Otherwise take as many or as few as you would like.')}
                  {pillar(IconCheck, 'Full transparency', 'You receive a full inventory and a delivery note with quantity and pricing on every delivery. Any faulted wine is removed at no cost to you.')}
                  {pillar(IconCal, 'Up to date', 'Each month when your team runs stock, send the current inventory. I invoice every 60 days for what has sold.')}
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid ' + C.line, marginTop: '24px', paddingTop: '16px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.04em', color: C.wine }}>Please note: Belle Année and Studio Jessica Bride are not VAT registered. Prices shown reflect VAT and duty paid.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: C.cream }}>
        <div style={{ maxWidth: CONTENT, margin: '0 auto', padding: '28px 40px 0' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: C.muted, display: 'flex' }}>{IconSearch}</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines, regions, vintages…"
                style={{ width: '100%', background: C.white, border: '1px solid ' + C.line, borderRadius: '999px', padding: '12px 18px 12px 46px', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.text, outline: 'none' }} />
            </div>
            <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={pillBtn(false)}>
              <option value="">All Colours</option>
              <option value="Red">Red</option>
              <option value="White">White</option>
              <option value="Rosé">Rosé</option>
            </select>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={pillBtn(false)}>
              <option value="">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={toggleRegionSort} style={pillBtn(sortingByRegion)}>{sortingByRegion ? '✓ By Region' : 'Sort: Region'}</button>
            {womenCount > 0 && (
              <button onClick={() => setFilterWomen(v => !v)} style={{ ...pillBtn(filterWomen), color: filterWomen ? C.white : '#9b3a4a', background: filterWomen ? '#9b3a4a' : C.white, border: '1px solid rgba(155,58,74,0.5)' }}>♀ {filterWomen ? '✓' : ''}</button>
            )}
            <div style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{filtered.length} wine{filtered.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.cream }}>
        <div style={{ maxWidth: CONTENT, margin: '0 auto', padding: '20px 40px 0' }}>
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid ' + C.line, boxShadow: '0 12px 34px rgba(40,12,20,0.07)' }}>

            {/* Header band */}
            <div style={{ background: C.ink, display: 'grid', gridTemplateColumns: GRID, padding: '14px 24px', alignItems: 'center' }}>
              <div></div>
              {headCell('Vintage', 'vintage')}
              {headCell('Size', 'format')}
              {headCell('Qty', 'quantity', 'center')}
              {headCell('Price / btl', 'sale_price', 'right')}
              {headCell('Market Price', 'ws', 'right')}
              <div></div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ background: C.white, textAlign: 'center', padding: '54px 20px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: C.text, marginBottom: '6px' }}>{wines.length === 0 ? 'No wines assigned yet' : 'No wines match your filters'}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.muted }}>{wines.length === 0 ? 'Please check back soon.' : 'Try clearing a filter.'}</div>
              </div>
            ) : filtered.map((w, i) => {
              const isSelected = !!selected[w.id]
              const qty = selected[w.id] || 1
              const stock = parseInt(w.quantity) || 0
              const soldOut = stock <= 0
              const maxQty = stock
              const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#c9b76a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
              const size = formatBottleSize(w.bottle_volume, w.bottle_format)
              const isMag = size === '150cl' || size === '300cl'
              const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
              const duty = isMag ? 6 : 3
              const wsDp = ws ? (ws + duty) * 1.2 : null
              const salePrice = parseFloat(w.sale_price)
              const isExpanded = expanded[w.id]
              const hasNotes = !!w.buyer_note
              return (
                <div key={w.id} style={{ background: C.white }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '16px 24px', alignItems: 'center', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid ' + C.line, borderLeft: isSelected ? '3px solid ' + C.wine : '3px solid transparent', opacity: soldOut ? 0.5 : 1 }}>
                    <div style={{ paddingRight: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 500, color: C.text, lineHeight: 1.2 }}>{w.description}</span>
                        {w.women_note && (
                          <button onMouseEnter={e => showTooltip(e, w.women_note, 'women')} onMouseLeave={() => setTooltip(null)}
                            style={{ background: 'none', border: 'none', color: '#9b3a4a', fontSize: '12px', cursor: 'pointer', padding: '0 1px', lineHeight: 1, flexShrink: 0 }}>♀</button>
                        )}
                        {w.producer_note && (
                          <button onMouseEnter={e => showTooltip(e, w.producer_note, 'producer')} onMouseLeave={() => setTooltip(null)}
                            style={{ background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', padding: '0 1px', lineHeight: 1, flexShrink: 0, opacity: 0.75 }}>🍷</button>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.muted, paddingLeft: '14px' }}>{w.region}{w.country ? ' · ' + w.country : ''}</div>
                      {hasNotes && (
                        <button onClick={() => toggleExpanded(w.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: C.muted, letterSpacing: '0.04em', padding: '3px 0 0 14px' }}>{isExpanded ? '▲ hide' : '▼ notes'}</button>
                      )}
                    </div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.text }}>{w.vintage || '—'}</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.text, fontWeight: isMag ? 600 : 400 }}>{size}</div>
                    <div style={{ textAlign: 'center' }}>
                      {soldOut ? (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sold out</span>
                      ) : isSelected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={() => setQuantity(w.id, qty - 1, maxQty)} disabled={qty <= 1} style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid ' + C.line, background: C.cream, cursor: qty <= 1 ? 'default' : 'pointer', fontSize: '14px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>−</button>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => setQuantity(w.id, qty + 1, maxQty)} disabled={qty >= maxQty} style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid ' + C.line, background: C.cream, cursor: qty >= maxQty ? 'default' : 'pointer', fontSize: '14px', opacity: qty >= maxQty ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.text }}>{maxQty}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 500, color: C.text, lineHeight: 1 }}>£{salePrice.toFixed(2)}</div>
                      {isSelected && <div style={{ fontSize: '9px', color: C.wine, fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>×{qty} = £{(salePrice * qty).toFixed(2)}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {wsDp ? (
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontStyle: 'italic', color: C.muted }}>£{wsDp.toFixed(2)}</div>
                      ) : (
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontStyle: 'italic', color: C.line }}>—</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {!soldOut && (
                        <button onClick={() => toggleSelected(w.id)}
                          style={{ width: '34px', height: '34px', borderRadius: '8px', border: isSelected ? '2px solid ' + C.wine : '1px solid ' + C.line, background: isSelected ? C.wine : C.white, color: isSelected ? C.white : C.wine, cursor: 'pointer', fontSize: '18px', fontWeight: 300, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', transition: 'all 0.15s' }}>{isSelected ? '✓' : '+'}</button>
                      )}
                    </div>
                  </div>
                  {isExpanded && hasNotes && (
                    <div style={{ background: C.cream, padding: '0 24px 14px 28px', borderLeft: isSelected ? '3px solid ' + C.wine : '3px solid transparent' }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: C.text, lineHeight: 1.6 }}>{w.buyer_note}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Order bar */}
      {selectedCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.inkDeep, color: C.white, zIndex: 200, boxShadow: '0 -8px 30px rgba(0,0,0,0.25)' }}>
          <div style={{ maxWidth: CONTENT, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>{selectedCount} wine{selectedCount !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}</div>
            <button onClick={sendWishlist} style={{ background: C.gold, color: C.inkDeep, border: 'none', padding: '11px 26px', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', fontWeight: 500 }}>Send Order</button>
          </div>
        </div>
      )}
    </div>
  )
}
