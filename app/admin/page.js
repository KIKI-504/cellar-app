'use client'
import React, { useState, useEffect, useRef } from 'react'
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
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [importConflicts, setImportConflicts] = useState([])
  const [overrideModal, setOverrideModal] = useState(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [otherSourceName, setOtherSourceName] = useState('')
  const [showOtherSourceInput, setShowOtherSourceInput] = useState(false)
  const [saveFlash, setSaveFlash] = useState(null)
  const otherFileRef = useRef(null)
  const PAGE_SIZE = 50

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchWines()
  }, [])

  // Click outside to close price dropdown
  useEffect(() => {
    if (!expandedPrice) return
    function handleClick(e) {
      if (!e.target.closest('[data-price-panel]')) setExpandedPrice(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expandedPrice])

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
    if (filterBuyer === 'missing-ws') result = result.filter(w => !w.ws_lowest_per_bottle)
    if (filterBuyer === 'competitive') result = result.filter(w => isCompetitive(w))
    if (filterBuyer === 'women') result = result.filter(w => w.women_note)
    if (filterBuyer === 'flagged') result = result.filter(w => w.flagged)
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

  function formatBottleSize(w) {
    const vol = String(w.bottle_volume || '').replace(/[^0-9.]/g, '')
    const fmt = (w.bottle_format || '').toLowerCase()
    if (vol === '150' || vol === '1500' || fmt.includes('magnum')) return '150cl'
    if (vol === '37' || vol === '375' || fmt.includes('half')) return '37.5cl'
    if (vol === '300' || vol === '3000' || fmt.includes('double')) return '300cl'
    return '75cl'
  }

  // Competitive = sale_price ≤ wsDP × 1.10
  // (your DP + 10% is still at or below what buyer would pay at WS average DP)
  function isCompetitive(w) {
    if (!w.ws_lowest_per_bottle || !w.sale_price) return false
    const duty = dutyForWine(w)
    const wsDP = (parseFloat(w.ws_lowest_per_bottle) + duty) * 1.2
    return parseFloat(w.sale_price) <= wsDP * 1.10
  }

  async function updateWine(id, field, value) {
    const update = { [field]: value }
    // Always save date alongside WS price
    if (field === 'ws_lowest_per_bottle') {
      update.ws_price_date = new Date().toISOString().split('T')[0]
    }
    const { error } = await supabase.from('wines').update(update).eq('id', id)
    if (!error) {
      setWines(prev => prev.map(w => w.id === id ? { ...w, ...update } : w))
      flashSave(id)
    }
  }

  function flashSave(id) {
    setSaveFlash(id)
    setTimeout(() => setSaveFlash(null), 1200)
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
      setOverrideModal(null)
      setOverrideNote('')
    }
  }

  function openOverride(wine, field, newVal) {
    setOverrideModal({ wine, field, oldVal: wine[field], newVal })
    setOverrideNote('')
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function getDateColour(dateStr) {
    if (!dateStr) return '#aaa'
    const days = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
    if (days < 30) return '#2d6a4f'
    if (days < 90) return '#b8942a'
    return '#c0392b'
  }

  function openWineSearcher(description, vintage) {
    const keywords = description.toLowerCase().replace(/,/g, '').replace(/\s+/g, '+')
    window.open(`https://www.wine-searcher.com/find/${keywords}/${vintage}/uk/gbp`, '_blank')
  }

  async function moveToStudio(wine) {
    const qty = parseInt(prompt(`Move to studio — how many bottles?\n\n${wine.description} ${wine.vintage}\n(${wine.quantity} in bond)`))
    if (!qty || isNaN(qty) || qty < 1) return
    const duty = dutyForWine(wine)
    const dp = ((parseFloat(wine.purchase_price_per_bottle) + duty) * 1.2).toFixed(2)
    const { error } = await supabase.from('studio').insert({
      wine_id: wine.id, quantity: qty,
      date_moved: new Date().toISOString().split('T')[0],
      dp_price: dp, status: 'Available', include_in_local: false
    })
    if (error) alert('Error moving to studio: ' + error.message)
    else alert(`✓ ${qty} bottle${qty > 1 ? 's' : ''} moved to studio at DP £${dp}`)
  }

  async function toggleFlag(wine) {
    const newFlagged = !wine.flagged
    const update = { flagged: newFlagged }
    if (!newFlagged) update.flag_note = null
    const { error } = await supabase.from('wines').update(update).eq('id', wine.id)
    if (!error) setWines(prev => prev.map(w => w.id === wine.id ? { ...w, ...update } : w))
  }

  // ─── CSV parser ─────────────────────────────────────────────────────────────
  function parseCsv(text) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = []
    let current = '', inQuotes = false
    for (const ch of lines[0]) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { headers.push(current.trim()); current = '' }
      else { current += ch }
    }
    headers.push(current.trim())
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const parts = []
      current = ''; inQuotes = false
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { parts.push(current); current = '' }
        else { current += ch }
      }
      parts.push(current)
      const row = {}
      headers.forEach((h, idx) => { row[h] = (parts[idx] || '').trim() })
      rows.push(row)
    }
    return rows
  }

  // ─── BBR import ──────────────────────────────────────────────────────────────
  function transformBBRRow(row) {
    const description = (row['Description'] || '').replace(/^[\s,]+/, '').trim()
    const vintage = (row['Vintage'] || '').trim()
    const caseSize = parseInt(row['Case Size'], 10) || 1
    const purchaseCasePrice = parseFloat(row['Purchase Price per Case']) || null
    const purchase_price_per_bottle = purchaseCasePrice ? Math.round((purchaseCasePrice / caseSize) * 100) / 100 : null
    const wsCasePrice = parseFloat(row['Wine Searcher Lowest List Price']) || null
    const ws_lowest_per_bottle = wsCasePrice ? Math.round((wsCasePrice / caseSize) * 100) / 100 : null
    const livexCasePrice = parseFloat(row['Livex Market Price']) || null
    const livex_market_price = livexCasePrice ? Math.round((livexCasePrice / caseSize) * 100) / 100 : null
    return {
      source: 'Berry Brothers', source_id: row['Parent ID'] || '',
      country: row['Country'] || '', region: (row['Region'] || '').trim(),
      vintage, description, colour: row['Colour'] || '',
      bottle_format: row['Bottle Format'] || '', bottle_volume: row['Bottle Volume'] || '',
      quantity: row['Quantity in Bottles'] || '', case_size: row['Case Size'] || '',
      purchase_price_per_bottle,
      bbx_highest_bid: row['BBX Highest Bid'] || '',
      ws_lowest_per_bottle,
      ws_price_date: ws_lowest_per_bottle ? new Date().toISOString().split('T')[0] : null,
      livex_market_price, include_in_buyer_view: false,
    }
  }

  // ─── Flint import ─────────────────────────────────────────────────────────────
  function transformFlintRow(row) {
    const description = (row['Wine'] || row['Description'] || row['Name'] || '').replace(/^[\s,]+/, '').trim()
    const vintage = (row['Vintage'] || row['Year'] || '').trim()
    const region = (row['Region'] || row['Appellation'] || '').trim()
    const country = (row['Country'] || '').trim()
    const colour = (row['Colour'] || row['Color'] || row['Type'] || '').trim()
    const quantity = row['Quantity'] || row['Qty'] || row['Stock'] || ''
    const source_id = row['Reference'] || row['Parent ID'] || row['Ref'] || row['ID'] || ''
    const bottle_format = row['Format'] || row['Bottle Format'] || row['Size'] || ''
    const bottle_volume = row['Volume'] || row['Bottle Volume'] || ''
    // ⚠️ WARNING: 2024 vintage EP wines may have case prices here — verify against invoice
    const rawPrice = parseFloat(row['Unit Price'] || row['Price'] || row['IB Price'] || '') || null
    const purchase_price_per_bottle = rawPrice ? Math.round(rawPrice * 100) / 100 : null
    return {
      source: 'Flint', source_id, country, region, vintage, description,
      colour, bottle_format, bottle_volume, quantity: String(quantity),
      purchase_price_per_bottle, include_in_buyer_view: false,
    }
  }

  // ─── Generic upsert ──────────────────────────────────────────────────────────
  async function upsertWines(wineRows, sourceLabel) {
    let inserted = 0, updated = 0, errors = 0
    const conflicts = []
    for (const wine of wineRows) {
      try {
        const { data: existing } = await supabase.from('wines')
          .select('id, purchase_price_per_bottle, manual_override_note')
          .eq('source_id', wine.source_id).eq('source', wine.source).maybeSingle()
        if (existing) {
          const hasOverride = !!existing.manual_override_note
          const incomingPrice = wine.purchase_price_per_bottle
          const storedPrice = parseFloat(existing.purchase_price_per_bottle)
          const priceConflict = hasOverride && incomingPrice && Math.abs(incomingPrice - storedPrice) > 0.01
          if (priceConflict) conflicts.push({ description: wine.description, vintage: wine.vintage, storedPrice, incomingPrice, note: existing.manual_override_note })
          const updateData = { quantity: wine.quantity }
          if (wine.ws_lowest_per_bottle !== undefined) {
            updateData.bbx_highest_bid = wine.bbx_highest_bid
            updateData.ws_lowest_per_bottle = wine.ws_lowest_per_bottle
            updateData.ws_price_date = wine.ws_price_date
            updateData.livex_market_price = wine.livex_market_price
          }
          if (!hasOverride) updateData.purchase_price_per_bottle = wine.purchase_price_per_bottle
          const { error } = await supabase.from('wines').update(updateData).eq('id', existing.id)
          if (error) throw error
          updated++
        } else {
          const { error } = await supabase.from('wines').insert(wine)
          if (error) throw error
          inserted++
        }
      } catch (err) { console.error('Import error:', wine.description, err); errors++ }
    }
    return { inserted, updated, errors, conflicts }
  }

  async function handleBBRImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportStatus('Reading BBR file…')
    const text = await file.text()
    const rows = parseCsv(text)
    const wineRows = rows.map(transformBBRRow).filter(r => r.description && r.source_id)
    setImportStatus(`Parsed ${wineRows.length} BBR wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows, 'BBR')
    setImportConflicts(conflicts)
    setImportStatus(`✓ BBR done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}${conflicts.length ? ` · ⚠️ ${conflicts.length} price conflict${conflicts.length > 1 ? 's' : ''}` : ''}`)
    setImporting(false); e.target.value = ''; await fetchWines()
  }

  async function handleFlintImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportStatus('Reading Flint file…')
    const text = await file.text()
    const rows = parseCsv(text)
    const wineRows = rows.map(transformFlintRow).filter(r => r.description)
    setImportStatus(`Parsed ${wineRows.length} Flint wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows, 'Flint')
    setImportConflicts(conflicts)
    const has2024 = wineRows.some(w => w.vintage === '2024')
    const suffix = has2024 ? ' · ⚠️ 2024 vintage detected — verify Unit Prices against invoice (case price bug)' : ''
    setImportStatus(`✓ Flint done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}${conflicts.length ? ` · ⚠️ ${conflicts.length} price conflicts` : ''}${suffix}`)
    setImporting(false); e.target.value = ''; await fetchWines()
  }

  async function handleOtherImport(e) {
    const file = e.target.files[0]; if (!file) return
    if (!otherSourceName.trim()) { alert('Please enter a source name first'); return }
    setImporting(true); setImportStatus(`Reading ${otherSourceName} file…`)
    const text = await file.text()
    const rows = parseCsv(text)
    const wineRows = rows.map(row => {
      const description = (row['Wine'] || row['Description'] || row['Name'] || '').replace(/^[\s,]+/, '').trim()
      const vintage = (row['Vintage'] || row['Year'] || '').trim()
      const rawPrice = parseFloat(row['Unit Price'] || row['Price'] || row['IB Price'] || row['Purchase Price per Case'] || '') || null
      const caseSize = parseInt(row['Case Size'] || '') || 1
      const purchase_price_per_bottle = rawPrice ? Math.round((rawPrice / (row['Case Size'] ? caseSize : 1)) * 100) / 100 : null
      return {
        source: otherSourceName.trim(),
        source_id: row['Parent ID'] || row['Reference'] || row['Ref'] || row['ID'] || `${otherSourceName}-${description}-${vintage}`,
        country: row['Country'] || '', region: row['Region'] || '', vintage, description,
        colour: row['Colour'] || row['Color'] || '',
        bottle_format: row['Format'] || row['Bottle Format'] || '',
        bottle_volume: row['Volume'] || row['Bottle Volume'] || '',
        quantity: String(row['Quantity'] || row['Qty'] || row['Quantity in Bottles'] || ''),
        purchase_price_per_bottle, include_in_buyer_view: false,
      }
    }).filter(r => r.description)
    setImportStatus(`Parsed ${wineRows.length} ${otherSourceName} wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows, otherSourceName)
    setImportConflicts(conflicts)
    setImportStatus(`✓ ${otherSourceName} done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}`)
    setImporting(false); e.target.value = ''; setShowOtherSourceInput(false); await fetchWines()
  }

  // ─── Export ──────────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ['Source','ID','Description','Vintage','Colour','Country','Region','Format','Volume','Quantity','IB/Btl','DP/Btl','+10% DP','+15% DP','WS IB/Btl','WS DP/Btl','WS Date','Livex/Btl','Sale Price','In Buyer View','Women Note','Producer Note']
    const rows = wines.map(w => {
      const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
      const duty = dutyForWine(w)
      const dp = ib ? ((ib + duty) * 1.2) : null
      const wsIb = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
      const wsDP = wsIb ? ((wsIb + duty) * 1.2) : null
      return [
        w.source, w.source_id, w.description, w.vintage, w.colour, w.country, w.region,
        w.bottle_format, w.bottle_volume, w.quantity,
        ib || '', dp ? dp.toFixed(2) : '',
        dp ? (dp * 1.10).toFixed(2) : '', dp ? (dp * 1.15).toFixed(2) : '',
        wsIb || '', wsDP ? wsDP.toFixed(2) : '', w.ws_price_date || '',
        w.livex_market_price || '', w.sale_price || '',
        w.include_in_buyer_view ? 'Yes' : 'No', w.women_note || '', w.producer_note || ''
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `cellar-export-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Price breakdown panel ────────────────────────────────────────────────────
  function PriceBreakdown({ w }) {
    const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
    const duty = dutyForWine(w)
    const dp = ib ? ((ib + duty) * 1.2) : null
    const wsIb = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
    const wsDP = wsIb ? ((wsIb + duty) * 1.2) : null
    const competitive = w.sale_price && wsDP ? parseFloat(w.sale_price) <= wsDP * 1.10 : false
    const row = (label, val, highlight) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '11px' }}>
        <span style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: highlight ? 600 : 400, color: highlight ? 'var(--ink)' : 'var(--muted)' }}>{val}</span>
      </div>
    )
    return (
      <div style={{ minWidth: '220px', padding: '14px 16px' }}>
        <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>Price Breakdown</div>
        {row('IB (ex-duty)', ib ? `£${ib.toFixed(2)}` : '—')}
        {row('Duty', `£${duty}.00`)}
        {row('DP (IB + duty × 1.2)', dp ? `£${dp.toFixed(2)}` : '—', true)}
        <div style={{ height: '8px' }} />
        {row('WS IB (ex-duty, manual)', wsIb ? `£${wsIb.toFixed(2)}` : '—')}
        {row('WS DP (WS IB + duty × 1.2)', wsDP ? `£${wsDP.toFixed(2)}` : '—', true)}
        {w.ws_price_date && row('WS date', w.ws_price_date)}
        <div style={{ height: '8px' }} />
        {row('Sale Price', w.sale_price ? `£${parseFloat(w.sale_price).toFixed(2)}` : '—', true)}
        {wsDP && w.sale_price && (
          <div style={{ marginTop: '8px', padding: '6px 8px', background: competitive ? 'rgba(45,106,79,0.08)' : 'rgba(192,57,43,0.06)', fontSize: '10px', fontFamily: 'DM Mono, monospace', color: competitive ? '#2d6a4f' : '#c0392b' }}>
            {competitive ? '✓ Lower Than WS Avg (sale ≤ WS DP ×1.10)' : '✗ Above WS DP threshold'}
          </div>
        )}
      </div>
    )
  }

  // ─── Inline WS cell ──────────────────────────────────────────────────────────
  function WSCell({ w }) {
    const [local, setLocal] = useState(w.ws_lowest_per_bottle ? String(w.ws_lowest_per_bottle) : '')
    const [focused, setFocused] = useState(false)
    useEffect(() => { if (!focused) setLocal(w.ws_lowest_per_bottle ? String(w.ws_lowest_per_bottle) : '') }, [w.ws_lowest_per_bottle, focused])
    const duty = dutyForWine(w)
    const wsIb = local ? parseFloat(local) : null
    const wsDP = wsIb ? ((wsIb + duty) * 1.2) : null
    const competitive = w.sale_price && wsDP ? parseFloat(w.sale_price) <= wsDP * 1.10 : false
    const isSaved = saveFlash === w.id

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '180px' }}>
        {/* Row 1: WS IB input + Search button */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>WS IB</span>
          <input
            type="number" step="0.01" min="0"
            value={local}
            placeholder="0.00"
            onChange={e => setLocal(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={e => {
              setFocused(false)
              const val = e.target.value === '' ? null : parseFloat(e.target.value)
              if (val !== (w.ws_lowest_per_bottle || null)) updateWine(w.id, 'ws_lowest_per_bottle', val)
            }}
            style={{ width: '68px', border: '1px solid var(--border)', padding: '3px 5px', fontFamily: 'DM Mono, monospace', fontSize: '11px', background: isSaved ? '#eaf5ef' : 'var(--white)', outline: 'none', transition: 'background 0.3s' }}
          />
          <button
            onClick={() => openWineSearcher(w.description, w.vintage)}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            ↗ WS
          </button>
        </div>
        {/* Row 2: WS DP computed */}
        {wsDP && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>WS DP</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: competitive ? '#2d6a4f' : 'var(--ink)', fontWeight: 600 }}>£{wsDP.toFixed(2)}</span>
            {competitive && (
              <span style={{ fontSize: '9px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em' }}>✓ lower than WS avg</span>
            )}
          </div>
        )}
        {/* Row 3: WS date */}
        {w.ws_price_date && (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: getDateColour(w.ws_price_date) }}>
            {w.ws_price_date}
          </div>
        )}
      </div>
    )
  }

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const thStyle = (col) => ({
    padding: '10px 10px', textAlign: 'left', fontWeight: 400, cursor: 'pointer',
    color: sortCol === col ? '#d4ad45' : 'rgba(253,250,245,0.5)',
    whiteSpace: 'nowrap', fontSize: '9px', letterSpacing: '0.12em', userSelect: 'none'
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading inventory…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100, boxSizing: 'border-box' }}>
        <button onClick={() => router.push('/admin')} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>Cellar</button>
        <div style={{ overflowX: 'auto', display: 'flex', gap: '2px', msOverflowStyle: 'none', scrollbarWidth: 'none', padding: '0 8px' }}>
          {[['Inventory', '/admin'], ['Studio', '/studio'], ['Box Builder', '/boxes'], ['Buyer View', '/buyer'], ['Bottles On Hand', '/local'], ['Consignment', '/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/admin' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/admin' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px', borderRadius: '2px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px', flexShrink: 0 }}>Sign Out</button>
      </div>

      <div style={{ padding: '68px 20px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Inventory</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {importing && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>Importing…</span>}
            <label style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              BBR CSV <input type="file" accept=".csv" onChange={handleBBRImport} style={{ display: 'none' }} />
            </label>
            <label style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Flint CSV <input type="file" accept=".csv" onChange={handleFlintImport} style={{ display: 'none' }} />
            </label>
            {showOtherSourceInput ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input value={otherSourceName} onChange={e => setOtherSourceName(e.target.value)} placeholder="Source name" style={{ border: '1px solid var(--border)', padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', width: '120px', outline: 'none' }} />
                <label style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer' }}>
                  Upload <input ref={otherFileRef} type="file" accept=".csv" onChange={handleOtherImport} style={{ display: 'none' }} />
                </label>
                <button onClick={() => setShowOtherSourceInput(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
            ) : (
              <button onClick={() => setShowOtherSourceInput(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Other CSV</button>
            )}
            <button onClick={exportCSV} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Export</button>
          </div>
        </div>

        {importStatus && (
          <div style={{ padding: '10px 14px', background: importStatus.startsWith('✓') ? 'rgba(45,106,79,0.08)' : 'rgba(212,173,69,0.1)', border: '1px solid var(--border)', fontFamily: 'DM Mono, monospace', fontSize: '11px', marginBottom: '12px' }}>
            {importStatus}
            {importConflicts.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {importConflicts.map((c, i) => (
                  <div key={i} style={{ fontSize: '10px', color: '#c0392b', marginTop: '4px' }}>
                    ⚠️ {c.description} {c.vintage}: stored £{c.storedPrice} (override: "{c.note}") vs incoming £{c.incomingPrice}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ flex: 1, minWidth: '180px', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All Sources</option>
            <option value="Berry Brothers">BBR</option>
            <option value="Flint">Flint</option>
            <option value="Jeroboams">Jeroboams</option>
            <option value="Manual">Manual</option>
          </select>
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
          <select value={filterBuyer} onChange={e => setFilterBuyer(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All</option>
            <option value="included">In Buyer View</option>
            <option value="missing-ws">Missing WS Price</option>
            <option value="competitive">Lower Than WS Avg</option>
            <option value="women">Women in Wine</option>
            <option value="flagged">🚩 Flagged</option>
          </select>
          <button onClick={() => setShowValues(v => !v)} style={{ background: showValues ? 'var(--ink)' : 'none', color: showValues ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.08em' }}>
            {showValues ? '▲ hide values' : '▼ show values'}
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', fontFamily: 'DM Mono, monospace' }}>
          {filtered.length} wines · page {page + 1}/{totalPages || 1}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)' }}>
                <th style={thStyle('description')} onClick={() => handleSort('description')}>Wine {sortCol === 'description' ? (sortDir === 1 ? '↑' : '↓') : ''}</th>
                <th style={thStyle('vintage')} onClick={() => handleSort('vintage')}>Vintage {sortCol === 'vintage' ? (sortDir === 1 ? '↑' : '↓') : ''}</th>
                <th style={{ ...thStyle('colour'), cursor: 'default' }}>Colour</th>
                <th style={{ ...thStyle('region'), cursor: 'default' }}>Region</th>
                <th style={{ ...thStyle('bottle_volume'), cursor: 'default' }}>Size</th>
                <th style={thStyle('quantity')} onClick={() => handleSort('quantity')}>Qty {sortCol === 'quantity' ? (sortDir === 1 ? '↑' : '↓') : ''}</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>My DP</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>WS Pricing</th>
                <th style={{ ...thStyle('sale_price'), cursor: 'default' }}>Sale Price</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>Buyer</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>Notes</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>Flag</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>→</th>
                <th style={{ ...thStyle(), cursor: 'default' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(w => {
                const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
                const duty = dutyForWine(w)
                const dp = ib ? ((ib + duty) * 1.2) : null
                const dotColor = (w.colour || '').toLowerCase().includes('red') ? '#8b2535'
                  : (w.colour || '').toLowerCase().includes('white') ? '#d4c88a'
                  : (w.colour || '').toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
                const isNoteOpen = expandedNote === w.id
                const isPriceOpen = expandedPrice === w.id
                const size = formatBottleSize(w)

                return (
                  <React.Fragment key={w.id}>
                    <tr style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>

                      {/* Wine */}
                      <td style={{ padding: '10px 10px', maxWidth: '260px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '4px', display: 'inline-block' }}></span>
                          <div>
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.3 }}>
                              {w.description}
                              {w.women_note && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#9b3a4a' }}>♀</span>}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                              {w.region}{w.country ? ` · ${w.country}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vintage */}
                      <td style={{ padding: '10px 10px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: 'var(--wine)', whiteSpace: 'nowrap' }}>{w.vintage}</td>

                      {/* Colour */}
                      <td style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: dotColor, marginRight: '4px', verticalAlign: 'middle' }}></span>
                        {w.colour}
                      </td>

                      {/* Region */}
                      <td style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{w.region}</td>

                      {/* Size */}
                      <td style={{ padding: '10px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{size}</td>

                      {/* Qty */}
                      <td style={{ padding: '10px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', textAlign: 'center' }}>{w.quantity}</td>

                      {/* My DP — clearly labelled */}
                      <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                        {dp ? (
                          <div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>DP £{dp.toFixed(2)}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>IB £{ib.toFixed(2)}</div>
                          </div>
                        ) : <span style={{ color: 'var(--border)' }}>—</span>}
                        {showValues && dp && (
                          <div data-price-panel style={{ position: 'relative' }}>
                            <button onClick={() => setExpandedPrice(isPriceOpen ? null : w.id)}
                              style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.05em' }}>
                              {isPriceOpen ? '▲' : '▼ ladder'}
                            </button>
                            {isPriceOpen && (
                              <div data-price-panel style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: 'var(--white)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '220px' }}>
                                <PriceBreakdown w={w} />
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* WS Pricing */}
                      <td style={{ padding: '10px 10px' }}>
                        <WSCell w={w} />
                      </td>

                      {/* Sale Price */}
                      <td style={{ padding: '10px 10px' }}>
                        <input
                          type="number" step="1" min="0"
                          defaultValue={w.sale_price || ''}
                          placeholder="—"
                          onBlur={e => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value)
                            if (val !== (w.sale_price || null)) updateWine(w.id, 'sale_price', val)
                          }}
                          style={{ width: '64px', border: '1px solid var(--border)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', background: 'var(--cream)', outline: 'none', textAlign: 'right' }}
                        />
                      </td>

                      {/* Buyer View toggle */}
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        <button onClick={() => updateWine(w.id, 'include_in_buyer_view', !w.include_in_buyer_view)}
                          style={{ background: w.include_in_buyer_view ? 'var(--wine)' : 'none', color: w.include_in_buyer_view ? '#fff' : 'var(--border)', border: `1px solid ${w.include_in_buyer_view ? 'var(--wine)' : 'var(--border)'}`, padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.05em' }}>
                          {w.include_in_buyer_view ? '✓' : '○'}
                        </button>
                      </td>

                      {/* Notes */}
                      <td style={{ padding: '10px 8px' }}>
                        <button onClick={() => setExpandedNote(isNoteOpen ? null : w.id)}
                          style={{ background: isNoteOpen ? 'var(--ink)' : 'none', color: isNoteOpen ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          {isNoteOpen ? '▲' : '▼ notes'}
                        </button>
                      </td>

                      {/* Flag */}
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button onClick={() => toggleFlag(w)}
                          style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', opacity: w.flagged ? 1 : 0.2, transition: 'opacity 0.2s' }}>
                          🚩
                        </button>
                      </td>

                      {/* Move to Studio */}
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => moveToStudio(w)}
                          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.05em' }}>
                          → Studio
                        </button>
                      </td>

                      {/* Source badge */}
                      <td style={{ padding: '10px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {w.source === 'Berry Brothers' ? 'BBR' : w.source === 'Flint' ? 'Flint' : w.source === 'Jeroboams' ? 'Jero' : w.source || ''}
                      </td>
                    </tr>

                    {/* Expanded notes row */}
                    {isNoteOpen && (
                      <tr style={{ background: 'var(--cream)' }}>
                        <td colSpan={14} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                            {[
                              { label: 'Wine Notes (Buyer View)', field: 'buyer_note', value: w.buyer_note },
                              { label: 'Restaurant Spot', field: 'restaurant_spot', value: w.restaurant_spot },
                              { label: 'Women Note', field: 'women_note', value: w.women_note },
                              { label: 'Flag Note', field: 'flag_note', value: w.flag_note },
                            ].map(({ label, field, value }) => (
                              <div key={field}>
                                <label style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>{label}</label>
                                <textarea
                                  defaultValue={value || ''}
                                  placeholder={`${label}…`}
                                  onBlur={e => { if (e.target.value !== (value || '')) updateWine(w.id, field, e.target.value || null) }}
                                  rows={2}
                                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '6px 8px', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', lineHeight: 1.5, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => setPage(0)} disabled={page === 0} style={{ border: '1px solid var(--border)', background: 'none', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.3 : 1 }}>«</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ border: '1px solid var(--border)', background: 'none', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.3 : 1 }}>‹ Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(0, Math.min(page - 2 + i, totalPages - 1))
              return <button key={p} onClick={() => setPage(p)} style={{ border: '1px solid var(--border)', background: p === page ? 'var(--ink)' : 'none', color: p === page ? '#fff' : 'var(--ink)', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer' }}>{p + 1}</button>
            })}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ border: '1px solid var(--border)', background: 'none', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: page === totalPages - 1 ? 'default' : 'pointer', opacity: page === totalPages - 1 ? 0.3 : 1 }}>Next ›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} style={{ border: '1px solid var(--border)', background: 'none', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: page === totalPages - 1 ? 'default' : 'pointer', opacity: page === totalPages - 1 ? 0.3 : 1 }}>»</button>
          </div>
        )}
      </div>

      {/* Override modal */}
      {overrideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--white)', padding: '28px', width: '100%', maxWidth: '480px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', marginBottom: '16px' }}>Price Override</div>
            <div style={{ fontSize: '12px', marginBottom: '16px', lineHeight: 1.6 }}>
              <strong>{overrideModal.wine.description}</strong><br />
              Changing {overrideModal.field} from <strong>£{overrideModal.oldVal}</strong> to <strong>£{overrideModal.newVal}</strong>
            </div>
            <label style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Reason for override *</label>
            <input value={overrideNote} onChange={e => setOverrideNote(e.target.value)} placeholder="e.g. Invoice PSI010766 confirmed lower price"
              style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveOverride} style={{ flex: 1, background: 'var(--wine)', color: '#fff', border: 'none', padding: '10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Save Override</button>
              <button onClick={() => setOverrideModal(null)} style={{ background: 'none', border: '1px solid var(--border)', padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
