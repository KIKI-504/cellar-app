'use client'
export const dynamic = 'force-dynamic'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const colourDot = (colour) => {
  const c = (colour || '').toLowerCase()
  if (c.includes('white')) return '#d4c88a'
  if (c.includes('ros')) return '#d4748a'
  if (c.includes('red')) return '#8b2535'
  if (c.includes('spark')) return '#a8c4d4'
  if (c.includes('sweet')) return '#c4a85a'
  return '#aaa'
}

const COLOURS = ['Red', 'White', 'Rosé', 'Sparkling', 'Sweet']

function generateSourceId(description, vintage, colour, bottleSize) {
  const yy = vintage ? String(vintage).slice(-2) : 'XX'
  const words = (description || '').replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/)
  const mm = words[0] ? words[0].slice(0, 2).toUpperCase() : 'XX'
  const ww = words[1] ? words[1].slice(0, 4).toUpperCase() : (words[0] ? words[0].slice(2, 6).toUpperCase() : 'XXXX')
  const c = colour ? colour.slice(0, 1).toUpperCase() : 'X'
  const s = String(bottleSize) === '150' ? 'M' : String(bottleSize) === '37.5' ? 'H' : 'B'
  return `${yy} ${mm} ${ww} ${c} ${s}`
}

async function ensureSourceId(studioId, entry) {
  if (entry.source_id) return entry.source_id
  const w = entry.wines
  let pid
  if (w?.source_id) {
    pid = w.source_id
  } else {
    const desc    = w?.description || entry.unlinked_description || ''
    const vintage = w?.vintage     || entry.unlinked_vintage     || ''
    const colour  = w?.colour      || entry.colour               || ''
    const size    = entry.bottle_size || '75'
    pid = generateSourceId(desc, vintage, colour, size)
  }
  await supabase.from('studio').update({ source_id: pid }).eq('id', studioId)
  return pid
}

function normaliseRow(row) {
  if (!row) return row
  if (row.wine_description !== undefined) {
    return {
      ...row,
      wines: row.wine_description ? {
        id:                        row.wine_id,
        description:               row.wine_description,
        vintage:                   row.wine_vintage,
        colour:                    row.wine_colour,
        region:                    row.wine_region,
        purchase_price_per_bottle: row.wine_purchase_price,
        women_note:                row.wine_women_note,
        producer_note:             row.wine_producer_note,
        source_id:                 row.wine_source_id,
      } : null,
    }
  }
  return row
}

// ─── Pull List ────────────────────────────────────────────────────────────────
function PullListView({ box, items, onClose }) {
  const printRef = useRef(null)

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = document.createElement('iframe')
    win.style.display = 'none'
    document.body.appendChild(win)
    win.contentDocument.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>${box.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Cormorant Garamond',serif;color:#1a1008;background:#fff;padding:40px}
        .hdr{border-bottom:1px solid #c8b89a;padding-bottom:20px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end}
        .hdr-title{font-size:28px;font-weight:300;letter-spacing:0.05em}
        .hdr-sub{font-size:12px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:4px}
        .card{padding:18px 0;border-bottom:1px solid #ede6d6;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start}
        .card:last-child{border-bottom:none}
        .wname{font-size:18px;font-weight:500;line-height:1.2}
        .wprod{font-size:14px;color:#3a2a1a;margin-top:2px}
        .wmeta{font-size:11px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:6px}
        .tnote{font-size:13px;font-style:italic;color:#3a2a1a;margin-top:10px;line-height:1.6}
        .pnote{font-size:12px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:6px;line-height:1.5}
        .pblk{text-align:right;min-width:80px}
        .plbl{font-size:9px;font-family:'DM Mono',monospace;color:#7a6652;text-transform:uppercase;letter-spacing:0.1em}
        .pval{font-size:16px;font-weight:500;color:#6b1e2e;margin-top:2px}
        .tots{margin-top:24px;padding-top:16px;border-top:2px solid #c8b89a;display:flex;justify-content:flex-end;gap:32px}
        .tlbl{font-size:9px;font-family:'DM Mono',monospace;color:#7a6652;text-transform:uppercase;letter-spacing:0.1em}
        .tval{font-size:20px;font-weight:500;margin-top:2px}
        .foot{margin-top:40px;padding-top:16px;border-top:1px solid #ede6d6;font-size:10px;font-family:'DM Mono',monospace;color:#c8b89a;text-align:center}
        @media print{body{padding:20px}}
      </style></head><body>${content}</body></html>`)
    win.contentDocument.close()
    win.onload = () => { win.contentWindow.print(); document.body.removeChild(win) }
  }

  const totalSale    = items.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
  const totalDP      = items.reduce((s, i) => s + (parseFloat(i.dp_price)   || 0) * (i.quantity || 1), 0)
  const totalBottles = items.reduce((s, i) => s + (i.quantity || 1), 0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.85)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'680px', border:'1px solid var(--border)' }}>
        <div style={{ background:'var(--ink)', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px' }}>
          <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.15em', color:'rgba(253,250,245,0.5)', textTransform:'uppercase' }}>Pull List Preview</span>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handlePrint} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'7px 16px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>🖨 Print</button>
            <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.6)', padding:'7px 12px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕ Close</button>
          </div>
        </div>
        <div ref={printRef} style={{ padding:'36px 40px' }}>
          <div className="hdr" style={{ borderBottom:'1px solid #c8b89a', paddingBottom:'20px', marginBottom:'28px', display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <div className="hdr-title" style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'26px', fontWeight:300, letterSpacing:'0.05em' }}>{box.name}</div>
              <div className="hdr-sub" style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'4px' }}>For {box.buyer_name}{box.buyer_email && ` · ${box.buyer_email}`}</div>
            </div>
            <div style={{ textAlign:'right', fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>
              <div>{totalBottles} bottle{totalBottles !== 1 ? 's' : ''}</div>
              <div>{new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
            </div>
          </div>
          {items.map((item, i) => {
            const fd = item.wine_description || ''
            const ci = fd.indexOf(',')
            const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
            const pp = ci > -1 ? fd.slice(ci + 1).trim() : ''
            return (
              <div key={item.id} className="card" style={{ padding:'18px 0', borderBottom: i < items.length-1 ? '1px solid #ede6d6' : 'none', display:'grid', gridTemplateColumns:'1fr auto', gap:'16px', alignItems:'start' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'8px', flexWrap:'wrap' }}>
                    <span style={{ display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', background:colourDot(item.wine_colour), flexShrink:0 }}></span>
                    <span className="wname" style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', fontWeight:500 }}>{wp}</span>
                    {item.wine_vintage && <span style={{ fontFamily:'DM Mono,monospace', fontSize:'12px', color:'var(--muted)' }}>{item.wine_vintage}</span>}
                  </div>
                  {pp && <div className="wprod" style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', color:'var(--ink)', marginTop:'2px', marginLeft:'16px' }}>{pp}</div>}
                  {item.wine_region && <div className="wmeta" style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'4px', marginLeft:'16px' }}>{item.wine_region}</div>}
                  {item.tasting_note && <div className="tnote" style={{ fontSize:'13px', fontStyle:'italic', color:'#3a2a1a', marginTop:'10px', marginLeft:'16px', lineHeight:1.6 }}>"{item.tasting_note}"</div>}
                  {item.producer_note && <div className="pnote" style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'6px', marginLeft:'16px', lineHeight:1.5 }}>{item.producer_note}</div>}
                </div>
                <div className="pblk" style={{ textAlign:'right', minWidth:'80px' }}>
                  <div className="plbl" style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>per bottle</div>
                  <div className="pval" style={{ fontFamily:'DM Mono,monospace', fontSize:'16px', fontWeight:500, color:'var(--wine)', marginTop:'2px' }}>{item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}</div>
                  {item.quantity > 1 && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px' }}>× {item.quantity}</div>}
                </div>
              </div>
            )
          })}
          <div className="tots" style={{ marginTop:'24px', paddingTop:'16px', borderTop:'2px solid #c8b89a', display:'flex', justifyContent:'flex-end', gap:'32px', flexWrap:'wrap' }}>
            {totalDP > 0 && <div style={{ textAlign:'right' }}><div className="tlbl" style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Cost (DP)</div><div className="tval" style={{ fontFamily:'DM Mono,monospace', fontSize:'18px', fontWeight:500, marginTop:'2px' }}>£{totalDP.toFixed(2)}</div></div>}
            {totalSale - totalDP > 0 && <div style={{ textAlign:'right' }}><div className="tlbl" style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Margin</div><div className="tval" style={{ fontFamily:'DM Mono,monospace', fontSize:'18px', fontWeight:500, color:'#2d6a4f', marginTop:'2px' }}>£{(totalSale-totalDP).toFixed(2)}</div></div>}
            <div style={{ textAlign:'right' }}><div className="tlbl" style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Total</div><div className="tval" style={{ fontFamily:'DM Mono,monospace', fontSize:'22px', fontWeight:500, color:'var(--wine)', marginTop:'2px' }}>£{totalSale.toFixed(2)}</div></div>
          </div>
          {box.notes && <div style={{ marginTop:'24px', padding:'12px 16px', background:'rgba(212,173,69,0.08)', border:'1px solid rgba(212,173,69,0.25)', fontSize:'12px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>{box.notes}</div>}
          <div className="foot" style={{ marginTop:'40px', paddingTop:'16px', borderTop:'1px solid #ede6d6', fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#c8b89a', textAlign:'center', letterSpacing:'0.1em' }}>Belle Année Wines · {new Date().getFullYear()}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Bottle Modal ─────────────────────────────────────────────────────────
function AddBottleModal({ onAdd, onClose }) {
  const [search, setSearch]             = useState('')
  const [results, setResults]           = useState([])
  const [searched, setSearched]         = useState(false)   // true once a search has been run
  const [selected, setSelected]         = useState(null)
  const [scanMatch, setScanMatch]       = useState(null)
  const [qty, setQty]                   = useState(1)
  const [tastingNote, setTastingNote]   = useState('')
  const [producerNote, setProducerNote] = useState('')
  const [salePrice, setSalePrice]       = useState('')
  const [imageFile, setImageFile]       = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning]         = useState(false)
  const [scanLabel, setScanLabel]       = useState(null)
  const [saving, setSaving]             = useState(false)
  const [justAdded, setJustAdded]       = useState(null)

  // Manual add form (for wines not in studio)
  const [showManual, setShowManual]             = useState(false)
  const [manualDesc, setManualDesc]             = useState('')
  const [manualVintage, setManualVintage]       = useState('')
  const [manualColour, setManualColour]         = useState('')
  const [manualRegion, setManualRegion]         = useState('')
  const [manualSize, setManualSize]             = useState('75')
  const [manualIBPrice, setManualIBPrice]       = useState('')
  const [manualSalePrice, setManualSalePrice]   = useState('')
  const [manualAddToStudio, setManualAddToStudio] = useState(true)
  const [manualStudioQty, setManualStudioQty]   = useState(1)
  const [manualSaving, setManualSaving]         = useState(false)

  const fileRef = useRef(null)

  async function searchStudio(q) {
    setSearch(q)
    if (q.length < 2) { setResults([]); setSearched(false); return }
    const { data } = await supabase.rpc('search_studio', { search_term: q })
    setResults((data || []).map(normaliseRow))
    setSearched(true)
  }

  function applyEntry(rawEntry) {
    const entry = normaliseRow(rawEntry)
    const w = entry.wines
    const built = {
      ...entry,
      _desc:    w?.description || entry.unlinked_description || '',
      _vintage: w?.vintage     || entry.unlinked_vintage     || '',
      _colour:  w?.colour      || entry.colour               || '',
      _region:  w?.region      || '',
      _dp:      entry.dp_price ? parseFloat(entry.dp_price)  : null,
    }
    setSelected(built)
    setSalePrice(entry.sale_price ? String(parseFloat(entry.sale_price)) : '')
    setTastingNote('')
    setProducerNote('')
    setSearch('')
    setResults([])
    setSearched(false)
    setScanMatch(null)
    setShowManual(false)
  }

  function openManualAdd() {
    setShowManual(true)
    setManualDesc(search)  // pre-fill from search term
    setManualVintage('')
    setManualColour('')
    setManualRegion('')
    setManualSize('75')
    setManualIBPrice('')
    setManualSalePrice(salePrice)
  }

  async function saveManualWine() {
    if (!manualDesc) return
    setManualSaving(true)
    try {
      const ibPrice = manualIBPrice ? parseFloat(manualIBPrice) : null
      const duty = manualSize === '150' ? 6 : manualSize === '37.5' ? 1.5 : 3
      const dp = ibPrice ? ((ibPrice + duty) * 1.2).toFixed(2) : null
      const sid = generateSourceId(manualDesc, manualVintage, manualColour, manualSize)
      const today = new Date().toISOString().split('T')[0]

      let studioRowId = null

      if (manualAddToStudio) {
        // Create wine in wines table
        const { data: newWine, error: wineErr } = await supabase
          .from('wines')
          .insert({
            source: 'Manual',
            source_id: sid,
            description: manualDesc,
            vintage: manualVintage || null,
            colour: manualColour || null,
            region: manualRegion || null,
            bottle_format: manualSize === '150' ? 'Magnum' : manualSize === '37.5' ? 'Half Bottle' : 'Bottle',
            bottle_volume: manualSize,
            quantity: String(manualStudioQty),
            purchase_price_per_bottle: ibPrice,
            include_in_buyer_view: false,
          })
          .select().single()
        if (wineErr) throw wineErr

        // Create studio row
        const { data: newStudio, error: studioErr } = await supabase
          .from('studio')
          .insert({
            wine_id: newWine.id,
            quantity: manualStudioQty,
            date_moved: today,
            dp_price: dp,
            sale_price: manualSalePrice ? parseFloat(manualSalePrice) : null,
            status: 'Available',
            notes: null,
            include_in_local: false,
            bottle_size: manualSize,
            colour: manualColour || null,
            source_id: sid,
          })
          .select().single()
        if (studioErr) throw studioErr
        studioRowId = newStudio.id
      }

      // Add to box
      const { error: boxErr } = await onAdd({
        studio_id:        studioRowId,
        wine_description: manualDesc,
        wine_vintage:     manualVintage,
        wine_colour:      manualColour,
        wine_region:      manualRegion,
        dp_price:         dp ? parseFloat(dp) : null,
        sale_price:       manualSalePrice ? parseFloat(manualSalePrice) : null,
        quantity:         qty,
        tasting_note:     tastingNote  || null,
        producer_note:    producerNote || null,
        source_id:        sid,
      })
      if (boxErr) throw boxErr

      setJustAdded(manualDesc)
      setShowManual(false)
      setManualDesc(''); setManualVintage(''); setManualColour(''); setManualRegion('')
      setManualSize('75'); setManualIBPrice(''); setManualSalePrice(''); setManualStudioQty(1)
      setSearch(''); setResults([]); setSearched(false)
      setQty(1); setSalePrice(''); setTastingNote(''); setProducerNote('')
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setManualSaving(false)
  }

  function handleImageSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function analyseImage() {
    if (!imageFile) return
    setScanning(true)
    setScanLabel(null)
    setScanMatch(null)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(imageFile)
      })
      const resp = await fetch('/api/analyse-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: imageFile.type })
      })
      const result = await resp.json()
      if (!result.success) throw new Error(result.error)
      const ex = result.data
      setScanLabel(ex)
      const terms = [ex.wine_name, ex.producer, ex.wine_name?.split(' ')[0]].filter(Boolean)
      let matchData = null
      for (const term of terms) {
        const { data } = await supabase.rpc('search_studio', { search_term: term })
        if (data && data.length > 0) { matchData = data; break }
      }
      if (matchData && matchData.length > 0) {
        setScanMatch(normaliseRow(matchData[0]))
      } else {
        const q = [ex.wine_name, ex.producer].filter(Boolean).join(', ')
        setSearch(q)
        const firstWord = ex.wine_name?.split(' ')[0] || ex.producer?.split(' ')[0] || ''
        if (firstWord.length > 2) {
          const { data: broader } = await supabase.rpc('search_studio', { search_term: firstWord })
          setResults((broader || []).map(normaliseRow))
          setSearched(true)
        }
      }
    } catch (err) {
      alert('Label read failed: ' + err.message)
    }
    setScanning(false)
  }

  async function confirm() {
    if (!selected) return
    setSaving(true)
    const parentId = selected.id
      ? await ensureSourceId(selected.id, selected)
      : generateSourceId(selected._desc, selected._vintage, selected._colour, selected.bottle_size || '75')
    const { error } = await onAdd({
      studio_id:        selected.id || null,
      wine_description: selected._desc,
      wine_vintage:     selected._vintage,
      wine_colour:      selected._colour,
      wine_region:      selected._region,
      dp_price:         selected._dp,
      sale_price:       salePrice ? parseFloat(salePrice) : null,
      quantity:         qty,
      tasting_note:     tastingNote  || null,
      producer_note:    producerNote || null,
      source_id:        parentId,
    })
    if (error) { alert('Failed to add: ' + error.message); setSaving(false); return }
    setJustAdded(selected._desc)
    setSelected(null); setSearch(''); setResults([]); setSearched(false)
    setQty(1); setSalePrice(''); setTastingNote(''); setProducerNote('')
    setImageFile(null); setImagePreview(null); setScanLabel(null); setScanMatch(null)
    setSaving(false)
  }

  const inputSt = { width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:'12px', outline:'none', boxSizing:'border-box' }
  const lblSt   = { display:'block', fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.75)', zIndex:250, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'540px', border:'1px solid var(--border)', marginTop:'8px' }}>

        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', padding:'18px 18px 0' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300 }}>Add a Bottle</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--muted)' }}>✕</button>
        </div>

        <div style={{ padding:'14px 18px 22px' }}>

          {/* Just added confirmation */}
          {justAdded && (
            <div style={{ background:'rgba(45,106,79,0.1)', border:'1px solid rgba(45,106,79,0.3)', padding:'10px 14px', marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'#2d6a4f' }}>
                ✓ Added: <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{justAdded.split(',')[0]}</span>
              </span>
              <button onClick={onClose} style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'5px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>Done ✓</button>
            </div>
          )}

          {/* ── Manual add form ── */}
          {showManual ? (
            <div>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'14px' }}>
                <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--wine)' }}>Add Wine Manually</div>
                <button onClick={() => setShowManual(false)} style={{ background:'none', border:'none', fontSize:'11px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace' }}>← back to search</button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={lblSt}>Wine name *</label>
                  <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Château Lynch Bages" style={inputSt} />
                </div>
                <div>
                  <label style={lblSt}>Vintage</label>
                  <input value={manualVintage} onChange={e => setManualVintage(e.target.value)} placeholder="e.g. 2018" style={inputSt} />
                </div>
                <div>
                  <label style={lblSt}>Colour</label>
                  <select value={manualColour} onChange={e => setManualColour(e.target.value)} style={inputSt}>
                    <option value="">Select…</option>
                    {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lblSt}>Region</label>
                  <input value={manualRegion} onChange={e => setManualRegion(e.target.value)} placeholder="e.g. Pauillac" style={inputSt} />
                </div>
                <div>
                  <label style={lblSt}>Bottle size</label>
                  <select value={manualSize} onChange={e => setManualSize(e.target.value)} style={inputSt}>
                    <option value="37.5">37.5cl Half</option>
                    <option value="75">75cl Bottle</option>
                    <option value="150">150cl Magnum</option>
                    <option value="300">300cl Double Magnum</option>
                  </select>
                </div>
                <div>
                  <label style={lblSt}>IB Price / btl £</label>
                  <input type="number" step="0.01" value={manualIBPrice} onChange={e => setManualIBPrice(e.target.value)} placeholder="0.00" style={inputSt} />
                </div>
                <div>
                  <label style={lblSt}>Sale price £/btl</label>
                  <input type="number" step="0.01" value={manualSalePrice} onChange={e => setManualSalePrice(e.target.value)} placeholder="0.00" style={{ ...inputSt, border:'2px solid rgba(107,30,46,0.25)', color:'var(--wine)' }} />
                </div>
              </div>

              {/* Studio option */}
              <div style={{ background:'var(--white)', border:'1px solid var(--border)', padding:'12px 14px', marginBottom:'12px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', marginBottom: manualAddToStudio ? '10px' : '0' }}>
                  <input type="checkbox" checked={manualAddToStudio} onChange={e => setManualAddToStudio(e.target.checked)}
                    style={{ width:'15px', height:'15px', accentColor:'var(--wine)', cursor:'pointer' }} />
                  <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--ink)' }}>Also add to Studio inventory</span>
                </label>
                {manualAddToStudio && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingLeft:'23px' }}>
                    <label style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', whiteSpace:'nowrap' }}>Quantity in studio:</label>
                    <input type="number" min="1" value={manualStudioQty} onChange={e => setManualStudioQty(parseInt(e.target.value) || 1)}
                      style={{ width:'60px', border:'1px solid var(--border)', background:'var(--cream)', padding:'5px 8px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', textAlign:'center' }} />
                  </div>
                )}
                {!manualAddToStudio && (
                  <div style={{ paddingLeft:'23px', fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>
                    Wine will be added to this box only, not to your studio inventory.
                  </div>
                )}
              </div>

              {/* Box entry qty + notes */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div>
                  <label style={lblSt}>Qty in this box</label>
                  <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
                    style={{ ...inputSt, fontSize:'16px', fontWeight:600 }} />
                </div>
              </div>
              <div style={{ marginBottom:'10px' }}>
                <label style={lblSt}>Tasting note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(italic on pull list)</span></label>
                <textarea value={tastingNote} onChange={e => setTastingNote(e.target.value)} rows={2} placeholder="Rich, concentrated…"
                  style={{ ...inputSt, fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontStyle:'italic', resize:'vertical' }} />
              </div>
              <div style={{ marginBottom:'14px' }}>
                <label style={lblSt}>Producer note</label>
                <textarea value={producerNote} onChange={e => setProducerNote(e.target.value)} rows={2} placeholder="Optional context…"
                  style={{ ...inputSt, resize:'vertical' }} />
              </div>

              <button onClick={saveManualWine} disabled={!manualDesc || manualSaving}
                style={{ width:'100%', background: manualDesc ? 'var(--wine)' : '#ccc', color:'var(--white)', border:'none', padding:'13px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.15em', textTransform:'uppercase', cursor: manualDesc ? 'pointer' : 'not-allowed', fontWeight:600 }}>
                {manualSaving ? 'Saving…' : manualAddToStudio ? '✓ Add to Studio & Box' : '✓ Add to Box Only'}
              </button>
            </div>
          ) : (
            <>
              {/* Photo section */}
              {!selected && (
                <div style={{ marginBottom:'12px' }}>
                  <label style={lblSt}>Identify by photo</label>
                  {!imagePreview ? (
                    <div onClick={() => fileRef.current?.click()}
                      style={{ border:'1px dashed var(--border)', padding:'11px', textAlign:'center', cursor:'pointer', background:'var(--white)', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--wine)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                      <span style={{ fontSize:'16px' }}>📷</span>
                      <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', letterSpacing:'0.08em' }}>PHOTO FROM CAMERA ROLL</span>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display:'none' }} />
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                      <img src={imagePreview} alt="Label" style={{ width:'52px', height:'66px', objectFit:'cover', border:'1px solid var(--border)', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        {!scanLabel && !scanning && (
                          <button onClick={analyseImage} style={{ background:'var(--ink)', color:'#d4ad45', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', width:'100%' }}>🔍 Read Label</button>
                        )}
                        {scanning && <div style={{ padding:'8px 0', fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)' }}>🔍 Reading label…</div>}
                        {scanLabel && !scanning && (
                          <div style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'#2d6a4f' }}>
                            ✓ {[scanLabel.wine_name, scanLabel.producer, scanLabel.vintage].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <button onClick={() => { setImageFile(null); setImagePreview(null); setScanLabel(null); setScanMatch(null) }}
                          style={{ display:'block', marginTop:'5px', background:'none', border:'none', fontSize:'10px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace' }}>✕ Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scan match */}
              {scanMatch && !selected && (
                <div onClick={() => applyEntry(scanMatch)}
                  style={{ marginBottom:'12px', background:'rgba(45,106,79,0.08)', border:'2px solid rgba(45,106,79,0.5)', padding:'14px 16px', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(45,106,79,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(45,106,79,0.08)'}>
                  <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#2d6a4f', letterSpacing:'0.1em', marginBottom:'6px' }}>✓ MATCHED IN STUDIO — TAP TO SELECT</div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'16px', fontWeight:500 }}>
                    {(scanMatch.wines?.description || scanMatch.unlinked_description || '').split(',')[0]}
                  </div>
                  <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'4px' }}>
                    {scanMatch.wines?.vintage || scanMatch.unlinked_vintage || ''}
                    {scanMatch.dp_price && ` · DP £${parseFloat(scanMatch.dp_price).toFixed(2)}`}
                    {` · ${scanMatch.quantity} in studio`}
                  </div>
                </div>
              )}

              {/* Manual search */}
              {!selected && (
                <div style={{ marginBottom:'12px' }}>
                  <label style={lblSt}>
                    {scanMatch ? 'Or search manually' : justAdded ? 'Search for next bottle' : 'Search studio inventory'}
                  </label>
                  <input value={search} onChange={e => searchStudio(e.target.value)}
                    placeholder="Start typing a wine name…"
                    style={{ ...inputSt, fontSize:'13px' }} />

                  {/* Results dropdown */}
                  {results.length > 0 && (
                    <div style={{ border:'1px solid var(--border)', borderTop:'none', background:'var(--white)', maxHeight:'200px', overflowY:'auto' }}>
                      {results.map(entry => {
                        const w = entry.wines
                        const desc    = w?.description || entry.unlinked_description || ''
                        const vintage = w?.vintage     || entry.unlinked_vintage     || ''
                        const colour  = w?.colour      || entry.colour               || ''
                        return (
                          <div key={entry.id} onClick={() => applyEntry(entry)}
                            style={{ padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid #ede6d6', display:'flex', alignItems:'center', gap:'8px' }}
                            onMouseEnter={e => e.currentTarget.style.background='#f5f0e8'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:colourDot(colour), flexShrink:0, display:'inline-block' }}></span>
                            <div>
                              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{desc}</div>
                              <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono,monospace' }}>
                                {vintage} · DP {entry.dp_price ? `£${parseFloat(entry.dp_price).toFixed(2)}` : '—'} · {entry.quantity} avail
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Not found — offer manual add */}
                  {searched && results.length === 0 && search.length >= 2 && (
                    <div style={{ border:'1px solid rgba(184,148,42,0.3)', borderTop:'none', background:'rgba(184,148,42,0.06)', padding:'12px 14px' }}>
                      <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'#7a5e10', marginBottom:'8px' }}>
                        "{search}" not found in studio inventory.
                      </div>
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        <button onClick={openManualAdd}
                          style={{ background:'var(--ink)', color:'var(--white)', border:'none', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                          + Add wine manually
                        </button>
                        <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', display:'flex', alignItems:'center' }}>
                          Option to create in Studio inventory or add to box only
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Always-available manual add link */}
                  {!searched && !scanMatch && !justAdded && (
                    <div style={{ marginTop:'8px', textAlign:'right' }}>
                      <button onClick={openManualAdd} style={{ background:'none', border:'none', fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', cursor:'pointer', textDecoration:'underline' }}>
                        Add wine not in inventory →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Selected wine form */}
              {selected && (
                <>
                  <div style={{ background:'rgba(107,30,46,0.06)', border:'1px solid rgba(107,30,46,0.2)', padding:'10px 12px', marginBottom:'12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{selected._desc.split(',')[0]}</div>
                        {selected._desc.includes(',') && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginTop:'1px' }}>{selected._desc.split(',').slice(1).join(',').trim()}</div>}
                        <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'3px' }}>
                          {selected._vintage}{selected._region && ` · ${selected._region}`} · {selected.quantity} in studio · DP {selected._dp ? `£${selected._dp.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <button onClick={() => { setSelected(null); setScanMatch(null) }}
                        style={{ background:'none', border:'none', fontSize:'12px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace', flexShrink:0 }}>✕ change</button>
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                    <div>
                      <label style={lblSt}>Quantity</label>
                      <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} onFocus={e => e.target.select()}
                        style={{ ...inputSt, fontSize:'16px', fontWeight:600 }} />
                    </div>
                    <div>
                      <label style={lblSt}>Sale price (£/btl)</label>
                      <input type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" onFocus={e => e.target.select()}
                        style={{ ...inputSt, border:'2px solid rgba(107,30,46,0.25)', background:'rgba(107,30,46,0.03)', fontSize:'14px', fontWeight:600, color:'var(--wine)' }} />
                      {salePrice && selected._dp && (() => {
                        const m = ((parseFloat(salePrice) - selected._dp) / selected._dp * 100)
                        return <div style={{ fontSize:'10px', color: m >= 0 ? '#2d6a4f' : '#c0392b', marginTop:'3px', fontFamily:'DM Mono,monospace' }}>{m >= 0 ? '+' : ''}{m.toFixed(1)}% on DP</div>
                      })()}
                    </div>
                  </div>

                  <div style={{ marginBottom:'10px' }}>
                    <label style={lblSt}>Tasting note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(italic on pull list)</span></label>
                    <textarea value={tastingNote} onChange={e => setTastingNote(e.target.value)} placeholder="Rich, concentrated dark fruit…" rows={3}
                      style={{ ...inputSt, fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontStyle:'italic', resize:'vertical' }} />
                  </div>

                  <div style={{ marginBottom:'14px' }}>
                    <label style={lblSt}>Producer note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
                    <textarea value={producerNote} onChange={e => setProducerNote(e.target.value)} placeholder="Brief context about the producer…" rows={2}
                      style={{ ...inputSt, resize:'vertical' }} />
                  </div>

                  <button onClick={confirm} disabled={saving}
                    style={{ width:'100%', background:'var(--wine)', color:'var(--white)', border:'none', padding:'14px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.15em', textTransform:'uppercase', cursor:saving?'wait':'pointer', fontWeight:600 }}>
                    {saving ? 'Adding…' : '✓ Add to Box — add another?'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Multi Bottle Modal ───────────────────────────────────────────────────────
function MultiBottleModal({ onAddAll, onClose }) {
  const [imageFile, setImageFile]       = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning]         = useState(false)
  const [bottles, setBottles]           = useState([])
  const [saving, setSaving]             = useState(false)
  const fileRef = useRef(null)

  function handleImageSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setBottles([])
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function analyseMulti() {
    if (!imageFile) return
    setScanning(true)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(imageFile)
      })
      const resp = await fetch('/api/analyse-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: imageFile.type, mode: 'multi' })
      })
      const result = await resp.json()
      if (!result.success) throw new Error(result.error)
      const labels = Array.isArray(result.data) ? result.data : [result.data]
      const enriched = await Promise.all(labels.map(async (label) => {
        const terms = [label.wine_name, label.producer, label.wine_name?.split(' ')[0]].filter(Boolean)
        let match = null
        for (const term of terms) {
          const { data } = await supabase.rpc('search_studio', { search_term: term })
          if (data && data.length > 0) { match = normaliseRow(data[0]); break }
        }
        return { label, match, status: 'pending', salePrice: match?.sale_price ? String(parseFloat(match.sale_price)) : '', qty: 1 }
      }))
      setBottles(enriched)
    } catch (err) {
      alert('Multi-label read failed: ' + err.message)
    }
    setScanning(false)
  }

  function updateBottle(idx, patch) {
    setBottles(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))
  }

  async function confirmAll() {
    const toAdd = bottles.filter(b => b.status === 'confirmed')
    if (!toAdd.length) return
    setSaving(true)
    const items = await Promise.all(toAdd.map(async (b) => {
      const entry = b.match
      const w = entry?.wines
      const desc    = w?.description || entry?.unlinked_description || [b.label.wine_name, b.label.producer].filter(Boolean).join(', ')
      const vintage = w?.vintage     || entry?.unlinked_vintage     || b.label.vintage || ''
      const colour  = w?.colour      || entry?.colour               || b.label.colour  || ''
      const region  = w?.region      || b.label.region              || ''
      const dp      = entry?.dp_price ? parseFloat(entry.dp_price)  : null
      const sid     = entry?.id
        ? await ensureSourceId(entry.id, entry)
        : generateSourceId(desc, vintage, colour, '75')
      return {
        studio_id: entry?.id || null, wine_description: desc, wine_vintage: vintage,
        wine_colour: colour, wine_region: region, dp_price: dp,
        sale_price: b.salePrice ? parseFloat(b.salePrice) : null,
        quantity: b.qty, tasting_note: null, producer_note: null, source_id: sid,
      }
    }))
    const { error } = await onAddAll(items)
    if (error) { alert('Failed: ' + error.message); setSaving(false); return }
    setSaving(false)
    onClose()
  }

  const confirmedCount = bottles.filter(b => b.status === 'confirmed').length
  const pendingCount   = bottles.filter(b => b.status === 'pending').length

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.75)', zIndex:250, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'560px', border:'1px solid var(--border)', marginTop:'8px' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', padding:'18px 18px 0' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300 }}>Multiple Bottles</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--muted)' }}>✕</button>
        </div>
        <div style={{ padding:'14px 18px 22px' }}>
          <div style={{ marginBottom:'14px' }}>
            <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'6px', fontFamily:'DM Mono,monospace' }}>Photograph all the bottles together</label>
            {!imagePreview ? (
              <div onClick={() => fileRef.current?.click()}
                style={{ border:'1px dashed var(--border)', padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--white)', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--wine)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <span style={{ fontSize:'28px' }}>📷</span>
                <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', letterSpacing:'0.08em' }}>PHOTO FROM CAMERA ROLL</span>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display:'none' }} />
              </div>
            ) : (
              <div>
                <img src={imagePreview} alt="Bottles" style={{ width:'100%', maxHeight:'220px', objectFit:'contain', border:'1px solid var(--border)', background:'var(--white)' }} />
                <div style={{ display:'flex', gap:'8px', marginTop:'8px', alignItems:'center' }}>
                  {!bottles.length && !scanning && (
                    <button onClick={analyseMulti} style={{ background:'var(--ink)', color:'#d4ad45', border:'none', padding:'9px 16px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', flex:1 }}>🔍 Read All Labels</button>
                  )}
                  {scanning && <div style={{ flex:1, padding:'9px', fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', textAlign:'center' }}>🔍 Reading labels…</div>}
                  <button onClick={() => { setImageFile(null); setImagePreview(null); setBottles([]) }}
                    style={{ background:'none', border:'1px solid var(--border)', padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', cursor:'pointer' }}>✕ Retake</button>
                </div>
              </div>
            )}
          </div>

          {bottles.length > 0 && (
            <div>
              <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'10px' }}>
                {bottles.length} bottle{bottles.length !== 1 ? 's' : ''} detected — confirm each to add to box
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
                {bottles.map((b, idx) => {
                  const entry = b.match
                  const w = entry?.wines
                  const desc    = w?.description || entry?.unlinked_description || [b.label.wine_name, b.label.producer].filter(Boolean).join(', ')
                  const vintage = w?.vintage     || entry?.unlinked_vintage     || b.label.vintage || ''
                  const colour  = w?.colour      || entry?.colour               || b.label.colour  || ''
                  const dp      = entry?.dp_price ? parseFloat(entry.dp_price) : null
                  const isConfirmed = b.status === 'confirmed'
                  const isSkipped   = b.status === 'skipped'
                  const fd = desc || '', ci = fd.indexOf(',')
                  const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
                  const pp = ci > -1 ? fd.slice(ci + 1).trim() : ''

                  return (
                    <div key={idx} style={{ border:`2px solid ${isConfirmed ? 'rgba(45,106,79,0.5)' : isSkipped ? 'rgba(0,0,0,0.1)' : 'var(--border)'}`, background: isConfirmed ? 'rgba(45,106,79,0.06)' : isSkipped ? 'rgba(0,0,0,0.03)' : 'var(--white)', padding:'12px 14px', opacity: isSkipped ? 0.5 : 1 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px', marginBottom:'8px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:colourDot(colour), display:'inline-block', flexShrink:0 }}></span>
                            <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{wp || '—'}</span>
                            {vintage && <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)' }}>{vintage}</span>}
                          </div>
                          {pp && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginLeft:'15px', marginTop:'1px' }}>{pp}</div>}
                          {entry ? (
                            <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#2d6a4f', marginLeft:'15px', marginTop:'4px' }}>✓ in studio · {entry.quantity} avail{dp ? ` · DP £${dp.toFixed(2)}` : ''}</div>
                          ) : (
                            <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#c0392b', marginLeft:'15px', marginTop:'4px' }}>Not found in studio — will add to box only</div>
                          )}
                        </div>
                        {!isConfirmed && (
                          <button onClick={() => updateBottle(idx, { status: isSkipped ? 'pending' : 'skipped' })}
                            style={{ background:'none', border:'none', fontSize:'11px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace', flexShrink:0, padding:'2px 4px' }}>
                            {isSkipped ? 'undo' : '✕'}
                          </button>
                        )}
                      </div>
                      {!isSkipped && (
                        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                            <label style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Qty</label>
                            <input type="number" min="1" value={b.qty} onChange={e => updateBottle(idx, { qty: parseInt(e.target.value) || 1 })} onFocus={e => e.target.select()}
                              style={{ width:'48px', border:'1px solid var(--border)', background:'var(--cream)', padding:'5px 6px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', textAlign:'center' }} />
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'4px', flex:1 }}>
                            <label style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>Sale £</label>
                            <input type="number" step="0.01" value={b.salePrice} onChange={e => updateBottle(idx, { salePrice: e.target.value })} onFocus={e => e.target.select()} placeholder="0.00"
                              style={{ width:'80px', border:'2px solid rgba(107,30,46,0.2)', background:'rgba(107,30,46,0.03)', padding:'5px 6px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', color:'var(--wine)' }} />
                            {b.salePrice && dp && (() => { const m = ((parseFloat(b.salePrice) - dp) / dp * 100); return <span style={{ fontSize:'10px', color: m >= 0 ? '#2d6a4f' : '#c0392b', fontFamily:'DM Mono,monospace' }}>{m >= 0 ? '+' : ''}{m.toFixed(0)}%</span> })()}
                          </div>
                          {isConfirmed ? (
                            <button onClick={() => updateBottle(idx, { status: 'pending' })} style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'6px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>✓ confirmed</button>
                          ) : (
                            <button onClick={() => updateBottle(idx, { status: 'confirmed' })} style={{ background:'none', border:'2px solid rgba(45,106,79,0.5)', color:'#2d6a4f', padding:'6px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>✓ confirm</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {pendingCount > 0 && confirmedCount === 0 && (
                  <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', flex:1 }}>Confirm at least one bottle above</div>
                )}
                {confirmedCount > 0 && (
                  <button onClick={confirmAll} disabled={saving}
                    style={{ flex:1, background:'var(--wine)', color:'var(--white)', border:'none', padding:'13px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.15em', textTransform:'uppercase', cursor:saving?'wait':'pointer', fontWeight:600 }}>
                    {saving ? 'Adding…' : `✓ Add ${confirmedCount} bottle${confirmedCount !== 1 ? 's' : ''} to Box`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Box Builder ─────────────────────────────────────────────────────────
export default function BoxPage() {
  const router = useRouter()
  const [boxes, setBoxes]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeBox, setActiveBox]     = useState(null)
  const [activeItems, setActiveItems] = useState([])
  const [showNewBoxModal, setShowNewBoxModal] = useState(false)
  const [showAddBottle, setShowAddBottle]     = useState(false)
  const [showMultiBottle, setShowMultiBottle] = useState(false)
  const [showPullList, setShowPullList]       = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [saving, setSaving]           = useState(false)
  const [statusMsg, setStatusMsg]     = useState(null)

  const [newName, setNewName]   = useState('')
  const [newBuyer, setNewBuyer] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newNotes, setNewNotes] = useState('')

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchBoxes()
  }, [])

  function showStatus(type, text, durationMs = 4000) {
    setStatusMsg({ type, text })
    setTimeout(() => setStatusMsg(null), durationMs)
  }

  async function fetchBoxes() {
    setLoading(true)
    const { data, error } = await supabase.from('boxes').select('*').order('created_at', { ascending: false })
    if (error) showStatus('error', 'Failed to load boxes: ' + error.message)
    setBoxes(data || [])
    setLoading(false)
  }

  async function fetchBoxItems(boxId) {
    const { data, error } = await supabase.from('box_items').select('*').eq('box_id', boxId).order('sort_order', { ascending: true })
    if (error) showStatus('error', 'Failed to load items: ' + error.message)
    setActiveItems(data || [])
  }

  async function openBox(box) {
    setActiveBox(box)
    await fetchBoxItems(box.id)
    if (typeof window !== 'undefined' && window.innerWidth < 700) setShowSidebar(false)
  }

  async function createBox() {
    if (!newName || !newBuyer) return
    setSaving(true)
    const { data, error } = await supabase.from('boxes').insert({
      name: newName, buyer_name: newBuyer,
      buyer_email: newEmail || null, notes: newNotes || null, status: 'Draft'
    }).select().single()
    if (error) { showStatus('error', 'Failed to create: ' + error.message); setSaving(false); return }
    await fetchBoxes()
    setShowNewBoxModal(false)
    setNewName(''); setNewBuyer(''); setNewEmail(''); setNewNotes('')
    openBox(data)
    setSaving(false)
  }

  async function addItemToBox(item) {
    if (!activeBox) return { error: new Error('No active box') }
    const { error } = await supabase.from('box_items').insert({ box_id: activeBox.id, ...item, sort_order: activeItems.length })
    if (!error) { await fetchBoxItems(activeBox.id); await updateBoxTotals(activeBox.id) }
    return { error }
  }

  async function addMultipleToBox(items) {
    if (!activeBox || !items.length) return { error: null }
    const rows = items.map((item, i) => ({ box_id: activeBox.id, ...item, sort_order: activeItems.length + i }))
    const { error } = await supabase.from('box_items').insert(rows)
    if (!error) { await fetchBoxItems(activeBox.id); await updateBoxTotals(activeBox.id) }
    return { error }
  }

  async function removeItem(itemId) {
    if (!confirm('Remove this bottle?')) return
    const { error } = await supabase.from('box_items').delete().eq('id', itemId)
    if (error) { showStatus('error', 'Failed to remove: ' + error.message); return }
    await fetchBoxItems(activeBox.id)
    await updateBoxTotals(activeBox.id)
  }

  async function updateBoxTotals(boxId) {
    const { data: items } = await supabase.from('box_items').select('dp_price, sale_price, quantity').eq('box_id', boxId)
    if (!items) return
    const totalDP   = items.reduce((s, i) => s + (parseFloat(i.dp_price)   || 0) * (i.quantity || 1), 0)
    const totalSale = items.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
    await supabase.from('boxes').update({ total_dp: totalDP, total_sale: totalSale }).eq('id', boxId)
    setActiveBox(prev => prev ? { ...prev, total_dp: totalDP, total_sale: totalSale } : prev)
  }

  async function confirmBox() {
    if (!activeBox) return
    if (!confirm(`Mark "${activeBox.name}" as Confirmed and deduct quantities from studio?`)) return
    setSaving(true)
    for (const item of activeItems) {
      if (item.studio_id) {
        const { data: se } = await supabase.from('studio').select('id, quantity, status').eq('id', item.studio_id).maybeSingle()
        if (se) {
          const newQty = Math.max(0, (se.quantity || 0) - (item.quantity || 1))
          await supabase.from('studio').update({ quantity: newQty, status: newQty <= 0 ? 'Sold' : se.status }).eq('id', se.id)
        }
      }
    }
    const { error } = await supabase.from('boxes').update({ status: 'Confirmed' }).eq('id', activeBox.id)
    if (error) { showStatus('error', 'Failed to confirm: ' + error.message); setSaving(false); return }
    setActiveBox(prev => ({ ...prev, status: 'Confirmed' }))
    await fetchBoxes()
    setSaving(false)
    showStatus('success', `"${activeBox.name}" confirmed — studio quantities updated.`)
  }

  async function reopenBox() {
    if (!activeBox) return
    const { error } = await supabase.from('boxes').update({ status: 'Draft' }).eq('id', activeBox.id)
    if (error) { showStatus('error', 'Failed to reopen: ' + error.message); return }
    setActiveBox(prev => ({ ...prev, status: 'Draft' }))
    setBoxes(prev => prev.map(b => b.id === activeBox.id ? { ...b, status: 'Draft' } : b))
    showStatus('success', `"${activeBox.name}" reopened for editing. Note: studio quantities already deducted — adjust manually if needed.`, 6000)
  }

  async function deleteBox(boxId) {
    if (!confirm('Delete this box and all its items?')) return
    const { error } = await supabase.from('boxes').delete().eq('id', boxId)
    if (error) { showStatus('error', 'Failed to delete: ' + error.message); return }
    if (activeBox?.id === boxId) { setActiveBox(null); setActiveItems([]) }
    await fetchBoxes()
    if (typeof window !== 'undefined' && window.innerWidth < 700) setShowSidebar(true)
  }

  const statusColour = s => s === 'Confirmed' ? '#2d6a4f' : s === 'Sent' ? '#1a5a8a' : '#8a6f1e'
  const totalBottles = activeItems.reduce((s, i) => s + (i.quantity || 1), 0)
  const totalSale    = activeItems.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
  const totalDP      = activeItems.reduce((s, i) => s + (parseFloat(i.dp_price)   || 0) * (i.quantity || 1), 0)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'24px', color:'var(--wine)' }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--cream)', overflowX:'hidden' }}>

      {/* Nav */}
      <div style={{ background:'var(--ink)', color:'var(--white)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', height:'52px', position:'fixed', top:0, left:0, width:'100%', zIndex:100, boxSizing:'border-box' }}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300, letterSpacing:'0.1em', color:'#d4ad45', flexShrink:0, marginRight:'8px' }}>Cellar</div>
        <div style={{ display:'flex', gap:'1px', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          {[['Studio','/studio'],['Bonded Storage','/admin'],['Box Builder','/boxes'],['Buyer View','/buyer'],['Bottles On Hand','/local'],['Consignment','/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)}
              style={{ background: path === '/boxes' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/boxes' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border:'none', fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', padding:'6px 8px', borderRadius:'2px', whiteSpace:'nowrap', flexShrink:0 }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }}
          style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.5)', fontFamily:'DM Mono,monospace', fontSize:'9px', cursor:'pointer', padding:'4px 8px', flexShrink:0, marginLeft:'6px' }}>Out</button>
      </div>

      {/* Status toast */}
      {statusMsg && (
        <div style={{ position:'fixed', top:'60px', left:'50%', transform:'translateX(-50%)', zIndex:400, background: statusMsg.type === 'success' ? 'rgba(45,106,79,0.95)' : 'rgba(192,57,43,0.95)', color:'var(--white)', padding:'10px 20px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.05em', border:'1px solid rgba(255,255,255,0.15)', whiteSpace:'nowrap', pointerEvents:'none', maxWidth:'90vw', overflow:'hidden', textOverflow:'ellipsis' }}>
          {statusMsg.type === 'success' ? '✓ ' : '✕ '}{statusMsg.text}
        </div>
      )}

      {/* Body */}
      <div style={{ paddingTop:'52px', display:'grid', gridTemplateColumns: showSidebar && !activeBox ? '1fr' : showSidebar ? 'minmax(220px,260px) 1fr' : '1fr', minHeight:'calc(100vh - 52px)' }}>

        {/* Sidebar */}
        {showSidebar && (
          <div style={{ borderRight: activeBox ? '1px solid var(--border)' : 'none', padding:'16px', background:'var(--cream)' }}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'14px' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300 }}>Boxes</div>
              <button onClick={() => setShowNewBoxModal(true)}
                style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'5px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>+ New</button>
            </div>
            {boxes.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', border:'1px dashed var(--border)', background:'var(--white)' }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', color:'var(--muted)', marginBottom:'10px' }}>No boxes yet</div>
                <button onClick={() => setShowNewBoxModal(true)} style={{ background:'none', border:'1px solid var(--wine)', color:'var(--wine)', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer' }}>Build first box</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {boxes.map(box => (
                  <div key={box.id} onClick={() => openBox(box)}
                    style={{ padding:'10px 12px', background: activeBox?.id === box.id ? 'var(--ink)' : 'var(--white)', border:`1px solid ${activeBox?.id === box.id ? 'var(--ink)' : 'var(--border)'}`, cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'6px' }}>
                      <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', color: activeBox?.id === box.id ? '#d4ad45' : 'var(--ink)', fontWeight:500, lineHeight:1.2 }}>{box.name}</div>
                      <span style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color: activeBox?.id === box.id ? 'rgba(212,173,69,0.7)' : statusColour(box.status), fontWeight:500, letterSpacing:'0.08em', flexShrink:0 }}>{box.status}</span>
                    </div>
                    <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color: activeBox?.id === box.id ? 'rgba(253,250,245,0.5)' : 'var(--muted)', marginTop:'2px' }}>{box.buyer_name}</div>
                    {box.total_sale > 0 && <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color: activeBox?.id === box.id ? 'rgba(212,173,69,0.7)' : 'var(--wine)', marginTop:'3px' }}>£{parseFloat(box.total_sale).toFixed(2)}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main */}
        <div style={{ padding:'16px' }}>
          {!showSidebar && (
            <button onClick={() => { setShowSidebar(true); setActiveBox(null) }}
              style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'6px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', marginBottom:'14px' }}>
              ← All Boxes
            </button>
          )}

          {!activeBox ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'300px', border:'1px dashed var(--border)', background:'var(--white)' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', color:'var(--muted)', fontWeight:300, marginBottom:'6px' }}>Select or create a box</div>
                <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>Build a curated pull list for your buyers</div>
              </div>
            </div>
          ) : (
            <div>
              {/* Box header */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
                <div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:300 }}>{activeBox.name}</div>
                  <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px' }}>
                    {activeBox.buyer_name}{activeBox.buyer_email && ` · ${activeBox.buyer_email}`}
                    <span style={{ marginLeft:'10px', color:statusColour(activeBox.status), fontWeight:500 }}>{activeBox.status}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {/* Add/edit buttons — always visible */}
                  <button onClick={() => setShowAddBottle(true)}
                    style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                    + One Bottle
                  </button>
                  <button onClick={() => setShowMultiBottle(true)}
                    style={{ background:'none', border:'1px solid var(--wine)', color:'var(--wine)', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                    📷 Multi
                  </button>
                  {activeItems.length > 0 && (
                    <button onClick={() => setShowPullList(true)}
                      style={{ background:'none', border:'1px solid var(--ink)', color:'var(--ink)', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                      🖨 Pull List
                    </button>
                  )}
                  {/* Confirm — only when Draft */}
                  {activeBox.status === 'Draft' && activeItems.length > 0 && (
                    <button onClick={confirmBox} disabled={saving}
                      style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                      {saving ? 'Saving…' : '✓ Confirm'}
                    </button>
                  )}
                  {/* Reopen — only when Confirmed */}
                  {activeBox.status === 'Confirmed' && (
                    <button onClick={reopenBox}
                      style={{ background:'none', border:'1px solid #b8942a', color:'#7a5e10', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                      ✏ Reopen
                    </button>
                  )}
                  <button onClick={() => deleteBox(activeBox.id)}
                    style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕</button>
                </div>
              </div>

              {/* Stats bar */}
              {activeItems.length > 0 && (
                <div style={{ display:'flex', gap:'16px', padding:'10px 14px', background:'var(--white)', border:'1px solid var(--border)', marginBottom:'12px', fontSize:'11px', flexWrap:'wrap' }}>
                  {[['bottles', totalBottles], ['cost', `£${totalDP.toFixed(2)}`], ['sale', `£${totalSale.toFixed(2)}`], ['margin', `£${(totalSale-totalDP).toFixed(2)}`]].map(([label, val]) => (
                    <div key={label} style={{ display:'flex', gap:'5px', alignItems:'baseline' }}>
                      <span style={{ fontWeight:600, color:'var(--wine)', fontSize:'13px', fontFamily:'DM Mono,monospace' }}>{val}</span>
                      <span style={{ color:'var(--muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Items list */}
              {activeItems.length === 0 ? (
                <div style={{ padding:'36px', textAlign:'center', border:'1px dashed var(--border)', background:'var(--white)' }}>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', color:'var(--muted)' }}>No bottles yet — tap + One Bottle to start</div>
                </div>
              ) : (
                <div style={{ border:'1px solid var(--border)', background:'var(--white)' }}>
                  {activeItems.map((item, idx) => {
                    const fd = item.wine_description || ''
                    const ci = fd.indexOf(',')
                    const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
                    const pp = ci > -1 ? fd.slice(ci + 1).trim() : ''
                    const margin = item.sale_price && item.dp_price
                      ? ((parseFloat(item.sale_price) - parseFloat(item.dp_price)) / parseFloat(item.dp_price) * 100).toFixed(1)
                      : null
                    return (
                      <div key={item.id} style={{ padding:'12px 14px', borderBottom: idx < activeItems.length-1 ? '1px solid #ede6d6' : 'none', display:'grid', gridTemplateColumns:'1fr auto', gap:'10px', alignItems:'start' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:'7px', flexWrap:'wrap' }}>
                            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:colourDot(item.wine_colour), display:'inline-block', flexShrink:0 }}></span>
                            <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{wp}</span>
                            {item.wine_vintage && <span style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>{item.wine_vintage}</span>}
                            {item.quantity > 1 && <span style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', background:'var(--ink)', color:'#d4ad45', padding:'1px 5px', borderRadius:'2px' }}>×{item.quantity}</span>}
                            {!item.studio_id && <span style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color:'#b8942a', background:'rgba(184,148,42,0.1)', padding:'1px 5px', borderRadius:'2px', letterSpacing:'0.06em' }}>not in studio</span>}
                          </div>
                          {pp && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginLeft:'15px', marginTop:'1px' }}>{pp}</div>}
                          {item.wine_region && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginLeft:'15px', marginTop:'2px' }}>{item.wine_region}</div>}
                          {item.tasting_note && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', fontStyle:'italic', color:'#3a2a1a', marginTop:'6px', marginLeft:'15px', lineHeight:1.5 }}>"{item.tasting_note}"</div>}
                          {item.producer_note && <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'3px', marginLeft:'15px', lineHeight:1.4 }}>{item.producer_note}</div>}
                        </div>
                        <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px' }}>
                          <div style={{ fontFamily:'DM Mono,monospace', fontSize:'14px', fontWeight:500, color:'var(--wine)' }}>
                            {item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}
                          </div>
                          {item.dp_price && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>DP £{parseFloat(item.dp_price).toFixed(2)}</div>}
                          {margin && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color: parseFloat(margin) >= 0 ? '#2d6a4f' : '#c0392b' }}>{parseFloat(margin) >= 0 ? '+' : ''}{margin}%</div>}
                          {/* Remove always available — not just on Draft */}
                          <button onClick={() => removeItem(item.id)}
                            style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'11px', cursor:'pointer', marginTop:'2px', fontFamily:'DM Mono,monospace' }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Box Modal */}
      {showNewBoxModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'var(--cream)', width:'100%', maxWidth:'420px', padding:'24px', border:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:300, marginBottom:'16px' }}>New Box</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
              {[
                ['Box name *', newName, setNewName, 'e.g. Lauren — Spring 2026', 'Cormorant Garamond,serif', '16px'],
                ['Buyer name *', newBuyer, setNewBuyer, 'e.g. Lauren', 'DM Mono,monospace', '13px'],
                ['Email (optional)', newEmail, setNewEmail, 'lauren@example.com', 'DM Mono,monospace', '13px'],
                ['Notes (optional)', newNotes, setNewNotes, 'e.g. Mostly Burgundy…', 'DM Mono,monospace', '12px'],
              ].map(([label, val, setter, ph, ff, fs]) => (
                <div key={label}>
                  <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace' }}>{label}</label>
                  <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                    style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:ff, fontSize:fs, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowNewBoxModal(false)} style={{ background:'none', border:'1px solid var(--border)', padding:'9px 18px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>Cancel</button>
              <button onClick={createBox} disabled={!newName || !newBuyer || saving}
                style={{ background: newName && newBuyer ? 'var(--ink)' : '#ccc', color:'var(--white)', border:'none', padding:'9px 18px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor: newName && newBuyer ? 'pointer' : 'not-allowed' }}>
                {saving ? 'Creating…' : 'Create →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddBottle   && <AddBottleModal onAdd={addItemToBox} onClose={() => setShowAddBottle(false)} />}
      {showMultiBottle && <MultiBottleModal onAddAll={addMultipleToBox} onClose={() => setShowMultiBottle(false)} />}
      {showPullList    && activeBox && <PullListView box={activeBox} items={activeItems} onClose={() => setShowPullList(false)} />}
    </div>
  )
}
