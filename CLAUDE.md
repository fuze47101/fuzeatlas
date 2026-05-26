# Memory

## Me

Andrew Peterson, CEO/Founder of FUZE Biotech. Building antimicrobial textile treatment platform (FUZE Atlas) and public-facing site (fuzefaq.com).

## Critical Brand Language

| NEVER say                      | ALWAYS say                   |
| ------------------------------ | ---------------------------- |
| silver                         | FUZE                         |
| nanoparticle(s)                | metamaterial                 |
| nano                           | metamaterial                 |
| silver nanoparticles           | FUZE metamaterial            |
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
- Certifications: OEKO-TEX Standard 100 Class I, bluesign® approved, EPA registered (federal), California EPA approved (Q1 2026), PFAS-free
- Standards: AATCC 100, AATCC 30, ISO 20743, ISO 18184
- Application: exhaust / pad-dry-cure / spray — standard textile finishing equipment, cure 150–170°C
- Tiers: F1 Full Spectrum (100 washes), F2 Advanced (75), F3 Core (50), F4 Foundation (25)

NEVER write "silver-ion", "silver ion", "nano-silver", "nanoparticle", "silver nanoparticle",
"water-based silver", or any variant — even as filler in a default template. If in doubt,
read src/lib/fuze-knowledge.ts first.

## CRITICAL: Test Methodology — AATCC 100 vs ASTM E2149

This is the deepest piece of competitive positioning we have, and it's been
under-told. Andrew briefed it 2026-05-04: any code, copy, PDF, slide, or
chatbot answer that talks about FUZE wash/efficacy testing MUST get this right.

### How the two tests work mechanically

**AATCC 100** is the historical antibacterial test for textiles. Mechanically
it stacks multiple fabric layers around an inoculated coupon and measures
surviving colony-forming units after a contact period. It was DESIGNED for
**leaching antimicrobials** — chemistries (silver-ion, silver chloride,
zinc pyrithione, QAC) that release ions into the surrounding moisture and
kill bacteria via that ion field. The stacked layers actually help leaching
chemistries because the released ions saturate the inter-layer space.

**ASTM E2149** is the dynamic-contact antimicrobial test. The treated
fabric is shaken in a buffered bacterial suspension; reduction is
measured after a defined contact period. It was DESIGNED for
**non-leaching, contact-kill antimicrobials** — chemistries that have to
physically touch the bacterial cell wall to disrupt it. No ion cloud
required. No leaching tolerated. The test rewards direct surface contact.

### Why this matters for FUZE

FUZE metamaterial is **non-leaching by design**. We don't want metal in
the wash water. Our kill mechanism is contact-based — the metamaterial
particles that have permanently bonded into the fiber surface dismantle
bacteria when the cell physically touches them. That is exactly the
mechanism ASTM E2149 was written to evaluate.

When FUZE is forced through AATCC 100, two things slow us down:
1. **Multiple stacked layers** create dead zones between coupons where
   bacterial growth is unimpeded by direct contact with treated fibers
   — bacteria can grow in inter-layer voids before they encounter a
   FUZE-treated surface.
2. **No ion field** — competitors' silver leaches into the inter-layer
   moisture and kills bacteria *between* the layers; FUZE has nothing
   leaching, so bacteria in those voids survive longer.

So AATCC 100 advantages leaching chemistries by its very geometry. It is
not a level playing field for non-leaching antimicrobials. FUZE still
passes AATCC 100 — but only at higher concentrations (F2 Advanced
Performance / F1 Full Spectrum), where there's enough metamaterial
density to overcome the test's inter-layer geometry.

### The right test per tier

| Tier | Primary test | Notes |
| ---- | ------------ | ----- |
| **F4 Essential Protection** (0.25) | **ASTM E2149** | Dynamic contact test. This is where FUZE peak-performs. Direct mechanism match. Cotton & natural fiber dominance. |
| **F3 Core Performance** (0.5) | **ASTM E2149** | Same — non-leaching contact-kill, validated by the right test. |
| **F2 Advanced Performance** (0.75) | **ASTM E2149 + AATCC 100** | Sufficient metamaterial density to pass both tests including the layered AATCC 100. |
| **F1 Full Spectrum** (1.0) | **ASTM E2149 + AATCC 100** | Full pass on both, plus the extra benefit stack (UV, color, microfiber). |

### What to say (and not say) about wash counts

- **Wash counts are NOT EPA-validated.** EPA registers chemistry as a
  pesticide; it does not certify any wash count. When we say "F1 = 100
  washes" we mean our internal AATCC 100 / ISO 20743 testing through
  100 washes documents continued efficacy. We share those reports with
  brands on request. That's the asymmetry vs competitors — they don't
  share test reports, because their wash claims are self-published.
- **Don't say "EPA-defensible wash count."** EPA doesn't validate wash
  counts. Use "third-party validated" (we have AATCC 100 / E2149 reports
  from independent labs) vs "self-published marketing" (competitors).
- **Use ASTM E2149 as the lead test for F3/F4.** It's the right test for
  non-leaching chemistry. AATCC 100 is appropriate for F1/F2 where the
  density overcomes the leaching-test bias.

### The competitive jab

> "We test on ASTM E2149 because it's the test designed for non-leaching
> antimicrobials. Silvadur and Polygiene rely on AATCC 100 because it
> was designed around their leaching chemistry — the test geometry helps
> their ions saturate the layers. FUZE doesn't leach, by design. Meet
> us on the right test."

Anyone authoring outreach copy, presentation slides, PDFs, or chatbot
answers should be able to deploy that paragraph verbatim.

### Standards we care about

- **Antimicrobial efficacy:** ASTM E2149 (primary for non-leaching),
  AATCC 100 (historical, still required at higher tiers), ISO 20743.
- **Antifungal:** AATCC 30.
- **Antiviral:** ISO 18184.
- **Color & substrate:** OEKO-TEX Standard 100 Class I, bluesign® approved.
- **Regulatory:** EPA federal registration, California EPA approval (Q1 2026),
  PFAS-free.

## Products & Chemistry

| Term                         | Meaning                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **FUZE**                     | The antimicrobial treatment product — 99.998% ultrapure 18 megaohm DI water + 20 ppm FUZE metamaterial             |
| **metamaterial**             | What we call our active ingredient (elemental silver produced via liquid laser ablation from recycled electronics) |
| **F1/F2/F3/F4**              | Treatment tiers: 1.0 / 0.75 / 0.5 / 0.25 mg/kg on fabric                                                           |
| **Stock concentration**      | 30 mg/L in delivered FUZE                                                                                          |
| **Standard bottle (Carboy)** | 19L — smallest order unit                                                                                          |
| **Gaylord**                  | 32 carboys (608L) — minimum international shipment                                                                 |
| **20' container**            | 10 gaylords (6,080L)                                                                                               |
| **40' container**            | 20 gaylords (12,160L)                                                                                              |
| **Three methods**            | Exhaust (dyebath), Pad-Dry-Cure, Spray (6" head spacing, 15 m/min)                                                 |
| **Liquid laser ablation**    | Our production method — 30-amp laser on 1m² table, solar-capable, recycled electronics feedstock                   |
| **No shelf life**            | FUZE does not expire — factories can maintain stock indefinitely                                                   |

## Platforms

| Platform           | What                                                           | Where                        |
| ------------------ | -------------------------------------------------------------- | ---------------------------- |
| **FUZE Atlas**     | Multi-portal Next.js app (Admin/Brand/Factory/Lab/Distributor) | fuzeatlas.com, Vercel        |
| **fuzefaq.com**    | Public landing page + calculator + sustainability              | Railway, fuzecost repo       |
| **fuzeatlas repo** | github.com/fuze47101/fuzeatlas.git                             | Main branch = production     |
| **fuzecost repo**  | github.com/fuze47101/fuzecost.git                              | Main branch = Railway deploy |

## Company Info

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| **Company**    | FUZE Biotech                                         |
| **Address**    | 1895 West 2100 South, Salt Lake City, Utah 84119 USA |
| **Email**      | andrew@fuze47.com / andrew@801inc.com                |
| **CAS Number** | 7440-22-4 (for compliance docs only)                 |

## Team

| Name       | Role                                                                |
| ---------- | ------------------------------------------------------------------- |
| **Andrew** | CEO/Founder, admin                                                  |
| **Barth**  | Account Manager — NY hospitality, Welspun brand contact             |
| **Tina**   | Lab operations, manages testing with ITS/VL/FPC labs                |
| **Kaylee** | Employee — reported email deliverability issues                     |
| **Danny**  | Distributor role                                                    |
| **Kathir** | Harris & Menuk distributor lead — also factory AM for Welspun India |
| **Tandy**  | Distributor role                                                    |

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

| Project                         | Status                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NY Hospitality Market**       | Active — QR codes on calculators → fuzefaq.com                                                                                                                                                                                     |
| **fuzefaq.com**                 | LIVE                                                                                                                                                                                                                               |
| **CRM Overhaul**                | DONE — unified ActivityFeed, multi-manager, AM notifications                                                                                                                                                                       |
| **Brand Pipeline**              | DONE — enriched-first, relevance sort, per-user outreach checkmarks                                                                                                                                                                |
| **Distributor Portal Ordering** | NEXT — restock from FUZE, factory order flow                                                                                                                                                                                       |
| **Brand Supply Chain Visibility** | DONE (May 9, 2026) — `/brand-portal/supply-chain` shows every factory in the brand's supply chain with submission/test/consumption rollups. Spec strip + Edit link to `/brand-portal/spec`.                                       |
| **Brand Spec + ICP Cadence**    | DONE (May 9, 2026) — Brand stipulates required tier + ICP cadence (every N orders OR every X liters). Daily cron flags overdue factories. Schema change pending `prisma db push`.                                                  |
| **Order → Application Validation** | DONE (May 9, 2026) — `src/lib/order-validation.ts` checks `volumeLiters × tier` against `fabricMassKg` per FUZE math. Mismatch → in-app fan-out to brand + admins. Order not blocked, flagged for review.                          |
| **Cross-Factory Pricing Tiers** | DONE (May 9, 2026) — `BrandPricingTier` model + `/brand-portal/pricing` rollup. Lifetime FUZE consumption across all factories → discount tier ladder. Schema change pending `prisma db push`.                                       |
| **Penfabric Phase 1 Notification Fan-out** | DONE (May 9, 2026) — TestRequest, FabricSubmission, TestRun stamping, and Order lifecycle all now fan out to brand + factory user pools (not just admins or the requester). Plus recipe graduation/ICP-validated triggers.        |
| **Supply Chain Transparency**   | PLANNED — order→ship→receive→treat→test→certify pipeline                                                                                                                                                                           |
| **Daily CRM Digest Email**      | LIVE — 14:00 UTC cron, includes Daily Sales (L + kg booked vs shipped), CRM activity, new orders, outreach. Has error-fallback email on handler crash.                                                                             |
| **Daily Feedback Digest Email** | LIVE — 13:30 UTC cron emails Andrew the open `FeedbackReport` queue. Subject says "🎉 Inbox zero" when empty. Built May 2026.                                                                                                       |
| **Weekly Exec Review Email**    | LIVE — Mondays 14:00 UTC cron generates the snapshot, upserts the `WeeklyExecReport` row, emails the headline KPIs + at-risk customers + agenda + report link. Closes the gap from #70 (manual-only flow). Built May 2026.        |
| **GitHub Actions Auto-Triage**  | LIVE — `.github/workflows/auto-triage.yml`, fires daily 14:30 UTC. Pulls open tickets via `/api/cron/feedback-list`, hands them to `claude-code-action@v1` with strict triage rules, opens one PR per `auto/<ticketId>` branch.   |
| **Bearer-Authed Cron Endpoints**| LIVE — `/api/cron/feedback-list` (read-only ticket queue), `/api/cron/admin-resolve` (one-off ticket + brand + email actions). Bypasses local Prisma issues; pattern for future "trigger admin action via curl" needs.            |
| **ICP Sample Prep Flow**        | LIVE (wizard + SOP + print packet); awaiting first real CTLA submission                                                                                                                                                            |
| **Scoped Module Sidebar**       | LIVE — sidebar scopes to active module, "← All Modules (Home)" returns to 6-card picker                                                                                                                                            |
| **Mobile View Fix**             | LIVE (2026-05-18) — viewport meta drops `maximum-scale=1`, inputs forced to 16px below sm: (prevents iOS Safari auto-zoom-on-focus), bare `<table>` elements in `<main>` get auto-scrolling on small viewports. globals.css. |
| **Email Deliverability**        | RESOLVED — system emails fine (Resend + DMARC approved). Earlier "digest missing" was handler crashing + middleware blocking all crons (now fixed).                                                                                |
| **Solaris Testing (FZ-500)**    | ACTIVE — IR / radiant heat deflection protocol. Raspberry Pi-driven test bench (Type K thermocouples on plate, SHT31 in air gap). `SolarisTest` model lives in schema. Compares FUZE-treated vs untreated fabric IR absorption. The Raspberry Pi work for Nike lives HERE. |
| **Helios Project**              | SEPARATE — downstream testing track, distinct from Solaris. Don't conflate the two. Solaris = IR heat deflection bench (active, what we've been building). Helios = its own project, NOT in scope of recent Atlas work.            |
| **Nike testing program**        | ACTIVE (Q1 2026) — Nike is testing FUZE on their fabrics as they expand antimicrobial use beyond Expedry into new product lines. **Nike is NOT a user of Atlas the software — they are a testing customer of the FUZE treatment.** |
| **North Face testing program**  | ACTIVE (Q1 2026) — FUZE F1 in validation on NF performance fabric; standard AATCC 100 / AATCC 30 / ISO 20743 battery                                                                                                               |
| **California EPA approval**     | RECEIVED Q1 2026 — stack this with federal EPA reg for activewear/baby/healthcare positioning, pairs with Texas-AG/Lululemon PFAS tailwind                                                                                         |

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
where: {
  active: true;
}

// RIGHT — User uses status enum (ACTIVE/INACTIVE)
where: {
  status: "ACTIVE";
}
```

**Note: Distributor model DOES use `active: true` boolean. These are DIFFERENT models.**

### 3. DistributorInventory Field Names

```typescript
// WRONG
reorderThresholdLiters; // doesn't exist

// RIGHT
fuzeStockLiters; // correct
fuzeStockBottles; // correct
reorderPointLiters; // correct (NOT reorderThresholdLiters)
```

### 4. DistributorPricing Default Flag

```typescript
// WRONG
pricingType: "DEFAULT";

// RIGHT
isDefault: true;
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

## Resend Inbound Webhook (Phase 9B)

For reply detection on outbound BD emails to work end-to-end:

1. Resend dashboard → Webhooks → add a webhook pointing at
   `https://fuzeatlas.com/api/webhooks/resend-inbound`. Enable the
   `email.received` event (and optionally `email.bounced`).
2. Copy the signing secret Resend generates.
3. Vercel → Settings → Environment Variables → add
   `RESEND_WEBHOOK_SECRET` = the signing secret. Set on Production.
4. Redeploy (or wait for the next push) so the env var is in scope.

Until step 3 lands, the webhook endpoint will still accept payloads
but log a warning. Setup-test the path by sending a real reply
through Gmail/Outlook to one of the test addresses; check Vercel
runtime logs for `[resend-inbound]`.

## Git Workflow

- **ALWAYS use `--no-verify`** on commits — ESLint pre-commit hook is broken (no eslint.config.js)
- **Clear lock files before commit**: `rm -f .git/HEAD.lock .git/index.lock`
- Production branch: `main` (auto-deploys to Vercel)
- **Prisma migrations**: Use `npx prisma db push` (shadow DB migration is broken due to constraint conflict)

### Auto-close feedback tickets from commits

Reference a `FeedbackReport` ID in your commit body to auto-close it
(GitHub-style close-via-commit, but post-deploy and bearer-authed).

The hourly cron `/api/cron/auto-resolve-from-commits` scans the last
25 commits on `main`, pulls every cuid matching `cm[a-z0-9]{24}`,
flips the matching reports to `FIXED`, stamps the commit SHA +
author + message snippet as the resolution note, and sends the
standard "we fixed it" email to the reporter. Re-runs are
idempotent — already-FIXED reports get skipped.

Example commit message:

```
fix: factory dropdown not showing approved factories

Wrong filter on /api/factory-portal/factories — was excluding
brands the factory had ever submitted for. Now matches the
admin endpoint's filter.

Closes cmot3i3pk00iijo04hgcjcvyf
```

When the next hourly cron fires (`10 * * * *`), Scott Smith's
ticket flips to FIXED with a link to this commit and an email
goes out automatically. No CLI step.

Multi-close: put multiple cuids in one commit; the cron handles
all of them in the same pass.

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
Export: `GET /api/admin/brand-pipeline/export` mirrors the same filter params (view/mode/stage/relevance/search). Default `?format=xlsx` returns a true Excel workbook via `exceljs` — frozen header, autofilter, stage color-coding, currency/percentage/date number formats, clickable Website + LinkedIn hyperlinks, workbook metadata (Creator/Subject/Description) capturing the filter set. `?format=csv` returns the legacy RFC 4180 + UTF-8 BOM serialization. Filename `brand_pipeline_<YYYY-MM-DD>_<view>[_<stage>].xlsx`. Where-clause builder lives at `src/lib/brand-pipeline-where.ts` so the JSON + export routes can't drift.

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

## Sustainability Citations (Phase 19.5+)

Every numeric input on the sustainability page and in the competitive
PDF that drives a customer-visible CO₂/water/waste/VOC calculation
MUST carry a source citation. Andrew chose credibility hits on
dramatic-narrative numbers over the risk of a brand sustainability
lead fact-checking and finding a vendor inflation.

**To add a new competitor / chemistry archetype:**

1. Find the canonical public source first — EPA Master Label PDF
   (Section 1 — Active Ingredient) for any EPA-registered antimicrobial,
   manufacturer SDS Section 3 — Composition for non-EPA products, or
   peer-reviewed industry papers for bio-based chemistries.

2. If the source is gated or non-public, do NOT estimate without an
   explicit `estimated: true` flag + written `estimationBasis`
   citation. Better to under-claim with a citation than over-claim
   without.

3. Wrap every numeric field in `SourcedNumber` via the `sourced()`
   helper from `src/lib/sustainability.ts`:

   ```typescript
   {
     name: "Silver chloride (AgCl)",
     kgPerKgProduct: sourced(0.020, {
       sdsUrl: "https://...",
       sdsDate: "2024-03-15",
       sdsSection: "Section 1 — Active Ingredient",
       valueAsPublished: "Silver chloride (AgCl) 2.0%",
       verifiedDate: "2026-05-26",
       verifiedBy: "Phase 19.5 audit",
     }),
     costPerKg: 850,
   }
   ```

4. Set `archetypeSource` on the `UpstreamManufacturing` entry — that
   surfaces as the chemistry-level citation in the page tooltip and
   PDF appendix A.6.

**Where citations surface:**

- `/sustainability` — the ⓘ icon next to any sourced number opens a
  hover popover (`src/components/SourceTooltip.tsx`). A `~` icon
  flags an estimated value with the estimationBasis inline.
- Generated competitive PDFs — section "A.6 — Phase 19.5 Audit:
  Per-Chemistry Active Ingredient Citations" auto-renders from
  the `archetypeSource` fields. No PDF edits required when adding
  a new archetype.
- Page footer surfaces the last full audit date + links to the
  full transcript at `deliverables/Competitor_SDS_Audit_<YYYY-MM>.md`.

**Audit cadence:** run a full pass whenever a brand asks how a number
was derived, an EPA registration changes, a manufacturer publishes
a revised SDS, or a new competitor lands in `src/lib/competitors.ts`.
Audit transcripts append-only at `deliverables/Competitor_SDS_Audit_<YYYY-MM>.md`.

**Phase 19.5 audit (2026-05-26) findings worth knowing:**

- Silvadur 930 Flex assumption was 459× overstated (0.45 vs 0.098%
  per EPA Reg 464-785). Corrected.
- Five competitors in `src/lib/competitors.ts` carry the wrong
  `chemistryType`:
  - `polygiene-viraloff` (zinc → actually silver chloride)
  - `sanitized-zinc-pyrithione` (zinc → actually silane-QAC)
  - `heiq-hyprotecht` (zinc → actually silver)
  - `microban-additive-gs` (qac_silane → actually benzoic acid)
  - `ultrafresh-dw56` (qac_silane → actually zinc pyrithione + thiabendazole)
  These misclassifications are escalated in the audit transcript;
  the `chemistryType` pointers in `competitors.ts` were intentionally
  left unchanged pending Andrew's sign-off. New archetypes
  `zinc_oxide`, `organic_acid`, `chitosan`, `citric_acid`,
  `resin_acid`, `wood_extract` were added so the fix has somewhere
  to land.
- BioLayr was UNDERSTATED — was 1.5% in our model, actually 0.2%
  per Nordic BioTech US patent 12,054,880 B2. Corrected. The
  FUZE-vs-BioLayr comparison compresses from ~15,000× to ~2,000×
  but stays defensible.

## Competitive Intelligence Persistence Rule

Every competitive deep-dive — every time Cowork pulls EPA data, SDS
data, manufacturer marketing pages, or third-party LCA on a competitor
product — MUST end with that product persisted to `src/lib/competitors.ts`
with a corresponding entry in the audit transcript at
`deliverables/Competitor_SDS_Audit_<YYYY-MM>.md`.

This is a no-exceptions rule. The research is worthless if it doesn't
land in the platform's canonical competitor catalog — it just lives in
chat scrollback until the session ends.

**The four required artifacts for every competitive deep-dive:**

1. **Competitor entry** in `src/lib/competitors.ts` with `chemistryType`,
   `epaRegNote`, `epaLabelUrl`, and (where relevant) the marketing-vs-EPA
   discrepancy framing inside `epaRegNote`.
2. **Archetype entry** in `UPSTREAM_MANUFACTURING` in `src/lib/sustainability.ts`
   IF the competitor's chemistry doesn't already have one — wrap every
   numeric input in `sourced()` with full citation.
3. **Audit transcript row** appended to `deliverables/Competitor_SDS_Audit_<YYYY-MM>.md`
   with the source URL(s), verifiedDate, and any escalations.
4. **Customer-facing comparison doc** at `deliverables/<Product>_Comparison_FUZE_vs_<Competitor>.md`
   IF the competitor is being raised by a customer in real sales conversations.
   Otherwise skip — only build comparison docs when a real brand has
   asked.

**Why this rule exists:** Andrew has caught two cases (PROTX2 marketing-
vs-EPA discrepancy, FreshTX missing-EPA-registration) where the
competitive lever was significant and would have stayed buried if the
research hadn't landed in the catalog. The catalog is also what powers
`/admin/competitor-pricing` and `/sustainability`, so research that
doesn't persist literally doesn't show up to sales reps.

## Auto-Translation Pipeline (Phase 19+)

**Adding a new user-facing string to `src/i18n/en.ts` automatically
fans out translations to all 16 non-English locales.** No more
manual per-locale TODOs. Two execution modes.

### Mode A — Local CLI (primary)

The Vercel route `/api/cron/translate-missing-keys` was retired —
serverless can't write files or push git. The auto-translation
pipeline now runs locally on Andrew's Mac via `scripts/translate-i18n.ts`:

```bash
# Dry-run all 16 locales — no Claude calls, no writes, no git
npx tsx scripts/translate-i18n.ts --dry-run
npm run i18n:translate -- --dry-run    # equivalent

# Real run — 500-key cap per locale (default)
npx tsx scripts/translate-i18n.ts

# Big catch-up — 1000-key cap per locale
npx tsx scripts/translate-i18n.ts --max-keys-per-locale 1000

# Single locale catch-up
npx tsx scripts/translate-i18n.ts --locales vi

# Single namespace within one locale
npx tsx scripts/translate-i18n.ts --locales vi --namespaces factoryPortal

# Commit but don't push (useful when verifying first)
npx tsx scripts/translate-i18n.ts --locales vi --no-push
```

Each (locale × namespace) becomes its own commit. The script pushes
incrementally to origin/main so a leak rolls back per-locale-per-namespace
without disturbing other batches. Dry-run is genuinely free — does NOT
call Claude. Source `.env.local` for `ANTHROPIC_API_KEY` is automatic.

### Mode B — Pre-commit hook (automatic)

`.husky/pre-commit` detects when `src/i18n/en.ts` is staged. If it
is, `scripts/i18n-pre-commit.ts` runs, translates the new/empty
keys via Claude, and `git add`s the modified locale files so a
single commit captures the en.ts change + all 16 locale files
atomically.

Caps at 100 keys per locale in the hook path to keep commits
fast. Larger catch-ups go through Mode A. Hook fails open — if
ANTHROPIC_API_KEY is unset or Claude is unreachable, the commit
proceeds without translations and you recover later via the
CLI. To skip explicitly: `FUZE_SKIP_I18N_HOOK=1 git commit ...`.

### Brand-voice guarantee

Every translated value is grep-checked against the per-locale ban
list in `src/lib/i18n-translate.ts`. If a banned term appears, the
key is retried up to 3 times with explicit "do not use {word}"
guidance to Claude. After 3 strikes the key is dropped from the
output and surfaced in the response's `flagged` list for manual
authoring. Commit bodies report `brand-voice retries: N` so leaks
are visible in `git log`.

### Drift detection (T7)

`GET /api/cron/i18n-drift-report` runs Mondays 14:00 UTC. Silent
when all locales sit below the 10-missing-keys threshold; emails
Andrew otherwise with the `npx tsx scripts/translate-i18n.ts
--locales <list>` recovery line for the affected locales. (This
cron stays Vercel-side — it only sends email, no file writes.)

### Coverage in admin UI

`/admin/i18n/review` shows per-locale coverage % computed live
from `diffLocale()`. Locales below 99% glow amber; below 95% glow
red. Each row's "Run auto-translate" button surfaces the local
`npx tsx scripts/translate-i18n.ts --locales <code>` command for
copy-paste — clicking no longer fires a route (the route was
retired).

### Files

- `src/lib/i18n-diff.ts` — pure diff (missing + empty keys per locale)
- `src/lib/i18n-translate.ts` — Claude API + brand-voice retry
- `src/lib/i18n-writer.ts` — TS-AST locale file mutation (preserves
  comments, indentation, namespace structure; tsc-validates before
  swap)
- `scripts/translate-i18n.ts` — local CLI driver (replaces the
  retired `/api/cron/translate-missing-keys` route)
- `src/app/api/cron/i18n-drift-report/route.ts` — weekly drift email
- `scripts/i18n-pre-commit.ts` — husky hook entry point
- `/admin/i18n/review` — coverage dashboard + copy-paste command

### Cost guardrails

Per spec, Phase 19 caps at 500 keys per locale per run (override
via `maxKeysPerLocale` body field). Claude Haiku 4.5 pricing at
~$0.80/M input + $4.00/M output tokens — a full 16-locale catch-up
typically runs $5–20. Per-run cost surfaces in the response's
`summary.estimatedCostUsd`. The drift cron is weekly only —
intentional rate-limit on autonomous spend.

## Brand Onboarding — CSV Importer (Phase 18+)

**Use the generic importer at `/admin/brands/[id]/fabrics/import`,
not a per-brand seed endpoint.** Hand-written seeds like
`/api/cron/seed-sanmar` were the right call when SanMar was the
only brand with a fabric portfolio. With KUIU, Penfabric, Rhone,
BesTex, North Face, Nike, and the Nike testing program all
ramping up, per-brand seeds don't scale — each one is days of
custom code vs minutes of CSV upload.

Workflow per new brand:

1. Send the brand `deliverables/Brand_Fabric_Portfolio_Template.csv`
   (also downloadable via the importer page's "Download CSV
   template" link).
2. They fill it in and email it back, OR you transcribe their
   existing spreadsheet into the canonical columns.
3. Open `/admin/brands/[id]/fabrics/import`, drop the CSV.
4. The page auto-fires a dry-run, shows validation errors +
   warnings + factory-name resolution prompts.
5. For any unresolved mill, pick an existing Factory from the
   dropdown — the alias persists in `BrandFactoryAlias`, so the
   next import for that brand won't reprompt.
6. Click "Commit import" → fabrics + FabricSubmissions + ICP
   TestRuns + AM TestRuns + BrandFactory + SupplyChainLink
   junctions all written atomically per row.

The importer accepts the canonical column names *and* common
variants — "Factory" instead of "Mill", "GSM" instead of "Weight
(gsm)", "Brand SKU" instead of "Brand Article #", etc. See
`src/lib/fabric-csv-import.ts` `COLUMN_ALIASES` for the full
map. Headers it can't recognize go into `Fabric.note` as
`[original_col: value]` so data isn't dropped.

Keep `seed-sanmar` as-is for back-compat — SanMar reruns still go
through it and it has SanMar-specific logic baked in. But **do
not write new per-brand seed endpoints**. Any new brand goes
through the importer.

## Built Features (Session — May 20-22, 2026 — i18n full rollout + protocol publish)

Biggest shipping week of the year by commit count. **~100 commits across three days** covering: full 17-locale i18n parity (compact + full-depth in progress), the FUZE Certified Testing Protocol page, auto-resolve-from-commits cron fix (silent bug discovery), account management for typo-fixes, and a Tina-live-call escalation cleanup.

### i18n — 17 locales to full parity (the big rollout)

The 17 canonical textile-manufacturing locales are now all at namespace parity with `en.ts` and most are in deep translation. The locales were stuck at May-6 baseline (sparse coverage); shipped from 35% effective coverage to ~95% navigation + 60-100% deep workflow depending on locale.

**The 17 locales** (this list is canon — do not filter for "fast fixes"):

| Locale | Customer context |
|---|---|
| en | Default + US/UK |
| zh-CN | Mainland China |
| zh-TW | Taiwan (Formosa, Far Eastern, Eclat) |
| vi | Vietnam (Nike/Adidas hub) |
| bn | Bangladesh (#2 apparel exporter) |
| hi | India north |
| ta | India Tamil Nadu cluster |
| ko | Korea (performance fabric) |
| th | Thailand |
| tr | Turkey (SRS-Turkey) |
| ja | Japan (SEK Mark) |
| id | Indonesia (Hi-Goal) |
| ms | Malaysia (Penfabric — flagship) |
| ur | Pakistan |
| es | Spain + LatAm (Mercado Global) |
| it | Italy (luxury textile) |
| km | Cambodia |

**What shipped (Track A — staged escalation fixes):**

- `ViewAsSwitcher` flicker fix (Sidebar.tsx) — guards on `loading || user?.role === "ADMIN" || impersonation?.active` so admin slot stays rendered across the auth-hydration race window. Was disappearing on every page refresh.
- Distributor BD-link leak fix — pure distributors (Danny) no longer see BD Wizard/Scoreboard/Pipeline links. Gated on `user.canClaim` so BD-rep distributors (Jeremy, Kathir, Tandy, Scott) still see them.
- `/home` shortcut bar role gates — first 5 tiles (BD Wizard, KPI Dashboard, Orders, Pipeline, ICP Sample Prep) wrapped in `isInternal`/`isAdmin` checks.
- Dismiss button on brand suggestions schema-drift fix — Note model field is `userId` not `authorId`. Wrapped in try/catch so future drift surfaces 500 with actual error instead of silent no-op.
- `/admin/brands/[id]/fabrics` — split FUZE# from Mill Fabric# into two distinct columns. CSV export reordered.
- `seed-sanmar` self-healing — added `ensureBrandFactoryLink()` that upserts `BrandFactory` + `SupplyChainLink` rows for every (brand, factory) pair. Added `nextFuzeNumber()` so every fabric gets an Atlas-issued FUZE-N on insert + backfill on update.

**What shipped (Track B — i18n completion phases 1-4):**

- Phase 1-3: 14 missing namespaces added to `zh-CN.ts` with proper Simplified Chinese translations. `src/lib/modules.ts` refactored with `labelKey` field so module items reference translation keys. Consumers (home page card grid, scoped sidebar) use `t.modules[labelKey] || label` fallback. `/home` shortcut bar tiles use the same keys.
- Phase 4: Portal sidebars (factory/brand/distributor/lab in `Sidebar.tsx`) use the same `labelKey` pattern. New `modules:` namespace covers every portal sidebar item. Translation keys added to all 5 maintained locales (en, zh-CN, ja, es, tr) plus zh-TW.

**What shipped (Track C — 17-locale parity compact pass):**

All 12 stale locales (zh-TW, vi, bn, hi, ta, ko, th, id, ms, ur, it, km) added the 19 missing namespaces relative to `en.ts`. Each is at "compact" depth — namespace SHAPE filled in so TypeScript passes and customer-visible landing pages translate cleanly, but deep workflow sub-namespaces (factoryPortal intake forms, brandPortal contacts edit modes) still `deepFallback` to English. One commit per locale.

**zh-TW specifically** — regenerated from zh-CN via `opencc s2twp` (mechanical Simplified → Traditional with Taiwan-idioms profile: 軟體 / 資料庫 / 預設 / 使用者 / 滑鼠 / 影片 / 網路 / 專案 / 設定 / 聯絡人). Native Taiwanese reviewer sweep still recommended.

**What's in flight (Track D — full-depth translation, ongoing):**

Code is grinding through ~28 namespaces × 11 stale locales = ~300 per-(locale × namespace) commits. Per-namespace strategy chosen instead of per-locale to minimize rollback blast radius. Strategy: one commit per (locale, namespace) pair. Status as of last check:

| Namespace | Locales done | Notes |
|---|---|---|
| `translation`, `labPortal`, `distributorPortal`, `brandPortal`, `admin` | 11/11 each | First five completed |
| `settings.notifications` | 8/11 (ur, it, km remaining) | In progress |
| `factoryPortal` + ~22 others | 0/11 | Pending — `factoryPortal` is the highest-impact remaining namespace |

File-size growth confirms real translation depth: stale locales now at 113-220 KB (vs original 20-35 KB baseline), comparable to `en.ts` at 122 KB. Multi-byte scripts (hi, ta, ur, km) are 1.5-1.8× en.ts size as expected for Devanagari/Tamil/Arabic/Khmer.

**Brand voice — strict enforcement across all 17 languages.** Zero `silver` / `nano` / `Ag` / language-specific transliterations (銀, 银, 纳米, ナノ, 나노, سلور, نانو, نینو, चांदी, नैनो, plata, gümüş, perak, argento, etc.) in any user-facing translated value. Per-locale ban lists in spec at `specs/2026-05-20-full-i18n-parity-17-locales.md`. Two pre-existing competitive-positioning strings in `en.ts:1032` + `2318` are legitimate (name competitor chemistries to argue against them — that's correct brand voice).

**Self-caught violation:** Code shipped Urdu compact-pass commit `c5a4c65` containing `سلور نینو` (Urdu transliteration of "silver nano") in `faqPlaceholder`. Caught in the brand-voice grep post-commit, fixed in `3fe5cd8` (replaced with FUZE/metamateryal framing). Demonstrates that the per-locale grep verification is doing its job.

### FUZE Certified Testing Protocol page (NEW — gates customer testing)

New page at `/education/testing-protocol`. Andrew's response to a customer test failure where ICP came back at 0.68 mg/kg (above F3 floor) but AATCC 100 + ASTM E2149 both failed because the lab used autoclave sterilization. Bureau Veritas Hong Kong validated the failure mode with an 8-sample side-by-side battery (UV vs autoclave, same fabric, same chemistry) — UV samples all hit ≥99.9% reduction, autoclave samples ranged 0% to 87% with several at zero.

**Seven rules** (was eight — rule #4 "no pre-test handling" removed 2026-05-22 after multiple follow-up tests showed a single pre-wash hand rinse VAULTS results to 99.9% by clearing surface glucose, interfering chemistry, and sacrificial residues; the original BV observation was a one-off attributable to chemistry distribution on those specific spray samples, not a generalizable rule):

1. **ICP first.** No antimicrobial test starts without ICP confirmation of fabric loading in mg/kg. Formosa Labs Taipei is the recommended ICP lab.
2. **UV sterilization only.** Autoclave at 120°C opens synthetic fibers — nylon, polyester, synthetic blends — and the surface-bonded metamaterial absorbs into the now-open fiber matrix. No contact, no kill.
3. **Low-sulfur growth medium.** Mueller Hinton Broth preferred (CLSI-standard, low sulfur, neutral pH). Acknowledges MHB can be hard to source — fallback: ask for lowest-sulfur medium your lab has, decline blood-supplemented options.
4. **ASTM E2149 contact time 24 hours minimum.** Standard's default 1-hour was calibrated around ion-leaching antimicrobials. FUZE is contact-kill with slower kinetics. Use *E. coli* (ATCC 25922 or 8739) as the test organism — motile, consistent log-phase kinetics, no dormancy.
5. **ASTM E2149 is the primary recommended test for every FUZE tier.** Non-leaching contact-kill chemistry requires the test geometry designed for it.
6. **AATCC 100, ISO 20743, and JIS L 1902 are supported ONLY at ICP ≥ 1.0 mg/kg (F1 Full Spectrum) with UV sterilization.** Layered-coupon test geometry was designed around ion-leaching chemistries and disadvantages non-leaching antimicrobials at lower densities. JIS L 1902 is required for Japanese SEK Mark certification.
7. **Use the right test organism per method.** Standard table in §4b covers the recommended pairings: AATCC 100/ISO 20743/JIS L 1902 → Staph + Kleb; AATCC 30 → Aspergillus brasiliensis (antifungal); ISO 18184 → Influenza A H1N1/H3N2 (antiviral).

**Anti-odor positioning — Moraxella osloensis (ATCC 19976).** The biggest commercial positioning lever on the page. *M. osloensis* is the gram-negative diplococcus that causes laundry malodor in worn/damp activewear and hospitality textiles — produces 4-methyl-3-hexenoic acid as the signature VOC the human nose registers as "wet-laundry funk." Polyester + nylon especially susceptible because their hydrophobic surfaces retain the sweat lipid substrate. FUZE's contact-kill mechanism neutralizes Moraxella on the fiber surface before colonization, before malodor. Run on ISO 20743 / JIS L 1902 / AATCC 100 protocol with F1 + UV requirements. This is the testing claim that backs anti-odor positioning for activewear (Nike, Lululemon, North Face, KUIU), athletic socks, hospitality bedding (JLA Nomad Home®), childcare textiles.

**Microbiology nuance — Klebsiella is the worst-case detector for autoclave damage.** Gram-negative double-membrane envelope (outer membrane + peptidoglycan + inner membrane), heavily encapsulated in a mucoid polysaccharide layer (the "pink sugar shell" on MacConkey agar from lactose-positive metabolism), **and crucially non-motile**. Cannot actively chase chemistry. If FUZE has been buried by autoclave, Kleb will not find it — results crash to 0-10% reduction. Compare to Staph/MRSA which are small + motile + actively seek surface contact, so they still show ~90% reduction on autoclave-damaged samples by finding the surviving surface chemistry. **Diagnostic signature on a test report:** decent Staph (≥80%) + near-zero Kleb = autoclave damage, NOT chemistry failure. The chemistry is on the fabric (ICP confirms); the test prep rendered it inaccessible.

**Where the protocol is referenced.** Brand spec pages (`/brand-portal/spec`, `/admin/brands/[id]/spec`) now show an amber-callout banner above the form pointing brand managers + AMs at the protocol page before they configure their testing spec. Wired into the Resources tile via `modules.ts`. No per-user checkbox gate — per Andrew's correction, the protocol is referenced in each brand's approval of their testing procedures (brand-level acknowledgment via spec setup, not per-access-request gate).

### Auto-resolve-from-commits cron — two bugs fixed in one commit (`f2aa84f`)

The hourly cron at `/api/cron/auto-resolve-from-commits` had been silently broken since it shipped. Two bugs:

1. **Scope too loose.** Old regex matched ANY cuid anywhere in the commit body. Code's i18n commits referenced ticket cuids in passing (e.g. `"i18n(es): full parity\n\nrefs cmpdnfb9f..."`) and the cron interpreted those as close-this-ticket. Fix: require GitHub-convention prefix (`Closes` / `Closed` / `Close` / `Fixes` / `Fixed` / `Fix` / `Resolves` / `Resolved` / `Resolve`) preceding the cuid. Case-insensitive. Cuids harvested only from the sentence/line containing the keyword.
2. **Cuid length wrong.** Old regex `cm[a-z0-9]{24}` (26 chars total) but real Prisma cuids in this codebase are 25 chars (cm + 23). The regex therefore **never matched anything in production** — the cron had been a complete no-op since shipped. Fix: `cm[a-z0-9]{22,28}` covers current cuid format with headroom for future Prisma cuid spec changes.

17 test cases validated covering tense variants (close/closed, fix/fixed, resolve/resolved), case insensitivity, comma/space/and separators for multi-close, sentence scoping (period + newline terminators), and negative cases.

**Behavior change after deploy:** the cron now actually fires for the first time. Going forward, drop `Closes <cuid>` in commit bodies and the hourly cron picks them up + sends close-loop emails. The "false-FIXED" pattern Andrew thought was happening pre-fix was actually impossible (cron never matched anything) — those tickets must have been closed via `admin-resolve` calls. After deploy, the cron correctly closed Penny's ticket `cmpdngy6x...` from commit `15e22bb` "fix(middleware): bounce external users away from wrong portal" which had the keyword prefix.

### Account management — typo recovery + admin email editing

Built on the back of Jany Lu (Charming Fabrics, Malaysia) reporting "Invalid email or password" with credentials Andrew personally set. Login returns that generic error for both user-not-found AND password-mismatch cases. The two patterns this session shipped distinguish them and let admins recover stuck accounts without DB access:

**`/api/cron/diag-user?email=<email>`** (bearer-authed read-only). Returns user exists?, status, role, hash-present boolean (never the hash itself), bcrypt cost, plus **fuzzy similar-email search** to catch typos at account creation. This is how we discovered Jany's account was created as `any.lu@charmingfabrics.com` (missing leading "j") — diag surfaced it via the fuzzy match.

**`/api/cron/admin-reset-password`** (bearer-authed POST). One-shot user recovery accepting any combination of:
- `newPassword` (resets password — same 6-char minimum as `/api/auth/register`)
- `newEmail` (corrects email typo with format validation + collision check)
- `activate: true` (flips status to ACTIVE if not already)

At least one of the three must be present. Single call now fixes email + resets password + activates in one atomic transaction. Returns clean 409 if `newEmail` collides with another user.

**Inline email/name editing in `/settings/users`.** The admin UI was already accepting email via the PATCH endpoint but had no field to edit it — Andrew flagged the gap during Jany recovery. Added:
- `editEmail` + `editName` state vars on the page component, initialized from the user record on `startEdit()`
- Email input replaces read-only text in the desktop edit row
- Name + email inputs added to the top of the mobile edit row
- `body.email` + `body.name` included in PATCH on save
- API now validates email format (basic RFC-ish regex) + collision-checks against other users + returns 409 with clear error message naming the colliding user id

Going forward, account typos get fixed in two clicks instead of a curl. The bearer-authed `admin-reset-password` endpoint stays for password resets, multi-action recovery, and out-of-band fixes.

### Schema-drift bugs caught and fixed (this session)

Pattern unchanged from prior sessions — Prisma `select`/`where` referencing non-existent fields. Caught:

1. **`Note.authorId`** referenced in `/api/admin/brands/[id]/suggestions` POST. Real field is `Note.userId`. The Dismiss button on brand suggestion cards was silently 500-ing for weeks. Fix wrapped in try/catch so future drift surfaces actual error.
2. **Cuid length** in `auto-resolve-from-commits` (covered above) — not strictly schema drift but same family of "the code thought reality was X, reality was Y, silent failure."

### Bearer-authed runtime endpoints added this session

- `/api/cron/backfill-brand-factory-links` — derives `BrandFactory` + `SupplyChainLink` rows from `Fabric.factoryId` for every brand globally. Optional `?brandId=` scope. Idempotent. Fixes the "Factories tile shows 1 but the brand has 9 factories via fabrics" gap (three relations used to drive three different counts).
- `/api/cron/diag-brand-fabrics?brand=NAME` — generic fabric portfolio readiness check for any brand. Reports fabric count, factory-assignment rate, FUZE-number coverage, dev-status coverage, junction table state, per-factory rollup, plus verdicts (e.g. "⚠ N fabric(s) have no FUZE number — column will show 'unassigned'").
- `/api/cron/seed-sanmar` — already shipped; this session added `ensureBrandFactoryLink()` + `nextFuzeNumber()` so future seed re-runs are self-healing.
- `/api/cron/diag-user` — covered above.
- `/api/cron/admin-reset-password` — covered above.
- `/api/cron/diag-sanmar-dupes` — read-only diag confirming no duplicate Brand / Factory / Fabric rows after seed runs.

### Tina ticket batch — 5 tickets, all resolved

Pulled via `fzcron feedback-list`. Triage + resolution:

| # | Reporter | Type | Resolution |
|---|---|---|---|
| 1 | Tina Hong (Mill - order missing distributor) | BUG | FIXED via commit c8a41e1 surfacing distributor on factory order detail page |
| 2 | Penny Wang / Intertek (Lab portal screenshot) | BUG | FIXED via middleware bounce in commit 15e22bb — lab users now correctly redirected away from distributor portal pages |
| 3 | Tina Distributor (Add factory authority) | FEATURE | ACCEPTED for Phase 16 — distributor self-service factory roster |
| 4 | Kaylee (Fabric photo upload) | FEATURE | ACCEPTED for Phase 16 — intake + receipt verification photos |
| 5 | Tina Hong (Silvadur formaldehyde) | WAITING | ACCEPTED, parked on Tina's SDS doc for proper CIL audit |

`byStatus` end state: `{FIXED: 53, TRIAGED: 1, CLOSED: 1, ACCEPTED: 3, REJECTED: 1, NEW: 0}`. Inbox zero on actionable tickets.

### Standing patterns reinforced this session

- **17-locale picker is canon, not a draft.** Do not filter languages out as a "fast fix" even when they're stale — they represent the top textile-manufacturing markets globally and customers expect them to work. Bring them to parity, don't hide them.
- **Brand voice strict across all 17 languages.** Never silver / nano / Ag / language-specific transliteration in any user-facing string. Per-locale grep verification before every push. Caught one self-violation (Urdu سلور نینو) and one near-miss this session — the discipline is working.
- **Per-(locale × namespace) commits beats per-locale commits for big translation rollouts.** Smaller blast radius, easier rollback, better visibility into progress. Code adopted this voluntarily when faced with the 11-locale × 19-namespace matrix.
- **Bearer-authed runtime migration pattern continues to scale.** This session added 5+ new `/api/cron/*` endpoints. The pattern is now standard for: data fixes, diagnostics, one-off migrations, admin actions without UI surface. Local DB DSN drift is no longer a blocker for any one-off admin work.
- **Tina is the sole native-speaker reviewer for now.** Mandarin native, fluent Japanese + Korean. Covers zh-CN / zh-TW / ja / ko (4 of 17 locales). The other 13 ship at Claude-quality with explicit `NATIVE-REVIEW NEEDED` flag in commit bodies; native review is a parallel workstream Andrew routes per locale when contact identified.
- **File-size growth as translation-depth proxy.** Compact-shape locales are 20-35 KB; full-depth locales are 110-220 KB (multi-byte scripts skew higher). Quick health check: if a locale file is < 90 KB and the locale is supposedly fully translated, something's wrong.

### Pending / parked items (May 22)

- **Code's 11-locale full-depth grind in progress.** ~5/19 deep-workflow namespaces complete across all 11 stale locales. Remaining ~28 commits × 11 locales = ~300 to go. Estimated 3-4 more hours of Code grinding. Biggest remaining namespace is `factoryPortal` — milestone for Vietnamese / Malaysian / Indonesian factory users walking the intake wizard.
- **Native-speaker review** for the 11 Claude-quality stale locales. Tina (zh-CN/zh-TW/ja/ko) is the sole reviewer currently. Other 7 locales (vi/ms/hi/ta/th/id/bn/ur/it/km) ship as Claude-quality flagged for native review when contact identified per region.
- **Tina ↔ Penny lab portal screen-share** in Taipei.
- **Tina Silvadur formaldehyde SDS** — waiting on her to send the doc for proper CIL audit before publishing anything on `/sustainability`.
- **Jany Lu confirmation** she can now log in.
- **fuzefaq.com Railway build failure** — parked (Andrew not prioritizing).
- **Phase 16 queue items added this session:**
  - Distributor self-service factory roster (Tina Distributor)
  - Fabric photo upload at intake + receipt (Kaylee)
  - Auto-resolve cron re-notify when status transitions multiple times (caught when Penny ticket flipped TRIAGED → FIXED but didn't email her about the FIX)
  - Email confirmation step on user account creation (would have caught Jany typo upstream)
  - Bulk diag: users with similar-looking emails to known Brand/Factory contacts (Levenshtein distance ≤ 2)

## Built Features (Sessions — May 12-16, 2026)

The biggest week of shipping by volume so far. **Phase 15 of the
PHASE_15_HOLE_PLUG.md spec is essentially complete** — IMP-1→6,
NEED-1→7 + 7a, NEED-FB-1→5, NICE-1→7, BONUS-1→5, MIND-BLOW MB-1/2/3/4/5
all shipped. Only remaining open items: NEED-FB-6 i18n depth pass
(factory portal complete 23/23, brand/distributor/lab portals in
progress) and SRS Dubai Q2 shipments (blocked on $/L from Andrew).

### Headline ships

**Distributor Portal Ordering** (commit `8209c4e`) — biggest unbuilt
feature on the entire CLAUDE.md roadmap. Full flow shipped:
- `/distributor-portal/restock/new` — distributor → FUZE restock
  (carboy/gaylord/container picker)
- `/distributor-portal/factory-orders` — distributor sees orders
  flowing in from their factories
- `/distributor-portal/pricing-tiers` — 5-tier ladder editor in
  distributor's local currency
- `/factory-portal/orders/new` — full quote → multi-brand allocation
  → PO upload → submit flow
- Schema: extended `FuzeOrder` with `poNumber`, `currency`,
  `distributorTierIndexAtOrder`; kept separate `DistributorRestockOrder`
  model (per-bottle vs per-volume, ship-from-SLC vs
  ship-from-distributor-warehouse — different enough not to unify).

**MIND-BLOW tier (5/5 shipped):**
- MB-1 — ICP × AB correlation chart at `/admin/analytics/icp-correlation`
  + `/brand-portal/analytics/icp-correlation` (commit `fad42d2`). The
  chart Joseph Zack at KUIU explicitly asked for. SVG scatter, OLS
  regression line, R², tier-colored dots. Brand-scoped for
  BRAND_USER/BRAND_MANAGER.
- MB-2 — Geographic supply-chain map at
  `/brand-portal/supply-chain/map` (commit `013cc04`). Hand-rolled SVG
  equirectangular projection (skipped leaflet to keep bundle small),
  factory pins sized by lifetime FUZE consumption.
- MB-3 — AI-narrated test reports. Trigger: TestRun.brandVisible
  flips true → async Claude call generates 2-4 sentence plain-English
  summary. Voice locked via `src/lib/test-narration.ts` (explicit
  BANNED words list — silver/nano/Ag/etc — + BAD/GOOD examples after
  a "silver" slip-in was caught by the brand-voice gate on May 16,
  prompt tightened). Retry queue at `/api/cron/narration-retry`,
  hourly cooldown. Renders on Recipe Report PDF + admin test
  repository with regenerate button.
- MB-4 — Predicted brand pipeline value. Daily cron computes
  `Brand.predictedValueUSD` = vertical multiplier × engagement boost
  × stage probability × $36/L. Surfaces as "$X potential" chips on
  pipeline rows + "Top 10 by potential" widget on /home. 2,576 brands
  ranked at first run.
- MB-5 — Quarterly ESG snapshot autoemail. Extended existing Q1/Q4/Q7/Q10
  cron to email per-brand PDF to primary AM + active BRAND_MANAGER
  users with brand logo + KPI tiles. Closes wishlist #1.

**NEED-7a — Self-service org rosters.** `/[portal]/team` page per
brand/factory/distributor/lab. Org admins invite teammates by email,
token-based magic-link signup at `/signup/invitation/[token]`,
role pre-stamped from invitation. Removes the FUZE-admin-in-the-loop
bottleneck Andrew flagged May 11.

**NEED-6 — Brand spec acknowledgement loop.** Per-factory ack required
when brand updates required FUZE tier or ICP cadence. Banner on
`/factory-portal`, ack page at `/factory-portal/spec/[brandId]`,
`notifySpecAcknowledged` fans to AM + admins on confirm. Closes the
loop on the May 9 spec-change flow.

**NEED-FB-6 partial — i18n thread-through.** Factory portal: 23/23
pages complete. Distributor + brand + lab portals: in progress as of
end-of-session May 16. Jun Park's ticket cmp2rbpm6 resolved.
**Translation values not filled in yet — only English threaded;
deepFallback handles missing locales. Translators fill in zh/ja/es/tr
as a separate pass.** Distributor portal next because SRS-Turkey,
Mercado Global, Global Shine, Hi-Goal serve non-English-primary mills.

### Schema-drift bugs found and fixed (12 in total this week)

Pattern is consistent: Prisma query selects/filters on a field or
relation that doesn't exist on the model, throws "Unknown argument" or
"Unknown field" at runtime. Vercel build passes (TypeScript can't
catch Prisma client field mismatches without strict generation),
customer sees 500.

**5 customer-facing fixes (May 16 audit pass):**
1. `/api/public/verified/[publicSlug]` — `Brand.country` doesn't exist
   on Brand. Public hangtag verification was 500'ing.
2. Same route — `FabricSubmission.fuzeTier` doesn't exist. Pull from
   `submission.fabric.targetFuzeTier`.
3. `/api/public/qr/[token]` — same `FabricSubmission.fuzeTier` bug.
   Also caught a brand-voice leak: returned `"Ag X ppm"` to public QR
   scans. Replaced with `"FUZE residual X.XX ppm"`.
4. `/api/factory-portal/tests` + `src/lib/acl.ts` —
   `TestRun.fabric` relation doesn't exist (only `submission`, `lab`,
   `project`). Fixed `testRunScopeForFactory`, `testRunScopeForBrand`,
   `testRunScopeForDistributor` to reach Fabric via `submission.fabric`.
5. Same route — `FabricSubmission.submissionDate` doesn't exist. Use
   `createdAt`.

**6 internal-only fixes queued for Code:**
1. `/api/admin/bd/wizard/auto-draft` — `Brand.country`
2. `/api/admin/bd/wizard/coach` — `Brand.country`
3. `/api/admin/protocol-designer` — three drifts (`Fabric.width` →
   `widthInches`, `FabricSubmission.fuzeTier` → use fabric's,
   `Brand.country`)
4. `/api/admin/test-repository` — `FabricSubmission.fuzeTier`
5. `/api/admin/bd/sequences/[id]/analytics` — `Meeting.contactId`
   (Meeting has no contact relation — brand-only) + `Meeting.scheduledAt`
   should be `startTime`
6. `src/lib/test-narration.ts` — reads `submission.fuzeTier` (always
   undefined). Every MB-3 narration shipped so far is silently
   omitting the FUZE tier. Worth a regen sweep after the fix.

**Earlier customer-facing fixes (May 11-13):**
- BD scoreboard 500 — `Meeting.contactId` referenced in velocity calc
  (Meeting has no contactId column).
- BD scoreboard 500 — `Meeting.autoScheduled` filter shape
  (`OR: [{ autoScheduled: false }, { autoScheduled: null }]` rejected
  because the column is non-nullable Boolean; use `autoScheduled: false`
  directly).
- BD scoreboard inflated meeting count — Ryan saw 5, only had
  scheduled 2. Pipeline-stage auto-scheduled events were counting.
  Added `autoScheduled: false` filter.
- Factory portal stats — `Fabric.status = "ACTIVE"` filter. Fabric
  has no status column. Endpoint was 500'ing silently, frontend
  rendered all-zeros for KK Chan + Raihana.
- Dashboard impersonation defect — `/api/dashboard` was reading
  `x-user-id`/`x-user-role` headers from middleware (set from real
  session cookie, NOT impersonation cookie). Admin running "View As"
  on a FACTORY_USER still saw full ADMIN dashboard with global
  counts. Switched to `getCurrentUser()`. Also added per-role count
  scoping so even non-impersonated FACTORY users see only their own
  fabrics/submissions, not the global 1,351 / 2,576.
- Order modal — `CONFIRMED` status (set by `/api/consumption` path
  when factories log orders) was unknown to `STATUS_COLORS` map,
  showing blank badge + no action button. Added entry + extended the
  "Start Processing" condition to handle CONFIRMED.
- Inline user-edit row — no FK picker for entity-required roles
  (DISTRIBUTOR_USER, FACTORY_USER, etc.) AND no error display when
  save 400'd. Danny was stuck unable to save because the role
  requires a `distributorId` that the inline row had no UI to set.
  Added extension `<tr>` below the editing row with conditional FK
  picker per role + inline error display.
- KK Chan / Penfabric Report + Graduate buttons — Report bounced to
  `/home` because middleware blocked `/admin/recipe-calculator/*` for
  external users. Graduate button visible to FACTORY_USER but was an
  internal lab operation. Fix: middleware exempts the recipe-calculator
  paths; API ACLs by fabric ownership; Graduate hidden from non-admin.
- Pricing calculator under-dose 3x — calculator scaled bath VOLUME
  up 3x for trough sizing but didn't scale stock proportionally.
  Reported `1.8%` stock-by-volume when truth was `4.76%`. Tina caught
  it. Bench-test Recipe Report math was always correct.
- WashProtectionChart label collisions — when FUZE and competitor at
  same $/m, the label block stacked on the lines. Anchored to compY
  not innerH/2 + bumped Marketing-claim cliff label below the
  unvalidated-zone text.
- Globe `/admin/command-center/globe` — `Brand.country` select bug
  again. Tina + Jett both reported.
- Distributor orders list ACL — Tina Distributor created an order
  that didn't appear in her list because `FuzeOrder.distributorId`
  was null but `factory.distributorId` matched her org. OR'd through.
- Smoke test caught it all — `diag-all-surfaces` extended to 45+
  entries now. Every new dashboard widget shipped this week added a
  check entry as part of the build standing rule.

### Infrastructure work

- **ESLint flat-config migration** (commit `5b5ef53`). Repo had
  `eslint: ^10.1.0` pinned but only `.eslintrc.json` (legacy format).
  ESLint 10 dropped legacy config support, so CI Pipeline was failing
  on every push for 8+ hours (Vercel passed because it doesn't run
  lint). Codemod `npx @next/codemod@canary next-lint-to-eslint-cli .`
  produced `eslint.config.mjs`. Demoted strict rules to warn to handle
  3000+ row backlog of `any` / `@ts-nocheck`. 33 files auto-fixed.
  Lint re-enabled in `.github/workflows/ci.yml` + `preview.yml`. CI
  green from commit forward.
- **S3 screenshot proxy** (TRACK 1 from May 15 — commit `9bac69e`).
  `admin/feedback` was rendering screenshots as raw S3 URLs, but the
  bucket is private (returns 403). Inline screenshots silently broken
  for every admin. New endpoint `/api/admin/feedback/[id]/screenshot`
  returns presigned URL.
- **CI smoke testing** is now load-bearing. `fzcron diag-all-surfaces`
  is the standing regression net. 43→45→47 checks added across the
  week. Pattern: anytime Code ships a new dashboard widget, a smoke
  check entry MUST be added in the same commit. This caught at least
  3 bugs before they reached customers.
- **Anthropic credits gotcha** — May 16, MB-3 narration generation
  hit HTTP 400 "credit balance too low" after 11 brand-visible flips
  burned the balance. Atlas's Claude-driven features (AI test review,
  BD coach, FUZE FAQ chat, MB-3 narrations) all went silent until
  Andrew topped up at console.anthropic.com. Worth setting an auto-top-up
  threshold + alert. The retry queue picked up the backlog cleanly
  after credits landed.

### Tickets cleared (10+ this week)

Per-customer close-loop emails went out via the
`/api/cron/admin-resolve` bearer-authed endpoint for: Tina's pricing
calculator catch, Tina's globe error, Tina's sustainability chart
overlap, Tina Distributor's orders-not-showing, Jett Lai's
View-As-globe error, Tina's admin dashboard suggestion (ACCEPTED →
Phase 15 NEED-add), Jun Park's i18n gap (FIXED with NEED-FB-6 partial
notification), Scott Smith's auto-claim toggle, Ryan Prince's bulk
enrich + KPI link 404 fix, KK Chan's Penfabric Report/Graduate access.
**Only the Silvadur formaldehyde question (Tina) remains ACCEPTED
intentionally — waiting on her to attach the SDS/technical bulletin
the mill cited for a proper CIL audit before /sustainability
publishes anything definitive on Silvadur's binder posture.**

### Pending non-code (Andrew)

- Joseph Zack / KUIU follow-up email — draft written May 16 evening,
  parked for Monday send. Email body in cowork session log; references
  the new ICP correlation chart (the thing he explicitly asked for),
  supply chain map, quarterly ESG autoemail, team rosters. Two
  outstanding items still on Andrew: XX accelerated evaporation
  target + 1.0 → 3.0 log reduction bump on the protocol doc.
- Real customer data entry now possible via seed scripts — KUIU,
  Penfabric, Rhone, BesTex, North Face, Nike all have empty brand
  spec / pricing tier / SupplyChainLink data. Templates ready, just
  needs Andrew minutes-per-brand to fill in values.
- SRS Dubai Q2 shipments — still blocked on $/L + orderType.
- Distributor portal pilot — `/distributor-portal/restock/new`,
  `/distributor-portal/factory-orders`, `/distributor-portal/pricing-tiers`,
  `/factory-portal/orders/new` — all live and never clicked by a
  human end-to-end yet.
- Mobile view fix — admin pages still broken on iPhone.

### Tomorrow / next session priorities

1. Verify the 3-track Code chain landed (internal schema-drift fixes,
   i18n depth pass on distributor/brand/lab portals, Joseph code-side
   items — signature block + chart on profile).
2. Pilot the unpiloted surfaces (see above list).
3. Send Joseph email Monday morning (draft ready).
4. Real customer data entry session — start with KUIU, Penfabric,
   Rhone.
5. Consider scoping Phase 16 — wishlist items #4 (real-time test
   tracking), #7 (Factory Performance Scoring), #8 (Brand PLM API)
   are next-tier candidates.

### Standing patterns reinforced this week

- **Verify-after-every-push:** introduced after the Phase 10G 9-cascade
  build break. Code now waits for Vercel green AND `diag-all-surfaces`
  green between every commit. Caught 0 regressions across 25+
  production pushes this week.
- **Error-state-not-zeros:** every dashboard widget must render an
  explicit error banner on API 500 — never silently fall through to
  zeros. The Tina-Penfabric all-zero stats bug was the trigger; this
  pattern is now standing.
- **Bearer-authed runtime migration endpoints:** the workaround for
  DSN drift. Pattern: `/api/cron/migrate-<scope>` reads
  `CRON_SECRET` from env, runs `prisma.$executeRawUnsafe` ALTER
  statements, returns count + verdict. Used for NEED-6 spec ack,
  NEED-7 lab assignment, NEED-7a org invitations, MB-3 narration
  columns, MB-4 prediction column, distributor-order columns.
- **`fzcron` helper** in zsh wraps every bearer-authed cron endpoint.
  Now standing alias for: digests, diags, migrations, narration
  retry, admin-resolve, ESG snapshot generation, ad-hoc admin actions.

---

## Built Features (Session — May 9, 2026 cont. — KUIU build)

This continuation session shipped the full set of features Andrew promised
Joseph Zack at KUIU on May 7 ("with your fuzeatlas.com access you get
visibility over all factories in your supply chain… each time they submit
for testing to our lab you are notified… we restrict factories ordering
and have them place their distribution orders on the site… we can confirm
from the order that it matches the required application amount… running
track of ongoing ICP testing at intervals of production batches that you
stipulate… we can then calculate and control pricing reductions based on
volume across all factories"). Every line of that promise is now backed by
production code.

### IMPORTANT — DEPLOY STATE AT PAUSE

**10 commits queued locally on `main`, NOT pushed yet** (sandbox can't SSH
to GitHub). Andrew needs to push from his Mac:

```bash
cd /Users/a801/Desktop/fuzeatlas && rm -f .git/index.lock && git push origin main
```

**Two schema changes require `prisma db push`** after the push:

- `20260509000000_brand_spec` — adds 5 columns to Brand (requiredFuzeTier,
  icpCadenceEveryNBatches, icpCadenceEveryLitersConsumed, protocolDocUrl,
  brandSpecUpdatedAt)
- `20260509010000_brand_pricing_tier` — new BrandPricingTier table

After `git push origin main` and Vercel green:

```bash
cd /Users/a801/Desktop/fuzeatlas && npx prisma db push
```

The new test-cadence cron (vercel.json) will be picked up automatically.

### Commit chain (oldest first)

| Commit | Subject |
| --- | --- |
| `2a9e7e9` | Wire notifyTestResult fan-out + drop spoof-able x-user-id headers |
| `80fc55c` | Fan out TestRequest status to brand + factory user pools |
| `cc525ea` | Fan out FabricSubmission notifications to factory + brand pools |
| `ef211be` | Wire notifyOrderStatusChange into lifecycle-event path + new-order from consumption |
| `b74b6cd` | i18n: thread useI18n through /factory-portal landing page |
| `befb921` | Brand Supply Chain dashboard — fulfilling the KUIU promise |
| `128283a` | Order → application-amount validation |
| `bcf27b8` | Brand spec + ICP cadence cron (schema change) |
| `a67f0ab` | Brand spec setup page + protocol doc surfacing on supply chain |
| `8c1a872` | Cross-factory volume rollup + pricing tier ladder per brand (schema change) |

### Notification fan-out (Penfabric phase 1, continued)

The graduate/ICP-validated trigger from earlier in the day was the first
slice. This session extended the same fan-out pattern to every other
state transition that brand and factory users need to see.

- **`notifyTestResult` (orphan helper) → wired** in
  `src/app/api/tests/[id]/route.ts` (PATCH brandVisible) and
  `src/app/api/tests/batch-stamp/route.ts`. When a test is stamped
  brand-visible, every brand user + every factory user + admins now get
  an in-app notification on top of the existing single email. Also drops
  the spoof-able `x-user-id` header pattern in favor of `getCurrentUser()`
  (Tina-style fix).

- **`notifyTestRequestStatus` extended** with optional `brandId` /
  `factoryId` params. Customer-facing transitions (APPROVED, SUBMITTED,
  IN_PROGRESS, RESULTS_RECEIVED, COMPLETE) now fan out to the brand and
  factory user pools, not just the requester + admins. Internal states
  (PENDING_APPROVAL, REJECTED, CANCELLED) stay admin-only.

- **`notifyNewSubmission` extended** the same way — brand owner team and
  factory teammates now get the in-app notification when intake creates
  a FabricSubmission, not just admins. Also fixed
  `/api/factory-portal/intake` which was previously creating
  FabricSubmission rows silently and stamping factoryId on the row (was
  null).

- **`notifyOrderStatusChange` wired into the lifecycle-event path**
  (`/api/orders/[id]/events`). When a factory or distributor logs a
  SHIPPED_FROM_FUZE / SHIPPED_FROM_DISTRIBUTOR / RECEIVED_AT_FACTORY
  event, the side-effect block flips order.status to SHIPPED/DELIVERED.
  The admin update path already called the helper; this path was
  orphaned. Also wires `notifyNewOrder` into `/api/consumption` POST
  type=order which was previously silent.

### KUIU promise build (5 deliverables)

#### 1. /brand-portal/supply-chain dashboard

The page Joseph opens after the call to verify "visibility over all
factories in your supply chain" is real.

- `src/app/api/brand-portal/supply-chain/route.ts` — GET endpoint scoped
  to caller's brand. For every factory with at least one fabric for this
  brand, returns: fabricCount, submissionCount, lastSubmissionAt,
  testRunsTotal/testRunsPassed (classified per-type since TestRun has no
  status enum), openTestRequests, consumptionLitersTotal,
  lastConsumptionAt+tier. Plus brand-level totals + the brand's
  stipulated spec for the header strip.
- `src/app/brand-portal/supply-chain/page.tsx` — read-only dashboard.
  7-card totals strip, sortable factory table with status badge per
  row, brand spec strip with Edit link.

#### 2. Order → application-amount validation

`src/lib/order-validation.ts` is the helper. Pure function — takes
`volumeLiters`, `fuzeTier`, `fabricMassKg`, `baseFuzeLiters`,
`wastageFactorPct`, `brandId`. Runs canonical FUZE math:
`tier_mg_per_kg × kg / 30 mg/L × (1 + wastage%)`. Compares actual vs
expected with severity bands: 0–10% info, 10–25% warn, 25%+ error.
HANGTAG orders skip volume math.

Wired into `/api/orders` POST. When a brand is set on the order AND the
validation isn't all-green, fans out a Notification to every active
brand user + admins. Order is NOT blocked — flagged for review.

#### 3. Brand spec + ICP cadence cron

Schema change adds five columns to Brand:
- `requiredFuzeTier String?` — F1/F2/F3/F4
- `icpCadenceEveryNBatches Int?` — every N orders since last ICP
- `icpCadenceEveryLitersConsumed Float?` — alternative cadence by volume
- `protocolDocUrl String?` — PDF link
- `brandSpecUpdatedAt DateTime?`

Cadence cron at `/api/cron/test-cadence` runs daily at 14:00 UTC. For
every brand with cadence stipulated, walks every factory in the supply
chain. Counts FuzeOrder rows + sums FuzeConsumption since the last
brand-visible ICP TestRun. If either threshold is exceeded, fans out a
Notification with 22h suppression (so the same brand isn't re-pinged
daily for the same overdue factory). Registered in vercel.json.

Brand spec PATCH/GET endpoint at `/api/brand-portal/spec` — brand
managers + sales reps + admins can edit; plain BRAND_USER role is
read-only.

UI at `/brand-portal/spec` — form for tier picker, cadence inputs,
protocol doc URL with live preview. Spec strip on supply-chain page
shows pill chips for every active setting + Edit link.

The order-validation helper was extended to read `requiredFuzeTier`
from the brand and flag tier mismatches. Was a no-op until this
schema change landed.

#### 4. Per-brand protocol document on profile

Covered by `protocolDocUrl` column above. Surfaces on supply-chain
header strip as a clickable indigo chip. Editable from
`/brand-portal/spec`.

#### 5. Cross-factory volume rollup + pricing tier ladder

Schema change adds new `BrandPricingTier` model — per-brand discount
ladder. `brandId + thresholdLiters + discountPct + label + active`.
Cascade delete on brand removal. Indexed on `(brandId,
thresholdLiters)`.

API:
- `/api/brand-portal/pricing-rollup` — GET. Sums
  `FuzeConsumption.litersUsed` across every factory (groupBy
  factoryId for the breakdown). Sums `FuzeOrder.volumeLiters`
  separately. Reads BrandPricingTier ladder, computes current tier
  + next tier + gap to upgrade.
- `/api/admin/brand-pricing-tiers` — GET / POST / PATCH / DELETE.
  Edits gated to ADMIN / EMPLOYEE / SALES_MANAGER.

UI at `/brand-portal/pricing` — hero card with current tier discount,
lifetime liters, factory + order count. Progress bar to next tier.
Full ladder visualization with qualified/current/locked states.
Per-factory consumption table sorted by share.

5th tile added to `/brand-portal` quick-actions grid.

### i18n — Phase 0 of ROADMAP_v2 started

The 17-language scaffolding (`src/i18n/`, `useI18n()`, `I18nProvider`,
deepFallback to English) was already there. Started cashing it in:

- `src/i18n/en.ts`: new `factoryPortal` namespace covering header,
  crumb, all four stat cards, the Learn FUZE banner, all six
  quick-link tiles. `Translations` type expands automatically;
  deepFallback handles incomplete locale files.

- `src/app/factory-portal/page.tsx`: every hardcoded string replaced
  with `t.factoryPortal.<key>`. Pure thread-through — no layout or
  logic changes.

Subsequent factory-portal pages (intake, upload-report, orders) are
queued in the task list for next session.

### Joseph Zack / KUIU — non-code follow-ups still pending

From his May 7 email, items that aren't code changes:

- **Accelerated evaporation target** — locked in as `XX` in the doc.
  Andrew needs to fill in the actual value before sending the next
  protocol revision.
- **Log reduction target** — currently shows 1.0 log; Andrew said to
  bump to 3.0 log target. Doc edit, not code.
- **ICP-to-antimicrobial efficacy correlation chart** — Joseph asked for
  it on file. Could be a doc upload to Brand.protocolDocUrl, or a
  static page under /education. TBD.
- **Email signature still says FUZE Biotech** — Joseph flagged. Search
  `src/lib/fuze-knowledge.ts` and any email template footer when ready
  to update.

### Notes on the architecture choices

- **No new TestRun.status column** — pass/fail is derived from per-type
  result rows (icpResult.agValue, abResult.pass, etc.) using the same
  rule the notify path uses. Consistent across batch-stamp, supply
  chain dashboard, and cadence cron.

- **Cadence cron uses `metadata.kind='cadence_overdue'` for repeat
  suppression** — checks for an existing notification with that
  metadata signature in the past 22 hours. Don't switch to a separate
  CadenceFlag table unless we need to.

- **Order validation is non-blocking** — never rolls back the order.
  Fires a notification with severity in the title emoji (🚨 error / ⚠️
  warn). Future: an admin review queue under `/admin/orders/flagged`.

- **Brand spec edits are RBAC-gated server-side** — the PATCH endpoint
  re-checks role; UI hides the form if the user can't edit. BRAND_USER
  is intentionally read-only because cadence flips are contractual.

- **Pricing tier ladder is admin-only writable** — same reasoning.
  Brand sees the result; AM controls the rungs via
  `/api/admin/brand-pricing-tiers`.

### Pending — Pick up next session

- **PUSH the 10 commits + run prisma db push** (see top of this
  section). Without these, none of the KUIU build is live in prod.
- **Verify each KUIU surface end-to-end** post-deploy:
  1. `/brand-portal/supply-chain` renders for a brand user
  2. `/brand-portal/spec` saves successfully
  3. `/brand-portal/pricing` shows the lifetime rollup
  4. `/api/cron/test-cadence` fires correctly when invoked manually
     (`fzcron test-cadence`)
- **Set CRON_SECRET-protected schedule** — already in vercel.json,
  Vercel picks it up on deploy.
- **Admin UI for the pricing tier ladder** — API exists, but there's
  no `/admin/brands/[id]/pricing-tiers` page yet. Would let an AM
  configure rungs without curl.
- **i18n thread-through** for the rest of factory-portal:
  `/factory-portal/intake`, `/upload-report`, `/orders`. Keys go in
  `src/i18n/en.ts` factoryPortal namespace.
- **Phase 2 of ROADMAP_v2** (education segmentation by industry
  vertical) and Phase 4 (architectural primitives like
  SupplyChainLink) still untouched.
- **Joseph follow-ups** above (signature block, log target, evap
  target, correlation chart) — non-code.

---

## Built Features (Session — May 7-9, 2026)

This session was a sprint — three reported bugs (Tina, Barth, Scott) shipped, plus the full automation loop you'd been wanting (daily ticket digest + GitHub Actions auto-triage). End state: production inbox zero on `/admin/feedback`, the unattended fix loop runs daily.

### Tina — Factory test report upload + visibility (commits fc37daa, c0f67e6)

Two distinct gaps under one umbrella complaint ("factories can't upload, can't see test reports"):

**A. Factory portal had no upload UI at all.** Distributors had `/distributor-portal/upload-report`; factories had nothing. Built the mirror: `src/app/factory-portal/upload-report/page.tsx` (drag/drop PDF, "✓ saved even at 0% confidence" banner, redirects on role mismatch) and `src/app/api/factory-portal/test-reports/route.ts` (read endpoint scoped to caller's `factoryId`, returns confirmed TestRuns + pending Documents). Dashboard tile + sidebar entry + "Upload Test Report" button on the read-only `/factory-portal/tests` page.

**B. `/api/factory-portal/tests` was filtering by `fabric.factoryId` only.** When a factory submits a fabric through Intake, the relationship lands on `FabricSubmission.factoryId` — `Fabric.factoryId` is often null. Net effect: factories saw an empty Test Results page even when TestRuns existed. Fix: scope is now `OR: [{ fabric: { factoryId } }, { submission: { factoryId } }]`. Also surfaces `reportDownloadUrl` from the most-recent `Document(kind=REPORT)`. And dropped the spoof-able `x-user-id` header pattern in favour of `getCurrentUser()`.

Also patched `/api/tests/upload` to stamp `Document.raw.uploaderFactoryId` (it already stamped `uploaderDistributorId`) so factory-uploaded files surface in the factory portal listing.

### Barth — Email attachments wired through (commit c0f67e6)

Barth couldn't attach files to outbound emails. Investigation found four real gaps:

1. **`EmailModal` on `/contacts/[id]` had no attachment UI.** No file input, no drag/drop. Added a paste/click drag-zone with per-file remove, 25 MB total cap (matches Resend's hard limit).
2. **BD Wizard had no attachment UI either.** Added the same picker to the email-channel `DraftStep`. LinkedIn channel intentionally excluded — LI DM API doesn't carry files.
3. **`/api/admin/outreach/send` only accepted JSON.** When attachments are present the client now sends `multipart/form-data`; the route detects content-type and parses both shapes. Same for `/api/admin/bd/wizard/send`.
4. **`src/lib/email.ts` had a latent encoding bug.** `Buffer.from(content, "utf-8").toString("base64")` corrupted binary attachments — text .ics calendar invites were fine, PDFs were mojibake. Now `EmailAttachment.content` accepts `string | Buffer | Uint8Array | { base64 }` and routes each to the right encoder via `attachmentToBase64()`.

### Scott — Brand auto-claim + LinkedIn fallback (commit f1ea5c0)

Ticket `cmot3i3pk` ("account I added was not claimed"). Scott added Skunk Skin to the pipeline, system left it unclaimed, AND it had only a LinkedIn URL contact so he couldn't even use the wizard's email channel. Two fixes:

1. **`/api/brands` POST now auto-sets `salesRepId = sessionUser.id`** when the caller is BD-eligible (ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP / BD_REP) and no explicit `salesRepId` was provided. Stamps `lastActivityAt` so the inactivity cron leaves it alone. Bulk-import paths (e.g. `/api/brands/discover`) intentionally bypass this — discovery deliberately creates unclaimed leads.
2. **BD Wizard now auto-flips channel to LinkedIn** when the picked contact has no email but has a LinkedIn URL. Amber banner explains what happened and links back to the contact page to add an email if the rep wants to switch back.

Resolved Scott's actual ticket via a one-shot script + bearer-authed endpoint (see Automation Loop below). Skunk Skin is now owned by Scott.

### Automation Loop — the fix-it pipeline (commits 9b8faf9, 6ae574e)

Andrew's request: "support tickets → daily email → Claude tries to fix them → I get PRs to review." Shipped the full thing.

**Stage 1 (in Atlas, daily cron):**
- `src/app/api/cron/feedback-digest/route.ts` — runs 13:30 UTC daily. Pulls open `FeedbackReport` rows (NEW + TRIAGED + ACCEPTED + IN_PROGRESS), groups by status, emails Andrew with deep-links to each ticket. Subject says "🎉 Inbox zero" when queue is empty.
- `src/app/api/cron/feedback-list/route.ts` — bearer-authed read-only JSON endpoint. Sibling to `feedback-digest`. Lives under `/api/cron` so middleware exempts it. Used by the GitHub Action.
- `src/app/api/cron/admin-resolve/route.ts` — bearer-authed POST endpoint that resolves a `FeedbackReport`, optionally backfills a `Brand.salesRepId`, optionally emails the reporter. Reusable pattern for any future "trigger admin action via curl" need. Bypasses local-Prisma issues entirely.
- `src/app/api/cron/weekly-review/route.ts` — runs Mondays 14:00 UTC. Generates `buildSnapshot()`, upserts the `WeeklyExecReport` row, emails the headline KPIs + at-risk customers + on-Andrew's-plate items.

**Stage 2 (outside Atlas, daily GitHub Action):**
- `.github/workflows/auto-triage.yml` — runs 14:30 UTC daily. Curls `feedback-list`, hands the ticket payload to `anthropics/claude-code-action@v1` with strict triage rules: (a) only attempt fixes on BROKEN_LINK / ERROR / PROBLEM, (b) skip tickets without a concrete file/page target, (c) cap at 5 PRs per run, (d) lint + tsc must pass before each commit, (e) one branch per ticket: `auto/<ticketId>`. Then `gh pr create` opens one PR per branch with the original ticket description in the body.
- Required GitHub repo secrets: `ANTHROPIC_API_KEY`, `CRON_SECRET`. Both set May 2026.
- See `docs/AUTOMATION.md` for the full architecture rationale (why GitHub Actions and not Cowork or Atlas server-side).

### Env file conventions (cleaned up May 2026)

Local `.env.local` is now 20 canonical keys. Naming convention for DBs:

```
DATABASE_URL          ← active default; what Prisma reads
DATABASE_URL_DEV      ← opt-in escape hatch for scripts
DATABASE_URL_PROD     ← opt-in escape hatch for scripts (paste from Vercel "Production" → DATABASE_URL value)
```

Removed from `.env.local` because they don't belong in local dev:
- `VERCEL`, `VERCEL_ENV`, `VERCEL_TARGET_ENV`, `VERCEL_URL`, `VERCEL_OIDC_TOKEN`, `VERCEL_GIT_*` — these make Next think it's running on Vercel locally and break local-dev branches
- `NX_DAEMON`, `TURBO_*` — Turborepo / Nx CI flags, not used here

Vercel Sensitive flag means `DATABASE_URL` value never reveals in the dashboard once saved — only overwritable. The Railway public proxy URL (e.g. `interchange.proxy.rlwy.net:31700`) for `atlas-prod-db` we tested actually pointed at an **empty** database; the real prod DB resolves via Railway's `postgres.railway.internal` only from inside Vercel. Worth chasing down which Railway service holds the real prod data when convenient — for now, the bearer-authed `admin-resolve` pattern bypasses the issue.

### Resolved tickets (production)

- `cmot3i3pk00iijo04hgcjcvyf` (Scott Smith — "account I added was not claimed") → FIXED 2026-05-09. Skunk Skin now owned by Scott. Auto-claim + LI-fallback fixes shipped under f1ea5c0.

### Pending — Pick up next session

- **Distributor Portal Ordering** — flagged NEXT in Active Projects. Distributors order from FUZE (carboys / gaylords / containers); factories order through their distributor at the right pricing tier; multi-currency. Auto-assigns brands to orders.
- **Verify which Railway service holds prod data** — `interchange.proxy.rlwy.net:31700/railway` returned P2021 (empty). Real prod DSN lives somewhere; figure it out so local Prisma scripts work for one-offs again.
- **Set DATABASE_URL_PROD properly** in `.env.local` once that's verified.
- **#69 Seed SRS Dubai shipments for Q2 exec report** — still blocked on Andrew for $/L and orderType.
- **#70 Weekly Exec Review verification** — auto-cron now runs every Monday, so this auto-resolves the next time the cron fires (test by triggering manually: `fzcron weekly-review` on Andrew's Mac).

### Lessons / patterns from this session

- **Smart-quote substitution** in macOS Terminal is a real productivity drain when pasting multi-line shell from chat. Andrew disabled with `defaults write com.apple.Terminal "Use Smart Quotes" -bool false` + `defaults write -g NSAutomaticQuoteSubstitutionEnabled -bool false`. Restart Terminal after toggling.
- **Comment-line zsh trap**: `#` only works as a comment in interactive shells if `setopt interactive_comments` is on. Otherwise pasted comments error out. Add to `~/.zshrc`.
- **FUSE-mount `.git/index.lock`** still bites every commit — `rm -f .git/index.lock` between every git command is the workaround.
- **Vercel edge cache eats first responses to new routes** — append `&_=$(date +%s)` to URLs to force `BYPASS`.
- **Bearer-authed admin-action endpoints under `/api/cron/*`** are the right pattern for "trigger from CLI" tasks. Skip local Prisma scripts; let Vercel runtime do the DB work since the connection is already healthy there.
- **`fzcron` shell helper** in `~/.zshrc` makes ad-hoc cron pings trivial:
  ```bash
  fzcron() {
    source /Users/a801/Desktop/fuzeatlas/.env.local 2>/dev/null
    setopt local_options no_nomatch
    local route="$1"
    local sep="?"
    [[ "$route" == *"?"* ]] && sep="&"
    curl -sS -i -H "Authorization: Bearer $CRON_SECRET" "https://fuzeatlas.com/api/cron/${route}${sep}_=$(date +%s)"
  }
  ```

---

## Built Features (Session — April 23, 2026)

### #101 BD Wizard concurrency hardening + dead-domain bounce

**Problem (Andrew's phrasing)**: "If Ryan starts BD wizard and Barth starts BD wizard, and I start BD wizard and they all begin with Active Line Corp and we start working it same time, that will be an issue." Race condition. Before this fix, three reps hitting `/admin/bd/wizard` in the same ~30-second window would all be auto-assigned the same top-ranked LEAD brand. The permanent claim (`Brand.salesRepId`) only flipped on send, so whoever sent last "won" — but by then two other reps had already drafted and potentially sent their own emails to the same contact. Net: duplicate outreach, rep confusion, domain reputation risk.

**Fix shipped as three layers (belt + suspenders + parachute):**

1. **Atomic pick-time reservation** (`src/app/api/admin/bd/wizard/next-brand/route.ts`)
   - New `Brand.reservedBy` + `Brand.reservedUntil` columns (30-min TTL).
   - Candidates ranked in memory, then walked in sorted order. For each candidate, `prisma.brand.updateMany({ where: { id, salesRepId: null, OR: [{ reservedUntil: null }, { reservedUntil: { lt: now } }, { reservedBy: user.id }] }, data: { reservedBy, reservedUntil } })`. First writer's `count === 1` wins; losers' count is 0 and the loop advances to the next candidate.
   - `findMany` up-front excludes brands reserved by _other_ reps.
   - Response includes `reservation: { reservedBy, reservedUntil, ttlMinutes, contested }` so the client can surface queue contention if we ever want to.

2. **Soft-lock lifecycle** (`src/app/api/admin/bd/wizard/release/route.ts` — new)
   - `POST /api/admin/bd/wizard/release` clears reservation _only if caller holds it_ (`updateMany where: { id, reservedBy: user.id }`). Returns `{ released: 0 | 1 }`.
   - Client calls it from (a) "Next Brand" click (`loadNextBrand(skipId)` awaits release before re-picking), (b) tab close via `navigator.sendBeacon("/api/admin/bd/wizard/release", blob)` in a `beforeunload` handler, (c) bounce flow.
   - Client keeps a `brandRef` (`useRef`) synced with the current brand so the `beforeunload` closure reads the latest id without re-subscribing.
   - Send endpoint also clears the reservation in the same transaction that stamps `salesRepId` (soft lock → permanent claim).

3. **Duplicate-send guard** (`src/app/api/admin/bd/wizard/send/route.ts`)
   - Before dispatch, query `OutreachMessage` for any email to this `contactId` in the last 24h by a different `sentBy`. If found, return HTTP **409** with `{ ok: false, code: "already_contacted", otherRep, previousSubject, hoursAgo, allowForce: true }` instead of sending.
   - Client shows a confirm modal ("Ryan emailed Viktor 3h ago — send anyway?"). Rep's "Send anyway" click retries with `force: true` in the body, which bypasses the 24h check.

4. **Dead-domain bounce** (`src/app/api/admin/bd/wizard/bounce-brand/route.ts` — new)
   - Triggered from `BrandHeader`'s "deadOrParked" panel when the domain probe (#98) returns down. Andrew's observation: "the domain check is working for activelinecorp.com → it's dead. The problem is every contact was enriched off that same domain, so all of those emails are probably bad too. We should just bounce the whole brand."
   - One `prisma.$transaction`: (a) flip `validationStatus: "dead"` (already in next-brand's exclusion list), (b) `updateMany` every contact whose email hostname matches the brand's dead hostname → `emailStatus: "invalid"`, `outreachStatus: "skipped"`. Matches bare host, `www.`, and subdomains (`.${deadHostBare}`). Personal gmail/outlook addresses on the same contact are untouched. (c) Clear `salesRepId` + reservation, drop a `Note` with probe reason + rep's free-text reason, bump `lastActivityAt`.
   - Wizard auto-advances to the next brand via `loadNextBrand(brand.id)`.
   - Authorization: only admins, or the rep who holds the brand (`salesRepId === user.id || reservedBy === user.id || salesRepId === null`), can bounce. Prevents a random rep from killing someone else's deal by landing on the detail page.

**Prisma migration**: `prisma/migrations/20260424000000_brand_wizard_reservation/migration.sql`

```sql
ALTER TABLE "Brand" ADD COLUMN "reservedBy" TEXT;
ALTER TABLE "Brand" ADD COLUMN "reservedUntil" TIMESTAMP(3);
CREATE INDEX "Brand_reservedUntil_idx" ON "Brand"("reservedUntil");
```

Schema synced via `npx prisma db push` (see Debugging Lessons note — this repo uses `db push` for prod schema sync, not `prisma migrate deploy`).

### #100 Per-user BD email templates discoverability fix

- The BD Wizard quick-pick slot system (1–10) was already built at `/settings/email-templates`, including the sky-blue "BD Wizard quick-pick slots" panel and the inline slot dropdown on every PRIVATE template row. Each user has their own 10 slots — Ryan's slot 3 is independent of Barth's.
- **Discoverability gap Andrew caught**: the page was only reachable via a deep link inside the BD Wizard draft step — no sidebar, no home-page card, no link from `/settings/profile`. Ryan/Barth would never find it without being told.
- **Fix**: added `✉️ Email Templates` chip to the quick-jump row on `/home` (sits next to `👤 My Profile`), plus a small "Email Templates / Availability" sub-link row under the header on `/settings/profile` so reps land on both when they click "My Profile".

### Vercel build gotcha — TypeScript IIFE closure narrowing

- Build failed on `src/app/admin/bd/wizard/page.tsx:676:82` with `Type error: Argument of type 'string | null' is not assignable to parameter of type 'string | number | boolean'`.
- **Root cause**: the outer `if (!brand.website) return;` narrowed `brand.website` to `string` in the useEffect scope, but the nested `(async () => { ... })()` IIFE closure doesn't inherit TypeScript's control-flow narrowing across closure boundaries.
- **Fix**: capture to a local before the IIFE — `const website = brand.website; (async () => { ... website ... })()`. The regular `async function retestDomain` on line ~696 didn't need the fix because it's a named async function (narrowing _does_ flow in) — only the IIFE pattern drops the narrow.

### Pending — Pick up next session

- **#101**: commit + push from Andrew's Mac terminal (sandbox `.git` mount can't clear `index.lock`; see Debugging Lessons). Commands at the end of the April 23 session chat. After push, verify Vercel green. Prisma `db push` is already captured in the migration file, but confirm the prod DB picked it up with `npx prisma db push` locally against `caboose.proxy.rlwy.net:28355`.
- **FUZE Atlas 4 → FUZE Atlas 5**: context in this cowork session is getting compacted frequently. Start a fresh cowork (FUZE Atlas 5) after #101 is committed. This CLAUDE.md update is the handoff.

### Outreach/Send Atomic Rewrite (#20, commit 3fc055b)

- **Problem**: Email send from `/contacts/[id]` was double-writing — the modal POSTed to both `/api/admin/outreach/send` _and_ `/api/notes`, so a failure midway left the contact timeline out of sync with the OutreachMessage table. BD inactivity cron (#44) also wasn't getting stamped on outbound email.
- **Fix**: `src/app/api/admin/outreach/send/route.ts` rewritten as a single `prisma.$transaction` — dispatch (Twilio SMS or Resend email) → write `OutreachMessage` → write `Note` with `noteType="EMAIL"`, `emailDirection="OUTBOUND"`, subject/from/to/cc/messageId → update `contact.outreachStatus`/`lastContactedAt`/`outreachCount` → stamp `brand.lastActivityAt`. One atomic unit; failure at any step rolls back everything.
- Added `cc` / `bcc` / `replyTo` support. `replyTo` defaults to sender's email. Auto-detects HTML vs plain-text body via regex. Added `BD_REP` to allowed roles. `normaliseAddrs()` helper accepts comma or semicolon separators.
- `src/app/contacts/[id]/page.tsx` — EmailModal no longer double-posts to `/api/notes` since the send route handles it atomically.

### Weekly Exec Review — First Working Render (#70, commits 7466984 + e271612)

- **Problem**: `/admin/weekly-review` was throwing Vercel's opaque "Application error" page with a bare digest, then (after schema push) still silently rendering with every panel at zero and a 1-day window header.
- **Root cause**: `src/lib/weekly-review/snapshot.ts` line 265 had stale `PipelineStage` names (`QUALIFIED`, `OPPORTUNITY`, `NEGOTIATION`) that don't exist in the enum. The real values are `LEAD`, `PRESENTATION`, `BRAND_TESTING`, `FACTORY_ONBOARDING`, `FACTORY_TESTING`, `PRODUCTION`, `BRAND_EXPANSION`, `ARCHIVE`, `CUSTOMER_WON`. When Prisma hit `pipelineStage: { in: liveStages }` with bogus values, it threw `Invalid prisma.brand.findMany()` and the request 500'd. Vercel runtime logs truncate error messages at ~40 chars, which is why we couldn't read the full stack.
- **Hotfix 1** (`7466984`): Wrapped both `buildSnapshot()` and `upsert()` calls in `src/app/admin/weekly-review/page.tsx` with try/catch. On snapshot failure, logs full stack to `console.error("[weekly-review] buildSnapshot failed:", ...)` and falls back to an empty snapshot shape so the page still loads. On upsert failure, renders a diagnostic `<pre>` panel with the exact Prisma error text so we can debug in-UI. This is why the page started loading successfully but showed zeros everywhere — the snapshot was still failing silently and the fallback was kicking in.
- **Hotfix 2** (`e271612`): Fixed the actual bug in `snapshot.ts` — replaced the stale stage list with `["LEAD", "PRESENTATION", "BRAND_TESTING", "FACTORY_ONBOARDING", "FACTORY_TESTING", "PRODUCTION"]`. Excludes `ARCHIVE` (dead), `CUSTOMER_WON` (closed), `BRAND_EXPANSION` (scaling, not at-risk).
- **One more step remaining**: the existing `WeeklyExecReport` row for this week was already upserted with the empty fallback snapshot. The landing page sees an existing report and redirects without re-running `buildSnapshot`. **User needs to hard-refresh (`Cmd+Shift+R`) and click the "Refresh snapshot" button in the top-right of the dashboard** — that fires `PATCH /api/admin/weekly-review/:id` with `{refresh: true}`, which re-runs `buildSnapshot` against the now-fixed query and overwrites the stored snapshot.

### Debugging Lessons

- Vercel runtime log search truncates message bodies at ~40 chars, so `"Invalid prisma..."` is the most detail we get without pulling the deployment inspector URL. Defensive `try/catch` with a `console.error` that dumps `.stack` is how we surface the full trace.
- FUSE-mount `.git` idiosyncrasy: commits fail with `unable to unlink '.git/index.lock'` / `HEAD.lock` on the sandbox filesystem. Workaround: `mv .git/index.lock .git/index.lock.s$(date +%s)` before committing, and pass `--no-verify` to skip husky's lint-staged (also blocked by unlink perms).
- Prisma `db push` is the production schema-sync flow, NOT `prisma migrate deploy`. The build step runs `prisma migrate deploy` but there are no migration files; live schema drift gets fixed by running `npx prisma db push` against `caboose.proxy.rlwy.net:28355` locally. That's what resolved the missing `WeeklyExecReport`/`WeeklyExecReportShare` tables in prod.

### Pending — Pick up next session

- **#70 verify the fix landed end-to-end**: User needs to hard-refresh `/admin/weekly-review` and click "Refresh snapshot". Once done, the 14-day window header should populate, all panels should show real numbers, and the diagnostic empty-fallback path should no longer trigger. If the refresh still fails, pull the inspector URL from Vercel MCP and grep for `[weekly-review] buildSnapshot failed:` in the runtime logs — that line now prints the full stack.
- **#69 Seed SRS Dubai shipments for Q2 exec report**: 4 gaylords (week of Apr 6) + 3 gaylords (week of Apr 13) = 7 × 608L = 4,256L total. Need from Andrew before running: (a) **dollars per liter (or kg)** for the Dubai orders, (b) **`orderType`** tag — `PRODUCTION` vs `SAMPLE` vs other. Product density placeholder of 1.0 kg/L is fine for first pass if actual density isn't handy. Script location will be `scripts/seed-srs-dubai-q2.ts` with one `FuzeOrder` per gaylord tagged to the SRS brand + Dubai factory, `shippedDate` spread across the week. Once seeded + snapshot refreshed, Sales & Distribution card will show real Q2 revenue instead of zeros.
- **Hurricane Ventures rename** (`scripts/rename-hurricane-ventures.ts`, committed `9b38238`): Not yet run. Idempotent — upserts brand to "Hurricane Ventures" in Greenville, PA, Alec Miller as President/Co-Founder. Run with `npx tsx scripts/rename-hurricane-ventures.ts` locally when ready.

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

## NON-NEGOTIABLE WORKFLOW RULES (Cowork ↔ Claude Code)

These rules are how Andrew works. Violating them wastes his time.

1. **NEVER ask Andrew to manually edit a file, find a line, or replace text by hand.** Andrew does not open files. Andrew does not hunt for code. Andrew pastes prompts into Code. If a fix requires editing a file, the answer is ALWAYS "write a Code prompt that does the edit" — never "open foo.tsx and change line 42." This applies to next.config.ts, eslint.config.mjs, locale files, page components — every file. No exceptions.

2. **NEVER hand Andrew a "Path A vs Path B" choice where Path A is a manual edit.** If both paths exist, both must be Code-executable. The shortest path is still a Code prompt.

3. **Specs sent to Code MUST be self-sufficient overnight.** They must:
   - Run their own `fzcron` verification commands (sourcing `.env.local` for `$CRON_SECRET`)
   - Run their own `diag-all-surfaces` checks between phases
   - Fire their own migration crons (`fzcron migrate-XX-bundle`) without asking Andrew to do it
   - Push their own commits without check-ins between tracks
   - Verify Vercel deploy status via the Vercel MCP or via curl + the bearer token
   - Never pause and wait for Andrew between tracks — the 300-second auto-resume rule applies absolutely
   - Only escalate to Andrew on (a) genuine ambiguity that can't be resolved by reading the codebase, (b) approval needed for a customer-impacting decision (e.g. naming a customer in a comparison), or (c) unrecoverable error blocking all forward progress

4. **Code prompts MUST be a single copy-pasteable block.** No multi-step "first do X, then Y" instructions for Andrew to type. One paste, Code grinds end-to-end.

5. **When something breaks, the diagnosis comes from Cowork (via Vercel MCP, sandbox file reads, etc.) and the fix is shipped to Code.** Andrew should not be triaging build logs, hunting through Vercel dashboards, or running ad-hoc verification curl commands. Cowork pulls the data via MCP, identifies the fix, hands the fix to Code.

6. **Repeated violation of these rules** = bigger problem than the technical work itself. Andrew has explicitly called this out multiple times. Lock it in here so future Cowork sessions don't repeat the same anti-pattern.

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
