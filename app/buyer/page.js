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
        <td style="padding:9px 0 9px 8px;border-bottom:1px solid #ede6d6;text-align:right;">
          <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:#1a1008;">£${salePrice.toFixed(2)}</div>
          ${isBelowWs ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:#2a7a4b;margin-top:1px;">−£${saving} vs WS</div>` : ''}
        </td>
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
          <th style="padding:7px 0 7px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Price / btl</th>
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: selectedCount > 0 ? '80px' : '40px' }}>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', top: tooltip.y, left: tooltip.x, zIndex: 1000, background: 'var(--ink)', color: 'var(--white)', padding: '10px 14px', maxWidth: '280px', fontSize: '11px', lineHeight: 1.6, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: tooltip.type === 'women' ? '#d4748a' : '#d4ad45', marginBottom: '5px' }}>
            {tooltip.type === 'women' ? '♀ Women in wine' : 'Producer note'}
          </div>
          {tooltip.text}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '48px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {wines.length > 0 && (
            <button onClick={printPriceList}
              style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>
              🖨 Print
            </button>
          )}
          <button onClick={() => { sessionStorage.clear(); router.push('/') }}
            style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--ink)', backgroundImage: 'radial-gradient(ellipse at 28% 0%, rgba(107,30,46,0.28) 0%, transparent 68%)', color: 'var(--white)', padding: '30px 20px 32px' }}>
        <div style={{ maxWidth: '760px' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(212,173,69,0.85)', marginBottom: '12px' }}>
            Belle Année · Wines &amp; Studio
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '34px', fontWeight: 300, letterSpacing: '0.01em', color: 'var(--white)', lineHeight: 1.1, marginBottom: ((buyerName && buyerName !== buyerDisplayName && buyerName !== 'Admin' && buyerName !== 'Guest') || buyerEditorial) ? '12px' : '0' }}>
            {buyerDisplayName}
          </div>
          {buyerName && buyerName !== buyerDisplayName && buyerName !== 'Admin' && buyerName !== 'Guest' && (
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.45)', marginBottom: buyerEditorial ? '14px' : '0' }}>
              For {buyerName}
            </div>
          )}
          {buyerEditorial && (
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontStyle: 'italic', fontWeight: 300, color: 'rgba(253,250,245,0.78)', maxWidth: '560px', lineHeight: 1.55 }}>
              {buyerEditorial}
            </div>
          )}
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(253,250,245,0.4)', marginTop: '18px' }}>
            Tap + to add a wine to your order{womenCount > 0 ? " · hover ♀ for the winemaker's story" : ''}
          </div>
        </div>
      </div>

      {/* Standing terms — cream card, shown to every buyer */}
      <div style={{ background: 'var(--cream)', padding: '22px 20px 0' }}>
        <div style={{ maxWidth: '760px', background: 'var(--white)', border: '1px solid var(--border)', borderTop: '2px solid var(--wine)', padding: '20px 24px' }}>
          <button onClick={() => setShowTerms(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showTerms ? '▾' : '▸'} How this works
          </button>
          {showTerms && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontStyle: 'italic', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.45, margin: 0 }}>
                This is a curated selection of wines offered to you on consignment. Please enjoy the shopping!
              </p>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15.5px', color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>
                A few notes: I am flexible on how many bottles you take, with one exception: where a wine is offered as a set of 12, you will need to take at least 6, as I pull the full case of 12 from bonded storage. For everything else, take as few or as many as you like.
              </p>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15.5px', color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>
                I provide a full inventory and a physical and emailed copy of a delivery note with quantity and pricing each time I make a delivery. Each month, when your team runs its wine stock count, simply send me the current consignment inventory. I invoice every 60 days for what has sold. If any wines are faulted, simply let me know and I will remove them from your inventory at no cost to you.
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.05em', color: 'var(--wine)', lineHeight: 1.6, margin: 0, paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                I am not VAT registered. Prices shown reflect VAT and duty paid.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Controls — filters + column headers, on cream */}
      <div style={{ background: 'var(--cream)', padding: '18px 20px 0' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines…"
            style={{ flex: 1, minWidth: '160px', background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)}
            style={{ background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
            style={{ background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {/* Sort by Region toggle */}
          <button onClick={toggleRegionSort}
            style={{ background: sortingByRegion ? 'var(--wine)' : 'var(--white)', color: sortingByRegion ? 'var(--white)' : 'var(--muted)', border: `1px solid ${sortingByRegion ? 'var(--wine)' : 'var(--border)'}`, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {sortingByRegion ? '✓ By Region' : 'Sort: Region'}
          </button>
          {womenCount > 0 && (
            <button onClick={() => setFilterWomen(v => !v)}
              style={{ background: filterWomen ? '#9b3a4a' : 'var(--white)', color: filterWomen ? 'var(--white)' : '#9b3a4a', border: '1px solid rgba(155,58,74,0.45)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ♀ {filterWomen ? '✓' : ''}
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
            {filtered.length} wine{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px 80px 36px', padding: '8px 0', fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {colHead('Wine', 'description')}
          {colHead('Size', 'format')}
          {colHead('Qty', 'quantity', 'center')}
          {colHead('Price / btl', 'sale_price', 'right')}
          {colHead('WS Avg', 'ws', 'right')}
          <div></div>
        </div>
      </div>

      {/* Wine list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', marginBottom: '6px' }}>
            {wines.length === 0 ? 'No wines assigned yet' : 'No wines match your filters'}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
            {wines.length === 0 ? 'Check back soon' : 'Try adjusting your search or filters'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
          {filtered.map(w => {
            const isSelected = !!selected[w.id]
            const qty = selected[w.id] || 1
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
            const hasNotes = !!w.buyer_note

            return (
              <div key={w.id} style={{ background: 'var(--white)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 100px 80px 36px', padding: '10px 0', alignItems: 'center', borderLeft: isSelected ? '3px solid var(--wine)' : '3px solid transparent' }}>
                  <div style={{ paddingLeft: isSelected ? '13px' : '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.25 }}>{w.description}</span>
                      {w.women_note && (
                        <button onMouseEnter={e => showTooltip(e, w.women_note, 'women')} onMouseLeave={() => setTooltip(null)}
                          style={{ background: 'none', border: 'none', color: '#9b3a4a', fontSize: '11px', cursor: 'pointer', padding: '0 1px', lineHeight: 1, flexShrink: 0 }}>♀</button>
                      )}
                      {w.producer_note && (
                        <button onMouseEnter={e => showTooltip(e, w.producer_note, 'producer')} onMouseLeave={() => setTooltip(null)}
                          style={{ background: 'none', border: 'none', fontSize: '10px', cursor: 'pointer', padding: '0 1px', lineHeight: 1, flexShrink: 0, opacity: 0.7 }}>🍷</button>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', paddingLeft: '11px' }}>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '12px', color: 'var(--wine)', marginRight: '5px' }}>{w.vintage}</span>
                      {w.region}{w.country ? ` · ${w.country}` : ''}
                    </div>
                    {hasNotes && (
                      <button onClick={() => toggleExpanded(w.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '8px', color: 'var(--muted)', letterSpacing: '0.08em', padding: '3px 0 0 11px', textTransform: 'uppercase' }}>
                        {isExpanded ? '▲ hide' : '▼ notes'}
                      </button>
                    )}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', fontWeight: isMag ? 600 : 400 }}>{size}</div>
                  <div style={{ textAlign: 'center' }}>
                    {isSelected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                        <button onClick={() => setQuantity(w.id, qty - 1, maxQty)} disabled={qty <= 1} style={{ width: '20px', height: '20px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty <= 1 ? 'default' : 'pointer', fontSize: '13px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>−</button>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 500, minWidth: '14px', textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => setQuantity(w.id, qty + 1, maxQty)} disabled={qty >= maxQty} style={{ width: '20px', height: '20px', border: '1px solid var(--border)', background: 'var(--cream)', cursor: qty >= maxQty ? 'default' : 'pointer', fontSize: '13px', opacity: qty >= maxQty ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace' }}>+</button>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>{maxQty}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: '6px' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>£{salePrice.toFixed(2)}</div>
                    {isBelowWs && <div style={{ fontSize: '8px', color: '#2a7a4b', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>−£{saving} vs WS</div>}
                    {isSelected && <div style={{ fontSize: '8px', color: 'var(--wine)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>×{qty} = £{(salePrice * qty).toFixed(2)}</div>}
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: '6px' }}>
                    {isBelowWs ? (
                      <div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#2a7a4b', fontWeight: 600 }}>Below WS</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)' }}>£{wsDp.toFixed(2)}</div>
                      </div>
                    ) : wsDp ? (
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)' }}>£{wsDp.toFixed(2)}</div>
                    ) : (
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--border)' }}>—</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={() => toggleSelected(w.id)}
                      style={{ width: '26px', height: '26px', border: isSelected ? '2px solid var(--wine)' : '1px solid var(--border)', background: isSelected ? 'var(--wine)' : 'transparent', color: isSelected ? 'var(--white)' : 'var(--muted)', borderRadius: '2px', cursor: 'pointer', fontSize: '16px', fontWeight: 300, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', transition: 'all 0.15s' }}>
                      {isSelected ? '✓' : '+'}
                    </button>
                  </div>
                </div>
                {isExpanded && hasNotes && (
                  <div style={{ padding: '0 14px 12px 25px', borderLeft: isSelected ? '3px solid var(--wine)' : '3px solid transparent', background: 'var(--cream)' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.6 }}>{w.buyer_note}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Order bar */}
      {selectedCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', zIndex: 200 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>{selectedCount} wine{selectedCount !== 1 ? 's' : ''} · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}</div>
          <button onClick={sendWishlist} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '8px 18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Send Order</button>
        </div>
      )}
    </div>
  )
}
