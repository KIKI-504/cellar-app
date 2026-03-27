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

  // Photo import
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoAnalysing, setPhotoAnalysing] = useState(false)
  const [photoMatch, setPhotoMatch] = useState(null)
  const [photoRaw, setPhotoRaw] = useState(null)
  const [photoQty, setPhotoQty] = useState(1)
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0])
  const [photoNotes, setPhotoNotes] = useState('')
  const [photoVintage, setPhotoVintage] = useState('')
  const [photoPrice, setPhotoPrice] = useState('')
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

  function calcDP(purchasePrice) {
    if (!purchasePrice) return null
    return ((parseFloat(purchasePrice) + 3) * 1.2).toFixed(2)
  }

  async function updateStudio(id, field, value) {
    const { error } = await supabase.from('studio').update({ [field]: value }).eq('id', id)
    if (!error) setStudioWines(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  // Move to studio
  async function searchWines(q) {
    setMoveSearch(q)
    if (q.length < 2) { setMoveResults([]); return }
    const { data } = await supabase.from('wines').select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
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
      setShowMoveModal(false)
      setSelectedWine(null)
      setMoveSearch('')
      setMoveResults([])
      setMoveQty(1)
      setMoveNotes('')
    }
    setMoveSaving(false)
  }

  // Photo import
  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoMatch(null)
    setPhotoRaw(null)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function analysePhoto() {
    if (!photoFile) return
    setPhotoAnalysing(true)
    setPhotoMatch(null)
    setPhotoRaw(null)

    try {
      // Convert to base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(photoFile)
      })

      const response = await fetch('/api/analyse-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: photoFile.type })
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      const extracted = result.data
      setPhotoRaw(extracted)
      setPhotoVintage(extracted.vintage || '')

      // Try to match against wines database
      const searchTerm = extracted.producer || extracted.wine_name
      if (searchTerm) {
        const { data: matches } = await supabase
          .from('wines')
          .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
          .ilike('description', `%${searchTerm}%`)
          .eq('vintage', extracted.vintage || '')
          .limit(5)

        if (matches && matches.length > 0) {
          setPhotoMatch(matches[0])
          setSelectedWine(matches[0])
          setPhotoPrice(matches[0].purchase_price_per_bottle ? String(matches[0].purchase_price_per_bottle) : '')
        } else {
          // Try without vintage
          const { data: matches2 } = await supabase
            .from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
            .ilike('description', `%${searchTerm}%`)
            .limit(5)
          if (matches2 && matches2.length > 0) {
            setPhotoMatch(matches2[0])
            setSelectedWine(matches2[0])
            setPhotoPrice(matches2[0].purchase_price_per_bottle ? String(matches2[0].purchase_price_per_bottle) : '')
          }
        }
      }
    } catch (err) {
      console.error('Photo analysis error:', err)
    }
    setPhotoAnalysing(false)
  }

  async function confirmPhotoMove() {
    setMoveSaving(true)
    const priceToUse = photoPrice ? parseFloat(photoPrice) : (selectedWine?.purchase_price_per_bottle || null)
    const dp = priceToUse ? ((priceToUse + 3) * 1.2).toFixed(2) : null
    const { error } = await supabase.from('studio').insert({
      wine_id: selectedWine?.id || null,
      quantity: photoQty,
      date_moved: photoDate,
      dp_price: dp,
      status: 'Available',
      notes: [photoNotes, !selectedWine ? `${photoRaw?.wine_name || ''} ${photoRaw?.producer || ''} ${photoVintage || ''}`.trim() : ''].filter(Boolean).join(' — ') || null,
      include_in_local: false
    })
    if (!error) {
      await fetchStudio()
      setShowPhotoModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoMatch(null)
      setPhotoRaw(null)
      setSelectedWine(null)
      setPhotoQty(1)
      setPhotoNotes('')
      setPhotoVintage('')
      setPhotoPrice('')
    }
    setMoveSaving(false)
  }

  const filtered = studioWines.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return [s.wines?.description, s.wines?.vintage, s.wines?.region].join(' ').toLowerCase().includes(q)
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Inventory</button>
          <button onClick={() => router.push('/studio')} style={{ background: 'rgba(107,30,46,0.6)', color: '#d4ad45', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Studio</button>
          <button onClick={() => router.push('/labels')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Labels</button>
          <button onClick={() => router.push('/buyer')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Buyer View</button>
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
            <button onClick={() => setShowPhotoModal(true)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📷 Scan Bottle</button>
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
                {['Wine', 'Vintage', 'Qty', 'Moved', 'DP Price', 'Status', 'Local Sales', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>No studio wines yet — move something from bond to get started.</td></tr>
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
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3 }}>{w?.description || '—'}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{w?.region}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{w?.vintage || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <input type="number" min="0" defaultValue={s.quantity}
                        onBlur={e => { if (parseInt(e.target.value) !== s.quantity) updateStudio(s.id, 'quantity', parseInt(e.target.value)) }}
                        style={{ width: '52px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{s.date_moved}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--ink)' }}>
                      £{s.dp_price ? parseFloat(s.dp_price).toFixed(2) : calcDP(w?.purchase_price_per_bottle) || '—'}
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Move to Studio Modal */}
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
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  IB £{parseFloat(selectedWine.purchase_price_per_bottle).toFixed(2)} → DP £{calcDP(selectedWine.purchase_price_per_bottle)} · {selectedWine.quantity} in bond
                </div>
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
              <button onClick={() => { setShowMoveModal(false); setSelectedWine(null); setMoveSearch(''); setMoveResults([]) }}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmMove} disabled={!selectedWine || moveSaving}
                style={{ background: selectedWine ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selectedWine ? 'pointer' : 'not-allowed' }}>
                {moveSaving ? 'Saving…' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Import Modal */}
      {showPhotoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '560px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, marginBottom: '20px' }}>Scan a Bottle</div>

            {/* Upload area */}
            {!photoPreview ? (
              <div onClick={() => fileInputRef.current?.click()}
                style={{ border: '2px dashed var(--border)', padding: '40px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: 'var(--white)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--wine)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em' }}>TAP TO PHOTOGRAPH OR UPLOAD A LABEL</div>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: 'none' }} />
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <img src={photoPreview} alt="Label" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', border: '1px solid var(--border)', background: 'var(--white)' }} />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoMatch(null); setPhotoRaw(null); setSelectedWine(null) }}
                  style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Remove photo</button>
              </div>
            )}

            {photoPreview && !photoRaw && (
              <button onClick={analysePhoto} disabled={photoAnalysing}
                style={{ width: '100%', background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: photoAnalysing ? 'wait' : 'pointer', marginBottom: '16px' }}>
                {photoAnalysing ? '🔍 Analysing label…' : '🔍 Read Label'}
              </button>
            )}

            {/* Extracted info */}
            {photoRaw && (
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Extracted from label</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>
                  {[photoRaw.wine_name, photoRaw.producer].filter(Boolean).join(', ')}
                  {photoRaw.vintage && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{photoRaw.vintage}</span>}
                </div>
                {photoRaw.region && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{photoRaw.region}</div>}
              </div>
            )}

            {/* Match result */}
            {photoRaw && (
              <div style={{ marginBottom: '16px' }}>
                {photoMatch ? (
                  <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2d6a4f', marginBottom: '6px' }}>✓ Match found in cellar</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>{photoMatch.description}, {photoMatch.vintage}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      IB £{parseFloat(photoMatch.purchase_price_per_bottle).toFixed(2)} → DP £{calcDP(photoMatch.purchase_price_per_bottle)} · {photoMatch.quantity} in bond
                    </div>
                    <button onClick={() => setPhotoMatch(null)} style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Not right — search manually</button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>No match found — search manually</div>
                    <input value={moveSearch} onChange={e => searchWines(e.target.value)} placeholder="Search by wine name…"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    {moveResults.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '160px', overflowY: 'auto' }}>
                        {moveResults.map(w => (
                          <div key={w.id} onClick={() => { setSelectedWine(w); setPhotoMatch(w); setPhotoPrice(w.purchase_price_per_bottle ? String(w.purchase_price_per_bottle) : ''); setMoveResults([]) }}
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

            {/* Qty, date, vintage, notes — show as soon as label is read */}
            {photoRaw && (
              <>
                {!selectedWine && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Vintage</label>
                    <input type="text" value={photoVintage} onChange={e => setPhotoVintage(e.target.value)} placeholder="e.g. 2021"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                    Purchase price IB (£/bottle)
                    {photoPrice && <span style={{ marginLeft: '8px', color: 'var(--wine)' }}>→ DP £{((parseFloat(photoPrice) + 3) * 1.2).toFixed(2)}</span>}
                  </label>
                  <input type="number" step="0.01" value={photoPrice} onChange={e => setPhotoPrice(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Quantity</label>
                    <input type="number" min="1" value={photoQty} onChange={e => setPhotoQty(parseInt(e.target.value))}
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Date moved</label>
                    <input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Notes (optional)</label>
                  <input type="text" value={photoNotes} onChange={e => setPhotoNotes(e.target.value)} placeholder="optional notes…"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPhotoModal(false); setPhotoFile(null); setPhotoPreview(null); setPhotoMatch(null); setPhotoRaw(null); setSelectedWine(null); setPhotoVintage(''); setPhotoPrice('') }}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              {photoRaw && (
                <button onClick={confirmPhotoMove} disabled={moveSaving}
                  style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {moveSaving ? 'Saving…' : 'Add to Studio'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
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

  function calcDP(purchasePrice) {
    if (!purchasePrice) return null
    return ((parseFloat(purchasePrice) + 3) * 1.2).toFixed(2)
  }

  async function updateStudio(id, field, value) {
    const { error } = await supabase.from('studio').update({ [field]: value }).eq('id', id)
    if (!error) setStudioWines(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  // Move to studio
  async function searchWines(q) {
    setMoveSearch(q)
    if (q.length < 2) { setMoveResults([]); return }
    const { data } = await supabase.from('wines').select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
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
      setShowMoveModal(false)
      setSelectedWine(null)
      setMoveSearch('')
      setMoveResults([])
      setMoveQty(1)
      setMoveNotes('')
    }
    setMoveSaving(false)
  }

  // Photo import
  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoMatch(null)
    setPhotoRaw(null)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function analysePhoto() {
    if (!photoFile) return
    setPhotoAnalysing(true)
    setPhotoMatch(null)
    setPhotoRaw(null)

    try {
      // Convert to base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(photoFile)
      })

      const response = await fetch('/api/analyse-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: photoFile.type })
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      const extracted = result.data
      setPhotoRaw(extracted)
      setPhotoVintage(extracted.vintage || '') against wines database
      const searchTerm = extracted.producer || extracted.wine_name
      if (searchTerm) {
        const { data: matches } = await supabase
          .from('wines')
          .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
          .ilike('description', `%${searchTerm}%`)
          .eq('vintage', extracted.vintage || '')
          .limit(5)

        if (matches && matches.length > 0) {
          setPhotoMatch(matches[0])
          setSelectedWine(matches[0])
          setPhotoPrice(matches[0].purchase_price_per_bottle ? String(matches[0].purchase_price_per_bottle) : '')
        } else {
          // Try without vintage
          const { data: matches2 } = await supabase
            .from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
            .ilike('description', `%${searchTerm}%`)
            .limit(5)
          if (matches2 && matches2.length > 0) {
            setPhotoMatch(matches2[0])
            setSelectedWine(matches2[0])
            setPhotoPrice(matches2[0].purchase_price_per_bottle ? String(matches2[0].purchase_price_per_bottle) : '')
          }
        }
      }
    } catch (err) {
      console.error('Photo analysis error:', err)
    }
    setPhotoAnalysing(false)
  }

  async function confirmPhotoMove() {
    setMoveSaving(true)
    const priceToUse = photoPrice ? parseFloat(photoPrice) : (selectedWine?.purchase_price_per_bottle || null)
    const dp = priceToUse ? ((priceToUse + 3) * 1.2).toFixed(2) : null
    const { error } = await supabase.from('studio').insert({
      wine_id: selectedWine?.id || null,
      quantity: photoQty,
      date_moved: photoDate,
      dp_price: dp,
      status: 'Available',
      notes: [photoNotes, !selectedWine ? `${photoRaw?.wine_name || ''} ${photoRaw?.producer || ''} ${photoVintage || ''}`.trim() : ''].filter(Boolean).join(' — ') || null,
      include_in_local: false
    })
    if (!error) {
      await fetchStudio()
      setShowPhotoModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoMatch(null)
      setPhotoRaw(null)
      setSelectedWine(null)
      setPhotoQty(1)
      setPhotoNotes('')
      setPhotoVintage('')
      setPhotoPrice('')
    }
    setMoveSaving(false)
  }

  const filtered = studioWines.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return [s.wines?.description, s.wines?.vintage, s.wines?.region].join(' ').toLowerCase().includes(q)
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Inventory</button>
          <button onClick={() => router.push('/studio')} style={{ background: 'rgba(107,30,46,0.6)', color: '#d4ad45', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Studio</button>
          <button onClick={() => router.push('/labels')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Labels</button>
          <button onClick={() => router.push('/buyer')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Buyer View</button>
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
            <button onClick={() => setShowPhotoModal(true)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📷 Scan Bottle</button>
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
                {['Wine', 'Vintage', 'Qty', 'Moved', 'DP Price', 'Status', 'Local Sales', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>No studio wines yet — move something from bond to get started.</td></tr>
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
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3 }}>{w?.description || '—'}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{w?.region}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{w?.vintage || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <input type="number" min="0" defaultValue={s.quantity}
                        onBlur={e => { if (parseInt(e.target.value) !== s.quantity) updateStudio(s.id, 'quantity', parseInt(e.target.value)) }}
                        style={{ width: '52px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{s.date_moved}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--ink)' }}>
                      £{s.dp_price ? parseFloat(s.dp_price).toFixed(2) : calcDP(w?.purchase_price_per_bottle) || '—'}
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Move to Studio Modal */}
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
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  IB £{parseFloat(selectedWine.purchase_price_per_bottle).toFixed(2)} → DP £{calcDP(selectedWine.purchase_price_per_bottle)} · {selectedWine.quantity} in bond
                </div>
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
              <button onClick={() => { setShowMoveModal(false); setSelectedWine(null); setMoveSearch(''); setMoveResults([]) }}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmMove} disabled={!selectedWine || moveSaving}
                style={{ background: selectedWine ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selectedWine ? 'pointer' : 'not-allowed' }}>
                {moveSaving ? 'Saving…' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Import Modal */}
      {showPhotoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '560px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, marginBottom: '20px' }}>Scan a Bottle</div>

            {/* Upload area */}
            {!photoPreview ? (
              <div onClick={() => fileInputRef.current?.click()}
                style={{ border: '2px dashed var(--border)', padding: '40px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: 'var(--white)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--wine)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em' }}>TAP TO PHOTOGRAPH OR UPLOAD A LABEL</div>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: 'none' }} />
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <img src={photoPreview} alt="Label" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', border: '1px solid var(--border)', background: 'var(--white)' }} />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoMatch(null); setPhotoRaw(null); setSelectedWine(null) }}
                  style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Remove photo</button>
              </div>
            )}

            {photoPreview && !photoRaw && (
              <button onClick={analysePhoto} disabled={photoAnalysing}
                style={{ width: '100%', background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: photoAnalysing ? 'wait' : 'pointer', marginBottom: '16px' }}>
                {photoAnalysing ? '🔍 Analysing label…' : '🔍 Read Label'}
              </button>
            )}

            {/* Extracted info */}
            {photoRaw && (
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Extracted from label</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>
                  {[photoRaw.wine_name, photoRaw.producer].filter(Boolean).join(', ')}
                  {photoRaw.vintage && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{photoRaw.vintage}</span>}
                </div>
                {photoRaw.region && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{photoRaw.region}</div>}
              </div>
            )}

            {/* Match result */}
            {photoRaw && (
              <div style={{ marginBottom: '16px' }}>
                {photoMatch ? (
                  <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2d6a4f', marginBottom: '6px' }}>✓ Match found in cellar</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>{photoMatch.description}, {photoMatch.vintage}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      IB £{parseFloat(photoMatch.purchase_price_per_bottle).toFixed(2)} → DP £{calcDP(photoMatch.purchase_price_per_bottle)} · {photoMatch.quantity} in bond
                    </div>
                    <button onClick={() => setPhotoMatch(null)} style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Not right — search manually</button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>No match found — search manually</div>
                    <input value={moveSearch} onChange={e => searchWines(e.target.value)} placeholder="Search by wine name…"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    {moveResults.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '160px', overflowY: 'auto' }}>
                        {moveResults.map(w => (
                          <div key={w.id} onClick={() => { setSelectedWine(w); setPhotoMatch(w); setPhotoPrice(w.purchase_price_per_bottle ? String(w.purchase_price_per_bottle) : ''); setMoveResults([]) }}
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

            {/* Qty, date, vintage, notes — show as soon as label is read */}
            {photoRaw && (
              <>
                {!selectedWine && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Vintage</label>
                    <input type="text" value={photoVintage} onChange={e => setPhotoVintage(e.target.value)} placeholder="e.g. 2021"
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                    Purchase price IB (£/bottle)
                    {photoPrice && <span style={{ marginLeft: '8px', color: 'var(--wine)' }}>→ DP £{((parseFloat(photoPrice) + 3) * 1.2).toFixed(2)}</span>}
                  </label>
                  <input type="number" step="0.01" value={photoPrice} onChange={e => setPhotoPrice(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Quantity</label>
                    <input type="number" min="1" value={photoQty} onChange={e => setPhotoQty(parseInt(e.target.value))}
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Date moved</label>
                    <input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Notes (optional)</label>
                  <input type="text" value={photoNotes} onChange={e => setPhotoNotes(e.target.value)} placeholder="optional notes…"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPhotoModal(false); setPhotoFile(null); setPhotoPreview(null); setPhotoMatch(null); setPhotoRaw(null); setSelectedWine(null); setPhotoVintage(''); setPhotoPrice('') }}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              {photoRaw && (
                <button onClick={confirmPhotoMove} disabled={moveSaving}
                  style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {moveSaving ? 'Saving…' : 'Add to Studio'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
