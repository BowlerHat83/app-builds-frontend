# SEO Audit Dashboard (frontend)

React + TypeScript + Vite dashboard, co-branded for the Bowler Hat × AllTru
collaboration, that calls the `app-builds/backend` FastAPI API and renders
its `/audit-master` response as charts, gauges and tables across 8 tabs
(Overview + Topics 1–7).

No UI framework dependency (no Tailwind/MUI) and no charting library — the
theme is plain CSS (`src/index.css`) and the bar/line/distribution charts are
hand-written SVG/CSS components in `src/components/charts/`. This keeps
`npm install` small and avoids relying on a design-time build I couldn't
verify myself (network in my sandbox couldn't reach the npm registry to test
a full build) — the only real dependencies are `react`, `react-dom`, the PDF
export libraries (`jspdf` + `jspdf-autotable`), and the Vite toolchain.

## Features

- **Drag-and-drop intake**: drop all your CSV exports into one zone at once —
  each file is auto-matched to the right slot by filename pattern
  (`src/lib/fileClassifier.ts`). Anything that doesn't match lands in an
  "unmatched" tray with a manual dropdown to assign it. A live 7-box grid
  shows how "ready" each topic is as files land (`src/lib/topicReadiness.ts`).
- **PDF downloads**: once an audit is loaded, the "Download" menu in the top
  bar generates two real client-side PDFs (`src/lib/pdf/`) — a 1-page
  Executive Summary (composite grade + headline metrics per topic) and a
  Full Report (every table across all 7 topics), both with the Bowler Hat ×
  AllTru cover branding.
- **Co-branding**: real logo files for both brands live in `public/logos/`
  and are used in the header (`BrandLockup.tsx`) and both PDF covers. Colors
  were sampled directly from those logo files (`src/lib/brand.ts`) — Bowler
  Hat blue `#007aff`, AllTru mint `#17ffd6` — kept independent from the
  dashboard's functional teal (score rings/badges/active tabs), so replacing
  a logo or brand color later is a one-file change. The header itself leads
  with the "SEO Audit Dashboard" wordmark (matching the original design),
  with both logos as a small "in collaboration with" credit underneath.
- **Hover tooltips**: every stat card label across Overview and Topics 1–7
  has a small "i" you can hover/focus for a one-line explanation of that
  metric (`components/ui/Tip.tsx`).
- **Pie/donut charts**: competitor share breakdowns (Topics 3 & 4) and
  Topic 4's per-engine citation split render as hand-written SVG donut
  charts with a legend (`components/charts/PieChart.tsx`), alongside the
  existing bar/line/distribution charts.

## Setup

```
npm install
cp .env.example .env
```

Edit `.env` if your backend isn't at `http://localhost:8000`:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Run locally

In one terminal, run the backend (from `app-builds/backend`):

```
uvicorn app.main:app --reload
```

In another terminal, run this frontend:

```
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The backend now
has CORS enabled (added to `app/main.py`) so the browser will allow the
cross-origin request from the Vite dev server to `localhost:8000`.

Fill in the "Run a new audit" form and drop in your CSVs — this calls
`POST /audit-master` on your backend directly.

## Build

```
npm run build
```

Output goes to `dist/`. `npm run preview` serves that build locally if you
want to sanity-check it before deploying.

## Deploy to Vercel

1. Push this `frontend/` folder to a git repo (or run `vercel` from inside it
   with the Vercel CLI — `npm i -g vercel` then `vercel`).
2. In the Vercel dashboard, import the repo. It auto-detects Vite via
   `vercel.json` (build command `npm run build`, output `dist`).
3. **Set the `VITE_API_BASE_URL` environment variable in Vercel** (Project
   Settings → Environment Variables) to wherever your backend is publicly
   reachable — a Vercel-hosted static frontend cannot reach
   `http://localhost:8000` on your machine. You'll need the FastAPI backend
   deployed somewhere with a public URL (Render, Railway, Fly.io, a VPS,
   etc.) for the "Run a new audit" flow to work from the deployed site.
4. If you do host the backend publicly, tighten `allow_origins` in
   `app/main.py`'s `CORSMiddleware` from `["*"]` to your actual `*.vercel.app`
   domain.

## Project structure

```
src/
  api/client.ts           - POST /audit-master, resolves screenshot URLs
  types/audit.ts          - TypeScript types mirroring the real backend JSON
  lib/brand.ts            - Bowler Hat / AllTru logo, color, and name tokens
  lib/scoring.ts          - frontend-only composite score/grade for the Overview tab
  lib/format.ts           - number/ms/currency formatting helpers
  lib/fileClassifier.ts   - filename -> upload-slot matching for the dropzone
  lib/topicReadiness.ts   - computes each topic's "how ready is it" fill state
  lib/pdf/                - jsPDF-based Executive Summary & Full Report generators
  components/ui/          - Card, StatCard, Badge, GaugeRing, DataTable
  components/charts/      - BarChart, LineChart, DistributionBar (hand-rolled SVG)
  components/layout/      - TopNav, BrandLockup, DownloadMenu
  components/UploadForm.tsx      - dropzone intake form
  components/TopicReadinessGrid.tsx
  pages/                  - one file per tab (Overview + Topic1..Topic7)
public/logos/             - real Bowler Hat & AllTru logo files
```

## Notes on the data

- Every number shown is either a real field from the backend response or an
  explicitly-labeled frontend composite (the Overview tab's grade/score - see
  the note under the header there). Nothing is fabricated when a field is
  missing; the UI shows "–" / "No data available" instead.
- Screenshot images (GBP profile, form captures) are loaded from your
  backend's `/static/screenshots/...` path via `VITE_API_BASE_URL`.
