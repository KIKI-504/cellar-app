'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBottleSize(volume, format) {
  if (!volume && !format) return '75cl'
  const v = String(volume || format || '').toLowerCase().replace(/\s/g, '')
  if (v === '150' || v === '150cl' || v === '1500' || v === '1500ml' || v.includes('magnum')) return '150cl'
  if (v === '300' || v === '300cl' || v === '3000' || v === '3000ml' || v.includes('double')) return '300cl'
  if (v === '37.5' || v === '37.5cl' || v === '375' || v === '375ml' || v.includes('half')) return '37.5cl'
  return '75cl'
}

function bottleSortKey(volume, format) {
  const s = formatBottleSize(volume, format)
  if (s === '37.5cl') return 37.5
  if (s === '150cl') return 150
  if (s === '300cl') return 300
  return 75
}

function cleanWineName(description, region, country) {
  if (!description) return description
  let name = description.trim()
  const strip = [region, country].filter(Boolean).map(s => s.trim().toLowerCase())
  let changed = true
  while (changed) {
    changed = false
    const lastComma = name.lastIndexOf(',')
    if (lastComma === -1) break
    const tail = name.slice(lastComma + 1).trim().toLowerCase()
    if (strip.some(s => s && tail === s)) { name = name.slice(0, lastComma).trim(); changed = true }
  }
  return name
}

// ─── Colour tokens ──────────────────────────────────────────────────────────

const C = {
  inkDeep: '#1b070d', ink: '#26090f', wine: '#6e1f2e',
  gold: '#b8922a', goldLight: '#c9a84c', cream: '#f4efe6',
  card: '#fbf8f1', line: '#e7decd', text: '#352a20',
  muted: '#9a8c76', white: '#fffdf9',
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconSearch() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
}
function IconPrint() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M7 17h10v4H7z"/></svg>
}
function IconInfo() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v1M12 11v5"/></svg>
}
function IconChevron({ down }) {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={down ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"}/></svg>
}
function IconBottles() {
  return (
    <svg viewBox="0 0 48 24" width="44" height="22" fill="none" stroke={C.goldLight} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2h4l1 4v11a2 2 0 0 1-4 0V6L7 2z"/><path d="M9 2v2"/>
      <path d="M23 2h4l1 4v11a2 2 0 0 1-4 0V6l-1-4z"/><path d="M25 2v2"/>
      <path d="M39 2h4l1 4v11a2 2 0 0 1-4 0V6l-1-4z"/><path d="M41 2v2"/>
    </svg>
  )
}

function pillStyle(active) {
  return {
    background: active ? C.wine : C.white,
    color: active ? C.white : C.text,
    border: '1.5px solid ' + (active ? C.wine : C.line),
    borderRadius: '999px',
    padding: '10px 18px',
    paddingRight: '36px',
    fontFamily: 'DM Mono, monospace',
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    outline: 'none',
    letterSpacing: '0.01em',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a8c76' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
  }
}

// ─── Print price list ────────────────────────────────────────────────────────

function printPriceList(wineList, displayName) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const rows = wineList.map(w => {
    const size = formatBottleSize(w.bottle_volume, w.bottle_format)
    const isMag = size === '150cl' || size === '300cl'
    const duty = isMag ? 6 : 3
    const salePrice = parseFloat(w.sale_price)
    const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
    const wsDp = ws ? (ws + duty) * 1.2 : null
    const col = (w.colour || '').toLowerCase()
    const dotCol = col.includes('red') ? '#8b2535' : col.includes('white') ? '#b5a430' : col.includes('ros') ? '#d4748a' : col.includes('spark') ? '#5a8fa8' : '#aaa'
    const displayQty = w._buyerQty != null ? w._buyerQty : (parseInt(w.quantity) || 0)
    // Magnum rows: all data cells bold except market price
    const magBold = isMag ? 'font-weight:700;color:#1a1008;' : 'color:#7a6652;'
    return `<tr>
      <td style="padding:9px 10px 9px 0;border-bottom:1px solid #ede6d6;text-align:left;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotCol};margin-right:5px;vertical-align:middle;flex-shrink:0;"></span>
        <span style="font-family:'Cormorant Garamond',serif;font-size:14px;font-weight:${isMag?'700':'500'};vertical-align:middle;">${cleanWineName(w.description, w.region, w.country)}</span>
      </td>
      <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;${magBold}">${w.vintage || '-'}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;${magBold}">${w.region || '-'}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;${magBold}">${w.colour || '-'}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;${magBold}">${size}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;text-align:center;font-family:'DM Mono',monospace;font-size:11px;${magBold}">${displayQty}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;font-weight:${isMag?'700':'400'};color:#1a1008;">£${salePrice.toFixed(2)}</td>
      <td style="padding:9px 0 9px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${wsDp ? '£' + wsDp.toFixed(2) : '-'}</td>
    </tr>`
  }).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${displayName}</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=DM+Mono:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Mono',monospace;color:#1a1008;background:#fff;padding:40px 48px;font-size:12px}@media print{body{padding:20px 28px}}</style>
  </head><body>
  <div style="margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #1a1008;">
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;"><div style="text-align:right;"><div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:300;letter-spacing:0.08em;color:#7a6652;">Belle Annee</div><div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#c8b89a;margin-top:1px;">Wines &amp; Studio</div></div></div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:300;color:#1a1008;margin-bottom:4px;">${displayName}</div>
    <div style="font-family:'DM Mono',monospace;font-size:11px;color:#c8b89a;">${date}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="border-bottom:2px solid #1a1008;">
      <th style="padding:7px 10px 7px 0;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Wine</th>
      <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Vintage</th>
      <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Region</th>
      <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Colour</th>
      <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Size</th>
      <th style="padding:7px 8px;text-align:center;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Avail</th>
      <th style="padding:7px 8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Price / btl</th>
      <th style="padding:7px 0 7px 8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Mrkt Price</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #ede6d6;display:flex;justify-content:space-between;align-items:baseline;">
    <div style="font-family:'DM Mono',monospace;font-size:10px;color:#c8b89a;">${wineList.length} wine${wineList.length !== 1 ? 's' : ''} · All prices per bottle · Duty and VAT paid</div>
    <div style="font-family:'DM Mono',monospace;font-size:10px;color:#c8b89a;">jessica.bride@gmail.com</div>
  </div></body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)
  iframe.onload = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 3000) }
  iframe.contentDocument.open(); iframe.contentDocument.write(html); iframe.contentDocument.close()
}

// ─── Header (defined OUTSIDE BuyerPage) ─────────────────────────────────────

function Header({ displayName, wineCount, onPrint, isAdmin, adminTab, setAdminTab, setPreviewBuyer, setPreviewPin, setPreviewError, isMobile }) {
  const dashIdx = (displayName || '').lastIndexOf(' - ')
  const titleMain = dashIdx > -1 ? displayName.slice(0, dashIdx) : displayName
  const titleDate = dashIdx > -1 ? displayName.slice(dashIdx + 3) : ''
  return (
    <header style={{ background: C.ink, color: C.white, padding: isMobile ? '20px 16px 24px' : '24px 40px 28px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '22px' : '24px', fontWeight: 400, color: C.white, lineHeight: 1 }}>Belle Année</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold, marginTop: '3px' }}>Wines & Studio</div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '4px' }}>
              <button onClick={() => { setAdminTab('master'); setPreviewBuyer(null); setPreviewPin(''); setPreviewError('') }}
                style={{ background: adminTab === 'master' ? C.wine : 'none', color: adminTab === 'master' ? C.white : 'rgba(255,253,249,0.55)', border: 'none', borderRadius: '6px', padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Master Roster
              </button>
              <button onClick={() => setAdminTab('preview')}
                style={{ background: adminTab === 'preview' ? C.gold : 'none', color: adminTab === 'preview' ? C.inkDeep : 'rgba(255,253,249,0.55)', border: 'none', borderRadius: '6px', padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Buyer View
              </button>
            </div>
          )}
          {!isAdmin && (
            <button onClick={onPrint} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,253,249,0.07)', border: '1px solid rgba(255,253,249,0.35)', color: C.white, fontFamily: 'DM Mono, monospace', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
              <IconPrint /> Print
            </button>
          )}
        </div>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: isMobile ? '36px' : '42px', fontWeight: 400, color: C.white, margin: 0, lineHeight: 1.05 }}>{titleMain}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isMobile ? '6px' : '10px', marginTop: '10px' }}>
            {wineCount != null && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: C.gold }}>{wineCount} wine{wineCount !== 1 ? 's' : ''} available</span>}
            {titleDate && <><span style={{ color: 'rgba(255,253,249,0.3)', fontSize: '12px' }}>·</span><span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'rgba(255,253,249,0.55)', letterSpacing: '0.06em' }}>{titleDate}</span></>}
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── TermsAccordion (defined OUTSIDE BuyerPage) ──────────────────────────────

function TermsAccordion({ termsOpen, setTermsOpen, isMobile, SIDE }) {
  return (
    <div style={{ background: C.cream, borderBottom: '1px solid ' + C.line }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: `0 ${SIDE}` }}>
        <button onClick={() => setTermsOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: '14px 0', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <span style={{ color: C.muted }}><IconInfo /></span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', color: C.muted }}>Terms & Delivery</span>
          <span style={{ color: C.muted, marginLeft: '4px' }}><IconChevron down={!termsOpen} /></span>
        </button>
        {termsOpen && (
          <div style={{ paddingBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '12px' : '16px' }}>
              {[
                { title: 'Flexible quantities', body: 'Take as many or as few bottles as you like. The one exception: wines offered by the 12-bottle case carry a six-bottle minimum, since I release the full twelve from bond.' },
                { title: 'Impeccable Provenance', body: 'Wines are purchased directly from wineries and distributors and held in bonded storage until delivery into my temperature-controlled studio. If a bottle is ever faulted, just tell me and I will remove or replace it at no cost to you.' },
                { title: 'Up to date', body: 'Each month, send your latest stock count and I will refresh the consignment list. I invoice every 60 days for whatever has sold.' },
              ].map(({ title, body }) => (
                <div key={title} style={{ background: C.white, border: '1.5px solid ' + C.line, borderRadius: '12px', padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontWeight: 500, color: C.text, marginBottom: '7px' }}>{title}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, lineHeight: 1.7 }}>{body}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.wine }}>
              Belle Année and Studio Jessica Bride are not VAT registered. Prices shown reflect duty and VAT already paid.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FiltersBar (defined OUTSIDE BuyerPage) ──────────────────────────────────

function FiltersBar({ wineList, search, setSearch, filterColour, setFilterColour, filterRegion, setFilterRegion, filterWomen, setFilterWomen, sortCol, setSortCol, setSortDir, filteredCount, isMobile, SIDE }) {
  const regionList = [...new Set(wineList.map(w => w.region).filter(Boolean))].sort()
  const womenCt = wineList.filter(w => w.women_note).length
  return (
    <div style={{ background: C.cream, padding: `16px ${SIDE} 8px` }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '1', minWidth: '200px', position: 'relative', order: isMobile ? -1 : 0 }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.muted }}><IconSearch /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wines, regions, vintages..."
              style={{ width: '100%', background: C.white, border: '1.5px solid ' + C.line, borderRadius: '999px', padding: '10px 18px 10px 40px', fontFamily: 'DM Mono, monospace', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={pillStyle(!!filterColour)}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={pillStyle(!!filterRegion)}>
            <option value="">All Regions</option>
            {regionList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={sortCol} onChange={e => { setSortCol(e.target.value); setSortDir('asc') }} style={pillStyle(false)}>
            <option value="description">Sort: Name</option>
            <option value="vintage">Sort: Vintage</option>
            <option value="region">Sort: Region</option>
            <option value="sale_price">Sort: Price</option>
            <option value="quantity">Sort: Qty</option>
          </select>
          {womenCt > 0 && (
            <button onClick={() => setFilterWomen(v => !v)}
              style={{ ...pillStyle(filterWomen), paddingRight: '14px', backgroundImage: 'none', color: filterWomen ? C.white : '#9b3a4a', background: filterWomen ? '#9b3a4a' : C.white, border: '1.5px solid ' + (filterWomen ? '#9b3a4a' : 'rgba(155,58,74,0.4)') }}>
              ♀
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' }}>
            {filteredCount} wine{filteredCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── WineRow (defined OUTSIDE BuyerPage) ────────────────────────────────────

function WineRow({ w, i, totalCount, isAdmin: adminMode, selected, setSelected, expanded, setExpanded, editKey, setEditKey, draft, setDraft, savingNote, saveNote, isMobile }) {
  const isSelected = !!selected[w.id]
  const qty = selected[w.id] || 1
  // Use per-buyer quantity if set, else wines.quantity
  const stock = w._buyerQty != null ? w._buyerQty : (parseInt(w.quantity) || 0)
  const soldOut = stock <= 0
  const size = formatBottleSize(w.bottle_volume, w.bottle_format)
  const isMag = size === '150cl' || size === '300cl'
  const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
  const duty = isMag ? 6 : 3
  const wsDp = ws ? (ws + duty) * 1.2 : null
  const salePrice = parseFloat(w.sale_price)
  const openType = expanded[w.id]
  const dotColor = (w.colour || '').toLowerCase().includes('red') ? '#8b2535'
    : (w.colour || '').toLowerCase().includes('white') ? '#c9b76a'
    : (w.colour || '').toLowerCase().includes('ros') ? '#d4748a' : '#b0a090'
  const noteTabs = [
    { type: 'wine', label: 'Wine note', show: adminMode || !!w.buyer_note },
    { type: 'producer', label: 'Producer note', show: adminMode || !!w.producer_note },
    { type: 'women', label: 'Women in wine', show: adminMode || !!w.women_note },
  ].filter(t => t.show)
  const noteText = openType === 'wine' ? w.buyer_note : openType === 'producer' ? w.producer_note : openType === 'women' ? w.women_note : null
  const isLast = i === totalCount - 1
  const rowBorder = isLast ? 'none' : '1px solid ' + C.line
  const metaLine = [w.vintage, size, stock > 0 ? `${stock} available` : 'Sold out'].filter(Boolean).join('  ·  ')

  function toggleSelected(id, max) {
    setSelected(prev => { const next = { ...prev }; if (next[id]) delete next[id]; else next[id] = Math.min(1, max); return next })
  }
  function setQuantity(id, q, max) {
    const capped = Math.min(Math.max(1, parseInt(q) || 1), max)
    setSelected(prev => ({ ...prev, [id]: capped }))
  }
  function toggleNote(id, type) {
    setExpanded(prev => ({ ...prev, [id]: prev[id] === type ? null : type }))
  }

  if (isMobile) {
    return (
      <div style={{ background: C.white, borderRadius: '12px', border: '1.5px solid ' + (isSelected ? C.wine : C.line), marginBottom: '10px', overflow: 'hidden', opacity: soldOut ? 0.55 : 1 }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '9px' }} />
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: isMag ? 700 : 500, color: C.text, lineHeight: 1.2 }}>{cleanWineName(w.description, w.region, w.country)}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, marginTop: '3px' }}>{[w.region, w.country].filter(Boolean).join(' · ')}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, marginTop: '4px' }}>{metaLine}</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: isMag ? 700 : 400, color: C.text, lineHeight: 1 }}>£{salePrice.toFixed(2)}</div>
              {wsDp && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, marginTop: '3px' }}>Market £{wsDp.toFixed(2)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '8px', alignItems: 'center' }}>
            {isSelected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => setQuantity(w.id, qty - 1, stock)} disabled={qty <= 1} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid ' + C.line, background: C.cream, cursor: qty <= 1 ? 'default' : 'pointer', fontSize: '18px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 500, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                <button onClick={() => setQuantity(w.id, qty + 1, stock)} disabled={qty >= stock} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid ' + C.line, background: C.cream, cursor: qty >= stock ? 'default' : 'pointer', fontSize: '18px', opacity: qty >= stock ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            )}
            {!soldOut && (
              <button onClick={() => toggleSelected(w.id, stock)}
                style={{ background: isSelected ? C.wine : C.gold, color: isSelected ? C.white : C.inkDeep, border: 'none', borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.06em', fontWeight: 500 }}>
                {isSelected ? '✓ Added' : '+ Add'}
              </button>
            )}
          </div>
        </div>
        {noteTabs.length > 0 && (
          <div style={{ borderTop: '1px solid ' + C.line, padding: '10px 16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {noteTabs.map(t => (
              <button key={t.type} onClick={() => toggleNote(w.id, t.type)}
                style={{ background: openType === t.type ? (t.type === 'women' ? '#9b3a4a' : C.wine) : 'transparent', color: openType === t.type ? C.white : (t.type === 'women' ? '#9b3a4a' : C.muted), border: '1.5px solid ' + (openType === t.type ? (t.type === 'women' ? '#9b3a4a' : C.wine) : C.line), borderRadius: '999px', padding: '4px 11px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        {openType && (
          <div style={{ borderTop: '1px solid ' + C.line, padding: '10px 16px', background: C.cream }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: openType === 'women' ? '#9b3a4a' : C.wine, marginBottom: '5px' }}>
              {openType === 'wine' ? 'Wine Note' : openType === 'producer' ? 'Producer Note' : 'Women in Wine'}
            </div>
            {openType === 'producer' ? (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: noteText ? '#6b5c47' : C.muted, lineHeight: 1.65 }}>{noteText || 'No producer note yet.'}</div>
            ) : openType === 'women' ? (
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: noteText ? '#9b3a4a' : C.muted, fontStyle: 'italic', lineHeight: 1.6 }}>{noteText || 'No note yet.'}</div>
            ) : (
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: noteText ? C.text : C.muted, fontStyle: noteText ? 'normal' : 'italic', lineHeight: 1.6 }}>{noteText || 'No wine note yet.'}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ borderBottom: rowBorder }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 150px 110px', alignItems: 'center', padding: '16px 24px', background: C.white, opacity: soldOut ? 0.5 : 1, gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: isMag ? 700 : 500, color: C.text, lineHeight: 1.2 }}>{cleanWineName(w.description, w.region, w.country)}</span>
            {w.women_note && <span style={{ fontSize: '12px', color: '#9b3a4a' }}>♀</span>}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: C.muted, paddingLeft: '16px' }}>{[w.region, w.country].filter(Boolean).join(' · ')}</div>
          {noteTabs.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', paddingLeft: '16px', marginTop: '7px', flexWrap: 'wrap' }}>
              {noteTabs.map(t => (
                <button key={t.type} onClick={() => toggleNote(w.id, t.type)}
                  style={{ background: openType === t.type ? (t.type === 'women' ? '#9b3a4a' : C.wine) : 'transparent', color: openType === t.type ? C.white : (t.type === 'women' ? '#9b3a4a' : C.muted), border: '1.5px solid ' + (openType === t.type ? (t.type === 'women' ? '#9b3a4a' : C.wine) : C.line), borderRadius: '999px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: C.muted }}>{metaLine}</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: isMag ? 700 : 400, color: C.text, lineHeight: 1 }}>£{salePrice.toFixed(2)}</div>
          {wsDp && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, marginTop: '3px' }}>Market £{wsDp.toFixed(2)}</div>}
          {isSelected && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: C.wine, marginTop: '2px' }}>x{qty} = £{(salePrice * qty).toFixed(2)}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          {soldOut ? (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted }}>Sold out</span>
          ) : isSelected ? (
            <>
              <button onClick={() => setQuantity(w.id, qty - 1, stock)} disabled={qty <= 1} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1.5px solid ' + C.line, background: C.cream, cursor: qty <= 1 ? 'default' : 'pointer', fontSize: '16px', opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 500, minWidth: '18px', textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQuantity(w.id, qty + 1, stock)} disabled={qty >= stock} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1.5px solid ' + C.line, background: C.cream, cursor: qty >= stock ? 'default' : 'pointer', fontSize: '16px', opacity: qty >= stock ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              <button onClick={() => toggleSelected(w.id, stock)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '2px solid ' + C.wine, background: C.wine, color: C.white, cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
            </>
          ) : (
            <button onClick={() => toggleSelected(w.id, stock)}
              style={{ background: C.gold, color: C.inkDeep, border: 'none', borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.06em', fontWeight: 500 }}>
              + Add
            </button>
          )}
        </div>
      </div>
      {openType && (
        <div style={{ background: C.cream, padding: '8px 24px 14px 48px', borderBottom: rowBorder }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: openType === 'women' ? '#9b3a4a' : C.wine, marginBottom: '5px' }}>
            {openType === 'wine' ? 'Wine Note' : openType === 'producer' ? 'Producer Note' : 'Women in Wine'}
          </div>
          {openType === 'producer' ? (
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: noteText ? '#6b5c47' : C.muted, fontStyle: noteText ? 'normal' : 'italic', lineHeight: 1.65, maxWidth: '680px' }}>{noteText || 'No producer note yet.'}</div>
          ) : openType === 'women' ? (
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: noteText ? '#9b3a4a' : C.muted, fontStyle: noteText ? 'italic' : 'italic', lineHeight: 1.6, maxWidth: '680px' }}>{noteText || 'No note yet.'}</div>
          ) : (
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: noteText ? C.text : C.muted, fontStyle: noteText ? 'normal' : 'italic', lineHeight: 1.6, maxWidth: '680px' }}>{noteText || 'No wine note yet.'}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── OrderBar (defined OUTSIDE BuyerPage) ────────────────────────────────────

function OrderBar({ wineList, displayName, selected, isMobile, sendWishlist }) {
  const selectedCount = Object.keys(selected).length
  const totalValue = wineList.filter(w => selected[w.id]).reduce((sum, w) => sum + parseFloat(w.sale_price) * (selected[w.id] || 1), 0)
  if (selectedCount === 0) return null
  if (isMobile) {
    return (
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.inkDeep, zIndex: 200, boxShadow: '0 -6px 24px rgba(0,0,0,0.3)', borderRadius: '16px 16px 0 0', padding: '14px 16px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: C.gold }}>{selectedCount} wine{selectedCount !== 1 ? 's' : ''} selected</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: C.white, lineHeight: 1.1 }}>£{totalValue.toFixed(2)}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(255,253,249,0.45)', marginTop: '1px' }}>ex. VAT</div>
          </div>
          <button onClick={() => sendWishlist(wineList, displayName)} style={{ background: C.gold, color: C.inkDeep, border: 'none', borderRadius: '10px', padding: '13px 22px', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>View Order →</button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.inkDeep, zIndex: 200, boxShadow: '0 -6px 24px rgba(0,0,0,0.28)', borderRadius: '16px 16px 0 0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '24px', padding: '14px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <IconBottles />
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: C.white }}>{selectedCount} wine{selectedCount !== 1 ? 's' : ''} selected</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.gold, marginTop: '1px' }}>View selection →</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color: C.white, lineHeight: 1 }}>£{totalValue.toFixed(2)}</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(255,253,249,0.45)', marginTop: '2px' }}>ex. VAT</div>
        </div>
        <button onClick={() => sendWishlist(wineList, displayName)} style={{ background: C.gold, color: C.inkDeep, border: 'none', borderRadius: '10px', padding: '13px 28px', fontFamily: 'DM Mono, monospace', fontSize: '13px', letterSpacing: '0.08em', fontWeight: 500, cursor: 'pointer' }}>View Order →</button>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BuyerPage() {
  const router = useRouter()
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterWomen, setFilterWomen] = useState(false)
  const [sortCol, setSortCol] = useState('description')
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useState({})
  const [expanded, setExpanded] = useState({})
  const [editKey, setEditKey] = useState(null)
  const [draft, setDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [buyerDisplayName, setBuyerDisplayName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [buyerAccessId, setBuyerAccessId] = useState(null)

  // Admin state
  const [adminTab, setAdminTab] = useState('master')
  const [previewPin, setPreviewPin] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewBuyer, setPreviewBuyer] = useState(null)
  const [previewWines, setPreviewWines] = useState([])
  const [buyerAccess, setBuyerAccess] = useState([])
  const [masterWines, setMasterWines] = useState([])
  const [assignments, setAssignments] = useState({}) // wineId -> { buyerName: { assigned: bool, qty: number|null } }
  const [removingId, setRemovingId] = useState(null)
  const [masterSearch, setMasterSearch] = useState('')
  const [masterFilterColour, setMasterFilterColour] = useState('')
  const [masterFilterRegion, setMasterFilterRegion] = useState('')
  const [masterFilterBuyer, setMasterFilterBuyer] = useState('')
  const [masterSortCol, setMasterSortCol] = useState('description')
  const [masterSortDir, setMasterSortDir] = useState('asc')
  const [masterExpandedNote, setMasterExpandedNote] = useState(null)
  const [masterEditKey, setMasterEditKey] = useState(null)
  const [masterDraft, setMasterDraft] = useState('')
  const [masterSavingNote, setMasterSavingNote] = useState(false)
  const [assigningWineId, setAssigningWineId] = useState(null) // which wine row has assign panel open
  const [assignQtys, setAssignQtys] = useState({}) // buyerId -> qty string
  const [assignSaving, setAssignSaving] = useState(false)


  const SIDE = isMobile ? '16px' : '40px'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const id = 'cormorant-weights'
    if (typeof document !== 'undefined' && !document.getElementById(id)) {
      const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap'
      document.head.appendChild(l)
    }
  }, [])

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    const pin = sessionStorage.getItem('pin')
    if (role !== 'buyer' && role !== 'admin') { router.push('/'); return }
    setIsAdmin(role === 'admin')
    if (role === 'admin') fetchMasterAdmin()
    else resolveBuyerAndFetch(pin)
  }, [])

  // ── Admin: fetch master + assignments ─────────────────────────────────────

  async function fetchMasterAdmin() {
    setLoading(true)
    const { data: buyers } = await supabase.from('buyer_access').select('id, name, display_name, pin').order('name')
    setBuyerAccess(buyers || [])
    const { data: master } = await supabase
      .from('wines')
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle')
      .eq('include_in_buyer_view', true).not('sale_price', 'is', null).order('description')
    setMasterWines(master || [])
    const { data: allAssignments } = await supabase.from('buyer_wine_assignments').select('wine_id, buyer_access_id, quantity')
    const buyerNameMap = Object.fromEntries((buyers || []).map(b => [b.id, b.name]))
    const map = {}
    for (const a of (allAssignments || [])) {
      if (!map[a.wine_id]) map[a.wine_id] = {}
      const bname = buyerNameMap[a.buyer_access_id]
      if (bname) map[a.wine_id][bname] = { assigned: true, qty: a.quantity, buyerId: a.buyer_access_id }
    }
    setAssignments(map)
    setLoading(false)
  }

  async function removeFromMaster(wineId) {
    setRemovingId(wineId)
    await supabase.from('wines').update({ include_in_buyer_view: false }).eq('id', wineId)
    setMasterWines(prev => prev.filter(w => w.id !== wineId))
    setRemovingId(null)
  }

  async function removeFromBuyer(wineId, buyerId) {
    await supabase.from('buyer_wine_assignments').delete().eq('wine_id', wineId).eq('buyer_access_id', buyerId)
    const buyer = buyerAccess.find(b => b.id === buyerId)
    if (buyer) {
      setAssignments(prev => {
        const next = { ...prev, [wineId]: { ...prev[wineId] } }
        delete next[wineId][buyer.name]
        return next
      })
    }
  }

  // ── Assign wine to buyer from roster ─────────────────────────────────────

  async function saveAssignment(wineId) {
    setAssignSaving(true)
    for (const buyer of buyerAccess) {
      const qtyStr = assignQtys[buyer.id]
      if (!qtyStr && qtyStr !== '0') continue // skip if not touched
      const qty = qtyStr === '' ? null : parseInt(qtyStr)
      // Check if already assigned
      const alreadyAssigned = assignments[wineId]?.[buyer.name]?.assigned
      if (alreadyAssigned) {
        // Update quantity
        await supabase.from('buyer_wine_assignments')
          .update({ quantity: qty })
          .eq('wine_id', wineId).eq('buyer_access_id', buyer.id)
      } else if (qtyStr !== '') {
        // Insert new assignment
        await supabase.from('buyer_wine_assignments')
          .insert({ wine_id: wineId, buyer_access_id: buyer.id, quantity: qty })
      }
    }
    // Refresh assignments for this wine
    const { data: updated } = await supabase.from('buyer_wine_assignments')
      .select('wine_id, buyer_access_id, quantity').eq('wine_id', wineId)
    const buyerNameMap = Object.fromEntries(buyerAccess.map(b => [b.id, b.name]))
    const newMap = {}
    for (const a of (updated || [])) {
      const bname = buyerNameMap[a.buyer_access_id]
      if (bname) newMap[bname] = { assigned: true, qty: a.quantity, buyerId: a.buyer_access_id }
    }
    setAssignments(prev => ({ ...prev, [wineId]: newMap }))
    setAssigningWineId(null)
    setAssignQtys({})
    setAssignSaving(false)
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  async function handlePreviewPin(e) {
    e.preventDefault(); setPreviewError('')
    const { data: buyer } = await supabase.from('buyer_access').select('id, name, display_name, editorial, pin').eq('pin', previewPin.trim()).maybeSingle()
    if (!buyer) { setPreviewError('No buyer found with that PIN.'); return }
    setPreviewBuyer(buyer)
    const { data: buyerAssignments } = await supabase.from('buyer_wine_assignments').select('wine_id, quantity').eq('buyer_access_id', buyer.id)
    if (!buyerAssignments || buyerAssignments.length === 0) { setPreviewWines([]); return }
    const wineIds = buyerAssignments.map(a => a.wine_id)
    const qtyMap = Object.fromEntries(buyerAssignments.map(a => [a.wine_id, a.quantity]))
    const { data: wineData } = await supabase.from('wines')
      .select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle')
      .in('id', wineIds).not('sale_price', 'is', null).order('description')
    // Attach per-buyer quantity
    const withQty = (wineData || []).map(w => ({ ...w, _buyerQty: qtyMap[w.id] != null ? qtyMap[w.id] : null }))
    setPreviewWines(withQty)
  }

  // ── Buyer fetch ───────────────────────────────────────────────────────────

  async function resolveBuyerAndFetch(pin) {
    setLoading(true)
    const { data: buyer } = await supabase.from('buyer_access').select('id, name, display_name, editorial').eq('pin', pin).maybeSingle()
    if (!buyer) {
      setBuyerDisplayName('Current Selection'); setBuyerName('Guest')
      const { data } = await supabase.from('wines').select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle').eq('include_in_buyer_view', true).not('sale_price', 'is', null).order('description')
      setWines(data || []); setLoading(false); return
    }
    setBuyerAccessId(buyer.id); setBuyerName(buyer.name); setBuyerDisplayName(buyer.display_name || buyer.name)
    const { data: buyerAssignments } = await supabase.from('buyer_wine_assignments').select('wine_id, quantity').eq('buyer_access_id', buyer.id)
    if (!buyerAssignments || buyerAssignments.length === 0) { setWines([]); setLoading(false); return }
    const wineIds = buyerAssignments.map(a => a.wine_id)
    const qtyMap = Object.fromEntries(buyerAssignments.map(a => [a.wine_id, a.quantity]))
    const { data: wineData } = await supabase.from('wines').select('id, description, vintage, colour, region, country, bottle_format, bottle_volume, sale_price, include_in_buyer_view, quantity, women_note, producer_note, buyer_note, ws_lowest_per_bottle').in('id', wineIds).not('sale_price', 'is', null).order('description')
    const withQty = (wineData || []).map(w => ({ ...w, _buyerQty: qtyMap[w.id] != null ? qtyMap[w.id] : null }))
    setWines(withQty); setLoading(false)
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filtered = (() => {
    let result = [...wines]
    if (filterColour) result = result.filter(w => w.colour?.toLowerCase().includes(filterColour.toLowerCase()))
    if (filterRegion) result = result.filter(w => w.region === filterRegion)
    if (filterWomen) result = result.filter(w => w.women_note)
    if (search) { const q = search.toLowerCase(); result = result.filter(w => [w.description, w.region, w.country, w.vintage].join(' ').toLowerCase().includes(q)) }
    result.sort((a, b) => {
      let av, bv
      if (sortCol === 'description') { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase() }
      else if (sortCol === 'vintage') { av = a.vintage || ''; bv = b.vintage || '' }
      else if (sortCol === 'region') { av = (a.region || '').toLowerCase(); bv = (b.region || '').toLowerCase() }
      else if (sortCol === 'format') { av = bottleSortKey(a.bottle_volume, a.bottle_format); bv = bottleSortKey(b.bottle_volume, b.bottle_format) }
      else if (sortCol === 'quantity') { av = (a._buyerQty != null ? a._buyerQty : parseInt(a.quantity)) || 0; bv = (b._buyerQty != null ? b._buyerQty : parseInt(b.quantity)) || 0 }
      else if (sortCol === 'sale_price') { av = parseFloat(a.sale_price) || 0; bv = parseFloat(b.sale_price) || 0 }
      else { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase() }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return result
  })()

  // ── Save note ─────────────────────────────────────────────────────────────

  async function saveNote(id, type) {
    const field = type === 'wine' ? 'buyer_note' : type === 'producer' ? 'producer_note' : 'women_note'
    setSavingNote(true)
    try {
      const pin = sessionStorage.getItem('pin') || (sessionStorage.getItem('role') === 'admin' ? '2025' : '')
      const res = await fetch('/api/buyer/update-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, field, value: draft, pin }) })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || 'Save failed')
      setWines(prev => prev.map(w => w.id === id ? { ...w, [field]: result.value } : w))
      setEditKey(null); setDraft('')
    } catch (e) { alert('Could not save: ' + e.message) }
    finally { setSavingNote(false) }
  }

  // ── Send wishlist ─────────────────────────────────────────────────────────

  function sendWishlist(wineList, displayName) {
    const list = wineList.filter(w => selected[w.id])
    const totalBottles = list.reduce((sum, w) => sum + (selected[w.id] || 0), 0)
    const totalValue = list.reduce((sum, w) => sum + parseFloat(w.sale_price) * (selected[w.id] || 1), 0)
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const divider = '-'.repeat(50)
    const wineLines = list.map(w => {
      const qty = selected[w.id] || 1
      const total = (parseFloat(w.sale_price) * qty).toFixed(2)
      const size = formatBottleSize(w.bottle_volume, w.bottle_format)
      return [`${w.vintage}  ${cleanWineName(w.description, w.region, w.country)}`, `      ${w.region}${w.country ? ' · ' + w.country : ''} · ${w.colour} · ${size}`, `      £${parseFloat(w.sale_price).toFixed(2)} per bottle · Qty: ${qty} · Subtotal: £${total}`].join('\n')
    })
    const body = [`WISHLIST - ${(displayName || '').toUpperCase()}`, date, '', 'WINES SELECTED', divider, '', wineLines.join('\n\n'), '', divider, `TOTAL: ${list.length} wine${list.length !== 1 ? 's' : ''} · ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''} · £${totalValue.toFixed(2)}`, '', 'All prices per bottle, duty and VAT paid.', 'Please reply to confirm availability.'].join('\n')
    const subject = encodeURIComponent(`Wishlist - ${displayName} - ${new Date().toLocaleDateString('en-GB')}`)
    window.location.href = `mailto:jessica.bride@gmail.com?subject=${subject}&body=${encodeURIComponent(body)}`
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.cream }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: C.wine }}>Loading...</div>
    </div>
  )

  // ── Admin: preview tab ────────────────────────────────────────────────────

  if (isAdmin && adminTab === 'preview') {
    const rawList = previewBuyer ? previewWines : []
    const displayName = previewBuyer ? (previewBuyer.display_name || previewBuyer.name) : 'Buyer View Preview'
    let displayList = [...rawList]
    if (filterColour) displayList = displayList.filter(w => w.colour?.toLowerCase().includes(filterColour.toLowerCase()))
    if (filterRegion) displayList = displayList.filter(w => w.region === filterRegion)
    if (filterWomen) displayList = displayList.filter(w => w.women_note)
    if (search) { const q = search.toLowerCase(); displayList = displayList.filter(w => [w.description, w.region, w.country, w.vintage].join(' ').toLowerCase().includes(q)) }
    displayList.sort((a, b) => {
      let av, bv
      if (sortCol === 'description') { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase() }
      else if (sortCol === 'vintage') { av = a.vintage || ''; bv = b.vintage || '' }
      else if (sortCol === 'region') { av = (a.region || '').toLowerCase(); bv = (b.region || '').toLowerCase() }
      else if (sortCol === 'sale_price') { av = parseFloat(a.sale_price) || 0; bv = parseFloat(b.sale_price) || 0 }
      else if (sortCol === 'quantity') { av = (a._buyerQty != null ? a._buyerQty : parseInt(a.quantity)) || 0; bv = (b._buyerQty != null ? b._buyerQty : parseInt(b.quantity)) || 0 }
      else { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase() }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return (
      <div style={{ minHeight: '100vh', background: C.cream, paddingBottom: '40px' }}>
        <Header displayName={displayName} wineCount={previewBuyer ? rawList.length : null} onPrint={() => printPriceList(displayList, displayName)} isAdmin={isAdmin} adminTab={adminTab} setAdminTab={setAdminTab} setPreviewBuyer={setPreviewBuyer} setPreviewPin={setPreviewPin} setPreviewError={setPreviewError} isMobile={isMobile} />
        {!previewBuyer ? (
          <div style={{ maxWidth: '480px', margin: '60px auto', padding: '0 24px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: C.text, marginBottom: '6px' }}>Preview as buyer</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: C.muted, marginBottom: '24px' }}>Enter a buyer PIN to see exactly what they see.</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {buyerAccess.map(b => (
                <button key={b.id} onClick={() => setPreviewPin(b.pin)}
                  style={{ background: previewPin === b.pin ? C.wine : C.white, color: previewPin === b.pin ? C.white : C.text, border: '1.5px solid ' + (previewPin === b.pin ? C.wine : C.line), borderRadius: '999px', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '12px', cursor: 'pointer' }}>
                  {b.name}
                </button>
              ))}
            </div>
            <form onSubmit={handlePreviewPin} style={{ display: 'flex', gap: '8px' }}>
              <input value={previewPin} onChange={e => setPreviewPin(e.target.value)} placeholder="Enter PIN (e.g. 2323)"
                style={{ flex: 1, border: '1.5px solid ' + C.line, borderRadius: '999px', padding: '10px 18px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', background: C.white }} />
              <button type="submit" style={{ background: C.wine, color: C.white, border: 'none', borderRadius: '999px', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '12px', cursor: 'pointer' }}>Preview →</button>
            </form>
            {previewError && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#c0392b', marginTop: '10px' }}>{previewError}</div>}
          </div>
        ) : (
          <>
            <TermsAccordion termsOpen={termsOpen} setTermsOpen={setTermsOpen} isMobile={isMobile} SIDE={SIDE} />
            <FiltersBar wineList={rawList} search={search} setSearch={setSearch} filterColour={filterColour} setFilterColour={setFilterColour} filterRegion={filterRegion} setFilterRegion={setFilterRegion} filterWomen={filterWomen} setFilterWomen={setFilterWomen} sortCol={sortCol} setSortCol={setSortCol} setSortDir={setSortDir} filteredCount={displayList.length} isMobile={isMobile} SIDE={SIDE} />
            <div style={{ maxWidth: '1400px', margin: '16px auto', padding: `0 ${SIDE}` }}>
              <div style={{ background: C.white, borderRadius: '14px', border: '1px solid ' + C.line, overflow: 'hidden' }}>
                {displayList.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: C.muted }}>{rawList.length === 0 ? 'No wines assigned to this buyer yet.' : 'No wines match your filters.'}</div>
                ) : (
                  isMobile
                    ? <div style={{ padding: '12px' }}>{displayList.map((w, i) => <WineRow key={w.id} w={w} i={i} totalCount={displayList.length} isAdmin={false} selected={selected} setSelected={setSelected} expanded={expanded} setExpanded={setExpanded} editKey={editKey} setEditKey={setEditKey} draft={draft} setDraft={setDraft} savingNote={savingNote} saveNote={saveNote} isMobile={isMobile} />)}</div>
                    : displayList.map((w, i) => <WineRow key={w.id} w={w} i={i} totalCount={displayList.length} isAdmin={false} selected={selected} setSelected={setSelected} expanded={expanded} setExpanded={setExpanded} editKey={editKey} setEditKey={setEditKey} draft={draft} setDraft={setDraft} savingNote={savingNote} saveNote={saveNote} isMobile={isMobile} />)
                )}
              </div>
              <div style={{ marginTop: '12px', textAlign: 'right' }}>
                <button onClick={() => printPriceList(displayList, displayName)} style={{ background: 'none', border: '1px solid ' + C.line, borderRadius: '8px', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconPrint /> Print this list
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Admin: master roster tab ──────────────────────────────────────────────

  if (isAdmin) {
    let mFiltered = [...masterWines]
    if (masterSearch) { const q = masterSearch.toLowerCase(); mFiltered = mFiltered.filter(w => [w.description, w.region, w.country, w.vintage, w.colour].join(' ').toLowerCase().includes(q)) }
    if (masterFilterColour) mFiltered = mFiltered.filter(w => w.colour?.toLowerCase().includes(masterFilterColour.toLowerCase()))
    if (masterFilterRegion) mFiltered = mFiltered.filter(w => w.region === masterFilterRegion)
    if (masterFilterBuyer === 'unassigned') mFiltered = mFiltered.filter(w => !Object.keys(assignments[w.id] || {}).length)
    else if (masterFilterBuyer) mFiltered = mFiltered.filter(w => assignments[w.id]?.[masterFilterBuyer]?.assigned)
    mFiltered.sort((a, b) => {
      const dir = masterSortDir === 'asc' ? 1 : -1
      if (masterSortCol === 'vintage') return ((a.vintage || '') > (b.vintage || '') ? 1 : -1) * dir
      if (masterSortCol === 'region') return ((a.region || '') > (b.region || '') ? 1 : -1) * dir
      if (masterSortCol === 'country') return ((a.country || '') > (b.country || '') ? 1 : -1) * dir
      if (masterSortCol === 'colour') return ((a.colour || '') > (b.colour || '') ? 1 : -1) * dir
      if (masterSortCol === 'sale_price') return ((parseFloat(a.sale_price) || 0) - (parseFloat(b.sale_price) || 0)) * dir
      if (masterSortCol === 'quantity') return ((parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0)) * dir
      if (masterSortCol === 'format') return (bottleSortKey(a.bottle_volume, a.bottle_format) - bottleSortKey(b.bottle_volume, b.bottle_format)) * dir
      return ((a.description || '').toLowerCase() > (b.description || '').toLowerCase() ? 1 : -1) * dir
    })
    const mRegions = [...new Set(masterWines.map(w => w.region).filter(Boolean))].sort()
    function mSortBtn(col, label) {
      const active = masterSortCol === col
      return (
        <button onClick={() => { if (active) setMasterSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMasterSortCol(col); setMasterSortDir('asc') } }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? C.gold : 'rgba(255,253,249,0.55)', padding: '0 4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          {label}{active ? (masterSortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </button>
      )
    }
    async function saveMasterNote(wineId, type) {
      const field = type === 'wine' ? 'buyer_note' : type === 'producer' ? 'producer_note' : 'women_note'
      setMasterSavingNote(true)
      try {
        const res = await fetch('/api/buyer/update-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: wineId, field, value: masterDraft, pin: '2025' }) })
        const result = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(result.error || 'Save failed')
        setMasterWines(prev => prev.map(w => w.id === wineId ? { ...w, [field]: result.value } : w))
        setMasterEditKey(null); setMasterDraft('')
      } catch (e) { alert('Could not save: ' + e.message) }
      finally { setMasterSavingNote(false) }
    }

    return (
      <div style={{ minHeight: '100vh', background: C.cream, paddingBottom: '40px' }}>
        <Header displayName="Master Roster" wineCount={masterWines.length} onPrint={() => printPriceList(masterWines, 'Master Roster')} isAdmin={isAdmin} adminTab={adminTab} setAdminTab={setAdminTab} setPreviewBuyer={setPreviewBuyer} setPreviewPin={setPreviewPin} setPreviewError={setPreviewError} isMobile={isMobile} />
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: `24px ${SIDE} 0` }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${buyerAccess.length + 1}, 1fr)`, gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: C.white, border: '1.5px solid ' + C.wine, borderRadius: '12px', padding: '16px 18px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.wine, marginBottom: '4px' }}>Master Roster</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color: C.text }}>{masterWines.length}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, marginTop: '2px' }}>wines in roster</div>
            </div>
            {buyerAccess.map(buyer => {
              const totalAssigned = Object.values(assignments).filter(wineMap => wineMap[buyer.name]?.assigned).length
              return (
                <div key={buyer.id} onClick={() => setMasterFilterBuyer(masterFilterBuyer === buyer.name ? '' : buyer.name)} style={{ background: C.white, border: '1.5px solid ' + (masterFilterBuyer === buyer.name ? C.wine : C.line), borderRadius: '12px', padding: '16px 18px', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: masterFilterBuyer === buyer.name ? C.wine : C.muted, marginBottom: '4px' }}>{buyer.name}</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color: C.text }}>{totalAssigned}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, marginTop: '2px' }}>wines assigned · PIN {buyer.pin}</div>
                </div>
              )
            })}
          </div>

          {/* Master roster table */}
          <div style={{ background: C.white, borderRadius: '14px', border: '1px solid ' + C.line, overflow: 'hidden' }}>
            <div style={{ background: C.ink, padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,253,249,0.6)' }}>Master Sales Roster — {mFiltered.length}/{masterWines.length} wines</span>

              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={masterSearch} onChange={e => setMasterSearch(e.target.value)} placeholder="Search..."
                  style={{ background: 'rgba(255,253,249,0.07)', border: '1px solid rgba(255,253,249,0.15)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.white, outline: 'none', minWidth: '140px' }} />
                <select value={masterFilterColour} onChange={e => setMasterFilterColour(e.target.value)}
                  style={{ background: 'rgba(255,253,249,0.07)', border: '1px solid rgba(255,253,249,0.15)', borderRadius: '999px', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.white, outline: 'none', cursor: 'pointer' }}>
                  <option value="">All Colours</option><option value="Red">Red</option><option value="White">White</option><option value="Rosé">Rosé</option>
                </select>
                <select value={masterFilterRegion} onChange={e => setMasterFilterRegion(e.target.value)}
                  style={{ background: 'rgba(255,253,249,0.07)', border: '1px solid rgba(255,253,249,0.15)', borderRadius: '999px', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.white, outline: 'none', cursor: 'pointer' }}>
                  <option value="">All Regions</option>{mRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={masterFilterBuyer} onChange={e => setMasterFilterBuyer(e.target.value)}
                  style={{ background: 'rgba(255,253,249,0.07)', border: '1px solid rgba(255,253,249,0.15)', borderRadius: '999px', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.white, outline: 'none', cursor: 'pointer' }}>
                  <option value="">All Buyers</option>{buyerAccess.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}<option value="unassigned">Unassigned</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(255,253,249,0.35)', letterSpacing: '0.08em', marginRight: '4px' }}>SORT:</span>
                {mSortBtn('description', 'Name')}{mSortBtn('vintage', 'Vintage')}{mSortBtn('region', 'Region')}{mSortBtn('country', 'Country')}{mSortBtn('colour', 'Colour')}{mSortBtn('format', 'Size')}{mSortBtn('sale_price', 'Price')}{mSortBtn('quantity', 'Qty')}
              </div>
            </div>

            {mFiltered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: C.muted }}>{masterWines.length === 0 ? 'No wines in master roster yet.' : 'No wines match your filters.'}</div>
            ) : mFiltered.map((w, i) => {
              const wineAssignments = assignments[w.id] || {}
              const size = formatBottleSize(w.bottle_volume, w.bottle_format)
              const salePrice = parseFloat(w.sale_price)
              const dotColor = (w.colour || '').toLowerCase().includes('red') ? '#8b2535' : (w.colour || '').toLowerCase().includes('white') ? '#c9b76a' : (w.colour || '').toLowerCase().includes('ros') ? '#d4748a' : '#b0a090'
              const isLast = i === mFiltered.length - 1
              const noteKey = w.id + ':wine', prodKey = w.id + ':producer', womenKey = w.id + ':women'
              const openNote = masterExpandedNote
              const isAssigningThis = assigningWineId === w.id

              return (
                <div key={w.id} style={{ borderBottom: isLast ? 'none' : '1px solid ' + C.line, background: removingId === w.id ? 'rgba(192,57,43,0.04)' : 'transparent' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 60px 80px 100px 90px auto 80px', gap: '12px', padding: '13px 20px', alignItems: 'center' }}>
                    {/* Wine name */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500, color: C.text }}>{cleanWineName(w.description, w.region, w.country)}</span>
                        {w.women_note && <span style={{ fontSize: '11px', color: '#9b3a4a' }}>♀</span>}
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted, paddingLeft: '14px', marginTop: '1px' }}>{w.vintage} · {[w.region, w.country].filter(Boolean).join(' · ')}</div>
                      <div style={{ display: 'flex', gap: '5px', paddingLeft: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {[{ key: noteKey, type: 'wine', label: 'Wine info', color: C.wine }, { key: prodKey, type: 'producer', label: 'Producer info', color: C.wine }, { key: womenKey, type: 'women', label: 'Women in wine', color: '#9b3a4a' }].map(t => (
                          <button key={t.key} onClick={() => setMasterExpandedNote(openNote === t.key ? null : t.key)}
                            style={{ background: openNote === t.key ? t.color : 'transparent', color: openNote === t.key ? C.white : (t.type === 'women' ? '#9b3a4a' : C.muted), border: '1.5px solid ' + (openNote === t.key ? t.color : C.line), borderRadius: '999px', padding: '2px 9px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Qty */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: C.muted, textAlign: 'center' }}>{parseInt(w.quantity) || 0}</div>
                    {/* Size */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: C.muted }}>{size}</div>
                    {/* Price */}
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: C.text }}>£{salePrice.toFixed(2)}</div>
                    {/* Market price */}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: C.muted }}>
                      {(() => {
                        const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
                        const size = formatBottleSize(w.bottle_volume, w.bottle_format)
                        const duty = (size === '150cl' || size === '300cl') ? 6 : 3
                        const wsDp = ws ? (ws + duty) * 1.2 : null
                        if (!wsDp) return <span style={{ color: C.line }}>—</span>
                        const diff = ((salePrice - wsDp) / wsDp * 100)
                        const color = diff < 0 ? '#2d6a4f' : diff > 0 ? '#c0392b' : C.muted
                        return <div><div style={{ color: C.muted }}>£{wsDp.toFixed(2)}</div><div style={{ fontSize: '10px', color }}>{diff > 0 ? '+' : ''}{diff.toFixed(0)}%</div></div>
                      })()}
                    </div>
                    {/* Buyer tags */}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {buyerAccess.map(buyer => {
                        const ba = wineAssignments[buyer.name]
                        const isAssigned = ba?.assigned
                        return (
                          <div key={buyer.id} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ background: isAssigned ? 'rgba(45,106,79,0.1)' : 'transparent', color: isAssigned ? '#2d6a4f' : C.line, border: '1px solid ' + (isAssigned ? 'rgba(45,106,79,0.3)' : C.line), borderRadius: '4px', padding: '2px 7px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.06em' }}>
                              {isAssigned ? '✓ ' : ''}{buyer.name}{isAssigned && ba.qty != null ? ` (${ba.qty})` : ''}
                            </span>
                            {isAssigned && (
                              <button onClick={() => removeFromBuyer(w.id, buyer.id)} title={`Remove from ${buyer.name}`}
                                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '11px', padding: '1px 3px', lineHeight: 1 }}>x</button>
                            )}
                          </div>
                        )
                      })}
                      <button onClick={() => { setAssigningWineId(isAssigningThis ? null : w.id); if (!isAssigningThis) { const init = {}; buyerAccess.forEach(b => { const ba = wineAssignments[b.name]; init[b.id] = ba?.qty != null ? String(ba.qty) : '' }); setAssignQtys(init) } }}
                        style={{ background: isAssigningThis ? C.wine : 'none', color: isAssigningThis ? C.white : C.wine, border: '1px solid ' + C.wine, borderRadius: '4px', padding: '2px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {isAssigningThis ? 'Cancel' : '+ Assign'}
                      </button>
                    </div>
                    {/* Remove */}
                    <button onClick={() => removeFromMaster(w.id)} disabled={removingId === w.id}
                      style={{ background: 'none', border: '1px solid rgba(192,57,43,0.25)', borderRadius: '6px', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#c0392b', cursor: 'pointer', whiteSpace: 'nowrap', opacity: removingId === w.id ? 0.5 : 1 }}>
                      {removingId === w.id ? '...' : '- Remove'}
                    </button>
                  </div>

                  {/* Assign panel */}
                  {isAssigningThis && (
                    <div style={{ background: 'rgba(110,31,46,0.04)', borderTop: '1px solid ' + C.line, padding: '12px 20px 14px' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.wine, marginBottom: '10px' }}>Assign to buyer — set quantity offered</div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {buyerAccess.map(buyer => {
                          const ba = wineAssignments[buyer.name]
                          const isAssigned = ba?.assigned
                          return (
                            <div key={buyer.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: isAssigned ? '#2d6a4f' : C.muted, letterSpacing: '0.06em' }}>
                                {buyer.name}{isAssigned ? ' (assigned)' : ''}
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input type="number" min="0" max={parseInt(w.quantity) || 99} placeholder={`of ${parseInt(w.quantity) || 0}`}
                                  value={assignQtys[buyer.id] || ''}
                                  onChange={e => setAssignQtys(prev => ({ ...prev, [buyer.id]: e.target.value }))}
                                  style={{ width: '80px', border: '1px solid ' + (isAssigned ? 'rgba(45,106,79,0.4)' : C.line), borderRadius: '6px', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', background: C.white, textAlign: 'center' }} />
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: C.muted }}>btl</span>
                              </div>
                            </div>
                          )
                        })}
                        <button onClick={() => saveAssignment(w.id)} disabled={assignSaving}
                          style={{ background: C.wine, color: C.white, border: 'none', borderRadius: '6px', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: assignSaving ? 'wait' : 'pointer', letterSpacing: '0.06em', alignSelf: 'flex-end' }}>
                          {assignSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Note expand */}
                  {[noteKey, prodKey, womenKey].includes(openNote) && openNote?.startsWith(w.id) && (() => {
                    const type = openNote.split(':')[1]
                    const field = type === 'wine' ? 'buyer_note' : type === 'producer' ? 'producer_note' : 'women_note'
                    const noteText = w[field]
                    const noteColor = type === 'women' ? '#9b3a4a' : C.wine
                    const label = type === 'wine' ? 'Wine info' : type === 'producer' ? 'Producer info' : 'Women in wine'
                    return (
                      <div style={{ background: C.cream, padding: '10px 20px 14px 34px', borderTop: '1px solid ' + C.line }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: noteColor, marginBottom: '6px' }}>{label}</div>
                        {masterEditKey === openNote ? (
                          <div>
                            <textarea value={masterDraft} onChange={e => setMasterDraft(e.target.value)} rows={4}
                              style={{ width: '100%', maxWidth: '680px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', padding: '8px 10px', border: '1px solid ' + C.line, borderRadius: '6px', background: C.white, resize: 'vertical', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                              <button onClick={() => saveMasterNote(w.id, type)} disabled={masterSavingNote} style={{ background: C.wine, color: C.white, border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '10px' }}>{masterSavingNote ? 'Saving...' : 'Save'}</button>
                              <button onClick={() => { setMasterEditKey(null); setMasterDraft('') }} style={{ background: 'none', border: '1px solid ' + C.line, borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: C.muted }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', color: noteText ? C.text : C.muted, fontStyle: noteText ? 'normal' : 'italic', lineHeight: 1.6, maxWidth: '680px', marginBottom: '6px' }}>{noteText || 'No note yet.'}</div>
                            <button onClick={() => { setMasterEditKey(openNote); setMasterDraft(noteText || '') }} style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Edit</button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    )
  }

  // ── Buyer view ────────────────────────────────────────────────────────────

  const selectedCount = Object.keys(selected).length
  return (
    <div style={{ minHeight: '100vh', background: C.cream, paddingBottom: selectedCount > 0 ? (isMobile ? '100px' : '88px') : '48px' }}>
      <Header displayName={buyerDisplayName} wineCount={wines.length} onPrint={() => printPriceList(filtered, buyerDisplayName)} isAdmin={isAdmin} adminTab={adminTab} setAdminTab={setAdminTab} setPreviewBuyer={setPreviewBuyer} setPreviewPin={setPreviewPin} setPreviewError={setPreviewError} isMobile={isMobile} />
      <TermsAccordion termsOpen={termsOpen} setTermsOpen={setTermsOpen} isMobile={isMobile} SIDE={SIDE} />
      <FiltersBar wineList={wines} search={search} setSearch={setSearch} filterColour={filterColour} setFilterColour={setFilterColour} filterRegion={filterRegion} setFilterRegion={setFilterRegion} filterWomen={filterWomen} setFilterWomen={setFilterWomen} sortCol={sortCol} setSortCol={setSortCol} setSortDir={setSortDir} filteredCount={filtered.length} isMobile={isMobile} SIDE={SIDE} />
      <div style={{ maxWidth: '1400px', margin: '16px auto', padding: `0 ${SIDE}` }}>
        {isMobile ? (
          <div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: C.muted }}>{wines.length === 0 ? 'No wines assigned yet.' : 'No wines match your filters.'}</div>
            ) : filtered.map((w, i) => <WineRow key={w.id} w={w} i={i} totalCount={filtered.length} isAdmin={false} selected={selected} setSelected={setSelected} expanded={expanded} setExpanded={setExpanded} editKey={editKey} setEditKey={setEditKey} draft={draft} setDraft={setDraft} savingNote={savingNote} saveNote={saveNote} isMobile={isMobile} />)}
          </div>
        ) : (
          <div style={{ background: C.white, borderRadius: '14px', border: '1px solid ' + C.line, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: C.muted }}>{wines.length === 0 ? 'No wines assigned yet.' : 'No wines match your filters.'}</div>
            ) : filtered.map((w, i) => <WineRow key={w.id} w={w} i={i} totalCount={filtered.length} isAdmin={false} selected={selected} setSelected={setSelected} expanded={expanded} setExpanded={setExpanded} editKey={editKey} setEditKey={setEditKey} draft={draft} setDraft={setDraft} savingNote={savingNote} saveNote={saveNote} isMobile={isMobile} />)}
          </div>
        )}
      </div>
      <OrderBar wineList={wines} displayName={buyerDisplayName} selected={selected} isMobile={isMobile} sendWishlist={sendWishlist} />
    </div>
  )
}
