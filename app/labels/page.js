'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function abbreviateName(description) {
  const parts = description.split(',').map(p => p.trim())
  const wineName = parts[0] || description
  const rawProducer = parts.slice(1).join(', ')
  const producer = rawProducer
    .replace(/^Domaine de la\s+/i, '')
    .replace(/^Domaine de\s+/i, '')
    .replace(/^Domaine du\s+/i, '')
    .replace(/^Domaine des\s+/i, '')
    .replace(/^Domaine\s+/i, '')
    .replace(/^Château\s+/i, '')
    .replace(/^Chateau\s+/i, '')
    .replace(/,.*$/, '')
    .trim()
  return { wineName, producer }
}

function StudioLabelContent({ entry, wineName, producer }) {
  const bottleSize = entry.bottle_size || (entry.wines?.bottle_volume?.includes('150') ? '150' : '75')
  const dp = entry.dp_price ? parseFloat(entry.dp_price).toFixed(2) : null
  const sale = entry.sale_price ? parseFloat(entry.sale_price).toFixed(2) : null
  const vintage = entry.wines?.vintage || entry.unlinked_vintage || ''
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' }).replace(/\//g, '.')

  return (
    <div style={{ width: '100%', padding: '18px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '144px' }}>
      {bottleSize === '150' && (
        <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '0.15em', marginBottom: '10px', textTransform: 'uppercase' }}>MAGNUM</div>
      )}
      {bottleSize === '37.5' && (
        <div style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '10px', textTransform: 'uppercase' }}>HALF BOTTLE</div>
      )}
      <div style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: 1.3, marginBottom: '2px' }}>{vintage} {wineName}</div>
      {producer && <div style={{ fontSize: '20px', lineHeight: 1.3, marginBottom: '10px' }}>{producer}</div>}
      {dp && <div style={{ fontSize: '20px', marginTop: '8px' }}>£{dp} DP</div>}
      {sale && <div style={{ fontSize: '20px' }}>£{sale} Retail</div>}
      <div style={{ fontSize: '18px', marginTop: '4px', color: '#444' }}>({today})</div>
    </div>
  )
}

export default function LabelPage() {
  const router = useRouter()
  const [studioEntries, setStudioEntries] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [wineName, setWineName] = useState('')
  const [producer, setProducer] = useState('')
  const printRef = useRef()

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchStudio()
  }, [])

  async function fetchStudio() {
    setLoading(true)
    const { data } = await supabase
      .from('studio')
      .select('*, wines(description, vintage, region, colour, bottle_format, bottle_volume, purchase_price_per_bottle)')
      .eq('status', 'Available')
      .order('created_at', { ascending: false })
    setStudioEntries(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(studioEntries.filter(s => {
      const name = s.wines?.description || s.unlinked_description || ''
      const vintage = s.wines?.vintage || s.unlinked_vintage || ''
      return !q || [name, vintage].join(' ').toLowerCase().includes(q)
    }))
    setSelected(null)
    setWineName('')
    setProducer('')
  }, [search, studioEntries])

  function selectStudioEntry(s) {
    const desc = s.wines?.description || s.unlinked_description || ''
    const { wineName: wn, producer: pr } = desc ? abbreviateName(desc) : { wineName: '', producer: '' }
    setSelected(s)
    setWineName(wn)
    setProducer(pr)
  }

  function printLabel() {
    if (!selected) return
    const w = selected
    const bottleSize = w.bottle_size || '75'
    const vintage = w.wines?.vintage || w.unlinked_vintage || ''
    const dp = w.dp_price ? parseFloat(w.dp_price).toFixed(2) : null
    const sale = w.sale_price ? parseFloat(w.sale_price).toFixed(2) : null
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' }).replace(/\//g, '.')

    const labelHTML = `
      ${bottleSize === '150' ? '<div class="magnum">MAGNUM</div>' : ''}
      ${bottleSize === '37.5' ? '<div class="half">HALF BOTTLE</div>' : ''}
      <div class="wine-name">${vintage} ${wineName}</div>
      ${producer ? `<div class="producer">${producer}</div>` : ''}
      ${dp ? `<div class="price">£${dp} DP</div>` : ''}
      ${sale ? `<div class="price">£${sale} Retail</div>` : ''}
      <div class="date">(${today})</div>
    `

    const css = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 4in; font-family: Arial, sans-serif; }
      @page { size: 4in 6in; margin: 0; }
      .label-half {
        width: 4in; height: 3in; padding: 18px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        border-bottom: 1px dashed #ccc; text-align: center;
      }
      .label-half:last-child { border-bottom: none; }
      .magnum { font-size: 36px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px; }
      .half { font-size: 26px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px; }
      .wine-name { font-size: 24px; font-weight: bold; line-height: 1.3; margin-bottom: 2px; }
      .producer { font-size: 22px; line-height: 1.3; margin-bottom: 10px; }
      .price { font-size: 22px; line-height: 1.6; }
      .date { font-size: 20px; color: #444; margin-top: 4px; }
    `

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;'
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }
    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(`<html><head><style>${css}</style></head><body>
      ${[1, 2].map(() => `<div class="label-half">${labelHTML}</div>`).join('')}
    </body></html>`)
    doc.close()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => router.push('/studio')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px' }}>Studio</button>
          <button onClick={() => router.push('/labels')} style={{ background: 'rgba(107,30,46,0.6)', color: '#d4ad45', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Labels</button>
          <button onClick={() => router.push('/buyer')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px' }}>Buyer View</button>
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '76px 28px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>

        {/* Left — list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Print Labels</div>
          </div>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search studio wines…"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', marginBottom: '12px' }} />

          <div style={{ border: '1px solid var(--border)', background: 'var(--white)', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
            {filtered.map(s => {
              const isSel = selected?.id === s.id
              const name = s.wines?.description || s.unlinked_description || 'Unknown wine'
              const vintage = s.wines?.vintage || s.unlinked_vintage || ''
              const bottleSize = s.bottle_size || '75'
              const sizeTag = bottleSize === '150' ? 'Magnum' : bottleSize === '37.5' ? 'Half' : null
              return (
                <div key={s.id} onClick={() => selectStudioEntry(s)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--parchment)', cursor: 'pointer', background: isSel ? 'rgba(107,30,46,0.06)' : 'transparent', borderLeft: isSel ? '3px solid var(--wine)' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{vintage} {name.split(',')[0]}</span>
                      {sizeTag && <span style={{ marginLeft: '6px', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(184,148,42,0.15)', color: '#7a5e10', padding: '1px 5px', borderRadius: '2px' }}>{sizeTag}</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                      {s.sale_price ? `£${parseFloat(s.sale_price).toFixed(2)}` : s.dp_price ? `£${parseFloat(s.dp_price).toFixed(2)} DP` : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Studio · {s.quantity} btls</div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>No wines found</div>
            )}
          </div>
        </div>

        {/* Right — preview & print */}
        {selected ? (
          <div style={{ position: 'sticky', top: '88px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, marginBottom: '16px', color: 'var(--wine)' }}>Label Preview</div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Wine Name (Line 1)</label>
              <input value={wineName} onChange={e => setWineName(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Producer (Line 2)</label>
              <input value={producer} onChange={e => setProducer(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
            </div>

            <div ref={printRef} style={{ border: '1px solid var(--border)', background: 'var(--white)', width: '288px', margin: '0 auto 20px' }}>
              <div style={{ borderBottom: '1px dashed #ccc' }}>
                <StudioLabelContent entry={selected} wineName={wineName} producer={producer} />
              </div>
              <div>
                <StudioLabelContent entry={selected} wineName={wineName} producer={producer} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              {selected.dp_price && (
                <div style={{ flex: 1, background: 'var(--white)', border: '1px solid var(--border)', padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>DP Price</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px' }}>£{parseFloat(selected.dp_price).toFixed(2)}</div>
                </div>
              )}
              {selected.sale_price && (
                <div style={{ flex: 1, background: 'var(--white)', border: '1px solid var(--border)', padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Sale Price</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--wine)' }}>£{parseFloat(selected.sale_price).toFixed(2)}</div>
                </div>
              )}
            </div>

            <button onClick={printLabel}
              style={{ width: '100%', background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>
              🖨 Print Label
            </button>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginTop: '8px', lineHeight: 1.5 }}>
              Opens print dialog · Send to Munbyn app
            </div>
          </div>
        ) : (
          <div style={{ position: 'sticky', top: '88px', border: '2px dashed var(--border)', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', marginBottom: '8px', color: 'var(--ink)' }}>Select a wine</div>
            <div style={{ fontSize: '12px' }}>Choose from your studio inventory to preview and print</div>
          </div>
        )}
      </div>
    </div>
  )
}
