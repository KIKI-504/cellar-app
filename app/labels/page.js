'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function abbreviateName(description) {
  const parts = description.split(',').map(p => p.trim())
  const wineName = parts[0] || description

  // Producer is everything after the first comma, cleaned up
  const rawProducer = parts.slice(1).join(', ')
  const producer = rawProducer
    .replace(/^Domaine de la\s+/i, '')
    .replace(/^Domaine de\s+/i, '')
    .replace(/^Domaine du\s+/i, '')
    .replace(/^Domaine des\s+/i, '')
    .replace(/^Domaine\s+/i, '')
    .replace(/^Château\s+/i, '')
    .replace(/^Chateau\s+/i, '')
    .replace(/,.*$/, '') // strip anything after next comma (region etc)
    .trim()

  return { wineName, producer }
}

function calcDP(ib) {
  return ((parseFloat(ib) + 3) * 1.2).toFixed(2)
}

function isMagnum(w) {
  return w.bottle_format?.toLowerCase().includes('magnum') ||
    w.bottle_volume?.includes('150')
}

function LabelContent({ wine, wineName, producer, isMag }) {
  const source = wine.source === 'Berry Brothers' ? 'BBR' : 'FLINT'
  const ib = parseFloat(wine.purchase_price_per_bottle).toFixed(2)
  const dp = calcDP(wine.purchase_price_per_bottle)

  return (
    <div style={{
      width: '100%',
      padding: '14px 18px',
      fontFamily: 'Arial, sans-serif',
      boxSizing: 'border-box',
    }}>
      {isMag && (
        <div style={{
          fontSize: '22px',
          fontWeight: 'bold',
          letterSpacing: '0.15em',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>MAGNUM</div>
      )}
      <div style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: 1.3, marginBottom: '2px' }}>
        {wine.vintage} {wineName}
      </div>
      {producer && (
        <div style={{ fontSize: '14px', lineHeight: 1.3, marginBottom: '6px' }}>
          {producer}
        </div>
      )}
      <div style={{ fontSize: '14px', marginTop: '4px' }}>
        £{ib} IB — {source}
      </div>
      <div style={{ fontSize: '14px' }}>
        £{dp} DP
      </div>
    </div>
  )
}

export default function LabelPage() {
  const router = useRouter()
  const [wines, setWines] = useState([])
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
    else fetchWines()
  }, [])

  async function fetchWines() {
    setLoading(true)
    const { data } = await supabase
      .from('wines')
      .select('id, source, description, vintage, bottle_format, bottle_volume, purchase_price_per_bottle, quantity')
      .order('description')
    setWines(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!search) { setFiltered(wines); return }
    const q = search.toLowerCase()
    setFiltered(wines.filter(w =>
      [w.description, w.vintage, w.source].join(' ').toLowerCase().includes(q)
    ))
  }, [search, wines])

  function selectWine(w) {
    const { wineName: wn, producer: pr } = abbreviateName(w.description)
    setSelected(w)
    setWineName(wn)
    setProducer(pr)
  }

  function printLabel() {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=816,height=1056')
    printWindow.document.write(`
      <html>
      <head>
        <title>Label — ${selected.vintage} ${wineName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: 4in; font-family: Arial, sans-serif; }
          @page { size: 4in 6in; margin: 0; }
          @media print {
            body { width: 4in; }
          }
          .label-half {
            width: 4in;
            height: 3in;
            padding: 14px 18px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border-bottom: 1px dashed #ccc;
          }
          .label-half:last-child { border-bottom: none; }
          .magnum {
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .wine-name { font-size: 15px; font-weight: bold; line-height: 1.3; margin-bottom: 2px; }
          .producer { font-size: 14px; line-height: 1.3; margin-bottom: 6px; }
          .price { font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        ${[1, 2].map(() => `
          <div class="label-half">
            ${isMagnum(selected) ? '<div class="magnum">MAGNUM</div>' : ''}
            <div class="wine-name">${selected.vintage} ${wineName}</div>
            ${producer ? `<div class="producer">${producer}</div>` : ''}
            <div class="price">£${parseFloat(selected.purchase_price_per_bottle).toFixed(2)} IB — ${selected.source === 'Berry Brothers' ? 'BBR' : 'FLINT'}</div>
            <div class="price">£${calcDP(selected.purchase_price_per_bottle)} DP</div>
          </div>
        `).join('')}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45' }}>Cellar</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px' }}>Inventory</button>
          <button onClick={() => router.push('/labels')} style={{ background: 'rgba(107,30,46,0.6)', color: '#d4ad45', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', borderRadius: '2px' }}>Labels</button>
          <button onClick={() => router.push('/buyer')} style={{ background: 'none', color: 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px' }}>Buyer View</button>
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px' }}>Sign Out</button>
      </div>

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>

        {/* Left — wine list */}
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300, marginBottom: '16px' }}>Print Labels</div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search wines…"
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', marginBottom: '12px' }} />

          <div style={{ border: '1px solid var(--border)', background: 'var(--white)', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {filtered.map(w => {
              const isSel = selected?.id === w.id
              const mag = isMagnum(w)
              return (
                <div key={w.id} onClick={() => selectWine(w)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--parchment)', cursor: 'pointer', background: isSel ? 'rgba(107,30,46,0.06)' : 'transparent', borderLeft: isSel ? '3px solid var(--wine)' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.vintage} </span>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description.split(',')[0]}</span>
                      {mag && <span style={{ marginLeft: '6px', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(184,148,42,0.15)', color: '#7a5e10', padding: '1px 5px', borderRadius: '2px' }}>Magnum</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '12px', whiteSpace: 'nowrap' }}>£{parseFloat(w.purchase_price_per_bottle).toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {w.source === 'Berry Brothers' ? 'BBR' : 'Flint'} · {w.quantity} btls
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right — label preview & edit */}
        {selected ? (
          <div style={{ position: 'sticky', top: '76px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, marginBottom: '16px', color: 'var(--wine)' }}>Label Preview</div>

            {/* Editable fields */}
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

            {/* Preview — 4×6 at screen scale */}
            <div ref={printRef} style={{ border: '1px solid var(--border)', background: 'var(--white)', width: '288px', margin: '0 auto 20px' }}>
              {/* Top half */}
              <div style={{ borderBottom: '1px dashed #ccc', padding: '0' }}>
                <LabelContent wine={selected} wineName={wineName} producer={producer} isMag={isMagnum(selected)} />
              </div>
              {/* Bottom half */}
              <div>
                <LabelContent wine={selected} wineName={wineName} producer={producer} isMag={isMagnum(selected)} />
              </div>
            </div>

            {/* Prices */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', fontSize: '12px' }}>
              <div style={{ flex: 1, background: 'var(--white)', border: '1px solid var(--border)', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>IB Price</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px' }}>£{parseFloat(selected.purchase_price_per_bottle).toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--white)', border: '1px solid var(--border)', padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>DP Price</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--wine)' }}>£{calcDP(selected.purchase_price_per_bottle)}</div>
              </div>
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
          <div style={{ position: 'sticky', top: '76px', border: '2px dashed var(--border)', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', marginBottom: '8px', color: 'var(--ink)' }}>Select a wine</div>
            <div style={{ fontSize: '12px' }}>Choose a wine from the list to preview and print its label</div>
          </div>
        )}
      </div>
    </div>
  )
}
