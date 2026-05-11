# Phase 15 — Hole Plug & Imperative Build Instructions

**Purpose.** Phase 14 audited every portal and surfaced the polish/UX/holes list.
Phase 15 is the **build response** — concrete, file-level instructions that close
each hole, in priority order. This is the paste-ready prompt for Claude Code to
execute next.

**Scope explicitly EXCLUDED (per Andrew, May 10 2026):**
- ❌ Slack integration. Andrew has no admin authority to corporate Slack and
  doesn't use it. Atlas is the replacement.
- ❌ Microsoft Teams integration. Geographically dominant brands (China, India)
  do not use the Microsoft stack. Atlas is the replacement.
- ❌ Any third-party "presence" or "DM" surface that depends on a corporate IT
  team approving an OAuth app.

**In scope:** in-app notifications, email digests, SMS (Twilio is already wired
for outreach), and PDF/print artifacts. Those three reach every brand/factory/
distributor user we care about, in every region.

---

## Priority key (used throughout)

| Tier              | Meaning                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| **🔥 IMPERATIVE** | Customer is blocked or would lose trust today. Ship before the next demo.             |
| **🟧 NEED**       | Sales team or admin is forced to do this manually. Real pain, not catastrophic.       |
| **🟨 NICE**       | Polish that elevates Atlas from "functional" to "expert-feeling."                     |
| **🟩 BONUS**      | Distinguishing feature competitors don't have.                                        |
| **💎 MIND-BLOW**  | Demo-day "wait, you can do that?" moment. Save for after the imperatives are closed.  |

Each work item below names the **file(s) to touch** and the **acceptance test**.

---

## 🔥 IMPERATIVE — must close before Joseph/KUIU sees the platform again

### IMP-1. Brand portal: graceful "no brand associated" state

**Symptom.** A new brand-side user logs in, lands on `/brand-portal`, sees
"no brand associated" with no recovery path. Joseph would close the tab.

**Fix.**
- `src/app/brand-portal/page.tsx`: when `user.brandId` is null, render a
  **first-run claim card** instead of a dead-end. Card has three buttons:
  1. "I'm at <inferred-brand>" (inferred from email domain via
     `src/lib/brand-inference.ts` — new helper that queries Brand by
     `LOWER(emailDomain) = LOWER(emailDomainOf(user.email))`).
  2. "Find my brand" → searchable typeahead over Brand.name.
  3. "Request a new brand workspace" → POSTs to a new
     `/api/brand-portal/request-workspace` endpoint that creates a
     `BrandWorkspaceRequest` row + notifies admins via
     `notifyAccessRequest` (already exists).
- New model `BrandWorkspaceRequest { id, requestedByUserId, suggestedBrandName,
  suggestedDomain, status (PENDING/APPROVED/REJECTED), createdAt, resolvedAt,
  resolvedByUserId }`. Admin reviews under `/admin/access-requests`
  (existing page — extend with a tab).
- Once an admin approves, set `User.brandId` and fan a
  `notifyAccessGranted` to the requester.

**Acceptance.** Create a brand-side user with no brandId. `/brand-portal`
shows the claim card; clicking "I'm at KUIU" sets brandId and redirects to
the dashboard.

### IMP-2. Brand portal: approvals page "forbidden" → role-explainer

**Symptom.** A plain BRAND_USER hits `/brand-portal/approvals` and gets a
flat "Forbidden". They can't tell whether it's a permission issue or a bug.

**Fix.**
- `src/app/brand-portal/approvals/page.tsx`: when ACL denies, render a
  `<RestrictedSurface />` component (new in `src/components/RestrictedSurface.tsx`)
  that shows: which role gates the feature, who at their brand currently has
  that role, and a "Request access" button that POSTs to
  `/api/brand-portal/request-role` (new endpoint that opens a
  `RoleEscalationRequest` and notifies the brand's primary EntityManager).
- Apply the same component everywhere we currently render bare "Forbidden":
  grep `forbidden` in `src/app/brand-portal/**`, `src/app/factory-portal/**`,
  `src/app/distributor-portal/**`, `src/app/lab-portal/**`. Convert all.

**Acceptance.** A BRAND_USER lands on `/brand-portal/approvals` and sees
"This page is for Brand Managers. Sarah Lee at KUIU has that role —
[Request access]" instead of a brick wall.

### IMP-3. `/admin` route 404

**Symptom.** Long-standing 404 on the bare `/admin` route. Andrew typed it
in to demo and got a Next.js error page.

**Fix.**
- New `src/app/admin/page.tsx`: server component that gates on
  ADMIN/EMPLOYEE/SALES_MANAGER and renders the existing 6-card module
  picker scoped to admin tools. Pull tile data from `src/lib/modules.ts`
  filtered by `category === 'admin'`.
- If non-admin lands here, redirect to `/home`.

**Acceptance.** `fuzeatlas.com/admin` returns 200 with the admin module
picker for an admin and 302→/home for a brand user.

### IMP-4. Per-portal first-run onboarding (zero-state coverage)

**Symptom.** New users in every portal land on dashboards that show "0 / 0 / 0"
counts and no obvious next action. Especially painful for Lab and Distributor
roles where the workflow is non-obvious.

**Fix.** A reusable `<OnboardingChecklist />` component
(`src/components/OnboardingChecklist.tsx`) that takes a list of `{ id, label,
done, href, hint }` items and renders a dismissible card across the top of
the dashboard until all items are done. Persistence per user via new
`UserOnboardingState` model (`userId, surface, completedItems[], dismissed,
dismissedAt`).

Per-portal lists:

- **Brand portal** (`/brand-portal`):
  1. Confirm your brand profile (`/brand-portal/profile`)
  2. Set required FUZE tier + ICP cadence (`/brand-portal/spec`)
  3. Add at least one factory to your supply chain
     (`/brand-portal/supply-chain` → "Add factory")
  4. Upload your testing protocol PDF (`/brand-portal/spec` field)
  5. Invite a teammate (`/brand-portal/team`)

- **Factory portal** (`/factory-portal`):
  1. Confirm your factory profile (`/factory-portal/profile`)
  2. Submit your first fabric (`/factory-portal/intake`)
  3. Set up your distributor relationship
     (`/factory-portal/distributor`)
  4. Place your first FUZE order (`/factory-portal/orders/new`)
  5. Upload a recent test report (`/factory-portal/upload-report`)

- **Distributor portal** (`/distributor-portal`):
  1. Confirm your distributor profile + warehouse
  2. Set your local pricing tiers
     (`/distributor-portal/pricing-tiers`)
  3. Add factories you serve (`/distributor-portal/factories`)
  4. Place your first restock order
     (`/distributor-portal/orders/new`)
  5. Upload a shipment confirmation
     (`/distributor-portal/upload-shipment`)

- **Lab portal** (`/lab-portal`):
  1. Confirm your lab profile + accreditations
     (`/lab-portal/profile`)
  2. Set per-test pricing and turnaround
     (`/lab-portal/pricing`)
  3. Pick up your first test request from the queue
     (`/lab-portal/queue`)
  4. Submit your first result with raw data
     (`/lab-portal/results/new`)
  5. Set your timezone for cadence emails
     (`/settings/profile`)

**Acceptance.** Sign in as a brand-new user in each portal. The checklist
renders, items tick off as actions are completed, dismissal sticks across
sessions.

### IMP-5. Document repository — role visibility matrix

**Symptom.** Phase 14 audit found that documents (SDS, COA, certifications,
test reports, protocols, EPA letters, OEKO-TEX certs, bluesign cert, ICP
reports) live in scattered places — `Document` table, `TestRun.reportPdfUrl`,
`Brand.protocolDocUrl`, `Lab.accreditationDocs`, etc. — and there is no
single screen per portal that says "here is everything you can see."

**Fix.**
- New unified `/[portal]/documents` route per portal
  (brand-portal/factory-portal/distributor-portal/lab-portal/admin).
- Backend: `src/lib/document-acl.ts` (new) exports `listDocumentsForUser(
  user, filter)` that walks every document-bearing table and returns rows
  the user is allowed to see. Visibility rules:

| Doc kind                         | Brand sees                       | Factory sees                       | Distributor sees                | Lab sees           | Admin sees |
| -------------------------------- | -------------------------------- | ---------------------------------- | ------------------------------- | ------------------ | ---------- |
| Brand testing protocol           | own brand only                   | factory in this brand's supply chain | ❌                              | when assigned test | all        |
| SDS (FUZE)                       | all (it's public)                | all                                | all                             | all                | all        |
| COA per shipment                 | own brand's orders               | own factory's orders               | own distributor's shipments     | ❌                 | all        |
| ICP test report                  | own brand's tests                | own factory's tests                | ❌                              | own results        | all        |
| Antimicrobial efficacy report    | own brand's tests                | own factory's tests                | ❌                              | own results        | all        |
| EPA federal registration letter  | all                              | all                                | all                             | all                | all        |
| California EPA approval letter   | all                              | all                                | all                             | all                | all        |
| OEKO-TEX Standard 100 Class I    | all                              | all                                | all                             | all                | all        |
| bluesign® approval letter        | all                              | all                                | all                             | all                | all        |
| PFAS-free attestation            | all                              | all                                | all                             | all                | all        |
| Lab accreditation cert           | own assigned labs                | own assigned labs                  | ❌                              | own only           | all        |
| Distributor pricing tier sheet   | ❌ (commercial)                   | own distributor's tiers            | own only                        | ❌                 | all        |
| FUZE invoice / PO                | own brand's POs                  | own factory's POs                  | own only                        | own only (lab POs) | all        |
| Sample Application recipe card   | own brand's fabrics              | own factory's samples              | ❌                              | when received      | all        |
| Recipe Bench Test report         | own brand's fabrics              | own factory's recipes              | ❌                              | ❌                 | all        |

- Frontend: same component per portal,
  `src/components/DocumentRepository.tsx`, with category tabs
  (Compliance · Testing · Commercial · Operations) and search. Each row:
  title, kind chip, source entity, date, "View" / "Download" buttons.
- Compliance category includes a "Trust pack" download — a single ZIP that
  bundles every public-tier doc (EPA, CA EPA, OEKO-TEX, bluesign, PFAS,
  SDS) + a generated cover letter using `src/lib/fuze-knowledge.ts` voice.

**Acceptance.** A KUIU brand user sees their protocol + their factories'
ICP reports + the public compliance pack, but nothing from Rhone or
Penfabric. A factory user sees only their own brands' protocols, scoped
via SupplyChainLink. Run `npm run check:doc-acl` (new test) — it asserts
the matrix above for a seeded fixture.

### IMP-6. Notification fan-out coverage gaps

**Symptom.** Phase 14 audit confirmed the May 9 fan-out work covered
TestRequest, FabricSubmission, TestRun, and Order lifecycle — but several
state changes still go to admin only:

- `BrandPricingTier` change → currently silent. **Should** fan to all
  brand users (their discount tier just moved).
- `Brand.requiredFuzeTier` change → currently silent. **Should** fan to
  every factory in the brand's supply chain (their required spec changed).
- `BrandSpec.icpCadence*` change → currently silent. **Should** fan to
  every factory in the brand's supply chain.
- Lab `TestRun` raw-data upload → currently fans only on brand-visible
  flip. **Should** also fan an internal-only notification to admin/lab
  manager when raw data lands, before brand stamp.
- `FactoryInvitation` accepted → currently silent. **Should** fan to the
  brand's primary EntityManager.

**Fix.** Add helpers to `src/lib/notifications.ts`:
- `notifyPricingTierChange(brandId, oldTier, newTier)`
- `notifySpecChange(brandId, changedFields)`
- `notifyRawDataReceived(testRunId)`
- `notifyInvitationAccepted(invitationId)`

Wire each from the matching API route. Suppress duplicates within 22h via
the `metadata.kind` pattern already used by `test-cadence`.

**Acceptance.** Trigger each event in a staging brand and confirm the
right set of users (and only the right set) gets a Notification + email.

---

## 🟧 NEED — closes daily friction for sales/admin

### NEED-1. Smart-default seed scripts per portal

**Symptom.** Onboarding a new brand or factory requires admin to manually
populate 8-12 fields that have obvious defaults. This is why customer
data entry (KUIU/Penfabric/Rhone/BesTex/North Face/Nike specs, lab
profiles, FactoryInvitations) keeps getting deferred.

**Fix.**
- `scripts/seed-brand.ts` — takes `{ brandName, domain, primaryRep }`
  and creates Brand + first EntityManager + sane spec defaults
  (`requiredFuzeTier: F2`, `icpCadenceEveryNBatches: 5`,
  `wastageFactorPct: 10`).
- `scripts/seed-factory.ts` — takes `{ factoryName, country,
  distributorName, brandNames[] }` and creates Factory + the
  SupplyChainLink rows + a `FactoryInvitation` for each named brand.
- `scripts/seed-lab.ts` — takes `{ labName, country,
  accreditations[], testTypes[] }` and creates Lab + LabPricing rows
  with median market prices + standard turnaround (7d ICP, 14d AB,
  21d AV).
- `scripts/seed-distributor-tiers.ts` — applies a 5-rung default
  pricing tier ladder to a distributor in their local currency.
- All four scripts are idempotent (use `upsert` on natural keys),
  log every change, and refuse to run in production unless
  `ALLOW_PROD_SEED=1` is set.

**Acceptance.** Andrew runs `npx tsx scripts/seed-brand.ts --name=Rhone
--domain=rhone.com --rep=barth@fuze47.com` and Rhone shows up in
`/admin/brand-pipeline` with sane defaults, claimable.

### NEED-2. Bulk import wizards

**Symptom.** Admin still adds brands/factories/contacts one at a time.

**Fix.**
- `/admin/import/brands` — paste-CSV or upload-XLSX wizard with
  column-mapping UI. Maps to `seed-brand` under the hood. Preview →
  confirm → write.
- `/admin/import/factories` — same pattern, wraps `seed-factory`.
- `/admin/import/contacts` — already exists in part; extend to support
  the same column-mapping UI and route through Apollo enrichment for
  any row missing email.

**Acceptance.** Drop a 200-row XLSX of brand candidates from a trade
show; see a preview table with validation badges; click confirm; rows
land in the pipeline with relevance computed.

### NEED-3. Workflow auto-fill (cross-table inference)

**Symptom.** Factory user creating an order has to re-enter brand,
distributor, pricing tier, FUZE tier — all of which the system already
knows from their profile + the brand's spec.

**Fix.**
- `/factory-portal/orders/new`: pre-fill from
  `factory.distributor` + `factory.activeBrands` + each brand's
  `requiredFuzeTier`. User only enters volume.
- `/distributor-portal/orders/new`: pre-fill carboy/gaylord/container
  selection based on last 3 orders' median size.
- `/brand-portal/test-requests/new`: pre-fill required tier + protocol
  doc from brand spec; pre-fill lab from last lab used for this brand.

**Acceptance.** A factory user clicks "New order", sees brand and tier
already chosen, types `608` for liters, hits submit. Done in under
10 seconds.

### NEED-4. Audit log surface per role

**Symptom.** No user-visible audit log. When something changed (brand
spec, pricing tier, factory assignment), nobody can answer "who and
when?" without grepping Vercel logs.

**Fix.**
- New `AuditLog` model: `{ id, actorUserId, entityType, entityId,
  action, before (Json), after (Json), createdAt, ip, userAgent }`.
- Helper `src/lib/audit.ts: recordChange(actor, entity, before, after)`.
  Wire from every PATCH endpoint that mutates Brand spec, BrandPricingTier,
  EntityManager, FactoryInvitation, SupplyChainLink, LabPricing.
- Per-portal surfaces:
  - Admin: `/admin/audit-log` (full history, filterable).
  - Brand: `/brand-portal/activity-log` — own brand only.
  - Factory: `/factory-portal/activity-log` — own factory only.
  - Distributor: `/distributor-portal/activity-log` — own only.
  - Lab: `/lab-portal/activity-log` — own only.
- 90-day retention; older rows archived to S3 (or just truncated for
  now — flag for future).

**Acceptance.** Andrew changes Rhone's required tier from F2 to F1.
The Rhone brand user sees "Andrew Peterson changed required FUZE tier:
F2 → F1, May 10 2026 14:23 UTC" in their activity log within 5 seconds.

### NEED-5. Redundancy elimination — single source of truth pass

**Symptom.** Phase 14 audit identified duplicate or near-duplicate UI
surfaces that confuse users and double admin work.

**Fix.**
1. **CRM:** Standalone Notes tab is gone (✅ done May 2026), but legacy
   `/admin/notes` route still exists. Delete it; `/admin/activity-feed`
   is the single CRM surface.
2. **Pending counts:** Sidebar badge and Test Requests page count are
   now reconciled (✅ April 2026). Sweep for any other "X pending"
   number that disagrees with its detail page (search
   `pending-counts/route.ts` callers).
3. **Brand list views:** `/admin/brands` (legacy index),
   `/admin/brand-pipeline` (the canonical), and `/admin/leads`
   (deprecated) all render brand lists. Keep `brand-pipeline`,
   add `/admin/brands` as a redirect, delete `/admin/leads`.
4. **Factory list views:** Same — keep `/admin/factories`, redirect
   `/admin/factory-list`.
5. **Document upload entry points:** Currently three (TestRun raw-data,
   Document table, ad-hoc PDF picker on ICP wizard). Funnel all
   through `src/lib/upload.ts`'s `uploadDocument()` helper which
   handles signed-URL get + storage write + Document row insert + ACL
   stamp + AV scan stub. Refactor each entry point to call the helper.

**Acceptance.** `grep -r "POST.*upload"` in `src/app/api/**` returns
exactly the documented set (single helper invocation pattern). Legacy
routes 404 or 302.

### NEED-6. Brand spec change → factory acknowledgement loop

**Symptom.** When a brand bumps required tier from F2 to F1, factories
get a notification but there's no record they actually saw it. A
factory could keep shipping F2-treated fabric for weeks.

**Fix.**
- New `BrandSpecAcknowledgement` model:
  `{ brandId, factoryId, specVersion, acknowledgedByUserId,
  acknowledgedAt }`.
- When `Brand.brandSpecUpdatedAt` advances, set every
  SupplyChainLink for that brand to require ack.
- `/factory-portal` dashboard renders a top banner "Spec updated by
  KUIU on May 10 — review and acknowledge" until a factory user clicks
  through to `/factory-portal/spec/<brandId>` and confirms.
- After ack, `notifySpecAcknowledged(brandId, factoryId, userId)` fires
  to the brand's primary EntityManager. Closes the loop.

**Acceptance.** Brand bumps tier; factory sees the banner; acks;
brand sees "Acknowledged by Wei Chen at Penfabric on May 10 09:14".

### NEED-7. Lab portal: assignment + accept/reject

**Symptom.** Test requests currently route to "the lab" with no
explicit accept step. Lab can be overcommitted and brand wouldn't know
until the result is late.

**Fix.**
- `TestRequest.status` already has APPROVED → SUBMITTED →
  IN_PROGRESS → RESULTS_RECEIVED → COMPLETE. Add an interstitial:
  `ASSIGNED_TO_LAB` between APPROVED and SUBMITTED.
- New endpoint `/api/lab-portal/test-requests/[id]/accept`: lab
  flips ASSIGNED → SUBMITTED + sets expected completion based on
  their LabPricing turnaround.
- New endpoint `/api/lab-portal/test-requests/[id]/reject`: lab
  flips ASSIGNED → APPROVED with `lab.id` cleared + a reason. Fans
  notification to brand + admin so it can be reassigned.
- 24h SLA on the accept/reject decision; if not acted on, cron
  `/api/cron/lab-assignment-overdue` fans an escalation to admin
  to manually reassign.

**Acceptance.** Brand requests test → admin assigns to ITS → ITS
sees it in `/lab-portal/queue` with Accept/Reject buttons → ITS
accepts; expected completion appears on the brand's dashboard.

---

## 🟨 NICE — polish that elevates the platform

### NICE-1. Empty states everywhere

Replace every "0 / 0 / 0" stat card with an empty state that has a
CTA. Pattern: `<EmptyState icon hint cta href />`. Apply to brand
supply chain, factory submissions list, distributor inventory,
lab queue, admin pipeline. Component lives at
`src/components/EmptyState.tsx`.

### NICE-2. Skeleton loaders, not spinners

Replace the `<div className="animate-spin"/>` blockers (currently in
`/factory-portal`, `/brand-portal`, `/lab-portal`) with skeleton card
shapes that mirror the loaded layout. Pattern:
`src/components/Skeleton.tsx`. Reduces perceived latency and makes
slow connections (China, India) feel snappier.

### NICE-3. Consistent date formatting

Pick `Intl.DateTimeFormat` with the user's locale + their timezone
(`User.timezone`, added in Phase 10). Wrap in
`src/lib/format-date.ts` exporting `formatDate(d, user)`,
`formatDateTime(d, user)`, `formatRelative(d, user)`. Sweep all
`new Date(...).toLocaleString()` and `.toISOString().split('T')[0]`
into the helper.

### NICE-4. Keyboard shortcuts on admin

- `g p` → brand pipeline
- `g f` → factories
- `g d` → distributors
- `g l` → labs
- `g a` → audit log
- `/` → focus search

Wire via `src/lib/keyboard-shortcuts.ts` + a `<KeyboardShortcutsHelp />`
modal triggered by `?`. Admin only.

### NICE-5. Search: global ⌘K palette

Single `<CommandPalette />` (`src/components/CommandPalette.tsx`) that
searches across brands, factories, contacts, fabrics, FUZE numbers,
test requests, orders. ⌘K opens it. Backed by
`/api/admin/search?q=` which fans to each table with `take: 5`.

### NICE-6. Brand portal: at-a-glance ESG strip

Above the dashboard cards on `/brand-portal`, render a 3-stat strip:
"Total liters used · kg fabric treated · CO₂ avoided vs PFAS
alternative". Numbers come from
`/api/brand-portal/esg-snapshot` which already exists. CO₂
calculation lives in `src/lib/esg-math.ts` (new) — pulls per-liter
factor from `src/lib/fuze-knowledge.ts`.

### NICE-7. Factory portal: "next FUZE order" widget

Predict next reorder date from consumption trend. Widget on
`/factory-portal` shows "At your current rate, you'll need a fresh
gaylord by June 14 — [Place order now]".

---

## 🟩 BONUS — distinguishing features

### BONUS-1. Public verification page per FUZE-treated SKU

`/verify/<skuOrQR>` — public route, no auth. Shows: brand,
factory, FUZE tier, ICP-validated date, lab, certifications. QR on
hangtag points here. This is the "consumer scans hangtag" surface.
Already on the wishlist; ship the MVP that just renders from
`Fabric` + most-recent brand-visible `TestRun`.

### BONUS-2. Brand "trust pack" PDF on demand

Single click on `/brand-portal/documents` → "Generate trust pack"
→ server-side PDF compose (uses `src/lib/pdf.ts`) of:
- Cover letter in FUZE voice
- EPA federal letter
- California EPA letter
- OEKO-TEX cert
- bluesign® cert
- PFAS-free attestation
- This brand's protocol doc
- Most recent ICP report per factory

Email it to a customer or download. This is the deliverable Joseph
asked about (correlation chart on file).

### BONUS-3. Smart suggestions for AM at brand detail

On `/admin/brands/[id]`, render a "Suggested next moves" panel that
runs:
- "Last activity 17 days ago — schedule a check-in?"
- "ICP overdue at Penfabric — escalate to factory AM?"
- "Factory in supply chain hasn't reordered in 90 days — at risk?"
- "Required tier is F2 but Penfabric just submitted F3 — flag?"

Backed by `src/lib/suggestions.ts` (new). Cards are dismissable;
dismissals stored in `UserDismissal` to avoid resurfacing for 7 days.

### BONUS-4. Distributor commission preview

On `/distributor-portal`, show "Estimated commission this quarter:
$X" based on shipped orders × distributor margin. Save full
commission system for later (per CLAUDE.md preferences) but the
preview is one query.

### BONUS-5. Lab portal: daily queue email

Lab manager gets a 7am-local email with their day's queue: tests
to start, tests due today, raw data uploads pending review. Cron
`/api/cron/lab-queue-digest`, runs hourly and fires per-lab when
that lab's local time hits 07:00 (uses User.timezone added in
Phase 10).

---

## 💎 MIND-BLOW — save for after imperatives are closed

### MB-1. Live ICP correlation chart

The chart Joseph asked about (ICP value ↔ antimicrobial efficacy).
Backed by every brand-visible TestRun that has both an ICP value
and an AB result. Renders as a scatter + best-fit line at
`/admin/analytics/icp-correlation` (admin) and
`/brand-portal/analytics/icp-correlation` (brand-scoped). Tooltip
per dot: fabric, factory, tier, date.

### MB-2. Geographic supply-chain map

`/brand-portal/supply-chain/map` — leaflet map with pins for every
factory in the brand's supply chain, sized by lifetime FUZE
consumption. Click a pin → factory drill-down.

### MB-3. AI-narrated test report

When a TestRun is stamped brand-visible, generate a one-paragraph
plain-English narration ("This fabric tested at 4.7-log reduction
on E. coli over 24 hours per ASTM E2149 — strong contact-kill
performance consistent with F2 Advanced Performance.") and attach
to the report PDF. Uses Claude API (already wired in Phase 10).
Voice locked to `src/lib/fuze-knowledge.ts`.

### MB-4. Predicted brand pipeline value

ML-lite — for every brand in the pipeline, predict expected
12-month FUZE volume based on industry, geo, brand size,
EngagementScore. Rank pipeline by predicted value × stage
probability. Display as "$X potential" chip on each row.

### MB-5. ESG snapshot per brand, autosent quarterly

Cron `generate-esg-snapshot` already runs Q1/Q4/Q7/Q10 (vercel.json).
Extend to email the snapshot PDF to every brand's primary
EntityManager + brand manager, branded with the brand's logo.
Closes the wishlist #1 item ("Environmental Impact Reports for
Brands").

---

## Build order (paste this list of tickets into GitHub)

1. IMP-3 `/admin` route 404 (1h, no schema)
2. IMP-1 Brand portal claim card (4h, +1 model)
3. IMP-2 RestrictedSurface + role-explainer (3h, +1 model)
4. IMP-4 OnboardingChecklist + per-portal lists (1d, +1 model)
5. IMP-5 Document repository + role visibility matrix (1.5d,
   +1 helper, +1 component, +5 routes)
6. IMP-6 Notification fan-out gaps (4h)
7. NEED-1 Smart-default seed scripts (4h, no schema)
8. NEED-2 Bulk import wizards (1d, no schema)
9. NEED-3 Workflow auto-fill (4h)
10. NEED-4 Audit log surface (1d, +1 model + helper)
11. NEED-5 Redundancy elimination sweep (1d)
12. NEED-6 Brand spec acknowledgement loop (4h, +1 model)
13. NEED-7 Lab portal assignment accept/reject (4h)
14. NICE bundle (2d, all polish, no schema)
15. BONUS bundle (2d, mostly net-new but isolated)
16. MIND-BLOW bundle (1w, save for last)

Total imperative + need: ~6 working days. Total to MIND-BLOW
inclusive: ~3 weeks.

---

## Verification checklist (per commit, per CLAUDE.md rule)

For every ticket above, the standard verification dance:

1. `npm run build` locally green.
2. `npm run check:brand-voice` green (no silver/nano slip-ins).
3. `npm run check:doc-acl` green (after IMP-5 lands).
4. Push to main with `fzpush`.
5. Watch Vercel — must go green within 5 min.
6. Spot-check the changed surface in production.
7. Update `docs/AUTONOMOUS_BUILD_LOG.md` with phase + ticket
   marker.
8. Move the ticket to Done in the GitHub project.

---

## Notes on what is NOT in this plan

- **Slack integration** — out, per Andrew May 10 2026.
- **Microsoft Teams integration** — out, per same.
- **Mobile native apps** — out for now; mobile-friendly PWA polish
  is in NICE-2/NICE-3.
- **Public REST API for brand PLM** — wishlist item #8; planned
  for after MIND-BLOW.
- **Commission system** — explicitly deferred per CLAUDE.md
  preferences. BONUS-4 covers the visible preview only.
- **DSN reconciliation** — already on the deferred list. Bearer-
  authed runtime migrations remain the workaround.

End of Phase 15.
