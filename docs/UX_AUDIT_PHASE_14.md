# UX Audit — Phase 14A

Walked every portal surface as a brand-new user. Findings grouped
by portal, tagged with severity (CRITICAL / HIGH / MEDIUM / LOW)
and an actionable fix.

CRITICAL + HIGH items get committed in the Phase 14 sweep.
MEDIUM + LOW are a TODO list Andrew picks from.

**Audit date:** 2026-05-10. Source of truth: actual code in
`src/app/{brand,factory,distributor,lab}-portal/` and `src/app/admin/`.

---

## BRAND_PORTAL — 17 pages

### CRITICAL

- **`/brand-portal/storefront` only useful when public storefront is enabled** — currently shows traffic stats with no
  explanation if the brand hasn't flipped `BrandProfile.publicEnabled=true`. **Fix:** add explicit "Your storefront isn't
  published yet — enable it from /brand-portal/spec" panel above the analytics when publicEnabled=false.

### HIGH

- **`/brand-portal/approvals` empty state is bare** — when no items pending the page renders a thin "All caught up" line.
  **Fix:** mount `<EmptyState />` with explanation of what an approval is (Phase 14G next-action panel will help here).
- **`/brand-portal/spec` missing required-field markers** — required tier dropdown has no asterisk. **Fix:** wrap with
  `<FormField required />` (Phase 13D primitive).
- **`/brand-portal/lab-pipeline` shows test requests but doesn't explain what each status means** — IN_PROGRESS vs
  RESULTS_RECEIVED vs COMPLETE need a tooltip or legend.

### MEDIUM (TODO)

- `/brand-portal/team` doesn't explain how invites work; needs a "Brand managers can invite teammates" callout.
- `/brand-portal/network` is dense; needs a "Sort by recent activity" default.
- `/brand-portal/contacts` should have a "Sync from HubSpot" affordance if HubSpot is wired.
- `/brand-portal/library` doesn't filter to brand-facing-only docs by default.
- `/brand-portal/inventory` heading says "Inventory" but the page is read-only — should be "Stock visibility" to
  clarify it's not editable from this surface.

### LOW (TODO)

- Hero copy on `/brand-portal/page.tsx` mentions "Welcome Back" — sometimes feels off on first visit.
- `<PortalActivityFeed />` shows 50 items by default; offer a 7-day filter.

---

## FACTORY_PORTAL — 16 pages

### CRITICAL

- **`/factory-portal/upload-report` accepts PDF without confirming the file matches a TestRun** — silent acceptance
  surprises factories. **Fix:** show "Saved as pending review" banner immediately on upload (already partly there;
  needs prominence).

### HIGH

- **`/factory-portal/intake` long form with no progress indicator** — submitting a fabric requires ~12 fields and
  there's no visible step count. **Fix:** add a step indicator at the top (X of Y).
- **`/factory-portal/orders` empty state** — currently bare. **Fix:** EmptyState + CTA to /factory-portal/request-test
  if no orders exist yet.
- **`/factory-portal/specs` shows brand specs but doesn't say which brand each spec belongs to in card title** —
  reads ambiguous on multi-brand factories. **Fix:** prefix card with brand name.
- **`/factory-portal/recipe-requests` doesn't show "you have N recipes graduated" tile** — operationally useful but missing.

### MEDIUM (TODO)

- `/factory-portal/sample-trial` flow has no progress save — refresh = lose state.
- `/factory-portal/network` shows distributor + brand network but doesn't surface "How to invite a brand to test our fabric."
- `/factory-portal/my-requests` empty state needs improvement.
- `/factory-portal/library` doesn't filter to factory-facing-only docs by default.
- `/factory-portal/intake/voice` UX is mobile-first but mounted on desktop too — desktop fallback should hint "Use your phone for fastest intake."

### LOW (TODO)

- "Submit" button copy throughout could be more specific ("Submit fabric for FUZE treatment").
- `tests` page should default to sort by date desc.

---

## DISTRIBUTOR_PORTAL — 13 pages

### CRITICAL

- **`/distributor-portal/restock` doesn't enforce 1-gaylord international minimum** until submit-time validation —
  user can fill the form expecting a smaller order. **Fix:** disable submit + show "1-gaylord (608L) international minimum"
  inline as user types below the threshold.
- **`/distributor-portal/incoming` shows pending factory orders but doesn't explain "approve" vs "modify" actions** —
  the buttons are there but no copy describes what flipping APPROVE does.

### HIGH

- **`/distributor-portal/inventory` shows stock + reorder threshold side-by-side with no visual emphasis on low stock** —
  currently a flat table. **Fix:** red row tint when stockLiters <= reorderPointLiters.
- **`/distributor-portal/test-reports` empty state needs the "Apply for test" CTA**.
- **`/distributor-portal/orders` and `/distributor-portal/incoming-orders` are two different things** — naming collision
  hurts navigability. **Fix:** rename to `/restock-history` (orders FROM FUZE) and `/incoming` (orders FROM factories).

### MEDIUM (TODO)

- `/distributor-portal/documents` page doesn't say what kinds of docs are stored here.
- `/distributor-portal/library` redundant with `/distributor-portal/documents` — pick one.
- `/distributor-portal/invoices` shows amount due but no "pay now" affordance — pure read-only is fine but should say so.

### LOW (TODO)

- Currency display inconsistent — some pages USD only, some local.
- Dashboard tile labels could be tightened.

---

## LAB_PORTAL — 13 pages

### CRITICAL

- **`/lab-portal/profile` Operations Contact section now has FormField inline validation (✓ from Phase 13D adoption)
  — but the rest of the profile (Lab name, address, accreditations) is still bare inputs without validation.** —
  acceptable for now since they're lower-risk free-text fields.

### HIGH

- **`/lab-portal/queue` shows incoming test requests but doesn't sort by priority/SLA** — labs may miss rush tests.
  **Fix:** sort by priority desc, then by deliverByDate asc.
- **`/lab-portal/lab-tests` (Phase 10B per-protocol catalog) and `/lab-portal/catalog` (legacy LabService) are TWO
  catalogs** — confusing. **Fix:** add a clear "Use the new catalog at /lab-portal/lab-tests" banner on the legacy
  page; mark for deletion next cycle.
- **`/lab-portal/wizard/[formTemplateId]` requires raw fabricId/brandId/factoryId paste-in** — no search affordance.
  **Fix:** wire a fabric typeahead (defer until follow-up; document as known gap).

### MEDIUM (TODO)

- `/lab-portal/credits` could surface "Why do I have a credit?" tooltip on each row.
- `/lab-portal/uploads` doesn't show parser confidence — labs can't tell if a report is "matched" or "pending review".
  (Already partly done per Tina ticket; verify.)
- `/lab-portal/specs` shows brand specs labs need to honor — should be expandable by brand.

### LOW (TODO)

- Print stylesheet on test detail pages would help labs hand off paper.

---

## ADMIN — 50+ pages

### CRITICAL

- **`/admin/orders` and `/admin/orders-dashboard` both exist** — same data, two different views, no cross-link.
  **Fix:** in 14F redundancy elimination.
- **`/admin/brand-pipeline` is the unified BD view, but `/admin/accounts` and `/admin/conversion-tracking` overlap heavily** —
  three pages doing similar things. Picked up in 14F.

### HIGH

- **`/admin/icp-sample-prep` 5-step wizard has no progress indicator** — wizard step counter missing. **Fix:** add.
- **`/admin/recipe-calculator` requires bench-test pre-data; doesn't say so up front** — new users hit "no recipes
  yet" with no guidance.
- **`/admin/competitor-pricing` is read-only — needs a "Run watcher now" admin button** that fires `fzcron competitor-watch`.

### MEDIUM (TODO)

- `/admin/weekly-review` should auto-load the most recent snapshot when landed (currently sometimes requires manual refresh).
- `/admin/lab-review` could surface "X items unresolved" badge in sidebar.
- `/admin/test-catalog` and `/lab-portal/catalog` partially overlap — admin sees both prices, but the page UI doesn't
  clarify which side a row originated from.
- `/admin/brand-discovery` results need a "save to pipeline" button per row.

### LOW (TODO)

- Many admin pages lack the breadcrumbs added in Phase 13H. (Adoption pass 4 territory.)
- Many admin tables don't use overflow-x-auto on mobile.

---

## CRITICAL/HIGH FIX BATCH (autopushed in Phase 14)

Auto-shipped in the Phase 14 sweep:

1. **Distributor incoming orders renamed** — keep both routes alive, deprecate the dupe in nav.
2. **Brand-portal storefront empty state** — explain publicEnabled gate.
3. **Distributor restock minimum** — inline disable + helper text.
4. **Factory intake step indicator** — wizard progress dots.
5. **Lab queue priority sort** — default sort fix.
6. **Admin orders-dashboard cross-link to admin/orders** — disambiguation.

These ship as concrete commits below; the rest stay in this doc as the
explicit TODO list.

## Severity counts

- CRITICAL: 7
- HIGH: 15
- MEDIUM: 17
- LOW: 8

Total: **47 audit findings** across 5 portals + admin.
