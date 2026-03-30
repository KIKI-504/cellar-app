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
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
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

  function isCompetitive(w) {
    if (!w.retail_price || !w.purchase_price_per_bottle) return false
    return parseFloat(w.retail_price) > w.purchase_price_per_bottle * 1.10
  }

  async function updateWine(id, field, value) {
    const update = { [field]: value }
    if (field === 'retail_price') update.retail_price_date = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('wines').update(update).eq('id', id)
    if (!error) setWines(prev => prev.map(w => w.id === id ? { ...w, ...update } : w))
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

  function openWineSearcher(description, vintage) {
    const keywords = description.toLowerCase().replace(/,/g, '').replace(/\s+/g, '+')
    window.open(`https://www.wine-searcher.com/find/${keywords}/${vintage}/uk/gbp`, '_blank')
  }

  async function moveToStudio(wine) {
    const qty = parseInt(prompt(`Move to studio — how many bottles?\n\n${wine.description} ${wine.vintage}\n(${wine.quantity} in bond)`))
    if (!qty || isNaN(qty) || qty < 1) return
    const dp = ((parseFloat(wine.purchase_price_per_bottle) + 3) * 1.2).toFixed(2)
    const { error } = await supabase.from('studio').insert({
      wine_id: wine.id,
      quantity: qty,
      date_moved: new Date().toISOString().split('T')[0],
      dp_price: dp,
      status: 'Available',
      include_in_local: false
    })
    if (error) alert('Error moving to studio: ' + error.message)
    else alert(`✓ ${qty} bottle${qty > 1 ? 's' : ''} moved to studio at DP £${dp}`)
  }

  // ─── BBR CSV Import ────────────────────────────────────────────────────────

  function parseBBRCsv(text) {
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

  function transformBBRRow(row) {
    const description = (row['Description'] || '').replace(/^[\s,]+/, '').trim()
    const vintage = (row['Vintage'] || '').trim()
    const caseSize = parseInt(row['Case Size'], 10) || 1
    const purchaseCasePrice = parseFloat(row['Purchase Price per Case']) || null
    const purchase_price_per_bottle = purchaseCasePrice ? Math.round((purchaseCasePrice / caseSize) * 100) / 100 : null
    const wsCasePrice = parseFloat(row['Wine Searcher Lowest List Price']) || null
    const ws_lowest_per_bottle = wsCasePrice ? Math.round((wsCasePrice / caseSize) * 100) / 100 : null
    const retail_price = ws_lowest_per_bottle ? Math.round(ws_lowest_per_bottle * 1.20 * 100) / 100 : null
    const livexCasePrice = parseFloat(row['Livex Market Price']) || null
    const livex_market_price = livexCasePrice ? Math.round((livexCasePrice / caseSize) * 100) / 100 : null
    return {
      source: 'Berry Brothers',
      source_id: row['Parent ID'] || '',
      country: row['Country'] || '',
      region: (row['Region'] || '').trim(),
      vintage,
      description,
      colour: row['Colour'] || '',
      bottle_format: row['Bottle Format'] || '',
      bottle_volume: row['Bottle Volume'] || '',
      quantity: row['Quantity in Bottles'] || '',
      case_size: row['Case Size'] || '',
      purchase_price_per_bottle,
      bbx_highest_bid: row['BBX Highest Bid'] || '',
      ws_lowest_per_bottle,
      retail_price,
      retail_price_source: retail_price ? 'Wine Searcher lowest +20%' : null,
      retail_price_date: retail_price ? new Date().toISOString().split('T')[0] : null,
      livex_market_price,
      include_in_buyer_view: false,
    }
  }

  async function handleBBRImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportStatus('Reading file…')
    const text = await file.text()
    const rows = parseBBRCsv(text)
    const wines = rows.map(transformBBRRow).filter(r => r.description && r.source_id)
    setImportStatus(`Parsed ${wines.length} wines — importing…`)
    let inserted = 0, updated = 0, errors = 0
    for (const wine of wines) {
      try {
        const { data: existing } = await supabase.from('wines')
          .select('id, include_in_buyer_view, sale_price, women_note, producer_note')
          .eq('source_id', wine.source_id).eq('source', 'Berry Brothers').maybeSingle()
        if (existing) {
          const { error } = await supabase.from('wines').update({
            quantity: wine.quantity,
            purchase_price_per_bottle: wine.purchase_price_per_bottle,
            bbx_highest_bid: wine.bbx_highest_bid,
            ws_lowest_per_bottle: wine.ws_lowest_per_bottle,
            retail_price: wine.retail_price,
            retail_price_source: wine.retail_price_source,
            retail_price_date: wine.retail_price_date,
            livex_market_price: wine.livex_market_price,
          }).eq('id', existing.id)
          if (error) throw error
          updated++
        } else {
          const { error } = await supabase.from('wines').insert(wine)
          if (error) throw error
          inserted++
        }
      } catch (err) {
        console.error('Import error:', wine.description, err)
        errors++
      }
    }
    setImportStatus(`✓ Done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}`)
    setImporting(false)
    e.target.value = ''
    await fetchWines()
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Source','ID','Description','Vintage','Colour','Country','Region','Format','Volume','Quantity','Cost IB/Btl','DP/Btl','+10% IB','+15% IB','+10% DP','+15% DP','WS Lowest/Btl','Retail Price IB','Retail Price Source','Retail Price Date','Livex/Btl','Sale Price','In Buyer View','Women Note','Producer Note']
    const rows = wines.map(w => {
      const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
      const dp = ib ? ((ib + 3) * 1.2) : null
      return [
        w.source, w.source_id, w.description, w.vintage, w.colour, w.country, w.region,
        w.bottle_format, w.bottle_volume, w.quantity,
        ib || '', dp ? dp.toFixed(2) : '',
        ib ? (ib * 1.10).toFixed(2) : '', ib ? (ib * 1.15).toFixed(2) : '',
        dp ? (dp * 1.10).toFixed(2) : '', dp ? (dp * 1.15).toFixed(2) : '',
        w.ws_lowest_per_bottle || '', w.retail_price || '',
        w.retail_price_source || '', w.retail_price_date || '',
        w.livex_market_price || '', w.sale_price || '',
        w.include_in_buyer_view ? 'Yes' : 'No', w.women_note || '', w.producer_note || ''
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cellar-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Price breakdown panel ─────────────────────────────────────────────────

  function PriceBreakdown({ w }) {
    const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
    const dp = ib ? ((ib + 3) * 1.2) : null
    const retail = w.retail_price ? parseFloat(w.retail_price) : null
    const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
    const livex = w.livex_market_price ? parseFloat(w.livex_market_price) : null
    const sale = w.sale_price ? parseFloat(w.sale_price) : null

    const row = (label, val, color) => val != null ? (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '10px', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: color ? 600 : 400, color: color || 'rgba(253,250,245,0.9)' }}>£{val.toFixed(2)}</span>
      </div>
    ) : null

    const divider = () => <div style={{ height: '6px' }} />

    return (
      <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 300, background: '#1a1208', border: '1px solid rgba(212,173,69,0.4)', padding: '14px 16px', minWidth: '240px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4ad45', marginBottom: '10px', fontFamily: 'DM Mono, monospace' }}>Price breakdown</div>
        {row('Cost IB /btl', ib)}
        {row('Duty Paid (DP) /btl', dp)}
        {divider()}
        {row('+10% on IB', ib ? ib * 1.10 : null)}
        {row('+15% on IB', ib ? ib * 1.15 : null)}
        {row('+10% on DP', dp ? dp * 1.10 : null)}
        {row('+15% on DP', dp ? dp * 1.15 : null)}
        {divider()}
        {ws && row('WS Lowest IB', ws)}
        {livex && row('Livex IB', livex)}
        {retail && row('Retail IB (est.)', retail, '#86efac')}
        {sale && row('Your sale price', sale, '#d4ad45')}
        {!ib && <div style={{ fontSize: '10px', color: 'rgba(253,250,245,0.4)', fontFamily: 'DM Mono, monospace' }}>No cost data available</div>}
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
  const totalCostValue = wines.reduce((sum, w) => sum + ((parseInt(w.quantity) || 0) * (parseFloat(w.purchase_price_per_bottle) || 0)), 0)
  const totalRetailValue = wines.reduce((sum, w) => sum + ((parseInt(w.quantity) || 0) * (parseFloat(w.retail_price) || 0)), 0)
  const winesWithRetail = wines.filter(w => w.retail_price).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading cellar…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }} onClick={() => { setExpandedPrice(null) }}>
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'rgba(107,30,46,0.6)', color: '#d4ad45', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Inventory</button>
          <button onClick={() => router.push('/studio')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Studio</button>
          <button onClick={() => router.push('/labels')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Labels</button>
          <button onClick={() => router.push('/buyer')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Buyer View</button>
          <button onClick={() => router.push('/local')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Local Sales</button>
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Wine Inventory</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{filtered.length} wines</div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '12px', fontSize: '11px', flexWrap: 'wrap' }}>
          {[['wines total', wines.length], ['Berry Brothers', bbCount], ['Flint', flintCount], ['in buyer view', inBuyerCount], ['competitive', competitiveCount], ['need retail price', missingRetailCount], ['women-led', womenCount]].map(([label, n]) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 500, color: label === 'women-led' ? '#9b3a4a' : 'var(--wine)', fontSize: '14px' }}>{label === 'women-led' ? '♀ ' : ''}{n}</span>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Collection value bar */}
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
          <select value={filterBuyer} onChange={e => setFilterBuyer(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Wines</option>
            <option value="included">In Buyer View</option>
            <option value="missing-retail">Missing Retail Price</option>
            <option value="competitive">Competitive Only</option>
            <option value="women">Women-Led</option>
          </select>
          <button onClick={exportCSV} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>↓ Export</button>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <input type="file" accept=".csv" onChange={handleBBRImport} disabled={importing} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
            <span style={{ display: 'inline-block', background: importing ? 'rgba(107,30,46,0.4)' : 'rgba(107,30,46,0.08)', border: '1px solid rgba(107,30,46,0.3)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: importing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {importing ? '⏳ Importing…' : '↑ Import BBR'}
            </span>
          </label>
          {importStatus && (
            <span style={{ fontSize: '11px', color: importStatus.startsWith('✓') ? '#2d6a4f' : 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{importStatus}</span>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                {[['source','Src'],['description','Wine'],['vintage','Vin.'],['colour','Colour'],['region','Region'],['bottle_format','Format'],['quantity','Qty']].map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === col ? '#d4ad45' : 'var(--white)' }}>
                    {label} {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  </th>
                ))}
                <th onClick={() => handleSort('purchase_price_per_bottle')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'purchase_price_per_bottle' ? '#d4ad45' : 'var(--white)' }}>
                  Cost IB {sortCol === 'purchase_price_per_bottle' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  <span style={{ display: 'block', fontSize: '8px', color: 'rgba(253,250,245,0.35)', fontWeight: 300, letterSpacing: '0.03em', textTransform: 'none', marginTop: '1px' }}>▼ click for all prices</span>
                </th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: '200px' }}>Retail IB</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Comp?</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Sale £</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Notes</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Buyer</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Studio</th>
              </tr>
            </thead>
            <tbody>
              {slice.map(w => {
                const pp = w.purchase_price_per_bottle
                const retail = w.retail_price ? parseFloat(w.retail_price) : null
                const comp = retail && pp ? retail > pp * 1.10 : null
                const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
                const isExpanded = expandedNote === w.id
                const isPriceOpen = expandedPrice === w.id

                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid #ede6d6', background: w.include_in_buyer_view ? 'rgba(45,106,79,0.04)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '2px', background: w.source === 'Berry Brothers' ? 'rgba(107,30,46,0.1)' : 'rgba(184,148,42,0.12)', color: w.source === 'Berry Brothers' ? 'var(--wine)' : '#7a5e10', whiteSpace: 'nowrap' }}>{w.source === 'Berry Brothers' ? 'BB' : 'Flint'}</span>
                    </td>
                    <td style={{ padding: '9px 12px', maxWidth: '320px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        {w.women_note && <span title={w.women_note} style={{ fontSize: '12px', flexShrink: 0, cursor: 'help' }}>♀</span>}
                        <div>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3 }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{w.region}{w.country ? ` · ${w.country}` : ''}</div>
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

                    {/* Cost IB — click to open price breakdown */}
                    <td style={{ padding: '9px 12px', position: 'relative' }}
                      onClick={e => { e.stopPropagation(); setExpandedPrice(isPriceOpen ? null : w.id) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontWeight: 600, color: isPriceOpen ? 'var(--wine)' : 'var(--ink)', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>
                          {pp ? `£${parseFloat(pp).toFixed(2)}` : '—'}
                        </span>
                        <span style={{ fontSize: '9px', color: isPriceOpen ? 'var(--wine)' : '#bbb' }}>{isPriceOpen ? '▲' : '▼'}</span>
                      </div>
                      {isPriceOpen && <PriceBreakdown w={w} />}
                    </td>

                    {/* Retail IB */}
                    <td style={{ padding: '9px 12px', minWidth: '200px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                        <input type="number" step="0.01" defaultValue={w.retail_price || ''} placeholder="0.00"
                          onBlur={e => { if (e.target.value !== String(w.retail_price || '')) updateWine(w.id, 'retail_price', e.target.value ? parseFloat(e.target.value) : null) }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: '72px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                        <button onClick={e => { e.stopPropagation(); openWineSearcher(w.description, w.vintage) }} title="Look up on Wine Searcher"
                          style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 6px', cursor: 'pointer', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>🔍 WS</button>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={w.retail_price_source === 'Wine Searcher avg'}
                            onChange={e => updateWine(w.id, 'retail_price_source', e.target.checked ? 'Wine Searcher avg' : '')}
                            style={{ accentColor: 'var(--wine)', cursor: 'pointer' }} />
                          <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>WS avg</span>
                        </label>
                        {w.retail_price_source !== 'Wine Searcher avg' && (
                          <input type="text" defaultValue={w.retail_price_source || ''} placeholder="source…"
                            onBlur={e => { if (e.target.value !== (w.retail_price_source || '')) updateWine(w.id, 'retail_price_source', e.target.value || null) }}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '10px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 4px', fontFamily: 'DM Mono, monospace', outline: 'none', width: '80px' }} />
                        )}
                        {w.retail_price_date && <span style={{ fontSize: '10px', color: getDateColour(w.retail_price_date), whiteSpace: 'nowrap' }}>{w.retail_price_date}</span>}
                      </div>
                    </td>

                    <td style={{ padding: '9px 12px', color: comp === null ? 'var(--muted)' : comp ? '#2d6a4f' : '#c0392b', fontWeight: comp ? 600 : 400 }}>
                      {comp === null ? '—' : comp ? '✓' : '✗'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <input type="number" step="0.01" defaultValue={w.sale_price || ''} placeholder="0.00"
                        onBlur={e => { if (e.target.value !== String(w.sale_price || '')) updateWine(w.id, 'sale_price', e.target.value ? parseFloat(e.target.value) : null) }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '72px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                    </td>
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
                          style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                          + note
                        </button>
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
                      <button onClick={e => { e.stopPropagation(); moveToStudio(w) }} title="Move to studio"
                        style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>→ Studio</button>
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
    </div>
  )
}
