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
| **Standard bottle** | 19L |
| **Three methods** | Exhaust (dyebath), Pad-Dry-Cure, Spray (6" head spacing, 15 m/min) |
| **Liquid laser ablation** | Our production method — 30-amp laser on 1m² table, solar-capable, recycled electronics feedstock |

## Platforms
| Platform | What | Where |
|----------|------|-------|
| **FUZE Atlas** | Multi-portal Next.js app (Admin/Brand/Factory/Lab) | fuzeatlas.com, Vercel |
| **fuzefaq.com** | Public landing page + calculator + sustainability | Railway, fuzecost repo |
| **fuzeatlas repo** | github.com/fuze47101/fuzeatlas.git | Main branch = production |
| **fuzecost repo** | github.com/fuze47101/fuzecost.git | Main branch = Railway deploy |

## Company Info
| Field | Value |
|-------|-------|
| **Company** | FUZE Biotech |
| **Address** | 1895 West 2100 South, Salt Lake City, Utah 84119 USA |
| **Email** | andrew@fuzebiotech.com / andrew@801inc.com |
| **CAS Number** | 7440-22-4 (for compliance docs only) |

## Team
| Name | Role |
|------|------|
| **Andrew** | CEO/Founder, admin |
| **Tina** | Lab operations, manages testing with ITS/VL/FPC labs |
| **Kaylee** | Employee — reported email deliverability issues |
| **Danny, Kathir, Tandy** | Distributor roles (reassigned via /api/admin/reassign-user) |

## Active Projects
| Project | Status |
|---------|--------|
| **NY Hospitality Market** | Next week — QR codes on calculators → fuzefaq.com |
| **fuzefaq.com launch** | LIVE — needs terminology fixes, logo sizing |
| **Distributor Network Management** | BUILT — page + API + cleanup done, deployed pending push |
| **Lab Portal (Tina)** | BUILT — accept/start testing, set ETA, upload report, add notes |
| **Ongoing Tests Tracker (AM view)** | BUILT — /admin/ongoing-tests with filters, overdue alerts |
| **Dashboard Cards Linked** | DONE — all stat cards clickable to their pages |
| **View As / Impersonation** | NEXT — admin can view any portal as any role without logout |
| **Factory Sample Request Workflow** | PLANNED — see details below |
| **Mobile View Fix** | NEW — admin pages broken on iPhone |
| **Notification System** | NEW — department-based employee notifications |
| **Email Deliverability** | CRITICAL — all system emails going to spam |
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
select: { active: true }

// RIGHT — User uses status enum (ACTIVE/INACTIVE)
where: { status: "ACTIVE" }
select: { status: true }
```
**Note: Distributor model DOES use `active: true` boolean. These are DIFFERENT models.**

### 3. DistributorInventory Field Names
```typescript
// WRONG
fuzeStockLiters  // doesn't exist as stockLiters
stockKg          // doesn't exist
stockBottles     // doesn't exist
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

## Git Workflow
- **ALWAYS use `--no-verify`** on commits — ESLint pre-commit hook is broken
- **Clear lock files before push**: `rm -f .git/HEAD.lock .git/index.lock`
- Production branch: `main` (auto-deploys to Vercel)

## Distributor Data (Cleaned Up)
Only 7 real active distributors:
1. Harris & Menuk
2. SRS
3. SRS-Turkey (alias: Zen Kem Kimya)
4. Mercado Global (alias: POLIMEROS)
5. Global Shine
6. Texwell
7. Hi-Goal

**Honghao-Chemical is NOT Texwell** — they are separate entities.
All other distributors (Archroma, CHT, DyStar, Pulcra, etc.) are INACTIVE — they were chemical suppliers, not distributors.

## Built Features (This Session — April 7, 2026)

### Distributor Network Page (`/admin/distributors`)
- Summary cards, search, filter by region/status
- Expandable DistributorCard with inventory, coverage, contacts, factories, revenue
- Inline edit mode for all fields (name, country, region, city, address, email, phone, website, currency, coverage, status, notes)
- API: `/api/admin/distributors` (list), `/api/admin/distributors/[id]` (GET/PATCH/DELETE)
- Cleanup endpoint: `/api/admin/cleanup-distributors` (already run successfully)

### Lab Portal Enhancements (`/lab-portal/upload`)
- PendingTestsPanel with status grouping: Awaiting Accept / In Progress / Results Received
- TestCard component: Accept & Start Testing, Set/Update ETA, Upload Report, Add Note
- Progress bars, timeline dates, special instructions display
- API: `/api/lab-portal/test-actions` (accept, set_ready_date, link_report, update_status, add_note)

### Ongoing Tests Tracker (`/admin/ongoing-tests`)
- AM-visible dashboard: Total, Awaiting Accept, In Progress, Results Ready, Overdue
- Desktop table + mobile cards, search, status/lab filters
- Progress bars, ETA with overdue highlighting, days active
- API: `/api/admin/ongoing-tests` (scoped: AMs see their brands, Admins see all)

### Dashboard Improvements
- All stat cards now clickable → link to appropriate pages
- Distributor count fixed to only show active distributors
- Sidebar updated with Distributor Network + Ongoing Tests Tracker links

### User Reassignment (`/api/admin/reassign-user`)
- GET: lists all users with roles + all distributors
- POST: reassign user role and link to distributor/factory/brand/lab

## Pending Deployment
Commit `8db64c7` (params fix) is committed locally but **needs to be pushed**. Run from your machine:
```bash
cd fuzeatlas && git push
```
This unblocks ALL Vercel deployments. Production was stuck on `c9af2b8`.

## New Feature Details

### Factory Sample Request Workflow (PLANNED)
- Factory submits request → includes shipping account + approval → FUZE ships → tracking emailed back
- Shipping from regional distributor if available, otherwise direct from USA (SLC)
- Free samples — factory provides their shipping account #
- Onboarding flow after: upload fabric → dilution calculator → request testing

### Lab Test Report Upload (Tina Request — PARTIALLY BUILT)
- Labs log in and upload reports directly
- List of ongoing tests with expected ready dates visible to labs AND AMs
- Reports auto-filed and linked to correct test run/submission

### Mobile View Fix (PLANNED)
- Admin pages on iPhone: can't select users, change password, review accounts

### Employee Notification System (PLANNED)
- Department notification groups (Lab, Shipping, Sales, etc.)
- Employees in multiple groups
- Andrew not receiving access request notifications

### Email Deliverability (CRITICAL — BLOCKS NOTIFICATIONS)
- All system emails going to spam (confirmed by Kaylee)
- Need SPF/DKIM/DMARC audit on sending domain
- Email provider: Resend

## Tech Stack
- FUZE Atlas: Next.js 15.5 / Prisma 6.19 / PostgreSQL (Railway) / Vercel
- fuzefaq.com: Next.js serving static HTML / Railway
- DB: PostgreSQL on Railway (caboose.proxy.rlwy.net:28355)
- Email: Resend (transactional emails)
- Sending domain: needs SPF/DKIM/DMARC audit

## Proactive Sales Strategy
- Use Apollo/enrichment tools to research target brands proactively
- Build competitive intelligence on brands using competitor antimicrobials
- Identify brands with sustainability mandates → FUZE's zero-binder, zero-curing advantage
- Feed research into outreach sequences and call prep

## Preferences
- Move fast — meetings next week, lots to do
- Direct communication, no fluff
- Brand language is sacred — FUZE and metamaterial, never silver/nano
→ Full glossary: memory/glossary.md

## Platform Wish List (Priority Order)
1. **Environmental Impact Reports for Brands (ESG)** — Auto-generate quarterly reports: chemical binders eliminated, wastewater saved, curing energy avoided. HIGHEST PRIORITY.
2. **Consumption & Reorder Dashboard** — Track factory FUZE usage, projected run-out dates, automated reorder triggers.
3. **Competitive Intelligence Dashboard (EPA Scraping)** — Live dashboard tracking competitor registrations, formulation changes, regulatory actions.
4. **Real-Time Test Tracking (FedEx-style)** — Live tracking page with push notifications at each stage.
5. **AI Test Interpretation at Scale** — Auto-generate plain-English summaries with branded PDF certificates.
6. **Brand Self-Service QR Verification** — QR codes on hang tags → verification page.
7. **Factory Performance Scoring** — Score factories on first-pass rates. "FUZE Certified Factory" rating.
8. **API for Brand PLM Integration** — REST API with webhooks for large brands.

## Competitive Intelligence Project
- **Stage 1**: Full-force attack on traditional antimicrobials (silver chloride, zinc pyrithione, copper, quats, Noble Biometal embedded silver)
- **Stage 2**: Bio-based antimicrobial comparison (chitosan, etc.)
- **Depth**: PhD-level. Manufacturing process, VOCs, curing requirements, leaching, toxicity, washoff, binders, wastewater cleanup, full EPA filing data
- **Target competitors**: NordShield, Noble Biometal, Microban, Sciessent, Sanitized AG, Ultra-Fresh, BioPrism, Aegis, Silvadur
