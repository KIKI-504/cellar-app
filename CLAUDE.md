# Cellar App — Claude Code Context

## What this project is
A web app for Jessica, a wine merchant, to manage bonded wine inventory, studio stock, and sales operations. It replaces a manual workflow of cross-referencing spreadsheets, calculating markups, and checking retail competitiveness before presenting wines to restaurant buyers.

---

## Infrastructure

| Thing | Value |
|---|---|
| Repo | `github.com/KIKI-504/cellar-app` |
| Vercel project ID | `prj_Id6RZbFXyQrWzrlQ5XGL8fdKwmy6` |
| Vercel team ID | `team_7MLj3d0QO6noDxcbLvBNxS90` |
| Live URL | `cellar-app-chi.vercel.app` |
| Supabase project ID | `unteoesmedxvwrmnhlkz` |
| Stack | Next.js 14, Supabase, Vercel |

**Important:** Jessica has no local dev environment. All development has historically been via the GitHub web editor. Claude Code changes that — she now has a local clone and can use `npm run dev` + Supabase remote.

---

## PINs (for testing)
- Admin: `2025`
- Buyer: `1234`
- Local Sales: `2222`

---

## Pages

| Route | Role | Purpose |
|---|---|---|
| `/` | Everyone | PIN login |
| `/admin` | Admin | Full IB inventory — pricing, WS retail, buyer view toggle |
| `/studio` | Admin | Studio inventory management, photo scan, label printing |
| `/local` | Local Sales | Studio wines marked for local sale |
| `/buyer` | Buyers | Buyer-facing wine list (curated, competitive wines) |
| `/labels` | Admin | 4×6" thermal label printing (Munbyn printer) |
| `/boxes` | Admin | Box builder — bundle wines into consignment boxes |

---

## Database tables

### `wines` — IB (in-bond) inventory
Main wine catalogue sourced from BBR and Flint CSV imports.

Key columns:
- `source` — 'Berry Brothers', 'Flint', or 'Manual'
- `source_id` — supplier reference OR Jessica's Wine ID convention
- `description`, `vintage`, `colour`, `region`, `country`
- `bottle_format` — 'Bottle', 'Magnum', 'Half Bottle'
- `bottle_volume` — '75 cl', '150 cl', '37.5 cl' (note: BBR includes space, Flint does not — always use `ILIKE '%150%'` checks)
- `quantity` — text (number of bottles in bond)
- `purchase_price_per_bottle` — numeric, IB price ex-duty ex-VAT. **This is the correct price for DP calculations.**
- `ws_lowest_per_bottle` — numeric, WS ex-tax price per bottle (for 150cl, this is the magnum price — NOT a 75cl price doubled). This is the single source of truth for WS pricing.
- `retail_price` — **PERMANENTLY NULL — do not use.** DP Retail is always computed live in the UI.
- `retail_price_date` — date WS price was last updated
- `retail_price_source` — text description of WS price source
- `sale_price` — Jessica's asking price to buyers
- `include_in_buyer_view` — boolean
- `ws_lowest_per_bottle` — WS ex-tax price
- `women_note`, `producer_note` — enrichment notes

### `studio` — physical studio inventory
Wines Jessica has moved from bond to her studio.

Key columns:
- `wine_id` — FK to wines (nullable for unlinked bottles)
- `unlinked_description`, `unlinked_vintage` — for bottles not in wines table
- `quantity` — integer (bottles physically present)
- `dp_price` — numeric, stored at insert time (see formula below)
- `sale_price` — Jessica's asking price
- `status` — 'Available', 'Consumed', 'Sold'
- `include_in_local` — boolean, show on /local page
- `bottle_size` — '37.5', '75', or '150'
- `colour`, `date_moved`, `notes`
- `source_id` — canonical column name (not `cellar_id`)

### `boxes`, `box_items` — consignment box builder
RLS enabled. FKs indexed.

### `consignees`, `consignment_items`, `consignment_sales` — billing
Schema exists, feature not fully built yet.

---

## ⚠️ Critical business logic — THE FORMULA

### DP Cost (your duty-paid cost price)
```
duty = bottle_volume contains '150' ? 6 : 3
DP = (purchase_price_per_bottle + duty) × 1.20
```
- £3 is the duty for 75cl (not a handling fee — it IS the duty)
- £6 is the duty for 150cl magnums
- ×1.20 is VAT at 20%, applied to wine + duty combined
- This must be applied consistently on EVERY page that shows or calculates DP

### WS DP Retail (Wine Searcher duty-paid equivalent — for competitiveness check)
```
ws_duty = bottle_volume contains '150' ? 6 : 3
WS_DP_Retail = (ws_lowest_per_bottle + ws_duty) × 1.20
```
- `ws_lowest_per_bottle` always stores the per-bottle ex-tax WS price for that format
- For a 150cl bottle, `ws_lowest_per_bottle` is the magnum WS price (not doubled from 75cl)
- DP Retail is NEVER stored — always computed live

### Competitive definition
A wine is competitive when: `your DP Cost < WS DP Retail`
i.e. `(purchase_price + duty) × 1.20 < (ws_lowest + ws_duty) × 1.20`
which simplifies to: `purchase_price < ws_lowest`
(but always compute both fully to display them correctly)

### Supplier invoice structure
- **BBR**: Order confirmation email = wine-only price (correct IB price). Separate duty/VAT invoice — do NOT use for pricing.
- **Flint**: CSV/spreadsheet. ⚠️ 2024 Burgundy EP wines have case prices in Unit Price column, not per-bottle — verify against invoice and divide by case size.
- **Club Magnum**: Two invoices — (1) EUR wine invoice = IB price; (2) GBP duty/VAT/delivery invoice — do NOT use for pricing.

---

## ⚠️ Pages where the formula must be correct

| Page | Formula use | Notes |
|---|---|---|
| `app/admin/page.js` | DP Cost column, WS Retail column, competitive ✓/✗ | Both columns use bottle_volume for duty |
| `app/studio/page.js` | `dp_price` at insert (add modal, scan modal, photo modal) | Use `bottle_size` field (stored as '75', '150', '37.5') |
| `app/labels/page.js` | `calcDP()` for bond and studio labels | Has `isMagnum()` helper — wire it into calcDP |
| `app/buyer/page.js` | Displays `sale_price` only — no formula | No changes needed |
| `app/local/page.js` | Displays `dp_price` from studio table — no recalc | No changes needed |

---

## Admin page UX spec (agreed design, not yet fully implemented)

### Pricing columns layout
Two separate columns side by side:

**DP Cost column:**
- Row 1: `£XX.XX` — computed `(IB + duty) × 1.20`, read-only, styled prominently
- Row 2: `IB £XX.XX` — raw purchase price, smaller, muted

**WS Retail column:**
- Row 1: `£XX.XX` — computed `(WS + duty) × 1.20`, read-only, styled prominently
- Row 2: `WS £XX.XX ex-tax` — editable input field (saves to `ws_lowest_per_bottle`)
- Row 3: date stamp (colour-coded: green <30 days, amber <90, red ≥90)
- Row 4: 🔍 WS button (opens Wine Searcher pre-filled with wine name + vintage, UK/GBP filter)

**Competitive indicator** (`✓` / `✗` / `—`) sits between the two columns.

### Save confirmation
On successful save of `ws_lowest_per_bottle`: cell flashes green briefly.
On failure: red border.
Date (`retail_price_date`) updates automatically on save — not manually editable.

### Filters
Existing: source, colour, buyer view, search
Add: **"Missing WS"** filter — shows wines where `ws_lowest_per_bottle IS NULL`

---

## React / Next.js patterns — hard-won rules

- **`defaultValue` on uncontrolled inputs reverts on re-render.** Use an `EditableCell` component with local state that only syncs from props when not actively editing.
- **`React.Fragment` with key** — use explicit `<React.Fragment key={...}>` not `<>` inside `.map()`.
- **`import React`** must be explicit when using `React.Fragment`.
- **`export const dynamic = 'force-dynamic'`** after `'use client'` on any page using `sessionStorage` or browser APIs — prevents Next.js static prerender failures at build time.
- **`maybeSingle()` not `single()`** when a Supabase query may return 0 rows.
- **Iframe printing** — use `iframe.onload` not `setTimeout` (prevents blank label output on Munbyn printer).

---

## Code delivery rules

- Always provide **complete replacement files** — never snippets or find-and-replace instructions. Pasting large blocks into GitHub web editor is error-prone; full files are the only safe approach.
- Output files go to the repo root or `app/[route]/page.js` as appropriate.
- Proactively flag logic errors — do not silently proceed if something looks wrong with the formula or data.

---

## Wine ID naming convention (for manually added wines)
Format: `YY MM WWWW C S`
- YY = last 2 digits of vintage
- MM = first 2 letters of maker (uppercase)
- WWWW = first 4 letters of wine name (uppercase)
- C = colour initial (R/W/S/Ro/Sw)
- S = size (B=Bottle, M=Magnum, H=Half)

Example: 2019 Roumier Chambolle-Musigny Red 75cl → `19 RO CHAM R B`

Used in Xero as unique parent ID. Stored in `wines.source_id`.

---

## Current state & active roadmap

### Completed (as of April 2026)
- RLS enabled on `boxes` and `box_items`
- FK indexes added on `studio.wine_id` and `box_items.studio_id`
- PWA service worker implemented (`sw.js`) — cache-first for assets, network-first for navigation; Supabase and Anthropic calls bypassed
- Box builder page bugs fixed (wine names in dropdown, toast system, error handling)
- `retail_price` column permanently nulled — DP Retail now computed live everywhere

### In progress / next up
1. **Admin page rewrite** — split DP Cost / WS Retail columns, correct formula with bottle size, save flash, missing-WS filter
2. **Fix formula in labels page** — `calcDP()` must use bottle size (£6 for 150cl)
3. **Fix formula in studio page** — `dp_price` at insert must use `bottle_size` field
4. **Auth overhaul** — PIN validation server-side (API route + middleware + httpOnly cookie)
5. **Consignment/billing statements** — schema designed, UI not built

### On the horizon
- **Restaurant wine list price comparison tool** — upload PDFs of London restaurant wine lists, match against cellar inventory ±5yr vintage window, show list price vs DP. Text-based PDF extraction confirmed working.
- **Smart CSV sync** — match on `source_id` to update quantities, flag removed wines
- **Flint spreadsheet check** — when next Flint spreadsheet arrives (~Sept/Oct 2026), verify 2024 vintage Burgundy EP prices are per-bottle not per-case

---

## Supabase notes
- Call security and performance advisors independently (`type: "security"` and `type: "performance"` return different result sets)
- `execute_sql` often succeeds when `list_tables` fails
- VPN must be disabled when connecting

## Vercel notes
- Use `get_project` for deployment status (not `list_deployments` which can return cached results)
- Build logs via `get_deployment_build_logs` with deployment ID

## Hardware
- Munbyn thermal printer — 4×6" labels
- MacBook Air — Claude Code installed (v2.1.87)
- PATH fix if needed: `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`
