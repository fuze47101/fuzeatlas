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

### Canonical product voice = src/lib/fuze-knowledge.ts
Any email body, outreach copy, meeting blurb, relevance hook, or AI-generated product
description emitted by the code MUST pull its language from `src/lib/fuze-knowledge.ts`
(the file powering the FUZE FAQ / /api/chat). That file is the single source of truth
for how we talk about the tech.

When writing email/outreach code defaults, the ONLY acceptable language pattern is:
- "FUZE" / "FUZE F1" / "metamaterial" (one word, no hyphen)
- "proprietary antimicrobial textile treatment" / "high density allotrope"
- Certifications: OEKO-TEX Standard 100 Class I, bluesign® approved, EPA registered, PFAS-free
- Standards: AATCC 100, AATCC 30, ISO 20743, ISO 18184
- Application: exhaust / pad-dry-cure / spray — standard textile finishing equipment, cure 150–170°C
- Tiers: F1 Full Spectrum (100 washes), F2 Advanced (75), F3 Core (50), F4 Foundation (25)

NEVER write "silver-ion", "silver ion", "nano-silver", "nanoparticle", "silver nanoparticle",
"water-based silver", or any variant — even as filler in a default template. If in doubt,
read src/lib/fuze-knowledge.ts first.

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

## Built Features (Session — April 17, 2026)

### FUZE Brand Voice Fix — Email Templates (commit f3d926b)
- **Bug**: `EmailComposeModal` on `/brands/[id]` and the new `EmailModal` on `/contacts/[id]` were writing default outreach copy that called FUZE "silver-ion antimicrobial" and "water-based silver-ion" — directly violating the brand voice locked in `src/lib/fuze-knowledge.ts` and the `Critical Brand Language` table at the top of this file.
- **Fix**: Rewrote both default email templates using canonical FUZE voice — "proprietary metamaterial antimicrobial treatment", "bonds to fibers during standard textile finishing", AATCC 100 / ISO 20743, OEKO-TEX Standard 100 Class I, bluesign® approved, EPA registered, PFAS-free. Tier language locked to F1 (100 washes). Application methods listed as exhaust / pad-dry-cure / spray.
- **Font**: Email body textareas now render in Times New Roman 12pt so drafts match the outbound Gmail style instead of the app's sans-serif UI.
- **CLAUDE.md hardening**: Added `Canonical product voice = src/lib/fuze-knowledge.ts` section right under the Critical Brand Language table. Enumerates the only acceptable language patterns and explicitly forbids every variant of silver/nano/ion. Any email/outreach code must now pull language from fuze-knowledge.ts.

### CRM Contact Detail Page + AI Enrichment (commit f3d926b)
- New `/contacts/[id]` page with full activity feed, linked brand/factory, send-email modal wired to the same `/api/crm/sendEmail` endpoint as brand pipeline.
- AI-powered contact enrichment on the detail page — uses the FUZE FAQ knowledge base and fuze-knowledge.ts so relevance hooks stay on-brand.

### canClaim Admin Toggle (commit a5c2ac1)
- Admin toggle on user records to flip `canClaim` — controls whether a user can self-claim brands into their pipeline. Unblocks distributor onboarding where we want read-only users who can't grab leads out from under reps.

### ICP Sample Prep Fabric Search — Fixed for Ashlee (commit b53a0bb)
- **Bug**: ICP Sample Prep wizard showed "No fabrics match" for every search Ashlee ran in the lab, including known FUZE numbers like `2504`. Three stacked issues:
  1. `GET /api/fabrics` ignored the `?q=` parameter entirely — client sent the query, server returned the full unfiltered list.
  2. Response-shape mismatch — API returned `{ fabrics: [...] }` but ICP wizard read `json.items`.
  3. Field-path drift — fabrics registered via intake have their FUZE number on the related `FabricSubmission`, not the flat `fuzeNumber` column. Wizard was only reading the flat field.
- **Fix**:
  - `src/app/api/fabrics/route.ts` — added server-side OR filter on `fuzeNumber` (exact, when `q` is numeric), `customerCode`, `factoryCode`, `construction`, `color`, `yarnType`, `fabricCategory`, `note`, `brand.name`, `factory.name`, and a `submissions: { some: ... }` back-pointer so submission-only FUZE numbers also match. Added `?pageSize=` cap. Response now returns both `fabrics` and `items` so every existing caller keeps working.
  - `src/app/admin/icp-sample-prep/page.tsx` — added flat fields + `submission` to `FabricRow`, added `fuzeNumOf / customerCodeOf / factoryCodeOf` resolver helpers that fall back to the submission, and updated render/label/sample-creation to use them. `setFabrics(json.fabrics || json.items || [])`.
- Unblocks task #8 (first real ICP Sample Prep submission end-to-end).

### Ops
- Full backup: `/Users/corporate/Desktop/fuzeatlas-backup-2026-04-17_1907.tar.gz` (121 MB, excludes node_modules / .next / build artifacts).
- 3 commits pushed to main: `a5c2ac1` → `f3d926b` → `b53a0bb`. Production Vercel project (`fuzeatlas`) deployed b53a0bb Ready. Duplicate Vercel project `fuzeatlas-z2d5` (prj_Wcbbir8cSU9Q1ADAq29f6oLAQEsU) is unrelated — it's been failing sporadically on various commits for weeks. Real prod is fine.

### Sample Application Wizard — Pad + Dry Before ICP (commits #59, #60, #61, #62)
- **Problem**: Ashlee was jumping from the Recipe Bench Test straight to ICP cutting/weighing. The actual lab workflow has a step in between: mix the diluted FUZE bath from the 30 ppm stock, pad the fabric through the vertical micro-padder at the saved squeeze/VFD/speed, dry in the chamber, **then** cut the 5 g ICP sample. That step was never recorded — no per-sample bath recipe, no padded/dried timestamps, no print card at the bench.
- **Model** (`prisma/schema.prisma`): New `SampleApplication` model with `appNumber` (`FUZE-APP-YYYYMMDD-NNNN`), `fabricId`, `benchTestId`, `tier`, `bathVolumeL`, `stockMgPerL` (default 30), `bathConcentrationMgPerL`, `fuzeMl`, `waterMl`, padder snapshot fields (`squeezePressure`, `vfdFrequencyHz`, `lineSpeedMPerMin`, `pickupDryToWetPct`), and lifecycle `paddedAt` / `driedAt`. Relations on `Fabric` (`FabricSampleApplications`) and `RecipeBenchTest` (`BenchTestSampleApplications`). Schema pushed live via `npx prisma db push`.
- **API** (`src/app/api/admin/sample-application/route.ts`): `POST` derives the bath from the bench test — `bathMgPerL = tier_mg_per_kg / (pickup%/100)`, `fuzeMl = bathVolumeL × (bathMgPerL / stock) × 1000`, `waterMl = bathVolumeL × 1000 − fuzeMl`. Tier → mg/kg: F1=1.0, F2=0.75, F3=0.5, F4=0.25. Stamps `paddedAt` + `driedAt` on create (`stampLifecycle: true`). `PATCH` allows individual lifecycle updates. `GET` supports `?id`, `?fabricId`, `?recent=1`.
- **Fabrics include** (`src/app/api/fabrics/route.ts`): Added `recipeBenchTests` include filtered to `pickupDryToWetPct: { not: null }`, ordered `testDate desc`, `take: 1` — the ICP wizard reads `fabric.latestBenchTest` and drives the recipe step without a second round-trip. Anything pre-measurement is useless for building a bath and gets filtered out.
- **Wizard** (`src/app/admin/icp-sample-prep/page.tsx`): Now 5 steps — (1) Pick fabrics → (2) Confirm details → (3) **Application recipe** → (4) Weigh & tier → (5) Review & submit. Step 3 renders a per-fabric card with bench test summary, tier buttons (F1-F4), bath volume input, live mL FUZE / mL DI preview that mirrors the server math exactly, operator + notes fields, padder settings snapshot (squeeze bar / VFD Hz / line speed m/min), and a "Pad + dry complete" button that POSTs to the API. No bench test → red banner + deep link to `/admin/recipe-calculator?fabricId=…` and the step blocks. Once recorded, the card locks (emerald ring), shows `FUZE-APP-…` number and dried timestamp, offers "Redo" and "🖨 Print recipe card" actions. Step-3 gate requires every sample has a `sampleApplicationId` before you can advance. Manual "Bench test ID" input on the weigh step was removed — the bench test now comes through the SampleApplication.
- **Print card** (`src/app/admin/sample-application/[id]/print/page.tsx` + `PrintButton.tsx`): One-page Letter printout for the bench — fabric identity, big bath recipe block (mL FUZE stock + mL DI with the derived concentration + pickup %), padder settings grid, padded/dried timestamps, operator + notes, `FUZE-APP-…` number. `@media print` margin 0.4in. Client-only print button extracted so the page itself stays an async RSC.
- **Sidebar badge bug** (`src/app/api/admin/pending-counts/route.ts`): Fixed badge showing 9 while the Test Requests page showed 6 pending. The badge was counting `FuzeTestRequest` (legacy table) while the page renders `TestRequest` (PO-based). Both now query `prisma.testRequest.count({ where: { status: "PENDING_APPROVAL" } })` so they agree.

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
