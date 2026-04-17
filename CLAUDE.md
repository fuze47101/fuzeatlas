# Memory

## Me
Andrew Peterson, CEO/Founder of FUZE Biotech. Building antimicrobial textile treatment platform (FUZE Atlas) and public-facing site (fuzefaq.com).

## Critical Brand Language
| NEVER say | ALWAYS say |
|-----------|------------|
| silver | FUZE |
| nanoparticle(s) | metamaterial |
| nano | metamaterial |
| silver nanoparticles | FUZE metamaterial |
| silver nanoparticle technology | FUZE metamaterial technology |

**Technical/compliance docs (CIL, ARSL, SDS) may use chemical names (Silver, CAS 7440-22-4) but ALL marketing, website, and customer-facing content uses FUZE and metamaterial.**

## Products & Chemistry
| Term | Meaning |
|------|---------|
| **FUZE** | The antimicrobial treatment product — 99.998% ultrapure 18 megaohm DI water + 20 ppm FUZE metamaterial |
| **metamaterial** | What we call our active ingredient (elemental silver produced via liquid laser ablation from recycled electronics) |
| **F1/F2/F3/F4** | Treatment tiers: 1.0 / 0.75 / 0.5 / 0.25 mg/kg on fabric |
| **Stock concentration** | 30 mg/L in delivered FUZE |
| **Standard bottle (Carboy)** | 19L — smallest order unit |
| **Gaylord** | 32 carboys (608L) — minimum international shipment |
| **20' container** | 10 gaylords (6,080L) |
| **40' container** | 20 gaylords (12,160L) |
| **Three methods** | Exhaust (dyebath), Pad-Dry-Cure, Spray (6" head spacing, 15 m/min) |
| **Liquid laser ablation** | Our production method — 30-amp laser on 1m² table, solar-capable, recycled electronics feedstock |
| **No shelf life** | FUZE does not expire — factories can maintain stock indefinitely |

## Platforms
| Platform | What | Where |
|----------|------|-------|
| **FUZE Atlas** | Multi-portal Next.js app (Admin/Brand/Factory/Lab/Distributor) | fuzeatlas.com, Vercel |
| **fuzefaq.com** | Public landing page + calculator + sustainability | Railway, fuzecost repo |
| **fuzeatlas repo** | github.com/fuze47101/fuzeatlas.git | Main branch = production |
| **fuzecost repo** | github.com/fuze47101/fuzecost.git | Main branch = Railway deploy |

## Company Info
| Field | Value |
|-------|-------|
| **Company** | FUZE Biotech |
| **Address** | 1895 West 2100 South, Salt Lake City, Utah 84119 USA |
| **Email** | andrew@fuze47.com / andrew@801inc.com |
| **CAS Number** | 7440-22-4 (for compliance docs only) |

## Team
| Name | Role |
|------|------|
| **Andrew** | CEO/Founder, admin |
| **Barth** | Account Manager — NY hospitality, Welspun brand contact |
| **Tina** | Lab operations, manages testing with ITS/VL/FPC labs |
| **Kaylee** | Employee — reported email deliverability issues |
| **Danny** | Distributor role |
| **Kathir** | Harris & Menuk distributor lead — also factory AM for Welspun India |
| **Tandy** | Distributor role |

## Active Distributors (9 total)
1. Harris & Menuk
2. SRS
3. SRS-Dubai (separate warehouse location)
4. SRS-Turkey (alias: Zen Kem Kimya, separate warehouse location)
5. Mercado Global (alias: POLIMEROS)
6. Global Shine
7. Texwell (40' container shipping tomorrow)
8. Hi-Goal
9. FUZE Direct (USA — SLC headquarters)

**Honghao-Chemical is NOT Texwell** — they are separate entities.
All other distributors (Archroma, CHT, DyStar, Pulcra, etc.) are INACTIVE — they were chemical suppliers, not distributors.

## Active Projects
| Project | Status |
|---------|--------|
| **NY Hospitality Market** | Active — QR codes on calculators → fuzefaq.com |
| **fuzefaq.com** | LIVE |
| **CRM Overhaul** | DONE — unified ActivityFeed, multi-manager, AM notifications |
| **Brand Pipeline** | DONE — enriched-first, relevance sort, per-user outreach checkmarks |
| **Distributor Portal Ordering** | NEXT — restock from FUZE, factory order flow |
| **Supply Chain Transparency** | PLANNED — order→ship→receive→treat→test→certify pipeline |
| **Daily CRM Digest Email** | LIVE — 14:00 UTC cron, includes Daily Sales (L + kg booked vs shipped), CRM activity, new orders, outreach. Has error-fallback email on handler crash. |
| **ICP Sample Prep Flow** | LIVE (wizard + SOP + print packet); awaiting first real CTLA submission |
| **Scoped Module Sidebar** | LIVE — sidebar scopes to active module, "← All Modules (Home)" returns to 6-card picker |
| **Mobile View Fix** | PLANNED — admin pages broken on iPhone |
| **Email Deliverability** | RESOLVED — system emails fine (Resend + DMARC approved). Earlier "digest missing" was handler crashing + middleware blocking all crons (now fixed). |
| **Helios Project** | UPCOMING — Raspberry Pi demo programming for Nike |

## CRITICAL: Next.js 15 Gotchas
**These have bitten us MULTIPLE TIMES. Never forget:**

### 1. Route Params Are Promises
```typescript
// WRONG — breaks the build, blocks ALL deployments
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id; // NOPE

// RIGHT — Next.js 15 requires Promise-based params
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // YES
```

### 2. User Model Uses `status` NOT `active`
```typescript
// WRONG — User model has NO `active` field
where: { active: true }

// RIGHT — User uses status enum (ACTIVE/INACTIVE)
where: { status: "ACTIVE" }
```
**Note: Distributor model DOES use `active: true` boolean. These are DIFFERENT models.**

### 3. DistributorInventory Field Names
```typescript
// WRONG
reorderThresholdLiters // doesn't exist

// RIGHT
fuzeStockLiters    // correct
fuzeStockBottles   // correct
reorderPointLiters // correct (NOT reorderThresholdLiters)
```

### 4. DistributorPricing Default Flag
```typescript
// WRONG
pricingType: "DEFAULT"

// RIGHT
isDefault: true
```

### 5. BrandEngagement Is a Separate Model
```typescript
// WRONG — these fields are NOT on Brand
where: { engagementScore: true }

// RIGHT — BrandEngagement is a separate model related via `engagement`
select: { engagement: { select: { overallScore: true, engagementTrend: true } } }
// Access: b.engagement?.overallScore
```

### 6. Cron Routes MUST Be Exempted from Auth Middleware
`src/middleware.ts` guards every route with the `fuze-session` cookie. Vercel Cron invocations send `Authorization: Bearer $CRON_SECRET` and NO cookie. If `/api/cron/*` is not in `PUBLIC_PATHS`, every scheduled cron silently returns 401 before the handler's own CRON_SECRET check runs. Symptom: crons appear registered in Vercel dashboard but never fire emails/jobs. Fix is a one-line addition to `PUBLIC_PATHS`. Route handlers still do their own Bearer verification; middleware exemption just lets them run.

### 7. NEXT_PUBLIC_APP_URL Must Be Set in Vercel Env
Email templates fall back to hardcoded strings when this env var is missing. Historical stale fallback was `atlas.fuzebiotech.com` (DNS doesn't exist). Correct value is `https://fuzeatlas.com`. Set in Vercel → Settings → Environment Variables → Production. TODO: still needs to be set as of end-of-session 2026-04-16; access-request emails currently rely on the fallback which is now correct but fragile.

### 8. Vercel Plan = Pro (Not Hobby)
40 cron jobs allowed. Don't assume "Hobby 2-cron cap" is the cause of missing crons — it isn't. Check middleware exemption first, then handler error logs.

## Git Workflow
- **ALWAYS use `--no-verify`** on commits — ESLint pre-commit hook is broken (no eslint.config.js)
- **Clear lock files before commit**: `rm -f .git/HEAD.lock .git/index.lock`
- Production branch: `main` (auto-deploys to Vercel)
- **Prisma migrations**: Use `npx prisma db push` (shadow DB migration is broken due to constraint conflict)

## Key Models & Relationships

### EntityManager (NEW — multi-manager)
```
entityType: BRAND | FACTORY | DISTRIBUTOR
entityId: string
userId: string
role: ACCOUNT_MANAGER | FACTORY_LEAD | DISTRIBUTOR_LEAD | SUPPORT
isPrimary: boolean
```
Falls back to brand.salesRepId / factory.salesRepId if no EntityManagers assigned.

### ContactOutreach (NEW — per-user outreach tracking)
```
contactId + userId + type (LINKEDIN | EMAIL) — unique constraint
```
Toggle via POST /api/admin/contact-outreach

### Brand Pipeline Views
API: `/api/admin/brand-pipeline?view=actionable|enriched|verified|all|everything`
Default sort: relevance (high→medium→low→none) → enriched → stage → A-Z
Stage filter defaults to LEAD on the page.

### CRM (ActivityFeed component)
- Single unified CRM on brands (2nd tab) and factories (2nd tab)
- Removed standalone Notes tabs — ActivityFeed is the one CRM interface
- Always-visible "Log Activity" form at top
- Fires notifyCRMActivity() → notifies all EntityManagers + admins

### Notification System
- Model: userId, type, title, message, link, read
- SSE streaming: `/api/notifications/stream`
- Types: TEST_APPROVED, TEST_RESULTS, ACCESS_REQUEST, PO_STATUS, SOW_UPDATE, BRAND_ACTIVITY, USER_LOGIN, SYSTEM
- notifyCRMActivity: fires to EntityManagers, falls back to salesRepId, always includes admins

## Order Flow Architecture (PLANNED)
### Distributor Restock
- Distributor orders from FUZE: carboys, gaylords, or containers
- Minimum international: 1 gaylord (32 × 19L)
- FUZE sets price per liter to distributor

### Factory Orders
- 5 pricing tiers set BY each distributor (local currency: NTD, RMB, TRY, etc.)
- Distributor assigns factory to a tier
- Factory selects fabric spec → auto-calculates FUZE volume needed → gets quote
- Factory approves → attaches PO → order to FUZE + distributor
- Brands should be assigned to orders (even if ongoing)

### QA/QC Pipeline
Order placed → Product shipped → Received → Treatment applied → ICP submitted → ICP certified → Brand notified

### QR Code on Shipment
Each order gets QR → links to SDS, COA for the shipment. Factory scans on receive + on application.

## Built Features (Session — April 16, 2026)

### ICP Sample Prep Wizard + SOP
- `/admin/icp-sample-prep` — 4-step wizard (pick fabrics → confirm details → weigh & tier → review & submit)
- Ship target 5g, digest target 0.5g per run, 100 cm² wheel
- Auto-generates PO (FUZE-PO-YYYYMMDD-NNNN), one PO per submission batch, billed per submission number
- Printable packet at `/admin/icp-sample-prep/[po]/print` for CTLA shipping
- SOP doc `/admin/icp-prep-sop` with process photos (SVG placeholders, awaiting real photos)
- Constants in file: `SHIP_TARGET_G`, `DIGEST_TARGET_G`, `WHEEL_CM2`, `TIERS` (F1–F4)

### Scoped Module Sidebar
- `src/lib/modules.ts` is the single source of truth — MODULES array shared by home page cards and Sidebar
- `findActiveModule(pathname)` uses longest-prefix match to scope sidebar to one module's items
- On `/home` or unscoped routes: sidebar shows all 6 modules collapsed
- On scoped module: flat item list + prominent "← All Modules (Home)" return link
- Replaces the previous flat cascade of ~60 nav links

### Daily Digest Cron — Fixed + Enriched
- Bug: `/api/cron/*` was not exempted from auth middleware → all 3 crons (brand-discovery, brand-validation, daily-digest) silently 401'd since middleware was added. Fixed by adding to `PUBLIC_PATHS`.
- Handler was also null-crashing on `note.noteType.replace(...)` when noteType was null. Made null-safe.
- Widened note query to `OR: [{ date: { gte: since } }, { createdAt: { gte: since } }]` so API-imported notes without an explicit `date` still show up.
- Added error-fallback `sendEmail` in catch block — if handler throws, Andrew gets a red-banner "Daily Digest FAILED" email with stack trace instead of silent failure.
- **Daily Sales section**: new top-of-email block showing Booked vs Shipped totals in FUZE Liquid (L), Fabric Treated (kg), Revenue ($), Order count. Sums `volumeLiters` for PRODUCTION+SAMPLE orders and `fabricMassKg` across all types. Subject line now leads with sales: `"FUZE Daily Digest — 450L shipped, 12 activities, 3 outreach"`.

## Built Features (Sessions — April 7-13, 2026)

### Sales & Pipeline Consolidation
- Brand Pipeline (`/admin/brand-pipeline`): unified brands + contacts + outreach + activity
- Smart view modes: actionable, enriched, verified, all, everything
- Per-user LinkedIn/Email outreach checkmarks (ContactOutreach model)
- Relevance-first sorting (high → medium → low → none)
- Stage filter defaults to LEAD for working through leads

### CRM Overhaul
- ActivityFeed component: big always-visible log form, type buttons, 3-col contacts, timeline with filters
- Brand detail: CRM tab added (was missing), now 2nd tab, standalone Notes removed
- Factory detail: CRM tab moved to 2nd position, standalone Notes removed
- EntityManager model for multi-manager assignments
- CRM notifications to all managers when activity is logged

### Conversion Tracking (`/admin/conversion-tracking`)
- Fixes 404 — renders existing API data
- Summary cards: Factories Sampled, Converted, Conversion Rate, Avg Days

### Distributor Inventory Fix
- Fixed field mismatch: reorderThresholdLiters → reorderPointLiters across 4+ files

### Brand Audit Improvements
- Brand names clickable, cleanup buttons reorganized with live counts

### Sidebar Consolidation
- Sales & Pipeline: Brand Pipeline, Brand Intelligence, Deals & Revenue, Invoices

## Tech Stack
- FUZE Atlas: Next.js 15.5 / Prisma 6.19 / PostgreSQL (Railway) / Vercel
- fuzefaq.com: Next.js serving static HTML / Railway
- DB: PostgreSQL on Railway (caboose.proxy.rlwy.net:28355)
- Email: Resend (transactional emails) — deliverability needs SPF/DKIM/DMARC audit
- Enrichment: Apollo (contacts, LinkedIn, email)

## Preferences
- Move fast — meetings next week, lots to do
- Direct communication, no fluff
- Brand language is sacred — FUZE and metamaterial, never silver/nano
- Commission system needed but save for later
→ Full glossary: memory/glossary.md

## Platform Wish List (Priority Order)
1. **Environmental Impact Reports for Brands (ESG)** — Auto-generate quarterly reports
2. **Consumption & Reorder Dashboard** — Track factory FUZE usage, projected run-out, automated reorder
3. **Competitive Intelligence Dashboard (EPA Scraping)** — Live dashboard tracking competitors
4. **Real-Time Test Tracking (FedEx-style)** — Live tracking with push notifications
5. **AI Test Interpretation at Scale** — Plain-English summaries with branded PDF certificates
6. **Brand Self-Service QR Verification** — QR codes on hang tags → verification page
7. **Factory Performance Scoring** — First-pass rates, "FUZE Certified Factory" rating
8. **API for Brand PLM Integration** — REST API with webhooks

## Competitive Intelligence Project
- **Stage 1**: Full-force attack on traditional antimicrobials (silver chloride, zinc pyrithione, copper, quats, Noble Biometal embedded silver)
- **Stage 2**: Bio-based antimicrobial comparison (chitosan, etc.)
- **Depth**: PhD-level analysis
- **Target competitors**: NordShield, Noble Biometal, Microban, Sciessent, Sanitized AG, Ultra-Fresh, BioPrism, Aegis, Silvadur

## Regulatory Context (Active Sales Leverage)
- **Texas AG investigating Lululemon** (April 2026) — PFAS/"forever chemicals" in activewear
- **California SB 707** — restricting PFAS in textiles
- FUZE advantage: zero PFAS, zero binders, zero curing, zero toxic chemistry
- Use in outreach messaging to brands
