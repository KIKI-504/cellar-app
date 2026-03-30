'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function StudioPage() {
  const router = useRouter()
  const [studioWines, setStudioWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('Available')
  const [search, setSearch] = useState('')

  // Move to studio modal
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveSearch, setMoveSearch] = useState('')
  const [moveResults, setMoveResults] = useState([])
  const [selectedWine, setSelectedWine] = useState(null)
  const [moveQty, setMoveQty] = useState(1)
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0])
  const [moveNotes, setMoveNotes] = useState('')
  const [moveSaving, setMoveSaving] = useState(false)

  // Scan modal
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanFile, setScanFile] = useState(null)
  const [scanPreview, setScanPreview] = useState(null)
  const [scanAnalysing, setScanAnalysing] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [scanRaw, setScanRaw] = useState(null)
  const [scanMatch, setScanMatch] = useState(null)       // matched wine from DB
  const [scanWine, setScanWine] = useState(null)         // selected wine (may differ from match)
  const [scanSearch, setScanSearch] = useState('')
  const [scanSearchResults, setScanSearchResults] = useState([])

  // Scan form fields
  const [scanQty, setScanQty] = useState(1)
  const [scanDate, setScanDate] = useState(new Date().toISOString().split('T')[0])
  const [scanNotes, setScanNotes] = useState('')
  const [scanVintage, setScanVintage] = useState('')
  const [scanIBPrice, setScanIBPrice] = useState('')     // purchase price IB
  const [scanRetailPrice, setScanRetailPrice] = useState('')  // retail price
  const [scanSaving, setScanSaving] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchStudio()
  }, [])

  async function fetchStudio() {
    setLoading(true)
    const { data, error } = await supabase
      .from('studio')
      .select('*, wines(*)')
      .order('date_moved', { ascending: false })
    if (error) console.error(error)
    else setStudioWines(data || [])
    setLoading(false)
  }

  function calcDP(ibPrice) {
    if (!ibPrice) return null
    return ((parseFloat(ibPrice) + 3) * 1.2).toFixed(2)
  }

  async function updateStudio(id, field, value) {
    const { error } = await supabase.from('studio').update({ [field]: value }).eq('id', id)
    if (!error) setStudioWines(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function deleteStudio(id) {
    if (!confirm('Remove this entry from studio inventory?')) return
    const { error } = await supabase.from('studio').delete().eq('id', id)
    if (!error) setStudioWines(prev => prev.filter(s => s.id !== id))
  }

  // ─── Move to Studio (manual search) ────────────────────────────────────────

  async function searchWines(q) {
    setMoveSearch(q)
    if (q.length < 2) { setMoveResults([]); return }
    const { data } = await supabase.from('wines')
      .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
      .ilike('description', `%${q}%`).order('description').limit(10)
    setMoveResults(data || [])
  }

  async function confirmMove() {
    if (!selectedWine) return
    setMoveSaving(true)
    const dp = calcDP(selectedWine.purchase_price_per_bottle)
    const { error } = await supabase.from('studio').insert({
      wine_id: selectedWine.id,
      quantity: moveQty,
      date_moved: moveDate,
      dp_price: dp,
      status: 'Available',
      notes: moveNotes || null,
      include_in_local: false
    })
    if (!error) {
      await fetchStudio()
      closeMoveModal()
    }
    setMoveSaving(false)
  }

  function closeMoveModal() {
    setShowMoveModal(false)
    setSelectedWine(null)
    setMoveSearch('')
    setMoveResults([])
    setMoveQty(1)
    setMoveNotes('')
    setMoveDate(new Date().toISOString().split('T')[0])
  }

  // ─── Scan Flow ──────────────────────────────────────────────────────────────

  function openScanModal() {
    setShowScanModal(true)
    setScanFile(null)
    setScanPreview(null)
    setScanAnalysing(false)
    setScanDone(false)
    setScanRaw(null)
    setScanMatch(null)
    setScanWine(null)
    setScanSearch('')
    setScanSearchResults([])
    setScanQty(1)
    setScanDate(new Date().toISOString().split('T')[0])
    setScanNotes('')
    setScanVintage('')
    setScanIBPrice('')
    setScanRetailPrice('')
  }

  function handleScanFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setScanFile(file)
    setScanDone(false)
    setScanRaw(null)
    setScanMatch(null)
    setScanWine(null)
    const reader = new FileReader()
    reader.onload = ev => setScanPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function analyseLabel() {
    if (!scanFile) return
    setScanAnalysing(true)

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(scanFile)
      })

      const response = await fetch('/api/analyse-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: scanFile.type })
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      const extracted = result.data
      setScanRaw(extracted)
      setScanVintage(extracted.vintage || '')
      setScanDone(true)

      // Try to match in DB — first with vintage, then without
      const searchTerm = extracted.producer || extracted.wine_name
      if (searchTerm) {
        let matches = null
        if (extracted.vintage) {
          const { data } = await supabase.from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, retail_price, quantity')
            .ilike('description', `%${searchTerm}%`)
            .eq('vintage', extracted.vintage)
            .limit(5)
          matches = data
        }
        if (!matches || matches.length === 0) {
          const { data } = await supabase.from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, retail_price, quantity')
            .ilike('description', `%${searchTerm}%`)
            .limit(5)
          matches = data
        }
        if (matches && matches.length > 0) {
          setScanMatch(matches[0])
          setScanWine(matches[0])
          setScanIBPrice(matches[0].purchase_price_per_bottle ? String(matches[0].purchase_price_per_bottle) : '')
          setScanRetailPrice(matches[0].retail_price ? String(matches[0].retail_price) : '')
        }
      }
    } catch (err) {
      console.error('Label analysis error:', err)
      alert('Label reading failed: ' + err.message)
    }
    setScanAnalysing(false)
  }

  async function scanSearchWines(q) {
    setScanSearch(q)
    if (q.length < 2) { setScanSearchResults([]); return }
    const { data } = await supabase.from('wines')
      .select('id, description, vintage, colour, region, purchase_price_per_bottle, retail_price, quantity')
      .ilike('description', `%${q}%`).order('description').limit(8)
    setScanSearchResults(data || [])
  }

  function selectScanWine(w) {
    setScanWine(w)
    setScanMatch(w)
    setScanSearch('')
    setScanSearchResults([])
    setScanIBPrice(w.purchase_price_per_bottle ? String(w.purchase_price_per_bottle) : '')
    setScanRetailPrice(w.retail_price ? String(w.retail_price) : '')
  }

  async function saveScanEntry() {
    setScanSaving(true)
    const ibPrice = scanIBPrice ? parseFloat(scanIBPrice) : (scanWine?.purchase_price_per_bottle || null)
    const dp = ibPrice ? ((ibPrice + 3) * 1.2).toFixed(2) : null
    const retailPrice = scanRetailPrice ? parseFloat(scanRetailPrice) : (scanWine?.retail_price || null)

    const insertData = {
      wine_id: scanWine?.id || null,
      quantity: scanQty,
      date_moved: scanDate,
      dp_price: dp,
      status: 'Available',
      notes: scanNotes || null,
      include_in_local: false,
      unlinked_description: !scanWine
        ? [scanRaw?.wine_name, scanRaw?.producer].filter(Boolean).join(', ')
        : null,
      unlinked_vintage: !scanWine ? (scanVintage || scanRaw?.vintage || null) : null,
    }

    // If we have a linked wine and a retail price, update it on the wine record too
    if (scanWine?.id && retailPrice && retailPrice !== scanWine?.retail_price) {
      await supabase.from('wines').update({
        retail_price: retailPrice,
        retail_price_source: 'Manual',
        retail_price_date: new Date().toISOString().split('T')[0]
      }).eq('id', scanWine.id)
    }

    // ── Consolidation: check for an existing Available entry for the same wine ──
    let saved = false

    if (scanWine?.id) {
      // Linked wine — match on wine_id
      const { data: existing } = await supabase
        .from('studio')
        .select('id, quantity')
        .eq('wine_id', scanWine.id)
        .eq('status', 'Available')
        .maybeSingle()
      if (existing) {
        const { error } = await supabase
          .from('studio')
          .update({ quantity: existing.quantity + scanQty })
          .eq('id', existing.id)
        if (!error) saved = true
        else alert('Save failed: ' + error.message)
      }
    } else if (insertData.unlinked_description) {
      // Unlinked wine — match on description + vintage
      const { data: existing } = await supabase
        .from('studio')
        .select('id, quantity')
        .eq('unlinked_description', insertData.unlinked_description)
        .eq('unlinked_vintage', insertData.unlinked_vintage || '')
        .eq('status', 'Available')
        .maybeSingle()
      if (existing) {
        const { error } = await supabase
          .from('studio')
          .update({ quantity: existing.quantity + scanQty })
          .eq('id', existing.id)
        if (!error) saved = true
        else alert('Save failed: ' + error.message)
      }
    }

    // No existing entry found — insert fresh
    if (!saved) {
      const { error } = await supabase.from('studio').insert(insertData)
      if (!error) saved = true
      else alert('Save failed: ' + error.message)
    }

    if (saved) {
      await fetchStudio()
      setShowScanModal(false)
    }
    setScanSaving(false)
  }

  // ─── Table helpers ──────────────────────────────────────────────────────────

  const filtered = studioWines.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return [s.wines?.description, s.wines?.vintage, s.wines?.region, s.unlinked_description].join(' ').toLowerCase().includes(q)
    }
    return true
  })

  const availableCount = studioWines.filter(s => s.status === 'Available').length
  const localCount = studioWines.filter(s => s.include_in_local && s.status === 'Available').length
  const totalBottles = studioWines.filter(s => s.status === 'Available').reduce((sum, s) => sum + (s.quantity || 0), 0)
  const statusColour = s => s === 'Available' ? '#2d6a4f' : s === 'Consumed' ? '#7a5e10' : '#c0392b'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading studio…</div>
    </div>
  )

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['Inventory', '/admin'], ['Studio', '/studio'], ['Labels', '/labels'], ['Buyer View', '/buyer'], ['Local Sales', '/local']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/studio' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/studio' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Studio Inventory</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{totalBottles} bottles available</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={openScanModal} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📷 Scan Bottle</button>
            <button onClick={() => setShowMoveModal(true)} style={{ background: 'none', border: '1px solid var(--wine)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Move to Studio</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
          {[['available', availableCount], ['on local sales', localCount], ['total bottles', totalBottles]].map(([label, n]) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 500, color: 'var(--wine)', fontSize: '14px' }}>{n}</span>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search studio…" style={{ flex: 1, minWidth: '200px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Status</option>
            <option value="Available">Available</option>
            <option value="Consumed">Consumed</option>
            <option value="Sold">Sold</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                {['Wine', 'Vintage', 'Qty', 'Moved', 'DP Price', 'Status', 'Local Sales', 'Notes', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>No studio wines yet — scan or move something from bond to get started.</td></tr>
              )}
              {filtered.map(s => {
                const w = s.wines
                const dotColor = w?.colour?.toLowerCase().includes('red') ? '#8b2535' : w?.colour?.toLowerCase().includes('white') ? '#d4c88a' : '#d4748a'
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #ede6d6', background: s.include_in_local ? 'rgba(45,106,79,0.04)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', maxWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                        <div>
                          {w ? (
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3 }}>{w.description}</div>
                          ) : (
                            <input type="text" defaultValue={s.unlinked_description || ''}
                              onBlur={e => { if (e.target.value !== (s.unlinked_description || '')) updateStudio(s.id, 'unlinked_description', e.target.value) }}
                              placeholder="Wine name…"
                              style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 6px', outline: 'none', width: '180px' }} />
                          )}
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{w?.region || (s.unlinked_description ? 'Not in cellar database' : '')}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>
                      {w ? w.vintage : (
                        <input type="text" defaultValue={s.unlinked_vintage || ''}
                          onBlur={e => { if (e.target.value !== (s.unlinked_vintage || '')) updateStudio(s.id, 'unlinked_vintage', e.target.value) }}
                          placeholder="e.g. 2021"
                          style={{ width: '60px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                      )}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <input type="number" min="0" defaultValue={s.quantity}
                        onBlur={e => { if (parseInt(e.target.value) !== s.quantity) updateStudio(s.id, 'quantity', parseInt(e.target.value)) }}
                        style={{ width: '52px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{s.date_moved}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <input type="number" step="0.01" defaultValue={s.dp_price ? parseFloat(s.dp_price).toFixed(2) : calcDP(w?.purchase_price_per_bottle) || ''}
                        onBlur={e => { if (e.target.value !== String(s.dp_price || '')) updateStudio(s.id, 'dp_price', e.target.value ? parseFloat(e.target.value) : null) }}
                        placeholder="0.00"
                        style={{ width: '72px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', fontWeight: 600 }} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <select value={s.status} onChange={e => updateStudio(s.id, 'status', e.target.value)}
                        style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', color: statusColour(s.status) }}>
                        <option value="Available">Available</option>
                        <option value="Consumed">Consumed</option>
                        <option value="Sold">Sold</option>
                      </select>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!s.include_in_local}
                        onChange={e => updateStudio(s.id, 'include_in_local', e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--wine)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <input type="text" defaultValue={s.notes || ''} placeholder="notes…"
                        onBlur={e => { if (e.target.value !== (s.notes || '')) updateStudio(s.id, 'notes', e.target.value || null) }}
                        style={{ width: '120px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={() => deleteStudio(s.id)} title="Remove from studio"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', padding: '2px 4px' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Move to Studio Modal ─────────────────────────────────────────────── */}
      {showMoveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, marginBottom: '20px' }}>Move to Studio</div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Search wine</label>
              <input value={moveSearch} onChange={e => searchWines(e.target.value)} placeholder="Start typing a wine name…"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              {moveResults.length > 0 && !selectedWine && (
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '200px', overflowY: 'auto' }}>
                  {moveResults.map(w => (
                    <div key={w.id} onClick={() => { setSelectedWine(w); setMoveSearch(w.description); setMoveResults([]) }}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{w.vintage} · {w.region} · IB £{parseFloat(w.purchase_price_per_bottle).toFixed(2)} → DP £{calcDP(w.purchase_price_per_bottle)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedWine && (
              <div style={{ background: 'rgba(107,30,46,0.06)', border: '1px solid rgba(107,30,46,0.2)', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>{selectedWine.description}, {selectedWine.vintage}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>IB £{parseFloat(selectedWine.purchase_price_per_bottle).toFixed(2)} → DP £{calcDP(selectedWine.purchase_price_per_bottle)} · {selectedWine.quantity} in bond</div>
                <button onClick={() => { setSelectedWine(null); setMoveSearch('') }} style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Change</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Quantity (bottles)</label>
                <input type="number" min="1" value={moveQty} onChange={e => setMoveQty(parseInt(e.target.value))}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Date moved</label>
                <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Notes (optional)</label>
              <input type="text" value={moveNotes} onChange={e => setMoveNotes(e.target.value)} placeholder="e.g. From case opened for tasting"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeMoveModal} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmMove} disabled={!selectedWine || moveSaving}
                style={{ background: selectedWine ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selectedWine ? 'pointer' : 'not-allowed' }}>
                {moveSaving ? 'Saving…' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Scan Modal ───────────────────────────────────────────────────────── */}
      {showScanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '560px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Scan a Bottle</div>
              <button onClick={() => setShowScanModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
            </div>

            {/* Step 1 — Photo */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>1. Photograph the label</label>
              {!scanPreview ? (
                <div onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--border)', padding: '32px', textAlign: 'center', cursor: 'pointer', background: 'var(--white)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--wine)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📷</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em' }}>TAP TO TAKE PHOTO OR UPLOAD</div>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleScanFileSelect} style={{ display: 'none' }} />
                </div>
              ) : (
                <div>
                  <img src={scanPreview} alt="Label" style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', border: '1px solid var(--border)', background: 'var(--white)' }} />
                  <button onClick={() => { setScanFile(null); setScanPreview(null); setScanDone(false); setScanRaw(null); setScanMatch(null); setScanWine(null) }}
                    style={{ marginTop: '6px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Retake photo</button>
                </div>
              )}
            </div>

            {/* Read Label button */}
            {scanPreview && !scanDone && (
              <button onClick={analyseLabel} disabled={scanAnalysing}
                style={{ width: '100%', background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: scanAnalysing ? 'wait' : 'pointer', marginBottom: '16px' }}>
                {scanAnalysing ? '🔍 Reading label…' : '🔍 Read Label'}
              </button>
            )}

            {/* Step 2 — Match */}
            {scanDone && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>2. Confirm wine</label>

                {/* What was extracted */}
                {scanRaw && (
                  <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '10px 12px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>READ FROM LABEL</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>
                      {[scanRaw.wine_name, scanRaw.producer].filter(Boolean).join(' — ')}
                      {scanRaw.vintage && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{scanRaw.vintage}</span>}
                    </div>
                    {scanRaw.region && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{scanRaw.region}</div>}
                  </div>
                )}

                {/* Match or no match */}
                {scanWine ? (
                  <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', marginBottom: '6px' }}>✓ MATCHED IN CELLAR DATABASE</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>{scanWine.description}, {scanWine.vintage}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>{scanWine.region} · {scanWine.quantity} in bond</div>
                    <button onClick={() => { setScanWine(null); setScanMatch(null) }}
                      style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Not right — search manually</button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.2)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#c0392b', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>NO MATCH FOUND — search manually or save as unlinked</div>
                    <input value={scanSearch} onChange={e => scanSearchWines(e.target.value)} placeholder="Search wine name…"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    {scanSearchResults.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '160px', overflowY: 'auto' }}>
                        {scanSearchResults.map(w => (
                          <div key={w.id} onClick={() => selectScanWine(w)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px' }}>{w.description}</div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{w.vintage} · DP £{calcDP(w.purchase_price_per_bottle)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Details form — always visible once label is read */}
            {scanDone && (
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>3. Enter details</label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>QUANTITY</label>
                    <input type="number" min="1" value={scanQty} onChange={e => setScanQty(parseInt(e.target.value) || 1)}
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>DATE MOVED</label>
                    <input type="date" value={scanDate} onChange={e => setScanDate(e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                {!scanWine && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>VINTAGE</label>
                    <input type="text" value={scanVintage} onChange={e => setScanVintage(e.target.value)} placeholder="e.g. 2021"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>
                      PURCHASE PRICE IB (£/btl)
                    </label>
                    <input type="number" step="0.01" value={scanIBPrice} onChange={e => setScanIBPrice(e.target.value)} placeholder="0.00"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    {scanIBPrice && <div style={{ fontSize: '10px', color: 'var(--wine)', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>DP £{((parseFloat(scanIBPrice) + 3) * 1.2).toFixed(2)}</div>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>
                      RETAIL PRICE (£/btl)
                    </label>
                    <input type="number" step="0.01" value={scanRetailPrice} onChange={e => setScanRetailPrice(e.target.value)} placeholder="0.00"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    {scanRetailPrice && scanIBPrice && (
                      <div style={{ fontSize: '10px', color: '#2d6a4f', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>
                        {((parseFloat(scanRetailPrice) / parseFloat(scanIBPrice) - 1) * 100).toFixed(0)}% above cost
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>NOTES (optional)</label>
                  <input type="text" value={scanNotes} onChange={e => setScanNotes(e.target.value)} placeholder="optional notes…"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Save button — big and obvious */}
                <button onClick={saveScanEntry} disabled={scanSaving}
                  style={{ width: '100%', background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: scanSaving ? 'wait' : 'pointer', fontWeight: 600 }}>
                  {scanSaving ? 'Saving…' : `✓ Add ${scanQty} bottle${scanQty !== 1 ? 's' : ''} to Studio`}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
