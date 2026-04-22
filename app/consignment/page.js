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

export default function ConsignmentPage() {
  const router = useRouter()
  const [consignees, setConsignees] = useState([])
  const [items, setItems] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeConsignee, setActiveConsignee] = useState(null)

  const [showAddItem, setShowAddItem] = useState(false)
  const [showLogSale, setShowLogSale] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showAddConsignee, setShowAddConsignee] = useState(false)

  // Add item — inventory search
  const [itemSearch, setItemSearch] = useState('')
  const [itemSearchResults, setItemSearchResults] = useState([])
  const [itemWineId, setItemWineId] = useState(null)
  const [itemSourceId, setItemSourceId] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemVintage, setItemVintage] = useState('')
  const [itemColour, setItemColour] = useState('')
  const [itemSize, setItemSize] = useState('75')
  const [itemQty, setItemQty] = useState(1)
  const [itemPrice, setItemPrice] = useState('')
  const [itemDate, setItemDate] = useState(new Date().toISOString().split('T')[0])
  const [itemNotes, setItemNotes] = useState('')
  const [itemSaving, setItemSaving] = useState(false)

  // Log sale
  const [saleItemId, setSaleItemId] = useState('')
  const [saleDesc, setSaleDesc] = useState('')
  const [saleVintage, setSaleVintage] = useState('')
  const [saleQty, setSaleQty] = useState(1)
  const [salePrice, setSalePrice] = useState('')
  const [salePeriod, setSalePeriod] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [saleNotes, setSaleNotes] = useState('')
  const [saleSaving, setSaleSaving] = useState(false)

  // Add consignee
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAccountsEmail, setNewAccountsEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPrefix, setNewPrefix] = useState('')
  const [newSaving, setNewSaving] = useState(false)

  const [invoiceLines, setInvoiceLines] = useState([])
  const [invoiceRef, setInvoiceRef] = useState('')

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: i }, { data: s }] = await Promise.all([
      supabase.from('consignees').select('*').order('name'),
      supabase.from('consignment_items').select('*').order('date_delivered', { ascending: false }),
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
  const uninvoicedTotal = uninvoicedSales.reduce((sum, s) => sum + parseFloat(s.total_value || 0), 0)
  const totalHeld = activeItems.filter(i => i.status === 'Active').reduce((sum, i) => sum + i.qty_remaining, 0)
  const totalValue = activeItems.filter(i => i.status === 'Active').reduce((sum, i) => sum + (i.qty_remaining * parseFloat(i.dp_price || 0)), 0)

  async function searchInventory(q) {
    setItemSearch(q)
    if (q.length < 2) { setItemSearchResults([]); return }
    const { data } = await supabase
      .from('wines')
      .select('id, source_id, description, vintage, colour, bottle_volume, bottle_format, sale_price')
      .ilike('description', `%${q}%`)
      .order('description')
      .limit(10)
    setItemSearchResults(data || [])
  }

  function selectInventoryWine(w) {
    setItemWineId(w.id)
    setItemSourceId(w.source_id || '')
    setItemDesc(w.description)
    setItemVintage(w.vintage || '')
    setItemColour(w.colour || '')
    const vol = w.bottle_volume || ''
    const fmt = (w.bottle_format || '').toLowerCase()
    if (vol.includes('150') || fmt.includes('magnum')) setItemSize('150')
    else if (vol.includes('37') || fmt.includes('half')) setItemSize('37.5')
    else setItemSize('75')
    if (w.sale_price) setItemPrice(String(w.sale_price))
    setItemSearch('')
    setItemSearchResults([])
  }

  function clearInventorySelection() {
    setItemWineId(null); setItemSourceId(''); setItemDesc(''); setItemVintage('')
    setItemColour(''); setItemSize('75'); setItemPrice(''); setItemSearch(''); setItemSearchResults([])
  }

  async function saveItem() {
    if (!itemDesc || !activeConsignee) return
    setItemSaving(true)
    const { error } = await supabase.from('consignment_items').insert({
      consignee_id: activeConsignee,
      wine_id: itemWineId || null,
      source_id: itemSourceId || null,
      description: itemDesc,
      vintage: itemVintage || null,
      colour: itemColour || null,
      bottle_size: itemSize,
      qty_delivered: itemQty,
      qty_remaining: itemQty,
      dp_price: itemPrice ? parseFloat(itemPrice) : null,
      date_delivered: itemDate,
      notes: itemNotes || null,
      status: 'Active',
    })
    if (!error) { await fetchAll(); closeAddItem() }
    setItemSaving(false)
  }

  async function updateItem(id, field, value) {
    await supabase.from('consignment_items').update({ [field]: value }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function deleteItem(id) {
    if (!confirm('Remove this item from consignment? This cannot be undone.')) return
    await supabase.from('consignment_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function logSale() {
    if ((!saleItemId && !saleDesc) || !salePrice) return
    setSaleSaving(true)
    const item = items.find(i => i.id === saleItemId)
    const description = item ? item.description : saleDesc
    const vintage = item ? item.vintage : saleVintage
    const { error } = await supabase.from('consignment_sales').insert({
      consignee_id: activeConsignee,
      consignment_item_id: saleItemId || null,
      description,
      vintage: vintage || null,
      qty_sold: saleQty,
      price_per_bottle: parseFloat(salePrice),
      period: salePeriod || null,
      date_reported: saleDate,
      notes: saleNotes || null,
      invoiced: false,
    })
    if (!error && item) {
      const newQty = Math.max(0, item.qty_remaining - saleQty)
      await supabase.from('consignment_items').update({
        qty_remaining: newQty,
        status: newQty === 0 ? 'Sold Out' : 'Active',
      }).eq('id', item.id)
    }
    if (!error) { await fetchAll(); closeLogSale() }
    setSaleSaving(false)
  }

  async function markPaid(saleId) {
    await supabase.from('consignment_sales').update({
      invoice_paid: true,
      invoice_paid_date: new Date().toISOString().split('T')[0],
    }).eq('id', saleId)
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, invoice_paid: true } : s))
  }

  async function generateInvoice() {
    if (!activeC || uninvoicedSales.length === 0) return
    const ref = `${activeC.invoice_prefix}${activeC.next_invoice_number}`
    const today = new Date().toISOString().split('T')[0]
    const ids = uninvoicedSales.map(s => s.id)
    await supabase.from('consignment_sales').update({ invoiced: true, invoice_ref: ref, invoice_date: today }).in('id', ids)
    await supabase.from('consignees').update({ next_invoice_number: activeC.next_invoice_number + 1 }).eq('id', activeC.id)
    setInvoiceLines(uninvoicedSales)
    setInvoiceRef(ref)
    await fetchAll()
    setShowInvoice(true)
  }

  async function saveConsignee() {
    if (!newName || !newPrefix) return
    setNewSaving(true)
    await supabase.from('consignees').insert({
      name: newName, contact_name: newContact || null, email: newEmail || null,
      accounts_email: newAccountsEmail || null, address: newAddress || null,
      phone: newPhone || null, invoice_prefix: newPrefix.toUpperCase(),
      next_invoice_number: 101, status: 'Active',
    })
    await fetchAll(); setShowAddConsignee(false); resetConsigneeForm(); setNewSaving(false)
  }

  function closeAddItem() {
    setShowAddItem(false); clearInventorySelection()
    setItemQty(1); setItemDate(new Date().toISOString().split('T')[0]); setItemNotes('')
  }

  function closeLogSale() {
    setShowLogSale(false)
    setSaleItemId(''); setSaleDesc(''); setSaleVintage(''); setSaleQty(1)
    setSalePrice(''); setSalePeriod(''); setSaleDate(new Date().toISOString().split('T')[0]); setSaleNotes('')
  }

  function resetConsigneeForm() {
    setNewName(''); setNewContact(''); setNewEmail(''); setNewAccountsEmail('')
    setNewAddress(''); setNewPhone(''); setNewPrefix('')
  }

  const formatMoney = (n) => n != null ? `£${parseFloat(n).toFixed(2)}` : '—'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading consignments…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden' }}>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; } }
        @media (max-width: 640px) {
          .consignee-grid { display: block !important; }
          .consignee-sidebar { display: flex !important; overflow-x: auto; gap: 8px; margin-bottom: 16px; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
          .consignee-sidebar > div { flex-shrink: 0 !important; min-width: 120px; margin-bottom: 0 !important; }
        }
      `}</style>

      {/* Nav */}
      <div className="no-print" style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100, boxSizing: 'border-box' }}>
    <button onClick={() => router.push('/studio')} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cellar</button>
        <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', flexShrink: 1 }}>
          {[['Studio', '/studio'], ['Bonded Storage', '/admin'], ['Boxes', '/boxes'], ['Buyer', '/buyer'], ['Bottles On Hand', '/local'], ['Consignment', '/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/consignment' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/consignment' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px', borderRadius: '2px', flexShrink: 0 }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="no-print" style={{ padding: '76px 20px 40px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Consignment</div>
          <button onClick={() => setShowAddConsignee(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Add Client</button>
        </div>

        {consignees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '18px' }}>No consignment clients yet.</div>
        ) : (
          <div className="consignee-grid" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* Sidebar — horizontal tab strip on mobile */}
            <div className="consignee-sidebar" style={{ display: 'block' }}>
              {consignees.map(c => {
                const owed = sales.filter(s => s.consignee_id === c.id && !s.invoiced).reduce((sum, s) => sum + parseFloat(s.total_value || 0), 0)
                const isActive = activeConsignee === c.id
                return (
                  <div key={c.id} onClick={() => setActiveConsignee(c.id)}
                    style={{ padding: '12px 14px', marginBottom: '6px', background: isActive ? 'var(--white)' : 'transparent', border: isActive ? '1px solid var(--border)' : '1px solid transparent', cursor: 'pointer', borderLeft: isActive ? '3px solid var(--wine)' : '3px solid transparent', borderRadius: '2px' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>{c.invoice_prefix}</div>
                    {owed > 0 && <div style={{ marginTop: '5px', display: 'inline-block', background: 'rgba(192,57,43,0.1)', color: '#c0392b', fontSize: '10px', fontFamily: 'DM Mono, monospace', fontWeight: 600, padding: '2px 7px', borderRadius: '10px' }}>£{owed.toFixed(2)}</div>}
                  </div>
                )
              })}
            </div>

            {/* Main panel */}
            {activeC && (
              <div style={{ minWidth: 0 }}>

                {/* Summary card */}
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 500 }}>{activeC.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>{activeC.contact_name}{activeC.email ? ` · ${activeC.email}` : ''}</div>
                      {activeC.address && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{activeC.address}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {[[totalHeld, 'held'], [`£${totalValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`, 'out'], [`£${uninvoicedTotal.toFixed(2)}`, 'to invoice', uninvoicedTotal > 0]].map(([val, label, alert]) => (
                        <div key={label} style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'DM Mono, monospace', color: alert ? '#c0392b' : 'var(--ink)' }}>{val}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowAddItem(true)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Consign Wine</button>
                  <button onClick={() => setShowLogSale(true)} style={{ background: 'none', border: '1px solid var(--wine)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>✎ Log Sale</button>
                  {uninvoicedSales.length > 0 && (
                    <button onClick={generateInvoice} style={{ background: 'var(--ink)', color: '#d4ad45', border: 'none', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      ⬡ Invoice {activeC.invoice_prefix}{activeC.next_invoice_number} · £{uninvoicedTotal.toFixed(2)}
                    </button>
                  )}
                </div>

                {/* Wines held */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Wines currently held</div>
                  <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {activeItems.length === 0 ? (
                      <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>No wines consigned yet.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '560px' }}>
                        <thead>
                          <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                            {['Wine', 'Vintage', 'Size', 'Delivered', 'Remaining', 'Price/btl', 'Value out', 'Status', ''].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeItems.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #ede6d6', opacity: item.status !== 'Active' ? 0.5 : 1 }}>
                              <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colourDot(item.colour), flexShrink: 0 }}></span>
                                  <div>
                                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontWeight: item.bottle_size === '150' ? 700 : 500, lineHeight: 1.3 }}>{item.description}</div>
                                    {item.source_id && <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>{item.source_id}</div>}
                                    {item.notes && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{item.notes}</div>}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.vintage || '—'}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{item.bottle_size === '150' ? 'Mag' : item.bottle_size === '37.5' ? 'Half' : '75cl'}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{item.date_delivered}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <input type="number" min="0" defaultValue={item.qty_remaining}
                                  onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== item.qty_remaining) updateItem(item.id, 'qty_remaining', v) }}
                                  style={{ width: '52px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, textAlign: 'center', outline: 'none' }} />
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatMoney(item.dp_price)}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {item.dp_price ? formatMoney(item.qty_remaining * parseFloat(item.dp_price)) : '—'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <select value={item.status} onChange={e => updateItem(item.id, 'status', e.target.value)}
                                  style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '10px', outline: 'none', color: item.status === 'Active' ? '#2d6a4f' : '#c0392b' }}>
                                  {['Active', 'Sold Out', 'Returned', 'Corked'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '10px 8px' }}>
                                <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', padding: '2px 4px' }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Sales history */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Sales history</div>
                  <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {activeSales.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px' }}>No sales recorded yet.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' }}>
                        <thead>
                          <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                            {['Wine', 'Period', 'Qty', 'Price/btl', 'Total', 'Invoice', 'Paid'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeSales.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #ede6d6', background: !s.invoiced ? 'rgba(192,57,43,0.03)' : 'transparent' }}>
                              <td style={{ padding: '9px 12px', minWidth: '160px' }}>
                                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontWeight: s.bottle_size === '150' ? 700 : 500 }}>{s.description}</div>
                                {s.vintage && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{s.vintage}</div>}
                                {s.notes && <div style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic' }}>{s.notes}</div>}
                              </td>
                              <td style={{ padding: '9px 12px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{s.period || s.date_reported}</td>
                              <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace' }}>{s.qty_sold}</td>
                              <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{formatMoney(s.price_per_bottle)}</td>
                              <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMoney(s.total_value)}</td>
                              <td style={{ padding: '9px 12px' }}>
                                {s.invoiced
                                  ? <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: '#E1F5EE', color: '#0F6E56', padding: '2px 7px', borderRadius: '10px', fontWeight: 500 }}>{s.invoice_ref}</span>
                                  : <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'rgba(192,57,43,0.1)', color: '#c0392b', padding: '2px 7px', borderRadius: '10px', fontWeight: 500 }}>Pending</span>}
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                {s.invoiced && !s.invoice_paid && (
                                  <button onClick={() => markPaid(s.id)} style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', padding: '2px 8px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Mark paid</button>
                                )}
                                {s.invoice_paid && <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#2d6a4f' }}>✓ Paid</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Consign Wine Modal ──────────────────────────────────────────────────── */}
      {showAddItem && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Consign to {activeC?.name}</div>
              <button onClick={closeAddItem} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            {/* Inventory search */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Search inventory</label>
              {itemWineId ? (
                <div style={{ background: 'rgba(45,106,79,0.06)', border: '1px solid rgba(45,106,79,0.3)', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#2d6a4f', fontFamily: 'DM Mono, monospace', marginBottom: '4px' }}>✓ FROM INVENTORY</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{itemDesc}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'DM Mono, monospace' }}>
                    {itemVintage}{itemColour ? ` · ${itemColour}` : ''}{itemSourceId ? ` · ${itemSourceId}` : ''}
                  </div>
                  <button onClick={clearInventorySelection} style={{ marginTop: '8px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>✕ Change</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input value={itemSearch} onChange={e => searchInventory(e.target.value)} placeholder="Start typing a wine name…"
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  {itemSearchResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '200px', overflowY: 'auto', position: 'absolute', left: 0, right: 0, zIndex: 10 }}>
                      {itemSearchResults.map(w => (
                        <div key={w.id} onClick={() => selectInventoryWine(w)}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>
                            {w.vintage} · {w.colour}{w.sale_price ? ` · £${parseFloat(w.sale_price).toFixed(2)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!itemWineId && itemSearch.length === 0 && (
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '5px' }}>Can't find it? Fill in the fields below manually.</div>
              )}
            </div>

            {!itemWineId && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Wine / Description *</label>
                <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="e.g. Chambolle-Musigny 1er Cru, Domaine X"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Vintage</label>
                <input value={itemVintage} onChange={e => setItemVintage(e.target.value)} placeholder="e.g. 2019"
                  style={{ width: '100%', border: '1px solid var(--border)', background: itemWineId ? 'var(--cream)' : 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Colour</label>
                <select value={itemColour} onChange={e => setItemColour(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: itemWineId ? 'var(--cream)' : 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">—</option>
                  {['Red', 'White', 'Rosé', 'Sparkling', 'Sweet'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Size</label>
                <select value={itemSize} onChange={e => setItemSize(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="37.5">37.5cl</option>
                  <option value="75">75cl</option>
                  <option value="150">Magnum</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Qty</label>
                <input type="number" min="1" value={itemQty} onChange={e => setItemQty(parseInt(e.target.value) || 1)} onFocus={e => e.target.select()}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Consignment price (£/btl)</label>
                <input type="number" step="0.01" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="0.00" onFocus={e => e.target.select()}
                  style={{ width: '100%', border: '2px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Date delivered</label>
                <input type="date" value={itemDate} onChange={e => setItemDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Notes</label>
              <input value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="optional…"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeAddItem} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveItem} disabled={!itemDesc || itemSaving}
                style={{ background: itemDesc ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: itemDesc ? 'pointer' : 'not-allowed' }}>
                {itemSaving ? 'Saving…' : `Consign ${itemQty} bottle${itemQty !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Log Sale Modal ──────────────────────────────────────────────────────── */}
      {showLogSale && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '480px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Log Sale — {activeC?.name}</div>
              <button onClick={closeLogSale} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Select wine</label>
              <select value={saleItemId} onChange={e => {
                setSaleItemId(e.target.value)
                const item = items.find(i => i.id === e.target.value)
                if (item) { setSaleDesc(item.description); setSaleVintage(item.vintage || ''); setSalePrice(item.dp_price ? String(item.dp_price) : '') }
              }} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— select or enter below —</option>
                {activeItems.filter(i => i.status === 'Active' && i.qty_remaining > 0).map(i => (
                  <option key={i.id} value={i.id}>{i.description} {i.vintage} ({i.qty_remaining} left)</option>
                ))}
              </select>
            </div>
            {!saleItemId && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Or enter description</label>
                <input value={saleDesc} onChange={e => setSaleDesc(e.target.value)} placeholder="Wine description…"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Qty sold</label>
                <input type="number" min="1" value={saleQty} onChange={e => setSaleQty(parseInt(e.target.value) || 1)} onFocus={e => e.target.select()}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Price (£/btl)</label>
                <input type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00" onFocus={e => e.target.select()}
                  style={{ width: '100%', border: '2px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Total</label>
                <div style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, color: '#2d6a4f', border: '1px solid var(--border)', background: 'var(--white)' }}>
                  {salePrice && saleQty ? `£${(parseFloat(salePrice) * saleQty).toFixed(2)}` : '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Period</label>
                <input value={salePeriod} onChange={e => setSalePeriod(e.target.value)} placeholder="e.g. March 2026"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Date reported</label>
                <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Notes</label>
              <input value={saleNotes} onChange={e => setSaleNotes(e.target.value)} placeholder="optional…"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeLogSale} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={logSale} disabled={(!saleItemId && !saleDesc) || !salePrice || saleSaving}
                style={{ background: (saleItemId || saleDesc) && salePrice ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {saleSaving ? 'Saving…' : 'Log Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Consignee Modal ─────────────────────────────────────────────────── */}
      {showAddConsignee && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '480px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300 }}>Add Consignment Client</div>
              <button onClick={() => { setShowAddConsignee(false); resetConsigneeForm() }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Noble Rot"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Invoice prefix * (2–4 chars)</label>
                <input value={newPrefix} onChange={e => setNewPrefix(e.target.value.toUpperCase())} placeholder="e.g. NR" maxLength={4}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, letterSpacing: '0.2em', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Contact name</label>
                <input value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="e.g. Callum"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Wines email</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="wines@…"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Accounts email</label>
                <input value={newAccountsEmail} onChange={e => setNewAccountsEmail(e.target.value)} placeholder="accounts@…"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Address</label>
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Street, City, Postcode"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddConsignee(false); resetConsigneeForm() }} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveConsignee} disabled={!newName || !newPrefix || newSaving}
                style={{ background: newName && newPrefix ? 'var(--ink)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {newSaving ? 'Saving…' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Invoice Modal ───────────────────────────────────────────────────────── */}
      {showInvoice && activeC && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--white)', width: '100%', maxWidth: '680px', marginTop: '20px', marginBottom: '40px' }}>
            <div style={{ background: 'var(--ink)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#d4ad45', letterSpacing: '0.1em' }}>INVOICE PREVIEW — {invoiceRef}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} style={{ background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '7px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>Print / Save PDF</button>
                <button onClick={() => setShowInvoice(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '7px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
            <div style={{ padding: '52px 56px', fontFamily: 'Cormorant Garamond, serif' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 500, marginBottom: '10px' }}>{INVOICE_FROM.name}</div>
                  <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.8 }}>
                    {INVOICE_FROM.address}<br />{INVOICE_FROM.phone}<br />{INVOICE_FROM.email}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '30px', fontWeight: 300, letterSpacing: '0.04em', color: 'var(--wine)', marginBottom: '6px' }}>Invoice: {invoiceRef}</div>
                  <div style={{ fontSize: '12px', color: '#888', fontFamily: 'DM Mono, monospace' }}>
                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#2d6a4f' }}>Payable upon receipt</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '36px', borderTop: '1px solid #ede6d6', paddingTop: '24px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '8px' }}>Bill to</div>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>{activeC.name}</div>
                  {activeC.contact_name && <div style={{ fontSize: '13px', color: '#555' }}>Attn: {activeC.contact_name}</div>}
                  {activeC.address && <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6, marginTop: '4px' }}>{activeC.address}</div>}
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '8px' }}>Payment details</div>
                  <div style={{ fontSize: '12px', lineHeight: 1.8, fontFamily: 'DM Mono, monospace', color: '#444' }}>
                    {INVOICE_FROM.bank_name}<br />Sort Code: {INVOICE_FROM.sort_code}<br />Account: {INVOICE_FROM.account_number}
                  </div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--ink)' }}>
                    {['Wine', 'Vintage', 'Qty', 'Unit price', 'Total'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 8px', textAlign: i > 1 ? 'right' : 'left', fontWeight: 500, fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#666' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoiceLines.map((line, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ede6d6' }}>
                      <td style={{ padding: '13px 8px', fontWeight: 500 }}>{line.description}</td>
                      <td style={{ padding: '13px 8px', color: '#888', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>{line.vintage || '—'}</td>
                      <td style={{ padding: '13px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>{line.qty_sold}</td>
                      <td style={{ padding: '13px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>£{parseFloat(line.price_per_bottle).toFixed(2)}</td>
                      <td style={{ padding: '13px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600 }}>£{parseFloat(line.total_value).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--ink)' }}>
                    <td colSpan={2} />
                    <td colSpan={2} style={{ padding: '16px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 500, fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555' }}>Amount due</td>
                    <td style={{ padding: '16px 8px', textAlign: 'right', fontSize: '22px', fontWeight: 700, fontFamily: 'DM Mono, monospace', color: 'var(--wine)' }}>
                      £{invoiceLines.reduce((sum, l) => sum + parseFloat(l.total_value || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div style={{ fontSize: '11px', color: '#bbb', fontFamily: 'DM Mono, monospace', textAlign: 'center', marginTop: '40px', borderTop: '1px solid #f0ebe2', paddingTop: '20px', letterSpacing: '0.06em' }}>
                All prices inclusive of duty and VAT · Thank you for your business
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
