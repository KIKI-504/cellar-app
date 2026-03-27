'use client'
import { useState, useEffect } from 'react'
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
    const parts = description.split(',').map(p => p.trim())
    const keywords = (parts.length > 1 ? parts.slice(0, -1) : parts).join(' ').toLowerCase().replace(/\s+/g, '+')
    window.open(`https://www.wine-searcher.com/find/${keywords}/${vintage}/uk/gbp`, '_blank')
  }

  function exportCSV() {
    const headers = ['Source','ID','Description','Vintage','Colour','Country','Region','Format','Volume','Quantity','Cost/Bottle','10%','15%','Retail Price IB','Retail Price Source','Retail Price Date','Sale Price','In Buyer View','Women Note','Producer Note']
    const rows = wines.map(w => [
      w.source, w.source_id, w.description, w.vintage, w.colour, w.country, w.region,
      w.bottle_format, w.bottle_volume, w.quantity, w.purchase_price_per_bottle,
      w.purchase_price_per_bottle ? (w.purchase_price_per_bottle * 1.10).toFixed(2) : '',
      w.purchase_price_per_bottle ? (w.purchase_price_per_bottle * 1.15).toFixed(2) : '',
      w.retail_price, w.retail_price_source || '', w.retail_price_date, w.sale_price,
      w.include_in_buyer_view ? 'Yes' : 'No', w.women_note || '', w.producer_note || ''
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cellar-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'rgba(107,30,46,0.6)', color: '#d4ad45', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Inventory</button>
    <button onClick={() => router.push('/labels')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Labels</button>
          <button onClick={() => router.push('/buyer')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Buyer View</button>
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
                <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Collection cost</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#d4ad45' }}>£{totalCostValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Retail value</span>
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
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                {[['source','Src'],['description','Wine'],['vintage','Vin.'],['colour','Colour'],['region','Region'],['bottle_format','Format'],['quantity','Qty'],['purchase_price_per_bottle','Cost/Btl']].map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === col ? '#d4ad45' : 'var(--white)' }}>
                    {label} {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  </th>
                ))}
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#86efac' }}>+10%</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ade80' }}>+15%</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: '200px' }}>Retail IB</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Comp?</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Sale £</th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Notes</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Buyer</th>
              </tr>
            </thead>
            <tbody>
              {slice.map(w => {
                const pp = w.purchase_price_per_bottle
                const p10 = pp ? (pp * 1.10).toFixed(2) : ''
                const p15 = pp ? (pp * 1.15).toFixed(2) : ''
                const retail = w.retail_price ? parseFloat(w.retail_price) : null
                const comp = retail && pp ? retail > pp * 1.10 : null
                const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
                const isExpanded = expandedNote === w.id

                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid #ede6d6', background: w.include_in_buyer_view ? 'rgba(45,106,79,0.04)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '2px', background: w.source === 'Berry Brothers' ? 'rgba(107,30,46,0.1)' : 'rgba(184,148,42,0.12)', color: w.source === 'Berry Brothers' ? 'var(--wine)' : '#7a5e10', whiteSpace: 'nowrap' }}>{w.source === 'Berry Brothers' ? 'BB' : 'Flint'}</span>
                    </td>
                    <td style={{ padding: '9px 12px', maxWidth: '240px' }}>
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
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{w.bottle_format ? `${w.bottle_format}${w.bottle_volume ? ' · ' + w.bottle_volume : ''}` : '—'}</td>
                    <td style={{ padding: '9px 12px' }}>{w.quantity || '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>£{pp ? pp.toFixed(2) : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#2d6a4f', fontWeight: 500 }}>£{p10 || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#1b4332', fontWeight: 600 }}>£{p15 || '—'}</td>
                    <td style={{ padding: '9px 12px', minWidth: '200px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                        <input type="number" step="0.01" defaultValue={w.retail_price || ''} placeholder="0.00"
                          onBlur={e => { if (e.target.value !== String(w.retail_price || '')) updateWine(w.id, 'retail_price', e.target.value ? parseFloat(e.target.value) : null) }}
                          style={{ width: '72px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                        <button onClick={() => openWineSearcher(w.description, w.vintage)} title="Look up on Wine Searcher"
                          style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 6px', cursor: 'pointer', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>🔍 WS</button>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" checked={w.retail_price_source === 'Wine Searcher avg'}
                            onChange={e => updateWine(w.id, 'retail_price_source', e.target.checked ? 'Wine Searcher avg' : '')}
                            style={{ accentColor: 'var(--wine)', cursor: 'pointer' }} />
                          <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>WS avg</span>
                        </label>
                        {w.retail_price_source !== 'Wine Searcher avg' && (
                          <input type="text" defaultValue={w.retail_price_source || ''} placeholder="source…"
                            onBlur={e => { if (e.target.value !== (w.retail_price_source || '')) updateWine(w.id, 'retail_price_source', e.target.value || null) }}
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
                        style={{ width: '72px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                    </td>
                    <td style={{ padding: '9px 12px', maxWidth: '200px' }}>
                      {(w.women_note || w.producer_note) && (
                        <div>
                          <button onClick={() => setExpandedNote(isExpanded ? null : w.id)}
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
                        <button onClick={() => setExpandedNote(isExpanded ? null : w.id)}
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
                        style={{ width: '16px', height: '16px', accentColor: 'var(--wine)', cursor: 'pointer' }} />
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
