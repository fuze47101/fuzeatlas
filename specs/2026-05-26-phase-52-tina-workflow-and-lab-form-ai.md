# Phase 52 — Tina test-request workflow gaps + Lab Form AI pipeline

**Filed:** 2026-05-26
**Why now:** Tina's May 26 email enumerates 7 things needed in the
test-request workflow. Audit found 4 exist, 3 don't (organism field,
regional approval routing, project-level grid view). Separately, the
lab-form AI intake pipeline (Phase 10C) shipped the bones but never
completed the pipeline — `LabFormTemplate` model exists, wizard UI
exists, but PDF → field-schema extraction was left as manual FUZE-staff
transcription. Andrew has flagged this is at least the 4th time we've
discussed the lab-form pipeline; ship it tonight.

**Self-sufficient — standing rules from CLAUDE.md "NON-NEGOTIABLE
WORKFLOW RULES" apply absolutely. 300-second auto-resume rule in
effect. No questions to Andrew between tracks. One commit per track
for blast-radius control.**

---

## Track 1 — Organism field on TestRequestLine

Schema add — extend `TestRequestLine` model with:

```prisma
organisms String?  // Comma-separated: "Staphylococcus aureus, Klebsiella pneumoniae"
washCount Int?     // 0, 25, 50, 100 — for wash-progression test series
```

Don't introduce a strict enum yet — labs use slightly different organism
naming conventions (S. aureus vs Staph aureus vs Staphylococcus aureus
(ATCC 6538)). Free-text with autocomplete suggestions is the right call
for v1.

**Autocomplete suggestions** — add a curated list to `src/lib/test-organisms.ts`:

```typescript
export const COMMON_ORGANISMS = [
  { id: "staph_aureus_6538", label: "Staphylococcus aureus (ATCC 6538)", testType: ["ANTIBACTERIAL"] },
  { id: "kleb_pneumoniae_4352", label: "Klebsiella pneumoniae (ATCC 4352)", testType: ["ANTIBACTERIAL"] },
  { id: "ecoli_25922", label: "E. coli (ATCC 25922)", testType: ["ANTIBACTERIAL"] },
  { id: "ecoli_8739", label: "E. coli (ATCC 8739)", testType: ["ANTIBACTERIAL"] },
  { id: "moraxella_19976", label: "Moraxella osloensis (ATCC 19976)", testType: ["ANTIBACTERIAL", "ODOR"] },
  { id: "aspergillus_brasiliensis", label: "Aspergillus brasiliensis (ATCC 9642)", testType: ["FUNGAL"] },
  { id: "candida_albicans_10231", label: "Candida albicans (ATCC 10231)", testType: ["FUNGAL"] },
  { id: "influenza_h1n1", label: "Influenza A H1N1", testType: ["ANTIVIRAL"] },
  { id: "influenza_h3n2", label: "Influenza A H3N2", testType: ["ANTIVIRAL"] },
];
```

Source list per the FUZE Certified Testing Protocol page Andrew wrote
on May 22 — the rule "Use the right test organism per method" with
its standard table.

**UI** — on every TestRequest creation flow (`/test-requests/page.tsx`,
`/brand-portal/test-requests/new/page.tsx`, `/factory-portal/request-test`):

- Per-line `organisms` field (multi-select autocomplete from
  COMMON_ORGANISMS, filtered by selected testType, with free-text
  fallback)
- Per-line `washCount` field (numeric input, "Wash count (0/25/50/100)" hint)

Render existing TestRequests' organisms/washCount on every read view
(`/admin/test-tracking`, `/lab-portal/queue`, `/track/[token]` public page).

Migration via bearer-authed cron `migrate-52-bundle` (same pattern as
P16.6/P17 bundles). Ensure idempotent ALTER COLUMN.

Commit: `feat(test-requests): organism + washCount fields per line (track 1 phase 52)`

---

## Track 2 — Regional approval routing

Tina handles Asia-lab approvals; Barth handles others (or future
regional leads). Today every approval hits a generic admin queue.

Schema add — extend `Lab` model with:

```prisma
regionalApproverId String?  // User who approves test requests sent to this lab
regionalApprover   User?    @relation("LabRegionalApprover", fields: [regionalApproverId], references: [id])
```

Apply via the same `migrate-52-bundle` cron.

**Backfill in the migration cron** — for every Lab with `region = "Asia"`
OR `region = "Asia Pacific"` OR `country IN ("Taiwan", "China", "Korea",
"Japan", "Vietnam", "Thailand", "Indonesia", "Malaysia", "India",
"Pakistan", "Bangladesh")`, set `regionalApproverId` to Tina's User.id.
Find Tina by `email = "tina@fuze47.com"`. Log how many labs got
backfilled.

**Approval queue scoping** — at `/admin/test-requests/page.tsx` (or
wherever the approval queue lives):

- If user is ADMIN: see all PENDING_APPROVAL requests
- If user is the `regionalApprover` for a lab: see PENDING_APPROVAL
  requests assigned to that lab
- Stamp `approvedById` to whoever clicks Approve

**Approval notification** — when a test request is created with a labId
that has a regionalApproverId, notify ONLY that approver (not all
admins). When the approver acts, fan out the approve/reject decision to
admins + requester + brand + factory per the existing
`notifyTestRequestStatus` pattern.

Commit: `feat(approvals): regional approval routing per Lab.regionalApproverId (track 2 phase 52)`

---

## Track 3 — Project-level sample grid view

The chart Tina screenshotted shows samples (845, 846, 847 with wash
progressions 847/847-1/847-2/847-3 for 0w/25w/50w/100w) crossed against
test methods (AATCC 100, ASTM E2149) and organisms (Staph & Kleb,
E-coli). One row per sample×wash, columns for each test method+organism
combination. This is the SanMar project overview she referenced.

**New page** — `/admin/projects/[id]/page.tsx`:

- Header: project name, brand, factory, stage, fuzeTier, projectedValue,
  annualVolumeMeters, expectedProductionDate
- "Add sample" button
- "Add test request" button (pre-fills projectId)
- **Sample grid table**:
  - Rows: every Fabric in the project, expanded per washCount when
    multiple wash counts exist (using TestRequestLine.washCount as the
    grouping key)
  - Columns: testType × testMethod × organism combinations that have
    been requested for any sample in the project (so columns are
    dynamic per project, not hardcoded)
  - Cell content: status badge (NOT_TESTED / REQUESTED / IN_PROGRESS /
    PASS / FAIL / RESULT_VALUE) + click-through to the specific
    TestRun if one exists
  - Color coding: green pass, red fail, amber in-progress, gray
    not-tested
- Empty state: "No samples yet. Click 'Add sample' to start tracking."

**New API** — `GET /api/admin/projects/[id]/grid`:

- Returns `{ project, samples: [{ fabricId, fuzeNumber, customerCode,
  factoryCode, washCount, cells: { [columnKey]: { status, value,
  testRunId } } }], columns: [{ key, label, testType, testMethod,
  organism }] }`
- Pulls fabrics from project.fabrics (verify the relation name in
  schema)
- For each fabric × wash combination, looks up TestRequestLine rows
  for that fabric+wash, then the TestRun(s) attached to those lines
- Column set derived from `distinct (testType, testMethod, organism)`
  across all TestRequestLines in the project

ACL: same as `/admin/test-tracking` — ADMIN, EMPLOYEE, TESTING_MANAGER,
SALES_MANAGER. Brand users get a scoped version at
`/brand-portal/projects/[id]` (same UI, scoped query, BRAND_USER /
BRAND_MANAGER ACL).

**CSV/Excel export** — same `Download Excel` pattern as the brand
pipeline export Code just shipped. `GET /api/admin/projects/[id]/grid?format=xlsx`
returns the matrix as a true .xlsx with frozen header + autofilter.

**Link in** — `/admin/projects` doesn't exist as a list page yet
either. Either build a quick list at `/admin/projects/page.tsx`
(table of all Projects with stage, brand, projectedValue, link to
detail page) OR add a "Project" link from each TestRequest detail
view. Build the list page — it's 30 lines.

Commit: `feat(projects): sample grid view + admin projects list page (track 3 phase 52)`

---

## Track 4 — PDF → field-schema AI extraction (the lab-form pipeline gap)

Today `/lab-portal/forms` says: "Upload your PDF test request forms
here. The FUZE team will convert them into digital forms." That's
manual transcription — admin has to read the PDF and hand-type the
fields JSON into `LabFormTemplate.fields` via
`/api/admin/labs/[id]/form-templates` POST.

The promise is that the lab drags a PDF and the system extracts the
field schema automatically. Build that.

**New endpoint** — `POST /api/lab-portal/forms/extract`:

Accepts a multipart upload of a PDF. Pipeline:

1. Extract PDF text + page count via `pdf-parse` or `pdfjs-dist` (whichever
   is already a dep — check package.json; if neither, use `pdf-parse`).
2. Optionally extract images of each page (for diagram-heavy forms).
3. Send the extracted text to Claude Sonnet 4.6 with the system prompt:

```
You are extracting form fields from a laboratory test intake form (PDF).
The form will be filled out by a customer requesting a test from this
lab. Extract every fillable field and return as JSON:

{
  "templateName": "...",  // suggested name based on form title
  "fields": [
    {
      "key": "snake_case_id",
      "label": "Display label shown to user",
      "type": "text" | "number" | "date" | "select" | "checkbox" | "textarea",
      "required": true | false,
      "options": ["option1", "option2"]  // only for type=select
      "hint": "optional helper text"
    }
  ]
}

Rules:
- Don't include fields the lab fills in itself (lab number, accession #,
  date received). Only fields the CUSTOMER must provide.
- For check-the-applicable-test-method fields, use type=select with the
  options as listed in the PDF.
- Number-only fields → type="number" with a hint about units.
- Multi-line description fields → type="textarea".
- Group multi-sample tables into a single repeating field with key
  "samples" and type="repeating" (lab review will refine).
- Preserve the original field labels from the PDF — don't paraphrase.
```

4. Validate the Claude response against the expected JSON shape.
   Reject + retry once if shape is wrong.
5. Return `{ ok, suggested: { templateName, fields } }` for the lab user
   to review.

**UI** — extend `/lab-portal/forms/page.tsx`:

- Drag-and-drop PDF zone (uses the same react-dropzone pattern as
  /admin/feedback or /lab-portal/upload).
- On drop: POST to `/api/lab-portal/forms/extract`.
- Show extracted fields in a editable preview table — lab user can:
  - Rename labels
  - Change field types
  - Delete fields the lab doesn't actually need
  - Add fields the AI missed
- "Save Template" button → POSTs to `/api/lab-portal/form-templates`
  (already exists) with the reviewed fields.
- Saved templates show below the upload zone with edit/disable controls.

**Lab-side preview** — after save, add a "Preview customer view" button
that opens `/lab-portal/wizard/[formTemplateId]?preview=true` rendering
exactly what the customer sees.

Commit: `feat(lab-forms): PDF drag-drop AI extraction + lab review UI (track 4 phase 52)`

---

## Track 5 — Customer-facing wizard

The existing `/lab-portal/wizard/[formTemplateId]` is LAB-side — for
the lab to test the wizard works. Customers (AMs, brand users, factory
users) need their own entry point.

**New page** — `/test-requests/wizard/page.tsx` (customer-facing):

- Step 1: pick lab (autocomplete, filtered by `Lab.active = true`)
- Step 2: pick the lab's form template (dropdown of `LabFormTemplate`
  rows where `labId = selectedLab.id` AND `active = true`)
- Step 3: pick the fabric (autocomplete from /api/fabrics search,
  pre-scoped to caller's brand if not admin)
- Step 4: AI-assisted fill — POST to `/api/lab-portal/wizard/start`
  with `{ formTemplateId, fabricId }`. The endpoint already returns
  `{ fields, confidence, notes }`. Render the form with the
  AI-suggested values pre-filled and per-field confidence badges
  (green=auto, amber=review, red=guess, gray=blank) — the same UX
  already shipped on the lab-side wizard.
- Step 5: review + submit. Submit:
  - Creates a TestRequest with the right brand/fabric/lab/projectId
  - Creates TestRequestLine rows per the form's test-method fields
  - Attaches the form responses to TestRequest.raw or a new
    TestRequestFormResponse model (whichever is simpler)
  - Triggers `notifyTestRequestStatus` to the lab + regional approver
  - Generates the printable PDF (Track 6) and attaches it as a
    Document(kind="TEST_REQUEST_FORM")

ACL: ADMIN, EMPLOYEE, SALES_MANAGER, SALES_REP, BD_REP, BRAND_USER,
BRAND_MANAGER, FACTORY_USER, FACTORY_LEAD, DISTRIBUTOR_USER,
DISTRIBUTOR_LEAD. Lab roles get pointed to their own wizard.

**Link in** — add "New Test Request via Wizard" button on
`/test-requests` (admin), `/brand-portal/test-requests` (brand),
`/factory-portal` (factory) home tile.

Commit: `feat(test-requests): customer-facing AI wizard for lab forms (track 5 phase 52)`

---

## Track 6 — Print step (PDF generation matching lab's original form)

Tina specifically asked: "print the matching form for the lab and hit
submit and it goes to the lab."

After wizard submission, generate a PDF that LOOKS LIKE the lab's
original form, with the customer's data filled in. This is what Tina
prints + attaches to the physical sample shipment.

**Approach** — two options, pick whichever is faster:

A. **Field overlay onto the original PDF** (preferred — preserves lab
   branding exactly). Use `pdf-lib` to open the original PDF stored
   in `Document.url` (S3) and draw the wizard values at the field
   positions. Requires the lab template to capture field coordinates
   during the AI extraction (Track 4). If field coordinates weren't
   captured, fall through to (B).

B. **Generic PDF generation** — `@react-pdf/renderer` or `pdfkit`.
   Render a clean PDF with the lab's name + logo + the field
   labels/values from the wizard. Less accurate visually but always
   works.

For v1, ship (B) — universal compatibility. Add (A) as a Track 6.5
follow-up if labs complain the PDF doesn't match their form exactly.

**New endpoint** — `GET /api/test-requests/[id]/wizard-pdf`:
Returns the filled PDF. Bearer-authed via session.

**Button** — "Print form" on the post-submit success page +
`/test-requests/[id]` admin detail view. Also auto-attaches to the
TestRequest as Document(kind="TEST_REQUEST_FORM") so it's accessible
via `/track/<token>` and the lab queue.

Commit: `feat(test-requests): generate printable PDF matching lab form (track 6 phase 52)`

---

## Track 7 — Submit creates TestRequest + notifies lab (verify + fix gaps)

The wizard's "Submit → creates a TestRequest" step is described in the
Phase 10C code comments but the actual submit endpoint
(`/api/lab-portal/wizard/[formTemplateId]/submit` or wherever it lives)
may or may not exist. Verify and fix gaps:

1. Find the submit endpoint. If it doesn't exist, create
   `POST /api/test-requests/wizard/submit` that:
   - Accepts the wizard payload (formTemplateId, fabricId, formResponses)
   - Creates TestRequest with status="PENDING_APPROVAL" (or
     "ASSIGNED_TO_LAB" if Lab.regionalApproverId is null, indicating
     no approval needed)
   - Creates TestRequestLine rows per the form's testType/testMethod/organism fields
   - Stamps requestedById, brandId, fabricId, labId
   - Triggers Track 6's wizard-pdf generation + Document attachment
   - Calls `notifyTestRequestStatus` to fan out to:
     - The lab's regional approver (if set)
     - All admins (fallback)
     - The brand owner team (BRAND_USER / BRAND_MANAGER for brand)
     - The factory owner team (FACTORY_USER / FACTORY_LEAD for factory)
2. Verify the existing wizard UI POSTs to this endpoint on the final
   step. If it POSTs somewhere else, wire it correctly.

Commit: `feat(test-requests): wizard submit creates TestRequest + fan-out (track 7 phase 52)`

---

## Track 8 — Migration cron + verification

**New endpoint** — `POST /api/cron/migrate-52-bundle`:

- `ALTER TABLE "TestRequestLine" ADD COLUMN IF NOT EXISTS "organisms" TEXT` (T1)
- `ALTER TABLE "TestRequestLine" ADD COLUMN IF NOT EXISTS "washCount" INT` (T1)
- `ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "regionalApproverId" TEXT` (T2)
- `CREATE INDEX IF NOT EXISTS "Lab_regionalApproverId_idx" ON "Lab"("regionalApproverId")` (T2)
- ALTER TABLE on `TestRequestFormResponse` if Track 5 introduced one
  (skip if responses go in TestRequest.raw)
- Backfill Tina as regional approver for Asia labs (T2 backfill logic)

Returns `{ ok, verdict, log: [...] }` like the other migration crons.

**Then update `/api/cron/diag-all-surfaces`** to add checks for:

- "/admin/test-tracking — organisms column readable"
- "Lab.regionalApproverId column readable"
- "/admin/projects — list page readable"
- "/admin/projects/[id] — grid page readable"
- "LabFormTemplate count > 0 after first PDF extract"

Fire `fzcron migrate-52-bundle` automatically after the last track's
commit lands. Then `fzcron diag-all-surfaces`. Don't wait for Andrew.

---

## Done criteria

- All 8 tracks shipped as separate commits on main
- migrate-52-bundle ran cleanly
- diag-all-surfaces 50+/N healthy
- The 3 Tina gaps are resolved:
  - Organism field selectable on every test request creation form
  - Asia labs route approvals to Tina
  - `/admin/projects/[id]` shows the sample-grid matrix per project
- The lab-form AI pipeline is end-to-end:
  - Lab drops a PDF on /lab-portal/forms
  - AI extracts field schema, lab reviews + saves
  - Customer (AM, brand, factory) hits the wizard at /test-requests/wizard
  - Wizard pre-fills via /api/lab-portal/wizard/start
  - Customer reviews + submits
  - TestRequest created, lab notified, regional approver notified,
    printable PDF generated + attached as Document
  - Lab receives the test in their queue with everything they need

Report back with the commit chain, deploy URLs, the migration log,
the diag-all-surfaces verdict, and one screenshot of either the
project grid OR the lab-form extraction working end-to-end. Open
genuine escalations only on (a) ambiguity in the spec, (b) approval
needed for a customer-impacting decision, (c) unrecoverable error.

---

## Notes on existing infrastructure to reuse

- `aiFetch` from `src/lib/ai-fetch.ts` — already wired for ANTHROPIC_API_KEY
- `notifyTestRequestStatus` — already fans to brand + factory + regional + admins (extend if needed for the regional-only notify)
- `Document` model for PDF attachments — use kind="TEST_REQUEST_FORM"
- `LabFormTemplate` model — already exists, just needs the PDF-extract pipeline to populate it
- `/api/lab-portal/wizard/start` — already does AI-assisted auto-fill, reuse for the customer-facing wizard
- The `aiNarration` brand-voice gate at `src/lib/test-narration.ts` — copy the BANNED words list pattern when filtering AI-extracted field labels (some lab forms have "silver" in field names — substitute "FUZE" before persisting to LabFormTemplate.fields)
