'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [wines, setWines] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [filterBuyer, setFilterBuyer] = useState('')
  const [sortCol, setSortCol] = useState('description')
  const [sortDir, setSortDir] = useState(1)
  const [page, setPage] = useState(0)
  const [showValues, setShowValues] = useState(false)
  const [expandedNote, setExpandedNote] = useState(null)
  const [expandedPrice, setExpandedPrice] = useState(null)
  const [expandedFlag, setExpandedFlag] = useState(null)
  const [flagNoteInput, setFlagNoteInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [importConflicts, setImportConflicts] = useState([])
  const [overrideModal, setOverrideModal] = useState(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [otherSourceName, setOtherSourceName] = useState('')
  const [showOtherSourceInput, setShowOtherSourceInput] = useState(false)
  const otherFileRef = useRef(null)

  // ─── WS focus retention ────────────────────────────────────────────────────
  const wsActiveWineId = useRef(null)
  const wsInputRefs = useRef({})

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && wsActiveWineId.current) {
        const input = wsInputRefs.current[wsActiveWineId.current]
        if (input) setTimeout(() => { input.focus(); input.select() }, 150)
        wsActiveWineId.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const PAGE_SIZE = 50

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchWines()
  }, [])

  async function fetchWines() {
    setLoading(true)
    const { data, error } = await supabase.from('wines').select('*').order('description')
    if (error) console.error(error)
    else { setWines(data); setFiltered(data) }
    setLoading(false)
  }

  useEffect(() => {
    let result = [...wines]
    if (filterSource) result = result.filter(w => w.source === filterSource)
    if (filterColour) result = result.filter(w => w.colour?.toLowerCase().includes(filterColour.toLowerCase()))
    if (filterBuyer === 'included') result = result.filter(w => w.include_in_buyer_view)
    if (filterBuyer === 'missing-retail') result = result.filter(w => !w.retail_price)
    if (filterBuyer === 'competitive') result = result.filter(w => isCompetitive(w))
    if (filterBuyer === 'women') result = result.filter(w => w.women_note)
    if (filterBuyer === 'flagged') result = result.filter(w => w.review_flag)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(w => [w.description, w.region, w.country, w.vintage, w.colour, w.source].join(' ').toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      let av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      if (typeof av === 'number') return (av - bv) * sortDir
      return String(av).localeCompare(String(bv)) * sortDir
    })
    setFiltered(result)
    setPage(0)
  }, [wines, search, filterSource, filterColour, filterBuyer, sortCol, sortDir])

  function isMagnum(w) {
    const vol = String(w.bottle_volume || '').replace(/[^0-9]/g, '')
    const fmt = (w.bottle_format || '').toLowerCase()
    return vol === '150' || vol === '1500' || fmt.includes('magnum')
  }

  function dutyForWine(w) { return isMagnum(w) ? 6 : 3 }

  function isCompetitive(w) {
    if (!w.ws_lowest_per_bottle || !w.purchase_price_per_bottle) return false
    const duty = dutyForWine(w)
    return (parseFloat(w.purchase_price_per_bottle) + duty) * 1.2 < (parseFloat(w.ws_lowest_per_bottle) + duty) * 1.2
  }

  function suggestedPrice(w) {
    const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
    const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
    if (!ib || !ws) return null
    const duty = dutyForWine(w)
    const target = (ws + duty) * 1.2 - 3
    const floor = (ib + duty) * 1.2 * 1.1
    return target >= floor
      ? { price: Math.round(target * 100) / 100, isFloor: false }
      : { price: Math.round(floor * 100) / 100, isFloor: true }
  }

  async function updateWine(id, field, value) {
    const update = { [field]: value }
    if (field === 'retail_price' || field === 'ws_lowest_per_bottle') {
      update.retail_price_date = new Date().toISOString().split('T')[0]
    }
    const { error } = await supabase.from('wines').update(update).eq('id', id)
    if (!error) setWines(prev => prev.map(w => w.id === id ? { ...w, ...update } : w))
  }

  // ─── Flag helpers ──────────────────────────────────────────────────────────
  async function toggleFlag(w, e) {
    e.stopPropagation()
    if (w.review_flag) {
      await updateWine(w.id, 'review_flag', false)
      await updateWine(w.id, 'flag_note', null)
      setExpandedFlag(null)
    } else {
      setFlagNoteInput('')
      setExpandedFlag(w.id)
    }
  }

  async function saveFlag(wineId, e) {
    e.stopPropagation()
    await updateWine(wineId, 'review_flag', true)
    if (flagNoteInput.trim()) await updateWine(wineId, 'flag_note', flagNoteInput.trim())
    setExpandedFlag(null)
    setFlagNoteInput('')
  }

  async function saveOverride() {
    if (!overrideModal || !overrideNote.trim()) return
    const { wine, field, newVal } = overrideModal
    const update = {
      [field]: newVal,
      manual_override_note: overrideNote.trim(),
      manual_override_date: new Date().toISOString().split('T')[0],
      manual_override_field: field,
    }
    const { error } = await supabase.from('wines').update(update).eq('id', wine.id)
    if (!error) {
      setWines(prev => prev.map(w => w.id === wine.id ? { ...w, ...update } : w))
      setOverrideModal(null); setOverrideNote('')
    }
  }

  function openOverride(wine, field, newVal) {
    setOverrideModal({ wine, field, oldVal: wine[field], newVal }); setOverrideNote('')
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function getDateColour(dateStr) {
    if (!dateStr) return ''
    const days = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
    if (days < 30) return '#2d6a4f'
    if (days < 90) return '#b8942a'
    return '#c0392b'
  }

  function openWineSearcher(wineId, description, vintage) {
    wsActiveWineId.current = wineId
    const keywords = description.toLowerCase().replace(/,/g, '').replace(/\s+/g, '+')
    window.open(`https://www.wine-searcher.com/find/${keywords}/${vintage}/uk/gbp`, '_blank')
  }

  async function moveToStudio(wine) {
    const qty = parseInt(prompt(`Move to studio — how many bottles?\n\n${wine.description} ${wine.vintage}\n(${wine.quantity} in bond)`))
    if (!qty || isNaN(qty) || qty < 1) return
    const dp = ((parseFloat(wine.purchase_price_per_bottle) + 3) * 1.2).toFixed(2)
    const { error } = await supabase.from('studio').insert({
      wine_id: wine.id, quantity: qty,
      date_moved: new Date().toISOString().split('T')[0],
      dp_price: dp, status: 'Available', include_in_local: false
    })
    if (error) alert('Error moving to studio: ' + error.message)
    else alert(`✓ ${qty} bottle${qty > 1 ? 's' : ''} moved to studio at DP £${dp}`)
  }

  function parseCsv(text) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = []; let current = '', inQuotes = false
    for (const ch of lines[0]) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { headers.push(current.trim()); current = '' }
      else { current += ch }
    }
    headers.push(current.trim())
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const parts = []; current = ''; inQuotes = false
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { parts.push(current); current = '' }
        else { current += ch }
      }
      parts.push(current)
      const row = {}; headers.forEach((h, idx) => { row[h] = (parts[idx] || '').trim() }); rows.push(row)
    }
    return rows
  }

  function transformBBRRow(row) {
    const description = (row['Description'] || '').replace(/^[\s,]+/, '').trim()
    const vintage = (row['Vintage'] || '').trim()
    const caseSize = parseInt(row['Case Size'], 10) || 1
    const purchaseCasePrice = parseFloat(row['Purchase Price per Case']) || null
    const purchase_price_per_bottle = purchaseCasePrice ? Math.round((purchaseCasePrice / caseSize) * 100) / 100 : null
    const wsCasePrice = parseFloat(row['Wine Searcher Lowest List Price']) || null
    const ws_lowest_per_bottle = wsCasePrice ? Math.round((wsCasePrice / caseSize) * 100) / 100 : null
    const retail_price = ws_lowest_per_bottle ? Math.round((ws_lowest_per_bottle + 3) * 1.20 * 100) / 100 : null
    const livexCasePrice = parseFloat(row['Livex Market Price']) || null
    const livex_market_price = livexCasePrice ? Math.round((livexCasePrice / caseSize) * 100) / 100 : null
    return {
      source: 'Berry Brothers', source_id: row['Parent ID'] || '',
      country: row['Country'] || '', region: (row['Region'] || '').trim(),
      vintage, description, colour: row['Colour'] || '',
      bottle_format: row['Bottle Format'] || '', bottle_volume: row['Bottle Volume'] || '',
      quantity: row['Quantity in Bottles'] || '', case_size: row['Case Size'] || '',
      purchase_price_per_bottle, bbx_highest_bid: row['BBX Highest Bid'] || '',
      ws_lowest_per_bottle, retail_price,
      retail_price_source: retail_price ? 'Wine Searcher lowest +duty+VAT' : null,
      retail_price_date: retail_price ? new Date().toISOString().split('T')[0] : null,
      livex_market_price, include_in_buyer_view: false,
    }
  }

  function transformFlintRow(row) {
    return {
      source: 'Flint',
      source_id: row['Reference'] || row['Parent ID'] || row['Ref'] || row['ID'] || '',
      country: (row['Country'] || '').trim(),
      region: (row['Region'] || row['Appellation'] || '').trim(),
      vintage: (row['Vintage'] || row['Year'] || '').trim(),
      description: (row['Wine'] || row['Description'] || row['Name'] || '').replace(/^[\s,]+/, '').trim(),
      colour: (row['Colour'] || row['Color'] || row['Type'] || '').trim(),
      bottle_format: row['Format'] || row['Bottle Format'] || row['Size'] || '',
      bottle_volume: row['Volume'] || row['Bottle Volume'] || '',
      quantity: String(row['Quantity'] || row['Qty'] || row['Stock'] || ''),
      purchase_price_per_bottle: (() => { const r = parseFloat(row['Unit Price'] || row['Price'] || row['IB Price'] || '') || null; return r ? Math.round(r * 100) / 100 : null })(),
      include_in_buyer_view: false,
    }
  }

  async function upsertWines(wineRows) {
    let inserted = 0, updated = 0, errors = 0; const conflicts = []
    for (const wine of wineRows) {
      try {
        const { data: existing } = await supabase.from('wines')
          .select('id, purchase_price_per_bottle, manual_override_note')
          .eq('source_id', wine.source_id).eq('source', wine.source).maybeSingle()
        if (existing) {
          const hasOverride = !!existing.manual_override_note
          const incomingPrice = wine.purchase_price_per_bottle
          const storedPrice = parseFloat(existing.purchase_price_per_bottle)
          if (hasOverride && incomingPrice && Math.abs(incomingPrice - storedPrice) > 0.01)
            conflicts.push({ description: wine.description, vintage: wine.vintage, storedPrice, incomingPrice, note: existing.manual_override_note })
          const updateData = { quantity: wine.quantity }
          if (wine.ws_lowest_per_bottle !== undefined) {
            updateData.bbx_highest_bid = wine.bbx_highest_bid
            updateData.ws_lowest_per_bottle = wine.ws_lowest_per_bottle
            updateData.retail_price = wine.retail_price
            updateData.retail_price_source = wine.retail_price_source
            updateData.retail_price_date = wine.retail_price_date
            updateData.livex_market_price = wine.livex_market_price
          }
          if (!hasOverride) updateData.purchase_price_per_bottle = wine.purchase_price_per_bottle
          const { error } = await supabase.from('wines').update(updateData).eq('id', existing.id)
          if (error) throw error; updated++
        } else {
          const { error } = await supabase.from('wines').insert(wine)
          if (error) throw error; inserted++
        }
      } catch (err) { console.error('Import error:', wine.description, err); errors++ }
    }
    return { inserted, updated, errors, conflicts }
  }

  async function handleBBRImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportStatus('Reading BBR file…')
    const wineRows = parseCsv(await file.text()).map(transformBBRRow).filter(r => r.description && r.source_id)
    setImportStatus(`Parsed ${wineRows.length} BBR wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows)
    setImportConflicts(conflicts)
    setImportStatus(`✓ BBR done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}${conflicts.length ? ` · ⚠️ ${conflicts.length} price conflict${conflicts.length > 1 ? 's' : ''}` : ''}`)
    setImporting(false); e.target.value = ''; await fetchWines()
  }

  async function handleFlintImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportStatus('Reading Flint file…')
    const wineRows = parseCsv(await file.text()).map(transformFlintRow).filter(r => r.description)
    setImportStatus(`Parsed ${wineRows.length} Flint wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows)
    setImportConflicts(conflicts)
    const has2024 = wineRows.some(w => w.vintage === '2024')
    setImportStatus(`✓ Flint done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}${conflicts.length ? ` · ⚠️ ${conflicts.length} price conflicts` : ''}${has2024 ? ' · ⚠️ 2024 vintage detected — verify Unit Prices against invoice' : ''}`)
    setImporting(false); e.target.value = ''; await fetchWines()
  }

  async function handleOtherImport(e) {
    const file = e.target.files[0]; if (!file) return
    if (!otherSourceName.trim()) { alert('Please enter a source name first'); return }
    setImporting(true); setImportStatus(`Reading ${otherSourceName} file…`)
    const wineRows = parseCsv(await file.text()).map(row => {
      const description = (row['Wine'] || row['Description'] || row['Name'] || '').replace(/^[\s,]+/, '').trim()
      const vintage = (row['Vintage'] || row['Year'] || '').trim()
      const rawPrice = parseFloat(row['Unit Price'] || row['Price'] || row['IB Price'] || row['Purchase Price per Case'] || '') || null
      const caseSize = parseInt(row['Case Size'] || '') || 1
      return {
        source: otherSourceName.trim(),
        source_id: row['Parent ID'] || row['Reference'] || row['Ref'] || row['ID'] || `${otherSourceName}-${description}-${vintage}`,
        country: row['Country'] || '', region: row['Region'] || '', vintage, description,
        colour: row['Colour'] || row['Color'] || '', bottle_format: row['Format'] || row['Bottle Format'] || '',
        bottle_volume: row['Volume'] || row['Bottle Volume'] || '',
        quantity: String(row['Quantity'] || row['Qty'] || row['Quantity in Bottles'] || ''),
        purchase_price_per_bottle: rawPrice ? Math.round((rawPrice / (row['Case Size'] ? caseSize : 1)) * 100) / 100 : null,
        include_in_buyer_view: false,
      }
    }).filter(r => r.description)
    setImportStatus(`Parsed ${wineRows.length} ${otherSourceName} wines — importing…`)
    const { inserted, updated, errors } = await upsertWines(wineRows)
    setImportStatus(`✓ ${otherSourceName} done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}`)
    setImporting(false); e.target.value = ''; setShowOtherSourceInput(false); await fetchWines()
  }

  function exportCSV() {
    const headers = ['Source','ID','Description','Vintage','Colour','Country','Region','Format','Volume','Quantity','Cost IB/Btl','DP/Btl','+10% IB','+15% IB','+10% DP','+15% DP','WS Lowest/Btl','Retail Price IB','Retail Price Source','Retail Price Date','Livex/Btl','Sale Price','In Buyer View','Women Note','Producer Note']
    const rows = wines.map(w => {
      const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
      const dp = ib ? ((ib + 3) * 1.2) : null
      return [w.source, w.source_id, w.description, w.vintage, w.colour, w.country, w.region, w.bottle_format, w.bottle_volume, w.quantity,
        ib || '', dp ? dp.toFixed(2) : '', ib ? (ib * 1.10).toFixed(2) : '', ib ? (ib * 1.15).toFixed(2) : '',
        dp ? (dp * 1.10).toFixed(2) : '', dp ? (dp * 1.15).toFixed(2) : '',
        w.ws_lowest_per_bottle || '', w.retail_price || '', w.retail_price_source || '', w.retail_price_date || '',
        w.livex_market_price || '', w.sale_price || '', w.include_in_buyer_view ? 'Yes' : 'No', w.women_note || '', w.producer_note || ''
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `cellar-export-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  function PriceBreakdown({ w }) {
    const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
    const duty = dutyForWine(w); const mag = isMagnum(w); const dp = ib ? ((ib + duty) * 1.2) : null
    const retail = w.retail_price ? parseFloat(w.retail_price) : null
    const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
    const livex = w.livex_market_price ? parseFloat(w.livex_market_price) : null
    const sale = w.sale_price ? parseFloat(w.sale_price) : null
    const wsDP75 = ws ? (ws + 3) * 1.2 : null; const wsDP150 = ws ? (ws + 6) * 1.2 : null
    const row = (label, val, color, dim) => val != null ? (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '10px', color: dim ? 'rgba(253,250,245,0.3)' : 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: color ? 600 : 400, color: color || (dim ? 'rgba(253,250,245,0.4)' : 'rgba(253,250,245,0.9)') }}>£{val.toFixed(2)}</span>
      </div>
    ) : null
    const divider = (label) => (
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '6px 0', display: 'flex', alignItems: 'center' }}>
        {label && <span style={{ fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.25)', fontFamily: 'DM Mono, monospace', paddingRight: '6px', background: '#1a1208' }}>{label}</span>}
      </div>
    )
    return (
      <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 300, background: '#1a1208', border: '1px solid rgba(212,173,69,0.4)', padding: '14px 16px', minWidth: '260px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4ad45', marginBottom: '10px', fontFamily: 'DM Mono, monospace' }}>IB Price Ladder — {mag ? 'Magnum · £6 duty' : '75cl · £3 duty'}</div>
        {row('Cost IB /btl', ib)}{row('+10% on IB', ib ? ib * 1.10 : null)}{row('+15% on IB', ib ? ib * 1.15 : null)}
        {divider('Duty Paid')}
        {row(`DP  (IB £${ib ? ib.toFixed(2) : '?'} + £${duty} duty × 1.20)`, dp, '#d4ad45')}
        {row('+10% on DP', dp ? dp * 1.10 : null)}{row('+15% on DP', dp ? dp * 1.15 : null)}
        {ws && divider('Wine Searcher')}
        {ws && row('WS avg (ex duty/VAT)', ws)}
        {ws && row('WS + duty + VAT  75cl', wsDP75, wsDP75 && dp && dp < wsDP75 ? '#86efac' : null)}
        {ws && row('WS + duty + VAT  150cl', wsDP150, null, !mag)}
        {(livex || retail || sale) && divider()}
        {livex && row('Livex (ex duty)', livex)}
        {retail && row(
          w.retail_price_source === 'WS avg (ex duty)' || w.retail_price_source === 'Wine Searcher avg' || w.retail_price_source === 'Wine Searcher lowest +duty+VAT' ? 'WS avg (duty paid)'
          : w.retail_price_source === 'Duty paid retail' ? 'Retail (duty paid, manual)' : 'Retail est. (duty paid)', retail
        )}
        {sale && row('Your sale price', sale, '#d4ad45')}
        {!ib && <div style={{ fontSize: '10px', color: 'rgba(253,250,245,0.4)', fontFamily: 'DM Mono, monospace' }}>No cost data available</div>}
        {ws && dp && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontFamily: 'DM Mono, monospace' }}>
            {dp < (ws + duty) * 1.2 ? <span style={{ color: '#86efac' }}>✓ Competitive — your DP is below WS market rate</span> : <span style={{ color: '#f87171' }}>✗ Not competitive vs WS at this duty-paid price</span>}
          </div>
        )}
      </div>
    )
  }

  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const bbCount = wines.filter(w => w.source === 'Berry Brothers').length
  const flintCount = wines.filter(w => w.source === 'Flint').length
  const inBuyerCount = wines.filter(w => w.include_in_buyer_view).length
  const competitiveCount = wines.filter(w => isCompetitive(w)).length
  const missingRetailCount = wines.filter(w => !w.retail_price).length
  const womenCount = wines.filter(w => w.women_note).length
  const flaggedCount = wines.filter(w => w.review_flag).length
  const totalCostValue = wines.reduce((sum, w) => sum + ((parseInt(w.quantity) || 0) * (parseFloat(w.purchase_price_per_bottle) || 0)), 0)
  const totalRetailValue = wines.reduce((sum, w) => sum + ((parseInt(w.quantity) || 0) * (parseFloat(w.retail_price) || 0)), 0)
  const winesWithRetail = wines.filter(w => w.retail_price).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading cellar…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}
      onClick={() => { setExpandedPrice(null); setExpandedFlag(null) }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['Inventory','/admin'],['Studio','/studio'],['Buyer View','/buyer'],['Local Sales','/local'],['Consignment','/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/admin' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/admin' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '76px 28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Wine Inventory</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{filtered.length} wines</div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '12px', fontSize: '11px', flexWrap: 'wrap' }}>
          {[['wines total', wines.length, ''], ['Berry Brothers', bbCount, ''], ['Flint', flintCount, ''], ['in buyer view', inBuyerCount, ''], ['competitive', competitiveCount, ''], ['need retail price', missingRetailCount, ''], ['women-led', womenCount, 'women'], ['flagged', flaggedCount, 'flag']].map(([label, n, type]) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 500, color: type === 'women' ? '#9b3a4a' : type === 'flag' ? '#b8942a' : 'var(--wine)', fontSize: '14px' }}>{type === 'women' ? '♀ ' : type === 'flag' ? '🚩 ' : ''}{n}</span>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Collection value */}
        <div style={{ marginBottom: '16px' }}>
          <button onClick={() => setShowValues(v => !v)} style={{ background: 'none', border: '1px solid var(--border)', padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--muted)' }}>
            {showValues ? '▲ Hide collection value' : '▼ Show collection value'}
          </button>
          {showValues && (
            <div style={{ display: 'flex', gap: '28px', padding: '12px 16px', background: 'var(--ink)', border: '1px solid var(--border)', marginTop: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Collection cost IB</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#d4ad45' }}>£{totalCostValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Retail value IB</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#86efac' }}>£{totalRetailValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                {winesWithRetail < wines.length && <span style={{ fontSize: '10px', color: 'rgba(253,250,245,0.3)' }}>({winesWithRetail} of {wines.length} priced)</span>}
              </div>
              {totalRetailValue > 0 && totalCostValue > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Uplift</span>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#d4748a' }}>{((totalRetailValue / totalCostValue - 1) * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by description, region, vintage…" style={{ flex: 1, minWidth: '200px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Sources</option>
            <option value="Berry Brothers">Berry Brothers</option>
            <option value="Flint">Flint</option>
          </select>
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
          <select value={filterBuyer} onChange={e => setFilterBuyer(e.target.value)} style={{ border: '1px solid var(--border)', background: filterBuyer === 'flagged' ? 'rgba(184,148,42,0.08)' : 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Wines</option>
            <option value="included">In Buyer View</option>
            <option value="missing-retail">Missing Retail Price</option>
            <option value="competitive">Competitive Only</option>
            <option value="women">Women-Led</option>
            <option value="flagged">🚩 Flagged for Review</option>
          </select>
          <button onClick={exportCSV} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>↓ Export</button>
        </div>

        {/* Import buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <input type="file" accept=".csv" onChange={handleBBRImport} disabled={importing} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
            <span style={{ display: 'inline-block', background: importing ? 'rgba(107,30,46,0.4)' : 'rgba(107,30,46,0.08)', border: '1px solid rgba(107,30,46,0.3)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: importing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>↑ Import BBR</span>
          </label>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <input type="file" accept=".csv" onChange={handleFlintImport} disabled={importing} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
            <span style={{ display: 'inline-block', background: importing ? 'rgba(184,148,42,0.4)' : 'rgba(184,148,42,0.08)', border: '1px solid rgba(184,148,42,0.3)', color: '#7a5e10', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: importing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>↑ Import Flint</span>
          </label>
          {!showOtherSourceInput ? (
            <button onClick={() => setShowOtherSourceInput(true)} disabled={importing} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>↑ Import Other…</button>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={otherSourceName} onChange={e => setOtherSourceName(e.target.value)} placeholder="Source name e.g. Corney & Barrow" autoFocus style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', minWidth: '220px' }} />
              <label style={{ position: 'relative', cursor: 'pointer' }}>
                <input ref={otherFileRef} type="file" accept=".csv" onChange={handleOtherImport} disabled={importing || !otherSourceName.trim()} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
                <span style={{ display: 'inline-block', background: otherSourceName.trim() ? 'rgba(45,106,79,0.08)' : '#eee', border: '1px solid rgba(45,106,79,0.3)', color: otherSourceName.trim() ? '#2d6a4f' : '#999', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: otherSourceName.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>↑ Choose CSV</span>
              </label>
              <button onClick={() => { setShowOtherSourceInput(false); setOtherSourceName('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px', padding: '6px' }}>✕</button>
            </div>
          )}
          {importing && <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', padding: '9px 0' }}>⏳ Importing…</span>}
          {importStatus && !importing && <span style={{ fontSize: '11px', color: importStatus.startsWith('✓') ? '#2d6a4f' : 'var(--muted)', fontFamily: 'DM Mono, monospace', padding: '9px 0' }}>{importStatus}</span>}
        </div>

        {importConflicts.length > 0 && (
          <div style={{ background: 'rgba(184,148,42,0.08)', border: '1px solid rgba(184,148,42,0.4)', padding: '14px 16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7a5e10', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>⚠️ Price conflicts — your manual overrides were preserved</div>
            {importConflicts.map((c, i) => (
              <div key={i} style={{ fontSize: '12px', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(184,148,42,0.2)' : 'none' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', marginBottom: '3px' }}>{c.description} {c.vintage}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>Your price: <strong>£{parseFloat(c.storedPrice).toFixed(2)}</strong> · Incoming: <strong>£{parseFloat(c.incomingPrice).toFixed(2)}</strong></div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#7a5e10', marginTop: '2px' }}>Note: {c.note}</div>
              </div>
            ))}
            <button onClick={() => setImportConflicts([])} style={{ marginTop: '10px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                <th onClick={() => handleSort('description')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'description' ? '#d4ad45' : 'var(--white)', position: 'sticky', left: 0, background: 'var(--ink)', zIndex: 10, minWidth: '200px' }}>
                  Wine {sortCol === 'description' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                </th>
                {[['vintage','Vin.'],['colour','Colour'],['region','Region'],['bottle_format','Format'],['quantity','Qty']].map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === col ? '#d4ad45' : 'var(--white)' }}>
                    {label} {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  </th>
                ))}
                <th onClick={() => handleSort('purchase_price_per_bottle')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'purchase_price_per_bottle' ? '#d4ad45' : 'var(--white)' }}>
                  DP {sortCol === 'purchase_price_per_bottle' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  <span style={{ display: 'block', fontSize: '8px', color: 'rgba(253,250,245,0.35)', fontWeight: 300, letterSpacing: '0.03em', textTransform: 'none', marginTop: '1px' }}>▼ click for IB ladder</span>
                </th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: '160px' }}>
                  WS Market
                  <span style={{ display: 'block', fontSize: '8px', color: 'rgba(253,250,245,0.35)', fontWeight: 300, letterSpacing: '0.03em', textTransform: 'none', marginTop: '1px' }}>avg ex-tax below</span>
                </th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: '130px' }}>
                  Sell Price
                  <span style={{ display: 'block', fontSize: '8px', color: 'rgba(253,250,245,0.35)', fontWeight: 300, letterSpacing: '0.03em', textTransform: 'none', marginTop: '1px' }}>suggested below</span>
                </th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Notes</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Buyer</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Studio</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>🚩</th>
                <th onClick={() => handleSort('source')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'source' ? '#d4ad45' : 'var(--white)' }}>
                  Src {sortCol === 'source' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map(w => {
                const pp = w.purchase_price_per_bottle
                const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
                const isExpanded = expandedNote === w.id
                const isPriceOpen = expandedPrice === w.id
                const isFlagOpen = expandedFlag === w.id
                const suggestion = suggestedPrice(w)
                // ex is default unless explicitly set to duty-paid
                const isExDuty = w.retail_price_source !== 'Duty paid retail'

                return (
                  <tr key={w.id} style={{
                    borderBottom: '1px solid #ede6d6',
                    background: w.review_flag ? 'rgba(184,148,42,0.06)' : w.include_in_buyer_view ? 'rgba(45,106,79,0.04)' : 'transparent',
                    borderLeft: w.review_flag ? '3px solid #b8942a' : '3px solid transparent',
                  }}>

                    {/* Sticky wine name */}
                    <td style={{ padding: '9px 12px', maxWidth: '260px', position: 'sticky', left: 0, background: w.review_flag ? '#fdf8ee' : w.include_in_buyer_view ? '#f0f7f4' : 'var(--white)', zIndex: 5, borderRight: '1px solid #ede6d6' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        {w.women_note && <span title={w.women_note} style={{ fontSize: '12px', flexShrink: 0, cursor: 'help' }}>♀</span>}
                        <div>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3 }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{w.region}{w.country ? ` · ${w.country}` : ''}</div>
                          {w.review_flag && w.flag_note && (
                            <div style={{ fontSize: '10px', color: '#b8942a', fontFamily: 'DM Mono, monospace', marginTop: '3px' }}>🚩 {w.flag_note}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{w.vintage}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, marginRight: '5px', verticalAlign: 'middle' }}></span>
                      {w.colour}
                    </td>
                    <td style={{ padding: '9px 12px' }}>{w.region}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{w.bottle_volume || (w.bottle_format === 'Magnum' ? '150cl' : w.bottle_format ? '75cl' : '—')}</td>
                    <td style={{ padding: '9px 12px' }}>{w.quantity || '—'}</td>

                    {/* DP */}
                    <td style={{ padding: '9px 12px', position: 'relative' }} onClick={e => { e.stopPropagation(); setExpandedPrice(isPriceOpen ? null : w.id) }}>
                      <div style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 700, color: isPriceOpen ? 'var(--wine)' : 'var(--ink)', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                            {pp ? `£${((parseFloat(pp) + dutyForWine(w)) * 1.2).toFixed(2)}` : '—'}
                          </span>
                          <span style={{ fontSize: '9px', color: isPriceOpen ? 'var(--wine)' : '#bbb' }}>{isPriceOpen ? '▲' : '▼'}</span>
                          {w.manual_override_note && <span title={`Override: ${w.manual_override_note}`} style={{ fontSize: '9px', color: '#b8942a', cursor: 'help' }}>✎</span>}
                        </div>
                        {pp && <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>IB £{parseFloat(pp).toFixed(2)}</div>}
                      </div>
                      {isPriceOpen && (
                        <>
                          <PriceBreakdown w={w} />
                          <div style={{ marginTop: '8px' }}>
                            <button onClick={e => { e.stopPropagation(); setExpandedPrice(null); openOverride(w, 'purchase_price_per_bottle', pp) }}
                              style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'rgba(184,148,42,0.12)', border: '1px solid rgba(184,148,42,0.3)', color: '#7a5e10', padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              ✎ Override IB price
                            </button>
                          </div>
                        </>
                      )}
                    </td>

                    {/* WS Market — always defaults ex unless explicitly duty-paid */}
                    {(() => {
                      const duty = dutyForWine(w)
                      const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
                      const wsDP = ws ? ((ws + duty) * 1.2) : null
                      const myDP = pp ? ((parseFloat(pp) + duty) * 1.2) : null
                      const isComp = wsDP && myDP ? myDP < wsDP : null
                      const displayVal = isExDuty ? (w.ws_lowest_per_bottle || '') : (w.retail_price || '')

                      function handlePriceBlur(e) {
                        const raw = e.target.value; const val = raw ? parseFloat(raw) : null
                        const type = e.target.closest('td').querySelector('select')?.value || 'ex-duty'
                        if (type === 'ex-duty') {
                          updateWine(w.id, 'ws_lowest_per_bottle', val)
                          if (val) updateWine(w.id, 'retail_price', Math.round((val + duty) * 1.2 * 100) / 100)
                          updateWine(w.id, 'retail_price_source', 'WS avg (ex duty)')
                        } else {
                          updateWine(w.id, 'retail_price', val)
                          updateWine(w.id, 'retail_price_source', 'Duty paid retail')
                        }
                      }

                      function handleTypeChange(e) {
                        updateWine(w.id, 'retail_price_source', e.target.value === 'ex-duty' ? 'WS avg (ex duty)' : 'Duty paid retail')
                      }

                      return (
                        <td style={{ padding: '9px 12px', minWidth: '160px' }}>
                          {wsDP ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: '13px', color: isComp ? '#2d6a4f' : 'var(--ink)' }}>£{wsDP.toFixed(2)}</span>
                                {isComp !== null && <span style={{ fontSize: '10px', fontWeight: 600, color: isComp ? '#2d6a4f' : '#c0392b' }}>{isComp ? '✓' : '✗'}</span>}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>WS £{ws.toFixed(2)} ex-tax</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>—</div>
                          )}
                          <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginTop: '5px' }}>
                            <input type="number" step="0.01"
                              key={`${w.id}-price`}
                              defaultValue={displayVal}
                              placeholder="WS avg"
                              ref={el => { if (el) wsInputRefs.current[w.id] = el }}
                              onBlur={handlePriceBlur}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '60px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 4px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
                            {/* Default to ex-duty unless explicitly set to duty-paid */}
                            <select
                              key={`${w.id}-type`}
                              defaultValue={w.retail_price_source === 'Duty paid retail' ? 'duty-paid' : 'ex-duty'}
                              onChange={handleTypeChange}
                              onClick={e => e.stopPropagation()}
                              style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '1px 2px', fontFamily: 'DM Mono, monospace', fontSize: '9px', outline: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                              <option value="ex-duty">ex</option>
                              <option value="duty-paid">dp</option>
                            </select>
                            <button onClick={e => { e.stopPropagation(); openWineSearcher(w.id, w.description, w.vintage) }}
                              title="Look up on Wine Searcher — returns here focused"
                              style={{ background: 'none', border: '1px solid var(--border)', padding: '1px 4px', cursor: 'pointer', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>🔍</button>
                          </div>
                          {w.retail_price_date && (
                            <div style={{ fontSize: '10px', color: getDateColour(w.retail_price_date), fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>{w.retail_price_date}</div>
                          )}
                        </td>
                      )
                    })()}

                    {/* Sell Price + Suggested */}
                    <td style={{ padding: '9px 12px', minWidth: '130px' }}>
                      {w.sale_price && (
                        <div style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--wine)', marginBottom: '3px' }}>
                          £{parseFloat(w.sale_price).toFixed(2)}
                        </div>
                      )}
                      <input type="number" step="0.01"
                        key={`${w.id}-sale`}
                        defaultValue={w.sale_price || ''}
                        placeholder="0.00"
                        onBlur={e => { if (e.target.value !== String(w.sale_price || '')) updateWine(w.id, 'sale_price', e.target.value ? parseFloat(e.target.value) : null) }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '68px', border: '1px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', color: 'var(--wine)' }} />
                      {suggestion && (
                        <div style={{ marginTop: '4px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); updateWine(w.id, 'sale_price', suggestion.price) }}
                            title={suggestion.isFloor ? 'At 10% margin floor — WS price leaves little room' : 'Suggested: WS market DP − £3'}
                            style={{ background: 'none', border: `1px solid ${suggestion.isFloor ? 'rgba(184,148,42,0.4)' : 'rgba(45,106,79,0.3)'}`, color: suggestion.isFloor ? '#b8942a' : '#2d6a4f', padding: '2px 6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {suggestion.isFloor ? '⚠' : '→'} £{suggestion.price.toFixed(2)}
                            <span style={{ fontSize: '8px', opacity: 0.7 }}>{suggestion.isFloor ? 'floor' : 'use'}</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '9px 12px', maxWidth: '200px' }}>
                      {(w.women_note || w.producer_note) && (
                        <div>
                          <button onClick={e => { e.stopPropagation(); setExpandedNote(isExpanded ? null : w.id) }}
                            style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', color: w.women_note ? '#9b3a4a' : 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                            {w.women_note ? '♀ note' : '📋 note'} {isExpanded ? '▲' : '▼'}
                          </button>
                          {isExpanded && (
                            <div style={{ marginTop: '6px', fontSize: '11px', lineHeight: 1.5, color: 'var(--ink)' }}>
                              {w.women_note && (
                                <div style={{ marginBottom: w.producer_note ? '8px' : 0 }}>
                                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '3px' }}>♀ Women's story</div>
                                  <textarea defaultValue={w.women_note} onBlur={e => { if (e.target.value !== w.women_note) updateWine(w.id, 'women_note', e.target.value) }}
                                    style={{ width: '100%', minHeight: '60px', border: '1px solid #9b3a4a', background: 'rgba(155,58,74,0.03)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                                </div>
                              )}
                              {w.producer_note && (
                                <div>
                                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>📋 Producer note</div>
                                  <textarea defaultValue={w.producer_note} onBlur={e => { if (e.target.value !== w.producer_note) updateWine(w.id, 'producer_note', e.target.value) }}
                                    style={{ width: '100%', minHeight: '60px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                                </div>
                              )}
                              {!w.women_note && (
                                <div>
                                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '3px' }}>♀ Add women's story</div>
                                  <textarea placeholder="Add women's story…" onBlur={e => { if (e.target.value) updateWine(w.id, 'women_note', e.target.value) }}
                                    style={{ width: '100%', minHeight: '40px', border: '1px solid #9b3a4a', background: 'rgba(155,58,74,0.03)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                                </div>
                              )}
                            </div>
                          )}
                          {!w.producer_note && isExpanded && (
                            <div style={{ marginTop: '6px' }}>
                              <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>📋 Add producer note</div>
                              <textarea placeholder="Add producer note…" onBlur={e => { if (e.target.value) updateWine(w.id, 'producer_note', e.target.value) }}
                                style={{ width: '100%', minHeight: '40px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                            </div>
                          )}
                        </div>
                      )}
                      {!w.women_note && !w.producer_note && (
                        <button onClick={e => { e.stopPropagation(); setExpandedNote(isExpanded ? null : w.id) }}
                          style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>+ note</button>
                      )}
                      {isExpanded && !w.women_note && !w.producer_note && (
                        <div style={{ marginTop: '6px' }}>
                          <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '3px' }}>♀ Women's story</div>
                          <textarea placeholder="Add women's story…" onBlur={e => { if (e.target.value) updateWine(w.id, 'women_note', e.target.value) }}
                            style={{ width: '100%', minHeight: '40px', border: '1px solid #9b3a4a', background: 'rgba(155,58,74,0.03)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical', marginBottom: '6px' }} />
                          <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>📋 Producer note</div>
                          <textarea placeholder="Add producer note…" onBlur={e => { if (e.target.value) updateWine(w.id, 'producer_note', e.target.value) }}
                            style={{ width: '100%', minHeight: '40px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!w.include_in_buyer_view}
                        onChange={e => updateWine(w.id, 'include_in_buyer_view', e.target.checked)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--wine)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={e => { e.stopPropagation(); moveToStudio(w) }}
                        style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>→ Studio</button>
                    </td>

                    {/* Flag cell */}
                    <td style={{ padding: '9px 12px', textAlign: 'center', position: 'relative' }}>
                      <button
                        onClick={e => toggleFlag(w, e)}
                        title={w.review_flag ? `Flagged${w.flag_note ? ': ' + w.flag_note : ''} — click to clear` : 'Flag for review'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: w.review_flag ? 1 : 0.2, transition: 'opacity 0.15s', padding: '2px' }}>
                        🚩
                      </button>
                      {isFlagOpen && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 200, background: 'var(--cream)', border: '1px solid #b8942a', padding: '12px', minWidth: '200px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', marginTop: '4px' }}>
                          <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b8942a', fontFamily: 'DM Mono, monospace', marginBottom: '6px' }}>Flag note (optional)</div>
                          <input
                            autoFocus
                            type="text"
                            value={flagNoteInput}
                            onChange={e => setFlagNoteInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveFlag(w.id, e) }}
                            placeholder="e.g. check WS price"
                            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={e => { e.stopPropagation(); setExpandedFlag(null) }}
                              style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={e => saveFlag(w.id, e)}
                              style={{ background: '#b8942a', color: 'white', border: 'none', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer' }}>Flag →</button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '2px', background: w.source === 'Berry Brothers' ? 'rgba(107,30,46,0.1)' : w.source === 'Flint' ? 'rgba(184,148,42,0.12)' : 'rgba(45,106,79,0.1)', color: w.source === 'Berry Brothers' ? 'var(--wine)' : w.source === 'Flint' ? '#7a5e10' : '#2d6a4f', whiteSpace: 'nowrap' }}>
                        {w.source === 'Berry Brothers' ? 'BB' : w.source}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', fontSize: '11px', color: 'var(--muted)' }}>
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0} style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', opacity: page === 0 ? 0.3 : 1 }}>‹</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} style={{ background: page === i ? 'var(--wine)' : 'var(--white)', color: page === i ? 'var(--white)' : 'var(--ink)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>{i + 1}</button>
              ))}
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Price Override Modal */}
      {overrideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '440px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, marginBottom: '6px' }}>Override Purchase Price</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>{overrideModal.wine.description}, {overrideModal.wine.vintage}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>Current price</label>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '18px', color: 'var(--muted)', padding: '9px 0' }}>£{parseFloat(overrideModal.oldVal || 0).toFixed(2)}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>New price (£/btl IB)</label>
                <input type="number" step="0.01"
                  defaultValue={overrideModal.newVal ? parseFloat(overrideModal.newVal).toFixed(2) : ''}
                  onChange={e => setOverrideModal(prev => ({ ...prev, newVal: e.target.value }))}
                  style={{ width: '100%', border: '2px solid var(--wine)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>
                Reason for override <span style={{ color: 'var(--wine)' }}>*</span>
              </label>
              <input type="text" value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
                placeholder="e.g. Supplier corrected invoice price"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>This note will appear as a warning if the next import has a different price.</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setOverrideModal(null); setOverrideNote('') }}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveOverride} disabled={!overrideNote.trim() || !overrideModal.newVal}
                style={{ background: overrideNote.trim() && overrideModal.newVal ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: overrideNote.trim() ? 'pointer' : 'not-allowed' }}>
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
