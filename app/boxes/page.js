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

// ─── Parent ID generation ─────────────────────────────────────────────────────
function generateParentId(description, vintage, colour, bottleSize) {
  const yy = vintage ? String(vintage).slice(-2) : 'XX'
  const words = (description || '').replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/)
  const mm = words[0] ? words[0].slice(0, 2).toUpperCase() : 'XX'
  const ww = words[1] ? words[1].slice(0, 4).toUpperCase() : (words[0] ? words[0].slice(2, 6).toUpperCase() : 'XXXX')
  const c = colour ? colour.slice(0, 1).toUpperCase() : 'X'
  const s = String(bottleSize) === '150' ? 'M' : String(bottleSize) === '37.5' ? 'H' : 'B'
  return `${yy} ${mm} ${ww} ${c} ${s}`
}

async function ensureParentId(studioId, entry) {
  if (entry.parent_id) return entry.parent_id
  const w = entry.wines
  let pid
  if (w?.source_id) {
    pid = w.source_id
  } else {
    const desc    = w?.description || entry.unlinked_description || ''
    const vintage = w?.vintage     || entry.unlinked_vintage     || ''
    const colour  = w?.colour      || entry.colour               || ''
    const size    = entry.bottle_size || '75'
    pid = generateParentId(desc, vintage, colour, size)
  }
  await supabase.from('studio').update({ parent_id: pid }).eq('id', studioId)
  return pid
}

// ─── Pull List print view ─────────────────────────────────────────────────────
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
          <div className="foot" style={{ marginTop:'40px', paddingTop:'16px', borderTop:'1px solid #ede6d6', fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#c8b89a', textAlign:'center', letterSpacing:'0.1em' }}>KIKI-504 · {new Date().getFullYear()}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Bottle Modal ─────────────────────────────────────────────────────────
function AddBottleModal({ onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(1)
  const [tastingNote, setTastingNote] = useState('')
  const [producerNote, setProducerNote] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState(null)
  const fileRef = useRef(null)

  async function searchStudio(q) {
    setSearch(q)
    if (q.length < 2) { setResults([]); return }
    const { data } = await supabase
      .from('studio')
      .select('id, quantity, dp_price, sale_price, bottle_size, colour, unlinked_description, unlinked_vintage, parent_id, wines(id, description, vintage, colour, region, purchase_price_per_bottle, women_note, producer_note, source_id)')
      .eq('status', 'Available')
      .or(`unlinked_description.ilike.%${q}%,wines.description.ilike.%${q}%`)
      .order('unlinked_description')
      .limit(10)
    setResults(data || [])
  }

  function selectEntry(entry) {
    const w = entry.wines
    setSelected({
      ...entry,
      _desc:    w?.description || entry.unlinked_description || '',
      _vintage: w?.vintage     || entry.unlinked_vintage     || '',
      _colour:  w?.colour      || entry.colour               || '',
      _region:  w?.region      || '',
      _dp:      entry.dp_price ? parseFloat(entry.dp_price)  : null,
    })
    setSalePrice(entry.sale_price ? String(parseFloat(entry.sale_price)) : '')
    setTastingNote(w?.women_note    || '')
    setProducerNote(w?.producer_note || '')
    setSearch(w?.description || entry.unlinked_description || '')
    setResults([])
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
      setScanResult(ex)
      const searchTerm = ex.producer || ex.wine_name
      if (searchTerm) {
        const { data } = await supabase
          .from('studio')
          .select('id, quantity, dp_price, sale_price, bottle_size, colour, unlinked_description, unlinked_vintage, parent_id, wines(id, description, vintage, colour, region, purchase_price_per_bottle, women_note, producer_note, source_id)')
          .eq('status', 'Available')
          .or(`unlinked_description.ilike.%${searchTerm}%,wines.description.ilike.%${searchTerm}%`)
          .limit(5)
        if (data && data.length > 0) selectEntry(data[0])
        else setSearch([ex.wine_name, ex.producer].filter(Boolean).join(', '))
      }
    } catch (err) {
      alert('Label read failed: ' + err.message)
    }
    setScanning(false)
  }

  async function confirm() {
    if (!selected) return
    setSaving(true)
    const parentId = await ensureParentId(selected.id, selected)
    await onAdd({
      studio_id:        selected.id,
      wine_description: selected._desc,
      wine_vintage:     selected._vintage,
      wine_colour:      selected._colour,
      wine_region:      selected._region,
      dp_price:         selected._dp,
      sale_price:       salePrice ? parseFloat(salePrice) : null,
      quantity:         qty,
      tasting_note:     tastingNote  || null,
      producer_note:    producerNote || null,
      parent_id:        parentId,
    })
    setJustAdded(selected._desc)
    // Reset for next bottle — modal stays open
    setSelected(null)
    setSearch('')
    setResults([])
    setQty(1)
    setSalePrice('')
    setTastingNote('')
    setProducerNote('')
    setImageFile(null)
    setImagePreview(null)
    setScanResult(null)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.75)', zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'540px', border:'1px solid var(--border)', maxHeight:'92vh', overflowY:'auto' }}>

        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', padding:'18px 18px 0' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300 }}>Add a Bottle</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--muted)' }}>✕</button>
        </div>

        <div style={{ padding:'14px 18px 22px' }}>

          {/* ✓ Just added banner — stays visible while adding more */}
          {justAdded && (
            <div style={{ background:'rgba(45,106,79,0.1)', border:'1px solid rgba(45,106,79,0.3)', padding:'10px 14px', marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'#2d6a4f' }}>
                ✓ Added: <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{justAdded.split(',')[0]}</span>
              </span>
              <button onClick={onClose}
                style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'5px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
                Done — close ✓
              </button>
            </div>
          )}

          {/* Photo */}
          <div style={{ marginBottom:'12px' }}>
            <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'6px', fontFamily:'DM Mono,monospace' }}>
              {justAdded ? 'Add another by photo' : 'Identify by photo'}
            </label>
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
              <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <img src={imagePreview} alt="Label" style={{ width:'52px', height:'66px', objectFit:'cover', border:'1px solid var(--border)' }} />
                <div style={{ flex:1 }}>
                  {scanResult
                    ? <div style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'#2d6a4f' }}>✓ {[scanResult.wine_name, scanResult.producer, scanResult.vintage].filter(Boolean).join(' · ')}</div>
                    : <button onClick={analyseImage} disabled={scanning} style={{ background:'var(--ink)', color:'#d4ad45', border:'none', padding:'7px 12px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:scanning?'wait':'pointer' }}>{scanning ? '🔍 Reading…' : '🔍 Read Label'}</button>
                  }
                  <button onClick={() => { setImageFile(null); setImagePreview(null); setScanResult(null) }}
                    style={{ display:'block', marginTop:'4px', background:'none', border:'none', fontSize:'10px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace' }}>✕ Remove</button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ marginBottom:'12px' }}>
            <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'6px', fontFamily:'DM Mono,monospace' }}>
              {justAdded ? 'Or search for next bottle' : 'Search studio inventory'}
            </label>
            <input value={search} onChange={e => { searchStudio(e.target.value); if (selected) setSelected(null) }}
              placeholder="Start typing a wine name…"
              style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
            {results.length > 0 && !selected && (
              <div style={{ border:'1px solid var(--border)', borderTop:'none', background:'var(--white)', maxHeight:'180px', overflowY:'auto' }}>
                {results.map(entry => {
                  const w = entry.wines
                  const desc = w?.description || entry.unlinked_description || ''
                  const vintage = w?.vintage || entry.unlinked_vintage || ''
                  const colour = w?.colour || entry.colour || ''
                  return (
                    <div key={entry.id} onClick={() => selectEntry(entry)}
                      style={{ padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid #ede6d6', display:'flex', alignItems:'center', gap:'8px' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f0e8'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:colourDot(colour), flexShrink:0, display:'inline-block' }}></span>
                      <div>
                        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{desc}</div>
                        <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono,monospace' }}>{vintage} · DP {entry.dp_price ? `£${parseFloat(entry.dp_price).toFixed(2)}` : '—'} · {entry.quantity} avail</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected */}
          {selected && (
            <div style={{ background:'rgba(107,30,46,0.06)', border:'1px solid rgba(107,30,46,0.2)', padding:'10px 12px', marginBottom:'12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{selected._desc}</div>
                  <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px' }}>
                    {selected._vintage}{selected._region && ` · ${selected._region}`} · {selected.quantity} in studio · DP {selected._dp ? `£${selected._dp.toFixed(2)}` : '—'}
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setSearch('') }}
                  style={{ background:'none', border:'none', fontSize:'12px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace', flexShrink:0 }}>✕</button>
              </div>
            </div>
          )}

          {selected && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>Quantity</label>
                  <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} onFocus={e => e.target.select()}
                    style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'16px', fontWeight:600, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>Sale price (£/btl)</label>
                  <input type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" onFocus={e => e.target.select()}
                    style={{ width:'100%', border:'2px solid rgba(107,30,46,0.25)', background:'rgba(107,30,46,0.03)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'14px', fontWeight:600, outline:'none', boxSizing:'border-box', color:'var(--wine)' }} />
                  {salePrice && selected._dp && (() => {
                    const m = ((parseFloat(salePrice) - selected._dp) / selected._dp * 100)
                    return <div style={{ fontSize:'10px', color: m >= 0 ? '#2d6a4f' : '#c0392b', marginTop:'3px', fontFamily:'DM Mono,monospace' }}>{m >= 0 ? '+' : ''}{m.toFixed(1)}% on DP</div>
                  })()}
                </div>
              </div>

              <div style={{ marginBottom:'10px' }}>
                <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                  Tasting note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(italic on pull list)</span>
                </label>
                <textarea value={tastingNote} onChange={e => setTastingNote(e.target.value)}
                  placeholder="Rich, concentrated dark fruit with silky tannins…" rows={3}
                  style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontStyle:'italic', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
              </div>

              <div style={{ marginBottom:'14px' }}>
                <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                  Producer note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(optional)</span>
                </label>
                <textarea value={producerNote} onChange={e => setProducerNote(e.target.value)}
                  placeholder="Brief context about the producer or appellation…" rows={2}
                  style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'11px', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
              </div>

              <button onClick={confirm} disabled={saving}
                style={{ width:'100%', background:'var(--wine)', color:'var(--white)', border:'none', padding:'13px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.15em', textTransform:'uppercase', cursor:saving?'wait':'pointer', fontWeight:600 }}>
                {saving ? 'Adding…' : '✓ Add to Box — add another?'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Box Builder ─────────────────────────────────────────────────────────
export default function BoxPage() {
  const router = useRouter()
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeBox, setActiveBox] = useState(null)
  const [activeItems, setActiveItems] = useState([])
  const [showNewBoxModal, setShowNewBoxModal] = useState(false)
  const [showAddBottle, setShowAddBottle] = useState(false)
  const [showPullList, setShowPullList] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState('')
  const [newBuyer, setNewBuyer] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newNotes, setNewNotes] = useState('')

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchBoxes()
  }, [])

  async function fetchBoxes() {
    setLoading(true)
    const { data } = await supabase.from('boxes').select('*').order('created_at', { ascending: false })
    setBoxes(data || [])
    setLoading(false)
  }

  async function fetchBoxItems(boxId) {
    const { data } = await supabase.from('box_items').select('*').eq('box_id', boxId).order('sort_order', { ascending: true })
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
    if (!error) {
      await fetchBoxes()
      setShowNewBoxModal(false)
      setNewName(''); setNewBuyer(''); setNewEmail(''); setNewNotes('')
      openBox(data)
    }
    setSaving(false)
  }

  async function addItemToBox(item) {
    if (!activeBox) return
    await supabase.from('box_items').insert({ box_id: activeBox.id, ...item, sort_order: activeItems.length })
    await fetchBoxItems(activeBox.id)
    await updateBoxTotals(activeBox.id)
    // Modal stays open for next bottle
  }

  async function removeItem(itemId) {
    if (!confirm('Remove this bottle?')) return
    await supabase.from('box_items').delete().eq('id', itemId)
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
    await supabase.from('boxes').update({ status: 'Confirmed' }).eq('id', activeBox.id)
    setActiveBox(prev => ({ ...prev, status: 'Confirmed' }))
    await fetchBoxes()
    setSaving(false)
    alert('Box confirmed — studio quantities updated.')
  }

  async function deleteBox(boxId) {
    if (!confirm('Delete this box?')) return
    await supabase.from('boxes').delete().eq('id', boxId)
    if (activeBox?.id === boxId) { setActiveBox(null); setActiveItems([]) }
    await fetchBoxes()
    if (typeof window !== 'undefined' && window.innerWidth < 700) setShowSidebar(true)
  }

  const statusColour = s => s === 'Confirmed' ? '#2d6a4f' : s === 'Sent' ? '#1a5a8a' : '#8a6f1e'
  const totalBottles = activeItems.reduce((s, i) => s + (i.quantity || 1), 0)
  const totalSale    = activeItems.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
  const totalDP      = activeItems.reduce((s, i) => s + (parseFloat(i.dp_price)   || 0) * (i.quantity || 1), 0)

  const NAV = [['Inventory','/admin'],['Studio','/studio'],['Box Builder','/boxes'],['Labels','/labels'],['Buyer View','/buyer'],['Local Sales','/local']]

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
          {NAV.map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)}
              style={{ background: path === '/boxes' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/boxes' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border:'none', fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', padding:'6px 8px', borderRadius:'2px', whiteSpace:'nowrap', flexShrink:0 }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }}
          style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.5)', fontFamily:'DM Mono,monospace', fontSize:'9px', cursor:'pointer', padding:'4px 8px', flexShrink:0, marginLeft:'6px' }}>Out</button>
      </div>

      {/* Body: sidebar + main, collapses on mobile */}
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

          {/* Mobile back button */}
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
                  {activeBox.status === 'Draft' && (
                    <button onClick={() => setShowAddBottle(true)}
                      style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                      + Add Bottle
                    </button>
                  )}
                  {activeItems.length > 0 && (
                    <button onClick={() => setShowPullList(true)}
                      style={{ background:'none', border:'1px solid var(--ink)', color:'var(--ink)', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                      🖨 Pull List
                    </button>
                  )}
                  {activeBox.status === 'Draft' && activeItems.length > 0 && (
                    <button onClick={confirmBox} disabled={saving}
                      style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                      {saving ? 'Saving…' : '✓ Confirm'}
                    </button>
                  )}
                  <button onClick={() => deleteBox(activeBox.id)}
                    style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕</button>
                </div>
              </div>

              {/* Stats */}
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

              {/* Items */}
              {activeItems.length === 0 ? (
                <div style={{ padding:'36px', textAlign:'center', border:'1px dashed var(--border)', background:'var(--white)' }}>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', color:'var(--muted)', marginBottom:'14px' }}>No bottles yet</div>
                  <button onClick={() => setShowAddBottle(true)}
                    style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'10px 20px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                    + Add your first bottle
                  </button>
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
                          {activeBox.status === 'Draft' && (
                            <button onClick={() => removeItem(item.id)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'11px', cursor:'pointer', marginTop:'2px', fontFamily:'DM Mono,monospace' }}>✕</button>
                          )}
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

      {showAddBottle && <AddBottleModal onAdd={addItemToBox} onClose={() => setShowAddBottle(false)} />}
      {showPullList && activeBox && <PullListView box={activeBox} items={activeItems} onClose={() => setShowPullList(false)} />}
    </div>
  )
}
