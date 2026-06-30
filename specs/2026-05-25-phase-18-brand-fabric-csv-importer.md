# Phase 18 — Brand Fabric Portfolio CSV Importer

**Date filed:** 2026-05-25
**Filed by:** Andrew (via Cowork session)
**Why now:** Andrew is about to onboard KUIU, Penfabric, Rhone, BesTex, North Face, Nike — each one has its own fabric portfolio spreadsheet (like Tina's SanMar FA27 sheet). Without this importer, every brand onboarding requires a custom seed endpoint (`/api/cron/seed-sanmar` pattern) hand-written per brand. That doesn't scale beyond 5-10 brands.
**Goal:** drop a CSV into Atlas → fabrics + factories + submissions + ICP/AM linkages all created in one atomic transaction. Brand onboarding goes from "days of custom engineering" to "30 minutes of upload + verify."

---

## STANDING RULES (read first — same as all prior specs)

1. **300-second auto-resume.** No check-ins between tracks. Execute end-to-end.
2. **Brand voice strict.** FUZE / metamaterial / F1-F4 across all 17 locales. No silver/nano/Ag.
3. **Verify-after-every-push.** Vercel green + `fzcron diag-all-surfaces` between commits.
4. **Error-state-not-zeros.** Every widget shows explicit error banner on failure.
5. **Bearer-authed runtime migration.** Any schema change goes through `/api/cron/migrate-18-bundle`.
6. **Git workflow.** `rm -f .git/index.lock`, `--no-verify` on commit, `prisma db push` for schema.
7. **i18n parity.** Every new user-facing string added to all 17 locale files.

---

## REFERENCE — Brand_Fabric_Portfolio_Template.csv (canonical schema)

Already committed at `deliverables/Brand_Fabric_Portfolio_Template.csv`. Columns:

```
Mill, Mill Fabric #, Type, Content, Weight (gsm), Brand Article #, Customer Code,
Fabric Trial Completed (Y/N), ICP Result Available (Y/N), Antimicrobial Result Available (Y/N),
ICP Value (mg/kg), ICP Notes, Report Date (YYYY-MM-DD), Workflow Status, Notes
```

This is the canonical shape. Importer MUST accept this exactly. It SHOULD also accept reasonable variants (case-insensitive, whitespace-tolerant column names; auto-detect "Factory Code" as alias for "Mill Fabric #" etc. — see Track 3).

---

## TRACKS

7 tracks. Strict order.

### TRACK 1 — Schema audit + migration

Audit `Fabric` model — every column the importer needs to write already exists from earlier work (`fuzeNumber`, `factoryCode`, `customerCode`, `customerReference`, `construction`, `weightGsm`, `quantityType`, `brandId`, `factoryId`, `developmentStatus`, `note`, `raw`). No schema changes likely needed.

Audit `BrandFactoryAlias` model — does NOT exist yet. Create it:

```prisma
model BrandFactoryAlias {
  id          String   @id @default(cuid())
  brandId     String
  brand       Brand    @relation(fields: [brandId], references: [id])
  csvName     String   // what the brand calls the factory in their spreadsheet
  factoryId   String   // resolves to canonical Factory row
  factory     Factory  @relation(fields: [factoryId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([brandId, csvName])
  @@index([brandId])
  @@index([factoryId])
}
```

Use case: SanMar's spreadsheet says "XinKaiSheng (New Kasum)" but our DB has it as "NK". Alias maps so future imports for SanMar auto-resolve.

Build `/api/cron/migrate-18-bundle/route.ts` (bearer-authed, idempotent) that creates the table + indexes.

### TRACK 2 — CSV parsing + validation helper

New file: `src/lib/fabric-csv-import.ts`

Exports `parseFabricCsv(csvText: string, brandId: string): Promise<ParseResult>` where:

```typescript
interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
  summary: {
    totalRows: number;
    validRows: number;
    rowsRequiringFactoryAlias: number;
    rowsWithExistingFuzeNumber: number;
    estimatedFabricsCreated: number;
    estimatedFabricsUpdated: number;
  };
}

interface ParsedRow {
  rowNumber: number;
  mill: string;
  millFabricNumber: string;
  type: "ACTUAL" | "DEVELOPMENT" | "FORECAST" | "RD" | null;
  content: string | null;
  weightGsm: number | null;
  brandArticleNumber: string | null;
  customerCode: string | null;
  fabricTrialCompleted: boolean;
  hasIcpResult: boolean;
  hasAmResult: boolean;
  icpValue: number | null;
  icpNotes: string | null;
  reportDate: Date | null;
  workflowStatus: FabricDevStatus | null;
  notes: string | null;
}
```

Validation rules:
- Mill required
- Mill Fabric # required (unique within brand)
- Type defaults to "DEVELOPMENT" if blank or unrecognized; warn if unrecognized value
- Weight (gsm) must parse to number or be blank; warn if not
- Y/N columns: accept Y, Yes, TRUE, 1, ✓ as truthy; N, No, FALSE, 0, blank as falsy; warn if unrecognized
- ICP Value must parse to number or be blank
- Report Date must parse to YYYY-MM-DD or be blank
- Workflow Status must be in `FABRIC_DEV_STATUSES` enum (use mapTinaStatusToEnum helper for fuzzy matching legacy spreadsheet values like "Bulk Production" → "BULK_PRODUCTION")

### TRACK 3 — Flexible column-name mapping

Real-world spreadsheets won't match the canonical column names exactly. Build a fuzzy header resolver that maps common variants:

| Canonical | Accepted variants (case-insensitive) |
|---|---|
| Mill | Factory, Manufacturer, Vendor, Supplier, Mill Name, Factory Name |
| Mill Fabric # | Factory Code, Factory SKU, Factory Style #, Article, Mill Style, Mill SKU |
| Type | Category, Status Type, Sample Type, Quantity Type |
| Content | Fiber Content, Composition, Material, Blend |
| Weight (gsm) | GSM, Weight, Fabric Weight, Mass |
| Brand Article # | SKU, Style Number, Brand SKU, Internal Code, Product Code |
| Customer Code | Brand Code, Internal Reference, Brand Reference |
| Workflow Status | Status, Stage, Phase, Development Stage |

Implementation: maintain a `COLUMN_ALIASES: Record<string, string[]>` map. When parsing a CSV, normalize each header (lowercase, trim, remove punctuation) and look up against the alias map. If no canonical match, warn (don't fail) — unknown columns get dropped into `ParsedRow.notes` as `[original_col: value]` so data isn't lost.

### TRACK 4 — Dry-run endpoint

New endpoint: `POST /api/admin/brands/[id]/fabrics/import?dryRun=true`

Accepts `multipart/form-data` with CSV file. Returns the `ParseResult` from Track 2 (no DB writes). Used for the preview step before committing the import.

Auth: ADMIN, EMPLOYEE, SALES_MANAGER, SALES_REP.

### TRACK 5 — Commit endpoint

New endpoint: `POST /api/admin/brands/[id]/fabrics/import` (no dryRun param).

Steps:
1. Parse + validate (same as dry-run).
2. Bail if any validation errors. Return them.
3. For each unique mill name in the CSV:
   - Check `BrandFactoryAlias` for `(brandId, csvName=millName)`. If found, use mapped factory.
   - Else try exact `Factory.findFirst({ name: millName })`. If found, create alias for future imports.
   - Else fail with `{ requiresFactoryAlias: [...] }` so the caller can resolve via the alias UI (Track 6).
4. For each parsed row:
   - Compute `fuzeNumber` via `nextFuzeNumber()` (mirror seed-sanmar helper) if no existing fabric matches `(brandId, factoryCode)`.
   - Upsert Fabric row.
   - Ensure BrandFactory + SupplyChainLink junctions via `ensureBrandFactoryLink()` (mirror seed-sanmar).
   - Ensure FabricSubmission row (status COMPLETE if trial done, else SUBMITTED).
   - Ensure TestRun for ICP if hasIcpResult.
   - Ensure TestRun for AM if hasAmResult.
5. Return summary: `{ fabricsCreated, fabricsUpdated, factoriesCreated, factoriesReused, aliasesCreated, icpRowsCreated, amRowsCreated, viewUrl }`.

### TRACK 6 — Importer UI

New page: `/admin/brands/[id]/fabrics/import`

Flow:
1. File upload (drag-drop or click-to-browse, single CSV).
2. Show dry-run results: row count, validation errors with row numbers, warnings, factory-alias resolution prompts.
3. For each unresolved factory name: dropdown to pick an existing Factory OR "+ Create new factory" inline modal. Save alias choices.
4. "Commit import" button (disabled if any blocking validation errors remain).
5. Post-commit: success page with summary + link to `/admin/brands/[id]/fabrics` to verify.

UI shows the canonical column template as a downloadable link at top of the page ("Don't have a template? Download CSV template").

### TRACK 7 — Per-brand seed retirement

Audit existing per-brand seed endpoints (`/api/cron/seed-sanmar` and similar). Document in CLAUDE.md that Phase 18+ brand onboarding uses the generic importer instead. Keep `seed-sanmar` as-is for back-compat (it's still useful for re-running SanMar specifically), but DON'T write new per-brand seeds going forward.

---

## DONE CRITERIA

- [ ] Schema migration ran via `fzcron migrate-18-bundle`.
- [ ] Upload the canonical `Brand_Fabric_Portfolio_Template.csv` to a test brand — confirm dry-run + commit work end-to-end.
- [ ] Upload a "messy" CSV with column-name variants (e.g. headers like "Factory" instead of "Mill") — confirm fuzzy mapping resolves correctly.
- [ ] Upload a CSV with unknown mill names — confirm alias resolution UI appears + works.
- [ ] Verify post-import `/admin/brands/[id]/fabrics` shows the new fabrics with correct factory grouping + FUZE numbers + dev statuses.
- [ ] i18n: all importer page strings added to all 17 locales.
- [ ] `fzcron diag-all-surfaces` green.

---

## OUT OF SCOPE (Phase 18.X follow-ups)

- Excel (.xlsx) parsing — CSV only for v1. Brands export Excel → CSV easily.
- Bidirectional sync — this is import-only. Brands modifying Atlas data and pushing back to spreadsheets is Phase 20+.
- Real-time collaboration — one admin uploads at a time. No multi-user concurrent editing.
- Photo upload via CSV — Phase 16 fabric photo upload is separate.

---

## ESCALATION

Stop and ping Andrew only if:
- A real-world CSV pattern is so far off canonical it requires invented columns (rather than fuzzy mapping).
- Anthropic rate-limited > 30 min.

---

## REPORT BACK

```
Per-track status:
T1 (schema bundle) — ✅ shipped <hash> / 🟡 / ⏸ <reason>
T2 (CSV parser) — ...
T3 (column mapping) — ...
T4 (dry-run endpoint) — ...
T5 (commit endpoint) — ...
T6 (importer UI) — ...
T7 (seed retirement docs) — ...

New routes: <list>
Schema changes pushed: <list>
i18n keys added: <count>
fzcron diag-all-surfaces: ✅ / ❌
Test upload of canonical template: ✅ / ❌
Test upload of messy variant: ✅ / ❌
```
