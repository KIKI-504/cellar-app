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

function fmt(n) {
  if (n == null) return '—'
  return `£${parseFloat(n).toFixed(2)}`
}

// ─── Pull List print/share view ───────────────────────────────────────────────
function PullListView({ box, items, onClose }) {
  const printRef = useRef(null)

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = document.createElement('iframe')
    win.style.display = 'none'
    document.body.appendChild(win)
    win.contentDocument.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${box.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cormorant Garamond', serif; color: #1a1008; background: #fff; padding: 40px; }
        .header { border-bottom: 1px solid #c8b89a; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title { font-size: 28px; font-weight: 300; letter-spacing: 0.05em; }
        .header-sub { font-size: 12px; font-family: 'DM Mono', monospace; color: #7a6652; margin-top: 4px; }
        .header-meta { text-align: right; font-size: 11px; font-family: 'DM Mono', monospace; color: #7a6652; }
        .wine-card { padding: 18px 0; border-bottom: 1px solid #ede6d6; display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; }
        .wine-card:last-child { border-bottom: none; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
        .wine-name { font-size: 18px; font-weight: 500; line-height: 1.2; }
        .wine-producer { font-size: 14px; color: #3a2a1a; margin-top: 2px; }
        .wine-meta { font-size: 11px; font-family: 'DM Mono', monospace; color: #7a6652; margin-top: 6px; }
        .tasting-note { font-size: 13px; font-style: italic; color: #3a2a1a; margin-top: 10px; line-height: 1.6; }
        .producer-note { font-size: 12px; font-family: 'DM Mono', monospace; color: #7a6652; margin-top: 6px; line-height: 1.5; }
        .price-block { text-align: right; min-width: 80px; }
        .price-label { font-size: 9px; font-family: 'DM Mono', monospace; color: #7a6652; text-transform: uppercase; letter-spacing: 0.1em; }
        .price-value { font-size: 16px; font-weight: 500; color: #6b1e2e; margin-top: 2px; }
        .price-qty { font-size: 10px; font-family: 'DM Mono', monospace; color: #7a6652; margin-top: 2px; }
        .totals { margin-top: 24px; padding-top: 16px; border-top: 2px solid #c8b89a; display: flex; justify-content: flex-end; gap: 32px; }
        .total-item { text-align: right; }
        .total-label { font-size: 10px; font-family: 'DM Mono', monospace; color: #7a6652; text-transform: uppercase; letter-spacing: 0.1em; }
        .total-value { font-size: 20px; font-weight: 500; margin-top: 2px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ede6d6; font-size: 10px; font-family: 'DM Mono', monospace; color: #7a6652; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>${content}</body></html>
    `)
    win.contentDocument.close()
    win.onload = () => {
      win.contentWindow.print()
      document.body.removeChild(win)
    }
  }

  const totalSale = items.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
  const totalDP = items.reduce((s, i) => s + (parseFloat(i.dp_price) || 0) * (i.quantity || 1), 0)
  const totalBottles = items.reduce((s, i) => s + (i.quantity || 1), 0)
  const totalMargin = totalSale - totalDP

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '680px', border: '1px solid var(--border)' }}>

        {/* Controls */}
        <div style={{ background: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(253,250,245,0.5)', textTransform: 'uppercase' }}>Pull List Preview</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handlePrint}
              style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '7px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              🖨 Print
            </button>
            <button onClick={onClose}
              style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.6)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div ref={printRef} style={{ padding: '36px 40px' }}>

          {/* Header */}
          <div style={{ borderBottom: '1px solid #c8b89a', paddingBottom: '20px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 300, letterSpacing: '0.05em' }}>{box.name}</div>
              <div style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '4px' }}>
                For {box.buyer_name}
                {box.buyer_email && <> · {box.buyer_email}</>}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
              <div>{totalBottles} bottle{totalBottles !== 1 ? 's' : ''}</div>
              <div style={{ marginTop: '2px' }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          {/* Wine cards */}
          {items.map((item, i) => {
            const fullDesc = item.wine_description || ''
            const commaIdx = fullDesc.indexOf(',')
            const winePart = commaIdx > -1 ? fullDesc.slice(0, commaIdx).trim() : fullDesc
            const producerPart = commaIdx > -1 ? fullDesc.slice(commaIdx + 1).trim() : ''

            return (
              <div key={item.id} style={{ padding: '18px 0', borderBottom: i < items.length - 1 ? '1px solid #ede6d6' : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: colourDot(item.wine_colour), flexShrink: 0, marginTop: '2px' }}></span>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 500, lineHeight: 1.2 }}>{winePart}</span>
                    {item.wine_vintage && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>{item.wine_vintage}</span>}
                  </div>
                  {producerPart && (
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--ink)', marginTop: '2px', marginLeft: '16px' }}>{producerPart}</div>
                  )}
                  {item.wine_region && (
                    <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '4px', marginLeft: '16px' }}>{item.wine_region}</div>
                  )}
                  {item.tasting_note && (
                    <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#3a2a1a', marginTop: '10px', marginLeft: '16px', lineHeight: 1.6 }}>
                      "{item.tasting_note}"
                    </div>
                  )}
                  {item.producer_note && (
                    <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '6px', marginLeft: '16px', lineHeight: 1.5 }}>
                      {item.producer_note}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>per bottle</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 500, color: 'var(--wine)', marginTop: '2px' }}>
                    {item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}
                  </div>
                  {item.quantity > 1 && (
                    <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '2px' }}>× {item.quantity}</div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Totals */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #c8b89a', display: 'flex', justifyContent: 'flex-end', gap: '32px', flexWrap: 'wrap' }}>
            {totalDP > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cost (DP)</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '18px', fontWeight: 500, marginTop: '2px' }}>£{totalDP.toFixed(2)}</div>
              </div>
            )}
            {totalMargin > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Margin</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '18px', fontWeight: 500, color: '#2d6a4f', marginTop: '2px' }}>£{totalMargin.toFixed(2)}</div>
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '22px', fontWeight: 500, color: 'var(--wine)', marginTop: '2px' }}>£{totalSale.toFixed(2)}</div>
            </div>
          </div>

          {box.notes && (
            <div style={{ marginTop: '24px', padding: '12px 16px', background: 'rgba(212,173,69,0.08)', border: '1px solid rgba(212,173,69,0.25)', fontSize: '12px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
              {box.notes}
            </div>
          )}

          <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #ede6d6', fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#c8b89a', textAlign: 'center', letterSpacing: '0.1em' }}>
            KIKI-504 · {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add bottle modal ─────────────────────────────────────────────────────────
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
  const fileRef = useRef(null)

  async function searchStudio(q) {
    setSearch(q)
    if (q.length < 2) { setResults([]); return }
    const { data } = await supabase
      .from('studio')
      .select('id, quantity, dp_price, sale_price, bottle_size, colour, unlinked_description, unlinked_vintage, wines(id, description, vintage, colour, region, purchase_price_per_bottle, women_note, producer_note)')
      .eq('status', 'Available')
      .or(`unlinked_description.ilike.%${q}%,wines.description.ilike.%${q}%`)
      .order('unlinked_description')
      .limit(10)
    setResults(data || [])
  }

  function selectEntry(entry) {
    const w = entry.wines
    const desc = w?.description || entry.unlinked_description || ''
    const vintage = w?.vintage || entry.unlinked_vintage || ''
    const colour = w?.colour || entry.colour || ''
    const region = w?.region || ''
    const dp = entry.dp_price ? parseFloat(entry.dp_price) : null
    const sale = entry.sale_price ? parseFloat(entry.sale_price) : null

    setSelected({ ...entry, _desc: desc, _vintage: vintage, _colour: colour, _region: region, _dp: dp })
    setSalePrice(sale ? String(sale) : '')
    setTastingNote(w?.women_note || '')
    setProducerNote(w?.producer_note || '')
    setSearch(desc)
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

      // Try to match in studio
      const searchTerm = ex.producer || ex.wine_name
      if (searchTerm) {
        let matches = null
        if (ex.vintage) {
          const { data } = await supabase
            .from('studio')
            .select('id, quantity, dp_price, sale_price, bottle_size, colour, unlinked_description, unlinked_vintage, wines(id, description, vintage, colour, region, purchase_price_per_bottle, women_note, producer_note)')
            .eq('status', 'Available')
            .or(`unlinked_description.ilike.%${searchTerm}%,wines.description.ilike.%${searchTerm}%`)
            .limit(5)
          matches = data
        }
        if (!matches || matches.length === 0) {
          const { data } = await supabase
            .from('studio')
            .select('id, quantity, dp_price, sale_price, bottle_size, colour, unlinked_description, unlinked_vintage, wines(id, description, vintage, colour, region, purchase_price_per_bottle, women_note, producer_note)')
            .eq('status', 'Available')
            .or(`unlinked_description.ilike.%${searchTerm}%,wines.description.ilike.%${searchTerm}%`)
            .limit(5)
          matches = data
        }
        if (matches && matches.length > 0) {
          selectEntry(matches[0])
        } else {
          setSearch([ex.wine_name, ex.producer].filter(Boolean).join(', '))
        }
      }
    } catch (err) {
      alert('Label read failed: ' + err.message)
    }
    setScanning(false)
  }

  function confirm() {
    if (!selected) return
    onAdd({
      studio_id: selected.id,
      wine_description: selected._desc,
      wine_vintage: selected._vintage,
      wine_colour: selected._colour,
      wine_region: selected._region,
      dp_price: selected._dp,
      sale_price: salePrice ? parseFloat(salePrice) : null,
      quantity: qty,
      tasting_note: tastingNote || null,
      producer_note: producerNote || null,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.75)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '560px', border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300 }}>Add a Bottle</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>

          {/* Photo option */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', fontFamily: 'DM Mono, monospace' }}>
              Identify by photo
            </label>
            {!imagePreview ? (
              <div onClick={() => fileRef.current?.click()}
                style={{ border: '1px dashed var(--border)', padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--wine)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <span style={{ fontSize: '18px' }}>📷</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.08em' }}>PHOTO FROM CAMERA ROLL</span>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <img src={imagePreview} alt="Label" style={{ width: '64px', height: '80px', objectFit: 'cover', border: '1px solid var(--border)' }} />
                <div style={{ flex: 1 }}>
                  {scanResult ? (
                    <div style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace', color: '#2d6a4f' }}>
                      ✓ Read: {[scanResult.wine_name, scanResult.producer, scanResult.vintage].filter(Boolean).join(' · ')}
                    </div>
                  ) : (
                    <button onClick={analyseImage} disabled={scanning}
                      style={{ background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: scanning ? 'wait' : 'pointer' }}>
                      {scanning ? '🔍 Reading…' : '🔍 Read Label'}
                    </button>
                  )}
                  <button onClick={() => { setImageFile(null); setImagePreview(null); setScanResult(null) }}
                    style={{ display: 'block', marginTop: '6px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
                    ✕ Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono, monospace' }}>
              Or search studio inventory
            </label>
            <input value={search} onChange={e => searchStudio(e.target.value)} placeholder="Start typing a wine name…"
              style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            {results.length > 0 && !selected && (
              <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '200px', overflowY: 'auto' }}>
                {results.map(entry => {
                  const w = entry.wines
                  const desc = w?.description || entry.unlinked_description || ''
                  const vintage = w?.vintage || entry.unlinked_vintage || ''
                  const dp = entry.dp_price ? `£${parseFloat(entry.dp_price).toFixed(2)}` : '—'
                  const colour = w?.colour || entry.colour || ''
                  return (
                    <div key={entry.id} onClick={() => selectEntry(entry)}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6', display: 'flex', alignItems: 'center', gap: '8px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colourDot(colour), flexShrink: 0, display: 'inline-block' }}></span>
                      <div>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{desc}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{vintage} · DP {dp} · {entry.quantity} avail</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected wine confirmation */}
          {selected && (
            <div style={{ background: 'rgba(107,30,46,0.06)', border: '1px solid rgba(107,30,46,0.2)', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{selected._desc}</div>
                  <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '3px' }}>
                    {selected._vintage} · {selected._region || selected._colour} · {selected.quantity} in studio
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '2px' }}>
                    DP {selected._dp ? `£${selected._dp.toFixed(2)}` : '—'}
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setSearch(''); setSalePrice(''); setTastingNote(''); setProducerNote('') }}
                  style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>✕ Change</button>
              </div>
            </div>
          )}

          {/* Details */}
          {selected && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Quantity</label>
                  <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
                    onFocus={e => e.target.select()}
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sale price (£/btl)</label>
                  <input type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00"
                    onFocus={e => e.target.select()}
                    style={{ width: '100%', border: '2px solid rgba(107,30,46,0.25)', background: 'rgba(107,30,46,0.03)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
                  {salePrice && selected._dp && (() => {
                    const margin = ((parseFloat(salePrice) - selected._dp) / selected._dp * 100)
                    return <div style={{ fontSize: '10px', color: margin >= 0 ? '#2d6a4f' : '#c0392b', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>
                      {margin >= 0 ? '+' : ''}{margin.toFixed(1)}% on DP
                    </div>
                  })()}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Tasting note <span style={{ color: 'rgba(107,30,46,0.5)' }}>(shown on pull list)</span>
                </label>
                <textarea value={tastingNote} onChange={e => setTastingNote(e.target.value)}
                  placeholder="Appears as italic quote on the pull list…"
                  rows={3}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', fontStyle: 'italic', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Producer note <span style={{ color: 'rgba(107,30,46,0.5)' }}>(optional context)</span>
                </label>
                <textarea value={producerNote} onChange={e => setProducerNote(e.target.value)}
                  placeholder="Brief context about the producer or appellation…"
                  rows={2}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <button onClick={confirm}
                style={{ width: '100%', background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '13px', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                ✓ Add to Box
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Box Builder page ────────────────────────────────────────────────────
export default function BoxPage() {
  const router = useRouter()
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeBox, setActiveBox] = useState(null)
  const [activeItems, setActiveItems] = useState([])
  const [showNewBoxModal, setShowNewBoxModal] = useState(false)
  const [showAddBottle, setShowAddBottle] = useState(false)
  const [showPullList, setShowPullList] = useState(false)
  const [saving, setSaving] = useState(false)

  // New box form
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
    const { data } = await supabase
      .from('boxes')
      .select('*')
      .order('created_at', { ascending: false })
    setBoxes(data || [])
    setLoading(false)
  }

  async function fetchBoxItems(boxId) {
    const { data } = await supabase
      .from('box_items')
      .select('*')
      .eq('box_id', boxId)
      .order('sort_order', { ascending: true })
    setActiveItems(data || [])
  }

  async function openBox(box) {
    setActiveBox(box)
    await fetchBoxItems(box.id)
  }

  async function createBox() {
    if (!newName || !newBuyer) return
    setSaving(true)
    const { data, error } = await supabase.from('boxes').insert({
      name: newName,
      buyer_name: newBuyer,
      buyer_email: newEmail || null,
      notes: newNotes || null,
      status: 'Draft'
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
    const sortOrder = activeItems.length
    const { error } = await supabase.from('box_items').insert({
      box_id: activeBox.id,
      ...item,
      sort_order: sortOrder
    })
    if (!error) {
      await fetchBoxItems(activeBox.id)
      await updateBoxTotals(activeBox.id)
      setShowAddBottle(false)
    }
  }

  async function removeItem(itemId) {
    if (!confirm('Remove this bottle from the box?')) return
    await supabase.from('box_items').delete().eq('id', itemId)
    await fetchBoxItems(activeBox.id)
    await updateBoxTotals(activeBox.id)
  }

  async function updateBoxTotals(boxId) {
    const { data: items } = await supabase.from('box_items').select('dp_price, sale_price, quantity').eq('box_id', boxId)
    if (!items) return
    const totalDP = items.reduce((s, i) => s + (parseFloat(i.dp_price) || 0) * (i.quantity || 1), 0)
    const totalSale = items.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
    await supabase.from('boxes').update({ total_dp: totalDP, total_sale: totalSale }).eq('id', boxId)
    setActiveBox(prev => prev ? { ...prev, total_dp: totalDP, total_sale: totalSale } : prev)
  }

  async function confirmBox() {
    if (!activeBox) return
    if (!confirm(`Mark "${activeBox.name}" as Confirmed and reserve ${activeItems.length} item(s) in studio inventory?`)) return
    setSaving(true)

    // Update studio quantities for each item
    for (const item of activeItems) {
      if (item.studio_id) {
        const { data: studioEntry } = await supabase
          .from('studio').select('id, quantity, status').eq('id', item.studio_id).maybeSingle()
        if (studioEntry) {
          const newQty = (studioEntry.quantity || 0) - (item.quantity || 1)
          await supabase.from('studio').update({
            quantity: Math.max(0, newQty),
            status: newQty <= 0 ? 'Sold' : studioEntry.status
          }).eq('id', item.studio_id)
        }
      }
    }

    await supabase.from('boxes').update({ status: 'Confirmed' }).eq('id', activeBox.id)
    setActiveBox(prev => ({ ...prev, status: 'Confirmed' }))
    await fetchBoxes()
    setSaving(false)
    alert('Box confirmed! Studio quantities updated.')
  }

  async function deleteBox(boxId) {
    if (!confirm('Delete this box? This cannot be undone.')) return
    await supabase.from('boxes').delete().eq('id', boxId)
    if (activeBox?.id === boxId) { setActiveBox(null); setActiveItems([]) }
    await fetchBoxes()
  }

  const statusColour = s => s === 'Confirmed' ? '#2d6a4f' : s === 'Sent' ? '#1a5a8a' : '#8a6f1e'
  const totalBottles = activeItems.reduce((s, i) => s + (i.quantity || 1), 0)
  const totalSale = activeItems.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) * (i.quantity || 1), 0)
  const totalDP = activeItems.reduce((s, i) => s + (parseFloat(i.dp_price) || 0) * (i.quantity || 1), 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['Inventory', '/admin'], ['Studio', '/studio'], ['Boxes', '/boxes'], ['Labels', '/labels'], ['Buyer View', '/buyer'], ['Local Sales', '/local']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)}
              style={{ background: path === '/boxes' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/boxes' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }}
          style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '76px 28px 40px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* Sidebar — box list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Boxes</div>
            <button onClick={() => setShowNewBoxModal(true)}
              style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              + New
            </button>
          </div>

          {boxes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border)', background: 'var(--white)' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--muted)', marginBottom: '12px' }}>No boxes yet</div>
              <button onClick={() => setShowNewBoxModal(true)}
                style={{ background: 'none', border: '1px solid var(--wine)', color: 'var(--wine)', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>
                Build your first box
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {boxes.map(box => (
                <div key={box.id}
                  onClick={() => openBox(box)}
                  style={{ padding: '12px 14px', background: activeBox?.id === box.id ? 'var(--ink)' : 'var(--white)', border: `1px solid ${activeBox?.id === box.id ? 'var(--ink)' : 'var(--border)'}`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: activeBox?.id === box.id ? '#d4ad45' : 'var(--ink)', fontWeight: 500 }}>{box.name}</div>
                    <span style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', color: activeBox?.id === box.id ? 'rgba(212,173,69,0.7)' : statusColour(box.status), fontWeight: 500, letterSpacing: '0.08em' }}>{box.status}</span>
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: activeBox?.id === box.id ? 'rgba(253,250,245,0.5)' : 'var(--muted)', marginTop: '3px' }}>{box.buyer_name}</div>
                  {box.total_sale > 0 && (
                    <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: activeBox?.id === box.id ? 'rgba(212,173,69,0.7)' : 'var(--wine)', marginTop: '4px' }}>
                      £{parseFloat(box.total_sale).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main — active box */}
        {!activeBox ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', border: '1px dashed var(--border)', background: 'var(--white)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--muted)', fontWeight: 300, marginBottom: '8px' }}>Select or create a box</div>
              <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>Build a curated pull list for your buyers</div>
            </div>
          </div>
        ) : (
          <div>
            {/* Box header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 300 }}>{activeBox.name}</div>
                <div style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '3px' }}>
                  {activeBox.buyer_name}{activeBox.buyer_email && ` · ${activeBox.buyer_email}`}
                  <span style={{ marginLeft: '12px', color: statusColour(activeBox.status), fontWeight: 500 }}>{activeBox.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {activeBox.status === 'Draft' && (
                  <button onClick={() => setShowAddBottle(true)}
                    style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    + Add Bottle
                  </button>
                )}
                {activeItems.length > 0 && (
                  <button onClick={() => setShowPullList(true)}
                    style={{ background: 'none', border: '1px solid var(--ink)', color: 'var(--ink)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    🖨 Pull List
                  </button>
                )}
                {activeBox.status === 'Draft' && activeItems.length > 0 && (
                  <button onClick={confirmBox} disabled={saving}
                    style={{ background: '#2d6a4f', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : '✓ Confirm Box'}
                  </button>
                )}
                <button onClick={() => deleteBox(activeBox.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Stats bar */}
            {activeItems.length > 0 && (
              <div style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
                {[
                  ['bottles', totalBottles],
                  ['cost (DP)', `£${totalDP.toFixed(2)}`],
                  ['total sale', `£${totalSale.toFixed(2)}`],
                  ['margin', `£${(totalSale - totalDP).toFixed(2)}`],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, color: 'var(--wine)', fontSize: '14px', fontFamily: 'DM Mono, monospace' }}>{val}</span>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Items list */}
            {activeItems.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed var(--border)', background: 'var(--white)' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'var(--muted)', marginBottom: '16px' }}>No bottles yet</div>
                <button onClick={() => setShowAddBottle(true)}
                  style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  + Add your first bottle
                </button>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
                {activeItems.map((item, idx) => {
                  const fullDesc = item.wine_description || ''
                  const commaIdx = fullDesc.indexOf(',')
                  const winePart = commaIdx > -1 ? fullDesc.slice(0, commaIdx).trim() : fullDesc
                  const producerPart = commaIdx > -1 ? fullDesc.slice(commaIdx + 1).trim() : ''
                  const margin = item.sale_price && item.dp_price
                    ? ((parseFloat(item.sale_price) - parseFloat(item.dp_price)) / parseFloat(item.dp_price) * 100).toFixed(1)
                    : null

                  return (
                    <div key={item.id} style={{ padding: '16px 20px', borderBottom: idx < activeItems.length - 1 ? '1px solid #ede6d6' : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colourDot(item.wine_colour), display: 'inline-block', flexShrink: 0 }}></span>
                          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 500 }}>{winePart}</span>
                          {item.wine_vintage && <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>{item.wine_vintage}</span>}
                          {item.quantity > 1 && <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'var(--ink)', color: '#d4ad45', padding: '1px 6px', borderRadius: '2px' }}>×{item.quantity}</span>}
                        </div>
                        {producerPart && <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', color: 'var(--ink)', marginLeft: '16px', marginTop: '1px' }}>{producerPart}</div>}
                        {item.wine_region && <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginLeft: '16px', marginTop: '2px' }}>{item.wine_region}</div>}
                        {item.tasting_note && (
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontStyle: 'italic', color: '#3a2a1a', marginTop: '8px', marginLeft: '16px', lineHeight: 1.5 }}>
                            "{item.tasting_note}"
                          </div>
                        )}
                        {item.producer_note && (
                          <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginTop: '4px', marginLeft: '16px', lineHeight: 1.4 }}>
                            {item.producer_note}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 500, color: 'var(--wine)' }}>
                          {item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}
                        </div>
                        {item.dp_price && (
                          <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
                            DP £{parseFloat(item.dp_price).toFixed(2)}
                          </div>
                        )}
                        {margin && (
                          <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: parseFloat(margin) >= 0 ? '#2d6a4f' : '#c0392b' }}>
                            {parseFloat(margin) >= 0 ? '+' : ''}{margin}%
                          </div>
                        )}
                        {activeBox.status === 'Draft' && (
                          <button onClick={() => removeItem(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>
                            ✕ remove
                          </button>
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

      {/* ─── New Box Modal ─────────────────────────────────────────────────── */}
      {showNewBoxModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '460px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, marginBottom: '20px' }}>New Box</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Box name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Lauren — Spring 2026"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Buyer name *</label>
                <input value={newBuyer} onChange={e => setNewBuyer(e.target.value)} placeholder="e.g. Lauren"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Email (optional)</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="lauren@example.com" type="email"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Notes (optional)</label>
                <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="e.g. Mostly Burgundy, a couple of surprises"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewBoxModal(false)}
                style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createBox} disabled={!newName || !newBuyer || saving}
                style={{ background: newName && newBuyer ? 'var(--ink)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: newName && newBuyer ? 'pointer' : 'not-allowed' }}>
                {saving ? 'Creating…' : 'Create Box →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bottle Modal */}
      {showAddBottle && (
        <AddBottleModal onAdd={addItemToBox} onClose={() => setShowAddBottle(false)} />
      )}

      {/* Pull List view */}
      {showPullList && activeBox && (
        <PullListView box={activeBox} items={activeItems} onClose={() => setShowPullList(false)} />
      )}

    </div>
  )
}
