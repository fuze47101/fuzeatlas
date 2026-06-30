# Phase 16 — Customer-Driven Bug Fixes + Features + Infrastructure Cleanup

**Date filed:** 2026-05-25
**Filed by:** Andrew (via Cowork session)
**Context:** With the i18n full-parity rollout complete (~2,112 commits over 4 days, all 17 locales at 156-namespace parity), Phase 16 picks up the customer feedback queue + infrastructure cleanup items that accumulated during the i18n push.
**Open tickets at start:** 4 NEW (Ryan ×2, Scott, Kaylee), 3 ACCEPTED-and-parked (waiting on customer/Phase-16-roadmap).

---

## STANDING RULES (read first — non-negotiable)

These are enforced session-wide. Repeated from prior specs because they keep getting violated:

1. **300-second auto-resume.** If Code pauses for confirmation and does not receive a change of instruction within 300 seconds, Code MUST carry on and finish the entirety of the spec without further check-ins. The only acceptable reasons to stop and wait are: (a) unrecoverable error blocking all forward progress, (b) genuine ambiguity the spec doesn't address and can't be resolved by reading the codebase, or (c) the entire spec is complete. Status reports between phases are one-line FYI commits, NOT wait-for-permission gates.
2. **No check-ins between tracks.** This spec has 13 tracks. Execute all of them in strict order. Do not stop after Track 1 to ask "should I do Track 2." The answer is always yes.
3. **Brand voice strict across all surfaces.** FUZE / metamaterial / F1-F4 only. NEVER silver / nano / Ag / silver-ion / 銀 / 银 / 纳米 / ナノ / 나노 / سلور / نانو / nano-bạc / plata / gümüş / argento / perak. Source of truth: `src/lib/fuze-knowledge.ts`. Diff grep before every push.
4. **Verify-after-every-push.** Wait Vercel green + `fzcron diag-all-surfaces` green between every commit. Do not chain commits without verification on the bug-fix tracks.
5. **Error-state-not-zeros.** Every widget/dashboard renders an explicit error banner on API 500, never silent fall-through to zeros.
6. **Bearer-authed runtime migration pattern.** Local DATABASE_URL points at empty mirror. Don't run Prisma scripts locally for data fixes — write a bearer-authed `/api/cron/*` endpoint instead.
7. **Git workflow.** `rm -f .git/index.lock .git/HEAD.lock` before commit. `--no-verify` on commit. `prisma db push` for schema changes (not `prisma migrate deploy`).
8. **Auto-close from commit body.** Reference `FeedbackReport` cuid with `Closes <cuid>` / `Fixes <cuid>` / `Resolves <cuid>` prefix (case-insensitive). The hourly cron will FIXED + email-loop automatically.

---

## TRACKS

13 tracks. Strict order: bugs first (customer-visible), small features next, larger features after, infrastructure cleanup last.

---

### TRACK 1 — Ryan BD Sequences "Forbidden" on VIEW (BUG)

**Ticket:** `cmphe6d2f001zjs04jpl8io0g` — Ryan Prince (BD_REP) — May 22.

**Symptom:** Clicking "VIEW" on any account in `/admin/bd/sequences` returns Forbidden. Blocks Ryan's BD workflow.

**Investigation:**
1. Find the VIEW button on `/admin/bd/sequences` and trace where it links to (probably `/admin/bd/sequences/[id]` or `/admin/brands/[id]`).
2. Check the API route + RBAC. The route is likely gated to `ADMIN | EMPLOYEE | SALES_MANAGER` and BD_REP is missing.
3. Cross-reference with how BD_REP accesses other BD surfaces (`/admin/bd/wizard`, `/admin/bd/scoreboard` — which Ryan CAN access).

**Fix:**
- Add `BD_REP` to the ACL on whatever route the VIEW button hits.
- If the role needs additional scoping (e.g. BD_REP can only see brands they own), add `salesRepId = currentUser.id` filter rather than blanket-grant.
- Pattern match: look at `/admin/bd/scoreboard`'s ACL — that already supports BD_REP correctly.

**Commit message MUST include:** `Closes cmphe6d2f001zjs04jpl8io0g`

**Verification:** impersonate Ryan via View As, navigate to `/admin/bd/sequences`, click VIEW on any account, confirm no Forbidden.

---

### TRACK 2 — Ryan SDS link loops back to /home (BUG)

**Ticket:** `cmpegpcrs0001l504w5ntj0yt` — Ryan Prince — May 20. Referer was a brand page (`/brands/cmnpf6cc20011l404udcixnpi`).

**Symptom:** SDS link from brand detail page lands on `/home` instead of the SDS document.

**Investigation:**
1. Read `/brands/[id]/page.tsx` and `/admin/brands/[id]/page.tsx`. Find the "SDS" link/button.
2. Check the href. Could be:
   - Pointing at a route that 404s and redirects to /home
   - Using a stale URL pattern (e.g. `/sds/[code]` that no longer exists)
   - Missing a query param the target page requires
3. Verify the actual SDS document location — likely under `/admin/product-documents` or `/api/sds/[code]`.

**Fix:**
- Correct the href to point at the right SDS surface. Likely `/admin/product-documents` filtered to category=SDS, OR a direct download link if SDS files are stored in S3.
- If the SDS document doesn't exist for the brand Ryan was viewing (Hurricane Ventures or whoever — check `cmnpf6cc20011l404udcixnpi`), add a graceful fallback: "SDS not yet uploaded for this brand. Request it from the product team."

**Commit message:** `Closes cmpegpcrs0001l504w5ntj0yt`

---

### TRACK 3 — Kaylee PDF upload on /admin/product-documents (BUG/UX)

**Ticket:** `cmpfklb840001lb041mh46187` — Kaylee Pace (ADMIN) — May 21.

**Symptom:** `/admin/product-documents` add-document form asks for a URL field. Admins want to upload a PDF file directly.

**Fix:**
1. Read the existing add-document form. Identify the URL input.
2. Replace (or add alongside) a drag-drop file uploader. Reuse the S3 upload pattern already in place for:
   - Feedback screenshots (`/api/feedback` → S3 bucket `fuzeatlas/feedback-screenshots/`)
   - Test reports (`/api/tests/upload`)
   - Bench test photos if any
3. On file upload: POST to a new `/api/admin/product-documents/upload` endpoint that:
   - Accepts `multipart/form-data`
   - Validates content-type (PDF, DOCX, XLSX)
   - Uploads to S3 under `fuzeatlas/product-documents/<docType>/<filename-with-cuid-prefix>.pdf`
   - Returns the public S3 URL
   - That URL becomes the value of the existing URL field
4. Keep the URL input visible as a fallback for documents already hosted externally.

**Commit message:** `Closes cmpfklb840001lb041mh46187`

**Schema note:** if `ProductDocument` table needs a new column for storage method (uploaded vs linked), add `storageType String? @default("URL")`. Use `prisma db push` for schema sync.

---

### TRACK 4 — Scott LinkedIn field on Factory contacts (FEATURE)

**Ticket:** `cmpfmqdzh000dl4044vlt6g24` — Scott Smith (EMPLOYEE) — May 21.

**Symptom:** Brand contacts have a LinkedIn URL field. Factory contacts don't.

**Fix:**
1. Check the `Contact` model in `prisma/schema.prisma`. If brand contacts use the same `Contact` model and `linkedinUrl` field already exists, the field IS in the schema — just needs UI wiring on the factory side.
2. If it's a separate `FactoryContact` model, add `linkedinUrl String?` via `prisma db push`.
3. Add the LinkedIn input field to the factory contact create/edit form at `/factories/[id]/contacts/new` and `/factories/[id]/contacts/[contactId]/edit` (or wherever the form lives).
4. Render the LinkedIn URL on the factory contact detail card with the same icon/styling as brand contact LinkedIn.

**Commit message:** `Closes cmpfmqdzh000dl4044vlt6g24`

---

### TRACK 5 — Distributor self-service factory roster (FEATURE, larger)

**Ticket:** `cmpdnfb9f0001l104s1w3h9i9` — Tina Distributor — already ACCEPTED. Triage note already in DB.

**Scope:**
- Distributor can add a factory to their org without admin in the loop.
- Mirrors the NEED-7a self-service org rosters pattern shipped for brand/factory/distributor/lab teams.

**Build:**
1. **Schema:** new junction `DistributorFactory` (mirror of `BrandFactory`):
   ```
   model DistributorFactory {
     id           String   @id @default(cuid())
     distributorId String
     factoryId    String
     distributor  Distributor @relation(fields: [distributorId], references: [id])
     factory      Factory     @relation(fields: [factoryId], references: [id])
     note         String?
     createdAt    DateTime @default(now())
     @@unique([distributorId, factoryId])
     @@index([distributorId])
     @@index([factoryId])
   }
   ```
   OR reuse `SupplyChainLink` with `fromType=DISTRIBUTOR`, `toType=FACTORY`, `relation=DISTRIBUTES_FOR`. Either works; junction is cleaner if Tina + future distributors will manage this often.

2. **API endpoints** (scoped to distributor + admin):
   - `POST /api/distributor-portal/factories` — body `{ factoryId, note? }`. Creates DistributorFactory link.
   - `DELETE /api/distributor-portal/factories/[id]` — removes link.
   - `GET /api/distributor-portal/factories` — lists current distributor's factories.

3. **UI:** new page `/distributor-portal/factories` (or inline tab on existing `/distributor-portal/factory-orders` page):
   - Table of currently-linked factories
   - "Add Factory" button → modal with searchable picker over Factory table (filter by name/country)
   - "Invite new factory" path — if the factory doesn't exist in Atlas yet, create it + invite a contact via the existing token-invite flow.

4. **Permissions:** only DISTRIBUTOR_USER + DISTRIBUTOR_MANAGER + ADMIN can hit these endpoints. Server-side ACL.

5. **i18n:** add `distributorPortal.factories` namespace to en.ts + all 16 other locale files. Translate.

**Commit message:** `Closes cmpdnfb9f0001l104s1w3h9i9`

---

### TRACK 6 — Fabric photo upload at intake + receipt (FEATURE)

**Ticket:** `cmpd3pexu0001ky0440m4qtio` — Kaylee Pace — already ACCEPTED.

**Scope:**
- Photo at intake: `/fabrics/intake` form gets a drag-drop photo field. Stored to `Fabric.raw.intakePhotoUrl`. Surfaced on `/fabrics/[id]` header.
- Photo at receipt: when a fabric is logged as received at the lab/factory (existing receive flow on FabricSubmission), prompt for a photo of the sample as it arrived (proof of sample quality). Stored to `FabricSubmission.raw.receivedPhotoUrl`.

**Build:**
1. Reuse the S3 upload pattern (Track 3 will already have the file upload helper if shipped first).
2. Add drag-drop component to `/fabrics/intake/page.tsx`.
3. Add drag-drop or "Take photo" button to the FabricSubmission receive flow (find it under `/factory-portal/fabrics/[id]` or wherever receipts are logged).
4. Render both photos on the Recipe Report PDF (`/admin/recipe-calculator/[id]/print` or wherever recipe reports render). Full chain-of-custody from intake → receipt → application.
5. Render thumbnails on the fabric detail header.

**Commit message:** `Closes cmpd3pexu0001ky0440m4qtio`

**Storage:** S3 bucket `fuzeatlas/fabric-photos/<fabricId>/<intake|received>-<timestamp>.<ext>`.

---

### TRACK 7 — Auto-resolve cron re-notify on status transitions (INFRASTRUCTURE)

**Bug pattern:** when a ticket goes TRIAGED → FIXED, the close-loop email doesn't fire because `notifiedAt` was already set when it went to TRIAGED. Penny's ticket exhibited this — she got the TRIAGED email but never the FIXED email.

**Fix:**
- In `/api/cron/auto-resolve-from-commits/route.ts`, change the email-guard from `if (!existing.notifiedAt && updated.userEmail)` to:
  ```
  if (updated.userEmail && existing.status !== "FIXED") {
    // Always email on transition to FIXED, even if previously notified
    // for a different status (TRIAGED, ACCEPTED).
    await sendFixedEmail(updated);
    await prisma.feedbackReport.update({
      where: { id: feedbackId },
      data: { notifiedAt: new Date() },
    });
  }
  ```
- Add the same logic to `/api/cron/admin-resolve/route.ts` so manual admin-resolves also re-notify on status transitions.

**Bonus:** add a `notificationCount` integer column to `FeedbackReport` so we can see how many times a reporter was emailed about a single ticket. Lets us spot spammy fan-outs if they happen.

**No ticket cuid to close — this is infrastructure.**

---

### TRACK 8 — Email confirmation on user account creation (INFRASTRUCTURE — prevents typo bugs)

**Why:** Jany Lu's account was created with typo email `any.lu@...` instead of `jany.lu@...`. She couldn't log in because the typo email didn't match what she typed. Caught after-the-fact via the `diag-user` fuzzy match.

**Build:**
1. On user creation via `/admin/users` create flow (POST `/api/settings/users`), auto-send a verification email to the new user's address with a unique token link.
2. New endpoint: `GET /api/auth/verify-email?token=<token>` — validates token, marks `User.emailVerifiedAt = new Date()`, returns success page.
3. User UI: show a yellow badge on the admin user row for accounts where `emailVerifiedAt IS NULL` after 24 hours (likely a typo — email bounced).
4. If the email bounces (Resend webhook fires `email.bounced`), stamp `User.emailBounceCount += 1` and surface in admin UI.

**Schema add:**
```
model User {
  ...
  emailVerifiedAt    DateTime?
  emailBounceCount   Int       @default(0)
  emailVerifyToken   String?   @unique
  emailVerifyExpiresAt DateTime?
}
```

**Does NOT block existing flows** — user.status stays whatever it was. This is purely a diagnostic signal, not an access gate.

---

### TRACK 9 — Similar-email detection (INFRASTRUCTURE — catches typos upstream)

**Why:** complement to Track 8. Catches typo accounts BEFORE the user can't log in.

**Build:**
- New bearer-authed endpoint: `GET /api/cron/diag-similar-emails`
- For every User in the DB, find Brand contacts AND Factory contacts where the contact's email is within Levenshtein distance 2 of the User's email (and not exact match).
- Returns a list of `(user.id, user.email, suspectedTypoOf: contact.email, distance, contactSource)` for review.
- Optionally: post-creation, flag the new user with a "POSSIBLE_EMAIL_TYPO" notification to admins so they can immediately verify before sending login creds.

**Reporting:**
- Weekly cron emails Andrew a digest if any new suspect typos appear.

---

### TRACK 10 — Bulk-archive admin notifications + auto-archive cron (CLEANUP)

**Symptom:** 5,311 unread notifications in admin per diag. Notification fan-outs from CRM activity, test results, orders, etc. nobody has been clearing.

**Build:**
1. Add a "Mark all read" button to `/notifications` page (filter by current user only, not global).
2. Add a "Mark all read older than 30 days" admin button.
3. New cron `/api/cron/archive-old-notifications` — runs weekly, soft-archives (sets `Notification.archivedAt`) any notification older than 90 days. Doesn't delete — archive flag preserves history.
4. Default `/notifications` query filter: `archivedAt IS NULL` so old noise drops off the list naturally.

**Schema add:** `Notification.archivedAt DateTime?`

---

### TRACK 11 — Server-side i18n for print pages (i18n FOLLOW-UP)

**Why:** Print pages (`*/print/page.tsx`), public verification pages, hangtag QR landing are server-rendered and can't read browser `localStorage` for locale. They render English regardless of user's chosen locale.

**Build:**
- Server-side i18n foundation already exists from May 24 (`src/i18n/core.ts` + `server.ts` + cookie persistence).
- Thread the following pages through the server-side helper instead of `useI18n()`:
  - `/admin/recipe-calculator/[id]/print` (recipe report — already partially handled but verify)
  - `/admin/sample-application/[id]/print` (bench test card)
  - `/verify/[batchCode]` (public batch QR scan)
  - `/verify/sku/[code]` (public hangtag QR scan)
  - `/verified/qr/[token]` (public verification landing)
  - `/verified/[publicSlug]/esg` (public ESG report)
- Accept `?locale=` URL param AND HTTP cookie for locale resolution. URL param wins if both present.
- Customer-facing links (QR codes, hangtags, share links) should include the brand's preferred locale or the original user's locale as `?locale=` in the URL.

**Verification:** open each page with `?locale=vi`, confirm Vietnamese renders. Same for `?locale=ja`, `?locale=zh-CN`.

---

### TRACK 12 — Clean up duplicate-key inserts in ur/es/tr (i18n CLEANUP)

**Symptom:** 3 locales report 157 namespaces vs canonical 156 due to agent-retry duplicate inserts during the full-depth pass. Tsc clean (last definition wins), deepFallback handles, but cosmetic drift.

**Fix:**
- For each of `ur.ts`, `es.ts`, `tr.ts`, find the duplicate top-level key and remove one occurrence. Keep whichever has the better translation if they differ.
- Verify post-fix: each file has exactly 156 namespaces matching en.ts.

---

### TRACK 13 — Native-speaker review routing (i18n PROCESS)

**Why:** every translation commit Code shipped is flagged `NATIVE-REVIEW NEEDED`. Tina covers zh-CN / zh-TW / ja / ko. Other 12 locales need regional reviewers when identified.

**Build:**
1. Create a new admin page `/admin/i18n/review` that shows:
   - All 17 locales with their last-translated timestamp + reviewer assignment + last-reviewed timestamp.
   - "Assign reviewer" picker — searches Contact + User tables for the reviewer's email.
   - "Mark reviewed" button — stamps `last-reviewed-at` + reviewer-id on the locale.
2. Schema: new `LocaleReviewStatus` model (small — `locale, reviewerId, reviewerEmail, lastReviewedAt, notes`).
3. No need to block deploys on review — this is tracking only.

---

## ORDER OF OPERATIONS

Strict. No deviation. No check-ins between tracks.

1. Track 1 (Ryan BD Sequences forbidden) — BUG, highest customer pain
2. Track 2 (Ryan SDS link broken) — BUG
3. Track 3 (Kaylee PDF upload) — BUG/UX
4. Track 4 (Scott LinkedIn on factory contacts) — small FEATURE, easy win
5. Track 7 (Auto-resolve cron re-notify) — INFRASTRUCTURE, unblocks Tracks 1-4 close-loop emails
6. Track 11 (Print page server-side i18n) — i18n follow-up, customer-visible
7. Track 12 (Duplicate-key cleanup) — small, do before Track 13 routing
8. Track 5 (Distributor self-service factory roster) — larger FEATURE
9. Track 6 (Fabric photo upload) — larger FEATURE
10. Track 8 (Email confirmation on creation) — INFRASTRUCTURE
11. Track 9 (Similar-email detection) — INFRASTRUCTURE
12. Track 10 (Notification archive cron) — CLEANUP
13. Track 13 (Native-speaker review routing) — PROCESS

---

## DONE CRITERIA

Per spec, all of the following true:

- [ ] Tickets `cmphe6d2f`, `cmpegpcrs`, `cmpfklb84`, `cmpfmqdzh` all FIXED with close-loop emails sent (via auto-cron with the `Closes` keyword in commit body).
- [ ] Tickets `cmpdnfb9f` (Tina Distributor) and `cmpd3pexu` (Kaylee fabric photo) FIXED via Track 5 and Track 6 respectively, close-loop emails sent.
- [ ] Track 7 cron change verified — manually transition a test ticket TRIAGED → FIXED, confirm FIXED email fires.
- [ ] All print pages render in target locale when `?locale=vi` (or ja, zh-CN, etc.) is appended.
- [ ] Every locale at exactly 156 namespaces (no 157s).
- [ ] `LocaleReviewStatus` table exists + admin page renders.
- [ ] `fzcron diag-all-surfaces` green.
- [ ] No regression in any portal (factory/brand/distributor/lab) — full smoke test via View As impersonation per role.

---

## REPORT BACK FORMAT

```
Per-track status:
T1 (Ryan BD forbidden) — ✅ shipped <hash> / 🟡 in progress / ⏸ blocked <reason>
T2 (Ryan SDS link) — ...
T3 (Kaylee PDF upload) — ...
... (all 13 tracks)

Tickets closed via auto-cron: <list cuids + commit hashes>
Schema changes pushed: <list>
New API endpoints: <list>
New admin UI surfaces: <list>
fzcron diag-all-surfaces: ✅ / ❌
Any escalations Andrew needs to weigh in on: <list>
```

---

## ESCALATION

Stop and ping Andrew (via in-band comment or thumbs-down) ONLY if:

- Schema drift discovered that requires data migration not covered here.
- A bug fix would break an existing customer-facing feature.
- An ambiguity in the spec genuinely can't be resolved by reading the codebase.
- Anthropic API rate limits prevent further progress for >30 minutes.

Otherwise: grind end-to-end.
