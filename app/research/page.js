'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

const REGIONS = ['All', 'Burgundy', 'Bordeaux', 'Piedmont', 'Tuscany', 'California', 'Rhône', 'Loire', 'Champagne', 'Rioja', 'Other'];

export default function ResearchArchive() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeLayer, setActiveLayer] = useState(1);
  const [editingBuyer, setEditingBuyer] = useState(false);
  const [buyerDraft, setBuyerDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, verified: 0, withBuyer: 0, withWomen: 0 });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = getSupabase()
      .from('research_archive')
      .select('*')
      .order('date_researched', { ascending: false });

    if (verifiedOnly) query = query.eq('verified', true);

    const { data, error } = await query;
    if (error) { console.error(error); setLoading(false); return; }

    let filtered = data || [];

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.wine_title?.toLowerCase().includes(s) ||
        e.producer?.toLowerCase().includes(s) ||
        e.region?.toLowerCase().includes(s) ||
        e.tags?.some(t => t.toLowerCase().includes(s))
      );
    }

    if (regionFilter !== 'All') {
      filtered = filtered.filter(e => e.region?.toLowerCase().includes(regionFilter.toLowerCase()));
    }

    if (womenOnly) {
      filtered = filtered.filter(e => e.full_research?.includes('♀') || e.tags?.includes('women'));
    }

    setEntries(filtered);
    setStats({
      total: data.length,
      verified: data.filter(e => e.verified).length,
      withBuyer: data.filter(e => e.buyer_version).length,
      withWomen: data.filter(e => e.full_research?.includes('♀') || e.tags?.includes('women')).length,
    });
    setLoading(false);
  }, [search, regionFilter, verifiedOnly, womenOnly]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const openEntry = (entry) => {
    setSelected(entry);
    setActiveLayer(1);
    setEditingBuyer(false);
    setBuyerDraft(entry.buyer_version || '');
  };

  const saveBuyerVersion = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await getSupabase()
      .from('research_archive')
      .update({ buyer_version: buyerDraft, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (!error) {
      setSelected({ ...selected, buyer_version: buyerDraft });
      setEntries(entries.map(e => e.id === selected.id ? { ...e, buyer_version: buyerDraft } : e));
      setEditingBuyer(false);
    }
    setSaving(false);
  };

  const toggleVerified = async (entry) => {
    const newVal = !entry.verified;
    const { error } = await getSupabase()
      .from('research_archive')
      .update({ verified: newVal, updated_at: new Date().toISOString() })
      .eq('id', entry.id);
    if (!error) {
      const updated = { ...entry, verified: newVal };
      setEntries(entries.map(e => e.id === entry.id ? updated : e));
      if (selected?.id === entry.id) setSelected(updated);
    }
  };

  // Comparison: naive diff — highlight lines present in Layer 1 but absent from Layer 2
  const getComparison = () => {
    if (!selected?.full_research || !selected?.buyer_version) return null;
    const l1Lines = selected.full_research.split('\n').filter(l => l.trim());
    const l2Text = selected.buyer_version.toLowerCase();
    return l1Lines.map(line => {
      const key = line.trim().slice(0, 40).toLowerCase();
      const kept = l2Text.includes(key.slice(0, 20));
      return { line, kept };
    });
  };

  const hasWomen = (entry) =>
    entry?.full_research?.includes('♀') || entry?.tags?.includes('women');

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Spectral+SC:wght@400;600&family=DM+Mono:wght@300;400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #1a1008;
          --parchment: #f5efe4;
          --parchment-mid: #ede4d4;
          --parchment-dark: #d8cbb8;
          --wine: #7a1f2e;
          --wine-light: #a83344;
          --wine-pale: #f0e0e3;
          --gold: #b8943f;
          --gold-light: #d4aa55;
          --text: #2d1f0e;
          --text-mid: #5a3d22;
          --text-light: #8a6540;
          --verified-green: #2d6a4f;
          --women-rose: #8b3a52;
          --border: rgba(90, 61, 34, 0.18);
        }

        body { font-family: 'EB Garamond', Georgia, serif; background: var(--parchment); color: var(--text); }

        .ra-wrap { min-height: 100vh; display: flex; flex-direction: column; }

        /* HEADER */
        .ra-header {
          background: var(--ink);
          padding: 1.5rem 2rem 1.25rem;
          display: flex;
          align-items: baseline;
          gap: 1.5rem;
          border-bottom: 2px solid var(--gold);
        }
        .ra-header h1 {
          font-family: 'Spectral SC', Georgia, serif;
          font-size: 1.35rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--parchment);
          text-transform: uppercase;
        }
        .ra-header .subtitle {
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          color: var(--gold);
          letter-spacing: 0.05em;
        }
        .ra-back {
          margin-left: auto;
          color: var(--parchment-dark);
          text-decoration: none;
          font-size: 0.8rem;
          font-family: 'DM Mono', monospace;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .ra-back:hover { opacity: 1; }

        /* STATS BAR */
        .ra-stats {
          background: var(--ink);
          padding: 0.6rem 2rem;
          display: flex;
          gap: 2rem;
          border-bottom: 1px solid rgba(184, 148, 63, 0.3);
        }
        .ra-stat {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.7rem;
          color: var(--parchment-dark);
        }
        .ra-stat strong { color: var(--gold-light); }
        .ra-stat.women { color: #d4a0b0; }
        .ra-stat.women strong { color: #e8b4c4; }

        /* CONTROLS */
        .ra-controls {
          background: var(--parchment-mid);
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          border-bottom: 1px solid var(--border);
        }
        .ra-search {
          flex: 1;
          min-width: 200px;
          padding: 0.5rem 0.85rem;
          background: var(--parchment);
          border: 1px solid var(--parchment-dark);
          border-radius: 3px;
          font-family: 'EB Garamond', serif;
          font-size: 0.95rem;
          color: var(--text);
          outline: none;
          transition: border-color 0.2s;
        }
        .ra-search:focus { border-color: var(--wine); }
        .ra-search::placeholder { color: var(--text-light); font-style: italic; }

        .ra-regions {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .ra-region-btn {
          padding: 0.3rem 0.7rem;
          background: transparent;
          border: 1px solid var(--parchment-dark);
          border-radius: 2px;
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          color: var(--text-mid);
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: all 0.15s;
        }
        .ra-region-btn:hover { border-color: var(--wine); color: var(--wine); }
        .ra-region-btn.active { background: var(--wine); border-color: var(--wine); color: var(--parchment); }

        .ra-toggles { display: flex; gap: 0.75rem; margin-left: auto; }
        .ra-toggle {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          color: var(--text-mid);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .ra-toggle input { accent-color: var(--wine); width: 13px; height: 13px; }

        /* LAYOUT */
        .ra-body { display: flex; flex: 1; overflow: hidden; height: calc(100vh - 165px); }

        /* LIST */
        .ra-list {
          width: 340px;
          min-width: 280px;
          overflow-y: auto;
          border-right: 1px solid var(--border);
          background: var(--parchment);
        }
        .ra-count {
          padding: 0.6rem 1rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          color: var(--text-light);
          border-bottom: 1px solid var(--border);
          background: var(--parchment-mid);
        }
        .ra-entry {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.12s;
          position: relative;
        }
        .ra-entry:hover { background: var(--parchment-mid); }
        .ra-entry.active { background: var(--wine-pale); border-left: 3px solid var(--wine); padding-left: calc(1rem - 3px); }
        .ra-entry-title {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text);
          line-height: 1.3;
          margin-bottom: 0.2rem;
        }
        .ra-entry-meta {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          color: var(--text-light);
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .ra-entry-badges {
          display: flex;
          gap: 0.3rem;
          margin-top: 0.35rem;
          flex-wrap: wrap;
        }
        .badge {
          font-family: 'DM Mono', monospace;
          font-size: 0.6rem;
          padding: 0.15rem 0.4rem;
          border-radius: 2px;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .badge-verified { background: #e8f5ee; color: var(--verified-green); border: 1px solid #a8d5bb; }
        .badge-women { background: #f5e8ed; color: var(--women-rose); border: 1px solid #d4a0b0; }
        .badge-buyer { background: #f0ede5; color: var(--gold); border: 1px solid #d4c090; }
        .badge-linked { background: #e8edf5; color: #2a4a7a; border: 1px solid #a0b4d0; }
        .badge-tag { background: var(--parchment-mid); color: var(--text-light); border: 1px solid var(--border); }

        /* DETAIL PANEL */
        .ra-detail {
          flex: 1;
          overflow-y: auto;
          background: var(--parchment);
          display: flex;
          flex-direction: column;
        }
        .ra-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-light);
          font-style: italic;
          font-size: 1rem;
        }

        .ra-detail-header {
          padding: 1.5rem 2rem 1rem;
          border-bottom: 1px solid var(--border);
          background: var(--parchment-mid);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .ra-detail-title {
          font-family: 'Spectral SC', serif;
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 0.4rem;
        }
        .ra-detail-meta {
          font-family: 'DM Mono', monospace;
          font-size: 0.7rem;
          color: var(--text-mid);
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }
        .ra-detail-badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }

        /* LAYER TABS */
        .ra-layers {
          display: flex;
          gap: 0;
          border-bottom: 2px solid var(--border);
          padding: 0 2rem;
          background: var(--parchment);
          position: sticky;
          top: 0;
          z-index: 9;
        }
        .ra-layer-tab {
          padding: 0.65rem 1.25rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
          color: var(--text-light);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .ra-layer-tab:hover { color: var(--text); }
        .ra-layer-tab.active { color: var(--wine); border-bottom-color: var(--wine); font-weight: 500; }

        /* ACTIONS */
        .ra-actions {
          padding: 0 2rem 0.5rem;
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          background: var(--parchment);
          position: sticky;
          top: 41px;
          z-index: 8;
          border-bottom: 1px solid var(--border);
          padding-top: 0.5rem;
        }
        .ra-btn {
          padding: 0.35rem 0.85rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.04em;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid;
        }
        .ra-btn-ghost { background: transparent; border-color: var(--border); color: var(--text-mid); }
        .ra-btn-ghost:hover { border-color: var(--wine); color: var(--wine); }
        .ra-btn-primary { background: var(--wine); border-color: var(--wine); color: var(--parchment); }
        .ra-btn-primary:hover { background: var(--wine-light); }
        .ra-btn-verify { background: var(--verified-green); border-color: var(--verified-green); color: #fff; }
        .ra-btn-verify.unverify { background: transparent; border-color: var(--border); color: var(--text-light); }

        /* CONTENT */
        .ra-content { padding: 1.5rem 2rem 3rem; flex: 1; }
        .ra-research-text {
          font-size: 1rem;
          line-height: 1.75;
          color: var(--text);
          white-space: pre-wrap;
          font-family: 'EB Garamond', serif;
        }
        .ra-research-text strong { color: var(--ink); }

        .ra-buyer-area {
          width: 100%;
          min-height: 300px;
          font-family: 'EB Garamond', serif;
          font-size: 1rem;
          line-height: 1.75;
          color: var(--text);
          background: var(--parchment);
          border: 1px solid var(--parchment-dark);
          border-radius: 3px;
          padding: 1rem;
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
        }
        .ra-buyer-area:focus { border-color: var(--wine); }

        .ra-buyer-empty {
          font-style: italic;
          color: var(--text-light);
          padding: 1rem 0;
          font-size: 0.95rem;
        }

        /* COMPARISON */
        .ra-comparison { display: flex; flex-direction: column; gap: 0.3rem; }
        .ra-comp-line {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.35rem 0.5rem;
          border-radius: 2px;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .ra-comp-line.kept { background: #edf7f2; }
        .ra-comp-line.dropped { background: #fdf2f4; opacity: 0.6; }
        .ra-comp-indicator {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          padding: 0.1rem 0.35rem;
          border-radius: 2px;
          white-space: nowrap;
          flex-shrink: 0;
          margin-top: 0.15rem;
        }
        .kept .ra-comp-indicator { background: #c8eedd; color: var(--verified-green); }
        .dropped .ra-comp-indicator { background: #f5c8d0; color: var(--wine); }

        .ra-comp-note {
          font-family: 'DM Mono', monospace;
          font-size: 0.7rem;
          color: var(--text-light);
          margin-bottom: 1rem;
          padding: 0.5rem 0.75rem;
          background: var(--parchment-mid);
          border-left: 2px solid var(--gold);
          border-radius: 0 2px 2px 0;
        }

        /* LOADING */
        .ra-loading {
          padding: 2rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.75rem;
          color: var(--text-light);
          text-align: center;
        }

        /* SOURCES */
        .ra-sources {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          color: var(--text-light);
        }
        .ra-sources strong { color: var(--text-mid); }

        /* SCROLLBAR */
        .ra-list::-webkit-scrollbar,
        .ra-detail::-webkit-scrollbar { width: 4px; }
        .ra-list::-webkit-scrollbar-track,
        .ra-detail::-webkit-scrollbar-track { background: transparent; }
        .ra-list::-webkit-scrollbar-thumb { background: var(--parchment-dark); border-radius: 2px; }
        .ra-detail::-webkit-scrollbar-thumb { background: var(--parchment-dark); border-radius: 2px; }

        @media (max-width: 768px) {
          .ra-body { flex-direction: column; height: auto; }
          .ra-list { width: 100%; height: 40vh; border-right: none; border-bottom: 1px solid var(--border); }
          .ra-detail { height: auto; }
          .ra-stats { flex-wrap: wrap; gap: 0.75rem; }
          .ra-controls { gap: 0.75rem; }
          .ra-toggles { margin-left: 0; }
        }
      `}</style>

      <div className="ra-wrap">
        {/* HEADER */}
        <header className="ra-header">
          <h1>Research Archive</h1>
          <span className="subtitle">Wine Knowledge Repository</span>
          <a href="/" className="ra-back">← Cellar</a>
        </header>

        {/* STATS */}
        <div className="ra-stats">
          <div className="ra-stat"><strong>{stats.total}</strong> entries</div>
          <div className="ra-stat"><strong>{stats.verified}</strong> verified</div>
          <div className="ra-stat"><strong>{stats.withBuyer}</strong> with buyer version</div>
          <div className="ra-stat women"><strong>♀ {stats.withWomen}</strong> women noted</div>
        </div>

        {/* CONTROLS */}
        <div className="ra-controls">
          <input
            className="ra-search"
            type="text"
            placeholder="Search wine, producer, region, tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="ra-regions">
            {REGIONS.map(r => (
              <button
                key={r}
                className={`ra-region-btn${regionFilter === r ? ' active' : ''}`}
                onClick={() => setRegionFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="ra-toggles">
            <label className="ra-toggle">
              <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />
              Verified only
            </label>
            <label className="ra-toggle">
              <input type="checkbox" checked={womenOnly} onChange={e => setWomenOnly(e.target.checked)} />
              ♀ Women noted
            </label>
          </div>
        </div>

        {/* BODY */}
        <div className="ra-body">
          {/* LIST */}
          <div className="ra-list">
            <div className="ra-count">{loading ? 'Loading…' : `${entries.length} result${entries.length !== 1 ? 's' : ''}`}</div>
            {loading ? (
              <div className="ra-loading">Fetching archive…</div>
            ) : entries.length === 0 ? (
              <div className="ra-loading">No entries found.</div>
            ) : (
              entries.map(entry => (
                <div
                  key={entry.id}
                  className={`ra-entry${selected?.id === entry.id ? ' active' : ''}`}
                  onClick={() => openEntry(entry)}
                >
                  <div className="ra-entry-title">
                    {entry.wine_title}
                    {entry.vintage ? ` ${entry.vintage}` : ''}
                  </div>
                  <div className="ra-entry-meta">
                    {entry.producer && <span>{entry.producer}</span>}
                    {entry.region && <span>· {entry.region}</span>}
                    <span>· {formatDate(entry.date_researched)}</span>
                  </div>
                  <div className="ra-entry-badges">
                    {entry.verified && <span className="badge badge-verified">✓ Verified</span>}
                    {hasWomen(entry) && <span className="badge badge-women">♀</span>}
                    {entry.buyer_version && <span className="badge badge-buyer">Layer 2</span>}
                    {entry.wines_id && <span className="badge badge-linked">In cellar</span>}
                    {entry.tags?.slice(0, 3).map(t => (
                      <span key={t} className="badge badge-tag">{t}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DETAIL */}
          <div className="ra-detail">
            {!selected ? (
              <div className="ra-empty">Select an entry to read</div>
            ) : (
              <>
                <div className="ra-detail-header">
                  <div className="ra-detail-title">
                    {selected.wine_title}{selected.vintage ? ` ${selected.vintage}` : ''}
                  </div>
                  <div className="ra-detail-meta">
                    {selected.producer && <span>{selected.producer}</span>}
                    {selected.region && <span>· {selected.region}</span>}
                    <span>· Researched {formatDate(selected.date_researched)}</span>
                    {selected.wines_id && <span>· <a href={`/wines/${selected.wines_id}`} style={{color:'var(--gold)'}}>View in cellar →</a></span>}
                  </div>
                  <div className="ra-detail-badges">
                    {selected.verified && <span className="badge badge-verified">✓ Verified</span>}
                    {hasWomen(selected) && <span className="badge badge-women">♀ Women in wine</span>}
                    {selected.buyer_version && <span className="badge badge-buyer">Buyer version drafted</span>}
                    {selected.tags?.map(t => <span key={t} className="badge badge-tag">{t}</span>)}
                  </div>
                </div>

                {/* LAYER TABS */}
                <div className="ra-layers">
                  <button className={`ra-layer-tab${activeLayer === 1 ? ' active' : ''}`} onClick={() => setActiveLayer(1)}>
                    Layer 1 — Full Research
                  </button>
                  <button className={`ra-layer-tab${activeLayer === 2 ? ' active' : ''}`} onClick={() => { setActiveLayer(2); setEditingBuyer(false); }}>
                    Layer 2 — Buyer Version
                  </button>
                  <button
                    className={`ra-layer-tab${activeLayer === 3 ? ' active' : ''}`}
                    onClick={() => setActiveLayer(3)}
                    style={{ opacity: (selected.buyer_version && selected.full_research) ? 1 : 0.4 }}
                  >
                    Layer 3 — Comparison
                  </button>
                </div>

                {/* ACTIONS */}
                <div className="ra-actions">
                  {activeLayer === 2 && !editingBuyer && (
                    <button className="ra-btn ra-btn-ghost" onClick={() => { setEditingBuyer(true); setBuyerDraft(selected.buyer_version || ''); }}>
                      {selected.buyer_version ? 'Edit buyer version' : 'Draft buyer version'}
                    </button>
                  )}
                  {activeLayer === 2 && editingBuyer && (
                    <>
                      <button className="ra-btn ra-btn-ghost" onClick={() => setEditingBuyer(false)}>Cancel</button>
                      <button className="ra-btn ra-btn-primary" onClick={saveBuyerVersion} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  )}
                  <button
                    className={`ra-btn ra-btn-verify${selected.verified ? ' unverify' : ''}`}
                    onClick={() => toggleVerified(selected)}
                  >
                    {selected.verified ? 'Mark unverified' : '✓ Mark verified'}
                  </button>
                </div>

                {/* CONTENT */}
                <div className="ra-content">
                  {activeLayer === 1 && (
                    <>
                      <div className="ra-research-text">
                        {selected.full_research || <em style={{color:'var(--text-light)'}}>No research content yet.</em>}
                      </div>
                      {selected.sources && (
                        <div className="ra-sources">
                          <strong>Sources:</strong> {selected.sources}
                        </div>
                      )}
                    </>
                  )}

                  {activeLayer === 2 && (
                    editingBuyer ? (
                      <textarea
                        className="ra-buyer-area"
                        value={buyerDraft}
                        onChange={e => setBuyerDraft(e.target.value)}
                        placeholder="Write your curated buyer version here — your voice, your edit…"
                        autoFocus
                      />
                    ) : selected.buyer_version ? (
                      <div className="ra-research-text">{selected.buyer_version}</div>
                    ) : (
                      <div className="ra-buyer-empty">
                        No buyer version drafted yet. Click "Draft buyer version" above to write your curated take.
                      </div>
                    )
                  )}

                  {activeLayer === 3 && (
                    (!selected.full_research || !selected.buyer_version) ? (
                      <div className="ra-buyer-empty">
                        Both Layer 1 and Layer 2 need content before a comparison can be shown.
                      </div>
                    ) : (
                      <>
                        <div className="ra-comp-note">
                          Lines from Layer 1 are shown below. Green = likely present in your buyer version. Red = appears to have been cut or substantially rewritten. This is a heuristic comparison, not a precise diff.
                        </div>
                        <div className="ra-comparison">
                          {getComparison()?.map((item, i) => (
                            <div key={i} className={`ra-comp-line ${item.kept ? 'kept' : 'dropped'}`}>
                              <span className="ra-comp-indicator">{item.kept ? 'kept' : 'cut'}</span>
                              <span>{item.line}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
