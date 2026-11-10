'use client'
import React from 'react'
import { SIZE_LABELS, hasActiveFilters, EMPTY_FILTERS } from './wine-utils'

// One filter and sort bar used on every page. Display only: it holds no data and never
// touches the database. Pages pass in their own state and any page-specific extras.
//
// Props
//   filters, setFilters     the shared filter object (see EMPTY_FILTERS in wine-utils)
//   options                 from buildOptions(rows, filters, accessors)
//   sorts, setSorts         up to two { key, dir } entries; dir is 1 (ascending) or -1 (descending)
//   sortKeys                [[key, label], ...] offered in the Sort by menus
//   count                   number of rows after filtering
//   extras                  optional page-specific controls (source, status, buyer flags...)
//   compact                 true on small screens: controls stack and fill the width

const FIELD = {
  border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--ink)',
  padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: '11px',
  outline: 'none', borderRadius: '2px', cursor: 'pointer', minWidth: 0,
}
const LABEL = { fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--muted)' }

export default function FilterSortBar({ filters, setFilters, options, sorts, setSorts, sortKeys, count, extras, compact }) {
  const set = (k, v) => setFilters(prev => {
    const next = { ...prev, [k]: v }
    if (k === 'country') next.region = '' // a region only makes sense within its country
    return next
  })
  const style = compact ? { ...FIELD, flex: '1 1 45%', padding: '10px 12px', fontSize: '13px' } : FIELD
  const primary = sorts[0] || { key: '', dir: 1 }
  const secondary = sorts[1] || { key: '', dir: 1 }

  const setSort = (i, patch) => setSorts(prev => {
    const next = [prev[0] || { key: '', dir: 1 }, prev[1] || { key: '', dir: 1 }]
    next[i] = { ...next[i], ...patch }
    return next.filter(s => s.key)
  })

  const sortMenu = (i, cur, placeholder) => (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      <select value={cur.key} onChange={e => setSort(i, { key: e.target.value })} style={style} aria-label={placeholder}>
        <option value="">{placeholder}</option>
        {sortKeys.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {cur.key && (
        <button onClick={() => setSort(i, { dir: cur.dir === 1 ? -1 : 1 })} style={{ ...FIELD, padding: '8px 9px' }}
          title={cur.dir === 1 ? 'Ascending' : 'Descending'}>{cur.dir === 1 ? '↑' : '↓'}</button>
      )}
    </span>
  )

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={filters.search} onChange={e => set('search', e.target.value)}
        placeholder="Search wine, producer, region" style={{ ...style, flex: '1 1 220px', cursor: 'text' }} />
      <select value={filters.colour} onChange={e => set('colour', e.target.value)} style={style} aria-label="Colour">
        <option value="">All colours</option>
        {options.colour.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={filters.country} onChange={e => set('country', e.target.value)} style={style} aria-label="Country">
        <option value="">All countries</option>
        {options.country.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={filters.region} onChange={e => set('region', e.target.value)} style={style} aria-label="Region">
        <option value="">All regions</option>
        {options.region.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={filters.vintage} onChange={e => set('vintage', e.target.value)} style={style} aria-label="Vintage">
        <option value="">All vintages</option>
        {options.vintage.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={filters.size} onChange={e => set('size', e.target.value)} style={style} aria-label="Size">
        <option value="">All sizes</option>
        {options.size.map(v => <option key={v} value={v}>{SIZE_LABELS[v] || v + 'cl'}</option>)}
      </select>
      {extras}
      <span style={{ ...LABEL, marginLeft: compact ? 0 : 'auto' }}>Sort by</span>
      {sortMenu(0, primary, 'Sort by...')}
      <span style={LABEL}>then</span>
      {sortMenu(1, secondary, 'Then by...')}
      {hasActiveFilters(filters) && (
        <button onClick={() => setFilters({ ...EMPTY_FILTERS })}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', cursor: 'pointer', textDecoration: 'underline' }}>
          Clear filters
        </button>
      )}
      <span style={LABEL}>{count} wine{count === 1 ? '' : 's'}</span>
    </div>
  )
}
