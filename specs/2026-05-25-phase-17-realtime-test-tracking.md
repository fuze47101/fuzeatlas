# Phase 17 — Real-Time Test Tracking (FedEx-Style)

**Date filed:** 2026-05-25
**Filed by:** Andrew (via Cowork session)
**Why now:** #1 platform wishlist item per CLAUDE.md. Brands ask "where's my test?" weekly. Current answer requires Andrew/Tina to manually look up the TestRequest, check the FabricSubmission, check the LabPortal queue, eyeball the most recent TestRun. That's 5 minutes for one customer to one brand — doesn't scale.
**Inspiration:** FedEx tracking number. Type a number, see ship → in-transit → out-for-delivery → delivered with timestamps. We want the same for FUZE testing: sample shipped → received at lab → in queue → testing → report generated → delivered.

---

## STANDING RULES (read first — same as all prior specs)

1. **300-second auto-resume.** No check-ins between tracks. Execute end-to-end.
2. **Brand voice strict.** FUZE / metamaterial / F1-F4. No silver/nano/Ag in any user-facing string.
3. **Verify-after-every-push.** Vercel green + diag-all-surfaces.
4. **Error-state-not-zeros.** Every widget surfaces error banner on API 500.
5. **Bearer-authed runtime migration.** All schema changes go through `/api/cron/migrate-17-bundle` (you'll write this as Track 1).
6. **Git workflow.** `rm -f .git/index.lock`, `--no-verify` on commit, `prisma db push` for schema.
7. **Auto-close tickets** via `Closes <cuid>` in commit body.
8. **i18n parity.** Any new user-facing string MUST be added to all 17 locale files (en + 16 others). The translation infrastructure is now mature — use it.

---

## EXISTING PRIMITIVES (build on these, don't replace)

| Model | Purpose | Phase 17 role |
|---|---|---|
| `TestRequest` | Brand or factory asks for a test | Entry point — every tracking timeline starts here |
| `FabricSubmission` | Physical sample tracked from origin to lab | Provides the shipping/receipt half of the timeline |
| `TestRun` | Individual test execution + results | Provides the testing/results half |
| `LabPortal queue` | What the lab sees as pending work | State source for "in queue" / "in testing" transitions |
| `Notification` model | In-app notifications | One of the notification channels |
| `Resend` outbound email | Email channel | Email notifications on transitions |
| `SSE notification stream` (`/api/notifications/stream`) | Real-time push to logged-in users | Powers the in-app live updates |

We're NOT inventing a new test model. We're adding a tracking LAYER over the existing models.

---

## SCHEMA ADDITIONS

```prisma
model TestTrackingEvent {
  id           String   @id @default(cuid())
  testRequestId String
  testRequest  TestRequest @relation(fields: [testRequestId], references: [id])
  state        String   // see TRACKING_STATES below
  label        String   // human-readable description shown on tracking page
  occurredAt   DateTime @default(now())
  occurredById String?  // who triggered (lab tech, brand user, system)
  metadata     Json?    // { actor, location, eta, sampleCount, etc. }
  isPublic     Boolean  @default(true)  // some events admin-only (e.g. internal rejects)
  createdAt    DateTime @default(now())

  @@index([testRequestId, occurredAt])
  @@index([state])
}

model TestTrackingToken {
  id           String   @id @default(cuid())
  testRequestId String   @unique
  testRequest  TestRequest @relation(fields: [testRequestId], references: [id])
  token        String   @unique  // 32-char URL-safe, public-shareable
  createdAt    DateTime @default(now())
  expiresAt    DateTime?  // null = never expires
  viewCount    Int      @default(0)
  lastViewedAt DateTime?

  @@index([token])
}

model TestTrackingSubscription {
  id           String   @id @default(cuid())
  testRequestId String
  testRequest  TestRequest @relation(fields: [testRequestId], references: [id])
  userId       String?  // logged-in user
  email        String?  // public email subscription (no login required)
  webPushEndpoint String?  // PWA push subscription endpoint
  webPushKeys  Json?    // p256dh + auth keys
  channels     String   @default("EMAIL,IN_APP")  // EMAIL,IN_APP,WEBPUSH,SMS comma-list
  createdAt    DateTime @default(now())
  unsubscribedAt DateTime?

  @@index([testRequestId, userId])
  @@index([testRequestId, email])
}

// Extend TestRequest with denormalized tracking fields for fast list queries.
// Updates fire on each TestTrackingEvent insert via a trigger or app-layer sync.
model TestRequest {
  // ... existing fields
  trackingState     String?  // latest TestTrackingEvent.state, denormalized
  trackingUpdatedAt DateTime?
  publicTokenId     String?  @unique  // FK to TestTrackingToken, null if not yet shareable
}
```

---

## TRACKING STATES (state machine)

10 states from sample-creation to delivered-report. Ordered. State transitions go forward only (no backwards transitions in normal flow; cancellations are a separate state).

| Order | State | Human label | Triggered by |
|---|---|---|---|
| 1 | `REQUEST_SUBMITTED` | "Test request submitted" | Brand/factory creates TestRequest |
| 2 | `REQUEST_APPROVED` | "Approved by FUZE — preparing shipping label" | Admin approves (or auto-approve rule) |
| 3 | `SAMPLE_SHIPPED` | "Sample shipped from factory" | FabricSubmission.shippedAt set |
| 4 | `SAMPLE_IN_TRANSIT` | "In transit — tracking number {tn}" | Optional, manual or carrier API |
| 5 | `SAMPLE_RECEIVED` | "Received at lab — in queue" | Lab marks received |
| 6 | `LAB_IN_QUEUE` | "In queue — estimated start {date}" | Lab acknowledges |
| 7 | `LAB_TESTING` | "Testing in progress" | Lab tech starts work |
| 8 | `RESULTS_AVAILABLE` | "Results ready — under review" | TestRun created |
| 9 | `BRAND_VISIBLE` | "Report sent to brand" | TestRun.brandVisible flipped true |
| 10 | `COMPLETE` | "Closed" | Manual or auto after BRAND_VISIBLE + 30 days |

**Cancellation state:** `CANCELLED` at any point. Records reason + actor.

**Expected dwell time** at each state (used to calculate ETA):
- REQUEST_SUBMITTED → REQUEST_APPROVED: 1 business day median
- REQUEST_APPROVED → SAMPLE_SHIPPED: factory-dependent (3-14 days typical)
- SAMPLE_SHIPPED → SAMPLE_RECEIVED: 5-7 days international, 1-2 domestic
- SAMPLE_RECEIVED → LAB_IN_QUEUE: same-day to 2 days depending on lab
- LAB_IN_QUEUE → LAB_TESTING: 3-10 days depending on lab + test type
- LAB_TESTING → RESULTS_AVAILABLE: 1-3 days for ICP, 5-7 days for AM
- RESULTS_AVAILABLE → BRAND_VISIBLE: admin review, 1-2 days
- BRAND_VISIBLE → COMPLETE: 30 days auto-close

---

## TRACKS

10 tracks. Strict order.

### TRACK 1 — Schema bundle + migration endpoint

Build `/api/cron/migrate-17-bundle/route.ts` that creates all three new tables + extends TestRequest. Idempotent. Bearer-authed.

Run `npx prisma generate` after pushing schema. Fire migration cron via `fzcron migrate-17-bundle -X POST`.

### TRACK 2 — TestTrackingEvent recording infrastructure

- New helper `src/lib/test-tracking.ts` exports `recordTrackingEvent({testRequestId, state, label?, metadata?, occurredById?})`. Inserts TestTrackingEvent row, updates TestRequest.trackingState + trackingUpdatedAt, fans out to subscribers (Track 6).
- Wire helper into existing state-transition code:
  - TestRequest creation → `REQUEST_SUBMITTED`
  - TestRequest approval (status PATCH) → `REQUEST_APPROVED`
  - FabricSubmission.shippedAt set → `SAMPLE_SHIPPED`
  - FabricSubmission.receivedAt set → `SAMPLE_RECEIVED`
  - Lab dashboard "Accept" button → `LAB_IN_QUEUE`
  - Lab dashboard "Start" button → `LAB_TESTING`
  - TestRun creation → `RESULTS_AVAILABLE`
  - TestRun.brandVisible = true → `BRAND_VISIBLE`
- Add admin action to manually transition state with a reason (admin error correction).

### TRACK 3 — Public tokenized tracking URL

- New page at `/track/[token]` (no auth required, public).
- Route handler validates token, loads TestRequest + TestTrackingEvent history.
- Render:
  - Header: test number, brand name, fabric reference (FUZE# + customer code)
  - Vertical timeline of state transitions with timestamps + actor
  - Next-expected-state with ETA based on dwell-time medians
  - "Subscribe to updates" form (email or web push)
- Bumps TestTrackingToken.viewCount + lastViewedAt on every page view.
- Mobile-first responsive (brands check on phones).

### TRACK 4 — Token generation + management UI

- Auto-generate a TestTrackingToken on TestRequest creation. URL-safe 32-char (use `crypto.randomBytes(24).toString('base64url')`).
- Add "Share tracking link" button to `/admin/test-requests/[id]` + `/brand-portal/tests/[id]`. Click → modal shows the public URL + copy-to-clipboard.
- Admin can rotate (regenerate) the token if needed (e.g. shared with wrong party).
- Admin can set an expiration date.

### TRACK 5 — Internal status dashboard

- New admin page `/admin/test-tracking` showing every TestRequest with its latest tracking state.
- Filterable by state, brand, factory, lab, time-in-current-state.
- Sortable by oldest-in-current-state (catches stuck tests).
- "Stuck test" alert: if a request has been in a state longer than 2× the median dwell time, surface a yellow badge.
- Per-row link to the public tracking URL + the internal admin TestRequest page.

### TRACK 6 — Notification fan-out on state transition

For each TestTrackingEvent inserted, fan out to all TestTrackingSubscription rows where `unsubscribedAt IS NULL` and `channels INCLUDES <channel>`:

- **IN_APP:** existing `Notification` model insert. Already works.
- **EMAIL:** Resend send to TestTrackingSubscription.email. Template includes state label, ETA to next state, public tracking URL.
- **WEBPUSH:** Web Push API to TestTrackingSubscription.webPushEndpoint. Requires VAPID keys (add to env).
- **SMS:** Twilio send to user.phone if set. Optional — only if `channels` includes SMS.

Each notification log to `Notification` model (even non-in-app) so we have an audit trail.

### TRACK 7 — Subscribe-to-updates flow (public)

On `/track/[token]` page:
- Email subscribe form (one-click, no account creation needed). Creates TestTrackingSubscription row with `email` set.
- "Enable browser notifications" button (web push subscribe flow — requires VAPID key + service worker).
- Unsubscribe link in every email + push notification.
- One-click unsubscribe via `/track/unsubscribe/[subId]?token=<sig>` URL.

### TRACK 8 — Test request brand portal integration

- `/brand-portal/tests` page lists every test for the brand. Each row shows current state + last-updated timestamp + ETA chip.
- Click row → goes to internal brand-portal tracking view (same data as public `/track/[token]` but inside the authenticated portal with brand-context filters).
- "Watch this test" button → creates IN_APP + EMAIL subscription scoped to the logged-in user.

### TRACK 9 — Estimated time calculation

- New helper `src/lib/test-tracking-eta.ts`:
  - For each state transition pair, compute the median dwell time from historical TestTrackingEvent data (last 90 days, exclude weekends, exclude CANCELLED tests).
  - Cache median results in-memory for 1 hour (or store in a tiny KV-like table).
- Public + internal tracking pages display: "Expected to transition to {nextState} on {date}" using the median + current state's start timestamp.
- Render "Behind schedule" warning if current state has exceeded 1.5× the median.

### TRACK 10 — i18n + accessibility

- Every new string on `/track/[token]`, `/admin/test-tracking`, subscribe modal, email templates → added to all 17 locale files. Use the established translation workflow + brand-voice rules.
- Email templates: localize subject + body. Use the user's stored locale preference (logged-in users) or browser Accept-Language header (public subscribers).
- Web push notifications: localize the title + body.

---

## DONE CRITERIA

- [ ] Schema migrated, all 3 new tables in prod DB via fzcron migrate-17-bundle.
- [ ] Existing state-transition code wired through `recordTrackingEvent()`.
- [ ] Public `/track/[token]` page renders timeline + ETA for any test, no login required.
- [ ] Token auto-generated on TestRequest creation, copyable from admin and brand-portal test detail pages.
- [ ] `/admin/test-tracking` dashboard lists all in-flight tests with stuck-test alerts.
- [ ] Subscriptions fan out to IN_APP + EMAIL channels (WEBPUSH and SMS can ship Phase 17.5 if VAPID setup takes too long).
- [ ] Brand portal `/brand-portal/tests` shows live state + ETA per test.
- [ ] All new strings localized to all 17 locales.
- [ ] fzcron diag-all-surfaces green with new test-tracking entries added.

---

## OUT OF SCOPE (Phase 17.5+)

- SMS notifications (Twilio integration — depends on phone number coverage)
- Web push notifications (requires VAPID key generation + service worker — can ship as a follow-up after Track 1-9 land)
- Carrier API integration for SAMPLE_IN_TRANSIT (FedEx/DHL/UPS tracking number → live carrier updates) — manual entry only for v1
- Predictive failure detection ("this test is 80% likely to need a retest based on similar fabrics") — Phase 18
- Multi-test bundle tracking (one shipment = multiple tests) — current scope is one-test-per-tracking-link

---

## ESCALATION

Stop and ping Andrew only if:
- VAPID key generation requires a domain change or DNS update he needs to approve
- Schema change conflicts with an active TestRequest record in a way that requires data migration not covered here
- Anthropic rate-limited > 30 min

Otherwise grind end-to-end.

---

## REPORT BACK FORMAT

```
Per-track status:
T1 (schema bundle) — ✅ shipped <hash>
T2 (recording infrastructure) — ...
... (all 10)

Schema changes pushed to prod: <list>
New routes: <list>
i18n keys added (count): <number>
fzcron diag-all-surfaces: ✅ / ❌
First test tracking URL example: https://fuzeatlas.com/track/<sample-token>
Escalations: <list>
```
