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
        buyer_note:                row.buyer_note,
      } : null,
    }
  }
  return row
}

function sizeBadge(size) {
  if (!size) return '75cl'
  const s = String(size)
  if (s === '150' || s.toLowerCase().includes('magnum')) return '150cl'
  if (s === '37.5') return '37.5cl'
  if (s === '300') return '300cl'
  if (s === '75') return '75cl'
  return s + 'cl'
}

function sizeBadgeLabel(size) {
  if (!size) return '75cl'
  const s = String(size)
  if (s === '150' || s.toLowerCase().includes('magnum')) return 'Magnum'
  if (s === '37.5') return '37.5cl'
  if (s === '300') return '300cl'
  if (s === '75') return '75cl'
  return s + 'cl'
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ box, items, invoice, onClose, onMarkPaid }) {
  const [saving, setSaving] = React.useState(false)

  const lineItems = items.map(item => {
    const fd = item.wine_description || ''
    const ci = fd.indexOf(',')
    const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
    const pp = ci > -1 ? fd.slice(ci + 1).trim() : ''
    const badge = sizeBadgeLabel(item.wine_bottle_size)
    const unitPrice = parseFloat(item.sale_price) || 0
    const qty = item.quantity || 1
    return { wp, pp, vintage: item.wine_vintage || '', badge, unitPrice, qty, lineTotal: unitPrice * qty }
  })
  const grandTotal = lineItems.reduce((s, i) => s + i.lineTotal, 0)

  function buildHtml() {
    const rows = lineItems.map(i => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #ede6d6;font-family:'Cormorant Garamond',serif;font-size:15px;">
          ${i.wp}${i.pp ? `<span style="color:#7a6652;font-size:13px;"> · ${i.pp}</span>` : ''}
          <div style="font-size:11px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:2px;">${[i.vintage, i.badge].filter(Boolean).join(' · ')}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;text-align:center;font-family:'DM Mono',monospace;font-size:13px;">${i.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;">£${i.unitPrice.toFixed(2)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;">£${i.lineTotal.toFixed(2)}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Mono',monospace;color:#1a1008;background:#fff;padding:48px;font-size:12px}
        @media print{body{padding:24px}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #1a1008;">
        <div><div style="font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;letter-spacing:0.08em;">Belle Année</div>
        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#7a6652;margin-top:2px;">Wines &amp; Studio</div></div>
        <div style="text-align:right;">
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;color:#6b1e2e;">${invoice.invoice_number}</div>
          <div style="font-size:11px;color:#7a6652;margin-top:4px;">${new Date(invoice.invoice_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px;">
        <div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Bill To</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500;">${invoice.buyer_name}</div>
          ${invoice.buyer_email ? `<div style="font-size:11px;color:#7a6652;margin-top:3px;">${invoice.buyer_email}</div>` : ''}
        </div>
        <div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Reference</div>
          <div style="font-size:12px;">${box.name}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
        <thead><tr style="border-bottom:2px solid #1a1008;">
          <th style="padding:8px 0;text-align:left;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;font-weight:500;">Wine</th>
          <th style="padding:8px;text-align:center;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;font-weight:500;">Qty</th>
          <th style="padding:8px;text-align:right;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;font-weight:500;">Unit</th>
          <th style="padding:8px 0;text-align:right;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;font-weight:500;">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-bottom:36px;">
        <div style="min-width:200px;border-top:2px solid #1a1008;padding-top:12px;display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;">Total Due</span>
          <span style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:#6b1e2e;">£${grandTotal.toFixed(2)}</span>
        </div>
      </div>
      <div style="border-top:1px solid #ede6d6;padding-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
        <div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Payment</div>
          <div style="font-size:11px;line-height:1.7;color:#3a2a1a;">Pay by bank transfer to<br><strong>MS J BRIDE</strong><br>Sort code: 20-31-52<br>Account: 63453472</div>
        </div>
        <div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">VAT Status</div>
          <div style="font-size:11px;line-height:1.7;color:#7a6652;font-style:italic;">Belle Année Wines is not VAT registered. Prices include duty and VAT already paid at source.</div>
        </div>
      </div></body></html>`
  }

  function handlePrint() {
    const win = document.createElement('iframe')
    win.style.display = 'none'
    document.body.appendChild(win)
    win.contentDocument.write(buildHtml())
    win.contentDocument.close()
    win.onload = () => { setTimeout(() => { win.contentWindow.focus(); win.contentWindow.print(); setTimeout(() => document.body.removeChild(win), 2000) }, 300) }
  }

  function handlePdf() {
    const win = window.open('', '_blank', 'width=900,height=1100')
    if (!win) { alert('Please allow popups to save PDF'); return }
    win.document.write(buildHtml())
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 600)
  }

  async function handleMarkPaid() {
    setSaving(true)
    await onMarkPaid(invoice.id)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.85)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'720px', border:'1px solid var(--border)' }}>
        <div style={{ background:'var(--ink)', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.15em', color:'rgba(253,250,245,0.5)', textTransform:'uppercase' }}>Invoice</span>
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'13px', color:'#d4ad45', fontWeight:600 }}>{invoice.invoice_number}</span>
            <span style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color: invoice.status==='paid'?'#2d6a4f':'rgba(212,173,69,0.7)', letterSpacing:'0.1em', textTransform:'uppercase', border:`1px solid ${invoice.status==='paid'?'#2d6a4f':'rgba(212,173,69,0.4)'}`, padding:'2px 7px' }}>{invoice.status}</span>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {invoice.status === 'unpaid' && <button onClick={handleMarkPaid} disabled={saving} style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>{saving?'…':'✓ Mark Paid'}</button>}
            <button onClick={handlePdf} style={{ background:'rgba(107,30,46,0.7)', color:'var(--white)', border:'none', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>⬇ PDF</button>
            <button onClick={handlePrint} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>🖨 Print</button>
            <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.6)', padding:'7px 12px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ padding:'40px 48px', background:'var(--white)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'36px', paddingBottom:'20px', borderBottom:'2px solid var(--ink)' }}>
            <div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'30px', fontWeight:300, letterSpacing:'0.08em' }}>Belle Année</div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--muted)', marginTop:'2px' }}>Wines &amp; Studio</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:500, color:'var(--wine)' }}>{invoice.invoice_number}</div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{new Date(invoice.invoice_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px', marginBottom:'32px' }}>
            <div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'8px' }}>Bill To</div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', fontWeight:500 }}>{invoice.buyer_name}</div>
              {invoice.buyer_email && <div style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', marginTop:'3px' }}>{invoice.buyer_email}</div>}
            </div>
            <div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'8px' }}>Reference</div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'12px' }}>{box.name}</div>
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'28px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--ink)' }}>
                {[['Wine','left'],['Qty','center'],['Unit','right'],['Total','right']].map(([label,align]) => (
                  <th key={label} style={{ padding:'8px 0', textAlign:align, fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', fontWeight:500, paddingLeft:label==='Qty'?'8px':undefined, paddingRight:label==='Unit'?'8px':undefined }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding:'11px 0', borderBottom:'1px solid #ede6d6' }}>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px' }}>{item.wp}{item.pp && <span style={{ color:'var(--muted)', fontSize:'13px' }}> · {item.pp}</span>}</div>
                    {(item.vintage || item.badge) && <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', marginTop:'2px' }}>{[item.vintage, item.badge].filter(Boolean).join(' · ')}</div>}
                  </td>
                  <td style={{ padding:'11px 8px', borderBottom:'1px solid #ede6d6', textAlign:'center', fontFamily:'DM Mono,monospace', fontSize:'13px' }}>{item.qty}</td>
                  <td style={{ padding:'11px 8px', borderBottom:'1px solid #ede6d6', textAlign:'right', fontFamily:'DM Mono,monospace', fontSize:'13px' }}>£{item.unitPrice.toFixed(2)}</td>
                  <td style={{ padding:'11px 0', borderBottom:'1px solid #ede6d6', textAlign:'right', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600 }}>£{item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'32px' }}>
            <div style={{ minWidth:'200px', borderTop:'2px solid var(--ink)', paddingTop:'12px', display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)' }}>Total Due</span>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'28px', fontWeight:500, color:'var(--wine)' }}>£{grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px' }}>
            <div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'10px' }}>Payment</div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', lineHeight:1.8, color:'var(--ink)' }}>Pay by bank transfer to<br/><strong>MS J BRIDE</strong><br/>Sort code: 20-31-52<br/>Account: 63453472</div>
            </div>
            <div>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'10px' }}>VAT Status</div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', fontStyle:'italic', lineHeight:1.7, color:'var(--muted)' }}>Belle Année Wines is not VAT registered. Prices include duty and VAT already paid at source.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Invoice Modal ─────────────────────────────────────────────────────
function CreateInvoiceModal({ box, allBoxes, onConfirm, onClose }) {
  const deriveInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    return parts[0]?.slice(0,2).toUpperCase() || ''
  }
  const [initials, setInitials] = React.useState(() => deriveInitials(box.buyer_name))
  const [saving, setSaving] = React.useState(false)
  const eligible = allBoxes.filter(b => b.status === 'Confirmed' && !b.invoice_id && b.buyer_name === box.buyer_name)
  const [selectedIds, setSelectedIds] = React.useState(new Set([box.id]))

  function toggleBox(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  const year = new Date().getFullYear()
  const preview = initials.length >= 1 ? `${initials.toUpperCase()}-${year}-NNN` : '—'

  async function handleCreate() {
    if (!initials.trim() || selectedIds.size === 0) return
    setSaving(true)
    await onConfirm(initials.trim().toUpperCase(), [...selectedIds])
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.75)', zIndex:350, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'420px', border:'1px solid var(--border)', padding:'24px', marginTop:'8px' }}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:300, marginBottom:'6px' }}>Create Invoice</div>
        <div style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', marginBottom:'20px' }}>for {box.buyer_name}</div>
        {eligible.length > 1 && (
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'8px', fontFamily:'DM Mono,monospace' }}>Include boxes</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {eligible.map(b => (
                <div key={b.id} onClick={() => toggleBox(b.id)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:selectedIds.has(b.id)?'rgba(107,30,46,0.06)':'var(--white)', border:selectedIds.has(b.id)?'2px solid rgba(107,30,46,0.3)':'1px solid var(--border)', cursor:'pointer' }}>
                  <div style={{ width:'16px', height:'16px', border:selectedIds.has(b.id)?'2px solid var(--wine)':'1px solid var(--border)', background:selectedIds.has(b.id)?'var(--wine)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {selectedIds.has(b.id) && <span style={{ color:'var(--white)', fontSize:'11px', lineHeight:1 }}>✓</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontWeight:500 }}>{b.name}</div>
                    {b.total_sale > 0 && <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)' }}>£{parseFloat(b.total_sale).toFixed(2)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom:'16px' }}>
          <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'6px', fontFamily:'DM Mono,monospace' }}>Buyer initials</label>
          <input value={initials} onChange={e => setInitials(e.target.value.toUpperCase().slice(0,4))} onKeyDown={e => e.key==='Enter' && handleCreate()} placeholder="e.g. NP" maxLength={4}
            style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'10px 12px', fontFamily:'DM Mono,monospace', fontSize:'18px', fontWeight:600, outline:'none', letterSpacing:'0.2em', boxSizing:'border-box', textTransform:'uppercase' }} />
        </div>
        <div style={{ background:'rgba(107,30,46,0.06)', border:'1px solid rgba(107,30,46,0.15)', padding:'10px 14px', marginBottom:'20px' }}>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'4px' }}>Invoice number</div>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:500, color:'var(--wine)' }}>{preview}</div>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', marginTop:'2px' }}>{selectedIds.size} box{selectedIds.size !== 1 ? 'es' : ''} selected · auto-increments per buyer</div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, background:'none', border:'1px solid var(--border)', padding:'10px', fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', cursor:'pointer' }}>Cancel</button>
          <button onClick={handleCreate} disabled={!initials.trim()||saving} style={{ flex:2, background:initials.trim()?'var(--wine)':'#ccc', color:'var(--white)', border:'none', padding:'10px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:initials.trim()?'pointer':'not-allowed' }}>
            {saving ? 'Creating…' : `Invoice ${selectedIds.size} box${selectedIds.size !== 1 ? 'es' : ''} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Clients Modal ────────────────────────────────────────────────────────────
function ClientEditFields({ draft, setDraft, onSave, onCancel, isNew, saving, editingName }) {
  const inputStyle = (field) => ({
    width:'100%', border:'1px solid var(--border)', background:'var(--white)',
    padding:'7px 10px',
    fontFamily: field==='name'?'Cormorant Garamond,serif':'DM Mono,monospace',
    fontSize: field==='name'?'15px':'12px',
    outline:'none', boxSizing:'border-box'
  })
  return (
    <div style={{ background: isNew ? 'var(--white)' : 'rgba(107,30,46,0.04)', border: isNew ? '1px dashed var(--border)' : '2px solid rgba(107,30,46,0.2)', padding:'14px', marginBottom:'10px' }}>
      <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--wine)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'10px' }}>
        {isNew ? 'New Client' : `Editing ${editingName}`}
      </div>
      {[['Name *','name','text'],['Email','email','email'],['Phone','phone','tel'],['Note','note','text']].map(([label, field, type]) => (
        <div key={field} style={{ marginBottom:'8px' }}>
          <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'3px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>{label}</label>
          <input type={type} value={draft[field] || ''} onChange={e => setDraft(d => ({...d, [field]: e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && field !== 'note' && onSave()}
            style={inputStyle(field)} />
        </div>
      ))}
      <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
        <button onClick={onSave} disabled={!draft.name?.trim() || saving}
          style={{ background: draft.name?.trim() ? 'var(--ink)' : '#ccc', color:'var(--white)', border:'none', padding:'7px 16px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor: draft.name?.trim() ? 'pointer' : 'not-allowed' }}>
          {saving ? 'Saving…' : isNew ? '+ Add Client' : '✓ Save'}
        </button>
        <button onClick={onCancel} style={{ background:'none', border:'1px solid var(--border)', padding:'7px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', cursor:'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function ClientsModal({ contacts, onClose, onRefresh }) {
  const [editingId, setEditingId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ name:'', email:'', phone:'', note:'' })
  const [saving, setSaving] = useState(false)

  function startEdit(c) {
    setEditingId(c.id)
    setDraft({ name: c.name||'', email: c.email||'', phone: c.phone||'', note: c.note||'' })
    setShowNew(false)
  }
  function cancelEdit() { setEditingId(null); setDraft({ name:'', email:'', phone:'', note:'' }) }

  async function save(isNew) {
    if (!draft.name?.trim()) return
    setSaving(true)
    if (isNew) {
      await supabase.from('contacts').insert({ name: draft.name, email: draft.email||null, phone: draft.phone||null, note: draft.note||null })
      setShowNew(false)
    } else {
      await supabase.from('contacts').update({ name: draft.name, email: draft.email||null, phone: draft.phone||null, note: draft.note||null }).eq('id', editingId)
      setEditingId(null)
    }
    setDraft({ name:'', email:'', phone:'', note:'' })
    await onRefresh()
    setSaving(false)
  }

  async function del(id, name) {
    if (!confirm(`Delete ${name}? Their boxes will remain.`)) return
    await supabase.from('contacts').delete().eq('id', id)
    await onRefresh()
  }

  const editingName = editingId ? (contacts.find(c => c.id === editingId)?.name || '') : ''

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.75)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'480px', border:'1px solid var(--border)', marginTop:'8px' }}>
        <div style={{ background:'var(--ink)', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px' }}>
          <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.15em', color:'rgba(253,250,245,0.5)', textTransform:'uppercase' }}>Clients · {contacts.length}</span>
          <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.6)', padding:'5px 10px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕ Close</button>
        </div>
        <div style={{ padding:'16px 20px' }}>
          {contacts.map(c => (
            <div key={c.id} style={{ marginBottom:'8px' }}>
              {editingId === c.id ? (
                <ClientEditFields draft={draft} setDraft={setDraft} onSave={() => save(false)} onCancel={cancelEdit} isNew={false} saving={saving} editingName={editingName} />
              ) : (
                <div style={{ background:'var(--white)', border:'1px solid var(--border)', padding:'10px 12px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'16px', fontWeight:500 }}>{c.name}</div>
                    <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px' }}>{[c.phone,c.email].filter(Boolean).join(' · ')||'—'}</div>
                    {c.note && <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'3px', fontStyle:'italic' }}>{c.note}</div>}
                  </div>
                  <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                    <button onClick={() => startEdit(c)} style={{ background:'none', border:'1px solid var(--border)', padding:'4px 8px', fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', cursor:'pointer' }}>✏</button>
                    <button onClick={() => del(c.id, c.name)} style={{ background:'none', border:'none', padding:'4px 6px', fontFamily:'DM Mono,monospace', fontSize:'12px', color:'var(--muted)', cursor:'pointer' }}>✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {showNew ? (
            <ClientEditFields draft={draft} setDraft={setDraft} onSave={() => save(true)} onCancel={() => { setShowNew(false); setDraft({ name:'', email:'', phone:'', note:'' }) }} isNew={true} saving={saving} editingName='' />
          ) : (
            <button onClick={() => { setShowNew(true); setEditingId(null); setDraft({ name:'', email:'', phone:'', note:'' }) }}
              style={{ width:'100%', background:'none', border:'1px dashed var(--border)', padding:'10px', fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', cursor:'pointer', textAlign:'center', letterSpacing:'0.08em' }}>
              + Add Client
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pull List View (with tick-select and numbered split) ─────────────────────
function PullListView({ box, items, onClose }) {
  const printRef = useRef(null)
  // All items ticked by default
  const [ticked, setTicked] = useState(() => new Set(items.map(i => i.id)))
  const [splitNum, setSplitNum] = useState('')
  const [splitOf, setSplitOf] = useState('')

  function toggleAll() {
    if (ticked.size === items.length) setTicked(new Set())
    else setTicked(new Set(items.map(i => i.id)))
  }
  function invertTick() {
    setTicked(new Set(items.filter(i => !ticked.has(i.id)).map(i => i.id)))
  }
  function toggleItem(id) {
    setTicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalSale    = items.reduce((s, i) => s + (parseFloat(i.sale_price)||0) * (i.quantity||1), 0)
  const tickedSale   = items.filter(i => ticked.has(i.id)).reduce((s, i) => s + (parseFloat(i.sale_price)||0) * (i.quantity||1), 0)
  const totalBottles = items.reduce((s, i) => s + (i.quantity||1), 0)
  const tickedBottles = items.filter(i => ticked.has(i.id)).reduce((s, i) => s + (i.quantity||1), 0)

  const isSplit = splitNum !== '' && splitOf !== ''
  const isPartial = ticked.size < items.length

  function buildPrintHtml() {
   const rows = items.filter(item => ticked.has(item.id)).map(item => {
      const isTickedItem = ticked.has(item.id)
      const fd = item.wine_description || ''
      const ci = fd.indexOf(',')
      const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
      const pp = ci > -1 ? fd.slice(ci + 1).trim() : ''
      const badge = sizeBadge(item.wine_bottle_size)
      const dimStyle = isPartial && !isTickedItem ? 'opacity:0.35;' : ''
      const thisLabel = isPartial && isTickedItem ? `<span style="display:inline-block;width:10px;height:10px;background:#1a1008;border-radius:2px;margin-right:6px;vertical-align:middle;flex-shrink:0;"></span>` : isPartial ? `<span style="display:inline-block;width:10px;height:10px;border:1px solid #c8b89a;border-radius:2px;margin-right:6px;vertical-align:middle;flex-shrink:0;"></span>` : ''
      return `<div class="card" style="padding:18px 0;border-bottom:1px solid #ede6d6;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;${dimStyle}">
        <div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            ${thisLabel}<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colourDot(item.wine_colour)};flex-shrink:0;"></span>
            <span style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500;">${wp}</span>
            ${item.wine_vintage ? `<span style="font-family:'DM Mono',monospace;font-size:12px;color:#7a6652;">${item.wine_vintage}</span>` : ''}
            ${badge ? `<span style="font-family:'DM Mono',monospace;font-size:11px;color:#6b1e2e;font-weight:600;">${badge}</span>` : ''}
          </div>
          ${pp ? `<div style="font-family:'Cormorant Garamond',serif;font-size:14px;color:#3a2a1a;margin-top:2px;margin-left:24px;">${pp}</div>` : ''}
          ${item.wine_region ? `<div style="font-size:11px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:4px;margin-left:24px;">${item.wine_region}</div>` : ''}
          ${item.tasting_note ? `<div style="font-size:13px;font-style:italic;color:#3a2a1a;margin-top:10px;margin-left:24px;line-height:1.6;">"${item.tasting_note}"</div>` : ''}
          ${item.buyer_note ? `<div style="font-family:'Cormorant Garamond',serif;font-size:13px;color:#3a2a1a;margin-top:8px;margin-left:24px;line-height:1.6;opacity:0.9;">${item.buyer_note}</div>` : ''}
          ${item.women_note ? `<div style="display:flex;align-items:flex-start;gap:5px;margin-top:6px;margin-left:24px;"><span style="font-size:13px;color:#9b3a4a;flex-shrink:0;line-height:1.4;">♀</span><span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-style:italic;color:#9b3a4a;line-height:1.6;">${item.women_note}</span></div>` : ''}
          ${item.producer_note ? `<div style="font-size:11px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:3px;margin-left:24px;line-height:1.4;">${item.producer_note}</div>` : ''}
        </div>
        <div style="text-align:right;min-width:80px;">
          <div style="font-size:9px;font-family:'DM Mono',monospace;color:#7a6652;text-transform:uppercase;letter-spacing:0.1em;">per bottle</div>
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:500;color:#6b1e2e;margin-top:2px;">${item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}</div>
          ${item.quantity > 1 ? `<div style="font-size:10px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:2px;">× ${item.quantity}</div>` : ''}
        </div>
      </div>`
    }).join('')

    const splitLabel = isSplit ? `Pull List ${splitNum} of ${splitOf}` : 'Pull List'
    const totalLine = isPartial
      ? `£${tickedSale.toFixed(2)} of £${totalSale.toFixed(2)} total`
      : `£${totalSale.toFixed(2)}`

    return `<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>${box.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Cormorant Garamond',serif;color:#1a1008;background:#fff;padding:40px}
        .card:last-child{border-bottom:none}
        @media print{body{padding:20px}}
      </style></head><body>
      <div style="border-bottom:1px solid #c8b89a;padding-bottom:20px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;letter-spacing:0.05em;">${box.name}</div>
          <div style="font-size:12px;font-family:'DM Mono',monospace;color:#7a6652;margin-top:4px;">For ${box.buyer_name}${box.buyer_email ? ` · ${box.buyer_email}` : ''}</div>
        </div>
        <div style="text-align:right;font-size:11px;font-family:'DM Mono',monospace;color:#7a6652;">
          <div>${isPartial ? `${tickedBottles} of ${totalBottles}` : totalBottles} bottle${totalBottles !== 1 ? 's' : ''}</div>
          <div>${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
      </div>
      ${rows}
      <div style="margin-top:24px;padding-top:16px;border-top:2px solid #c8b89a;">
        <div style="font-size:11px;font-family:'DM Mono',monospace;color:#7a6652;letter-spacing:0.08em;text-transform:uppercase;">${splitLabel}</div>
      </div>
      ${box.notes ? `<div style="margin-top:16px;padding:12px 16px;background:rgba(212,173,69,0.08);border:1px solid rgba(212,173,69,0.25);font-size:12px;font-family:'DM Mono',monospace;color:#7a6652;">${box.notes}</div>` : ''}
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #ede6d6;font-size:10px;font-family:'DM Mono',monospace;color:#c8b89a;text-align:center;letter-spacing:0.1em;">BELLE ANNÉE WINES · ${new Date().getFullYear()}</div>
    </body></html>`
  }

  function handlePrint() {
    const html = buildPrintHtml()
    const win = document.createElement('iframe')
    win.style.display = 'none'
    document.body.appendChild(win)
    win.contentDocument.write(html)
    win.contentDocument.close()
    win.onload = () => { win.contentWindow.focus(); win.contentWindow.print(); setTimeout(() => document.body.removeChild(win), 1000) }
  }

  const allTicked = ticked.size === items.length
  const noneTicked = ticked.size === 0

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.85)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'700px', border:'1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ background:'var(--ink)', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', flexWrap:'wrap', gap:'8px' }}>
          <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.15em', color:'rgba(253,250,245,0.5)', textTransform:'uppercase' }}>Pull List Preview</span>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handlePrint} disabled={noneTicked} style={{ background:noneTicked?'#555':'var(--wine)', color:'var(--white)', border:'none', padding:'7px 16px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:noneTicked?'not-allowed':'pointer' }}>🖨 Print</button>
            <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.6)', padding:'7px 12px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕ Close</button>
          </div>
        </div>

        {/* Tick controls + split numbering */}
        <div style={{ padding:'12px 20px', background:'rgba(107,30,46,0.04)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Select:</span>
            <button onClick={toggleAll} style={{ padding:'4px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', border:'1px solid var(--border)', background:allTicked?'var(--ink)':'var(--white)', color:allTicked?'var(--white)':'var(--muted)', cursor:'pointer', letterSpacing:'0.06em' }}>{allTicked ? '✓ All' : 'All'}</button>
            <button onClick={() => setTicked(new Set())} style={{ padding:'4px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', border:'1px solid var(--border)', background:noneTicked?'var(--ink)':'var(--white)', color:noneTicked?'var(--white)':'var(--muted)', cursor:'pointer', letterSpacing:'0.06em' }}>None</button>
            <button onClick={invertTick} style={{ padding:'4px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', border:'1px solid var(--border)', background:'var(--white)', color:'var(--muted)', cursor:'pointer', letterSpacing:'0.06em' }}>Invert</button>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>Pull List</span>
            <input type="number" min="1" value={splitNum} onChange={e => setSplitNum(e.target.value)} placeholder="1" style={{ width:'40px', border:'1px solid var(--border)', background:'var(--white)', padding:'4px 6px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', textAlign:'center' }} />
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)' }}>of</span>
            <input type="number" min="1" value={splitOf} onChange={e => setSplitOf(e.target.value)} placeholder="2" style={{ width:'40px', border:'1px solid var(--border)', background:'var(--white)', padding:'4px 6px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', textAlign:'center' }} />
            {(splitNum || splitOf) && <button onClick={() => { setSplitNum(''); setSplitOf('') }} style={{ background:'none', border:'none', color:'var(--muted)', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', padding:'2px 4px' }}>✕</button>}
          </div>
        </div>

        {/* Items preview */}
        <div style={{ padding:'28px 32px' }}>
          <div style={{ borderBottom:'1px solid #c8b89a', paddingBottom:'16px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:300, letterSpacing:'0.05em' }}>{box.name}</div>
              <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'3px' }}>For {box.buyer_name}{box.buyer_email && ` · ${box.buyer_email}`}</div>
            </div>
            <div style={{ textAlign:'right', fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>
              <div>{isPartial ? `${tickedBottles} of ${totalBottles}` : totalBottles} bottle{totalBottles !== 1 ? 's' : ''}</div>
              <div>{new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
            </div>
          </div>

          {items.map((item, i) => {
            const isTickedItem = ticked.has(item.id)
            const fd = item.wine_description || ''
            const ci = fd.indexOf(',')
            const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
            const pp = ci > -1 ? fd.slice(ci + 1).trim() : ''
            const badge = sizeBadge(item.wine_bottle_size)
            return (
              <div key={item.id} onClick={() => toggleItem(item.id)} style={{ padding:'14px 0', borderBottom: i < items.length-1 ? '1px solid #ede6d6' : 'none', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'12px', alignItems:'start', cursor:'pointer', opacity: isPartial && !isTickedItem ? 0.4 : 1, transition:'opacity 0.15s' }}>
                {/* Checkbox */}
                <div style={{ width:'18px', height:'18px', border:`2px solid ${isTickedItem ? 'var(--ink)' : 'var(--border)'}`, background:isTickedItem?'var(--ink)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'2px', borderRadius:'2px', transition:'all 0.1s' }}>
                  {isTickedItem && <span style={{ color:'var(--white)', fontSize:'12px', lineHeight:1, fontWeight:700 }}>✓</span>}
                </div>
                {/* Wine info */}
                <div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'8px', flexWrap:'wrap' }}>
                    <span style={{ display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', background:colourDot(item.wine_colour), flexShrink:0 }}></span>
                    <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'17px', fontWeight:500 }}>{wp}</span>
                    {item.wine_vintage && <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)' }}>{item.wine_vintage}</span>}
                    {badge && <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--wine)', fontWeight:600 }}>{badge}</span>}
                  </div>
                  {pp && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginTop:'1px', marginLeft:'16px' }}>{pp}</div>}
                  {item.wine_region && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px', marginLeft:'16px' }}>{item.wine_region}</div>}
                  {item.tasting_note && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'12px', fontStyle:'italic', color:'#3a2a1a', marginTop:'6px', marginLeft:'16px', lineHeight:1.5 }}>"{item.tasting_note}"</div>}
            {item.buyer_note && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'12px', color:'#3a2a1a', marginTop:'6px', marginLeft:'16px', lineHeight:1.6, opacity:0.85 }}>{item.buyer_note}</div>}
                  {item.women_note && <div style={{ display:'flex', alignItems:'flex-start', gap:'4px', marginTop:'4px', marginLeft:'16px' }}><span style={{ fontSize:'12px', color:'#9b3a4a' }}>♀</span><span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'12px', fontStyle:'italic', color:'#9b3a4a', lineHeight:1.5 }}>{item.women_note}</span></div>}
                </div>
                {/* Price */}
                <div style={{ textAlign:'right', minWidth:'72px' }}>
                  <div style={{ fontFamily:'DM Mono,monospace', fontSize:'14px', fontWeight:500, color:'var(--wine)' }}>{item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}</div>
                  {item.quantity > 1 && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px' }}>× {item.quantity}</div>}
                </div>
              </div>
            )
          })}
<div style={{ marginTop:'20px', paddingTop:'14px', borderTop:'2px solid #c8b89a' }}>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
              {isSplit ? `Pull List ${splitNum} of ${splitOf}` : 'Pull List'}
            </div>
          </div>
        </div>
      </div>
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
  const [scanMatch, setScanMatch] = useState(null)
  const [qty, setQty] = useState(1)
  const [tastingNote, setTastingNote] = useState('')
  const [producerNote, setProducerNote] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanLabel, setScanLabel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState(null)
  const fileRef = useRef(null)

  async function searchStudio(q) {
    setSearch(q)
    if (q.length < 2) { setResults([]); return }
    const { data } = await supabase.rpc('search_studio', { search_term: q })
    setResults((data || []).map(normaliseRow))
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
      _dp:      entry.dp_price ? parseFloat(entry.dp_price) : null,
    }
    setSelected(built)
    setSalePrice(entry.sale_price ? String(parseFloat(entry.sale_price)) : '')
    setTastingNote('')
    setProducerNote(w?.producer_note || '')
    setSearch(''); setResults([]); setScanMatch(null)
  }

  function handleImageSelect(e) {
    const file = e.target.files[0]; if (!file) return
    setImageFile(file)
    const reader = new FileReader(); reader.onload = ev => setImagePreview(ev.target.result); reader.readAsDataURL(file)
  }

  async function analyseImage() {
    if (!imageFile) return
    setScanning(true); setScanLabel(null); setScanMatch(null)
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(imageFile) })
      const resp = await fetch('/api/analyse-label', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imageBase64:base64, mediaType:imageFile.type }) })
      const result = await resp.json()
      if (!result.success) throw new Error(result.error)
      const ex = result.data; setScanLabel(ex)
      const terms = [ex.wine_name, ex.producer, ex.wine_name?.split(' ')[0]].filter(Boolean)
      let matchData = null
      for (const term of terms) { const { data } = await supabase.rpc('search_studio', { search_term: term }); if (data?.length > 0) { matchData = data; break } }
      if (matchData?.length > 0) { setScanMatch(normaliseRow(matchData[0])) }
      else {
        const q = [ex.wine_name, ex.producer].filter(Boolean).join(', '); setSearch(q)
        const firstWord = ex.wine_name?.split(' ')[0] || ex.producer?.split(' ')[0] || ''
        if (firstWord.length > 2) { const { data: broader } = await supabase.rpc('search_studio', { search_term: firstWord }); setResults((broader || []).map(normaliseRow)) }
      }
    } catch (err) { alert('Label read failed: ' + err.message) }
    setScanning(false)
  }

  async function confirm() {
    if (!selected) return; setSaving(true)
    const parentId = selected.id ? await ensureSourceId(selected.id, selected) : generateSourceId(selected._desc, selected._vintage, selected._colour, selected.bottle_size || '75')
    const { error } = await onAdd({
      studio_id: selected.id||null, wine_description: selected._desc, wine_vintage: selected._vintage,
      wine_colour: selected._colour, wine_region: selected._region, dp_price: selected._dp,
      wine_bottle_size: selected.bottle_size || selected.wines?.bottle_volume || '75',
      sale_price: salePrice ? parseFloat(salePrice) : null, quantity: qty,
      tasting_note: tastingNote||null, producer_note: producerNote||null, source_id: parentId,
    })
    if (error) { alert('Failed to add bottle: ' + error.message); setSaving(false); return }
    setJustAdded(selected._desc)
    setSelected(null); setSearch(''); setResults([]); setQty(1); setSalePrice(''); setTastingNote(''); setProducerNote('')
    setImageFile(null); setImagePreview(null); setScanLabel(null); setScanMatch(null); setSaving(false)
  }

  const scanMatchDesc = scanMatch ? (scanMatch.wines?.description || scanMatch.unlinked_description || '') : ''
  const MARGINS = [10, 15]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.75)', zIndex:250, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'540px', border:'1px solid var(--border)', marginTop:'8px' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', padding:'18px 18px 0' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300 }}>Add a Bottle</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--muted)' }}>✕</button>
        </div>
        <div style={{ padding:'14px 18px 22px' }}>
          {justAdded && (
            <div style={{ background:'rgba(45,106,79,0.1)', border:'1px solid rgba(45,106,79,0.3)', padding:'10px 14px', marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'#2d6a4f' }}>✓ Added: <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{justAdded.split(',')[0]}</span></span>
              <button onClick={onClose} style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'5px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>Done ✓</button>
            </div>
          )}
          {!selected && (
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'6px', fontFamily:'DM Mono,monospace' }}>Identify by photo</label>
              {!imagePreview ? (
                <div onClick={() => fileRef.current?.click()} style={{ border:'1px dashed var(--border)', padding:'11px', textAlign:'center', cursor:'pointer', background:'var(--white)', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }} onMouseEnter={e => e.currentTarget.style.borderColor='var(--wine)'} onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                  <span style={{ fontSize:'16px' }}>📷</span>
                  <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', letterSpacing:'0.08em' }}>PHOTO FROM CAMERA ROLL</span>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display:'none' }} />
                </div>
              ) : (
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                  <img src={imagePreview} alt="Label" style={{ width:'52px', height:'66px', objectFit:'cover', border:'1px solid var(--border)', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    {!scanLabel && !scanning && <button onClick={analyseImage} style={{ background:'var(--ink)', color:'#d4ad45', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', width:'100%' }}>🔍 Read Label</button>}
                    {scanning && <div style={{ padding:'8px 0', fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)' }}>🔍 Reading label…</div>}
                    {scanLabel && !scanning && <div style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'#2d6a4f' }}>✓ {[scanLabel.wine_name, scanLabel.producer, scanLabel.vintage].filter(Boolean).join(' · ')}</div>}
                    <button onClick={() => { setImageFile(null); setImagePreview(null); setScanLabel(null); setScanMatch(null) }} style={{ display:'block', marginTop:'5px', background:'none', border:'none', fontSize:'10px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace' }}>✕ Remove</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {scanMatch && !selected && (
            <div onClick={() => applyEntry(scanMatch)} style={{ marginBottom:'12px', background:'rgba(45,106,79,0.08)', border:'2px solid rgba(45,106,79,0.5)', padding:'14px 16px', cursor:'pointer' }} onMouseEnter={e => e.currentTarget.style.background='rgba(45,106,79,0.15)'} onMouseLeave={e => e.currentTarget.style.background='rgba(45,106,79,0.08)'}>
              <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#2d6a4f', letterSpacing:'0.1em', marginBottom:'6px' }}>✓ MATCHED IN STUDIO — TAP TO SELECT</div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'16px', fontWeight:500 }}>{scanMatchDesc.split(',')[0]}</div>
              {scanMatchDesc.includes(',') && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginTop:'1px' }}>{scanMatchDesc.split(',').slice(1).join(',').trim()}</div>}
              <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'4px' }}>
                {scanMatch.wines?.vintage || scanMatch.unlinked_vintage || ''}{scanMatch.dp_price && ` · DP £${parseFloat(scanMatch.dp_price).toFixed(2)}`}{` · ${scanMatch.quantity} in studio`}
              </div>
            </div>
          )}
          {scanLabel && !scanMatch && !selected && results.length === 0 && (
            <div style={{ marginBottom:'12px', background:'rgba(192,57,43,0.05)', border:'1px solid rgba(192,57,43,0.2)', padding:'12px 14px' }}>
              <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#c0392b', letterSpacing:'0.1em', marginBottom:'4px' }}>NOT FOUND IN STUDIO</div>
              <div style={{ fontSize:'12px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginBottom:'10px' }}>{[scanLabel.wine_name, scanLabel.producer].filter(Boolean).join(', ')} {scanLabel.vintage || ''} isn't in your studio inventory.</div>
              <button onClick={() => { const desc=[scanLabel.wine_name,scanLabel.producer].filter(Boolean).join(', '); applyEntry({id:null,quantity:0,dp_price:null,sale_price:null,bottle_size:'75',colour:scanLabel.colour||'',unlinked_description:desc,unlinked_vintage:scanLabel.vintage||'',source_id:null,wines:null}) }} style={{ background:'var(--ink)', color:'var(--white)', border:'none', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>Add to box anyway →</button>
            </div>
          )}
          {!selected && (
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'6px', fontFamily:'DM Mono,monospace' }}>{scanMatch ? 'Or search manually' : justAdded ? 'Search for next bottle' : 'Search studio inventory'}</label>
              <input value={search} onChange={e => { setSearch(e.target.value); searchStudio(e.target.value) }} placeholder="Start typing a wine name…" style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
              {results.length > 0 && (
                <div style={{ border:'1px solid var(--border)', borderTop:'none', background:'var(--white)', maxHeight:'180px', overflowY:'auto' }}>
                  {results.map(entry => {
                    const w = entry.wines
                    const desc = w?.description || entry.unlinked_description || ''
                    const vintage = w?.vintage || entry.unlinked_vintage || ''
                    const colour = w?.colour || entry.colour || ''
                    return (
                      <div key={entry.id} onClick={() => applyEntry(entry)} style={{ padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid #ede6d6', display:'flex', alignItems:'center', gap:'8px' }} onMouseEnter={e => e.currentTarget.style.background='#f5f0e8'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:colourDot(colour), flexShrink:0, display:'inline-block' }}></span>
                        <div>
                          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{desc}</div>
                          <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono,monospace' }}>
                            {vintage}{sizeBadge(entry.bottle_size) ? ` · ${sizeBadge(entry.bottle_size)}` : ''} · DP {entry.dp_price ? `£${parseFloat(entry.dp_price).toFixed(2)}` : '—'} · {entry.quantity} avail
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {selected && (
            <>
              <div style={{ background:'rgba(107,30,46,0.06)', border:'1px solid rgba(107,30,46,0.2)', padding:'10px 12px', marginBottom:'12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{selected._desc.split(',')[0]}</div>
                    {selected._desc.includes(',') && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginTop:'1px' }}>{selected._desc.split(',').slice(1).join(',').trim()}</div>}
                    <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'3px' }}>
                      {selected._vintage}{selected._region && ` · ${selected._region}`}{sizeBadge(selected.bottle_size) ? ` · ${sizeBadge(selected.bottle_size)}` : ''} · {selected.quantity} in studio · DP {selected._dp ? `£${selected._dp.toFixed(2)}` : '—'}
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setScanMatch(null) }} style={{ background:'none', border:'none', fontSize:'12px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace', flexShrink:0 }}>✕ change</button>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>Quantity</label>
                  <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value)||1)} onFocus={e => e.target.select()} style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'16px', fontWeight:600, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>Sale price (£/btl)</label>
                  <input type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" onFocus={e => e.target.select()} style={{ width:'100%', border:'2px solid rgba(107,30,46,0.25)', background:'rgba(107,30,46,0.03)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'14px', fontWeight:600, outline:'none', boxSizing:'border-box', color:'var(--wine)' }} />
                  {salePrice && selected._dp && (() => { const m=((parseFloat(salePrice)-selected._dp)/selected._dp*100); return <div style={{ fontSize:'10px', color:m>=0?'#2d6a4f':'#c0392b', marginTop:'3px', fontFamily:'DM Mono,monospace' }}>{m>=0?'+':''}{m.toFixed(1)}% on DP</div> })()}
                </div>
              </div>
              {selected._dp && (
                <div style={{ display:'flex', gap:'6px', marginBottom:'10px', alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', flexShrink:0 }}>Quick:</span>
                  {MARGINS.map(pct => { const price=(selected._dp*(1+pct/100)).toFixed(2); return (
                    <button key={pct} onClick={() => setSalePrice(price)} style={{ padding:'4px 9px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.06em', border:salePrice===price?'2px solid var(--wine)':'1px solid var(--border)', background:salePrice===price?'rgba(107,30,46,0.08)':'var(--white)', color:salePrice===price?'var(--wine)':'var(--muted)', cursor:'pointer', fontWeight:salePrice===price?600:400 }}>+{pct}% · £{price}</button>
                  )})}
                </div>
              )}
              <div style={{ marginBottom:'10px' }}>
                <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>Tasting note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(italic on pull list)</span></label>
                <textarea value={tastingNote} onChange={e => setTastingNote(e.target.value)} placeholder="Rich, concentrated dark fruit with silky tannins…" rows={3} style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontStyle:'italic', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
              </div>
              <div style={{ marginBottom:'14px' }}>
                <label style={{ display:'block', fontSize:'10px', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace', letterSpacing:'0.1em', textTransform:'uppercase' }}>Producer note <span style={{ color:'rgba(107,30,46,0.5)', textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
                <textarea value={producerNote} onChange={e => setProducerNote(e.target.value)} placeholder="Brief context about the producer or appellation…" rows={2} style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:'11px', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
              </div>
              <button onClick={confirm} disabled={saving} style={{ width:'100%', background:'var(--wine)', color:'var(--white)', border:'none', padding:'14px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.15em', textTransform:'uppercase', cursor:saving?'wait':'pointer', fontWeight:600 }}>
                {saving ? 'Adding…' : '✓ Add to Box'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Multi Bottle Modal ───────────────────────────────────────────────────────
function MultiBottleModal({ onAddAll, onClose }) {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [bottles, setBottles] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  function handleImageSelect(e) {
    const file = e.target.files[0]; if (!file) return
    setImageFile(file); setBottles([])
    const reader = new FileReader(); reader.onload = ev => setImagePreview(ev.target.result); reader.readAsDataURL(file)
  }

  async function analyseMulti() {
    if (!imageFile) return; setScanning(true)
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(imageFile) })
      const resp = await fetch('/api/analyse-label', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imageBase64:base64, mediaType:imageFile.type, mode:'multi' }) })
      const result = await resp.json()
      if (!result.success) throw new Error(result.error)
      const labels = Array.isArray(result.data) ? result.data : [result.data]
      const enriched = await Promise.all(labels.map(async (label) => {
        const terms = [label.wine_name, label.producer, label.wine_name?.split(' ')[0]].filter(Boolean)
        let match = null
        for (const term of terms) { const { data } = await supabase.rpc('search_studio', { search_term: term }); if (data?.length > 0) { match = normaliseRow(data[0]); break } }
        return { label, match, status:'pending', salePrice: match?.sale_price ? String(parseFloat(match.sale_price)) : '', qty:1 }
      }))
      setBottles(enriched)
    } catch (err) { alert('Multi-label read failed: ' + err.message) }
    setScanning(false)
  }

  function updateBottle(idx, patch) { setBottles(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b)) }

  async function confirmAll() {
    const toAdd = bottles.filter(b => b.status === 'confirmed'); if (!toAdd.length) return; setSaving(true)
    const items = await Promise.all(toAdd.map(async (b) => {
      const entry = b.match; const w = entry?.wines
      const desc = w?.description || entry?.unlinked_description || [b.label.wine_name, b.label.producer].filter(Boolean).join(', ')
      const vintage = w?.vintage || entry?.unlinked_vintage || b.label.vintage || ''
      const colour = w?.colour || entry?.colour || b.label.colour || ''
      const region = w?.region || b.label.region || ''
      const dp = entry?.dp_price ? parseFloat(entry.dp_price) : null
      const sid = entry?.id ? await ensureSourceId(entry.id, entry) : generateSourceId(desc, vintage, colour, '75')
      return { studio_id:entry?.id||null, wine_description:desc, wine_vintage:vintage, wine_colour:colour, wine_region:region, dp_price:dp, sale_price:b.salePrice?parseFloat(b.salePrice):null, quantity:b.qty, tasting_note:null, producer_note:null, source_id:sid, wine_bottle_size:entry?.bottle_size||'75' }
    }))
    const { error } = await onAddAll(items)
    if (error) { alert('Failed to add bottles: ' + error.message); setSaving(false); return }
    setSaving(false); onClose()
  }

  const confirmedCount = bottles.filter(b => b.status === 'confirmed').length
  const pendingCount = bottles.filter(b => b.status === 'pending').length

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
              <div onClick={() => fileRef.current?.click()} style={{ border:'1px dashed var(--border)', padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--white)', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }} onMouseEnter={e => e.currentTarget.style.borderColor='var(--wine)'} onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <span style={{ fontSize:'28px' }}>📷</span>
                <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', letterSpacing:'0.08em' }}>PHOTO FROM CAMERA ROLL</span>
                <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)' }}>Labels can be at any angle</span>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display:'none' }} />
              </div>
            ) : (
              <div>
                <img src={imagePreview} alt="Bottles" style={{ width:'100%', maxHeight:'220px', objectFit:'contain', border:'1px solid var(--border)', background:'var(--white)' }} />
                <div style={{ display:'flex', gap:'8px', marginTop:'8px', alignItems:'center' }}>
                  {!bottles.length && !scanning && <button onClick={analyseMulti} style={{ background:'var(--ink)', color:'#d4ad45', border:'none', padding:'9px 16px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', flex:1 }}>🔍 Read All Labels</button>}
                  {scanning && <div style={{ flex:1, padding:'9px', fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)', textAlign:'center' }}>🔍 Reading labels…</div>}
                  <button onClick={() => { setImageFile(null); setImagePreview(null); setBottles([]) }} style={{ background:'none', border:'1px solid var(--border)', padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', cursor:'pointer' }}>✕ Retake</button>
                </div>
              </div>
            )}
          </div>
          {bottles.length > 0 && (
            <div>
              <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'10px' }}>{bottles.length} bottle{bottles.length!==1?'s':''} detected — confirm each to add to box</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
                {bottles.map((b, idx) => {
                  const entry = b.match; const w = entry?.wines
                  const desc = w?.description || entry?.unlinked_description || [b.label.wine_name, b.label.producer].filter(Boolean).join(', ')
                  const vintage = w?.vintage || entry?.unlinked_vintage || b.label.vintage || ''
                  const colour = w?.colour || entry?.colour || b.label.colour || ''
                  const dp = entry?.dp_price ? parseFloat(entry.dp_price) : null
                  const isConfirmed = b.status==='confirmed'; const isSkipped = b.status==='skipped'
                  const fd=desc||''; const ci=fd.indexOf(','); const wp=ci>-1?fd.slice(0,ci).trim():fd; const pp=ci>-1?fd.slice(ci+1).trim():''
                  return (
                    <div key={idx} style={{ border:`2px solid ${isConfirmed?'rgba(45,106,79,0.5)':isSkipped?'rgba(0,0,0,0.1)':'var(--border)'}`, background:isConfirmed?'rgba(45,106,79,0.06)':isSkipped?'rgba(0,0,0,0.03)':'var(--white)', padding:'12px 14px', opacity:isSkipped?0.5:1 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px', marginBottom:'8px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:colourDot(colour), display:'inline-block', flexShrink:0 }}></span>
                            <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{wp||'—'}</span>
                            {vintage && <span style={{ fontFamily:'DM Mono,monospace', fontSize:'11px', color:'var(--muted)' }}>{vintage}</span>}
                            {b.label.confidence==='low' && <span style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#c0392b' }}>⚠ low confidence</span>}
                          </div>
                          {pp && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginLeft:'15px', marginTop:'1px' }}>{pp}</div>}
                          {entry ? <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#2d6a4f', marginLeft:'15px', marginTop:'4px' }}>✓ in studio · {entry.quantity} avail{dp?` · DP £${dp.toFixed(2)}`:''}</div>
                                 : <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'#c0392b', marginLeft:'15px', marginTop:'4px' }}>Not found in studio</div>}
                          <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginLeft:'15px', marginTop:'2px' }}>Read: {[b.label.wine_name,b.label.producer].filter(Boolean).join(', ')} {b.label.vintage||''}</div>
                        </div>
                        {!isConfirmed && <button onClick={() => updateBottle(idx, { status:isSkipped?'pending':'skipped' })} style={{ background:'none', border:'none', fontSize:'11px', color:'var(--muted)', cursor:'pointer', fontFamily:'DM Mono,monospace', flexShrink:0, padding:'2px 4px' }}>{isSkipped?'undo':'✕'}</button>}
                      </div>
                      {!isSkipped && (
                        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                            <label style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Qty</label>
                            <input type="number" min="1" value={b.qty} onChange={e => updateBottle(idx, { qty:parseInt(e.target.value)||1 })} onFocus={e => e.target.select()} style={{ width:'48px', border:'1px solid var(--border)', background:'var(--cream)', padding:'5px 6px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', textAlign:'center' }} />
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'4px', flex:1 }}>
                            <label style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>Sale £</label>
                            <input type="number" step="0.01" value={b.salePrice} onChange={e => updateBottle(idx, { salePrice:e.target.value })} onFocus={e => e.target.select()} placeholder="0.00" style={{ width:'80px', border:'2px solid rgba(107,30,46,0.2)', background:'rgba(107,30,46,0.03)', padding:'5px 6px', fontFamily:'DM Mono,monospace', fontSize:'13px', fontWeight:600, outline:'none', color:'var(--wine)' }} />
                            {b.salePrice && dp && (() => { const m=((parseFloat(b.salePrice)-dp)/dp*100); return <span style={{ fontSize:'10px', color:m>=0?'#2d6a4f':'#c0392b', fontFamily:'DM Mono,monospace' }}>{m>=0?'+':''}{m.toFixed(0)}%</span> })()}
                          </div>
                          {isConfirmed
                            ? <button onClick={() => updateBottle(idx, { status:'pending' })} style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'6px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>✓ confirmed</button>
                            : <button onClick={() => updateBottle(idx, { status:'confirmed' })} style={{ background:'none', border:'2px solid rgba(45,106,79,0.5)', color:'#2d6a4f', padding:'6px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>✓ confirm</button>
                          }
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {pendingCount > 0 && confirmedCount === 0 && <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', flex:1 }}>Confirm at least one bottle above</div>}
                {confirmedCount > 0 && (
                  <button onClick={confirmAll} disabled={saving} style={{ flex:1, background:'var(--wine)', color:'var(--white)', border:'none', padding:'13px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.15em', textTransform:'uppercase', cursor:saving?'wait':'pointer', fontWeight:600 }}>
                    {saving ? 'Adding…' : `✓ Add ${confirmedCount} bottle${confirmedCount!==1?'s':''} to Box`}
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
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeBox, setActiveBox] = useState(null)
  const [activeItems, setActiveItems] = useState([])
  const [showNewBoxModal, setShowNewBoxModal] = useState(false)
  const [showAddBottle, setShowAddBottle] = useState(false)
  const [showMultiBottle, setShowMultiBottle] = useState(false)
  const [showPullList, setShowPullList] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [editingBox, setEditingBox] = useState(false)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [activeInvoice, setActiveInvoice] = useState(null)
  const [boxDraft, setBoxDraft] = useState({ name:'', buyer_name:'', buyer_email:'' })
  const [dragOverId, setDragOverId] = useState(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [saving, setSaving] = useState(false)
  const [priceCheckDiffs, setPriceCheckDiffs] = useState(null)
  const [statusMsg, setStatusMsg] = useState(null)
  const [contacts, setContacts] = useState([])
  const [newName, setNewName] = useState('')
  const [newBuyer, setNewBuyer] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newNotes, setNewNotes] = useState('')

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else {
      fetchContacts()
      supabase.from('boxes').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) return
          const loaded = data || []
          setBoxes(loaded)
          setLoading(false)
          if (loaded.length > 0) {
            setActiveBox(loaded[0])
            fetchBoxItemsById(loaded[0].id)
          }
        })
    }
  }, [])

  function showStatus(type, text, durationMs = 4000) {
    setStatusMsg({ type, text }); setTimeout(() => setStatusMsg(null), durationMs)
  }

  async function fetchBoxes() {
    setLoading(true)
    const { data, error } = await supabase.from('boxes').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false })
    if (error) showStatus('error', 'Failed to load boxes: ' + error.message)
    const loaded = data || []
    setBoxes(loaded); setLoading(false)
  }

  async function fetchContacts() {
    const { data } = await supabase.from('contacts').select('*').order('name')
    setContacts(data || [])
  }

  async function fetchBoxItemsById(boxId) {
    const { data, error } = await supabase.rpc('get_box_items_with_notes', { p_box_id: boxId })
    if (error) showStatus('error', 'Failed to load items: ' + error.message)
    setActiveItems(data || [])
  }

  async function openBox(box) {
    setActiveBox(box); await fetchBoxItemsById(box.id)
    if (typeof window !== 'undefined' && window.innerWidth < 700) setShowSidebar(false)
  }

  async function createBox() {
    if (!newName || !newBuyer) return; setSaving(true)
    const { data, error } = await supabase.from('boxes').insert({ name:newName, buyer_name:newBuyer, buyer_email:newEmail||null, notes:newNotes||null, status:'Draft' }).select().single()
    if (error) { showStatus('error', 'Failed to create box: ' + error.message); setSaving(false); return }
    await fetchBoxes(); setShowNewBoxModal(false)
    setNewName(''); setNewBuyer(''); setNewEmail(''); setNewNotes('')
    openBox(data); setSaving(false)
  }

  async function addItemToBox(item) {
    if (!activeBox) return { error: new Error('No active box') }
    const { error } = await supabase.from('box_items').insert({ box_id:activeBox.id, ...item, sort_order:activeItems.length })
    if (!error) { await fetchBoxItemsById(activeBox.id); await updateBoxTotals(activeBox.id) }
    return { error }
  }

  async function addMultipleToBox(items) {
    if (!activeBox || !items.length) return { error:null }
    const rows = items.map((item, i) => ({ box_id:activeBox.id, ...item, sort_order:activeItems.length+i }))
    const { error } = await supabase.from('box_items').insert(rows)
    if (!error) { await fetchBoxItemsById(activeBox.id); await updateBoxTotals(activeBox.id) }
    return { error }
  }

  async function removeItem(itemId) {
    if (!confirm('Remove this bottle?')) return
    const { error } = await supabase.from('box_items').delete().eq('id', itemId)
    if (error) { showStatus('error', 'Failed to remove item: ' + error.message); return }
    await fetchBoxItemsById(activeBox.id); await updateBoxTotals(activeBox.id)
  }

  async function updateItemQty(itemId, newQty) {
    if (newQty < 1) return
    const { error } = await supabase.from('box_items').update({ quantity: newQty }).eq('id', itemId)
    if (error) { showStatus('error', 'Failed to update quantity'); return }
    setActiveItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i))
    await updateBoxTotals(activeBox.id)
  }

  async function updateBoxTotals(boxId) {
    const { data: items } = await supabase.from('box_items').select('dp_price, sale_price, quantity').eq('box_id', boxId)
    if (!items) return
    const totalDP = items.reduce((s, i) => s + (parseFloat(i.dp_price)||0) * (i.quantity||1), 0)
    const totalSale = items.reduce((s, i) => s + (parseFloat(i.sale_price)||0) * (i.quantity||1), 0)
    await supabase.from('boxes').update({ total_dp:totalDP, total_sale:totalSale }).eq('id', boxId)
    setActiveBox(prev => prev ? { ...prev, total_dp:totalDP, total_sale:totalSale } : prev)
  }

  async function confirmBox() {
    if (!activeBox) return
    setSaving(true)
    const diffs = []
    for (const item of activeItems) {
      if (item.studio_id) {
        const { data: se } = await supabase.from('studio').select('id, quantity, status, sale_price').eq('id', item.studio_id).maybeSingle()
        if (se && se.sale_price !== null) {
          const studioPrice = parseFloat(se.sale_price)
          const boxPrice = parseFloat(item.sale_price)
          if (!isNaN(studioPrice) && !isNaN(boxPrice) && Math.abs(studioPrice - boxPrice) > 0.001) {
            diffs.push({ item, studioPrice, boxPrice })
          }
        }
      }
    }
    setSaving(false)
    if (diffs.length > 0) { setPriceCheckDiffs(diffs); return }
    if (!confirm(`Mark "${activeBox.name}" as Confirmed and deduct quantities from studio?`)) return
    await doConfirmBox([])
  }

  async function doConfirmBox(pricesToUpdate) {
    setSaving(true)
    for (const { item, studioPrice } of pricesToUpdate) {
      await supabase.from('box_items').update({ sale_price: studioPrice }).eq('id', item.id)
    }
    for (const item of activeItems) {
      if (item.studio_id) {
        const { data: se } = await supabase.from('studio').select('id, quantity, status').eq('id', item.studio_id).maybeSingle()
        if (se) { const newQty = Math.max(0, (se.quantity || 0) - (item.quantity || 1)); await supabase.from('studio').update({ quantity: newQty, status: se.status }).eq('id', se.id) }
      }
    }
    const { error } = await supabase.from('boxes').update({ status: 'Confirmed' }).eq('id', activeBox.id)
    if (error) { showStatus('error', 'Failed to confirm box: ' + error.message); setSaving(false); return }
    setActiveBox(prev => ({ ...prev, status: 'Confirmed' }))
    await fetchBoxes(); setSaving(false); setPriceCheckDiffs(null)
    showStatus('success', `"${activeBox.name}" confirmed — studio quantities updated.`)
  }

  async function deleteBox(boxId) {
    if (!confirm('Delete this box?')) return
    const { error } = await supabase.from('boxes').delete().eq('id', boxId)
    if (error) { showStatus('error', 'Failed to delete box: ' + error.message); return }
    if (activeBox?.id === boxId) { setActiveBox(null); setActiveItems([]) }
    await fetchBoxes()
    if (typeof window !== 'undefined' && window.innerWidth < 700) setShowSidebar(true)
  }

  async function linkClientToBox(contactId) {
    if (!activeBox) return
    const contact = contacts.find(c => c.id === contactId)
    const updates = { contact_id: contactId || null }
    if (contact) { updates.buyer_name = contact.name; if (contact.email) updates.buyer_email = contact.email }
    await supabase.from('boxes').update(updates).eq('id', activeBox.id)
    setActiveBox(prev => ({ ...prev, ...updates }))
    await fetchBoxes()
    showStatus('success', contact ? `Linked to ${contact.name}` : 'Client unlinked')
  }

  async function fetchInvoice(invoiceId) {
    if (!invoiceId) { setActiveInvoice(null); return }
    const { data } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
    setActiveInvoice(data || null)
    const { data: junctions } = await supabase.from('invoice_boxes').select('box_id').eq('invoice_id', invoiceId)
    if (junctions?.length) {
      const allItems = []
      for (const { box_id } of junctions) {
        const { data: items } = await supabase.rpc('get_box_items_with_notes', { p_box_id: box_id })
        if (items) allItems.push(...items)
      }
      setActiveItems(allItems)
    }
  }

  async function createInvoice(initials, boxIds) {
    if (!activeBox || !boxIds?.length) return
    const year = new Date().getFullYear()
    const { data: invNum, error: numErr } = await supabase.rpc('next_invoice_number', { p_initials: initials, p_year: year })
    if (numErr) { showStatus('error', 'Failed to generate invoice number: ' + numErr.message); return }
    const selectedBoxes = boxes.filter(b => boxIds.includes(b.id))
    const total = selectedBoxes.reduce((s, b) => s + (parseFloat(b.total_sale) || 0), 0)
    const { data: inv, error } = await supabase.from('invoices').insert({
      invoice_number: invNum, box_id: activeBox.id,
      buyer_name: activeBox.buyer_name, buyer_email: activeBox.buyer_email || null,
      invoice_date: new Date().toISOString().slice(0,10),
      total_amount: total, status: 'unpaid',
    }).select().single()
    if (error) { showStatus('error', 'Failed to create invoice: ' + error.message); return }
    await supabase.from('invoice_boxes').insert(boxIds.map(bid => ({ invoice_id: inv.id, box_id: bid })))
    await Promise.all(boxIds.map(bid =>
      supabase.from('boxes').update({ invoice_id: inv.id, status: 'Invoiced' }).eq('id', bid)
    ))
    setActiveBox(prev => ({ ...prev, status: 'Invoiced', invoice_id: inv.id }))
    await fetchBoxes()
    const allItems = []
    for (const bid of boxIds) {
      const { data } = await supabase.rpc('get_box_items_with_notes', { p_box_id: bid })
      if (data) allItems.push(...data)
    }
    setActiveItems(allItems)
    setActiveInvoice(inv)
    setShowCreateInvoice(false)
    setShowInvoice(true)
    showStatus('success', `Invoice ${inv.invoice_number} created for ${boxIds.length} box${boxIds.length !== 1 ? 'es' : ''}.`)
  }

  async function markInvoicePaid(invoiceId) {
    const { error } = await supabase.from('invoices').update({ status:'paid', paid_date: new Date().toISOString().slice(0,10) }).eq('id', invoiceId)
    if (error) { showStatus('error', 'Failed to mark paid: ' + error.message); return }
    setActiveInvoice(prev => prev ? { ...prev, status:'paid' } : prev)
    showStatus('success', 'Invoice marked as paid.')
  }

  async function saveBoxEdit() {
    if (!boxDraft.name.trim() || !boxDraft.buyer_name.trim()) return
    const { error } = await supabase.from('boxes').update({
      name: boxDraft.name, buyer_name: boxDraft.buyer_name, buyer_email: boxDraft.buyer_email || null,
    }).eq('id', activeBox.id)
    if (error) { showStatus('error', 'Failed to save: ' + error.message); return }
    setActiveBox(prev => ({ ...prev, name: boxDraft.name, buyer_name: boxDraft.buyer_name, buyer_email: boxDraft.buyer_email || null }))
    setBoxes(prev => prev.map(b => b.id === activeBox.id ? { ...b, name: boxDraft.name, buyer_name: boxDraft.buyer_name } : b))
    setEditingBox(false); showStatus('success', 'Box updated.')
  }

  async function handleDrop(draggedId, targetId) {
    if (draggedId === targetId) return
    const reordered = [...boxes]
    const fromIdx = reordered.findIndex(b => b.id === draggedId)
    const toIdx   = reordered.findIndex(b => b.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setBoxes(reordered); setDragOverId(null)
    await Promise.all(reordered.map((b, i) => supabase.from('boxes').update({ sort_order: i }).eq('id', b.id)))
  }

  const statusColour = s => s==='Confirmed'?'#2d6a4f':s==='Sent'?'#1a5a8a':'#8a6f1e'
  const totalBottles = activeItems.reduce((s, i) => s+(i.quantity||1), 0)
  const totalSale = activeItems.reduce((s, i) => s+(parseFloat(i.sale_price)||0)*(i.quantity||1), 0)
  const totalDP = activeItems.reduce((s, i) => s+(parseFloat(i.dp_price)||0)*(i.quantity||1), 0)
  const marginPct = totalDP > 0 ? `+${((totalSale-totalDP)/totalDP*100).toFixed(1)}%` : '—'
  const NAV = [['Inventory','/admin'],['Studio','/studio'],['Box Builder','/boxes'],['Labels','/labels'],['Buyer View','/buyer'],['Local Sales','/local'],['Consignment','/consignment']]

  if (loading) return (<div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'24px', color:'var(--wine)' }}>Loading…</div></div>)

  return (
    <div style={{ minHeight:'100vh', background:'var(--cream)', overflowX:'hidden' }}>
      {/* Nav */}
      <div style={{ background:'var(--ink)', color:'var(--white)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', height:'52px', position:'fixed', top:0, left:0, width:'100%', zIndex:100, boxSizing:'border-box' }}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300, letterSpacing:'0.1em', color:'#d4ad45', flexShrink:0, marginRight:'8px' }}>Cellar</div>
        <div style={{ display:'flex', gap:'1px', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          {NAV.map(([label, path]) => (<button key={path} onClick={() => router.push(path)} style={{ background:path==='/boxes'?'rgba(107,30,46,0.6)':'none', color:path==='/boxes'?'#d4ad45':'rgba(253,250,245,0.5)', border:'none', fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', padding:'6px 8px', borderRadius:'2px', whiteSpace:'nowrap', flexShrink:0 }}>{label}</button>))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.5)', fontFamily:'DM Mono,monospace', fontSize:'9px', cursor:'pointer', padding:'4px 8px', flexShrink:0, marginLeft:'6px' }}>Out</button>
      </div>

      {statusMsg && (
        <div style={{ position:'fixed', top:'60px', left:'50%', transform:'translateX(-50%)', zIndex:400, background:statusMsg.type==='success'?'rgba(45,106,79,0.95)':'rgba(192,57,43,0.95)', color:'var(--white)', padding:'10px 20px', fontFamily:'DM Mono,monospace', fontSize:'12px', letterSpacing:'0.05em', border:'1px solid rgba(255,255,255,0.15)', whiteSpace:'nowrap', pointerEvents:'none' }}>
          {statusMsg.type==='success'?'✓ ':'✕ '}{statusMsg.text}
        </div>
      )}

      <div style={{ paddingTop:'52px', display:'grid', gridTemplateColumns:showSidebar&&!activeBox?'1fr':showSidebar?'minmax(220px,260px) 1fr':'1fr', minHeight:'calc(100vh - 52px)' }}>

        {/* Sidebar */}
        {showSidebar && (
          <div style={{ borderRight:activeBox?'1px solid var(--border)':'none', padding:'16px', background:'var(--cream)' }}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'14px' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', fontWeight:300 }}>Boxes</div>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => setShowClients(true)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'5px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                  Clients{contacts.length > 0 ? ` · ${contacts.length}` : ''}
                </button>
                <button onClick={() => setShowNewBoxModal(true)} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'5px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>+ New</button>
              </div>
            </div>
            {boxes.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', border:'1px dashed var(--border)', background:'var(--white)' }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', color:'var(--muted)', marginBottom:'10px' }}>No boxes yet</div>
                <button onClick={() => setShowNewBoxModal(true)} style={{ background:'none', border:'1px solid var(--wine)', color:'var(--wine)', padding:'7px 14px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer' }}>Build first box</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {boxes.map(box => (
                  <div key={box.id}
                    onClick={() => openBox(box)}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('boxId', box.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragOver={e => { e.preventDefault(); setDragOverId(box.id) }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={e => { e.preventDefault(); handleDrop(e.dataTransfer.getData('boxId'), box.id) }}
                    style={{ padding:'10px 12px', background:activeBox?.id===box.id?'var(--ink)':'var(--white)', border:`2px solid ${dragOverId===box.id?'#d4ad45':activeBox?.id===box.id?'var(--ink)':'var(--border)'}`, cursor:'grab', transition:'border-color 0.1s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'6px' }}>
                      <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', color:activeBox?.id===box.id?'#d4ad45':'var(--ink)', fontWeight:500, lineHeight:1.2 }}>{box.name}</div>
                      <span style={{ fontSize:'9px', fontFamily:'DM Mono,monospace', color:activeBox?.id===box.id?'rgba(212,173,69,0.7)':statusColour(box.status), fontWeight:500, letterSpacing:'0.08em', flexShrink:0 }}>{box.status}</span>
                    </div>
                    <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:activeBox?.id===box.id?'rgba(253,250,245,0.5)':'var(--muted)', marginTop:'2px' }}>{box.buyer_name}</div>
                    {box.total_sale > 0 && <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:activeBox?.id===box.id?'rgba(212,173,69,0.7)':'var(--wine)', marginTop:'3px' }}>£{parseFloat(box.total_sale).toFixed(2)}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main */}
        <div style={{ padding:'16px' }}>
          {!showSidebar && (<button onClick={() => { setShowSidebar(true); setActiveBox(null) }} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'6px 12px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', letterSpacing:'0.08em', marginBottom:'14px' }}>← All Boxes</button>)}

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
                <div style={{ flex:1, minWidth:0 }}>
                  {editingBox ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxWidth:'380px' }}>
                      {[['Box name',boxDraft.name,'name','Cormorant Garamond,serif','18px'],['Buyer name',boxDraft.buyer_name,'buyer_name','DM Mono,monospace','12px'],['Email',boxDraft.buyer_email,'buyer_email','DM Mono,monospace','12px']].map(([label,val,field,ff,fs]) => (
                        <div key={field} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <label style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', width:'72px', flexShrink:0 }}>{label}</label>
                          <input value={val} onChange={e => setBoxDraft(d => ({...d, [field]: e.target.value}))} onKeyDown={e => e.key === 'Enter' && saveBoxEdit()} style={{ flex:1, border:'1px solid var(--border)', background:'var(--white)', padding:'5px 8px', fontFamily:ff, fontSize:fs, outline:'none' }} />
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:'6px', marginTop:'2px' }}>
                        <button onClick={saveBoxEdit} disabled={!boxDraft.name.trim() || !boxDraft.buyer_name.trim()} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'6px 14px', fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>✓ Save</button>
                        <button onClick={() => setEditingBox(false)} style={{ background:'none', border:'1px solid var(--border)', padding:'6px 10px', fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', cursor:'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:300 }}>{activeBox.name}</div>
                        {activeBox.status === 'Draft' && (
                          <button onClick={() => { setEditingBox(true); setBoxDraft({ name: activeBox.name, buyer_name: activeBox.buyer_name, buyer_email: activeBox.buyer_email || '' }) }} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'2px 7px', fontFamily:'DM Mono,monospace', fontSize:'10px', cursor:'pointer', flexShrink:0 }}>✏</button>
                        )}
                      </div>
                      <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'2px' }}>
                        {activeBox.buyer_name}{activeBox.buyer_email && ` · ${activeBox.buyer_email}`}
                        <span style={{ marginLeft:'10px', color:statusColour(activeBox.status), fontWeight:500 }}>{activeBox.status}</span>
                      </div>
                      {contacts.length > 0 && (
                        <div style={{ marginTop:'6px' }}>
                          <select value={activeBox.contact_id || ''} onChange={e => linkClientToBox(e.target.value || null)} style={{ border:'1px solid var(--border)', background:'var(--cream)', padding:'4px 8px', fontFamily:'DM Mono,monospace', fontSize:'10px', outline:'none', color:'var(--muted)', cursor:'pointer' }}>
                            <option value=''>— link to client —</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {activeBox.status === 'Draft' && (
                    <>
                      <button onClick={() => setShowAddBottle(true)} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>+ One Bottle</button>
                      <button onClick={() => setShowMultiBottle(true)} style={{ background:'none', border:'1px solid var(--wine)', color:'var(--wine)', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>📷 Multi</button>
                    </>
                  )}
                  {activeItems.length > 0 && <button onClick={() => setShowPullList(true)} style={{ background:'none', border:'1px solid var(--ink)', color:'var(--ink)', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>🖨 Pull List</button>}
                  {activeBox.status==='Confirmed' && !activeBox.invoice_id && <button onClick={() => setShowCreateInvoice(true)} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>£ Invoice</button>}
                  {activeBox.invoice_id && <button onClick={async () => { await fetchInvoice(activeBox.invoice_id); setShowInvoice(true) }} style={{ background:'none', border:'1px solid var(--wine)', color:'var(--wine)', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>£ View Invoice</button>}
                  {activeBox.status==='Draft' && activeItems.length > 0 && <button onClick={confirmBox} disabled={saving} style={{ background:'#2d6a4f', color:'var(--white)', border:'none', padding:'8px 14px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>{saving?'Checking…':'✓ Confirm'}</button>}
                  <button onClick={() => deleteBox(activeBox.id)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕</button>
                </div>
              </div>

              {/* Stats bar */}
              {activeItems.length > 0 && (
                <div style={{ display:'flex', gap:'16px', padding:'10px 14px', background:'var(--white)', border:'1px solid var(--border)', marginBottom:'12px', fontSize:'11px', flexWrap:'wrap' }}>
                  {[['bottles', totalBottles], ['cost', `£${totalDP.toFixed(2)}`], ['sale', `£${totalSale.toFixed(2)}`], ['margin', marginPct]].map(([label, val]) => (
                    <div key={label} style={{ display:'flex', gap:'5px', alignItems:'baseline' }}>
                      <span style={{ fontWeight:600, color: label==='margin' ? '#2d6a4f' : 'var(--wine)', fontSize:'13px', fontFamily:'DM Mono,monospace' }}>{val}</span>
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
                    const margin = item.sale_price && item.dp_price ? ((parseFloat(item.sale_price)-parseFloat(item.dp_price))/parseFloat(item.dp_price)*100).toFixed(1) : null
                    const badge = sizeBadge(item.wine_bottle_size)
                    return (
                      <div key={item.id} style={{ padding:'12px 14px', borderBottom:idx<activeItems.length-1?'1px solid #ede6d6':'none', display:'grid', gridTemplateColumns:'1fr auto', gap:'10px', alignItems:'start' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:'7px', flexWrap:'wrap' }}>
                            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:colourDot(item.wine_colour), display:'inline-block', flexShrink:0 }}></span>
                            <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{wp}</span>
                            {item.wine_vintage && <span style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>{item.wine_vintage}</span>}
                            {badge && <span style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--wine)', fontWeight:600, border:'1px solid rgba(107,30,46,0.3)', padding:'1px 5px', borderRadius:'2px' }}>{badge}</span>}
                            {item.quantity > 1 && <span style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', background:'var(--ink)', color:'#d4ad45', padding:'1px 5px', borderRadius:'2px' }}>×{item.quantity}</span>}
                          </div>
                          {pp && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'var(--ink)', marginLeft:'15px', marginTop:'1px' }}>{pp}</div>}
                          {item.wine_region && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginLeft:'15px', marginTop:'2px' }}>{item.wine_region}</div>}
                          {item.tasting_note && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', fontStyle:'italic', color:'#3a2a1a', marginTop:'6px', marginLeft:'15px', lineHeight:1.5 }}>"{item.tasting_note}"</div>}
                          {item.buyer_note && <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', color:'#3a2a1a', marginTop:'6px', marginLeft:'15px', lineHeight:1.6, opacity:0.85 }}>{item.buyer_note}</div>}
                          {item.women_note && (
                            <div style={{ display:'flex', alignItems:'flex-start', gap:'5px', marginTop:'5px', marginLeft:'15px' }}>
                              <span style={{ fontSize:'13px', color:'#9b3a4a', flexShrink:0, lineHeight:1.5 }}>♀</span>
                              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'13px', fontStyle:'italic', color:'#9b3a4a', lineHeight:1.6 }}>{item.women_note}</span>
                            </div>
                          )}
                          {item.producer_note && <div style={{ fontSize:'11px', fontFamily:'DM Mono,monospace', color:'var(--muted)', marginTop:'3px', marginLeft:'15px', lineHeight:1.4 }}>{item.producer_note}</div>}
                        </div>
                        <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px' }}>
                          <div style={{ fontFamily:'DM Mono,monospace', fontSize:'14px', fontWeight:500, color:'var(--wine)' }}>{item.sale_price ? `£${parseFloat(item.sale_price).toFixed(2)}` : '—'}</div>
                          {item.dp_price && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>DP £{parseFloat(item.dp_price).toFixed(2)}</div>}
                          {margin && <div style={{ fontSize:'10px', fontFamily:'DM Mono,monospace', color:parseFloat(margin)>=0?'#2d6a4f':'#c0392b' }}>{parseFloat(margin)>=0?'+':''}{margin}%</div>}
                          {activeBox.status === 'Draft' && (
                            <div style={{ display:'flex', alignItems:'center', gap:'3px', marginTop:'4px' }}>
                              <button onClick={() => updateItemQty(item.id, (item.quantity||1) - 1)} disabled={(item.quantity||1) <= 1} style={{ width:'22px', height:'22px', border:'1px solid var(--border)', background:'var(--cream)', cursor:(item.quantity||1)>1?'pointer':'not-allowed', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', opacity:(item.quantity||1)<=1?0.4:1 }}>−</button>
                              <span style={{ fontFamily:'DM Mono,monospace', fontSize:'12px', fontWeight:600, minWidth:'18px', textAlign:'center' }}>{item.quantity||1}</span>
                              <button onClick={() => updateItemQty(item.id, (item.quantity||1) + 1)} style={{ width:'22px', height:'22px', border:'1px solid var(--border)', background:'var(--cream)', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                              <button onClick={() => removeItem(item.id)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'11px', cursor:'pointer', marginLeft:'2px', fontFamily:'DM Mono,monospace' }}>✕</button>
                            </div>
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
              {[['Box name *',newName,setNewName,'e.g. Lauren — Spring 2026','Cormorant Garamond,serif','16px'],['Buyer name *',newBuyer,setNewBuyer,'e.g. Lauren','DM Mono,monospace','13px'],['Email (optional)',newEmail,setNewEmail,'lauren@example.com','DM Mono,monospace','13px'],['Notes (optional)',newNotes,setNewNotes,'e.g. Mostly Burgundy…','DM Mono,monospace','12px']].map(([label,val,setter,ph,ff,fs]) => (
                <div key={label}>
                  <label style={{ display:'block', fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'4px', fontFamily:'DM Mono,monospace' }}>{label}</label>
                  <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={{ width:'100%', border:'1px solid var(--border)', background:'var(--white)', padding:'9px 12px', fontFamily:ff, fontSize:fs, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowNewBoxModal(false)} style={{ background:'none', border:'1px solid var(--border)', padding:'9px 18px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>Cancel</button>
              <button onClick={createBox} disabled={!newName||!newBuyer||saving} style={{ background:newName&&newBuyer?'var(--ink)':'#ccc', color:'var(--white)', border:'none', padding:'9px 18px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:newName&&newBuyer?'pointer':'not-allowed' }}>{saving?'Creating…':'Create →'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddBottle    && <AddBottleModal onAdd={addItemToBox} onClose={() => setShowAddBottle(false)} />}
      {showMultiBottle  && <MultiBottleModal onAddAll={addMultipleToBox} onClose={() => setShowMultiBottle(false)} />}
      {showPullList     && activeBox && <PullListView box={activeBox} items={activeItems} onClose={() => setShowPullList(false)} />}
      {showClients      && <ClientsModal contacts={contacts} onClose={() => setShowClients(false)} onRefresh={fetchContacts} />}
      {showCreateInvoice && activeBox && <CreateInvoiceModal box={activeBox} allBoxes={boxes} onConfirm={createInvoice} onClose={() => setShowCreateInvoice(false)} />}
      {showInvoice      && activeBox && activeInvoice && <InvoiceModal box={activeBox} items={activeItems} invoice={activeInvoice} onClose={() => setShowInvoice(false)} onMarkPaid={markInvoicePaid} />}
{priceCheckDiffs && activeBox && (
        <PriceCheckModal
          diffs={priceCheckDiffs}
          boxName={activeBox.name}
          onConfirm={pricesToUpdate => doConfirmBox(pricesToUpdate)}
          onCancel={() => setPriceCheckDiffs(null)}
        />
      )}
    </div>
  )
}

// ─── Price Check Modal ────────────────────────────────────────────────────────
function PriceCheckModal({ diffs, boxName, onConfirm, onCancel }) {
  const [updates, setUpdates] = React.useState(() => {
    const init = {}
    diffs.forEach(d => { init[d.item.id] = true })
    return init
  })
  function toggleUpdate(id) { setUpdates(prev => ({ ...prev, [id]: !prev[id] })) }
  function handleConfirm() { onConfirm(diffs.filter(d => updates[d.item.id])) }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(20,15,10,0.85)', zIndex:350, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', overflowY:'auto' }}>
      <div style={{ background:'var(--cream)', width:'100%', maxWidth:'520px', border:'1px solid var(--border)' }}>
        <div style={{ background:'var(--ink)', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', letterSpacing:'0.15em', color:'rgba(253,250,245,0.5)', textTransform:'uppercase' }}>Price check — </span>
            <span style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'#d4ad45' }}>{boxName}</span>
          </div>
          <button onClick={onCancel} style={{ background:'none', border:'1px solid rgba(253,250,245,0.2)', color:'rgba(253,250,245,0.6)', padding:'5px 10px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer' }}>✕ Cancel</button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ marginBottom:'16px', padding:'12px 16px', background:'rgba(212,173,69,0.08)', border:'1px solid rgba(212,173,69,0.3)', fontSize:'11px', fontFamily:'DM Mono,monospace', color:'#7a5e10', lineHeight:1.6 }}>
            {diffs.length} wine{diffs.length !== 1 ? 's have' : ' has'} a price difference between this box and the current studio price. Choose which to update before confirming.
          </div>
          <div style={{ border:'1px solid var(--border)', background:'var(--white)', marginBottom:'20px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 36px', padding:'8px 12px', background:'rgba(26,16,8,0.06)', borderBottom:'1px solid var(--border)' }}>
              {['Wine','Box £','Studio £',''].map(h => <div key={h} style={{ fontFamily:'DM Mono,monospace', fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', fontWeight:500 }}>{h}</div>)}
            </div>
            {diffs.map(d => {
              const fd = d.item.wine_description || ''; const ci = fd.indexOf(','); const wp = ci > -1 ? fd.slice(0, ci).trim() : fd
              const useStudio = updates[d.item.id]; const higher = d.studioPrice > d.boxPrice
              return (
                <div key={d.item.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 36px', padding:'12px', borderBottom:'1px solid #ede6d6', alignItems:'center', background: useStudio ? 'rgba(45,106,79,0.04)' : 'transparent' }}>
                  <div>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontWeight:500 }}>{wp}</div>
                    <div style={{ fontFamily:'DM Mono,monospace', fontSize:'10px', color:'var(--muted)', marginTop:'1px' }}>{d.item.wine_vintage || ''}</div>
                  </div>
                  <div style={{ fontFamily:'DM Mono,monospace', fontSize:'13px', color: useStudio ? 'var(--muted)' : 'var(--ink)', fontWeight: useStudio ? 400 : 600, textDecoration: useStudio ? 'line-through' : 'none' }}>£{d.boxPrice.toFixed(2)}</div>
                  <div style={{ fontFamily:'DM Mono,monospace', fontSize:'13px', color: useStudio ? '#2d6a4f' : 'var(--muted)', fontWeight: useStudio ? 600 : 400 }}>
                    £{d.studioPrice.toFixed(2)}<span style={{ fontSize:'9px', marginLeft:'3px', color: higher ? '#c0392b' : '#2d6a4f' }}>{higher ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <input type="checkbox" checked={!!useStudio} onChange={() => toggleUpdate(d.item.id)} style={{ width:'16px', height:'16px', cursor:'pointer', accentColor:'var(--wine)' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginBottom:'16px', fontSize:'10px', fontFamily:'DM Mono,monospace', color:'var(--muted)' }}>☑ checked = update box price to studio price before confirming</div>
          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <button onClick={onCancel} style={{ background:'none', border:'1px solid var(--border)', padding:'10px 20px', fontFamily:'DM Mono,monospace', fontSize:'11px', cursor:'pointer', color:'var(--muted)' }}>Cancel</button>
            <button onClick={handleConfirm} style={{ background:'var(--wine)', color:'var(--white)', border:'none', padding:'10px 20px', fontFamily:'DM Mono,monospace', fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>✓ Confirm Box →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
