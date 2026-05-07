'use client'
export const dynamic = 'force-dynamic'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const INVOICE_FROM = {
  name: 'Jessica Bride',
  address: '25 Hillgate Street, London W8 7SP',
  phone: '+44 (0) 7767 367256',
  email: 'Jessica.Bride@gmail.com',
  bank_name: 'BARCLAYS BANK — MS JE BRIDE',
  sort_code: '20-31-52',
  account_number: '63453472',
}

const colourDot = (colour) => {
  const c = (colour || '').toLowerCase()
  if (c.includes('white')) return '#d4c88a'
  if (c.includes('ros')) return '#d4748a'
  if (c.includes('red')) return '#8b2535'
  if (c.includes('spark')) return '#a8c4d4'
  if (c.includes('sweet')) return '#c4a85a'
  return '#aaa'
}

const fmt = (n) => n != null ? `£${parseFloat(n).toFixed(2)}` : '—'

function sizeLabel(s) {
  if (!s) return '75cl'
  if (s === '150') return 'Magnum (150cl)'
  if (s === '37.5') return 'Half Bottle (37.5cl)'
  if (s === '300') return 'Double Magnum (300cl)'
  return '75cl'
}

function sizeLabelShort(s) {
  if (!s) return '75cl'
  if (s === '150') return 'Magnum'
  if (s === '37.5') return 'Half'
  if (s === '300') return 'Dbl Mag'
  return '75cl'
}

export default function ConsignmentPage() {
  const router = useRouter()
  const [consignees, setConsignees] = useState([])
  const [items, setItems] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeConsignee, setActiveConsignee] = useState(null)
  const [statusMsg, setStatusMsg] = useState(null)

  const [showAddItem, setShowAddItem] = useState(false)
  const [showStocktake, setShowStocktake] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showAddConsignee, setShowAddConsignee] = useState(false)
  const [showRecordSales, setShowRecordSales] = useState(false)

  // Checkbox selection for pull list / delivery note
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Expanded invoice groups in sales history
  const [expandedInvoices, setExpandedInvoices] = useState(new Set())

  // Add item
  const [itemSearch, setItemSearch] = useState('')
  const [itemSearchResults, setItemSearchResults] = useState([])
  const [itemWineId, setItemWineId] = useState(null)
  const [itemSourceId, setItemSourceId] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemVintage, setItemVintage] = useState('')
  const [itemColour, setItemColour] = useState('')
  const [itemSize, setItemSize] = useState('75')
  const [itemQty, setItemQty] = useState(1)
  const [itemSalePrice, setItemSalePrice] = useState('')
  const [itemDate, setItemDate] = useState(new Date().toISOString().split('T')[0])
  const [itemNotes, setItemNotes] = useState('')
  const [itemSaving, setItemSaving] = useState(false)

  // Record sales (monthly entry)
  const [salesEntries, setSalesEntries] = useState([{ itemId: '', qty: 1 }])
  const [salesPeriod, setSalesPeriod] = useState('')
  const [salesSaving, setSalesSaving] = useState(false)

  // Stocktake
  const [stocktakeCounts, setStocktakeCounts] = useState({})
  const [stocktakePeriod, setStocktakePeriod] = useState('')
  const [stocktakeDate, setStocktakeDate] = useState(new Date().toISOString().split('T')[0])
  const [stocktakeSaving, setStocktakeSaving] = useState(false)

  // Invoice
  const [invoiceLines, setInvoiceLines] = useState([])
  const [invoiceRef, setInvoiceRef] = useState('')

  // Add consignee
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAccountsEmail, setNewAccountsEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPrefix, setNewPrefix] = useState('')
  const [newSaving, setNewSaving] = useState(false)

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchAll()
  }, [])

  function showStatus(type, text, ms = 5000) {
    setStatusMsg({ type, text }); setTimeout(() => setStatusMsg(null), ms)
  }

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: i }, { data: s }] = await Promise.all([
      supabase.from('consignees').select('*').order('name'),
      supabase.from('consignment_items')
        .select('*, wines(buyer_note, women_note)')
        .order('date_delivered', { ascending: false }),
      supabase.from('consignment_sales').select('*').order('date_reported', { ascending: false }),
    ])
    setConsignees(c || [])
    setItems(i || [])
    setSales(s || [])
    if (!activeConsignee && c && c.length > 0) setActiveConsignee(c[0].id)
    setLoading(false)
  }

  const activeC = consignees.find(c => c.id === activeConsignee)
  const activeItems = items.filter(i => i.consignee_id === activeConsignee)
  const activeSales = sales.filter(s => s.consignee_id === activeConsignee)
  const uninvoicedSales = activeSales.filter(s => !s.invoiced)
  const invoicedSales = activeSales.filter(s => s.invoiced)
  const uninvoicedTotal = uninvoicedSales.reduce((sum, s) => sum + parseFloat(s.total_value || 0), 0)
  const totalHeld = activeItems.filter(i => i.status === 'Active').reduce((sum, i) => sum + (i.qty_remaining || 0), 0)
  const valueOut = activeItems.filter(i => i.status === 'Active').reduce((sum, i) => {
    const p = parseFloat(i.sale_price || i.dp_price || 0)
    return sum + (i.qty_remaining || 0) * p
  }, 0)
  const staleItems = activeItems.filter(i => i.status === 'Active' && i.qty_remaining === 0)

  // Group invoiced sales by invoice_ref
  const invoiceGroups = invoicedSales.reduce((acc, s) => {
    const ref = s.invoice_ref || 'Unknown'
    if (!acc[ref]) acc[ref] = []
    acc[ref].push(s)
    return acc
  }, {})

  // Selection helpers
  const selectedActiveItems = activeItems.filter(i => selectedIds.has(i.id))
  const allActiveIds = activeItems.filter(i => i.status === 'Active').map(i => i.id)
  const allSelected = allActiveIds.length > 0 && allActiveIds.every(id => selectedIds.has(id))

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(prev => { const next = new Set(prev); allActiveIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelectedIds(prev => { const next = new Set(prev); allActiveIds.forEach(id => next.add(id)); return next })
    }
  }

  function toggleInvoiceExpand(ref) {
    setExpandedInvoices(prev => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref); else next.add(ref)
      return next
    })
  }

  // ─── Pull List ──────────────────────────────────────────────────────────────
  function buildPullListHtml(selItems, consignee) {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const rows = selItems.map(item => {
      const buyerNote = item.wines?.buyer_note || ''
      const womenNote = item.wines?.women_note || ''
      const dot = colourDot(item.colour)
      const fd = item.description || ''
      const ci = fd.indexOf(',')
      const winePart = ci > -1 ? fd.slice(0, ci).trim() : fd
      const producerPart = ci > -1 ? fd.slice(ci + 1).trim() : ''
      const badge = item.bottle_size !== '75' ? `<span style="font-family:'DM Mono',monospace;font-size:11px;color:#6b1e2e;font-weight:600;margin-left:6px;">${sizeLabelShort(item.bottle_size)}</span>` : ''
      return `
        <div style="padding:22px 0;border-bottom:1px solid #ede6d6;">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${buyerNote || womenNote ? '10px' : '0'};">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dot};flex-shrink:0;margin-top:6px;"></span>
            <div>
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
                <span style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;line-height:1.2;">${winePart}</span>
                ${item.vintage ? `<span style="font-family:'DM Mono',monospace;font-size:13px;color:#7a6652;">${item.vintage}</span>` : ''}
                ${badge}
              </div>
              ${producerPart ? `<div style="font-family:'Cormorant Garamond',serif;font-size:15px;color:#3a2a1a;margin-top:2px;">${producerPart}</div>` : ''}
              ${item.colour ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;margin-top:3px;">${item.colour}</div>` : ''}
            </div>
          </div>
          ${buyerNote ? `<div style="font-family:'Cormorant Garamond',serif;font-size:14px;line-height:1.7;color:#3a2a1a;margin-left:19px;">${buyerNote}</div>` : ''}
          ${womenNote ? `<div style="display:flex;align-items:flex-start;gap:5px;margin-top:8px;margin-left:19px;"><span style="font-size:14px;color:#9b3a4a;flex-shrink:0;line-height:1.5;">♀</span><span style="font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#9b3a4a;line-height:1.6;">${womenNote}</span></div>` : ''}
        </div>`
    }).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pull List — ${consignee.name}</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cormorant Garamond',serif;color:#1a1008;background:#fff;padding:52px;font-size:14px}@media print{body{padding:28px}}div:last-child{border-bottom:none}</style></head><body>
    <div style="border-bottom:2px solid #1a1008;padding-bottom:20px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;">
      <div><div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;letter-spacing:0.05em;">Belle Année Wines</div><div style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-top:3px;">Restaurant Wine List</div></div>
      <div style="text-align:right;"><div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;">${consignee.name}</div>${consignee.contact_name ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;margin-top:2px;">Attn: ${consignee.contact_name}</div>` : ''}<div style="font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;margin-top:2px;">${today}</div></div>
    </div>
    <div style="margin-bottom:8px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#c8b89a;">${selItems.length} wine${selItems.length !== 1 ? 's' : ''} · For staff reference — prices not shown</div>
    ${rows}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:10px;color:#c8b89a;letter-spacing:0.08em;text-align:center;">BELLE ANNÉE WINES · ${INVOICE_FROM.address} · ${INVOICE_FROM.phone}</div>
    </body></html>`
  }

  // ─── Delivery Note ─────────────────────────────────────────────────────────
  function buildDeliveryNoteHtml(selItems, consignee) {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const totalQty = selItems.reduce((sum, i) => sum + (i.qty_delivered || 1), 0)
    const totalValue = selItems.reduce((sum, i) => sum + (parseFloat(i.sale_price || i.dp_price || 0) * (i.qty_delivered || 1)), 0)
    const rows = selItems.map(item => {
      const dot = colourDot(item.colour)
      const fd = item.description || ''
      const ci = fd.indexOf(',')
      const winePart = ci > -1 ? fd.slice(0, ci).trim() : fd
      const producerPart = ci > -1 ? fd.slice(ci + 1).trim() : ''
      const price = parseFloat(item.sale_price || item.dp_price || 0)
      const lineTotal = price * (item.qty_delivered || 1)
      return `<tr><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;vertical-align:top;"><div style="display:flex;align-items:center;gap:7px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;"></span><div><div style="font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:500;">${winePart}</div>${producerPart ? `<div style="font-family:'Cormorant Garamond',serif;font-size:13px;color:#7a6652;">${producerPart}</div>` : ''}</div></div></td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:12px;color:#7a6652;white-space:nowrap;">${item.vintage || '—'}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;white-space:nowrap;">${sizeLabel(item.bottle_size)}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;text-align:center;font-family:'DM Mono',monospace;font-size:14px;font-weight:600;">${item.qty_delivered || 1}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;">${fmt(price)}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;">${fmt(lineTotal)}</td></tr>`
    }).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Delivery Note — ${consignee.name}</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Mono',monospace;color:#1a1008;background:#fff;padding:52px;font-size:12px}@media print{body{padding:28px}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1a1008;">
      <div><div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;letter-spacing:0.06em;">Belle Année Wines</div><div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-top:3px;">Delivery Note</div><div style="font-size:11px;color:#7a6652;margin-top:10px;line-height:1.8;">${INVOICE_FROM.name}<br/>${INVOICE_FROM.address}<br/>${INVOICE_FROM.phone}<br/>${INVOICE_FROM.email}</div></div>
      <div style="text-align:right;"><div style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;letter-spacing:0.1em;text-transform:uppercase;color:#7a6652;margin-bottom:4px;">Delivered to</div><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;">${consignee.name}</div>${consignee.contact_name ? `<div style="font-size:12px;color:#7a6652;margin-top:3px;">Attn: ${consignee.contact_name}</div>` : ''}${consignee.address ? `<div style="font-size:11px;color:#7a6652;margin-top:4px;line-height:1.6;">${consignee.address}</div>` : ''}${consignee.email ? `<div style="font-size:11px;color:#7a6652;margin-top:3px;">${consignee.email}</div>` : ''}<div style="font-size:13px;font-weight:600;color:#1a1008;margin-top:12px;">${today}</div></div>
    </div>
    <div style="margin-bottom:10px;padding:8px 12px;background:rgba(212,173,69,0.08);border:1px solid rgba(212,173,69,0.3);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#7a5e10;">Sale or Return — wines remain property of Belle Année Wines until sold</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><thead><tr style="border-bottom:2px solid #1a1008;"><th style="padding:8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Wine</th><th style="padding:8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Vintage</th><th style="padding:8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Format</th><th style="padding:8px;text-align:center;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Qty</th><th style="padding:8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Price/btl</th><th style="padding:8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Value</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:32px;"><div style="min-width:240px;border-top:2px solid #1a1008;padding-top:12px;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;"><span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;">Total bottles</span><span style="font-family:'DM Mono',monospace;font-size:15px;font-weight:600;">${totalQty}</span></div><div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;">Total value</span><span style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:#6b1e2e;">${fmt(totalValue)}</span></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;padding-top:20px;border-top:1px solid #ede6d6;"><div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Received by</div><div style="height:40px;border-bottom:1px solid #c8b89a;margin-bottom:6px;"></div><div style="font-size:11px;color:#7a6652;">Signature &amp; date</div></div><div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Delivered by</div><div style="height:40px;border-bottom:1px solid #c8b89a;margin-bottom:6px;"></div><div style="font-size:11px;color:#7a6652;">${INVOICE_FROM.name}</div></div></div>
    <div style="margin-top:32px;font-size:10px;color:#c8b89a;font-family:'DM Mono',monospace;letter-spacing:0.08em;text-align:center;">All prices inclusive of duty and VAT · Belle Année Wines · ${new Date().getFullYear()}</div>
    </body></html>`
  }

  function printHtml(html) {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    iframe.onload = () => { setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 2000) }, 300) }
  }

  function handlePullList() { if (!activeC || selectedActiveItems.length === 0) return; printHtml(buildPullListHtml(selectedActiveItems, activeC)) }
  function handleDeliveryNote() { if (!activeC || selectedActiveItems.length === 0) return; printHtml(buildDeliveryNoteHtml(selectedActiveItems, activeC)) }

  async function searchInventory(q) {
    setItemSearch(q)
    if (q.length < 2) { setItemSearchResults([]); return }
    const { data } = await supabase.from('wines').select('id, source_id, description, vintage, colour, bottle_volume, bottle_format, sale_price').ilike('description', `%${q}%`).order('description').limit(10)
    setItemSearchResults(data || [])
  }

  function selectInventoryWine(w) {
    setItemWineId(w.id); setItemSourceId(w.source_id || ''); setItemDesc(w.description)
    setItemVintage(w.vintage || ''); setItemColour(w.colour || '')
    const vol = w.bottle_volume || ''; const fmt2 = (w.bottle_format || '').toLowerCase()
    if (vol.includes('150') || fmt2.includes('magnum')) setItemSize('150')
    else if (vol.includes('37') || fmt2.includes('half')) setItemSize('37.5')
    else setItemSize('75')
    if (w.sale_price) setItemSalePrice(String(parseFloat(w.sale_price).toFixed(2)))
    setItemSearch(''); setItemSearchResults([])
  }

  function clearInventorySelection() {
    setItemWineId(null); setItemSourceId(''); setItemDesc(''); setItemVintage('')
    setItemColour(''); setItemSize('75'); setItemSalePrice(''); setItemSearch(''); setItemSearchResults([])
  }

  async function saveItem() {
    if (!itemDesc || !activeConsignee) return
    if (!itemSalePrice) { showStatus('error', 'Sale price is required.'); return }
    setItemSaving(true)
    const saleP = parseFloat(itemSalePrice)
    const { error } = await supabase.from('consignment_items').insert({
      consignee_id: activeConsignee, wine_id: itemWineId || null, source_id: itemSourceId || null,
      description: itemDesc, vintage: itemVintage || null, colour: itemColour || null,
      bottle_size: itemSize, qty_delivered: itemQty, qty_remaining: itemQty,
      sale_price: saleP, dp_price: saleP,
      date_delivered: itemDate, notes: itemNotes || null, status: 'Active',
    })
    if (!error) { await fetchAll(); closeAddItem(); showStatus('success', `${itemQty} bottle${itemQty !== 1 ? 's' : ''} consigned to ${activeC?.name}`) }
    else showStatus('error', 'Failed to save: ' + error.message)
    setItemSaving(false)
  }

  async function updateItem(id, field, value) {
    const { error } = await supabase.from('consignment_items').update({ [field]: value }).eq('id', id)
    if (!error) setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function deleteItem(id) {
    if (!confirm('Remove this item from consignment? Sales history will remain.')) return
    const { error } = await supabase.from('consignment_items').delete().eq('id', id)
    if (!error) { setItems(prev => prev.filter(i => i.id !== id)); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  function closeAddItem() {
    setShowAddItem(false); clearInventorySelection()
    setItemQty(1); setItemDate(new Date().toISOString().split('T')[0]); setItemNotes('')
  }

  // ─── Record Sales ──────────────────────────────────────────────────────────
  function openRecordSales() {
    setSalesEntries([{ itemId: '', qty: 1 }])
    setSalesPeriod('')
    setShowRecordSales(true)
  }

  function addSalesEntry() { setSalesEntries(prev => [...prev, { itemId: '', qty: 1 }]) }
  function removeSalesEntry(idx) { setSalesEntries(prev => prev.filter((_, i) => i !== idx)) }
  function updateSalesEntry(idx, field, value) { setSalesEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e)) }

  async function saveRecordedSales() {
    const valid = salesEntries.filter(e => e.itemId && e.qty > 0)
    if (!valid.length) { showStatus('error', 'Add at least one wine with a quantity.'); return }
    if (!salesPeriod.trim()) { showStatus('error', 'Please enter a period e.g. "May 2026"'); return }
    setSalesSaving(true)
    try {
      const rows = valid.map(e => {
        const item = activeItems.find(i => i.id === e.itemId)
        if (!item) return null
        return {
          consignee_id: activeConsignee,
          consignment_item_id: item.id,
          description: item.description,
          vintage: item.vintage || null,
          qty_sold: e.qty,
          price_per_bottle: parseFloat(item.sale_price || item.dp_price || 0),
          period: salesPeriod.trim(),
          date_reported: new Date().toISOString().split('T')[0],
          invoiced: false,
          invoice_paid: false,
        }
      }).filter(Boolean)
      const { error } = await supabase.from('consignment_sales').insert(rows)
      if (error) throw error
      await fetchAll()
      setShowRecordSales(false)
      showStatus('success', `${rows.length} sale${rows.length !== 1 ? 's' : ''} recorded for ${salesPeriod}.`)
    } catch (err) { showStatus('error', 'Failed to save: ' + err.message) }
    setSalesSaving(false)
  }

  // ─── Stocktake ─────────────────────────────────────────────────────────────
  function openStocktake() {
    const counts = {}
    activeItems.filter(i => i.status === 'Active').forEach(i => { counts[i.id] = i.qty_remaining })
    setStocktakeCounts(counts); setStocktakePeriod('')
    setStocktakeDate(new Date().toISOString().split('T')[0]); setShowStocktake(true)
  }

  function getStocktakeDiffs() {
    return activeItems.filter(i => i.status === 'Active').map(i => {
      const reported = parseInt(stocktakeCounts[i.id] ?? i.qty_remaining) || 0
      const sold = Math.max(0, i.qty_remaining - reported)
      const lineTotal = sold * parseFloat(i.sale_price || i.dp_price || 0)
      return { item: i, reported, sold, lineTotal }
    }).filter(d => d.sold > 0)
  }

  async function confirmStocktake() {
    const diffs = getStocktakeDiffs()
    if (diffs.length === 0) { showStatus('error', 'No sales detected — all quantities match.'); return }
    if (!stocktakePeriod.trim()) { showStatus('error', 'Please enter a period label e.g. "April 2026"'); return }
    setStocktakeSaving(true)
    try {
      const { data: stocktake, error: stErr } = await supabase.from('stocktakes').insert({ consignee_id: activeConsignee, stocktake_date: stocktakeDate, period_label: stocktakePeriod }).select().single()
      if (stErr) throw stErr
      const saleRows = diffs.map(d => ({ consignee_id: activeConsignee, consignment_item_id: d.item.id, description: d.item.description, vintage: d.item.vintage || null, qty_sold: d.sold, price_per_bottle: parseFloat(d.item.sale_price || d.item.dp_price || 0), period: stocktakePeriod, date_reported: stocktakeDate, invoiced: false, invoice_paid: false, stocktake_id: stocktake.id }))
      const { error: sErr } = await supabase.from('consignment_sales').insert(saleRows)
      if (sErr) throw sErr
      for (const d of diffs) { await supabase.from('consignment_items').update({ qty_remaining: d.reported, status: d.reported === 0 ? 'Sold Out' : 'Active' }).eq('id', d.item.id) }
      await fetchAll(); setShowStocktake(false)
      showStatus('success', `Stocktake recorded — ${diffs.length} wine${diffs.length !== 1 ? 's' : ''} sold this period.`)
    } catch (err) { showStatus('error', 'Stocktake failed: ' + err.message) }
    setStocktakeSaving(false)
  }

  // ─── Invoice ────────────────────────────────────────────────────────────────
  async function generateInvoice() {
    if (!activeC || uninvoicedSales.length === 0) return
    const year = new Date().getFullYear()
    const ref = `${activeC.invoice_prefix}-${year}-${String(activeC.next_invoice_number).padStart(3, '0')}`
    const today = new Date().toISOString().split('T')[0]
    const ids = uninvoicedSales.map(s => s.id)
    const { error } = await supabase.from('consignment_sales').update({ invoiced: true, invoice_ref: ref, invoice_date: today }).in('id', ids)
    if (error) { showStatus('error', 'Failed to create invoice: ' + error.message); return }
    await supabase.from('consignees').update({ next_invoice_number: activeC.next_invoice_number + 1 }).eq('id', activeC.id)
    setInvoiceLines(uninvoicedSales); setInvoiceRef(ref)
    await fetchAll(); setShowInvoice(true)
  }

  function openInvoice(ref) {
    const lines = activeSales.filter(x => x.invoice_ref === ref)
    setInvoiceLines(lines); setInvoiceRef(ref); setShowInvoice(true)
  }

  async function markInvoicePaid(ref) {
    const today = new Date().toISOString().split('T')[0]
    const ids = activeSales.filter(s => s.invoice_ref === ref).map(s => s.id)
    const { error } = await supabase.from('consignment_sales').update({ invoice_paid: true, invoice_paid_date: today }).in('id', ids)
    if (!error) { setSales(prev => prev.map(s => ids.includes(s.id) ? { ...s, invoice_paid: true, invoice_paid_date: today } : s)); showStatus('success', `${ref} marked as paid.`) }
  }

  function buildInvoiceHtml(lines, ref, consignee) {
    const grandTotal = lines.reduce((sum, l) => sum + parseFloat(l.total_value || 0), 0)
    const rows = lines.map(l => `<tr><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:500;">${l.description || ''}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:12px;color:#7a6652;">${l.vintage || '—'}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;text-align:center;font-family:'DM Mono',monospace;font-size:13px;">${l.qty_sold}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;">${fmt(l.price_per_bottle)}</td><td style="padding:12px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;">${fmt(l.total_value)}</td></tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${ref}</title><style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Mono',monospace;color:#1a1008;background:#fff;padding:52px;font-size:12px}@media print{body{padding:28px}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:2px solid #1a1008;"><div><div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;letter-spacing:0.06em;">Belle Année Wines</div><div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-top:3px;">${INVOICE_FROM.name}</div><div style="font-size:11px;color:#7a6652;margin-top:8px;line-height:1.7;">${INVOICE_FROM.address}<br/>${INVOICE_FROM.phone}<br/>${INVOICE_FROM.email}</div></div><div style="text-align:right;"><div style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:#6b1e2e;">${ref}</div><div style="font-size:11px;color:#7a6652;margin-top:6px;">${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div><div style="font-size:11px;color:#2d6a4f;margin-top:4px;font-weight:600;">Payable upon receipt</div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #ede6d6;"><div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Bill To</div><div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;">${consignee.name}</div>${consignee.contact_name ? `<div style="font-size:13px;color:#555;margin-top:3px;">Attn: ${consignee.contact_name}</div>` : ''}${consignee.address ? `<div style="font-size:12px;color:#555;margin-top:4px;line-height:1.6;">${consignee.address}</div>` : ''}</div><div><div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-bottom:8px;">Payment</div><div style="font-size:12px;line-height:1.8;color:#3a2a1a;">${INVOICE_FROM.bank_name}<br/>Sort Code: ${INVOICE_FROM.sort_code}<br/>Account: ${INVOICE_FROM.account_number}</div></div></div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><thead><tr style="border-bottom:2px solid #1a1008;"><th style="padding:8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Wine</th><th style="padding:8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Vintage</th><th style="padding:8px;text-align:center;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Qty</th><th style="padding:8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Unit</th><th style="padding:8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:32px;"><div style="min-width:220px;border-top:2px solid #1a1008;padding-top:12px;display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;">Amount Due</span><span style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:500;color:#6b1e2e;">${fmt(grandTotal)}</span></div></div>
    <div style="font-size:10px;color:#c8b89a;font-family:'DM Mono',monospace;text-align:center;letter-spacing:0.08em;border-top:1px solid #ede6d6;padding-top:20px;">All prices inclusive of duty and VAT · Belle Année Wines · ${new Date().getFullYear()}</div>
    </body></html>`
  }

  function printInvoice() { if (!activeC) return; printHtml(buildInvoiceHtml(invoiceLines, invoiceRef, activeC)) }
  function pdfInvoice() {
    if (!activeC) return
    const html = buildInvoiceHtml(invoiceLines, invoiceRef, activeC)
    const win = window.open('', '_blank', 'width=900,height=1100')
    if (!win) { showStatus('error', 'Please allow popups to save PDF'); return }
    win.document.write(html); win.document.close(); setTimeout(() => { win.focus(); win.print() }, 600)
  }

  async function saveConsignee() {
    if (!newName || !newPrefix) return
    setNewSaving(true)
    const { error } = await supabase.from('consignees').insert({ name: newName, contact_name: newContact || null, email: newEmail || null, accounts_email: newAccountsEmail || null, address: newAddress || null, phone: newPhone || null, invoice_prefix: newPrefix.toUpperCase(), next_invoice_number: 101, status: 'Active' })
    if (!error) { await fetchAll(); setShowAddConsignee(false); resetConsigneeForm(); showStatus('success', `${newName} added.`) }
    else showStatus('error', 'Failed: ' + error.message)
    setNewSaving(false)
  }

  function resetConsigneeForm() { setNewName(''); setNewContact(''); setNewEmail(''); setNewAccountsEmail(''); setNewAddress(''); setNewPhone(''); setNewPrefix('') }

  if (loading) return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading consignments…</div></div>)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100, boxSizing: 'border-box' }}>
        <button onClick={() => router.push('/studio')} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cellar</button>
        <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', flexShrink: 1 }}>
          {[['Studio', '/studio'], ['Bonded Storage', '/admin'], ['Boxes', '/boxes'], ['Buyer', '/buyer'], ['Bottles On Hand', '/local'], ['Consignment', '/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/consignment' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/consignment' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px', borderRadius: '2px', flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: 'pointer', padding: '4px 8px', flexShrink: 0, marginLeft: '6px' }}>Out</button>
      </div>

      {statusMsg && (
        <div style={{ position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: statusMsg.type === 'success' ? 'rgba(45,106,79,0.95)' : 'rgba(192,57,43,0.95)', color: 'var(--white)', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {statusMsg.type === 'success' ? '✓ ' : '✕ '}{statusMsg.text}
        </div>
      )}

      <div style={{ padding: '76px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Consignment</div>
          <button onClick={() => setShowAddConsignee(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Add Restaurant</button>
        </div>

        {consignees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>No consignment clients yet — add a restaurant above.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '20px', alignItems: 'start' }}>

            <div>
              {consignees.map(c => {
                const owed = sales.filter(s => s.consignee_id === c.id && !s.invoiced).reduce((sum, s) => sum + parseFloat(s.total_value || 0), 0)
                const isActive = activeConsignee === c.id
                return (
                  <div key={c.id} onClick={() => { setActiveConsignee(c.id); setSelectedIds(new Set()) }} style={{ padding: '12px 14px', marginBottom: '6px', background: isActive ? 'var(--white)' : 'transparent', border: isActive ? '1px solid var(--border)' : '1px solid transparent', cursor: 'pointer', borderLeft: isActive ? '3px solid var(--wine)' : '3px solid transparent', borderRadius: '2px' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>{c.invoice_prefix}</div>
                    {owed > 0 && <div style={{ marginTop: '5px', display: 'inline-block', background: 'rgba(192,57,43,0.1)', color: '#c0392b', fontSize: '10px', fontFamily: 'DM Mono, monospace', fontWeight: 600, padding: '2px 7px', borderRadius: '10px' }}>£{owed.toFixed(2)} due</div>}
                  </div>
                )
              })}
            </div>

            {activeC && (
              <div style={{ minWidth: 0 }}>

                {/* Restaurant header */}
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 500 }}>{activeC.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>{activeC.contact_name}{activeC.email ? ` · ${activeC.email}` : ''}{activeC.accounts_email ? ` · ${activeC.accounts_email}` : ''}</div>
                      {activeC.address && <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{activeC.address}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'DM Mono, monospace', color: 'var(--ink)' }}>{totalHeld}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>bottles held</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'DM Mono, monospace', color: 'var(--ink)' }}>£{valueOut.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>value out</div>
                      </div>
                      {uninvoicedTotal > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'DM Mono, monospace', color: '#c0392b' }}>£{uninvoicedTotal.toFixed(2)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>to invoice</div>
                        </div>
                      )}
                    </div>
                  </div>
                  {staleItems.length > 0 && (<div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(212,173,69,0.1)', border: '1px solid rgba(212,173,69,0.4)', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7a5e10' }}>⚠ {staleItems.length} wine{staleItems.length !== 1 ? 's' : ''} at qty 0 but still Active — update status below.</div>)}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setShowAddItem(true)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Consign Wine</button>
                  <button onClick={openRecordSales} style={{ background: 'none', border: '1px solid var(--wine)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>✎ Record Sales</button>
                  <button onClick={openStocktake} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📋 Stocktake</button>
                  {uninvoicedSales.length > 0 && (
                    <button onClick={generateInvoice} style={{ background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      £ Invoice · £{uninvoicedTotal.toFixed(2)}
                    </button>
                  )}
                  {selectedActiveItems.length > 0 && (
                    <>
                      <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.08em' }}>{selectedActiveItems.length} selected:</span>
                        <button onClick={handlePullList} style={{ background: 'var(--ink)', color: 'var(--white)', border: 'none', padding: '9px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>🖨 Pull List</button>
                        <button onClick={handleDeliveryNote} style={{ background: 'none', border: '1px solid var(--ink)', color: 'var(--ink)', padding: '9px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>📄 Delivery Note</button>
                      </div>
                    </>
                  )}
                </div>

                {/* Wines held table */}
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Wines at {activeC.name}</div>
                    {activeItems.filter(i => i.status === 'Active').length > 0 && (<div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>☑ check to print Pull List or Delivery Note</div>)}
                  </div>
                  <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                    {activeItems.length === 0 ? (
                      <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>No wines consigned yet.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '620px' }}>
                        <thead>
                          <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                            <th style={{ padding: '8px 12px', width: '36px' }}>
                              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#d4ad45' }} />
                            </th>
                            {['Wine', 'Vintage', 'Size', 'Delivered', 'Remaining', 'Sale £/btl', 'Value out', 'Status', ''].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeItems.map(item => {
                            const isStale = item.status === 'Active' && item.qty_remaining === 0
                            const isChecked = selectedIds.has(item.id)
                            const isActive = item.status === 'Active'
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #ede6d6', opacity: item.status !== 'Active' ? 0.5 : 1, background: isChecked ? 'rgba(107,30,46,0.04)' : isStale ? 'rgba(212,173,69,0.06)' : 'transparent' }}>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  {isActive && <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(item.id)} style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--wine)' }} />}
                                </td>
                                <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colourDot(item.colour), flexShrink: 0 }}></span>
                                    <div>
                                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontWeight: 500, lineHeight: 1.3 }}>{item.description}</div>
                                      {item.source_id && <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>{item.source_id}</div>}
                                      {item.notes && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px', fontStyle: 'italic' }}>{item.notes}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>{item.vintage || '—'}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{sizeLabelShort(item.bottle_size)}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{item.date_delivered}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <input type="number" min="0" defaultValue={item.qty_remaining} onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== item.qty_remaining) updateItem(item.id, 'qty_remaining', v) }} style={{ width: '52px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, textAlign: 'center', outline: 'none' }} />
                                </td>
                                <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, color: 'var(--wine)' }}>{fmt(item.sale_price || item.dp_price)}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600 }}>
                                  {(item.sale_price || item.dp_price) ? fmt((item.qty_remaining || 0) * parseFloat(item.sale_price || item.dp_price)) : '—'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <select value={item.status} onChange={e => updateItem(item.id, 'status', e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', outline: 'none', color: item.status === 'Active' ? '#2d6a4f' : '#c0392b' }}>
                                    {['Active', 'Sold Out', 'Returned', 'Corked'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td style={{ padding: '10px 8px' }}>
                                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', padding: '2px 4px' }}>✕</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* ── Sales section ─────────────────────────────────────────── */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>Sales</div>

                  {/* Sold — not yet invoiced */}
                  {uninvoicedSales.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#c0392b', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Sold — not yet invoiced</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#c0392b' }}>£{uninvoicedTotal.toFixed(2)}</span>
                          <button onClick={generateInvoice} style={{ background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>£ Invoice now</button>
                        </div>
                      </div>
                      <div style={{ background: 'var(--white)', border: '1px solid rgba(192,57,43,0.3)', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(192,57,43,0.06)' }}>
                              {['Wine', 'Period', 'Qty', 'Price/btl', 'Total', ''].map(h => (
                                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {uninvoicedSales.map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid #ede6d6' }}>
                                <td style={{ padding: '9px 12px', minWidth: '160px' }}>
                                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontWeight: 500 }}>{s.description}</div>
                                  {s.vintage && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{s.vintage}</div>}
                                </td>
                                <td style={{ padding: '9px 12px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{s.period || s.date_reported}</td>
                                <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace' }}>{s.qty_sold}</td>
                                <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{fmt(s.price_per_bottle)}</td>
                                <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(s.total_value)}</td>
                                <td style={{ padding: '9px 8px' }}>
                                  <button onClick={async () => { if (!confirm('Delete this sale entry?')) return; await supabase.from('consignment_sales').delete().eq('id', s.id); setSales(prev => prev.filter(x => x.id !== s.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px', padding: '2px 4px' }}>✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Invoice history — grouped */}
                  {Object.keys(invoiceGroups).length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Invoice history</div>
                      <div style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
                        {Object.entries(invoiceGroups).sort((a, b) => b[0].localeCompare(a[0])).map(([ref, lines], gi) => {
                          const groupTotal = lines.reduce((sum, l) => sum + parseFloat(l.total_value || 0), 0)
                          const isPaid = lines.every(l => l.invoice_paid)
                          const isExpanded = expandedInvoices.has(ref)
                          const invoiceDate = lines[0]?.invoice_date || lines[0]?.date_reported
                          return (
                            <div key={ref} style={{ borderBottom: gi < Object.keys(invoiceGroups).length - 1 ? '1px solid var(--border)' : 'none' }}>
                              {/* Invoice row header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', gap: '12px', flexWrap: 'wrap', background: isExpanded ? 'rgba(26,16,8,0.03)' : 'transparent' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, color: 'var(--wine)' }}>{ref}</span>
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{invoiceDate}</span>
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
                                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{fmt(groupTotal)}</span>
                                  {isPaid
                                    ? <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#2d6a4f', background: 'rgba(45,106,79,0.1)', padding: '2px 8px', borderRadius: '10px', fontWeight: 500 }}>✓ Paid</span>
                                    : <button onClick={() => markInvoicePaid(ref)} style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'none', border: '1px solid rgba(45,106,79,0.4)', cursor: 'pointer', padding: '2px 8px', color: '#2d6a4f', whiteSpace: 'nowrap', borderRadius: '2px' }}>Mark paid</button>
                                  }
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                  <button onClick={() => openInvoice(ref)} style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'var(--wine)', color: 'var(--white)', border: 'none', cursor: 'pointer', padding: '5px 10px', whiteSpace: 'nowrap' }}>🖨 Print</button>
                                  <button onClick={() => toggleInvoiceExpand(ref)} style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', padding: '5px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                    {isExpanded ? '▲ hide' : '▼ details'}
                                  </button>
                                </div>
                              </div>
                              {/* Expanded line items */}
                              {isExpanded && (
                                <div style={{ borderTop: '1px solid #ede6d6', background: 'rgba(26,16,8,0.02)' }}>
                                  {lines.map((l, li) => (
                                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 40px 80px 80px', gap: '8px', padding: '8px 14px 8px 28px', borderBottom: li < lines.length - 1 ? '1px solid #ede6d6' : 'none', alignItems: 'baseline', fontSize: '12px' }}>
                                      <div>
                                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontWeight: 500 }}>{l.description}</span>
                                        {l.vintage && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginLeft: '6px' }}>{l.vintage}</span>}
                                      </div>
                                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{l.period || l.date_reported}</div>
                                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', textAlign: 'center' }}>{l.qty_sold}</div>
                                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', textAlign: 'right' }}>{fmt(l.price_per_bottle)}</div>
                                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>{fmt(l.total_value)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {activeSales.length === 0 && uninvoicedSales.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', background: 'var(--white)', border: '1px solid var(--border)' }}>No sales recorded yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Record Sales Modal ─────────────────────────────────────────────────── */}
      {showRecordSales && activeC && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '540px', border: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ background: 'var(--ink)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(253,250,245,0.5)', textTransform: 'uppercase' }}>Record Sales — </span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#d4ad45' }}>{activeC.name}</span>
              </div>
              <button onClick={() => setShowRecordSales(false)} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.6)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>✕ Close</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(212,173,69,0.08)', border: '1px solid rgba(212,173,69,0.3)', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7a5e10', lineHeight: 1.6 }}>
                Enter what {activeC.name} has sold this period. These accumulate as uninvoiced — generate an invoice when you're ready to bill.
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Period *</label>
                <input value={salesPeriod} onChange={e => setSalesPeriod(e.target.value)} placeholder="e.g. May 2026"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Wine</div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textAlign: 'center' }}>Qty sold</div>
                </div>
                {salesEntries.map((entry, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                    <select
                      value={entry.itemId}
                      onChange={e => updateSalesEntry(idx, 'itemId', e.target.value)}
                      style={{ border: entry.itemId ? '1px solid var(--border)' : '2px solid rgba(107,30,46,0.25)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', outline: 'none', width: '100%' }}
                    >
                      <option value="">— select wine —</option>
                      {activeItems.filter(i => i.status === 'Active').map(i => (
                        <option key={i.id} value={i.id}>{i.description}{i.vintage ? ` ${i.vintage}` : ''}{i.bottle_size === '150' ? ' (Mag)' : ''}</option>
                      ))}
                    </select>
                    <input
                      type="number" min="1" value={entry.qty}
                      onChange={e => updateSalesEntry(idx, 'qty', parseInt(e.target.value) || 1)}
                      onFocus={e => e.target.select()}
                      style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 6px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, textAlign: 'center', outline: 'none', width: '100%' }}
                    />
                    {salesEntries.length > 1
                      ? <button onClick={() => removeSalesEntry(idx)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '16px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>✕</button>
                      : <div />
                    }
                  </div>
                ))}
              </div>
              <button onClick={addSalesEntry} style={{ background: 'none', border: '1px dashed var(--border)', width: '100%', padding: '8px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', letterSpacing: '0.08em', marginBottom: '16px' }}>
                + Add another wine
              </button>
              {/* Preview total */}
              {salesEntries.some(e => e.itemId && e.qty > 0) && (
                <div style={{ padding: '10px 14px', background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.25)', marginBottom: '16px', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>
                  {salesEntries.filter(e => e.itemId && e.qty > 0).map((e, i) => {
                    const item = activeItems.find(x => x.id === e.itemId)
                    if (!item) return null
                    const lineTotal = e.qty * parseFloat(item.sale_price || item.dp_price || 0)
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: 'var(--ink)' }}>
                        <span>{item.description.split(',')[0]} ×{e.qty}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(lineTotal)}</span>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid rgba(45,106,79,0.25)', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#2d6a4f' }}>
                    <span>Total</span>
                    <span>{fmt(salesEntries.filter(e => e.itemId && e.qty > 0).reduce((sum, e) => { const item = activeItems.find(x => x.id === e.itemId); return sum + (item ? e.qty * parseFloat(item.sale_price || item.dp_price || 0) : 0) }, 0))}</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowRecordSales(false)} style={{ background: 'none', border: '1px solid var(--border)', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveRecordedSales} disabled={salesSaving} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: salesSaving ? 'wait' : 'pointer' }}>
                  {salesSaving ? 'Saving…' : '✓ Save Sales'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Consign Wine Modal ─────────────────────────────────────────────────── */}
      {showAddItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Consign to {activeC?.name}</div>
              <button onClick={closeAddItem} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Search inventory</label>
              {itemWineId ? (
                <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', marginBottom: '4px' }}>✓ FROM INVENTORY</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{itemDesc}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'DM Mono, monospace' }}>{itemVintage}{itemColour ? ` · ${itemColour}` : ''}{itemSourceId ? ` · ${itemSourceId}` : ''}</div>
                  <button onClick={clearInventorySelection} style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Change</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input value={itemSearch} onChange={e => searchInventory(e.target.value)} placeholder="Start typing a wine name…" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  {itemSearchResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '200px', overflowY: 'auto', position: 'absolute', left: 0, right: 0, zIndex: 10 }}>
                      {itemSearchResults.map(w => (
                        <div key={w.id} onClick={() => selectInventoryWine(w)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }} onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>{w.vintage} · {w.colour}{w.sale_price ? ` · £${parseFloat(w.sale_price).toFixed(2)}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!itemWineId && <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '5px' }}>Can't find it? Fill in the fields below.</div>}
            </div>
            {!itemWineId && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Wine / Description *</label>
                <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="e.g. Chambolle-Musigny 1er Cru, Domaine X" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Vintage</label>
                <input value={itemVintage} onChange={e => setItemVintage(e.target.value)} placeholder="e.g. 2019" style={{ width: '100%', border: '1px solid var(--border)', background: itemWineId ? 'var(--cream)' : 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Colour</label>
                <select value={itemColour} onChange={e => setItemColour(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', background: itemWineId ? 'var(--cream)' : 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">—</option>
                  {['Red', 'White', 'Rosé', 'Sparkling', 'Sweet'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Size</label>
                <select value={itemSize} onChange={e => setItemSize(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="37.5">37.5cl</option><option value="75">75cl</option><option value="150">Magnum</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Qty delivered</label>
                <input type="number" min="1" value={itemQty} onChange={e => setItemQty(parseInt(e.target.value) || 1)} onFocus={e => e.target.select()} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Sale price £/btl *</label>
                <input type="number" step="0.01" value={itemSalePrice} onChange={e => setItemSalePrice(e.target.value)} placeholder="0.00" onFocus={e => e.target.select()} style={{ width: '100%', border: '2px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
                <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>price billed to restaurant</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Date delivered</label>
                <input type="date" value={itemDate} onChange={e => setItemDate(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Notes</label>
              <input value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="optional…" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeAddItem} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveItem} disabled={!itemDesc || itemSaving} style={{ background: itemDesc ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: itemDesc ? 'pointer' : 'not-allowed' }}>
                {itemSaving ? 'Saving…' : `Consign ${itemQty} bottle${itemQty !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stocktake Modal ────────────────────────────────────────────────────── */}
      {showStocktake && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '620px', border: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ background: 'var(--ink)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(253,250,245,0.5)', textTransform: 'uppercase' }}>Stocktake — </span><span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#d4ad45' }}>{activeC?.name}</span></div>
              <button onClick={() => setShowStocktake(false)} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.6)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>✕ Close</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(212,173,69,0.08)', border: '1px solid rgba(212,173,69,0.3)', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7a5e10', lineHeight: 1.6 }}>
                Enter how many bottles the restaurant currently has. Cellar calculates what was sold and creates sales records automatically. Use this for a full reconciliation — for regular monthly reporting use "Record Sales" instead.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Period label *</label>
                  <input value={stocktakePeriod} onChange={e => setStocktakePeriod(e.target.value)} placeholder="e.g. Q2 2026" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Date</label>
                  <input type="date" value={stocktakeDate} onChange={e => setStocktakeDate(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', background: 'var(--white)', marginBottom: '20px' }}>
                {activeItems.filter(i => i.status === 'Active').length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>No active wines to stocktake.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(26,16,8,0.06)' }}>
                        {['Wine', 'We think', 'They have', 'Sold / value'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i > 0 ? (i === 3 ? 'right' : 'center') : 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.filter(i => i.status === 'Active').map(item => {
                        const reported = parseInt(stocktakeCounts[item.id] ?? item.qty_remaining) || 0
                        const sold = Math.max(0, item.qty_remaining - reported)
                        const lineVal = sold * parseFloat(item.sale_price || item.dp_price || 0)
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #ede6d6', background: sold > 0 ? 'rgba(45,106,79,0.04)' : 'transparent' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', fontWeight: 500 }}>{item.description}</div>
                              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>{item.vintage}{(item.sale_price || item.dp_price) ? ` · ${fmt(item.sale_price || item.dp_price)}/btl` : ''}</div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>{item.qty_remaining}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input type="number" min="0" max={item.qty_remaining} value={stocktakeCounts[item.id] ?? item.qty_remaining} onChange={e => setStocktakeCounts(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))} onFocus={e => e.target.select()} style={{ width: '60px', border: '2px solid rgba(107,30,46,0.25)', background: 'rgba(107,30,46,0.03)', padding: '5px 8px', fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 700, textAlign: 'center', outline: 'none', color: 'var(--wine)' }} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              {sold > 0 ? (<div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, color: '#2d6a4f' }}>{sold} sold</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#2d6a4f' }}>£{lineVal.toFixed(2)}</div></div>) : <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {(() => {
                const diffs = getStocktakeDiffs()
                const total = diffs.reduce((s, d) => s + d.lineTotal, 0)
                const totalSold = diffs.reduce((s, d) => s + d.sold, 0)
                if (diffs.length === 0) return (<div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>No changes detected — all quantities match.</div>)
                return (
                  <div style={{ padding: '14px 16px', background: 'rgba(45,106,79,0.07)', border: '1px solid rgba(45,106,79,0.3)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#2d6a4f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Reconciliation — {stocktakePeriod || '(enter period above)'}</div>
                    {diffs.map(d => (<div key={d.item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}><span style={{ color: 'var(--ink)' }}>{d.item.description} {d.item.vintage || ''}</span><span style={{ color: '#2d6a4f', fontWeight: 600 }}>{d.sold} sold · £{d.lineTotal.toFixed(2)}</span></div>))}
                    <div style={{ borderTop: '1px solid rgba(45,106,79,0.3)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{totalSold} bottle{totalSold !== 1 ? 's' : ''} total</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#2d6a4f' }}>£{total.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowStocktake(false)} style={{ background: 'none', border: '1px solid var(--border)', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmStocktake} disabled={stocktakeSaving || getStocktakeDiffs().length === 0} style={{ background: getStocktakeDiffs().length > 0 ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: getStocktakeDiffs().length > 0 ? 'pointer' : 'not-allowed' }}>
                  {stocktakeSaving ? 'Saving…' : '✓ Confirm Stocktake'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Invoice Preview Modal ──────────────────────────────────────────────── */}
      {showInvoice && activeC && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '680px', border: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ background: 'var(--ink)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(253,250,245,0.5)', textTransform: 'uppercase' }}>Invoice</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#d4ad45', fontWeight: 600 }}>{invoiceRef}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={pdfInvoice} style={{ background: 'rgba(107,30,46,0.7)', color: 'var(--white)', border: 'none', padding: '7px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>⬇ PDF</button>
                <button onClick={printInvoice} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '7px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>🖨 Print</button>
                <button onClick={() => setShowInvoice(false)} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.6)', padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ padding: '40px 48px', background: 'var(--white)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '20px', borderBottom: '2px solid var(--ink)' }}>
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 300, letterSpacing: '0.06em' }}>Belle Année Wines</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{INVOICE_FROM.name}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.8 }}>{INVOICE_FROM.address}<br />{INVOICE_FROM.phone}<br />{INVOICE_FROM.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 500, color: 'var(--wine)' }}>{invoiceRef}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#2d6a4f', marginTop: '4px', fontWeight: 600 }}>Payable upon receipt</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Bill To</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500 }}>{activeC.name}</div>
                  {activeC.contact_name && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>Attn: {activeC.contact_name}</div>}
                  {activeC.address && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.6 }}>{activeC.address}</div>}
                </div>
                <div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Payment</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', lineHeight: 1.8, color: 'var(--ink)' }}>{INVOICE_FROM.bank_name}<br />Sort Code: {INVOICE_FROM.sort_code}<br />Account: {INVOICE_FROM.account_number}</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--ink)' }}>
                    {[['Wine', 'left'], ['Vintage', 'left'], ['Qty', 'center'], ['Unit', 'right'], ['Total', 'right']].map(([label, align]) => (
                      <th key={label} style={{ padding: '8px 8px', textAlign: align, fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoiceLines.map((line, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ede6d6' }}>
                      <td style={{ padding: '11px 8px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{line.description}</td>
                      <td style={{ padding: '11px 8px', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>{line.vintage || '—'}</td>
                      <td style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>{line.qty_sold}</td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>{fmt(line.price_per_bottle)}</td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600 }}>{fmt(line.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
                <div style={{ minWidth: '220px', borderTop: '2px solid var(--ink)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Amount Due</span>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 500, color: 'var(--wine)' }}>{fmt(invoiceLines.reduce((s, l) => s + parseFloat(l.total_value || 0), 0))}</span>
                </div>
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px', letterSpacing: '0.06em' }}>All prices inclusive of duty and VAT · Belle Année Wines · {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Restaurant Modal ───────────────────────────────────────────────── */}
      {showAddConsignee && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '480px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Add Restaurant</div>
              <button onClick={() => { setShowAddConsignee(false); resetConsigneeForm() }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Restaurant name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Noble Rot" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Invoice prefix * (2–4 chars)</label>
                <input value={newPrefix} onChange={e => setNewPrefix(e.target.value.toUpperCase())} placeholder="e.g. NR" maxLength={4} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, letterSpacing: '0.2em', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Contact name</label>
                <input value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="e.g. Callum" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Wines email</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="wines@…" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Accounts email</label>
                <input value={newAccountsEmail} onChange={e => setNewAccountsEmail(e.target.value)} placeholder="accounts@…" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Address</label>
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Street, City, Postcode" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(212,173,69,0.08)', border: '1px solid rgba(212,173,69,0.3)', fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#7a5e10' }}>
              Invoice numbering will start at {newPrefix ? `${newPrefix}-${new Date().getFullYear()}-101` : '[PREFIX]-YYYY-101'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddConsignee(false); resetConsigneeForm() }} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveConsignee} disabled={!newName || !newPrefix || newSaving} style={{ background: newName && newPrefix ? 'var(--ink)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {newSaving ? 'Saving…' : 'Add Restaurant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
