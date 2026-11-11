// Shared, display-only helpers for filtering, sorting and live retail maths.
//
// RULES FOR THIS FILE
//  - No database access. Nothing here reads from or writes to Supabase.
//  - Nothing here mutates the rows it is given. Filters and sorts return new arrays.
//  - The duty rule is copied exactly from the original admin page, so prices do not change.

// ── Size ─────────────────────────────────────────────────────────────────────

// Normalises the many ways size is stored ('75 cl', '75cl', '750', '150', 'Magnum', ...)
// into one of '37.5', '75', '150', '300', or '' when unknown.
export function normaliseSize(volume, format) {
  const v = String(volume ?? '').toLowerCase().replace(/\s|cl|ml/g, '')
  const f = String(format ?? '').toLowerCase()
  if (v === '300' || v === '3000') return '300'
  if (v === '150' || v === '1500') return '150'
  if (v === '37.5' || v === '375') return '37.5'
  if (v === '75' || v === '750') return '75'
  if (f.includes('double')) return '300'
  if (f.includes('magnum')) return '150'
  if (f.includes('half')) return '37.5'
  if (f === 'bottle' || f === '75cl') return '75'
  return ''
}

export const SIZE_LABELS = {
  '37.5': '37.5cl (half)',
  '75': '75cl (bottle)',
  '150': '150cl (magnum)',
  '300': '300cl (double magnum)',
}

// ── Duty and live retail (unchanged business rule) ───────────────────────────

// Identical to the original isMagnum in app/admin/page.js. Note that it also
// returns true for 'Double Magnum', exactly as before.
export function isMagnumForDuty(w) {
  const vol = String(w.bottle_volume || '').replace(/[^0-9]/g, '')
  const fmt = (w.bottle_format || '').toLowerCase()
  return vol === '150' || vol === '1500' || fmt.includes('magnum')
}

// Double magnum (300cl): £12 duty. Checked first, because 'Double Magnum' also counts as a magnum.
export function isDoubleMagnum(w) {
  const vol = String(w.bottle_volume || '').replace(/[^0-9]/g, '')
  const fmt = (w.bottle_format || '').toLowerCase()
  return vol === '300' || vol === '3000' || fmt.includes('double')
}

export function dutyForWine(w) { return isDoubleMagnum(w) ? 12 : isMagnumForDuty(w) ? 6 : 3 }

// DP cost = (IB + duty) x 1.2
export function dpCost(w) {
  if (!w.purchase_price_per_bottle) return null
  return (parseFloat(w.purchase_price_per_bottle) + dutyForWine(w)) * 1.2
}

// DP retail = (Wine Searcher ex-tax + duty) x 1.2. Always calculated live, never stored.
// Returns null when there is no Wine Searcher price.
export function wsRetailLive(w) {
  const ws = parseFloat(w.ws_lowest_per_bottle)
  if (!ws) return null
  return Math.round((ws + dutyForWine(w)) * 1.2 * 100) / 100
}

// ── Accessors ────────────────────────────────────────────────────────────────

// An accessor object tells the shared code how to read each field from a page's own row shape.
// get(key, row) returns the raw value for 'name' | 'vintage' | 'colour' | 'region' | 'country'
// | 'size' | 'qty' | 'price', plus any page-specific keys. types maps each key to how it sorts.
export function makeAccessors(getters, extraTypes = {}) {
  return {
    get: (key, row) => (getters[key] ? getters[key](row) : undefined),
    types: {
      name: 'text', colour: 'text', region: 'text', country: 'text',
      vintage: 'vintage', size: 'size', qty: 'num', price: 'num',
      ...extraTypes,
    },
  }
}

// For rows from the wines table (Bonded Storage, Buyer view).
export const WINE_GETTERS = {
  name: w => w.description || '',
  vintage: w => w.vintage,
  colour: w => w.colour || '',
  region: w => w.region || '',
  country: w => w.country || '',
  size: w => normaliseSize(w.bottle_volume, w.bottle_format),
  qty: w => parseInt(w.quantity) || 0,
  price: w => parseFloat(w.sale_price) || 0,
}
export const WINE_ROW = makeAccessors(WINE_GETTERS)

// For rows from the studio table with the wines row joined as `wines` (Studio, Bottles on Hand).
export const STUDIO_GETTERS = {
  name: s => s.wines?.description || s.unlinked_description || '',
  vintage: s => s.wines?.vintage || s.unlinked_vintage,
  colour: s => s.wines?.colour || s.colour || '',
  region: s => s.wines?.region || '',
  country: s => s.wines?.country || '',
  size: s => normaliseSize(s.bottle_size || s.wines?.bottle_volume, s.wines?.bottle_format),
  qty: s => parseInt(s.quantity) || 0,
  price: s => parseFloat(s.sale_price) || 0,
}
export const STUDIO_ROW = makeAccessors(STUDIO_GETTERS)

// ── Filtering ────────────────────────────────────────────────────────────────

export const EMPTY_FILTERS = { search: '', colour: '', country: '', region: '', vintage: '', size: '' }

export function hasActiveFilters(f) {
  return Object.keys(EMPTY_FILTERS).some(k => !!f[k])
}

function defaultSearchText(A, row) {
  return ['name', 'vintage', 'colour', 'region', 'country']
    .map(k => String(A.get(k, row) ?? ''))
    .join(' ')
    .toLowerCase()
}

// Returns a NEW array containing only the rows that match every active filter.
// A page may pass searchText(row) to keep a richer search than the default.
export function applyFilters(rows, f, A, searchText) {
  const tokens = (f.search || '').toLowerCase().split(/[\s,]+/).filter(Boolean)
  return rows.filter(row => {
    if (f.colour && String(A.get('colour', row) || '').trim().toLowerCase() !== f.colour.toLowerCase()) return false
    if (f.country && String(A.get('country', row) || '').trim() !== f.country) return false
    if (f.region && String(A.get('region', row) || '').trim() !== f.region) return false
    if (f.vintage && String(A.get('vintage', row) ?? '').trim() !== f.vintage) return false
    if (f.size && A.get('size', row) !== f.size) return false
    if (tokens.length) {
      const hay = searchText ? searchText(row) : defaultSearchText(A, row)
      if (!tokens.every(t => hay.includes(t))) return false
    }
    return true
  })
}

// Builds the dropdown options from the rows actually present, so only real values appear.
// Region options narrow to the chosen country. Each option list ignores its own filter,
// so you can always switch from one value to another.
export function buildOptions(rows, f, A) {
  const uniq = (key, pool) => [...new Set(
    pool.map(r => String(A.get(key, r) ?? '').trim()).filter(Boolean)
  )]
  const inCountry = f.country ? rows.filter(r => String(A.get('country', r) || '').trim() === f.country) : rows
  return {
    colour: uniq('colour', rows).sort((a, b) => a.localeCompare(b)),
    country: uniq('country', rows).sort((a, b) => a.localeCompare(b)),
    region: uniq('region', inCountry).sort((a, b) => a.localeCompare(b)),
    vintage: uniq('vintage', rows).sort((a, b) => b.localeCompare(a)),
    size: ['37.5', '75', '150', '300'].filter(s => rows.some(r => A.get('size', r) === s)),
  }
}

// ── Sorting ──────────────────────────────────────────────────────────────────

// sorts is a list of up to two { key, dir } entries, dir being 1 (ascending) or -1 (descending).
// Rows with a blank or non-numeric value (NV, missing vintage, empty price) always sort last,
// in both directions. Returns a NEW array; the input is never reordered.
export function applySorts(rows, sorts, A) {
  const active = (sorts || []).filter(s => s && s.key)
  if (!active.length) return rows.slice()

  const prep = (key, row) => {
    const type = A.types[key] || 'text'
    const raw = A.get(key, row)
    if (type === 'vintage') {
      const n = parseInt(raw)
      return { blank: !/^\d{4}$/.test(String(raw ?? '').trim()) || isNaN(n), v: n }
    }
    if (type === 'size') {
      const n = parseFloat(raw)
      return { blank: isNaN(n), v: n }
    }
    if (type === 'num') {
      const n = typeof raw === 'number' ? raw : parseFloat(raw)
      return { blank: raw === null || raw === undefined || raw === '' || isNaN(n), v: n }
    }
    if (type === 'raw') {
      // Plain string compare where an empty value counts as the lowest value (sorts first when
      // ascending). Used for date columns such as 'checked', where "unchecked first" depends on it.
      return { blank: false, v: String(raw ?? '') }
    }
    const s = String(raw ?? '').trim().toLowerCase()
    return { blank: s === '', v: s }
  }

  return rows.slice().sort((a, b) => {
    for (const { key, dir } of active) {
      const pa = prep(key, a), pb = prep(key, b)
      if (pa.blank && pb.blank) continue
      if (pa.blank) return 1
      if (pb.blank) return -1
      const type = A.types[key] || 'text'
      const c = (type === 'text' || type === 'raw') ? pa.v.localeCompare(pb.v) : pa.v - pb.v
      if (c !== 0) return c * (dir || 1)
    }
    return 0
  })
}
