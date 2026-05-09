# FUZE Atlas — Roadmap v2 (Autonomous Execution Spec)

**Audience:** future Claude (claude-code or Cowork) executing autonomously against this repo.
**Date frozen:** 2026-05-09.
**Status:** READY TO EXECUTE.

This document is the single source of truth for the next major build wave on FUZE Atlas. It is deliberately ruthless about scope and order: do them in phase order, ship per-phase commits, run tsc + lint between every phase, and trust the conventions in `CLAUDE.md` over anything that contradicts them here.

---

## 1. The Vision (read first, never forget)

FUZE Atlas is the central nervous system for FUZE Biotech's go-to-market. It mediates **seven roles** (brand, factory, distributor, lab, sales rep / AM, FUZE ops, public verifier) across **eight surfaces**:

1. **BD / CRM / ACM** — lead → close
2. **Operations pipeline** — fabric intake → recipe → application → ICP → cert → ongoing batch QA
3. **Inventory & order chain** — FUZE corp → distributor → factory
4. **Testing collection** — every test ever run, browsable per-fabric / per-brand / per-factory / per-lab
5. **Document & marketing repository** — single source of truth for compliance docs, brand packets, datasheets
6. **Education hub** — segment-specific decks for hospitality, intimates, kids/baby, workwear, athletic, medical, automotive
7. **AI research toolkit** — multi-AI brand discovery, brand validation, competitor intel
8. **Notification + visibility hub** — every party in a fabric's supply chain sees every state transition relevant to them

Atlas's promise to brands is **transparency and accountability**: published pricing, accurate quotes, end-to-end traceability per fabric, ongoing QA proof that factories deliver what brands pay for.

The seven roles × eight surfaces give a 56-cell capability matrix. Roughly 18 cells are well-built today, 22 partial/broken, 16 non-existent. Build order below targets the highest-leverage unfinished cells first.

---

## 2. Execution Conventions (non-negotiable)

Every phase commit MUST satisfy:

1. **Brand voice** — read `CLAUDE.md` "Critical Brand Language" + `src/lib/fuze-knowledge.ts`. NEVER write `silver`, `nano`, `silver-ion`, `nano-silver`, or any variant. ALWAYS use `FUZE`, `metamaterial`, `FUZE F1/F2/F3/F4`. Compliance docs (CIL, ARSL, SDS) may use chemical names.
2. **Next.js 15 gotchas** — params are Promises (`params: Promise<{ id: string }>` then `await params`). User model uses `status: "ACTIVE"` not `active: true`. Cron routes MUST be exempted via `PUBLIC_PATHS` in `src/middleware.ts`.
3. **Prisma migrations** — use `npx prisma db push`, NOT `prisma migrate deploy`. Shadow DB is broken.
4. **Git workflow** — commits MUST use `--no-verify` (eslint pre-commit hook is broken). Clear `.git/index.lock` before every git operation. One feature = one commit. Production branch is `main` (auto-deploys to Vercel).
5. **Typecheck always** — run `./node_modules/.bin/tsc --noEmit -p tsconfig.json` after every phase. Build fails if exit code ≠ 0. Do not commit on failure.
6. **No new files outside the existing structure** — `src/app/*` for routes, `src/lib/*` for utilities, `src/components/*` for shared components, `prisma/schema.prisma` for the schema, `docs/*` for documentation.
7. **Comments must explain WHY, not WHAT** — and reference the ticket / phase that introduced the change.

---

## 3. Build Phases (execute IN ORDER)

### Phase 0 — i18n thread-through customer portals (HIGHEST PRIORITY)

**Why first:** Tina's factory contacts in China/Vietnam/India literally cannot use the portal in English. The framework is 80% built — only the 4 customer portal page trees skip it.

**Acceptance criteria:**
- A new `LanguageSwitcher` component (in `src/components/`) renders a dropdown of `LOCALES` from `src/i18n/index.ts`. Mounted in the top header of all 4 customer portals.
- Every hardcoded English string in `src/app/factory-portal/**`, `src/app/brand-portal/**`, `src/app/distributor-portal/**`, `src/app/lab-portal/**` is replaced with a `t.<namespace>.<key>` reference.
- Add the missing keys to `src/i18n/en.ts` first (single source of truth), then run a translation pass for the priority languages: `zh-CN`, `vi`, `hi`, `tr`, `bn`, `ta`. Other languages (km, th, ms, id, ur, ko, ja, es, it, zh-TW) get auto-machine-translated as a starter that humans can refine later — flag them with a `// TODO: human-translate` comment.
- Email templates in `src/lib/email-templates.ts` accept a `locale` param and pull from the same dictionary. Every customer-facing email looks up the recipient's `User.locale` (new column — see Phase 1 below).
- HTML `lang` and `dir` attrs continue to flip via existing `I18nProvider`.

**Files to touch:** all `*.tsx` under the 4 customer portal trees, `src/components/Header.tsx` (or wherever portal headers live), `src/components/LanguageSwitcher.tsx` (new), all `src/i18n/*.ts` dictionaries.

**Schema add:** `User.locale String @default("en")` — set on first login from browser preference, editable from `/settings/profile`.

**Done when:** running `npm run dev`, switching the language to `zh-CN` from any customer portal, every visible string changes; emails sent from BD wizard with a `zh-CN`-locale recipient land in Simplified Chinese.

---

### Phase 1 — Notification multi-party fan-out (HIGHEST IMPACT)

**Why next:** the orphaned `notifyTestResult` helper at `src/lib/notify.ts:66` already defines the right fan-out logic but is called nowhere. The result-stamp path at `src/app/api/tests/[id]/route.ts:253` hand-rolls a single email to one recipient. Wiring these together closes 4 of the 7 worst notification gaps.

**Acceptance criteria:**
- Replace the single `sendResultsReadyEmail` in `tests/[id]/route.ts` (the `brandVisible: true` stamping path) with a call to a new `dispatchTestResultNotifications(testRunId)` in `src/lib/notify.ts`.
- The dispatcher resolves the full recipient set off the underlying fabric: brand users (via `Fabric.brandId`), factory users (via `FabricSubmission.factoryId`), distributor user (via `Factory.distributorId`), AM (via `Brand.salesRepId` or `Factory.salesRepId`, or `EntityManager` rows), and FUZE ops (admins via `role: ADMIN`).
- For each resolved recipient, write a `Notification` row AND send a role-appropriate email (template per role).
- Add a `distributor` channel to `src/lib/notify-workflow.ts` (currently missing entirely).
- Wire the lab upload path: `/api/lab-portal/uploads/route.ts` and `/api/tests/upload/route.ts` (when the uploader is a lab user) MUST call `dispatchTestResultNotifications` on a successful auto-link to a TestRun, OR an "uploaded for review" notification when low-confidence.
- Wire the recipe-bench-test events: `RecipeBenchTest` create → notify factory (recipe-in-progress); `recipeIcpResult` set → notify factory + brand (recipe validated at 1 mg/kg); `graduate` → notify factory + AM + brand (cleared for production).
- Add a `NotificationSubscription` model: `{ userId, eventType (enum), entityType, entityId, optedOut Boolean }`. The dispatcher checks subscriptions before fan-out. Default: every party in the supply chain is auto-subscribed.

**Files to touch:** `src/lib/notify.ts`, `src/lib/notify-workflow.ts`, `src/app/api/tests/[id]/route.ts`, `src/app/api/lab-portal/uploads/route.ts`, `src/app/api/tests/upload/route.ts`, `src/app/api/admin/recipe-bench-tests/[id]/icp/route.ts`, `src/app/api/admin/recipe-bench-tests/[id]/graduate/route.ts`, `prisma/schema.prisma` (new `NotificationSubscription` + `EventType` enum), `src/lib/email-templates.ts`.

**Done when:** stamping a TestRun brand-visible from `/admin/tests/[id]` triggers in-app rows for brand+factory+distributor+AM+admins, plus emails to each (each in their `User.locale`). Verified by tailing `Notification` table after a manual stamp.

---

### Phase 2 — Education segmentation + unified Resource hub

**Why now:** "single source of truth for all docs/marketing/decks" is the second half of Atlas's promise. Education currently serves all roles + all segments identically.

**Segments to support** (Andrew's list, expand as needed):

| Segment | Primary audience | Example content |
|---|---|---|
| `hospitality` | Hotels, hospitality groups | bedding, sheets, towels, durability data |
| `next-to-skin` | Activewear, intimates, base layers | skin-contact safety, OEKO-TEX Class I emphasis |
| `kids-baby` | Children's apparel, baby gear | EPA + Cal EPA + PFAS-free narrative, allergen profile |
| `workwear` | Industrial, healthcare uniforms | wash-cycle durability, ASTM E2149 efficacy data |
| `athletic` | Performance apparel | wash + odor + UV stack, F1 100-wash data |
| `medical` | Hospital linens, scrubs, masks | AATCC 100 + ISO 18184 antiviral, CDC alignment |
| `automotive` | Seat fabric, headliners | OEM compliance, fade resistance |
| `home-textiles` | Curtains, upholstery, mattresses | sustained release, no PFAS |

**Acceptance criteria:**
- New Prisma model `Resource { id, kind (enum: DECK|DOC|VIDEO|SDS|COA|REPORT|TEMPLATE|ONE_PAGER), segment (enum), language, title, description, url, version, supersededById, visibleToRoles[], visibleToBrandIds[], visibleToFactoryIds[], visibleToDistributorIds[], tags[], createdAt }`.
- Migrate the existing dead PDFs in repo root (`FUZE_Brand_Packet_*.pdf`, `FUZE_Atlas_*.docx`, `FUZE_Costco_Sheets_FINAL.pdf`, `FUZE_Test_Packet_*.pdf`, `NordShield_Competitive_Weaknesses.docx`) into S3, register as `Resource` rows.
- Migrate the science decks at `/education/{footprint,mechanism,application,claims,story}` into Resource rows tagged with all relevant segments. The existing `/education` pages stay as live React; the Resource registry is for downloadable / shareable assets.
- Build `/education/segments/[segment]/page.tsx` — segment-specific landing page that lists Resources filtered by segment + user role.
- Build `/admin/resources/page.tsx` — admin UI to upload, tag, version, retire.
- Build `/api/resources/route.ts` — GET filtered by user role + locale + segment + tags.
- New naming convention enforced at upload: `FUZE_<segment>_<kind>_<title-kebab>_<version>_<lang>.<ext>`. Example: `FUZE_hospitality_DECK_brand-packet-overview_v3_en.pdf`.

**Files to touch:** `prisma/schema.prisma` (Resource + Segment + ResourceKind enums), `src/app/education/segments/[segment]/page.tsx` (new), `src/app/education/page.tsx` (segment picker added to existing index), `src/app/admin/resources/**` (new), `src/app/api/resources/route.ts` (new), `src/lib/resource-naming.ts` (new — convention helper).

**Done when:** an admin can upload a hospitality deck, a brand whose `brand.segment = hospitality` sees it on `/brand-portal/resources`, and a factory user does NOT (because brand-segment doesn't match the factory's market).

---

### Phase 3 — Menu cleanup + naming consolidation

**Why now:** the sidebar has overlapping features with similar names. Clean up before further surface area is added in Phases 4-5.

**Acceptance criteria:**
- Audit `src/lib/modules.ts` and `src/components/Sidebar.tsx`. Identify items with overlapping function. Common cases observed:
  - "Brands" (admin) vs "Brand Pipeline" (admin) — pick one canonical surface, redirect the other
  - "Tests" vs "Test Results" vs "Test Requests" — these are three distinct things; rename for clarity ("Tests Catalog", "Test Results Library", "Test Requests Inbox")
  - "Documents" vs "Compliance Library" vs "Distributor Docs" vs "Product Documents" — fold under one "Resource Hub" with type filters (post-Phase 2)
  - "Sample Trial" vs "Sample Application" — clarify: trial = customer-side request, application = lab-side pad+dry record
- Apply consistent naming: every nav item is a noun phrase, lowercase except proper nouns, no jargon. Run translations through Phase 0 i18n keys.
- Per-role menu visibility: each item declares `visibleToRoles: UserRole[]`. Sidebar filters at render. Removes the current per-Sidebar-section conditional logic.

**Files to touch:** `src/lib/modules.ts`, `src/components/Sidebar.tsx`, `src/i18n/en.ts` (rename keys), all other `src/i18n/*.ts` (mirror).

**Done when:** there are zero duplicate-named or overlapping-purpose items in the sidebar across any role.

---

### Phase 4 — Architectural primitives

**Why now:** these unlock every feature in Phase 5. Without them, each customer-surface feature requires its own hand-rolled scoping query (the same shape of bug that bit Tina).

**Acceptance criteria:**

#### `BrandProfile` model
- `BrandProfile { brandId @unique, requiredWashCount, targetTier (F1|F2|F3|F4), abReductionPct, antifungalRequired, odorRequired, antiviralRequired, icpCadenceDays, mandatoryTests[], certifications[], approvedLabIds[], notes }`.
- Brand profile wizard at `/brand-portal/profile/wizard` — 7-step questionnaire, saves on each step.
- Read in `/api/cron/integrity-audit` (Phase 7) to assert: every test on this brand's fabrics meets `targetTier` and `requiredWashCount`.

#### `SupplyChainLink` model
- `SupplyChainLink { brandId, factoryId, distributorId, fabricId?, role (PRODUCING|SAMPLING|EVALUATING|RETIRED), status (ACTIVE|PAUSED|ENDED), stageEnteredAt, notes }`.
- Replace `BrandFactory` join model usage. Migrate existing rows.
- New `src/lib/acl.ts` exports `canRead(user, fabric)`, `canRead(user, brand)`, `canRead(user, factory)` backed by `SupplyChainLink` lookups.
- Replace ~8 hand-rolled scoping `where` clauses across `/api/factory-portal`, `/api/brand-portal`, `/api/distributor-portal` with calls to `canRead`.

#### `RecipeRequest` model
- `RecipeRequest { id, factoryId, fabricId, fabricSubmissionId, requestedAt, status (PENDING|RECEIVED|IN_PROGRESS|VALIDATED|GRADUATED|CANCELLED), assignedToUserId, dryToWetPickupPct, recommendedTier, recipeDeliveryUrl, validatedIcpAtStandard Boolean, notes }`.
- Factory portal page `/factory-portal/recipe-requests` (list + new request form).
- Notifications wired to Phase 1 fan-out.

#### `FuzeHQInventory` model
- `FuzeHQInventory { id, snapshotAt, volumeOnHandLiters, volumeReservedLiters, volumeInTransitLiters, lastAuditAt, recordedByUserId }`.
- Append-only ledger row created on every `DistributorRestockOrder.SHIPPED` and direct `FuzeOrder.SHIPPED` (when `fulfillmentSource = "DIRECT_USA"`).
- Admin dashboard `/admin/hq-inventory/page.tsx` — current stock + 90-day burn-down chart + reorder threshold alarm.
- Auto-decrement triggers on the source order routes.

#### `LabFormTemplate` model
- `LabFormTemplate { id, labId, kind (INTAKE|RESULT|SHIPPING_LABEL), uploadedDocumentId, parsedSchemaJson, parsedAt, parserConfidence, isActive }`.
- New endpoint `/api/lab-portal/forms/parse-and-publish/route.ts` — takes the uploaded PDF, sends to Claude AI for schema extraction, saves `parsedSchemaJson`.
- New component `src/components/DynamicFormWizard.tsx` — renders fields from `parsedSchemaJson`. Used by factory's request-test flow when target lab has a parsed form.
- Generated PDF traveler MUST stamp: `fuzeFabricNumber`, `customerFabricCode`, `factoryFabricCode`, factoryName, brandName, distributorName.

**Files to touch:** `prisma/schema.prisma` (5 new models), `src/lib/acl.ts` (new), `src/components/DynamicFormWizard.tsx` (new), all 4 customer portal data-fetch routes (replace scoping logic), new `src/app/factory-portal/recipe-requests/**`, `src/app/admin/hq-inventory/**`, `src/app/lab-portal/forms/[id]/page.tsx`.

**Done when:** the integrity-audit cron (Phase 7) can run a query like "every fabric where brand.requiredWashCount > test.washCount → file ticket" against real data.

---

### Phase 5 — Customer surfaces (built on Phase 4 primitives)

**Brand portal:**
- `/brand-portal/supply-chain` — list of factories making brand's fabrics with status per factory (read from `SupplyChainLink`).
- `/brand-portal/fabrics/[fuzeNumber]` — per-fabric lifecycle page. Timeline of `OrderLifecycleEvent` rows + every TestRun + every recipe iteration + every batch shipped.
- `/brand-portal/profile` — view/edit `BrandProfile` (the wizard from Phase 4).
- `/brand-portal/batch-qa` — table of recent production batches with cert status, PASS/FAIL streak.

**Factory portal:**
- `/factory-portal/fabrics` — augment to show ALL tests on each fabric (not separate page).
- `/factory-portal/recipe-requests` — built in Phase 4; here finalize UX.
- Fix `/factory-portal/sample-trial` to share the same fabric pivot.

**Distributor portal:**
- `/distributor-portal/inventory` — replace one-row pricing UI with a 5-tier matrix editor.
- `/distributor-portal/incoming-orders/[id]` — fulfillment workflow: allocate → pick → ship → confirm.

**Lab portal:**
- `/lab-portal/forms` — wire to Phase 4's parse-and-publish.
- `/lab-portal/shipping-info` — public-ish page lab edits to publish their address, ATTN line, hazmat flags, broker info. Surfaced into PDF traveler.
- `/lab-portal/tests-completed` — chronological list with download links scoped to that lab.

**Files to touch:** all 4 customer portal trees (extensive).

**Done when:** a brand user logged in can navigate to a fabric, see every event in its lifecycle from initial submission to most recent batch QA, with each event clickable for detail.

---

### Phase 6 — Onboarding wizards

For each of the 4 customer roles, a 5-step wizard on first login:

| Role | Steps |
|---|---|
| **Factory** | (1) Profile (name, country, contact info) (2) Distributor selection (3) First fabric submission (4) Pricing tier confirmed (5) Tour of portal sections |
| **Brand** | (1) Profile (name, segment, primary markets) (2) `BrandProfile` requirements (Phase 4 wizard) (3) Nominate factories (4) Pick approved labs (5) Tour |
| **Distributor** | (1) Inventory baseline (2) Pricing tiers (5-tier matrix) (3) Currency (4) Master/sub structure (5) Tour |
| **Lab** | (1) Profile + accreditations (2) Service catalog (3) Upload intake form (parsed in Phase 4) (4) Shipping info (5) Tour |

**Schema add:** `User.onboardingCompletedAt DateTime?` and `User.onboardingState Json?`.

**Files to touch:** `src/app/onboarding/[role]/page.tsx` (4 new pages), `src/middleware.ts` (redirect to `/onboarding/[role]` when `User.onboardingCompletedAt IS NULL`), `prisma/schema.prisma`.

---

### Phase 7 — Self-healing audit cron

**Why last:** depends on `BrandProfile` and `SupplyChainLink` to assert against.

`/api/cron/integrity-audit` runs daily 14:00 UTC and checks:

1. Brands in `PRESENTATION+` stage with no `salesRepId` for >3d → file `FeedbackReport(category=ERROR)`
2. TestRuns >7d old with no `Document(kind=REPORT)` → file ticket
3. Contacts whose email host matches a `validationStatus: dead` brand → silently mark `outreachStatus: skipped`
4. Submissions with no `fuzeFabricNumber` after 5d → file ticket
5. Tests where `washCount < brand.requiredWashCount` → file ticket
6. Tests where `tier < brand.targetTier` → file ticket
7. Outbound bounces (Resend webhook) → mark contact email invalid + file ticket
8. Tickets that the auto-triage workflow couldn't fix in 3 attempts → escalate to Andrew with a summary
9. FUZE HQ stock < 30-day burn rate → file ticket
10. Brand voice violations: any `EmailTemplate.body` containing forbidden terms → file ticket

The auto-triage workflow we shipped 2026-05-09 (`.github/workflows/auto-triage.yml`) eats the resulting tickets daily.

---

### Phase 8 — Test-request consolidation

Migrate `FuzeTestRequest` → `TestRequest`. Drop `FuzeTestRequest` model. Update factory portal `request-test` to write canonical model. One commit, clearly marked. Run staging first, validate, then prod.

---

## 4. Cross-cutting deliverables (parallel to phases)

- **Brand voice CI gate** — pre-commit + CI hook that scans diff for forbidden terms (`silver`, `nano`, `silver-ion`, `nanoparticle`). Fails build if found outside `prisma/schema.prisma`, `CLAUDE.md`, compliance docs path.
- **Daily integrity report email** — augment the daily-digest cron to include a "Atlas health" section with counts from the integrity audit.
- **Pricing publishing** — `/pricing/public/[segment]` pages drive the brand transparency promise. Pull from a `PublicPriceList` row (admin-managed).

---

## 5. How to execute autonomously

Two compatible mechanisms:

**A. Long-running claude-code session.** From the repo root:
```bash
cd /Users/a801/Desktop/fuzeatlas
npx claude-code "Read docs/ROADMAP_v2.md and execute Phase 0 end-to-end. Stop after Phase 0 ships. Run tsc + commit per file group. Use --no-verify on every commit. Don't touch any phase past Phase 0."
```
Then repeat with Phase 1, etc. One phase per session. Long-running but produces real progress.

**B. Auto-triage workflow ingestion.** Generate one `FeedbackReport` per phase-step (~30 tickets) via a one-off script. The daily auto-triage workflow chews through them at 5/day. Slow but unattended.

**Recommended:** A for Phases 0-1 (highest leverage, want fast turnaround), B for Phases 2+ (granular, parallelizable).

---

## 6. Pre-flight checklist before kicking off

- [ ] Local backup created (timestamped tarball + .env.local + git log)
- [ ] Production Railway snapshot confirmed in dashboard
- [ ] `git status` clean on `main`
- [ ] `npm run build` passes (catch any latent build errors before claude-code's tsc would)
- [ ] `CLAUDE.md` skimmed for any context that supersedes this doc
- [ ] `ANTHROPIC_API_KEY` budget-checked — Phase 0 alone is ~$30 of API time

Once those boxes are checked, kick off Phase 0.
