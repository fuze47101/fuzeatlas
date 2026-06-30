# Brand Pipeline XLSX Export

**Filed:** 2026-05-26
**Updated:** 2026-05-26 — switched from CSV to true .xlsx per Andrew
**Why:** Andrew can see brand partners + stage on `/admin/brand-pipeline`
but can't download the list. He needs a downloadable file he can hand
to AMs, drop in a board update, or filter in Excel offline. CSV is
unformatted — .xlsx gets frozen header, autofilter, color-coded Stage
column, proper column widths. Sales lead distributing this list to AMs
shouldn't have to format the file themselves every download.

**Self-sufficient — standing rules from CLAUDE.md "NON-NEGOTIABLE
WORKFLOW RULES" apply absolutely. 300-second auto-resume rule in
effect. No questions to Andrew.**

---

## Track 1 — New endpoint `GET /api/admin/brand-pipeline/export`

Mirror the filter/view shape of the existing `GET /api/admin/brand-pipeline`
route exactly so the same UI controls drive the export. Query params:

- `view` — `actionable` | `enriched` | `verified` | `all` | `everything`
  (default `actionable`)
- `mode` — `pipeline` | `accounts` | omit for both
- `stage` — any `PipelineStage` value | omit for all
- `relevance` — `high` | `medium` | `low` | `none` | omit for all
- `search` — substring match on brand name
- `format` — `xlsx` (default) | `csv` (legacy fallback if anyone needs raw)

ACL: same as the read route — `ADMIN`, `EMPLOYEE`, `SALES_MANAGER`,
`SALES_REP`. Distributor / brand / factory users get 403.

The route reuses the where-clause builder from
`/api/admin/brand-pipeline/route.ts`. Extract that into a helper
function (e.g., `buildBrandPipelineWhere(searchParams, user)`) and have
both the JSON read route and the new export route call it. Do not
duplicate the conditions branching — that's the bug surface that lets
the two endpoints drift.

### Library

Use **exceljs** (`npm install exceljs`). Pure JS, no native bindings,
works in Vercel serverless. Streams the xlsx to the response without
buffering the whole workbook in memory. Pattern:

```typescript
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
workbook.creator = "FUZE Atlas";
workbook.created = new Date();

const sheet = workbook.addWorksheet("Brand Pipeline", {
  views: [{ state: "frozen", ySplit: 1 }],
});

sheet.columns = [
  { header: "Brand", key: "name", width: 32 },
  { header: "Stage", key: "stage", width: 22 },
  // ... see column list below
];

sheet.autoFilter = { from: "A1", to: `${lastColLetter}1` };

// Header row styling
sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
sheet.getRow(1).fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" }, // slate-800
};

// Data rows
for (const brand of brands) {
  sheet.addRow({ ... });
}

// Color-code Stage column per row
sheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return;
  const stageCell = row.getCell("stage");
  stageCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: STAGE_COLORS[stageCell.value] || "FFE5E7EB" },
  };
});

const buf = await workbook.xlsx.writeBuffer();
return new Response(buf, {
  status: 200,
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

### Stage color scheme (matches existing pipeline UI tint family)

| Stage | Hex (ARGB) | Why |
|---|---|---|
| `LEAD` | `FFFEF3C7` (amber-100) | early — light amber |
| `PRESENTATION` | `FFDDEAFE` (sky-100) | active outreach |
| `BRAND_TESTING` | `FFE0E7FF` (indigo-100) | brand-side validation |
| `FACTORY_ONBOARDING` | `FFE0F2FE` (sky-100) | factory side |
| `FACTORY_TESTING` | `FFCFFAFE` (cyan-100) | factory lab |
| `PRODUCTION` | `FFD1FAE5` (emerald-100) | producing |
| `BRAND_EXPANSION` | `FFA7F3D0` (emerald-200) | scaling |
| `CUSTOMER_WON` | `FF34D399` (emerald-400) | won — bold emerald |
| `ARCHIVE` | `FFE5E7EB` (gray-200) | dead/cold |

### Columns (in this order)

| # | Header | Source | Excel format |
|---|---|---|---|
| A | Brand | `name` | text |
| B | Stage | `pipelineStage` | text, color-coded |
| C | Sales Rep | `salesRep.name ?? salesRep.email ?? ""` | text |
| D | Website | `website` | hyperlink if non-empty |
| E | LinkedIn | `linkedInProfile` | hyperlink if non-empty |
| F | FUZE Relevance | `fuzeRelevance` | text |
| G | Validation Status | `validationStatus` | text |
| H | Textile Category | `textileCategory` | text |
| I | Customer Type | `customerType` | text |
| J | Contacts | `_count.contacts` | number |
| K | Outreach Sent | `_count.outreachMessages` | number |
| L | Last Activity | `lastActivityAt` | date `yyyy-mm-dd` |
| M | Predicted Value (USD) | `predictedValueUSD` | currency `$#,##0` |
| N | Churn Risk | `churnRiskScore` | percentage `0.0%` |
| O | Date Initial Contact | `dateOfInitialContact` | date `yyyy-mm-dd` |
| P | Presentation Date | `presentationDate` | date `yyyy-mm-dd` |
| Q | HQ Country | `raw.country` if present in JSON | text |
| R | Source | `leadReferralSource` | text |
| S | Notes | first 500 chars of `backgroundInfo`, newlines → spaces | text wrap |

Column widths default to a sensible spread per type (Brand 32, dates 14,
Notes 60, numbers 14, links 40). The Notes column gets `alignment: {
wrapText: true, vertical: "top" }` so long backgrounds wrap instead of
shoving the row off-screen.

Hyperlink cells use `cell.value = { text: url, hyperlink: url }` for
Website and LinkedIn columns.

### Filename pattern

```
brand_pipeline_2026-05-26_actionable.xlsx
brand_pipeline_2026-05-26_actionable_LEAD.xlsx           (stage filter)
brand_pipeline_2026-05-26_accounts_BRAND_TESTING.xlsx    (mode + stage)
```

Date in filename so Finder/Explorer sorts naturally across multiple
downloads on different days.

### Sheet metadata

Workbook properties set so Excel's File → Properties shows:
- Creator: "FUZE Atlas"
- Subject: "Brand Pipeline — <view> — <YYYY-MM-DD>"
- Description: "Generated from /admin/brand-pipeline with filters:
  view=<view>, mode=<mode>, stage=<stage>, relevance=<relevance>,
  search=<search>"

So if Andrew sends the file to a board member 6 months later, they can
see what filters it was generated under.

### Performance

Brand table ~2,500 rows. With `include: { _count: { select: {
contacts: true, outreachMessages: true } }, salesRep: { select: {
name: true, email: true } } }`, the Prisma query is ~1-2s. exceljs
buffer write for 2,500 rows is ~500ms. Total round-trip under 5s.
No pagination needed yet.

If row count exceeds 10,000 add a `console.log("[export]
streaming N brands, est M kb")` so we can spot when it's time to
worry. Don't paginate yet.

---

## Track 2 — UI "Download Excel" button on `/admin/brand-pipeline`

Add a button in the filter-bar row at the top of
`/admin/brand-pipeline/page.tsx`, adjacent to the existing view-mode
toggles. Label: `↓ Download Excel`.

On click, navigate the browser to:

```
/api/admin/brand-pipeline/export?view=<current>&mode=<current>&stage=<current>&relevance=<current>&search=<current>
```

Build the URL from the current filter state in the page's React state.
Just `window.location.href = url` — the response has
Content-Disposition attachment so the browser downloads instead of
navigating. No fetch-then-blob dance needed.

Style: match the existing button family on the page (Tailwind, indigo
or emerald, consistent with the "Run preview" / "Commit import" pattern
from the Phase 18 fabric importer page). Use an inline SVG download
icon, not an emoji.

Tooltip: "Downloads the brand list as Excel with current filters
applied".

---

## Track 3 — i18n + CLAUDE.md

- Add `t.brandPipeline.exportExcel` key to `src/i18n/en.ts` with value
  "↓ Download Excel". Same for `t.brandPipeline.exportExcelHint`. The
  auto-translate pipeline (once the local-script refactor lands) will
  fan to the 16 non-English locales next pass — no manual locale edits
  needed.
- Add a one-line note to CLAUDE.md "Brand Pipeline Views" section
  documenting the new export route + filename pattern + that it's
  true .xlsx, not CSV.

---

## Track 4 — Verification + push

1. `npm install exceljs` and commit the package.json + package-lock.json
   change.
2. `npx tsc --noEmit` — typecheck clean.
3. Commit + push (single commit acceptable since dep-add and route-add
   are tightly coupled, message:
   `feat(admin): brand-pipeline Excel export with filter state and stage color-coding`)
4. Verify Vercel goes READY.
5. `fzcron diag-all-surfaces` should remain green.
6. Visit `/admin/brand-pipeline`, click the new Download Excel button,
   open the downloaded file in Excel/Numbers/LibreOffice and confirm:
   - Header row is frozen (scrolling down keeps it visible)
   - Autofilter dropdowns appear on every header cell
   - Stage column shows the color tint per stage value
   - Website + LinkedIn cells are clickable hyperlinks
   - Unicode brand names (Chinese / Japanese / Tamil) display
     correctly, not as `?` or mojibake
   - Predicted Value column shows as `$36,000` (currency formatted),
     not `36000`
   - Last Activity shows as `2026-05-23`, not as a Unix timestamp
7. Re-export with view=accounts mode=accounts to confirm post-LEAD
   brands also export correctly.

---

## Done criteria

- `GET /api/admin/brand-pipeline/export` ships, returns
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  with proper Content-Disposition.
- `↓ Download Excel` button visible on `/admin/brand-pipeline` for
  admins + internal sales roles.
- Filter state passes through to the export endpoint.
- Excel renders the file with: frozen header, autofilter, stage
  color-coding, currency/date/percentage formatting, working
  hyperlinks, unicode-safe brand names.
- Single commit on main, Vercel green, diag-all-surfaces green.

Report back with commit SHA + deploy URL + confirmation that the
downloaded file opened cleanly in Excel.
