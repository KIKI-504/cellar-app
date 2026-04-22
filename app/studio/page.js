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

function isMagnum(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  return s === '150' || s === '150cl' || s === '1500' || s === '1500ml' || s.includes('magnum')
}

function dutyForSize(size) {
  return isMagnum(size) ? 6 : 3
}

function formatBottleSize(size) {
  const s = String(size || '').toLowerCase().replace(/\s/g, '')
  if (s === '150' || s === '150cl' || s === '1500' || s.includes('magnum')) return '150cl'
  if (s === '37.5' || s === '37.5cl' || s === '375' || s.includes('half')) return '37.5cl'
  if (s === '300' || s === '300cl' || s === '3000' || s.includes('double')) return '300cl'
  return '75cl'
}

function EditableCell({ value, onSave, type = 'text', step, min, placeholder, style, width }) {
  const [local, setLocal] = useState(value ?? '')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setLocal(value ?? '')
  }, [value, focused])

  return (
    <input
      type={type}
      step={step}
      min={min}
      value={local}
      placeholder={placeholder}
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

// ─── Label print function ────────────────────────────────────────────────────
function printLabel(s) {
  const name = s.wines?.description || s.unlinked_description || ''
  const vintage = s.wines?.vintage || s.unlinked_vintage || ''
  const parts = name.split(',')
  const wineName = parts.length > 1 ? parts.slice(0, -1).join(',').trim() : name
  const producer = parts.length > 1 ? parts[parts.length - 1].trim() : ''

  const dp = s.dp_price
    ? parseFloat(s.dp_price).toFixed(2)
    : s.wines?.purchase_price_per_bottle
      ? ((parseFloat(s.wines.purchase_price_per_bottle) + dutyForSize(s.bottle_size)) * 1.2).toFixed(2)
      : null
  const salePrice = s.sale_price ? parseFloat(s.sale_price).toFixed(2) : null

  const ws = s.wines?.ws_lowest_per_bottle ? parseFloat(s.wines.ws_lowest_per_bottle) : null
  const wsDate = s.wines?.ws_price_date || null
  const wsDP = ws ? ((ws + dutyForSize(s.bottle_size)) * 1.2).toFixed(2) : null
  const wsLine = wsDP
    ? `WS Avg DP: £${wsDP}${wsDate ? '  ·  ' + wsDate : ''}`
    : 'WS Avg DP:'

  const block = `
    <div class="label-copy">
      <div class="line vintage">${vintage}</div>
      <div class="line wine">${wineName}</div>
      ${producer ? `<div class="line producer">${producer}</div>` : ''}
      <div class="line price">DP  £${dp || '—'}</div>
      <div class="line price">Sale Price  £${salePrice || '—'}</div>
      <div class="line ws">${wsLine}</div>
    </div>
  `

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 4in 6in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 4in; height: 6in; font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; padding-top: 0.25in; box-sizing: border-box; }
  .label-copy {
    width: 4in;
    height: 3in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.2in 0.25in;
    border-bottom: 1px dashed #ccc;
  }
  .label-copy:last-child { border-bottom: none; }
  .line { text-align: center; line-height: 1.2; width: 100%; }
  .vintage { font-size: 28pt; font-weight: 900; letter-spacing: 0.05em; margin-bottom: 4pt; }
  .wine { font-size: 22pt; font-weight: 700; margin-bottom: 2pt; }
  .producer { font-size: 18pt; font-weight: 700; margin-bottom: 6pt; }
  .price { font-size: 16pt; font-weight: 400; margin-bottom: 2pt; }
  .ws { font-size: 12pt; font-weight: 300; margin-top: 4pt; color: #555; }
</style>
</head>
<body>
  ${block}
  ${block}
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export default function StudioPage() {
  const router = useRouter()
  const [studioWines, setStudioWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('Available')
  const [filterColour, setFilterColour] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('date_moved')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedNote, setExpandedNote] = useState(null)
  const [showDPTotal, setShowDPTotal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  // Move modal (kept for internal use, button removed from UI)
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

  // Add Wine manually modal
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
  const [addWsPrice, setAddWsPrice] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addWineId, setAddWineId] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Save flash
  const [saveFlash, setSaveFlash] = useState(null)

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

  function calcDP(ibPrice, bottleSize) {
    if (!ibPrice) return null
    const duty = dutyForSize(bottleSize || '75')
    return ((parseFloat(ibPrice) + duty) * 1.2).toFixed(2)
  }

  async function updateStudio(id, field, value) {
    const { error } = await supabase.from('studio').update({ [field]: value }).eq('id', id)
    if (!error) setStudioWines(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  // Updates a field on the wines table (e.g. description) and refreshes local state
  async function updateWine(studioId, wineId, field, value) {
    const { error } = await supabase.from('wines').update({ [field]: value }).eq('id', wineId)
    if (!error) {
      setStudioWines(prev => prev.map(s =>
        s.id === studioId ? { ...s, wines: { ...s.wines, [field]: value } } : s
      ))
      flashSave()
    }
  }

  async function updateWineNote(wineId, value) {
    if (!wineId) return
    const { error } = await supabase.from('wines').update({ buyer_note: value }).eq('id', wineId)
    if (!error) {
      setStudioWines(prev => prev.map(s => s.wine_id === wineId ? { ...s, wines: { ...s.wines, buyer_note: value } } : s))
      flashSave()
    }
  }

  async function updateWsPrice(wineId, studioId, wsValue) {
    if (!wineId) return
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('wines').update({
      ws_lowest_per_bottle: wsValue,
      ws_price_date: today
    }).eq('id', wineId)
    if (!error) {
      setStudioWines(prev => prev.map(s =>
        s.wine_id === wineId ? { ...s, wines: { ...s.wines, ws_lowest_per_bottle: wsValue, ws_price_date: today } } : s
      ))
      flashSave()
    }
  }

  function flashSave() {
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1500)
  }

  async function deleteStudio(id) {
    if (!confirm('Remove this entry from studio inventory?')) return
    const { error } = await supabase.from('studio').delete().eq('id', id)
    if (!error) setStudioWines(prev => prev.filter(s => s.id !== id))
  }

  function cycleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
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

  function generateWineId(vintage, producer, description, colour, bottleSize) {
    const yy = vintage ? String(vintage).slice(-2) : 'XX'
    const mm = producer ? producer.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() : 'XX'
    const ww = description ? description.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() : 'XXXX'
    const c = colour ? colour.slice(0, 1).toUpperCase() : 'X'
    const s = bottleSize === '150' ? 'M' : bottleSize === '37.5' ? 'H' : 'B'
    return `${yy} ${mm} ${ww} ${c} ${s}`
  }

  function openAddModal() {
    setShowAddModal(true)
    setAddDescription(''); setAddProducer(''); setAddVintage(''); setAddColour('')
    setAddRegion(''); setAddCountry(''); setAddBottleSize('75'); setAddQuantity(1)
    setAddIBPrice(''); setAddSalePrice(''); setAddWsPrice(''); setAddNotes(''); setAddWineId('')
  }

  function closeAddModal() { setShowAddModal(false) }

  function updateAddField(field, value) {
    const fields = { addDescription, addProducer, addVintage, addColour, addBottleSize, [field]: value }
    if (['addDescription', 'addProducer', 'addVintage', 'addColour', 'addBottleSize'].includes(field)) {
      setAddWineId(generateWineId(
        field === 'addVintage' ? value : fields.addVintage,
        field === 'addProducer' ? value : fields.addProducer,
        field === 'addDescription' ? value : fields.addDescription,
        field === 'addColour' ? value : fields.addColour,
        field === 'addBottleSize' ? value : fields.addBottleSize,
      ))
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
    if (field === 'addWsPrice') setAddWsPrice(value)
    if (field === 'addNotes') setAddNotes(value)
  }

  async function saveNewWine() {
    if (!addDescription) return alert('Wine name is required')
    setAddSaving(true)
    try {
      const ibPrice = addIBPrice ? parseFloat(addIBPrice) : null
      const duty = dutyForSize(addBottleSize)
      const dp = ibPrice ? ((ibPrice + duty) * 1.2).toFixed(2) : null
      const wsPrice = addWsPrice ? parseFloat(addWsPrice) : null
      const today = new Date().toISOString().split('T')[0]

      const { data: newWine, error: wineError } = await supabase
        .from('wines')
        .insert({
          source: 'Manual',
          source_id: addWineId || null,
          description: addDescription,
          vintage: addVintage || null,
          colour: addColour || null,
          region: addRegion || null,
          country: addCountry || null,
          bottle_format: addBottleSize === '150' ? 'Magnum' : addBottleSize === '37.5' ? 'Half Bottle' : 'Bottle',
          bottle_volume: addBottleSize,
          quantity: String(addQuantity),
          purchase_price_per_bottle: ibPrice,
          include_in_buyer_view: false,
          ws_lowest_per_bottle: wsPrice,
          ws_price_date: wsPrice ? today : null,
        })
        .select().single()

      if (wineError) throw wineError

      const { error: studioError } = await supabase.from('studio').insert({
        wine_id: newWine.id,
        quantity: addQuantity,
        date_moved: today,
        dp_price: dp,
        sale_price: addSalePrice ? parseFloat(addSalePrice) : null,
        status: 'Available',
        notes: addNotes || null,
        include_in_local: false,
        bottle_size: addBottleSize,
        colour: addColour || null,
      })

      if (studioError) throw studioError

      await fetchStudio()
      closeAddModal()
    } catch (err) {
      console.error(err)
      alert('Save failed: ' + err.message)
    }
    setAddSaving(false)
  }

  function openScanModal() {
    setShowScanModal(true)
    setScanFile(null); setScanPreview(null); setScanAnalysing(false); setScanDone(false)
    setScanRaw(null); setScanMatch(null); setScanWine(null); setScanSearch(''); setScanSearchResults([])
    setScanQty(1); setScanDate(new Date().toISOString().split('T')[0]); setScanNotes('')
    setScanVintage(''); setScanBottleSize('75'); setScanSalePrice(''); setScanColour('')
    setScanIBPrice(''); setScanRetailPrice('')
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
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
            .ilike('description', `%${searchTerm}%`).eq('vintage', extracted.vintage).limit(5)
          matches = data
        }
        if (!matches || matches.length === 0) {
          const { data } = await supabase.from('wines')
            .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
            .ilike('description', `%${searchTerm}%`).limit(5)
          matches = data
        }
        if (matches && matches.length > 0) {
          setScanMatch(matches[0]); setScanWine(matches[0])
          setScanIBPrice(matches[0].purchase_price_per_bottle ? String(matches[0].purchase_price_per_bottle) : '')
        }
      }
    } catch (err) {
      alert('Label reading failed: ' + err.message)
    }
    setScanAnalysing(false)
  }

  async function scanSearchWines(q) {
    setScanSearch(q)
    if (q.length < 2) { setScanSearchResults([]); return }
    const { data } = await supabase.from('wines')
      .select('id, description, vintage, colour, region, purchase_price_per_bottle, quantity')
      .ilike('description', `%${q}%`).order('description').limit(8)
    setScanSearchResults(data || [])
  }

  function selectScanWine(w) {
    setScanWine(w); setScanMatch(w); setScanSearch(''); setScanSearchResults([])
    setScanIBPrice(w.purchase_price_per_bottle ? String(w.purchase_price_per_bottle) : '')
  }

  async function saveScanEntry() {
    setScanSaving(true)
    const ibPrice = scanIBPrice ? parseFloat(scanIBPrice) : (scanWine?.purchase_price_per_bottle || null)
    const dp = calcDP(ibPrice, scanBottleSize)

    const insertData = {
      wine_id: scanWine?.id || null,
      quantity: scanQty,
      date_moved: scanDate,
      dp_price: dp,
      status: 'Available',
      notes: scanNotes || null,
      include_in_local: false,
      bottle_size: scanBottleSize || '75',
      sale_price: scanSalePrice ? parseFloat(scanSalePrice) : null,
      colour: scanWine ? (scanWine.colour || null) : (scanColour || null),
      unlinked_description: !scanWine ? [scanRaw?.wine_name, scanRaw?.producer].filter(Boolean).join(', ') : null,
      unlinked_vintage: !scanWine ? (scanVintage || scanRaw?.vintage || null) : null,
    }

    let saved = false
    if (scanWine?.id) {
      const { data: existing } = await supabase.from('studio').select('id, quantity')
        .eq('wine_id', scanWine.id).eq('status', 'Available').maybeSingle()
      if (existing) {
        const { error } = await supabase.from('studio').update({ quantity: existing.quantity + scanQty }).eq('id', existing.id)
        if (!error) saved = true
        else alert('Save failed: ' + error.message)
      }
    } else if (insertData.unlinked_description) {
      const { data: existing } = await supabase.from('studio').select('id, quantity')
        .eq('unlinked_description', insertData.unlinked_description)
        .eq('unlinked_vintage', insertData.unlinked_vintage || '')
        .eq('status', 'Available').maybeSingle()
      if (existing) {
        const { error } = await supabase.from('studio').update({ quantity: existing.quantity + scanQty }).eq('id', existing.id)
        if (!error) saved = true
        else alert('Save failed: ' + error.message)
      }
    }

    if (!saved) {
      const { error } = await supabase.from('studio').insert(insertData)
      if (!error) saved = true
      else alert('Save failed: ' + error.message)
    }

    if (saved) { await fetchStudio(); setShowScanModal(false) }
    setScanSaving(false)
  }

  // ─── Filter + Sort ───────────────────────────────────────────────────────────
  const filtered = studioWines
    .filter(s => {
      if (filterStatus && s.status !== filterStatus) return false
      if (filterColour) {
        const c = (s.wines?.colour || s.colour || '').toLowerCase()
        if (!c.includes(filterColour.toLowerCase())) return false
      }
      if (filterDateFrom && s.date_moved < filterDateFrom) return false
      if (filterDateTo && s.date_moved > filterDateTo) return false
      if (search) {
        const q = search.toLowerCase()
        return [s.wines?.description, s.wines?.vintage, s.wines?.region, s.unlinked_description]
          .join(' ').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortField === 'quantity') { av = a.quantity || 0; bv = b.quantity || 0 }
      else if (sortField === 'name') {
        av = (a.wines?.description || a.unlinked_description || '').toLowerCase()
        bv = (b.wines?.description || b.unlinked_description || '').toLowerCase()
      } else if (sortField === 'dp_price') { av = parseFloat(a.dp_price) || 0; bv = parseFloat(b.dp_price) || 0 }
      else if (sortField === 'sale_price') { av = parseFloat(a.sale_price) || 0; bv = parseFloat(b.sale_price) || 0 }
      else if (sortField === 'colour') {
        av = (a.wines?.colour || a.colour || '').toLowerCase()
        bv = (b.wines?.colour || b.colour || '').toLowerCase()
      } else { av = a.date_moved || ''; bv = b.date_moved || '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const dpTotal = filtered.reduce((sum, s) => {
    const dp = s.dp_price ? parseFloat(s.dp_price)
      : s.wines?.purchase_price_per_bottle ? (parseFloat(s.wines.purchase_price_per_bottle) + 3) * 1.2 : 0
    return sum + dp * (s.quantity || 0)
  }, 0)

  const availableCount = studioWines.filter(s => s.status === 'Available').length
  const localCount = studioWines.filter(s => s.include_in_local && s.status === 'Available').length
  const totalBottles = studioWines.filter(s => s.status === 'Available').reduce((sum, s) => sum + (s.quantity || 0), 0)

  const inputStyle = {
    border: '1px solid var(--border)', background: 'var(--white)', padding: '7px 10px',
    fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', width: '100%'
  }
  const labelStyle = {
    fontSize: '9px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading studio…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>

      {/* Save flash */}
      {saveFlash && (
        <div style={{ position: 'fixed', top: '60px', right: '20px', background: '#2d6a4f', color: '#fff', padding: '8px 16px', fontSize: '11px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', zIndex: 999, borderRadius: '2px' }}>
          Saved ✓
        </div>
      )}

      {/* Nav — Studio first, Inventory renamed to Bonded Storage */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100, boxSizing: 'border-box' }}>
        <button onClick={() => router.push('/studio')} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>Cellar</button>
        <div style={{ overflowX: 'auto', display: 'flex', gap: '2px', msOverflowStyle: 'none', scrollbarWidth: 'none', padding: '0 8px' }}>
          {[['Studio', '/studio'], ['Bonded Storage', '/admin'], ['Box Builder', '/boxes'], ['Buyer View', '/buyer'], ['Bottles On Hand', '/local'], ['Consignment', '/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/studio' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/studio' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px', borderRadius: '2px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px', flexShrink: 0 }}>Sign Out</button>
      </div>

      <div style={{ padding: '76px 28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Studio Inventory</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{totalBottles} bottles available</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={openScanModal} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📷 Scan Bottle</button>
            <button onClick={openAddModal} style={{ background: 'none', border: '1px solid var(--ink)', color: 'var(--ink)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>✎ Add Wine</button>
            <button onClick={() => router.push('/boxes')} style={{ background: 'none', border: '1px solid #2d6a4f', color: '#2d6a4f', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📦 Box Builder</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '11px', flexWrap: 'wrap', alignItems: 'baseline' }}>
          {[['available', availableCount], ['on local sales', localCount], ['total bottles', totalBottles]].map(([label, n]) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 500, color: 'var(--wine)', fontSize: '14px' }}>{n}</span>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
          <button onClick={() => setShowDPTotal(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.05em' }}>
            {showDPTotal ? `▲ DP value: £${dpTotal.toFixed(2)}` : '▼ show DP value'}
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search studio…"
            style={{ flex: 1, minWidth: '160px', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All Status</option>
            <option value="Available">Available</option>
            <option value="Sold">Sold</option>
            <option value="Consumed">Consumed</option>
          </select>
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }}>
            <option value="">All Colours</option>
            {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Date Added filter row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Date Added:</span>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>to</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
          {(filterDateFrom || filterDateTo) && (
            <button onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
              style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--wine)', cursor: 'pointer' }}>✕ clear</button>
          )}
          <button onClick={() => cycleSort('date_moved')}
            style={{ background: sortField === 'date_moved' ? 'var(--wine)' : 'none', color: sortField === 'date_moved' ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.08em' }}>
            Sort by Date {sortField === 'date_moved' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontWeight: 400 }} onClick={() => cycleSort('name')}>Wine {sortIcon('name')}</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer', fontWeight: 400 }} onClick={() => cycleSort('colour')}>Colour {sortIcon('colour')}</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', cursor: 'pointer', fontWeight: 400 }} onClick={() => cycleSort('quantity')}>Qty {sortIcon('quantity')}</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer', fontWeight: 400 }} onClick={() => cycleSort('dp_price')}>DP {sortIcon('dp_price')}</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer', fontWeight: 400 }} onClick={() => cycleSort('sale_price')}>Sale Price {sortIcon('sale_price')}</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 400 }}>Status</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 400 }}>Notes</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 400 }}>Local</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 400 }}>Label</th>
                <th style={{ padding: '10px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const name = s.wines?.description || s.unlinked_description || '—'
                const vintage = s.wines?.vintage || s.unlinked_vintage || ''
                const region = s.wines?.region || ''
                const colour = s.wines?.colour || s.colour || ''
                const dot = colourDot(colour)
                const alert = getPriceAlert(s)
                const isExpanded = expandedNote === s.id
                const isEditing = editingRow === s.id
                const dpVal = s.dp_price ? parseFloat(s.dp_price).toFixed(2)
                  : s.wines?.purchase_price_per_bottle
                    ? ((parseFloat(s.wines.purchase_price_per_bottle) + dutyForSize(s.bottle_size)) * 1.2).toFixed(2)
                    : null
                const ws = s.wines?.ws_lowest_per_bottle ? parseFloat(s.wines.ws_lowest_per_bottle) : null
                const wsDate = s.wines?.ws_price_date || null
                const wsDP = ws ? ((ws + dutyForSize(s.bottle_size)) * 1.2).toFixed(2) : null
                const buyerNote = s.wines?.buyer_note || ''
                const studioNote = s.notes || ''

                return (
                  <React.Fragment key={s.id}>
                    <tr style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>

                      {/* Wine name — editable when in edit mode */}
                      <td style={{ padding: '10px 12px', maxWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot, flexShrink: 0, marginTop: '4px', display: 'inline-block' }}></span>
                          <div>
                            {isEditing ? (
                              s.wines ? (
                                // Linked wine: save to wines.description (updates everywhere)
                                <EditableCell
                                  value={s.wines.description || ''}
                                  onSave={v => updateWine(s.id, s.wines.id, 'description', v)}
                                  placeholder="Wine name…"
                                  width="200px"
                                  style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 6px', outline: 'none' }}
                                />
                              ) : (
                                // Unlinked wine: save to studio.unlinked_description
                                <EditableCell
                                  value={s.unlinked_description || ''}
                                  onSave={v => updateStudio(s.id, 'unlinked_description', v)}
                                  placeholder="Wine name…"
                                  width="200px"
                                  style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 6px', outline: 'none' }}
                                />
                              )
                            ) : (
                              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.3 }}>
                                {name}
                                {alert && <span title={alert.tooltip} style={{ marginLeft: '4px', fontSize: '11px' }}>{alert.icon}</span>}
                                {buyerNote && <span style={{ marginLeft: '4px', fontSize: '10px', color: 'var(--muted)' }}>✎</span>}
                              </div>
                            )}
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                              {vintage}{region ? ` · ${region}` : ''}{s.date_moved ? ` · ${s.date_moved}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Colour */}
                      <td style={{ padding: '10px 8px', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{colour}</td>

                      {/* Qty */}
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <EditableCell value={s.quantity} type="number" min="0" step="1" width="52px"
                          style={{ textAlign: 'center', border: '1px solid var(--border)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', background: 'var(--cream)' }}
                          onSave={v => updateStudio(s.id, 'quantity', v)} />
                      </td>

                      {/* DP */}
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {dpVal ? `£${dpVal}` : '—'}
                      </td>

                      {/* Sale Price */}
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <EditableCell value={s.sale_price} type="number" min="0" step="1" placeholder="—" width="64px"
                          style={{ textAlign: 'right', border: '1px solid var(--border)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '12px', background: 'var(--cream)' }}
                          onSave={v => updateStudio(s.id, 'sale_price', v)} />
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 8px' }}>
                        <select value={s.status || 'Available'}
                          onChange={e => updateStudio(s.id, 'status', e.target.value)}
                          style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: s.status === 'Available' ? '#2d6a4f' : s.status === 'Consumed' ? '#7a5e10' : '#c0392b', outline: 'none', cursor: 'pointer' }}>
                          <option value="Available">Available</option>
                          <option value="Sold">Sold</option>
                          <option value="Consumed">Consumed</option>
                        </select>
                      </td>

                      {/* Notes toggle */}
                      <td style={{ padding: '10px 8px' }}>
                        <button onClick={() => setExpandedNote(isExpanded ? null : s.id)}
                          style={{ background: isExpanded ? 'var(--ink)' : 'none', color: isExpanded ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', padding: '4px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          {isExpanded ? '▲ hide' : '▼ notes'}
                        </button>
                      </td>

                      {/* Local checkbox */}
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <input type="checkbox" checked={!!s.include_in_local}
                          onChange={e => updateStudio(s.id, 'include_in_local', e.target.checked)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                      </td>

                      {/* Label */}
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button onClick={() => printLabel(s)}
                          style={{ background: '#f5e6c8', border: '1px solid #d4ad45', color: '#8b6914', padding: '4px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.05em' }}>
                          🏷
                        </button>
                      </td>

                      {/* Edit / Delete */}
                      <td style={{ padding: '10px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <button onClick={() => setEditingRow(null)}
                            style={{ background: 'var(--wine)', border: 'none', color: '#fff', padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.05em', marginRight: '4px' }}>
                            Done
                          </button>
                        ) : (
                          <button onClick={() => setEditingRow(s.id)}
                            title="Edit wine name"
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', padding: '2px 4px', opacity: 0.5, marginRight: '2px' }}>✎</button>
                        )}
                        <button onClick={() => deleteStudio(s.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '14px', cursor: 'pointer', padding: '2px 4px', opacity: 0.4 }}>×</button>
                      </td>
                    </tr>

                    {/* Expanded notes + WS price row */}
                    {isExpanded && (
                      <tr style={{ background: 'var(--cream)' }}>
                        <td colSpan={10} style={{ padding: '16px 20px 16px 36px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>

                            {/* Wine Notes (→ wines.buyer_note) */}
                            <div>
                              <label style={labelStyle}>Wine Notes <span style={{ color: '#2d6a4f', fontWeight: 400 }}>shown on Buyer View & Bottles on Hand</span></label>
                              <textarea
                                defaultValue={buyerNote}
                                placeholder="Tasting notes, producer story…"
                                onBlur={e => { if (e.target.value !== buyerNote) updateWineNote(s.wine_id, e.target.value) }}
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', lineHeight: 1.5 }}
                              />
                            </div>

                            {/* Delivery Note (→ studio.notes) */}
                            <div>
                              <label style={labelStyle}>Delivery Note <span style={{ color: 'var(--muted)', fontWeight: 400 }}>studio only</span></label>
                              <textarea
                                defaultValue={studioNote}
                                placeholder="Condition, delivery ref…"
                                onBlur={e => { if (e.target.value !== studioNote) updateStudio(s.id, 'notes', e.target.value) }}
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', lineHeight: 1.5 }}
                              />
                            </div>

                            {/* IB Price */}
                            <div>
                              <label style={labelStyle}>IB Price / btl (ex-duty)</label>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>£</span>
                                <EditableCell
                                  value={s.wines?.purchase_price_per_bottle || ''}
                                  type="number" step="0.01" min="0" placeholder="0.00"
                                  width="90px"
                                  style={{ border: '1px solid var(--border)', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '12px', background: 'var(--white)' }}
                                  onSave={async v => {
                                    if (!s.wine_id) return
                                    const duty = dutyForSize(s.bottle_size)
                                    const dp = v ? ((parseFloat(v) + duty) * 1.2).toFixed(2) : null
                                    await supabase.from('wines').update({ purchase_price_per_bottle: v }).eq('id', s.wine_id)
                                    await supabase.from('studio').update({ dp_price: dp }).eq('id', s.id)
                                    setStudioWines(prev => prev.map(r => r.id === s.id ? { ...r, dp_price: dp, wines: { ...r.wines, purchase_price_per_bottle: v } } : r))
                                  }}
                                />
                                {s.wines?.purchase_price_per_bottle && (
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>
                                    → DP £{((parseFloat(s.wines.purchase_price_per_bottle) + dutyForSize(s.bottle_size)) * 1.2).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* WS Price input */}
                            <div>
                              <label style={labelStyle}>WS Ex-Duty Price / btl</label>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>£</span>
                                <EditableCell
                                  value={ws || ''}
                                  type="number" step="0.01" min="0" placeholder="0.00"
                                  width="90px"
                                  style={{ border: '1px solid var(--border)', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '12px', background: 'var(--white)' }}
                                  onSave={v => updateWsPrice(s.wine_id, s.id, v)}
                                />
                                {ws && (
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>
                                    → DP £{wsDP}
                                  </span>
                                )}
                              </div>
                              {wsDate && (
                                <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '4px' }}>
                                  Last updated: {wsDate}
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  const url = `https://www.wine-searcher.com/find/${encodeURIComponent((s.wines?.description || '') + ' ' + (s.wines?.vintage || ''))}`
                                  window.open(url, '_blank')
                                }}
                                style={{ marginTop: '6px', background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '4px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                ↗ Search WS
                              </button>
                            </div>
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
      </div>

      {/* ─── Scan Modal ──────────────────────────────────────────────────────── */}
      {showScanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--white)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Scan Bottle</div>
              <button onClick={() => setShowScanModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleScanFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', border: '2px dashed var(--border)', background: 'var(--cream)', padding: '20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', marginBottom: '12px', letterSpacing: '0.1em', color: 'var(--muted)' }}>
              {scanFile ? `📷 ${scanFile.name}` : '📷 Take photo or choose image'}
            </button>

            {scanPreview && !scanDone && (
              <div style={{ marginBottom: '12px' }}>
                <img src={scanPreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', background: '#f0f0f0' }} />
                <button onClick={analyseLabel} disabled={scanAnalysing}
                  style={{ width: '100%', marginTop: '8px', background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: scanAnalysing ? 'wait' : 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {scanAnalysing ? 'Analysing…' : 'Read Label'}
                </button>
              </div>
            )}

            {scanDone && (
              <div style={{ background: 'var(--cream)', padding: '12px', marginBottom: '16px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
                Detected: {[scanRaw?.vintage, scanRaw?.wine_name, scanRaw?.producer].filter(Boolean).join(' · ')}
              </div>
            )}

            {(scanDone || scanFile) && (
              <div>
                {scanWine ? (
                  <div style={{ background: 'var(--cream)', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>{scanWine.description}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{scanWine.vintage} · {scanWine.region}</div>
                    </div>
                    <button onClick={() => { setScanWine(null); setScanMatch(null) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '16px', cursor: 'pointer' }}>×</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Search inventory</label>
                    <input value={scanSearch} onChange={e => scanSearchWines(e.target.value)} placeholder="Search wines…" style={inputStyle} />
                    {scanSearchResults.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', background: 'var(--white)', maxHeight: '160px', overflowY: 'auto' }}>
                        {scanSearchResults.map(w => (
                          <button key={w.id} onClick={() => selectScanWine(w)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>
                            {w.description} <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{w.vintage}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div><label style={labelStyle}>Qty</label>
                    <input type="number" min="1" value={scanQty} onChange={e => setScanQty(parseInt(e.target.value) || 1)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Date Added</label>
                    <input type="date" value={scanDate} onChange={e => setScanDate(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Bottle Size</label>
                    <select value={scanBottleSize} onChange={e => setScanBottleSize(e.target.value)} style={inputStyle}>
                      <option value="37.5">37.5cl Half</option>
                      <option value="75">75cl Bottle</option>
                      <option value="150">150cl Magnum</option>
                      <option value="300">300cl Double Magnum</option>
                    </select></div>
                  <div><label style={labelStyle}>Sale Price £</label>
                    <input type="number" step="0.01" value={scanSalePrice} onChange={e => setScanSalePrice(e.target.value)} placeholder="0.00" style={inputStyle} /></div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Notes</label>
                  <input value={scanNotes} onChange={e => setScanNotes(e.target.value)} placeholder="Optional note" style={inputStyle} />
                </div>
                <button onClick={saveScanEntry} disabled={scanSaving}
                  style={{ width: '100%', background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: scanSaving ? 'wait' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {scanSaving ? 'Saving…' : 'Add to Studio'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Add Wine Modal ───────────────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--white)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Add Wine to Studio</div>
              <button onClick={closeAddModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Wine Name *</label>
                <input value={addDescription} onChange={e => updateAddField('addDescription', e.target.value)} placeholder="e.g. Gevrey-Chambertin, Joseph Roty" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Producer / Maker</label>
                <input value={addProducer} onChange={e => updateAddField('addProducer', e.target.value)} placeholder="e.g. Joseph Roty" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vintage</label>
                <input value={addVintage} onChange={e => updateAddField('addVintage', e.target.value)} placeholder="e.g. 2019" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Colour</label>
                <select value={addColour} onChange={e => updateAddField('addColour', e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Bottle Size</label>
                <select value={addBottleSize} onChange={e => updateAddField('addBottleSize', e.target.value)} style={inputStyle}>
                  <option value="37.5">37.5cl Half</option>
                  <option value="75">75cl Bottle</option>
                  <option value="150">150cl Magnum</option>
                  <option value="300">300cl Double Magnum</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Region</label>
                <input value={addRegion} onChange={e => updateAddField('addRegion', e.target.value)} placeholder="e.g. Burgundy" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <input value={addCountry} onChange={e => updateAddField('addCountry', e.target.value)} placeholder="e.g. France" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Quantity</label>
                <input type="number" min="1" value={addQuantity} onChange={e => updateAddField('addQuantity', parseInt(e.target.value) || 1)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>IB Price / btl £</label>
                <input type="number" step="0.01" value={addIBPrice} onChange={e => updateAddField('addIBPrice', e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sale Price £</label>
                <input type="number" step="0.01" value={addSalePrice} onChange={e => updateAddField('addSalePrice', e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>WS Ex-Duty Price / btl £</label>
                <input type="number" step="0.01" value={addWsPrice} onChange={e => updateAddField('addWsPrice', e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <input value={addNotes} onChange={e => updateAddField('addNotes', e.target.value)} placeholder="Optional delivery note" style={inputStyle} />
              </div>
              {addWineId && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Wine ID (auto-generated)</label>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', padding: '6px 0' }}>{addWineId}</div>
                </div>
              )}
            </div>

            {addIBPrice && (
              <div style={{ padding: '10px 14px', background: 'var(--cream)', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginBottom: '14px' }}>
                DP = £{((parseFloat(addIBPrice) + dutyForSize(addBottleSize)) * 1.2).toFixed(2)}
              </div>
            )}

            <button onClick={saveNewWine} disabled={addSaving}
              style={{ width: '100%', background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: addSaving ? 'wait' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {addSaving ? 'Saving…' : 'Add to Studio'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
