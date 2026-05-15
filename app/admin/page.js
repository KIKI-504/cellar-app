'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [wines, setWines] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterColour, setFilterColour] = useState('')
  const [filterBuyer, setFilterBuyer] = useState('')
  const [sortCol, setSortCol] = useState('description')
  const [sortDir, setSortDir] = useState(1)
  const [page, setPage] = useState(0)
  const [showValues, setShowValues] = useState(false)
  const [expandedNote, setExpandedNote] = useState(null)
  const [expandedPrice, setExpandedPrice] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [importConflicts, setImportConflicts] = useState([])
  const [overrideModal, setOverrideModal] = useState(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [otherSourceName, setOtherSourceName] = useState('')
  const [showOtherSourceInput, setShowOtherSourceInput] = useState(false)
  const otherFileRef = useRef(null)
  const [showMergeModal, setShowMergeModal] = useState(false)

  // ─── Release Order state ─────────────────────────────────────────────────
  const [releaseBasket, setReleaseBasket] = useState({})      // { wineId: qty }
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [releaseSaving, setReleaseSaving] = useState(false)
  const [releaseOrders, setReleaseOrders] = useState([])
  const [showReleaseHistory, setShowReleaseHistory] = useState(false)
  const [expandedReleaseOrder, setExpandedReleaseOrder] = useState(null)

  const PAGE_SIZE = 50

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') router.push('/')
    else { fetchWines(); fetchReleaseOrders() }
  }, [])

  async function fetchWines() {
    setLoading(true)
    const { data, error } = await supabase.from('wines').select('*').neq('source', 'Manual').order('description')
    if (error) console.error(error)
    else { setWines(data); setFiltered(data) }
    setLoading(false)
  }

  async function fetchReleaseOrders() {
    const { data } = await supabase.from('release_orders').select('*').order('order_date', { ascending: false }).order('created_at', { ascending: false })
    setReleaseOrders(data || [])
  }

  useEffect(() => {
    let result = [...wines]
    if (filterSource) result = result.filter(w => w.source === filterSource)
    if (filterColour) result = result.filter(w => w.colour?.toLowerCase().includes(filterColour.toLowerCase()))
    if (filterBuyer === 'included') result = result.filter(w => w.include_in_buyer_view)
    if (filterBuyer === 'missing-retail') result = result.filter(w => !w.retail_price)
    if (filterBuyer === 'competitive') result = result.filter(w => isCompetitive(w))
    if (filterBuyer === 'women') result = result.filter(w => w.women_note)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(w => [w.description, w.region, w.country, w.vintage, w.colour, w.source].join(' ').toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      let av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      if (typeof av === 'number') return (av - bv) * sortDir
      return String(av).localeCompare(String(bv)) * sortDir
    })
    setFiltered(result)
    setPage(0)
  }, [wines, search, filterSource, filterColour, filterBuyer, sortCol, sortDir])

  function isMagnum(w) {
    const vol = String(w.bottle_volume || '').replace(/[^0-9]/g, '')
    const fmt = (w.bottle_format || '').toLowerCase()
    return vol === '150' || vol === '1500' || fmt.includes('magnum')
  }

  // ─── DP formula: (IB + duty) × 1.2  ──────────────────────────────────────
  // duty = £3 for 75cl, £6 for 150cl/magnum
  function dutyForWine(w) { return isMagnum(w) ? 6 : 3 }
  function dpForWine(w) {
    if (!w.purchase_price_per_bottle) return null
    return (parseFloat(w.purchase_price_per_bottle) + dutyForWine(w)) * 1.2
  }

  function isCompetitive(w) {
    if (!w.ws_lowest_per_bottle || !w.purchase_price_per_bottle) return false
    const dp = dpForWine(w)
    const wsDP = (parseFloat(w.ws_lowest_per_bottle) + dutyForWine(w)) * 1.2
    return dp < wsDP
  }

  async function updateWine(id, field, value) {
    const update = { [field]: value }
    if (field === 'retail_price') update.retail_price_date = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('wines').update(update).eq('id', id)
    if (!error) setWines(prev => prev.map(w => w.id === id ? { ...w, ...update } : w))
  }

  async function saveOverride() {
    if (!overrideModal || !overrideNote.trim()) return
    const { wine, field, newVal } = overrideModal
    const update = {
      [field]: newVal,
      manual_override_note: overrideNote.trim(),
      manual_override_date: new Date().toISOString().split('T')[0],
      manual_override_field: field,
    }
    const { error } = await supabase.from('wines').update(update).eq('id', wine.id)
    if (!error) {
      setWines(prev => prev.map(w => w.id === wine.id ? { ...w, ...update } : w))
      setOverrideModal(null); setOverrideNote('')
    }
  }

  function openOverride(wine, field, newVal) {
    setOverrideModal({ wine, field, oldVal: wine[field], newVal }); setOverrideNote('')
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function getDateColour(dateStr) {
    if (!dateStr) return ''
    const days = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
    if (days < 30) return '#2d6a4f'
    if (days < 90) return '#b8942a'
    return '#c0392b'
  }

  function openWineSearcher(description, vintage) {
    const keywords = description.toLowerCase().replace(/,/g, '').replace(/\s+/g, '+')
    window.open(`https://www.wine-searcher.com/find/${keywords}/${vintage}/uk/gbp`, '_blank')
  }

  async function moveToStudio(wine) {
    const qty = parseInt(prompt(`Move to studio — how many bottles?\n\n${wine.description} ${wine.vintage}\n(${wine.quantity} in bond)`))
    if (!qty || isNaN(qty) || qty < 1) return
    const dp = dpForWine(wine)?.toFixed(2)
    const { error } = await supabase.from('studio').insert({
      wine_id: wine.id, quantity: qty,
      date_moved: new Date().toISOString().split('T')[0],
      dp_price: dp, status: 'Available', include_in_local: false,
    })
    if (error) alert('Error moving to studio: ' + error.message)
    else alert(`✓ ${qty} bottle${qty > 1 ? 's' : ''} moved to studio at DP £${dp}`)
  }

  // ─── Release Order helpers ────────────────────────────────────────────────
  function toggleReleaseBasket(wine) {
    setReleaseBasket(prev => {
      if (prev[wine.id]) { const next = { ...prev }; delete next[wine.id]; return next }
      const caseSize = parseInt(wine.case_size) || 12
      return { ...prev, [wine.id]: caseSize }
    })
  }

  function setReleaseQty(wineId, caseSize, cases) {
    const qty = (parseInt(cases) || 1) * (parseInt(caseSize) || 12)
    setReleaseBasket(prev => ({ ...prev, [wineId]: qty }))
  }

  function releaseBasketItems() {
    return Object.entries(releaseBasket).map(([wineId, qty]) => {
      const w = wines.find(x => x.id === wineId)
      if (!w) return null
      const ib = parseFloat(w.purchase_price_per_bottle) || 0
      const duty = dutyForWine(w)
      const dpPerBottle = (ib + duty) * 1.2
      const caseSize = parseInt(w.case_size) || 12
      const dutyVatPerBottle = dpPerBottle - ib
      return { w, qty, ib, duty, dpPerBottle, dpTotal: dpPerBottle * qty, ibTotal: ib * qty, dutyVatPerBottle, dutyVatTotal: dutyVatPerBottle * qty, caseSize }
    }).filter(Boolean)
  }

  async function saveReleaseOrder() {
    const items = releaseBasketItems().map(({ w, qty, ib, duty, dpPerBottle, dpTotal, ibTotal, caseSize }) => ({
      wine_id: w.id, source_id: w.source_id, description: w.description,
      vintage: w.vintage, source: w.source, colour: w.colour, region: w.region,
      bottle_format: w.bottle_format, ib_price: ib, duty_per_bottle: duty,
      qty, case_size: caseSize, ib_total: ibTotal, dp_per_bottle: dpPerBottle, dp_total: dpTotal, duty_vat_per_bottle: dpPerBottle - ib, duty_vat_total: (dpPerBottle - ib) * qty,
    }))
    setReleaseSaving(true)
    const { error } = await supabase.from('release_orders').insert({
      order_date: new Date().toISOString().split('T')[0],
      notes: releaseNotes.trim() || null,
      items,
    })
    if (!error) {
      await fetchReleaseOrders()
      setReleaseBasket({}); setReleaseNotes(''); setShowReleaseModal(false)
    }
    setReleaseSaving(false)
  }

  async function deleteReleaseOrder(id) {
    if (!confirm('Delete this release order? This cannot be undone.')) return
    await supabase.from('release_orders').delete().eq('id', id)
    setReleaseOrders(prev => prev.filter(r => r.id !== id))
  }

  function buildReleaseHtml(order) {
    const items = order.items || []
    const bySource = items.reduce((acc, item) => {
      const src = item.source || 'Unknown'
      if (!acc[src]) acc[src] = []
      acc[src].push(item)
      return acc
    }, {})
    const today = new Date(order.order_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const sourceSections = Object.entries(bySource).map(([src, srcItems]) => {
      const srcTotal = srcItems.reduce((s, i) => s + (i.duty_vat_total || (parseFloat(i.dp_per_bottle||0) - parseFloat(i.ib_price||0)) * parseInt(i.qty||1)), 0)
      const srcIBTotal = srcItems.reduce((s, i) => s + i.ib_total, 0)
      const rows = srcItems.map(i => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:500;">${i.description}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:12px;color:#7a6652;">${i.vintage || '—'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;white-space:nowrap;">${i.source_id || '—'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;text-align:center;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;">${i.qty}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:12px;">£${parseFloat(i.ib_price).toFixed(2)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:12px;">£${(i.duty_vat_per_bottle || (parseFloat(i.dp_per_bottle||0) - parseFloat(i.ib_price||0))).toFixed(2)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #ede6d6;text-align:right;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;">£${(i.duty_vat_total || ((parseFloat(i.dp_per_bottle||0) - parseFloat(i.ib_price||0)) * parseInt(i.qty||1))).toFixed(2)}</td>
        </tr>`).join('')
      return `
        <div style="margin-bottom:36px;">
          <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;color:#6b1e2e;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #c8b89a;">${src}</div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
            <thead><tr style="border-bottom:2px solid #1a1008;">
              <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Wine</th>
              <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Vintage</th>
              <th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Ref / SID</th>
              <th style="padding:7px 8px;text-align:center;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Bottles</th>
              <th style="padding:7px 8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">IB/btl</th>
              <th style="padding:7px 8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Duty+VAT/btl</th>
              <th style="padding:7px 8px;text-align:right;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6652;font-weight:500;">Duty+VAT Est.</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="display:flex;justify-content:flex-end;">
            <div style="min-width:220px;border-top:1px solid #1a1008;padding-top:8px;">
              <div style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;margin-bottom:4px;">
                <span>IB total (already paid)</span><span>£${srcIBTotal.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:#1a1008;">
                <span>Est. duty + VAT due</span><span style="font-weight:700;">£${srcTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>`
    }).join('')

    const grandTotal = items.reduce((s, i) => s + (i.duty_vat_total || (parseFloat(i.dp_per_bottle||0) - parseFloat(i.ib_price||0)) * parseInt(i.qty||1)), 0)
    const notesHtml = order.notes ? `<div style="margin-top:20px;padding:12px 14px;background:#faf7f0;border:1px solid #c8b89a;font-family:'DM Mono',monospace;font-size:11px;color:#7a6652;">${order.notes}</div>` : ''

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Release Order — ${today}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Mono',monospace;color:#1a1008;background:#fff;padding:48px;font-size:12px}@media print{body{padding:24px}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1a1008;">
      <div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;letter-spacing:0.06em;">Belle Année Wines</div>
        <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#7a6652;margin-top:3px;">Release Order</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;color:#6b1e2e;">Release Request</div>
        <div style="font-size:12px;color:#7a6652;margin-top:4px;">${today}</div>
        <div style="font-size:11px;color:#7a6652;margin-top:3px;">Jessica Bride · 25 Hillgate Street, London W8 7SP</div>
      </div>
    </div>
    <div style="margin-bottom:10px;padding:8px 12px;background:rgba(212,173,69,0.08);border:1px solid rgba(212,173,69,0.3);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#7a5e10;">
      Please release the following wines for delivery. Prices shown are for reference only.
    </div>
    <div style="margin-top:24px;">${sourceSections}</div>
    <div style="margin-top:24px;padding-top:16px;border-top:2px solid #1a1008;display:flex;justify-content:flex-end;">
      <div style="min-width:260px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#7a6652;">Estimated Duty + VAT Due</span>
          <span style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;color:#6b1e2e;">£${grandTotal.toFixed(2)}</span>
        </div>
        <div style="font-size:9px;color:#c8b89a;margin-top:4px;font-family:'DM Mono',monospace;">DP = (IB + duty) × 1.2 · 75cl duty £3/btl · Magnum duty £6/btl</div>
      </div>
    </div>
    ${notesHtml}
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #ede6d6;font-size:10px;color:#c8b89a;text-align:center;letter-spacing:0.08em;">BELLE ANNÉE WINES · ${new Date().getFullYear()}</div>
    </body></html>`
  }

  function printReleaseOrder(order) {
    const html = buildReleaseHtml(order)
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    iframe.onload = () => { setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 2000) }, 300) }
  }

  function emailReleaseOrder(order, source) {
    const items = (order.items || []).filter(i => i.source === source)
    const today = new Date(order.order_date).toLocaleDateString('en-GB')
    const lines = items.map(i => `${i.description} ${i.vintage || ''} · ${i.source_id || ''} · ${i.qty} bottles · IB £${parseFloat(i.ib_price).toFixed(2)}/btl`).join('\n')
    const body = `Dear ${source},\n\nPlease arrange delivery of the following wines from our bonded account:\n\n${lines}\n\nKind regards,\nJessica Bride\nBelle Année Wines\n25 Hillgate Street, London W8 7SP\n+44 (0) 7767 367256`
    window.location.href = `mailto:?subject=${encodeURIComponent(`Release Order — Belle Année — ${today}`)}&body=${encodeURIComponent(body)}`
  }

  // ─── CSV / import / export (unchanged from original) ─────────────────────
  function parseCsv(text) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = []
    let current = '', inQuotes = false
    for (const ch of lines[0]) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { headers.push(current.trim()); current = '' }
      else { current += ch }
    }
    headers.push(current.trim())
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const parts = []
      current = ''; inQuotes = false
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { parts.push(current); current = '' }
        else { current += ch }
      }
      parts.push(current)
      const row = {}
      headers.forEach((h, idx) => { row[h] = (parts[idx] || '').trim() })
      rows.push(row)
    }
    return rows
  }

  function transformBBRRow(row) {
    const description = (row['Description'] || '').replace(/^[\s,]+/, '').trim()
    const vintage = (row['Vintage'] || '').trim()
    const caseSize = parseInt(row['Case Size'], 10) || 1
    const purchaseCasePrice = parseFloat(row['Purchase Price per Case']) || null
    const purchase_price_per_bottle = purchaseCasePrice ? Math.round((purchaseCasePrice / caseSize) * 100) / 100 : null
    const wsCasePrice = parseFloat(row['Wine Searcher Lowest List Price']) || null
    const ws_lowest_per_bottle = wsCasePrice ? Math.round((wsCasePrice / caseSize) * 100) / 100 : null
    const retail_price = ws_lowest_per_bottle ? Math.round((ws_lowest_per_bottle + 3) * 1.20 * 100) / 100 : null
    const livexCasePrice = parseFloat(row['Livex Market Price']) || null
    const livex_market_price = livexCasePrice ? Math.round((livexCasePrice / caseSize) * 100) / 100 : null
    return {
      source: 'Berry Brothers', source_id: row['Parent ID'] || '',
      country: row['Country'] || '', region: (row['Region'] || '').trim(),
      vintage, description, colour: row['Colour'] || '',
      bottle_format: row['Bottle Format'] || '', bottle_volume: row['Bottle Volume'] || '',
      quantity: row['Quantity in Bottles'] || '', case_size: row['Case Size'] || '',
      purchase_price_per_bottle, bbx_highest_bid: row['BBX Highest Bid'] || '',
      ws_lowest_per_bottle, retail_price,
      retail_price_source: retail_price ? 'Wine Searcher lowest +duty+VAT' : null,
      retail_price_date: retail_price ? new Date().toISOString().split('T')[0] : null,
      livex_market_price, include_in_buyer_view: false,
    }
  }

  function transformFlintRow(row) {
    const description = (row['Wine'] || row['Description'] || row['Name'] || '').replace(/^[\s,]+/, '').trim()
    const vintage = (row['Vintage'] || row['Year'] || '').trim()
    const region = (row['Region'] || row['Appellation'] || '').trim()
    const country = (row['Country'] || '').trim()
    const colour = (row['Colour'] || row['Color'] || row['Type'] || '').trim()
    const quantity = row['Quantity'] || row['Qty'] || row['Stock'] || ''
    const source_id = row['Reference'] || row['Parent ID'] || row['Ref'] || row['ID'] || ''
    const bottle_format = row['Format'] || row['Bottle Format'] || row['Size'] || ''
    const bottle_volume = row['Volume'] || row['Bottle Volume'] || ''
    const rawPrice = parseFloat(row['Unit Price'] || row['Price'] || row['IB Price'] || '') || null
    const purchase_price_per_bottle = rawPrice ? Math.round(rawPrice * 100) / 100 : null
    return { source: 'Flint', source_id, country, region, vintage, description, colour, bottle_format, bottle_volume, quantity: String(quantity), purchase_price_per_bottle, include_in_buyer_view: false }
  }

  async function upsertWines(wineRows, sourceLabel) {
    let inserted = 0, updated = 0, errors = 0
    const conflicts = []
    for (const wine of wineRows) {
      try {
        const { data: existing } = await supabase.from('wines').select('id, purchase_price_per_bottle, manual_override_note').eq('source_id', wine.source_id).eq('source', wine.source).maybeSingle()
        if (existing) {
          const hasOverride = !!existing.manual_override_note
          const incomingPrice = wine.purchase_price_per_bottle
          const storedPrice = parseFloat(existing.purchase_price_per_bottle)
          const priceConflict = hasOverride && incomingPrice && Math.abs(incomingPrice - storedPrice) > 0.01
          if (priceConflict) conflicts.push({ description: wine.description, vintage: wine.vintage, storedPrice, incomingPrice, note: existing.manual_override_note })
          const updateData = { quantity: wine.quantity }
          if (wine.ws_lowest_per_bottle !== undefined) {
            updateData.bbx_highest_bid = wine.bbx_highest_bid
            updateData.ws_lowest_per_bottle = wine.ws_lowest_per_bottle
            updateData.retail_price = wine.retail_price
            updateData.retail_price_source = wine.retail_price_source
            updateData.retail_price_date = wine.retail_price_date
            updateData.livex_market_price = wine.livex_market_price
          }
          if (!hasOverride) updateData.purchase_price_per_bottle = wine.purchase_price_per_bottle
          const { error } = await supabase.from('wines').update(updateData).eq('id', existing.id)
          if (error) throw error
          updated++
        } else {
          const { error } = await supabase.from('wines').insert(wine)
          if (error) throw error
          inserted++
        }
      } catch (err) { console.error('Import error:', wine.description, err); errors++ }
    }
    return { inserted, updated, errors, conflicts }
  }

  async function handleBBRImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportStatus('Reading BBR file…')
    const text = await file.text()
    const rows = parseCsv(text)
    const wineRows = rows.map(transformBBRRow).filter(r => r.description && r.source_id)
    setImportStatus(`Parsed ${wineRows.length} BBR wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows, 'BBR')
    setImportConflicts(conflicts)
    setImportStatus(`✓ BBR done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}${conflicts.length ? ` · ⚠️ ${conflicts.length} price conflict${conflicts.length > 1 ? 's' : ''}` : ''}`)
    setImporting(false); e.target.value = ''; await fetchWines()
  }

  async function handleFlintImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportStatus('Reading Flint file…')
    const text = await file.text()
    const rows = parseCsv(text)
    const wineRows = rows.map(transformFlintRow).filter(r => r.description)
    setImportStatus(`Parsed ${wineRows.length} Flint wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows, 'Flint')
    setImportConflicts(conflicts)
    const has2024 = wineRows.some(w => w.vintage === '2024')
    const suffix = has2024 ? ' · ⚠️ 2024 vintage detected — verify Unit Prices against invoice (case price bug)' : ''
    setImportStatus(`✓ Flint done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}${conflicts.length ? ` · ⚠️ ${conflicts.length} price conflicts` : ''}${suffix}`)
    setImporting(false); e.target.value = ''; await fetchWines()
  }

  async function handleOtherImport(e) {
    const file = e.target.files[0]; if (!file) return
    if (!otherSourceName.trim()) { alert('Please enter a source name first'); return }
    setImporting(true); setImportStatus(`Reading ${otherSourceName} file…`)
    const text = await file.text()
    const rows = parseCsv(text)
    const wineRows = rows.map(row => {
      const description = (row['Wine'] || row['Description'] || row['Name'] || '').replace(/^[\s,]+/, '').trim()
      const vintage = (row['Vintage'] || row['Year'] || '').trim()
      const rawPrice = parseFloat(row['Unit Price'] || row['Price'] || row['IB Price'] || row['Purchase Price per Case'] || '') || null
      const caseSize = parseInt(row['Case Size'] || '') || 1
      const purchase_price_per_bottle = rawPrice ? Math.round((rawPrice / (row['Case Size'] ? caseSize : 1)) * 100) / 100 : null
      return {
        source: otherSourceName.trim(),
        source_id: row['Parent ID'] || row['Reference'] || row['Ref'] || row['ID'] || `${otherSourceName}-${description}-${vintage}`,
        country: row['Country'] || '', region: row['Region'] || '', vintage, description,
        colour: row['Colour'] || row['Color'] || '', bottle_format: row['Format'] || row['Bottle Format'] || '',
        bottle_volume: row['Volume'] || row['Bottle Volume'] || '',
        quantity: String(row['Quantity'] || row['Qty'] || row['Quantity in Bottles'] || ''),
        purchase_price_per_bottle, include_in_buyer_view: false,
      }
    }).filter(r => r.description)
    setImportStatus(`Parsed ${wineRows.length} ${otherSourceName} wines — importing…`)
    const { inserted, updated, errors, conflicts } = await upsertWines(wineRows, otherSourceName)
    setImportConflicts(conflicts)
    setImportStatus(`✓ ${otherSourceName} done — ${inserted} inserted, ${updated} updated${errors ? `, ${errors} errors` : ''}`)
    setImporting(false); e.target.value = ''; setShowOtherSourceInput(false); await fetchWines()
  }

  function exportCSV() {
    const headers = ['Source','ID','Description','Vintage','Colour','Country','Region','Format','Volume','Quantity','Cost IB/Btl','DP/Btl','+10% IB','+15% IB','+10% DP','+15% DP','WS Lowest/Btl','Retail Price IB','Retail Price Source','Retail Price Date','Livex/Btl','Sale Price','In Buyer View','Women Note','Producer Note']
    const rows = wines.map(w => {
      const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
      const dp = ib ? dpForWine(w) : null
      return [
        w.source, w.source_id, w.description, w.vintage, w.colour, w.country, w.region,
        w.bottle_format, w.bottle_volume, w.quantity,
        ib || '', dp ? dp.toFixed(2) : '',
        ib ? (ib * 1.10).toFixed(2) : '', ib ? (ib * 1.15).toFixed(2) : '',
        dp ? (dp * 1.10).toFixed(2) : '', dp ? (dp * 1.15).toFixed(2) : '',
        w.ws_lowest_per_bottle || '', w.retail_price || '',
        w.retail_price_source || '', w.retail_price_date || '',
        w.livex_market_price || '', w.sale_price || '',
        w.include_in_buyer_view ? 'Yes' : 'No', w.women_note || '', w.producer_note || ''
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `bonded-storage-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ─── Price breakdown panel ─────────────────────────────────────────────────
  function PriceBreakdown({ w }) {
    const ib = w.purchase_price_per_bottle ? parseFloat(w.purchase_price_per_bottle) : null
    const duty = dutyForWine(w)
    const mag = isMagnum(w)
    const dp = ib ? (ib + duty) * 1.2 : null
    const retail = w.retail_price ? parseFloat(w.retail_price) : null
    const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
    const livex = w.livex_market_price ? parseFloat(w.livex_market_price) : null
    const sale = w.sale_price ? parseFloat(w.sale_price) : null
    const wsDP75 = ws ? (ws + 3) * 1.2 : null
    const wsDP150 = ws ? (ws + 6) * 1.2 : null

    const row = (label, val, color, dim) => val != null ? (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '10px', color: dim ? 'rgba(253,250,245,0.3)' : 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: color ? 600 : 400, color: color || (dim ? 'rgba(253,250,245,0.4)' : 'rgba(253,250,245,0.9)') }}>£{val.toFixed(2)}</span>
      </div>
    ) : null
    const divider = (label) => (
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '6px 0', display: 'flex', alignItems: 'center' }}>
        {label && <span style={{ fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.25)', fontFamily: 'DM Mono, monospace', paddingRight: '6px', background: '#1a1208' }}>{label}</span>}
      </div>
    )
    return (
      <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 300, background: '#1a1208', border: '1px solid rgba(212,173,69,0.4)', padding: '14px 16px', minWidth: '260px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4ad45', marginBottom: '10px', fontFamily: 'DM Mono, monospace' }}>
          IB Price Ladder — {mag ? 'Magnum · £6 duty' : '75cl · £3 duty'}
        </div>
        {row('Cost IB /btl', ib)}
        {row('+10% on IB', ib ? ib * 1.10 : null)}
        {row('+15% on IB', ib ? ib * 1.15 : null)}
        {divider('Duty Paid')}
        {row(`DP  (IB £${ib ? ib.toFixed(2) : '?'} + £${duty} duty × 1.20)`, dp, '#d4ad45')}
        {row('+10% on DP', dp ? dp * 1.10 : null)}
        {row('+15% on DP', dp ? dp * 1.15 : null)}
        {ws && divider('Wine Searcher')}
        {ws && row('WS lowest (ex duty/VAT)', ws)}
        {ws && row('WS + duty + VAT  75cl', wsDP75, wsDP75 && dp && dp < wsDP75 ? '#86efac' : null)}
        {ws && row('WS + duty + VAT  150cl', wsDP150, null, !mag)}
        {(livex || retail || sale) && divider()}
        {livex && row('Livex (ex duty)', livex)}
        {retail && row(
          w.retail_price_source === 'WS avg (ex duty)' || w.retail_price_source === 'Wine Searcher avg' || w.retail_price_source === 'Wine Searcher lowest +duty+VAT' ? 'WS avg (duty paid)' : w.retail_price_source === 'Duty paid retail' ? 'Retail (duty paid, manual)' : 'Retail est. (duty paid)',
          retail
        )}
        {sale && row('Your sale price', sale, '#d4ad45')}
        {!ib && <div style={{ fontSize: '10px', color: 'rgba(253,250,245,0.4)', fontFamily: 'DM Mono, monospace' }}>No cost data available</div>}
        {ws && dp && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontFamily: 'DM Mono, monospace' }}>
            {dp < (ws + duty) * 1.2
              ? <span style={{ color: '#86efac' }}>✓ Competitive — your DP is below WS market rate</span>
              : <span style={{ color: '#f87171' }}>✗ Not competitive vs WS at this duty-paid price</span>}
          </div>
        )}
      </div>
    )
  }

  const basketCount = Object.keys(releaseBasket).length
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const bbCount = wines.filter(w => w.source === 'Berry Brothers').length
  const flintCount = wines.filter(w => w.source === 'Flint').length
  const inBuyerCount = wines.filter(w => w.include_in_buyer_view).length
  const competitiveCount = wines.filter(w => isCompetitive(w)).length
  const missingRetailCount = wines.filter(w => !w.retail_price).length
  const womenCount = wines.filter(w => w.women_note).length
  const totalCostValue = wines.reduce((sum, w) => sum + ((parseInt(w.quantity) || 0) * (parseFloat(w.purchase_price_per_bottle) || 0)), 0)
  const totalRetailValue = wines.reduce((sum, w) => sum + ((parseInt(w.quantity) || 0) * (parseFloat(w.retail_price) || 0)), 0)
  const winesWithRetail = wines.filter(w => w.retail_price).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--wine)' }}>Loading cellar…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', overflowX: 'hidden', paddingBottom: basketCount > 0 ? '80px' : '0' }}
      onClick={() => { setExpandedPrice(null) }}>

      {/* Nav */}
      <div style={{ background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '52px', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100, boxSizing: 'border-box' }}>
        <button onClick={() => router.push('/studio')} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '0.1em', color: '#d4ad45', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>Cellar</button>
        <div style={{ overflowX: 'auto', display: 'flex', gap: '2px', msOverflowStyle: 'none', scrollbarWidth: 'none', padding: '0 8px' }}>
          {[['Studio', '/studio'], ['Bonded Storage', '/admin'], ['Box Builder', '/boxes'], ['Buyer View', '/buyer'], ['Bottles On Hand', '/local'], ['Consignment', '/consignment']].map(([label, path]) => (
            <button key={path} onClick={() => router.push(path)} style={{ background: path === '/admin' ? 'rgba(107,30,46,0.6)' : 'none', color: path === '/admin' ? '#d4ad45' : 'rgba(253,250,245,0.5)', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px', borderRadius: '2px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { sessionStorage.clear(); router.push('/') }} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 10px', flexShrink: 0 }}>Sign Out</button>
      </div>

      <div style={{ padding: '76px 28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300 }}>Bonded Storage</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{filtered.length} wines</div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '20px', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', marginBottom: '12px', fontSize: '11px', flexWrap: 'wrap' }}>
          {[['wines total', wines.length], ['Berry Brothers', bbCount], ['Flint', flintCount], ['in buyer view', inBuyerCount], ['competitive', competitiveCount], ['need retail price', missingRetailCount], ['women-led', womenCount]].map(([label, n]) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 500, color: label === 'women-led' ? '#9b3a4a' : 'var(--wine)', fontSize: '14px' }}>{label === 'women-led' ? '♀ ' : ''}{n}</span>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Collection value */}
        <div style={{ marginBottom: '16px' }}>
          <button onClick={() => setShowValues(v => !v)} style={{ background: 'none', border: '1px solid var(--border)', padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--muted)' }}>
            {showValues ? '▲ Hide collection value' : '▼ Show collection value'}
          </button>
          {showValues && (
            <div style={{ display: 'flex', gap: '28px', padding: '12px 16px', background: 'var(--ink)', border: '1px solid var(--border)', marginTop: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Collection cost IB</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#d4ad45' }}>£{totalCostValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Retail value IB</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#86efac' }}>£{totalRetailValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                {winesWithRetail < wines.length && <span style={{ fontSize: '10px', color: 'rgba(253,250,245,0.3)' }}>({winesWithRetail} of {wines.length} priced)</span>}
              </div>
              {totalRetailValue > 0 && totalCostValue > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.5)' }}>Uplift</span>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#d4748a' }}>{((totalRetailValue / totalCostValue - 1) * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Release Order History ─────────────────────────────────────────── */}
        <div style={{ marginBottom: '16px' }}>
          <button onClick={() => setShowReleaseHistory(v => !v)} style={{ background: releaseOrders.length > 0 ? 'rgba(107,30,46,0.06)' : 'none', border: '1px solid rgba(107,30,46,0.2)', padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--wine)' }}>
            {showReleaseHistory ? '▲' : '▼'} Release Orders {releaseOrders.length > 0 ? `· ${releaseOrders.length}` : ''}
          </button>
          {showReleaseHistory && (
            <div style={{ marginTop: '8px', background: 'var(--white)', border: '1px solid var(--border)' }}>
              {releaseOrders.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>No release orders yet.</div>
              ) : releaseOrders.map(order => {
                const items = order.items || []
                const total = items.reduce((s, i) => s + parseFloat(i.duty_vat_total || (parseFloat(i.dp_per_bottle||0) - parseFloat(i.ib_price||0)) * parseInt(i.qty||1) || 0), 0)
                const sources = [...new Set(items.map(i => i.source))].join(', ')
                const isExpanded = expandedReleaseOrder === order.id
                return (
                  <div key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', gap: '10px', flexWrap: 'wrap', background: isExpanded ? 'rgba(107,30,46,0.03)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{order.order_date}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{items.length} wine{items.length !== 1 ? 's' : ''}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{sources}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 600, color: 'var(--wine)' }}>£{total.toFixed(2)} DP</span>
                        {order.notes && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic' }}>{order.notes}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => printReleaseOrder(order)} style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.08em' }}>🖨 Print</button>
                        {[...new Set(items.map(i => i.source))].map(src => (
                          <button key={src} onClick={() => emailReleaseOrder(order, src)} style={{ background: 'none', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: 'var(--muted)', whiteSpace: 'nowrap' }}>✉ {src === 'Berry Brothers' ? 'BBR' : src}</button>
                        ))}
                        <button onClick={() => setExpandedReleaseOrder(isExpanded ? null : order.id)} style={{ background: 'none', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: 'var(--muted)' }}>{isExpanded ? '▲' : '▼'}</button>
                        <button onClick={() => deleteReleaseOrder(order.id)} style={{ background: 'none', border: '1px solid rgba(192,57,43,0.3)', padding: '5px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer', color: '#c0392b' }}>✕</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #ede6d6', padding: '0 14px 12px' }}>
                        {[...new Set(items.map(i => i.source))].map(src => (
                          <div key={src} style={{ marginTop: '12px' }}>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)', marginBottom: '6px' }}>{src}</div>
                            {items.filter(i => i.source === src).map((item, idx) => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 60px 70px 80px 80px', gap: '8px', padding: '6px 0', borderBottom: '1px solid #ede6d6', fontSize: '11px', alignItems: 'baseline' }}>
                                <div>
                                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '13px', fontWeight: 500 }}>{item.description}</span>
                                  {item.vintage && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginLeft: '6px' }}>{item.vintage}</span>}
                                  {item.source_id && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', marginLeft: '6px' }}>{item.source_id}</span>}
                                </div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{item.qty} btls</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>IB £{parseFloat(item.ib_price).toFixed(2)}</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>DP £{parseFloat(item.dp_per_bottle || ((parseFloat(item.ib_price)+parseFloat(item.duty_per_bottle))*1.2)).toFixed(2)}</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>IB £{parseFloat(item.ib_total).toFixed(2)}</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600 }}>£{parseFloat(item.dp_total).toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by description, region, vintage…" style={{ flex: 1, minWidth: '200px', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }} />
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Sources</option>
            <option value="Berry Brothers">Berry Brothers</option>
            <option value="Flint">Flint</option>
          </select>
          <select value={filterColour} onChange={e => setFilterColour(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Colours</option>
            <option value="Red">Red</option>
            <option value="White">White</option>
            <option value="Rosé">Rosé</option>
          </select>
          <select value={filterBuyer} onChange={e => setFilterBuyer(e.target.value)} style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none' }}>
            <option value="">All Wines</option>
            <option value="included">In Buyer View</option>
            <option value="missing-retail">Missing Retail Price</option>
            <option value="competitive">Competitive Only</option>
            <option value="women">Women-Led</option>
          </select>
          <button onClick={exportCSV} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>↓ Export</button>
          <button onClick={() => setShowMergeModal(true)} style={{ background: 'none', border: '1px solid #2d6a4f', color: '#2d6a4f', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>🔀 Merge</button>
        </div>

        {/* Import buttons row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <input type="file" accept=".csv" onChange={handleBBRImport} disabled={importing} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
            <span style={{ display: 'inline-block', background: importing ? 'rgba(107,30,46,0.4)' : 'rgba(107,30,46,0.08)', border: '1px solid rgba(107,30,46,0.3)', color: 'var(--wine)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: importing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>↑ Import BBR</span>
          </label>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <input type="file" accept=".csv" onChange={handleFlintImport} disabled={importing} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
            <span style={{ display: 'inline-block', background: importing ? 'rgba(184,148,42,0.4)' : 'rgba(184,148,42,0.08)', border: '1px solid rgba(184,148,42,0.3)', color: '#7a5e10', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: importing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>↑ Import Flint</span>
          </label>
          {!showOtherSourceInput ? (
            <button onClick={() => setShowOtherSourceInput(true)} disabled={importing} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>↑ Import Other…</button>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={otherSourceName} onChange={e => setOtherSourceName(e.target.value)} placeholder="Source name e.g. Corney & Barrow" autoFocus style={{ border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', minWidth: '220px' }} />
              <label style={{ position: 'relative', cursor: 'pointer' }}>
                <input ref={otherFileRef} type="file" accept=".csv" onChange={handleOtherImport} disabled={importing || !otherSourceName.trim()} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
                <span style={{ display: 'inline-block', background: otherSourceName.trim() ? 'rgba(45,106,79,0.08)' : '#eee', border: '1px solid rgba(45,106,79,0.3)', color: otherSourceName.trim() ? '#2d6a4f' : '#999', padding: '9px 16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: otherSourceName.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>↑ Choose CSV</span>
              </label>
              <button onClick={() => { setShowOtherSourceInput(false); setOtherSourceName('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px', padding: '6px' }}>✕</button>
            </div>
          )}
          {importing && <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', padding: '9px 0' }}>⏳ Importing…</span>}
          {importStatus && !importing && <span style={{ fontSize: '11px', color: importStatus.startsWith('✓') ? '#2d6a4f' : 'var(--muted)', fontFamily: 'DM Mono, monospace', padding: '9px 0' }}>{importStatus}</span>}
        </div>

        {/* Import conflicts */}
        {importConflicts.length > 0 && (
          <div style={{ background: 'rgba(184,148,42,0.08)', border: '1px solid rgba(184,148,42,0.4)', padding: '14px 16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7a5e10', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>⚠️ Price conflicts — your manual overrides were preserved</div>
            {importConflicts.map((c, i) => (
              <div key={i} style={{ fontSize: '12px', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(184,148,42,0.2)' : 'none' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', marginBottom: '3px' }}>{c.description} {c.vintage}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>Your price: <strong>£{parseFloat(c.storedPrice).toFixed(2)}</strong> · Incoming: <strong>£{parseFloat(c.incomingPrice).toFixed(2)}</strong></div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#7a5e10', marginTop: '2px' }}>Note: {c.note}</div>
              </div>
            ))}
            <button onClick={() => setImportConflicts([])} style={{ marginTop: '10px', background: 'none', border: 'none', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--ink)', color: 'var(--white)' }}>
                {/* Release order checkbox column */}
                <th style={{ padding: '10px 8px', width: '36px', textAlign: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(253,250,245,0.4)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>REL</span>
                </th>
                <th onClick={() => handleSort('description')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'description' ? '#d4ad45' : 'var(--white)', position: 'sticky', left: 0, background: 'var(--ink)', zIndex: 10, minWidth: '200px' }}>
                  Wine {sortCol === 'description' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                </th>
                {[['vintage','Vin.'],['colour','Colour'],['region','Region'],['bottle_format','Format'],['quantity','Qty']].map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === col ? '#d4ad45' : 'var(--white)' }}>
                    {label} {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  </th>
                ))}
                <th onClick={() => handleSort('purchase_price_per_bottle')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'purchase_price_per_bottle' ? '#d4ad45' : 'var(--white)' }}>
                  DP {sortCol === 'purchase_price_per_bottle' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  <span style={{ display: 'block', fontSize: '8px', color: 'rgba(253,250,245,0.35)', fontWeight: 300, letterSpacing: '0.03em', textTransform: 'none', marginTop: '1px' }}>▼ click for IB ladder</span>
                </th>
                <th onClick={() => handleSort('ws_lowest_per_bottle')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'ws_lowest_per_bottle' ? '#d4ad45' : 'var(--white)', minWidth: '160px' }}>
                  DP Retail {sortCol === 'ws_lowest_per_bottle' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                  <span style={{ display: 'block', fontSize: '8px', color: 'rgba(253,250,245,0.35)', fontWeight: 300, letterSpacing: '0.03em', textTransform: 'none', marginTop: '1px' }}>WS ex-tax below</span>
                </th>
                <th onClick={() => handleSort('sale_price')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'sale_price' ? '#d4ad45' : 'var(--white)' }}>
                  Sell {sortCol === 'sale_price' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Notes</th>
<th onClick={() => handleSort('include_in_buyer_view')} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'include_in_buyer_view' ? '#d4ad45' : 'var(--white)' }}>Buyer {sortCol === 'include_in_buyer_view' ? (sortDir === 1 ? '↑' : '↓') : '↕'}</th>
                  <th style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Studio</th>
                <th onClick={() => handleSort('source')} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', color: sortCol === 'source' ? '#d4ad45' : 'var(--white)' }}>
                  Src {sortCol === 'source' ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map(w => {
                const pp = w.purchase_price_per_bottle
                const retail = w.retail_price ? parseFloat(w.retail_price) : null
                const comp = w.ws_lowest_per_bottle && pp ? isCompetitive(w) : null
                const dotColor = w.colour?.toLowerCase().includes('red') ? '#8b2535' : w.colour?.toLowerCase().includes('white') ? '#d4c88a' : w.colour?.toLowerCase().includes('ros') ? '#d4748a' : '#aaa'
                const isExpanded = expandedNote === w.id
                const isPriceOpen = expandedPrice === w.id
                const inBasket = !!releaseBasket[w.id]
                const caseSize = parseInt(w.case_size) || 12

                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid #ede6d6', background: inBasket ? 'rgba(107,30,46,0.05)' : w.include_in_buyer_view ? 'rgba(45,106,79,0.04)' : 'transparent' }}>

                    {/* Release order tick */}
                    <td style={{ padding: '9px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={inBasket} onChange={() => toggleReleaseBasket(w)}
                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--wine)' }} />
                    </td>

                    {/* Sticky wine name */}
                    <td style={{ padding: '9px 12px', maxWidth: '260px', position: 'sticky', left: 0, background: inBasket ? 'rgba(107,30,46,0.07)' : w.include_in_buyer_view ? '#f0f7f4' : 'var(--white)', zIndex: 5, borderRight: '1px solid #ede6d6' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        {w.women_note && <span title={w.women_note} style={{ fontSize: '12px', flexShrink: 0, cursor: 'help' }}>♀</span>}
                        <div>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', lineHeight: 1.3, fontWeight: isMagnum(w) ? 700 : 400 }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{w.region}{w.country ? ` · ${w.country}` : ''}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{w.vintage}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, marginRight: '5px', verticalAlign: 'middle' }}></span>
                      {w.colour}
                    </td>
                    <td style={{ padding: '9px 12px' }}>{w.region}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{w.bottle_volume || (w.bottle_format === 'Magnum' ? '150cl' : w.bottle_format ? '75cl' : '—')}</td>
                    <td style={{ padding: '9px 12px' }}>{w.quantity || '—'}</td>

                    {/* DP — click for ladder */}
                    <td style={{ padding: '9px 12px', position: 'relative' }} onClick={e => { e.stopPropagation(); setExpandedPrice(isPriceOpen ? null : w.id) }}>
                      <div style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 700, color: isPriceOpen ? 'var(--wine)' : 'var(--ink)', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                            {pp ? `£${dpForWine(w).toFixed(2)}` : '—'}
                          </span>
                          <span style={{ fontSize: '9px', color: isPriceOpen ? 'var(--wine)' : '#bbb' }}>{isPriceOpen ? '▲' : '▼'}</span>
                          {w.manual_override_note && <span title={`Override: ${w.manual_override_note}`} style={{ fontSize: '9px', color: '#b8942a', cursor: 'help' }}>✎</span>}
                        </div>
                        {pp && <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>IB £{parseFloat(pp).toFixed(2)}</div>}
                      </div>
                      {isPriceOpen && (
                        <>
                          <PriceBreakdown w={w} />
                          <div style={{ marginTop: '8px' }}>
                            <button onClick={e => { e.stopPropagation(); setExpandedPrice(null); openOverride(w, 'purchase_price_per_bottle', pp) }}
                              style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', background: 'rgba(184,148,42,0.12)', border: '1px solid rgba(184,148,42,0.3)', color: '#7a5e10', padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              ✎ Override IB price
                            </button>
                          </div>
                        </>
                      )}
                    </td>

                    {/* DP Retail */}
                    {(() => {
                      const duty = dutyForWine(w)
                      const ws = w.ws_lowest_per_bottle ? parseFloat(w.ws_lowest_per_bottle) : null
                      const wsDP = ws ? (ws + duty) * 1.2 : null
                      const isExDuty = w.retail_price_source === 'WS avg (ex duty)' || w.retail_price_source === 'Wine Searcher avg' || w.retail_price_source === 'Wine Searcher lowest +duty+VAT' || (!w.retail_price && w.ws_lowest_per_bottle)
                      const displayVal = isExDuty ? (w.ws_lowest_per_bottle || '') : (w.retail_price || '')
                      const myDP = pp ? dpForWine(w) : null
                      const isComp = wsDP && myDP ? myDP < wsDP : null

                      function handlePriceBlur(e) {
                        const raw = e.target.value
                        const val = raw ? parseFloat(raw) : null
                        const type = e.target.closest('td').querySelector('select')?.value || 'ex-duty'
                        if (type === 'ex-duty') {
                          updateWine(w.id, 'ws_lowest_per_bottle', val)
                          if (val) updateWine(w.id, 'retail_price', Math.round((val + duty) * 1.2 * 100) / 100)
                          updateWine(w.id, 'retail_price_source', 'WS avg (ex duty)')
                        } else {
                          updateWine(w.id, 'retail_price', val)
                          updateWine(w.id, 'retail_price_source', 'Duty paid retail')
                        }
                      }

                      function handleTypeChange(e) {
                        updateWine(w.id, 'retail_price_source', e.target.value === 'ex-duty' ? 'WS avg (ex duty)' : 'Duty paid retail')
                      }

                      return (
                        <td style={{ padding: '9px 12px', minWidth: '160px' }}>
                          {wsDP ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: '13px', color: isComp ? '#2d6a4f' : 'var(--ink)' }}>£{wsDP.toFixed(2)}</span>
                                {isComp !== null && <span style={{ fontSize: '10px', fontWeight: 600, color: isComp ? '#2d6a4f' : '#c0392b' }}>{isComp ? '✓' : '✗'}</span>}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '1px' }}>WS £{ws.toFixed(2)} ex-tax</div>
                            </div>
                          ) : <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>—</div>}
                          <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginTop: '5px' }}>
                            <input type="number" step="0.01" key={`${w.id}-price`} defaultValue={displayVal} placeholder="WS price" onBlur={handlePriceBlur} onClick={e => e.stopPropagation()} style={{ width: '60px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '2px 4px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none' }} />
                            <select key={`${w.id}-type`} defaultValue={isExDuty ? 'ex-duty' : 'duty-paid'} onChange={handleTypeChange} onClick={e => e.stopPropagation()} style={{ border: '1px solid var(--border)', background: 'var(--cream)', padding: '1px 2px', fontFamily: 'DM Mono, monospace', fontSize: '9px', outline: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                              <option value="ex-duty">ex</option>
                              <option value="duty-paid">dp</option>
                            </select>
                            <button onClick={e => { e.stopPropagation(); openWineSearcher(w.description, w.vintage) }} style={{ background: 'none', border: '1px solid var(--border)', padding: '1px 4px', cursor: 'pointer', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>🔍</button>
                          </div>
                          {w.retail_price_date && <div style={{ fontSize: '10px', color: getDateColour(w.retail_price_date), fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>{w.retail_price_date}</div>}
                        </td>
                      )
                    })()}

                    {/* Sell Price */}
                    <td style={{ padding: '9px 12px' }}>
                      {w.sale_price && <div style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--wine)', marginBottom: '3px' }}>£{parseFloat(w.sale_price).toFixed(2)}</div>}
                      <input type="number" step="0.01" defaultValue={w.sale_price || ''} placeholder="0.00"
                        onBlur={e => { if (e.target.value !== String(w.sale_price || '')) updateWine(w.id, 'sale_price', e.target.value ? parseFloat(e.target.value) : null) }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '68px', border: '1px solid rgba(107,30,46,0.3)', background: 'rgba(107,30,46,0.03)', padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', color: 'var(--wine)' }} />
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '9px 12px', maxWidth: '200px' }}>
                      {(w.women_note || w.producer_note) && (
                        <div>
                          <button onClick={e => { e.stopPropagation(); setExpandedNote(isExpanded ? null : w.id) }}
                            style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', color: w.women_note ? '#9b3a4a' : 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                            {w.women_note ? '♀ note' : '📋 note'} {isExpanded ? '▲' : '▼'}
                          </button>
                          {isExpanded && (
                            <div style={{ marginTop: '6px', fontSize: '11px', lineHeight: 1.5, color: 'var(--ink)' }}>
                              {w.women_note && (
                                <div style={{ marginBottom: w.producer_note ? '8px' : 0 }}>
                                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '3px' }}>♀ Women's story</div>
                                  <textarea defaultValue={w.women_note} onBlur={e => { if (e.target.value !== w.women_note) updateWine(w.id, 'women_note', e.target.value) }}
                                    style={{ width: '100%', minHeight: '60px', border: '1px solid #9b3a4a', background: 'rgba(155,58,74,0.03)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                                </div>
                              )}
                              {w.producer_note && (
                                <div>
                                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>📋 Producer note</div>
                                  <textarea defaultValue={w.producer_note} onBlur={e => { if (e.target.value !== w.producer_note) updateWine(w.id, 'producer_note', e.target.value) }}
                                    style={{ width: '100%', minHeight: '60px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                                </div>
                              )}
                              {!w.women_note && (
                                <div>
                                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '3px' }}>♀ Add women's story</div>
                                  <textarea placeholder="Add women's story…" onBlur={e => { if (e.target.value) updateWine(w.id, 'women_note', e.target.value) }}
                                    style={{ width: '100%', minHeight: '40px', border: '1px solid #9b3a4a', background: 'rgba(155,58,74,0.03)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                                </div>
                              )}
                            </div>
                          )}
                          {!w.producer_note && isExpanded && (
                            <div style={{ marginTop: '6px' }}>
                              <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>📋 Add producer note</div>
                              <textarea placeholder="Add producer note…" onBlur={e => { if (e.target.value) updateWine(w.id, 'producer_note', e.target.value) }}
                                style={{ width: '100%', minHeight: '40px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                            </div>
                          )}
                        </div>
                      )}
                      {!w.women_note && !w.producer_note && (
                        <button onClick={e => { e.stopPropagation(); setExpandedNote(isExpanded ? null : w.id) }}
                          style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                          + note
                        </button>
                      )}
                      {isExpanded && !w.women_note && !w.producer_note && (
                        <div style={{ marginTop: '6px' }}>
                          <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9b3a4a', marginBottom: '3px' }}>♀ Women's story</div>
                          <textarea placeholder="Add women's story…" onBlur={e => { if (e.target.value) updateWine(w.id, 'women_note', e.target.value) }}
                            style={{ width: '100%', minHeight: '40px', border: '1px solid #9b3a4a', background: 'rgba(155,58,74,0.03)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical', marginBottom: '6px' }} />
                          <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>📋 Producer note</div>
                          <textarea placeholder="Add producer note…" onBlur={e => { if (e.target.value) updateWine(w.id, 'producer_note', e.target.value) }}
                            style={{ width: '100%', minHeight: '40px', border: '1px solid var(--border)', background: 'var(--cream)', padding: '4px 6px', fontFamily: 'DM Mono, monospace', fontSize: '11px', outline: 'none', resize: 'vertical' }} />
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!w.include_in_buyer_view} onChange={e => updateWine(w.id, 'include_in_buyer_view', e.target.checked)} onClick={e => e.stopPropagation()} style={{ width: '16px', height: '16px', accentColor: 'var(--wine)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={e => { e.stopPropagation(); moveToStudio(w) }} style={{ background: 'none', border: '1px solid var(--border)', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>→ Studio</button>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '2px', background: w.source === 'Berry Brothers' ? 'rgba(107,30,46,0.1)' : w.source === 'Flint' ? 'rgba(184,148,42,0.12)' : 'rgba(45,106,79,0.1)', color: w.source === 'Berry Brothers' ? 'var(--wine)' : w.source === 'Flint' ? '#7a5e10' : '#2d6a4f', whiteSpace: 'nowrap' }}>
                        {w.source === 'Berry Brothers' ? 'BB' : w.source}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', fontSize: '11px', color: 'var(--muted)' }}>
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0} style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', opacity: page === 0 ? 0.3 : 1 }}>‹</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} style={{ background: page === i ? 'var(--wine)' : 'var(--white)', color: page === i ? 'var(--white)' : 'var(--ink)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>{i + 1}</button>
              ))}
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Release Order sticky basket ──────────────────────────────────────── */}
      {basketCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', padding: '12px 24px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 200, borderTop: '2px solid rgba(212,173,69,0.4)', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--white)' }}>
            {basketCount} wine{basketCount !== 1 ? 's' : ''} selected for release
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#d4ad45', marginLeft: '12px' }}>
              Duty+VAT est: £{releaseBasketItems().reduce((s, i) => s + i.dutyVatTotal, 0).toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setReleaseBasket({})} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.5)', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.08em' }}>✕ Clear</button>
            <button onClick={() => setShowReleaseModal(true)} style={{ background: '#d4ad45', color: 'var(--ink)', border: 'none', padding: '8px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>Build Release Order →</button>
          </div>
        </div>
      )}

      {/* ─── Release Order Modal ───────────────────────────────────────────────── */}
      {showReleaseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '700px', border: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ background: 'var(--ink)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(253,250,245,0.5)', textTransform: 'uppercase' }}>Release Order</span>
              <button onClick={() => setShowReleaseModal(false)} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.6)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(212,173,69,0.08)', border: '1px solid rgba(212,173,69,0.3)', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7a5e10', lineHeight: 1.6 }}>
                Adjust quantities (snapped to full cases). DP = (IB + duty) × 1.2. Saving creates a dated record — does NOT change stock quantities.
              </div>

              {/* Lines grouped by source */}
              {(() => {
                const items = releaseBasketItems()
                const bySource = items.reduce((acc, item) => {
                  const src = item.w.source || 'Other'
                  if (!acc[src]) acc[src] = []
                  acc[src].push(item)
                  return acc
                }, {})

                return Object.entries(bySource).map(([src, srcItems]) => {
                  const srcDP = srcItems.reduce((s, i) => s + i.dpTotal, 0)
                  const srcIB = srcItems.reduce((s, i) => s + i.ibTotal, 0)
                  return (
                    <div key={src} style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 500, color: 'var(--wine)' }}>{src}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>IB £{srcIB.toFixed(2)} (paid) · <strong style={{ color: 'var(--wine)' }}>duty+VAT est. £{srcItems.reduce((s,i)=>s+i.dutyVatTotal,0).toFixed(2)}</strong></div>
                      </div>
                      <div style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
                        {srcItems.map(({ w, qty, ib, duty, dpPerBottle, dpTotal, dutyVatPerBottle, dutyVatTotal, caseSize }, idx) => {
                          const cases = qty / caseSize
                          return (
                            <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px', gap: '12px', padding: '12px 14px', borderBottom: idx < srcItems.length - 1 ? '1px solid #ede6d6' : 'none', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{w.description}</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {w.vintage} · {w.source_id || '—'} · IB £{ib.toFixed(2)}/btl · DP £{dpPerBottle.toFixed(2)}/btl
                                  <span style={{ marginLeft: '6px', color: 'rgba(0,0,0,0.3)' }}>case={caseSize}</span>
                                </div>
                              </div>
                              {/* Cases input — qty snaps to case multiples */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div>
                                  <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Cases</div>
                                  <input type="number" min="1" step="1" value={cases}
                                    onChange={e => setReleaseQty(w.id, caseSize, e.target.value)}
                                    onFocus={e => e.target.select()}
                                    style={{ width: '56px', border: '2px solid rgba(107,30,46,0.25)', background: 'rgba(107,30,46,0.03)', padding: '5px 8px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 700, outline: 'none', color: 'var(--wine)', textAlign: 'center' }} />
                                </div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginTop: '14px' }}>× {caseSize} = {qty} btls</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>£{dpTotal.toFixed(2)}</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>IB £{(ib * qty).toFixed(2)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}

              {/* Grand total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', paddingTop: '8px', borderTop: '2px solid var(--ink)' }}>
                <div style={{ minWidth: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                    <span>IB total (ex duty)</span><span>£{releaseBasketItems().reduce((s, i) => s + i.ibTotal, 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Grand total DP</span>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 500, color: 'var(--wine)' }}>£{releaseBasketItems().reduce((s, i) => s + i.dpTotal, 0).toFixed(2)}</span>
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>DP = (IB + £{isMagnum(wines.find(w => releaseBasket[w.id]) || {}) ? '6' : '3'} duty) × 1.2 per bottle</div>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '5px', fontFamily: 'DM Mono, monospace' }}>Notes (optional)</label>
                <input value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} placeholder="e.g. For Noam boxes · deliver to studio"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowReleaseModal(false)} style={{ background: 'none', border: '1px solid var(--border)', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveReleaseOrder} disabled={releaseSaving}
                  style={{ background: 'var(--wine)', color: 'var(--white)', border: 'none', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: releaseSaving ? 'wait' : 'pointer' }}>
                  {releaseSaving ? 'Saving…' : '✓ Save Release Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Price Override Modal ──────────────────────────────────────────────── */}
      {overrideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '440px', padding: '28px', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, marginBottom: '6px' }}>Override Purchase Price</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>{overrideModal.wine.description}, {overrideModal.wine.vintage}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>Current price</label>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '18px', color: 'var(--muted)', padding: '9px 0' }}>£{parseFloat(overrideModal.oldVal || 0).toFixed(2)}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>New price (£/btl IB)</label>
                <input type="number" step="0.01" defaultValue={overrideModal.newVal ? parseFloat(overrideModal.newVal).toFixed(2) : ''}
                  onChange={e => setOverrideModal(prev => ({ ...prev, newVal: e.target.value }))}
                  style={{ width: '100%', border: '2px solid var(--wine)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: 'var(--wine)' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono, monospace' }}>
                Reason for override <span style={{ color: 'var(--wine)' }}>*</span>
              </label>
              <input type="text" value={overrideNote} onChange={e => setOverrideNote(e.target.value)} placeholder="e.g. Supplier corrected invoice price"
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>This note will appear as a warning if the next import has a different price.</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setOverrideModal(null); setOverrideNote('') }} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveOverride} disabled={!overrideNote.trim() || !overrideModal.newVal}
                style={{ background: overrideNote.trim() && overrideModal.newVal ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '9px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: overrideNote.trim() ? 'pointer' : 'not-allowed' }}>
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <MergeDuplicatesModal wines={wines} onClose={() => setShowMergeModal(false)} onMerged={async () => { await fetchWines() }} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Merge Duplicates Modal (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════════════
function MergeDuplicatesModal({ wines, onClose, onMerged }) {
  const [survivorSearch, setSurvivorSearch] = useState('')
  const [loserSearch, setLoserSearch] = useState('')
  const [survivor, setSurvivor] = useState(null)
  const [loser, setLoser] = useState(null)
  const [fieldChoices, setFieldChoices] = useState({})
  const [similarityReason, setSimilarityReason] = useState('')
  const [referenceCounts, setReferenceCounts] = useState(null)
  const [merging, setMerging] = useState(false)
  const [mergeStatus, setMergeStatus] = useState('')

  const COMPARE_FIELDS = [
    'description', 'vintage', 'region', 'country', 'colour',
    'bottle_format', 'bottle_volume', 'quantity',
    'source', 'source_id', 'product_code',
    'purchase_price_per_bottle', 'ws_lowest_per_bottle', 'retail_price',
    'retail_price_source', 'retail_price_date',
    'livex_market_price', 'sale_price',
    'women_note', 'producer_note', 'buyer_note',
    'manual_override_note', 'manual_override_date', 'include_in_buyer_view',
  ]

  const survivorResults = survivorSearch.length >= 2
    ? wines.filter(w => w.id !== loser?.id && [w.description, w.vintage, w.region, w.source_id].join(' ').toLowerCase().includes(survivorSearch.toLowerCase())).slice(0, 8)
    : []

  const loserResults = loserSearch.length >= 2
    ? wines.filter(w => w.id !== survivor?.id && [w.description, w.vintage, w.region, w.source_id].join(' ').toLowerCase().includes(loserSearch.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => {
    if (!survivor || !loser) { setFieldChoices({}); setReferenceCounts(null); return }
    const initial = {}
    for (const f of COMPARE_FIELDS) {
      const sVal = survivor[f]; const lVal = loser[f]
      if (sVal !== null && sVal !== undefined && sVal !== '') initial[f] = 'survivor'
      else if (lVal !== null && lVal !== undefined && lVal !== '') initial[f] = 'loser'
      else initial[f] = 'survivor'
    }
    setFieldChoices(initial)
    checkReferences(loser.id, loser.source_id)
  }, [survivor?.id, loser?.id])

  async function checkReferences(loserId, loserSourceId) {
    try {
      const { count: studioCount } = await supabase.from('studio').select('*', { count: 'exact', head: true }).eq('wine_id', loserId)
      let boxItemCount = 0
      if (loserSourceId) {
        const { count } = await supabase.from('box_items').select('*', { count: 'exact', head: true }).eq('source_id', loserSourceId)
        boxItemCount = count || 0
      }
      setReferenceCounts({ studio: studioCount || 0, box_items: boxItemCount })
    } catch (err) { setReferenceCounts({ studio: 0, box_items: 0, error: err.message }) }
  }

  function selectSurvivor(w) { setSurvivor(w); setSurvivorSearch('') }
  function selectLoser(w) { setLoser(w); setLoserSearch('') }
  function setChoice(field, choice) { setFieldChoices(prev => ({ ...prev, [field]: choice })) }

  function getMergedValues() {
    if (!survivor || !loser) return {}
    const merged = {}
    for (const f of COMPARE_FIELDS) {
      merged[f] = (fieldChoices[f] || 'survivor') === 'loser' ? loser[f] : survivor[f]
    }
    return merged
  }

  async function performMerge() {
    if (!survivor || !loser) return
    if (survivor.id === loser.id) { alert('Cannot merge a wine with itself'); return }
    if (!similarityReason.trim()) { alert('Please add a similarity reason before merging'); return }
    setMerging(true); setMergeStatus('Starting merge…')
    try {
      setMergeStatus('Identifying studio entries…')
      const { data: studioRows } = await supabase.from('studio').select('id').eq('wine_id', loser.id)
      const migratedStudioIds = (studioRows || []).map(r => r.id)
      setMergeStatus('Identifying box items…')
      let migratedBoxItemIds = []
      if (loser.source_id) {
        const { data: boxRows } = await supabase.from('box_items').select('id').eq('source_id', loser.source_id)
        migratedBoxItemIds = (boxRows || []).map(r => r.id)
      }
      setMergeStatus('Writing audit record…')
      const { error: auditError } = await supabase.from('wine_merges').insert({
        survivor_id: survivor.id, survivor_snapshot: survivor,
        loser_id: loser.id, loser_snapshot: loser,
        migrated_studio_ids: migratedStudioIds, migrated_box_item_ids: migratedBoxItemIds,
        field_choices: fieldChoices, similarity_reason: similarityReason.trim(),
      })
      if (auditError) throw new Error('Audit write failed: ' + auditError.message)
      setMergeStatus('Updating survivor…')
      const mergedValues = getMergedValues()
      const updatePayload = {}
      for (const [k, v] of Object.entries(mergedValues)) { if (v !== survivor[k]) updatePayload[k] = v }
      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('wines').update(updatePayload).eq('id', survivor.id)
        if (error) throw new Error('Survivor update failed: ' + error.message)
      }
      if (migratedStudioIds.length > 0) {
        setMergeStatus(`Reassigning ${migratedStudioIds.length} studio entries…`)
        const { error } = await supabase.from('studio').update({ wine_id: survivor.id }).eq('wine_id', loser.id)
        if (error) throw new Error('Studio migration failed: ' + error.message)
      }
      if (migratedBoxItemIds.length > 0 && loser.source_id) {
        setMergeStatus(`Updating ${migratedBoxItemIds.length} box items…`)
        const { error } = await supabase.from('box_items').update({ source_id: survivor.source_id || null }).eq('source_id', loser.source_id)
        if (error) throw new Error('Box items migration failed: ' + error.message)
      }
      setMergeStatus('Deleting duplicate…')
      const { error: deleteError } = await supabase.from('wines').delete().eq('id', loser.id)
      if (deleteError) throw new Error('Delete failed: ' + deleteError.message)
      setMergeStatus('✓ Merge complete')
      await onMerged(); setTimeout(() => onClose(), 1200)
    } catch (err) { setMergeStatus('✗ ' + err.message) }
    setMerging(false)
  }

  function fmtVal(v) {
    if (v === null || v === undefined || v === '') return <span style={{ color: 'rgba(0,0,0,0.25)', fontStyle: 'italic' }}>empty</span>
    if (typeof v === 'boolean') return v ? 'yes' : 'no'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const differingFields = survivor && loser ? COMPARE_FIELDS.filter(f => String(survivor[f] ?? '') !== String(loser[f] ?? '')) : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,10,0.75)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--cream)', width: '100%', maxWidth: '900px', border: '1px solid var(--border)', marginTop: '12px' }}>
        <div style={{ background: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(253,250,245,0.5)', textTransform: 'uppercase' }}>Merge Duplicate Wines</span>
          <button onClick={onClose} disabled={merging} style={{ background: 'none', border: '1px solid rgba(253,250,245,0.2)', color: 'rgba(253,250,245,0.6)', padding: '5px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: merging ? 'not-allowed' : 'pointer' }}>✕ Close</button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Pick two wines — the <strong>survivor</strong> (kept) and the <strong>loser</strong> (deleted). For each field, choose which value wins. Studio entries and box items pointing at the loser will be migrated to the survivor. A full JSON snapshot is saved before anything is deleted.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={{ border: '1px solid rgba(45,106,79,0.3)', background: 'rgba(45,106,79,0.04)', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2d6a4f', marginBottom: '8px' }}>1. Wine to KEEP (survivor)</div>
              {!survivor ? (
                <>
                  <input value={survivorSearch} onChange={e => setSurvivorSearch(e.target.value)} placeholder="Search wine name, vintage, region…" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  {survivorResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '220px', overflowY: 'auto' }}>
                      {survivorResults.map(w => (
                        <div key={w.id} onClick={() => selectSurvivor(w)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }} onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{w.vintage} · {w.source} · {w.source_id || 'no ID'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{survivor.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '3px' }}>{survivor.vintage} · {survivor.source} · {survivor.source_id || 'no ID'}</div>
                  <button onClick={() => setSurvivor(null)} disabled={merging} style={{ marginTop: '6px', background: 'none', border: 'none', fontSize: '10px', color: '#2d6a4f', cursor: merging ? 'not-allowed' : 'pointer', fontFamily: 'DM Mono, monospace', padding: 0 }}>✕ change</button>
                </div>
              )}
            </div>
            <div style={{ border: '1px solid rgba(192,57,43,0.3)', background: 'rgba(192,57,43,0.04)', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>2. Wine to DELETE (loser)</div>
              {!loser ? (
                <>
                  <input value={loserSearch} onChange={e => setLoserSearch(e.target.value)} placeholder="Search wine name, vintage, region…" style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  {loserResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--white)', maxHeight: '220px', overflowY: 'auto' }}>
                      {loserResults.map(w => (
                        <div key={w.id} onClick={() => selectLoser(w)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #ede6d6' }} onMouseEnter={e => e.currentTarget.style.background = '#f5f0e8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '14px' }}>{w.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{w.vintage} · {w.source} · {w.source_id || 'no ID'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontWeight: 500 }}>{loser.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '3px' }}>{loser.vintage} · {loser.source} · {loser.source_id || 'no ID'}</div>
                  <button onClick={() => setLoser(null)} disabled={merging} style={{ marginTop: '6px', background: 'none', border: 'none', fontSize: '10px', color: '#c0392b', cursor: merging ? 'not-allowed' : 'pointer', fontFamily: 'DM Mono, monospace', padding: 0 }}>✕ change</button>
                </div>
              )}
            </div>
          </div>
          {survivor && loser && referenceCounts && (
            <div style={{ background: referenceCounts.studio + referenceCounts.box_items > 0 ? 'rgba(184,148,42,0.08)' : 'rgba(45,106,79,0.06)', border: `1px solid ${referenceCounts.studio + referenceCounts.box_items > 0 ? 'rgba(184,148,42,0.3)' : 'rgba(45,106,79,0.2)'}`, padding: '12px 14px', marginBottom: '16px', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
              <div style={{ letterSpacing: '0.1em', textTransform: 'uppercase', color: referenceCounts.studio + referenceCounts.box_items > 0 ? '#7a5e10' : '#2d6a4f', marginBottom: '6px' }}>{referenceCounts.studio + referenceCounts.box_items > 0 ? '⚠ Migration required' : '✓ No references to migrate'}</div>
              <div style={{ color: 'var(--ink)' }}>Loser has <strong>{referenceCounts.studio}</strong> studio entr{referenceCounts.studio === 1 ? 'y' : 'ies'} and <strong>{referenceCounts.box_items}</strong> box item{referenceCounts.box_items === 1 ? '' : 's'} that will be reassigned to the survivor.</div>
            </div>
          )}
          {survivor && loser && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>Field-by-field · {differingFields.length} field{differingFields.length === 1 ? '' : 's'} differ</div>
              <div style={{ border: '1px solid var(--border)', background: 'var(--white)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: 'var(--ink)', color: 'rgba(253,250,245,0.7)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 400 }}>Field</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 400, color: '#86efac' }}>Survivor</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 400, color: '#f87171' }}>Loser</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 400 }}>Pick</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map(f => {
                      const sVal = survivor[f]; const lVal = loser[f]
                      const differs = String(sVal ?? '') !== String(lVal ?? '')
                      const choice = fieldChoices[f] || 'survivor'
                      return (
                        <tr key={f} style={{ borderBottom: '1px solid #ede6d6', background: differs ? 'rgba(184,148,42,0.04)' : 'transparent' }}>
                          <td style={{ padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: differs ? 'var(--ink)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{f}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', wordBreak: 'break-word', maxWidth: '260px', background: choice === 'survivor' && differs ? 'rgba(45,106,79,0.08)' : 'transparent' }}>{fmtVal(sVal)}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px', wordBreak: 'break-word', maxWidth: '260px', background: choice === 'loser' && differs ? 'rgba(192,57,43,0.08)' : 'transparent' }}>{fmtVal(lVal)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {differs ? (
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button onClick={() => setChoice(f, 'survivor')} disabled={merging} style={{ background: choice === 'survivor' ? '#2d6a4f' : 'none', color: choice === 'survivor' ? 'var(--white)' : '#2d6a4f', border: '1px solid #2d6a4f', padding: '2px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: merging ? 'not-allowed' : 'pointer' }}>keep</button>
                                <button onClick={() => setChoice(f, 'loser')} disabled={merging} style={{ background: choice === 'loser' ? '#c0392b' : 'none', color: choice === 'loser' ? 'var(--white)' : '#c0392b', border: '1px solid #c0392b', padding: '2px 8px', fontFamily: 'DM Mono, monospace', fontSize: '9px', cursor: merging ? 'not-allowed' : 'pointer' }}>take</button>
                              </div>
                            ) : <span style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {survivor && loser && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                Similarity reason <span style={{ color: 'var(--wine)' }}>*</span>
                <span style={{ textTransform: 'none', letterSpacing: 0, marginLeft: '6px', fontSize: '10px' }}>(e.g. "naming convention", "accent differences")</span>
              </label>
              <input type="text" value={similarityReason} onChange={e => setSimilarityReason(e.target.value)} placeholder="Why were these duplicates?" disabled={merging}
                style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--white)', padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          {mergeStatus && (
            <div style={{ padding: '10px 14px', marginBottom: '14px', background: mergeStatus.startsWith('✓') ? 'rgba(45,106,79,0.1)' : mergeStatus.startsWith('✗') ? 'rgba(192,57,43,0.1)' : 'rgba(107,30,46,0.06)', border: `1px solid ${mergeStatus.startsWith('✓') ? 'rgba(45,106,79,0.3)' : mergeStatus.startsWith('✗') ? 'rgba(192,57,43,0.3)' : 'rgba(107,30,46,0.2)'}`, fontSize: '11px', fontFamily: 'DM Mono, monospace', color: mergeStatus.startsWith('✓') ? '#2d6a4f' : mergeStatus.startsWith('✗') ? '#c0392b' : 'var(--ink)' }}>
              {mergeStatus}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={merging} style={{ background: 'none', border: '1px solid var(--border)', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', cursor: merging ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <button onClick={performMerge} disabled={!survivor || !loser || !similarityReason.trim() || merging}
              style={{ background: survivor && loser && similarityReason.trim() && !merging ? 'var(--wine)' : '#ccc', color: 'var(--white)', border: 'none', padding: '10px 22px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: survivor && loser && similarityReason.trim() && !merging ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
              {merging ? 'Merging…' : '🔀 Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
