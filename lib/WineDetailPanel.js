'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Read-only quick-reference view of a wine. Opened from any list by passing
// either a wines row (`wine`) or a wine_id (`wineId`). Fetches the wine,
// its studio rows and any consignment lines so the whole picture is in one place.

const SERIF = 'Cormorant Garamond, serif'
const MONO = 'DM Mono, monospace'

function isMagnumLike(v) {
  const s = String(v || '').toLowerCase().replace(/\s/g, '')
  return s.includes('150') || s.includes('magnum') || s.includes('1500')
}
function duty(v) { return isMagnumLike(v) ? 6 : 3 }
function gbp(n) { return n == null || n === '' || isNaN(parseFloat(n)) ? '—' : `£${parseFloat(n).toFixed(2)}` }
function sizeLabel(v) {
  const s = String(v || '').toLowerCase().replace(/\s/g, '')
  if (s.includes('37.5') || s.includes('375') || s.includes('half')) return '37.5cl'
  if (s.includes('300') || s.includes('double')) return '300cl'
  if (isMagnumLike(s)) return '150cl'
  if (!s) return '—'
  return '75cl'
}
function fmtDate(d) {
  if (!d) return null
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00')
  if (isNaN(dt)) return d
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Row({ label, value, strong, muted }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '5px 0', borderBottom: '1px dotted rgba(0,0,0,0.08)' }}>
      <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', flexShrink: 0, paddingTop: '2px' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: strong ? 600 : 400, color: muted ? 'var(--muted)' : 'var(--ink)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Section({ title, children, accent }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: accent || 'var(--wine)', marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${accent || 'var(--wine)'}` }}>{title}</div>
      {children}
    </div>
  )
}

function Note({ title, text, accent }) {
  if (!text) return null
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: accent || 'var(--muted)', marginBottom: '3px' }}>{title}</div>
      <div style={{ fontFamily: SERIF, fontSize: '14px', lineHeight: 1.5, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}

export default function WineDetailPanel({ wine: wineProp, wineId, studio: studioProp, onClose }) {
  const [wine, setWine] = useState(wineProp || null)
  const [studioRows, setStudioRows] = useState(null)
  const [consigned, setConsigned] = useState(null)
  const [loading, setLoading] = useState(true)
  const id = wineProp?.id || wineId || studioProp?.wine_id || null

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (!id) {
        // Unlinked studio bottle — nothing more to fetch.
        setStudioRows(studioProp ? [studioProp] : [])
        setConsigned([])
        setLoading(false)
        return
      }
      const [w, s, c] = await Promise.all([
        wineProp ? Promise.resolve({ data: wineProp }) : supabase.from('wines').select('*').eq('id', id).maybeSingle(),
        supabase.from('studio').select('*').eq('wine_id', id).order('date_moved', { ascending: false }),
        supabase.from('consignment_items').select('id, qty_delivered, qty_remaining, status, date_delivered, sale_price, dp_price, consignees(name)').eq('wine_id', id).order('date_delivered', { ascending: false }),
      ])
      if (cancelled) return
      setWine(w.data || null)
      setStudioRows(s.data || [])
      setConsigned(c.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const name = wine?.description || studioProp?.unlinked_description || '—'
  const vintage = wine?.vintage || studioProp?.unlinked_vintage || ''
  const sizeSrc = wine?.bottle_volume || wine?.bottle_format || studioProp?.bottle_size
  const size = sizeLabel(sizeSrc)
  const colour = wine?.colour || studioProp?.colour || ''

  const ib = wine?.purchase_price_per_bottle != null ? parseFloat(wine.purchase_price_per_bottle) : null
  const dpCost = ib != null ? (ib + duty(sizeSrc)) * 1.2 : null
  const ws = wine?.ws_lowest_per_bottle != null ? parseFloat(wine.ws_lowest_per_bottle) : null
  const wsDP = ws != null ? (ws + duty(sizeSrc)) * 1.2 : null
  const competitive = ib != null && ws != null ? ib < ws : null

  const studioAvailable = (studioRows || []).filter(r => r.status === 'Available')
  const studioQty = studioAvailable.reduce((n, r) => n + (parseInt(r.quantity) || 0), 0)
  const bondQty = wine?.quantity != null && wine.quantity !== '' ? parseInt(wine.quantity) || 0 : null
  const consignedActive = (consigned || []).filter(c => c.status === 'Active')
  const consignedQty = consignedActive.reduce((n, c) => n + (parseInt(c.qty_remaining) || 0), 0)

  const studioSale = studioAvailable.find(r => r.sale_price)?.sale_price ?? studioProp?.sale_price ?? null

  return (
    <>
      <style>{`
        .wdp-backdrop { position: fixed; inset: 0; background: rgba(20,14,10,0.45); z-index: 1000; }
        .wdp-panel { position: fixed; z-index: 1001; background: var(--cream, #f7f3ec); color: var(--ink, #1a1612); box-shadow: -8px 0 32px rgba(0,0,0,0.18); display: flex; flex-direction: column; top: 0; right: 0; bottom: 0; width: 440px; max-width: 100vw; }
        @media (max-width: 640px) {
          .wdp-panel { top: auto; left: 0; right: 0; bottom: 0; width: 100vw; max-height: 92vh; border-radius: 14px 14px 0 0; box-shadow: 0 -8px 32px rgba(0,0,0,0.25); }
        }
      `}</style>
      <div className="wdp-backdrop" onClick={onClose} />
      <div className="wdp-panel" role="dialog" aria-modal="true">
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border, #ddd)', display: 'flex', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: '20px', lineHeight: 1.2, fontWeight: isMagnumLike(sizeSrc) ? 700 : 500 }}>
              {wine?.women_note && <span title={wine.women_note} style={{ marginRight: '5px', fontSize: '15px', color: '#9b3a4a' }}>♀</span>}
              {name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--muted)', marginTop: '4px', letterSpacing: '0.04em' }}>
              {[vintage, colour, size, wine?.region, wine?.country].filter(Boolean).join(' · ')}
            </div>
            {wine?.sommelier_note && (
              <div style={{ display: 'inline-block', marginTop: '8px', border: '1px solid var(--wine, #6b1e2e)', color: 'var(--wine, #6b1e2e)', fontFamily: MONO, fontSize: '10px', fontWeight: 600, padding: '3px 8px', letterSpacing: '0.04em' }}>★ {wine.sommelier_note}</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: '1px solid var(--border, #ddd)', color: 'var(--muted)', fontFamily: MONO, fontSize: '14px', lineHeight: 1, width: '32px', height: '32px', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px 32px', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em' }}>Loading…</div>
          ) : (
            <>
              <Section title="Where it is">
                <Row label="In bond" value={bondQty != null ? `${bondQty} btl` : null} strong />
                <Row label="Studio" value={`${studioQty} btl`} strong />
                <Row label="On consignment" value={consignedQty ? `${consignedQty} btl` : null} strong />
                {consignedActive.map(c => (
                  <Row key={c.id} label={c.consignees?.name || 'Consignee'} value={`${c.qty_remaining}/${c.qty_delivered} left · ${gbp(c.sale_price)} · ${fmtDate(c.date_delivered)}`} muted />
                ))}
                {!!studioRows?.length && studioRows.map(r => (
                  <Row key={r.id} label={`Studio ${r.status || ''}`.trim()} value={`${r.quantity} btl · moved ${fmtDate(r.date_moved)}${r.checked_on ? ` · checked ${fmtDate(r.checked_on)}` : ''}${r.include_in_local ? ' · on Bottles on Hand' : ''}`} muted />
                ))}
              </Section>

              <Section title="Pricing">
                <Row label="IB / btl" value={gbp(ib)} />
                <Row label="DP cost" value={gbp(dpCost)} strong />
                <Row label="Sale price" value={gbp(studioSale ?? wine?.sale_price)} strong />
                <Row label="WS ex-tax" value={ws != null ? `${gbp(ws)}${wine?.ws_price_date ? ` (${fmtDate(wine.ws_price_date)})` : ''}` : null} />
                <Row label="WS DP retail" value={gbp(wsDP)} />
                {competitive != null && <Row label="Competitive" value={competitive ? '✓ yes' : '✗ no'} strong />}
                <Row label="Liv-ex market" value={gbp(wine?.livex_market_price)} muted />
                <Row label="BBX highest bid" value={wine?.bbx_highest_bid} muted />
                <Row label="Case size" value={wine?.case_size} muted />
              </Section>

              {(wine?.buyer_note || wine?.producer_note || wine?.women_note || studioRows?.some(r => r.notes)) && (
                <Section title="Notes" accent="#2d6a4f">
                  <Note title="Wine note" text={wine?.buyer_note} accent="#2d6a4f" />
                  <Note title="Producer note" text={wine?.producer_note} />
                  <Note title="♀ Women in wine" text={wine?.women_note} accent="#9b3a4a" />
                  {studioRows?.filter(r => r.notes).map(r => <Note key={r.id} title="Studio note (private)" text={r.notes} />)}
                </Section>
              )}

              {wine && (
                <Section title="Record" accent="var(--muted)">
                  <Row label="Source" value={wine.source} muted />
                  <Row label="Source ID" value={wine.source_id} muted />
                  <Row label="Product code" value={wine.product_code} muted />
                  <Row label="Format" value={[wine.bottle_format, wine.bottle_volume].filter(Boolean).join(' · ')} muted />
                  <Row label="On roster" value={wine.include_in_buyer_view ? 'yes' : 'no'} muted />
                  <Row label="Flagged" value={wine.flagged ? (wine.flag_note || 'yes') : null} muted />
                  <Row label="Review flag" value={wine.review_flag ? 'yes' : null} muted />
                  <Row label="Manual override" value={wine.manual_override_note ? `${wine.manual_override_note}${wine.manual_override_date ? ` (${fmtDate(wine.manual_override_date)})` : ''}` : null} muted />
                  <Row label="Added" value={fmtDate(wine.created_at)} muted />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
