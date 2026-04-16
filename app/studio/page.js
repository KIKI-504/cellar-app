'use client'
export const dynamic = 'force-dynamic'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const COLOURS = ['Red', 'White', 'Rosé', 'Sparkling', 'Sweet']

const colourDot = (colour) => {
  const c = (colour || '').toLowerCase()
  if (c.includes('white')) return '#d4c88a'
  if (c.includes('ros')) return '#d4748a'
  if (c.includes('red')) return '#8b2535'
  if (c.includes('spark')) return '#a8c4d4'
  if (c.includes('sweet')) return '#c4a85a'
  return '#aaa'
}

const GC_KEYWORDS = ['grand cru']
const PREMIER_KEYWORDS = ['premier cru', '1er cru', '1er', 'premiere cru', 'premiers crus', 'premier crus']

function classifyWine(nameA, nameB) {
  const text = ((nameA || '') + ' ' + (nameB || '')).toLowerCase()
  if (GC_KEYWORDS.some(k => text.includes(k))) return 'grandcru'
  if (PREMIER_KEYWORDS.some(k => text.includes(k))) return 'premier'
  return 'village'
}

function getPriceAlert(s) {
  const dpPrice = s.dp_price
    ? parseFloat(s.dp_price)
    : s.wines?.purchase_price_per_bottle
      ? (parseFloat(s.wines.purchase_price_per_bottle) + 3) * 1.2
      : null
  if (!dpPrice) return null
  const classification = classifyWine(s.wines?.description || '', s.unlinked_description || '')
  if (classification === 'grandcru' && dpPrice < 100) return { icon: '⚠️', tooltip: 'Grand Cru under £100 DP' }
  if (classification === 'village' && dpPrice > 100) return { icon: '⚠️', tooltip: 'Village wine over £100 DP' }
  return null
}

function EditableCell({ value, onSave, type = 'text', step, min, placeholder, style, width }) {
  const [local, setLocal] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setLocal(value ?? '') }, [value, focused])
  return (
    <input
      type={type} step={step} min={min} value={local} placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocused(true); e.target.select() }}
      onBlur={e => {
        setFocused(false)
        const parsed = type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value
        if (parsed !== (value ?? '')) onSave(parsed)
      }}
      style={{ width: width || '100%', ...style }}
    />
  )
}

export default function StudioPage() {
  const router = useRouter()
  const [studioWines, setStudioWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('Available')
  const [filterColour, setFilterColour] = useState('')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('date_moved')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedNote, setExpandedNote] = useState(null)
  const [showDPTotal, setShowDPTotal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveSearch, setMoveSearch] = useState('')
  const [moveResults, setMoveResults] = useState([])
  const [selectedWine, setSelectedWine] = useState(null)
  const [moveQty, setMoveQty] = useState(1)
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0])
  const [moveNotes, setMoveNotes] = useState('')
  const [moveSaving, setMoveSaving] = useState(false)

  const [showScanModal, setShowScanModal] = useState(false)
  const [scanFile, setScanFile] = useState(null)
  const [scanPreview, setScanPreview] = useState(null)
  const [scanAnalysing, setScanAnalysing] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [scanRaw, setScanRaw] = useState(null)
  const [scanMatch, setScanMatch] = useState(null)
  const [scanWine, setScanWine] = useState(null)
  const [scanSearch, setScanSearch] = useState('')
  const [scanSearchResults, setScanSearchResults] = useState([])
  const [scanQty, setScanQty] = useState(1)
  const [scanDate, setScanDate] = useState(new Date().toISOString().split('T')[0])
  const [scanNotes, setScanNotes] = useState('')
  const [scanVintage, setScanVintage] = useState('')
  const [scanIBPrice, setScanIBPrice] = useState('')
  const [scanRetailPrice, setScanRetailPrice] = useState('')
  const [scanBottleSize, setScanBottleSize] = useState('75')
  const [scanSalePrice, setScanSalePrice] = useState('')
  const [scanColour, setScanColour] = useState('')
  const [scanSaving, setScanSaving] = useState(false)
  const fileInputRef = useRef(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [addDescription, setAddDescription] = useState('')
  const [addProducer, setAddProducer] = useState('')
  const [addVintage, setAddVintage] = useState('')
  const [addColour, setAddColour] = useState('')
  const [addRegion, setAddRegion] = useState('')
  const [addCountry, setAddCountry] = useState('')
  const [addBottleSize, setAddBottleSize] = useState('75')
  const [addQuantity, setAddQuantity] = useState(1)
  const [addIBPrice, setAddIBPrice] = useState('')
  const [addSalePrice, setAddSalePrice] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addWineId, setAddWineId] = useState('')
  const [addSaving, setAddSaving] = useState(false)

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

  // Update wine_notes on the wines table — flows to buyer view and boxes
  async function updateWineNote(wineId, value) {
    if (!wineId) return
    const { error } = await supabase.from('wines').update({ buyer_note: value || null }).eq('id', wineId)
    if (!error) setStudioWines(prev => prev.map(s =>
      s.wine_id === wineId ? { ...s, wines: { ...s.wines, buyer_note: value || null } } : s
    ))
  }

  async function deleteStudio(id) {
    if (!confirm('Remove this entry from studio inventory?')) return
    const { error } = await supabase.from('studio').delete().eq('id', id)
    if (!error) setStudioWines(prev => prev.filter(s => s.id !== id))
  }

  function cycleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function sortIcon(field) {
    if (sortField !== field) return <span style={{ opacity: 0.3, fontSize: '9px' }}>⇅</span>
    return <span style={{ fontSize: '9px', color: '#d4ad45' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

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
    if (!error) { await fetchStudio(); closeMoveModal() }
    setMoveSaving(false)
  }

  function closeMoveModal() {
    setShowMoveModal(false); setSelectedWine(null); setMoveSearch(''); setMoveResults([])
    setMoveQty(1); setMoveNotes(''); setMoveDate(new Date().toISOString().split('T')[0])
  }

  function generateWineId(vintage, producer, description, colour, bottleSize) {
    const yy = vintage ? String(vintage).slice(-2) : 'XX'
    const mm = producer ? producer.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() : 'XX'
    const ww = description ? description.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() : 'XXXX'
    const c = colour ? colour.slice(0, 1).toUpperCase() : 'X'
    const s = bottleSize === '150' ? 'M' : bottleSize === '37.5' ? 'H' : 'B'
    return `${yy} ${mm} ${ww} ${c} ${s}`
  }

  function openAddModal() {
    setShowAddModal(true); setAddDescription(''); setAddProducer(''); setAddVintage('')
    setAddColour(''); setAddRegion(''); setAddCountry(''); setAddBottleSize('75')
    setAddQuantity(1); setAddIBPrice(''); setAddSalePrice(''); setAddNotes(''); setAddWineId('')
  }

  function closeAddModal() { setShowAddModal(false) }

  function updateAddField(field, value) {
    const fields = { addDescription, addProducer, addVintage, addColour, addBottleSize, [field]: value }
    if (['addDescription', 'addProducer', 'addVintage', 'addColour', 'addBottleSize'].includes(field)) {
      const newId = generateWineId(
        field === 'addVintage' ? value : fields.addVintage,
        field === 'addProducer' ? value : fields.addProducer,
        field === 'addDescription' ? value : fields.addDescription,
        field === 'addColour' ? value : fields.addColour,
        field === 'addBottleSize' ? value : fields.addBottleSize,
      )
      setAddWineId(newId)
    }
    if (field === 'addDescription') setAddDescription(value)
    if (field === 'addProducer') setAddProducer(value)
    if (field === 'addVintage') setAddVintage(value)
    if (field === 'addColour') setAddColour(value)
    if (field === 'addRegion') setAddRegion(value)
    if (field === 'addCountry') setAddCountry(value)
    if (field === 'addBottleSize') setAddBottleSize(value)
    if (field === 'addQuantity') setAddQuantity(value)
    if (field === 'addIBPrice') setAddIBPrice(value)
    if (field === 'addSalePrice') setAddSalePrice(value)
    if (field === 'addNotes') setAddNotes(value)
  }

  async function saveNewWine() {
    if (!addDescription) return alert('Wine name is required')
    setAddSaving(true)
    try {
      const ibPrice = addIBPrice ? parseFloat(addIBPrice) : null
      const dp = ibPrice ? ((ibPrice + 3) * 1.2).toFixed(2) : null
      const { data: newWine, error: wineError } = await supabase.from('wines').insert({
        source: 'Manual', source_id: addWineId || null, description: addDescription,
        vintage: addVintage || null, colour: addColour || null, region: addRegion || null,
        country: addCountry || null,
        bottle_format: addBottleSize === '150' ? 'Magnum' : addBottleSize === '37.5' ? 'Half Bottle' : 'Bottle',
        bottle_volume: addBottleSize, quantity: String(addQuantity),
        purchase_price_per_bottle: ibPrice, include_in_buyer_view: false,
      }).select().single()
      if (wineError) throw wineError
      const { error: studioError } = await supabase.from('studio').insert({
        wine_id: newWine.id, quantity: addQuantity,
        date_moved: new Date().toISOString().split('T')[0], dp_price: dp,
        sale_price: addSalePrice ? parseFloat(addSalePrice) : null,
        status: 'Available', notes: addNotes || null,
        include_in_local: false, bottle_size: addBottleSize, colour: addColour || null,
      })
      if (studioError) throw studioError
      await fetchStudio(); closeAddModal()
    } catch (err) {
      console.error(err); alert('Save failed: ' + err.message)
    }
    setAddSaving(false)
  }

  function openScanModal() {
    setShowScanModal(true); setScanFile(null); setScanPreview(null); setScanAnalysing(false)
    setScanDone(false); setScanRaw(null); setScanMatch(null); setScanWine(null)
    setScanSearch(''); setScanSearchResults([]); setScanQty(1)
    setScanDate(new Date().toISOString().split('T')[0]); setScanNotes('')
    setScanVintage(''); setScanBottleSize('75'); setScanSalePrice('')
    setScanColour(''); setScanIBPrice(''); setScanRetailPrice('')
  }

  function handleScanFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setScanFile(file); setScanDone(false); setScanRaw(null); setScanMatch(null); setScanWine(null)
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
      setScanRaw(extracted); setScanVintage(extracted.vintage || ''); setScanDone(true)
      const searchTerm = extracted.producer || extracted.wine_name
      if (searchTerm) {
        let matches = null
        if (extracted.vintage) {
          const { data } = await supabase.from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, retail_price, quantity')
            .ilike('description', `%${searchTerm}%`).eq('vintage', extracted.vintage).limit(5)
          matches = data
        }
        if (!matches || matches.length === 0) {
          const { data } = await supabase.from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, retail_price, quantity')
            .ilike('description', `%${searchTerm}%`).limit(5)
          matches = data
        }
        if (matches && matches.length > 0) {
          setScanMatch(matches[0]); setScanWine(matches[0])
          setScanIBPrice(matches[0].purchase_price_per_bottle ? String(matches[0].purchase_price_per_bottle) : '')
          setScanRetailPrice(matches[0].retail_price ? String(matches[0].retail_price) : '')
        }
      }
    } catch (err) {
      console.error('Label analysis error:', err); alert('Label reading failed: ' + err.message)
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
    setScanWine(w); setScanMatch(w); setScanSearch(''); setScanSearchResults([])
    setScanIBPrice(w.purchase_price_per_bottle ? String(w.purchase_price_per_bottle) : '')
    setScanRetailPrice(w.retail_price ? String(w.retail_price) : '')
  }

  async function saveScanEntry() {
    setScanSaving(true)
    const ibPrice = scanIBPrice ? parseFloat(scanIBPrice) : (scanWine?.purchase_price_per_bottle || null)
    const dp = ibPrice ? ((ibPrice + 3) * 1.2).toFixed(2) : null
    const retailPrice = scanRetailPrice ? parseFloat(scanRetailPrice) : (scanWine?.retail_price || null)
    const insertData = {
      wine_id: scanWine?.id || null, quantity: scanQty, date_moved: scanDate, dp_price: dp,
      status: 'Available', notes: scanNotes || null, include_in_local: false,
      bottle_size: scanBottleSize || '75', sale_price: scanSalePrice ? parseFloat(scanSalePrice) : null,
      colour: scanWine ? (scanWine.colour || null) : (scanColour || null),
      unlinked_description: !scanWine ? [scanRaw?.wine_name, scanRaw?.producer].filter(Boolean).join(', ') : null,
      unlinked_vintage: !scanWine ? (scanVintage || scanRaw?.vintage || null) : null,
    }
    if (scanWine?.id && retailPrice && retailPrice !== scanWine?.retail_price) {
      await supabase.from('wines').update({
        retail_price: retailPrice, retail_price_source: 'Manual',
        retail_price_date: new Date().toISOString().split('T')[0]
      }).eq('id', scanWine.id)
    }
    let saved = false
    if (scanWine?.id) {
      const { data: existing } = await supabase.from('studio').select('id, quantity')
        .eq('wine_id', scanWine.id).eq('status', 'Available').maybeSingle()
      if (existing) {
        const { error } = await supabase.from('studio').update({ quantity: existing.quantity + scanQty }).eq('id', existing.id)
        if (!error) saved = true; else alert('Save failed: ' + error.message)
      }
    } else if (insertData.unlinked_description) {
      const { data: existing } = await supabase.from('studio').select('id, quantity')
        .eq('unlinked_description', insertData.unlinked_description)
        .eq('unlinked_vintage', insertData.unlinked_vintage || '').eq('status', 'Available').maybeSingle()
      if (existing) {
        const { error } = await supabase.from('studio').update({ quantity: existing.quantity + scanQty }).eq('id', existing.id)
        if (!error) saved = true; else alert('Save failed: ' + error.message)
      }
    }
    if (!saved) {
      const { error } = await supabase.from('studio').insert(insertData)
      if (!error) saved = true; else alert('Save failed: ' + error.message)
    }
    if (saved) { await fetchStudio(); setShowScanModal(false) }
    setScanSaving(false)
  }

  // ─── Filter + Sort ──────────────────────────────────────────────────────────

  const filtered = studioWines
    .filter(s => {
      if (filterStatus && s.status !== filterStatus) return false
      if (filterColour) {
        const c = (s.wines?.colour || s.colour || '').toLowerCase()
        if (!c.includes(filterColour.toLowerCase())) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return [s.wines?.description, s.wines?.vintage, s.wines?.region, s.unlinked_description].join(' ').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortField === 'quantity') { av = a.quantity || 0; bv = b.quantity || 0 }
      else if (sortField === 'name') { av = (a.wines?.description || a.unlinked_description || '').toLowerCase(); bv = (b.wines?.description || b.unlinked_description || '').toLowerCase() }
      else if (sortField === 'dp_price') { av = parseFloat(a.dp_price) || 0; bv = parseFloat(b.dp_price) || 0 }
      else if (sortField === 'sale_price') { av = parseFloat(a.sale_price) || 0; bv = parseFloat(b.sale_price) || 0 }
      else if (sortField === 'colour') { av = (a.wines?.colour || a.colour || '').toLowerCase(); bv = (b.wines?.colour || b.colour || '').toLowerCase() }
      else { av = a.date_moved || ''; bv = b.date_moved || '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const dpTotal = filtered.reduce((sum, s) => {
    const dp = s.dp_price ? parseFloat(s.dp_price) : s.wines?.purchase_price_per_bottle ? (parseFloat(s.wines.purchase_price_per_bottle) + 3) * 1.2 : 0
    return sum + dp * (s.quantity || 0)
  }, 0)

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
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['Inventory', '/admin'], ['Studio', '/studio'], ['Box Builder', '/boxes'], ['Labels', '/labels'], ['Buyer View', '/buyer'], ['Bottles On Hand', '/local'], ['Consignment', '/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/studio' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/studio' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '76px 28px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Studio Inventory</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{totalBottles} bottles available</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={openScanModal} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📷 Scan Bottle</button>
            <button onClick={() => setShowMoveModal(true)} style={{ background: 'none', border: '1px solid var(--wine)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Move to Studio</button>
            <button onClick={openAddModal} style={{ background: 'none', border: '1px solid var(--ink)', color: 'var(--ink)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>✎ Add Wine</button>
            <button onClick={() => router.push('/boxes')} style={{ background: 'none', border: '1px solid #2d6a4f', color: '#2d6a4f', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📦 Box Builder</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
          {[['available', availableCount], ['on local sales', localCount], ['total bottles', totalBottles]].map(([label, n]) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 500, color: 'var(--wine)', fontSize: '14px' }}>{n}</span>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
          <button onClick={() => setShowDPTotal(v => !v)} style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontFamily: 'DM Mono, monospace' }}>
            {showDPTotal ? `DP value: £${dpTotal.toLocaleString('en-GB', { maximumFractionDigits: 0 })} ▲` : '▼ show DP value'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search studio…"
            style={{ flex: 1, minWidth: '160px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Consumed">Consumed</option>
            <option value="Gifted">Gifted</option>
            <option value="Sold">Sold</option>
          </select>
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Colours</option>
            {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                <th onClick={() => cycleSort('name')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', minWidth: '180px' }}>Wine {sortIcon('name')}</th>
                <th onClick={() => cycleSort('colour')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>Colour {sortIcon('colour')}</th>
                <th onClick={() => cycleSort('quantity')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>Qty {sortIcon('quantity')}</th>
                <th onClick={() => cycleSort('dp_price')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>DP {sortIcon('dp_price')}</th>
                <th onClick={() => cycleSort('sale_price')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>Sale Price {sortIcon('sale_price')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Notes</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Local</th>
                <th style={{ padding: '10px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const w = s.wines
                const desc = w?.description || s.unlinked_description || '—'
                const vintage = w?.vintage || s.unlinked_vintage || ''
                const colour = w?.colour || s.colour || ''
                const region = w?.region || ''
                const isExpanded = expandedNote === s.id
                const alert = getPriceAlert(s)
                const dp = s.dp_price ? parseFloat(s.dp_price) : w?.purchase_price_per_bottle ? (parseFloat(w.purchase_price_per_bottle) + 3) * 1.2 : null
                const isEditing = editingRow === s.id

                return (
                  <React.Fragment key={s.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #ede6d6', background: 'transparent' }}>
                      <td style={{ padding: '10px 12px', minWidth: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colourDot(colour), flexShrink: 0 }}></span>
                          <div>
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3 }}>{desc}</div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                              {vintage}{region ? ` · ${region}` : ''}
                              {s.bottle_size === '150' ? ' · Magnum' : s.bottle_size === '37.5' ? ' · Half' : ''}
                            </div>
                            {w?.buyer_note && <div style={{ fontSize: '10px', color: 'rgba(212,173,69,0.8)', marginTop: '2px', fontStyle: 'italic' }}>✎ note</div>}
                            {w?.women_note && <div style={{ fontSize: '10px', color: '#9b3a4a', marginTop: '1px' }}>♀</div>}
                          </div>
                          {alert && <span title={alert.tooltip} style={{ fontSize: '13px', cursor: 'help' }}>{alert.icon}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--muted)' }}>{colour}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <EditableCell
                          value={s.quantity} type="number" min="0"
                          onSave={v => updateStudio(s.id, 'quantity', v)}
                          style={{ width: '50px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, textAlign: 'center', outline: 'none' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600 }}>
                        {dp ? `£${dp.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <EditableCell
                          value={s.sale_price} type="number" step="0.01" placeholder="—"
                          onSave={v => updateStudio(s.id, 'sale_price', v)}
                          style={{ width: '70px', border: '1px solid var(--border)', background: s.sale_price ? 'rgba(107,30,46,0.05)' : 'var(--white)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: s.sale_price ? 600 : 400, outline: 'none', color: 'var(--wine)' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <select value={s.status} onChange={e => updateStudio(s.id, 'status', e.target.value)}
                          style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', outline: 'none', color: statusColour(s.status) }}>
                          {['Available', 'Consumed', 'Gifted', 'Sold'].map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => setExpandedNote(isExpanded ? null : s.id)}
                          style={{ background: isExpanded ? 'var(--ink)' : (s.notes || w?.buyer_note || w?.women_note) ? 'rgba(212,173,69,0.12)' : 'none', border: '1px solid var(--border)', padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: isExpanded ? 'var(--white)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {isExpanded ? '▲ close' : '▼ notes'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input type="checkbox" checked={!!s.include_in_local} onChange={e => updateStudio(s.id, 'include_in_local', e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--wine)' }} />
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <button onClick={() => deleteStudio(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', padding: '2px 6px' }}>✕</button>
                      </td>
                    </tr>

                    {/* Expanded notes */}
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid #ede6d6' }}>
                        <td colSpan={9} style={{ padding: '16px 20px', background: 'rgba(250,247,242,0.8)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>

                            {/* Wine Notes — writes to wines.buyer_note, flows to buyer view + boxes */}
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>
                                Wine Notes <span style={{ color: 'rgba(212,173,69,0.8)', fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>shown to buyers</span>
                              </label>
                              <textarea
                                key={`wn-${s.id}`}
                                defaultValue={w?.buyer_note || ''}
                                onBlur={e => { const v = e.target.value.trim() || null; if (v !== (w?.buyer_note || null)) updateWineNote(s.wine_id, v) }}
                                placeholder="Editorial note — producer story, interest, context…"
                                rows={3}
                                style={{ width: '100%', border: '1px solid rgba(212,173,69,0.4)', background: 'rgba(212,173,69,0.04)', padding: '8px 10px', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: 'var(--ink)' }}
                              />
                            </div>

                            {/* Studio delivery note */}
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Delivery Note <span style={{ color: 'var(--muted)', fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>studio only</span></label>
                              <textarea
                                key={`dn-${s.id}`}
                                defaultValue={s.notes || ''}
                                onBlur={e => { const v = e.target.value.trim() || null; if (v !== (s.notes || null)) updateStudio(s.id, 'notes', v) }}
                                placeholder="Condition, storage note…"
                                rows={3}
                                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                              />
                            </div>

                          </div>
                          {s.date_moved && (
                            <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '12px' }}>Moved to studio: {s.date_moved}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Move to Studio modal */}
      {showMoveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '480px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Move to Studio</div>
              <button onClick={closeMoveModal} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Search inventory</label>
              <input value={moveSearch} onChange={e => searchWines(e.target.value)} placeholder="Start typing a wine name…"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              {moveResults.length > 0 && !selectedWine && (
                <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '200px', overflowY: 'auto' }}>
                  {moveResults.map(w => (
                    <div key={w.id} onClick={() => { setSelectedWine(w); setMoveSearch(w.description) }}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>
                        {w.vintage} · {w.colour} · {w.quantity} in bond
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedWine && (
              <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', marginBottom: '4px' }}>✓ SELECTED</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{selectedWine.description}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'DM Mono, monospace' }}>
                  {selectedWine.vintage} · {selectedWine.colour} · DP £{selectedWine.purchase_price_per_bottle ? ((parseFloat(selectedWine.purchase_price_per_bottle) + 3) * 1.2).toFixed(2) : '—'}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Quantity</label>
                <input type="number" min="1" value={moveQty} onChange={e => setMoveQty(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Date moved</label>
                <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Delivery note (optional)</label>
              <input value={moveNotes} onChange={e => setMoveNotes(e.target.value)} placeholder="Condition, storage note…"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeMoveModal} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmMove} disabled={!selectedWine || moveSaving}
                style={{ background: selectedWine ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selectedWine ? 'pointer' : 'not-allowed' }}>
                {moveSaving ? 'Moving…' : `Move ${moveQty} bottle${moveQty !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Wine modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '560px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Add Wine to Studio</div>
              <button onClick={closeAddModal} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Wine Name *</label>
                <input value={addDescription} onChange={e => updateAddField('addDescription', e.target.value)} placeholder="e.g. Chambolle-Musigny, Domaine Mugnier"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Producer</label>
                <input value={addProducer} onChange={e => updateAddField('addProducer', e.target.value)} placeholder="e.g. Mugnier"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Vintage</label>
                <input value={addVintage} onChange={e => updateAddField('addVintage', e.target.value)} placeholder="e.g. 2019"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Colour</label>
                <select value={addColour} onChange={e => updateAddField('addColour', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">—</option>
                  {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Region</label>
                <input value={addRegion} onChange={e => updateAddField('addRegion', e.target.value)} placeholder="e.g. Burgundy"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Bottle Size</label>
                <select value={addBottleSize} onChange={e => updateAddField('addBottleSize', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="37.5">37.5cl Half</option>
                  <option value="75">75cl Bottle</option>
                  <option value="150">150cl Magnum</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Quantity</label>
                <input type="number" min="1" value={addQuantity} onChange={e => updateAddField('addQuantity', parseInt(e.target.value) || 1)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>IB Price / btl (£)</label>
                <input type="number" step="0.01" value={addIBPrice} onChange={e => updateAddField('addIBPrice', e.target.value)} placeholder="0.00"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Sale Price / btl (£)</label>
                <input type="number" step="0.01" value={addSalePrice} onChange={e => updateAddField('addSalePrice', e.target.value)} placeholder="0.00"
                  style={{ width: '100%', border: '2px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
              </div>
            </div>
            {addWineId && (
              <div style={{ marginBottom: '12px', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                Wine ID: <strong>{addWineId}</strong>
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Notes</label>
              <input value={addNotes} onChange={e => updateAddField('addNotes', e.target.value)} placeholder="optional…"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeAddModal} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveNewWine} disabled={!addDescription || addSaving}
                style={{ background: addDescription ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: addDescription ? 'pointer' : 'not-allowed' }}>
                {addSaving ? 'Saving…' : 'Add to Studio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan modal */}
      {showScanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Scan Bottle Label</div>
              <button onClick={() => setShowScanModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            {/* File select */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', fontFamily: 'DM Mono, monospace' }}>Upload label photo</label>
              <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleScanFileSelect} style={{ display: 'none' }} />
                <span style={{ display: 'inline-block', background: 'var(--wine)', color: 'var(--white)', padding: '9px 18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📷 Choose / Take Photo</span>
              </label>
              {scanPreview && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <img src={scanPreview} alt="Label preview" style={{ maxWidth: '120px', maxHeight: '160px', objectFit: 'contain', border: '1px solid var(--border)' }} />
                  <div>
                    <button onClick={analyseLabel} disabled={scanAnalysing}
                      style={{ background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: scanAnalysing ? 'not-allowed' : 'pointer' }}>
                      {scanAnalysing ? '⏳ Analysing…' : '✦ Read Label'}
                    </button>
                    {scanDone && scanRaw && (
                      <div style={{ marginTop: '10px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
                        {scanRaw.producer && <div>Producer: {scanRaw.producer}</div>}
                        {scanRaw.wine_name && <div>Wine: {scanRaw.wine_name}</div>}
                        {scanRaw.vintage && <div>Vintage: {scanRaw.vintage}</div>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Match / search */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Link to inventory</label>
              {scanWine ? (
                <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', marginBottom: '4px' }}>{scanMatch?.id === scanWine?.id && scanMatch ? '✓ AUTO-MATCHED' : '✓ SELECTED'}</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{scanWine.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'DM Mono, monospace' }}>{scanWine.vintage} · {scanWine.colour}</div>
                  <button onClick={() => { setScanWine(null); setScanMatch(null) }} style={{ marginTop: '6px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Change</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input value={scanSearch} onChange={e => scanSearchWines(e.target.value)} placeholder="Search inventory by name…"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  {scanSearchResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '160px', overflowY: 'auto', position: 'absolute', left: 0, right: 0, zIndex: 10 }}>
                      {scanSearchResults.map(w => (
                        <div key={w.id} onClick={() => selectScanWine(w)}
                          style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>{w.vintage} · {w.colour}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Qty, date, size, price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Qty</label>
                <input type="number" min="1" value={scanQty} onChange={e => setScanQty(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Size</label>
                <select value={scanBottleSize} onChange={e => setScanBottleSize(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="37.5">Half</option>
                  <option value="75">75cl</option>
                  <option value="150">Magnum</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Date moved</label>
                <input type="date" value={scanDate} onChange={e => setScanDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>IB Price / btl (£)</label>
                <input type="number" step="0.01" value={scanIBPrice} onChange={e => setScanIBPrice(e.target.value)} placeholder="auto from inventory"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Sale Price / btl (£)</label>
                <input type="number" step="0.01" value={scanSalePrice} onChange={e => setScanSalePrice(e.target.value)} placeholder="optional"
                  style={{ width: '100%', border: '2px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowScanModal(false)} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveScanEntry} disabled={scanSaving}
                style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: scanSaving ? 'not-allowed' : 'pointer' }}>
                {scanSaving ? 'Saving…' : `Add ${scanQty} bottle${scanQty !== 1 ? 's' : ''} to Studio`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
