# UX Audit Request — Per-Role Walkthrough of FUZE Atlas

**Audience:** future Claude (claude-code or Cowork session with browser MCP + computer-use enabled).
**Goal:** produce a structured, evidence-backed bug list for each customer-role surface in production FUZE Atlas (`https://fuzeatlas.com`), keyed off the gap analysis in `docs/ROADMAP_v2.md`.
**Output:** a single markdown report at `docs/audits/ux-audit-<YYYYMMDD>.md` with screenshots and per-page findings.

This is observation-only. Do **not** modify code, do **not** modify production data, do **not** click any destructive control (Delete, Send, Submit, Approve, etc.). The point is to walk every page in every customer-role portal as a real user would, note what works, what doesn't, what's confusing, and what's missing — then hand a prioritized punch list back to Andrew.

---

## 1. Tools to use (in priority order)

1. **`mcp__claude-in-chrome__*`** — DOM-aware browser control. Use this for every navigation, click, scroll, and screenshot. It's faster than computer-use and works on Chrome tabs.
2. **`mcp__computer-use__screenshot`** — only if you need to capture system-level UI (a system dialog, a Mac notification) that isn't inside the browser viewport. Browsers are tier "read" for computer-use; you can't click them, only screenshot.
3. **Bash tool** — for git/file operations (creating the report doc, committing it). Never bash-curl into production endpoints to mutate state.

If the Chrome extension isn't connected, ask Andrew to install it before proceeding rather than falling through to computer-use clicks (which won't work on browser tier).

---

## 2. Prerequisites — confirm before starting

1. Andrew is logged into `https://fuzeatlas.com` as ADMIN in the controlled Chrome tab. Verify by hitting `/admin` and seeing the admin dashboard.
2. Read `CLAUDE.md` for context on roles, models, distributors, and the View-As flow (commit `b2c32e6` — "Distributor: 1-click View As").
3. Read `docs/ROADMAP_v2.md` so you know what gaps are already known. The audit's job is to confirm or refute those gaps with screenshots, plus surface anything new.
4. Confirm `tabs_context_mcp` returns a tab with `fuzeatlas.com` in the URL.

If any prerequisite fails, stop and report rather than proceeding blindly.

---

## 3. Walkthrough sequence — execute in order

For each role, the flow is: get into the role (real account or impersonation), open every page in that portal, record observations, exit.

### 3.1. Admin (sanity baseline — already-logged-in)

You're already admin. Walk these to set the baseline:

- `/admin` — dashboard. Screenshot. Note tile counts.
- `/admin/feedback` — confirm Scott's ticket is FIXED and inbox is at 0 NEW. Confirm 31 FIXED.
- `/admin/weekly-review` — open the most recent. Confirm KPI tiles populate (not the empty-fallback).
- `/admin/bd/wizard` — open a brand. Note all five steps. Don't send anything.
- `/admin/icp-sample-prep` — note the sample-prep wizard. Confirm fabric search works (the May 2026 fix).

**Output for admin:** half a page max. The point is to ground-truth that admin works as expected, so you can flag deviations in customer portals.

### 3.2. Distributor role

There's a built-in 1-click View-As for distributors. From admin:
1. Navigate to `/admin/distributors`.
2. Pick an active distributor (SRS, Texwell, Hi-Goal, Harris & Menuk are the main ones — see `CLAUDE.md` for the full list).
3. Click "View As" on the row. CLAUDE.md says this auto-creates a test user if needed.
4. Confirm the URL flips to `/distributor-portal` and the impersonation banner appears.

Then walk every distributor portal page in this order, **capturing one screenshot per page** plus typed observations:

- `/distributor-portal` (dashboard — stock, daily burn, days-of-stock-left)
- `/distributor-portal/inventory` (edit stock + pricing form)
- `/distributor-portal/restock` (FUZE order — DO NOT SUBMIT)
- `/distributor-portal/orders` and `/distributor-portal/incoming-orders`
- `/distributor-portal/test-request` (DO NOT SUBMIT)
- `/distributor-portal/test-reports`
- `/distributor-portal/upload-report` (DO NOT UPLOAD)
- `/distributor-portal/fabrics`
- `/distributor-portal/documents`
- `/distributor-portal/invoices`
- `/distributor-portal/pricing`

For each page, capture:
- Screenshot
- "What this page does" in one sentence
- Anything broken (broken images, 500s, 'undefined', console errors)
- Anything confusing (jargon, unlabeled buttons, sequence ambiguity)
- Anything missing per `ROADMAP_v2.md` (e.g., is the 5-tier pricing matrix a clean grid or a one-row form?)

Then navigate to `/admin` to drop the impersonation (look for a "Stop View As" banner button).

### 3.3. Factory role

If "View As" exists for factories, use it. If not, ask Andrew for credentials to a test factory account, OR have Andrew temporarily create a `User(role: FACTORY_USER, factoryId: <test factory>)`. Don't proceed without a real factory session — admin-pretending-to-be-factory is not the same UX.

Walk:
- `/factory-portal` (dashboard)
- `/factory-portal/intake` (submit fabric — DO NOT FINAL-SUBMIT, but step through every field)
- `/factory-portal/fabrics`
- `/factory-portal/submissions`
- `/factory-portal/tests` (verify the May 2026 visibility fix — Tina's complaint)
- `/factory-portal/upload-report` (built May 2026 — confirm renders)
- `/factory-portal/request-test` (DO NOT SUBMIT, but step through)
- `/factory-portal/sample-trial` and `/factory-portal/sample-trial/[any-id]` if any exist
- `/factory-portal/orders` and `/factory-portal/orders/[any-id]`
- `/factory-portal/my-requests`

Same capture format as distributor.

**Specifically verify:**
- Does the factory see ALL their fabrics (not just some)?
- Does the factory see ALL tests on those fabrics? Are tests linked to fabrics, or is the link broken?
- Is there a recipe-request UI? (ROADMAP says no — confirm.)
- When the factory clicks a test result, can they download the PDF? Is the report doc surfaced?

### 3.4. Brand role

Same pattern. Pick an active brand from `/admin/brands` (Welspun, or whatever has fabrics + tests against them). View-As if available, else credentials.

Walk:
- `/brand-portal` (dashboard)
- `/brand-portal/fabrics`
- `/brand-portal/submissions`
- `/brand-portal/tests`
- `/brand-portal/contacts`
- `/brand-portal/chat` (FAQ chatbot)

**Specifically verify:**
- Can the brand see WHICH FACTORIES make their fabric? (ROADMAP says no.)
- Per-fabric lifecycle view? (No.)
- Brand profile / requirements wizard? (No.)
- Per-batch ongoing QA visibility? (No.)
- Confirm the four "no"s above with screenshots that show the relevant blank space.

### 3.5. Lab role

Pick an active lab (VL Shanghai, ITS Taiwan, Bureau Veritas — see `CLAUDE.md`). View-As if available, else credentials.

Walk:
- `/lab-portal` (dashboard)
- `/lab-portal/profile`
- `/lab-portal/catalog` (services + pricing)
- `/lab-portal/forms` (the form-list page that ROADMAP says is a passive list — confirm)
- `/lab-portal/upload` and `/lab-portal/uploads`
- `/lab-portal/requests` and any test-detail pages

**Specifically verify:**
- Is `/lab-portal/forms` actually a passive list? Or is there an AI-parser button?
- Can the lab edit their own service catalog? (ROADMAP says yes.)
- Can the lab publish a sample-shipping-info page (ATTN line, hazmat flags)? (ROADMAP says no.)
- Is there a "received sample" action distinct from "Start Testing"? (ROADMAP says no.)
- Lab self-registration page at `/lab-portal/register`? (ROADMAP says no.)

### 3.6. Public verifier (no login)

Open a private/incognito Chrome window via the MCP. Visit:
- `https://fuzeatlas.com/verify/<some-real-batch-code>` — confirm the public batch verification page renders (the QR-code endpoint per CLAUDE.md). If you don't have a batch code, log back into admin in the regular tab, find one in `/admin/consumption` or recent orders, then come back.

This isn't a customer role per se but it's the brand-visible trust surface. Confirm it works.

---

## 4. Cross-cutting checks (after the per-role walkthroughs)

These don't belong to a single role — they're system-wide things to spot:

1. **Brand voice violations.** Search every page you screenshot for the strings `silver`, `nano`, `nanoparticle`, `silver-ion`, or `silver chloride`. Customer-facing copy should never use them. Compliance docs (CIL, SDS, ARSL) may. Flag any customer-facing violation as P0.

2. **i18n state.** On any customer portal page, look for a language switcher in the header. There shouldn't be one (Phase 0 of ROADMAP_v2 will add it). Confirm this baseline so we can verify Phase 0 ships correctly.

3. **Console errors.** For every page, open DevTools → Console once via the MCP, screenshot any red errors. JS errors that don't surface as visible bugs are still build-quality leaks.

4. **Mobile.** Resize the Chrome window to ~390×844 (iPhone 13 viewport) and re-load `/admin`, `/factory-portal`, `/brand-portal`. CLAUDE.md flags "Mobile View Fix" as PLANNED — confirm what's broken so the fix scope is clear.

5. **Document repository.** Visit `/compliance-library`, `/admin/distributor-docs`, `/admin/product-documents`. Note: are documents named consistently? Are there duplicates with different names? (ROADMAP_v2 Phase 2 standardizes naming.)

---

## 5. Output format

Create `docs/audits/ux-audit-<YYYYMMDD>.md` with this structure:

```markdown
# UX Audit — <YYYY-MM-DD>

## Summary
- Pages walked: N
- P0 issues: N (broken — user blocked)
- P1 issues: N (confusing or partial — user can work around)
- P2 issues: N (polish / nice-to-have)
- Brand voice violations: N

## Admin
... one-line baseline confirmations ...

## Distributor portal
### /distributor-portal
- **Status:** ✅ works / ⚠️ partial / ❌ broken
- **Screenshot:** [path/to/screenshot]
- **What works:** ...
- **What's broken:** ...
- **What's missing per ROADMAP_v2:** ...
- **Console errors:** none / list

### /distributor-portal/inventory
... same pattern ...

(repeat per page)

## Factory portal
... same pattern ...

## Brand portal
... same pattern ...

## Lab portal
... same pattern ...

## Public verifier
... one-line ...

## Cross-cutting
- Brand voice violations: list with page + exact string
- i18n: confirmed absent / found switcher at X
- Console errors: aggregate list, dedup'd
- Mobile: per-page broken-on-mobile list
- Document naming: list of inconsistencies

## P0 punch list (build order)
1. ...
2. ...

## P1 punch list
1. ...
```

Save screenshots to `docs/audits/screenshots/<YYYYMMDD>/<role>-<page>.png`. The Chrome MCP `computer` tool with `action: "screenshot"` and `save_to_disk: true` will return a path you can move into the audit folder.

Commit when done:
```bash
cd /Users/a801/Desktop/fuzeatlas
rm -f .git/index.lock
git add docs/audits/
git commit --no-verify -m "docs(audit): UX audit <YYYY-MM-DD>"
git push origin main
```

Then post the report's path back to Andrew.

---

## 6. Things to NOT do

- Don't click Submit, Send, Approve, Delete, Pay, Place Order, anything destructive. Even on test data — production runs against live customer data.
- Don't modify code. The roadmap drives that. This is observation only.
- Don't try to "fix" something you find. File it in the report.
- Don't email anyone. Don't trigger any cron route.
- Don't proceed past prerequisites if you can't confirm one. Report and stop.

---

## 7. If you hit a blocker

Common blockers + what to do:

| Blocker | Action |
|---|---|
| Chrome MCP tabs return empty / not connected | Ask Andrew to open Chrome and verify the extension is connected. Don't fall through to computer-use clicks (browsers are tier "read"). |
| No View-As button on a role | Ask Andrew for read-only test-account credentials for that role, OR have him run `npx tsx scripts/create-test-user.ts <role> <entityId>` if such a script exists, else skip the role and document it. |
| Production page returns 500 | Screenshot, capture the Vercel `x-vercel-id` header, and file as P0. |
| You discover a security issue (e.g., a portal user can see another tenant's data) | STOP THE WALKTHROUGH. File a P0 with the screenshot. Andrew rotates first, you continue after. |

---

## 8. Estimated cost

A thorough walkthrough across 4 customer portals + admin baseline + cross-cutting checks is roughly:
- ~80 pages walked
- ~80-100 screenshots
- ~200 observation lines
- 20-40 minutes of clock time
- ~$5-10 of Anthropic API credit if run via claude-code

The output is a punch list that drives the next 4-6 weeks of build work.
