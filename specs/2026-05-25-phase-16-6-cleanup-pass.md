# Phase 16.6 — Cleanup Pass (Bulk-Archive + Verify Phase 16 Tracks + Similar-Email UI)

**Date filed:** 2026-05-25
**Filed by:** Andrew (via Cowork session)
**Why now:** Phase 16 shipped 13 tracks. Three items need follow-through:
1. The 5,317 unread admin notifications backlog from before the archive cron existed — needs one-time bulk-archive
2. Phase 16 Track 11 (server-side i18n for print pages) and Track 12 (duplicate-key cleanup in ur/es/tr) reportedly shipped but never explicitly verified
3. Phase 16 Track 9 (similar-email detection cron endpoint) shipped but has no UI to surface flagged users to admins — sitting unused

Small, well-bounded. One Code session.

---

## STANDING RULES

1. **300-second auto-resume.** No check-ins between tracks.
2. **Brand voice strict.** No silver/nano/Ag across 17 locales.
3. **Verify-after-every-push.** Vercel green + diag-all-surfaces.
4. **Bearer-authed runtime migration** if any schema changes.
5. **Git workflow.** `rm -f .git/index.lock`, `--no-verify` on commit.
6. **i18n parity.** New UI strings to all 17 locales.

---

## TRACKS

5 tracks. Strict order.

### TRACK 1 — Bulk-archive 5,317 unread admin notifications

Phase 16 Track 10 shipped the archive cron + the `archivedAt` column. But the existing 5,317-row backlog wasn't archived (cron only runs forward from when it was deployed).

Build a one-time bulk action:
- New bearer-authed endpoint: `POST /api/cron/bulk-archive-old-notifications`
  - Body: `{ olderThanDays: number }` (default: 30)
  - Sets `Notification.archivedAt = now()` for all notifications where `archivedAt IS NULL` AND `createdAt < (now - olderThanDays)`
  - Returns `{ archived: N, remaining: M }`
- Fire it manually via `fzcron bulk-archive-old-notifications -X POST -d '{"olderThanDays":30}'`
- Expect to archive ~4,500-5,000 of the 5,317 (anything > 30 days old).

After this lands, the recurring archive cron (also from Phase 16) keeps the backlog from regrowing.

### TRACK 2 — Verify Phase 16 Track 11 (server-side i18n for print pages)

Phase 16 Track 11 reportedly threaded these pages through the server-side i18n helper:
- `/admin/recipe-calculator/[id]/print`
- `/admin/sample-application/[id]/print`
- `/verify/[batchCode]`
- `/verify/sku/[code]`
- `/verified/qr/[token]`
- `/verified/[publicSlug]/esg`

Spot-check by opening each URL with `?locale=zh-CN` or `?locale=vi` in the URL. Verify the page renders in target locale, not English fallback.

If any are still English-only:
- Identify whether they're missing the server-side useTranslations call
- OR they're using client-side useI18n but rendered server-side (fundamental mismatch — needs refactor)

Ship fixes for any gaps. Commit per page.

### TRACK 3 — Verify Phase 16 Track 12 (duplicate-key cleanup in ur/es/tr)

Phase 16 reportedly fixed duplicate top-level keys in ur.ts, es.ts, tr.ts. Verify:

```bash
for loc in ur es tr; do
  n=$(grep -c '^  [a-zA-Z]\+: {' src/i18n/$loc.ts)
  echo "$loc: $n namespaces (expect 156)"
done
```

If any still > 156, find the duplicate and remove the inferior copy. Commit per locale.

### TRACK 4 — Similar-email detection admin UI

Phase 16 Track 9 shipped `/api/cron/diag-similar-emails` endpoint that returns users with emails within Levenshtein distance 2 of known Brand/Factory contact emails. Currently no UI surfaces this data.

Build:
- New page: `/admin/users?filter=suspect-email-typo`
- Query the diag endpoint on page load.
- Render a table:
  - Suspect user (name + email)
  - Possible match (contact name + email + source: Brand/Factory)
  - Levenshtein distance
  - Action buttons: "Fix email" (opens inline edit), "Ignore" (stamps a flag so this pair doesn't surface again), "Confirm match" (links the User to the Contact in the relevant brand/factory)
- Show count badge on the admin sidebar when count > 0.
- Background cron (weekly): re-runs the diag, fires a notification to Andrew if any new suspect pairs appear.

Schema add for "ignore" action:
```prisma
model SimilarEmailIgnore {
  id           String   @id @default(cuid())
  userId       String
  contactEmail String
  ignoredById  String
  ignoredAt    DateTime @default(now())
  reason       String?
  @@unique([userId, contactEmail])
}
```

Migration via `/api/cron/migrate-16-6-bundle` (bearer-authed).

### TRACK 5 — Verify + report

After Tracks 1-4 land:
- Run `fzcron diag-all-surfaces` — expect 50+ surfaces healthy
- Run `fzcron diag-similar-emails` — expect a clean list (or some flagged pairs for Andrew to review via the new UI)
- Browse the new `/admin/users?filter=suspect-email-typo` page — confirm it renders
- Verify `/notifications` count dropped from 5,317 to <500 after bulk-archive

---

## DONE CRITERIA

- [ ] `/notifications` admin page shows < 500 unread (was 5,317).
- [ ] All 6 print/public pages from Phase 16 Track 11 render in target locale via `?locale=` URL param.
- [ ] ur.ts, es.ts, tr.ts each exactly 156 namespaces.
- [ ] `/admin/users?filter=suspect-email-typo` page renders with the diag results.
- [ ] Sidebar shows badge count when suspect pairs exist.
- [ ] Schema migration for SimilarEmailIgnore applied via `fzcron migrate-16-6-bundle`.
- [ ] `fzcron diag-all-surfaces` green.

---

## OUT OF SCOPE

- Automatic typo-correction (we surface for human review, never auto-modify user emails).
- Phonetic similarity matching (only Levenshtein for now — works for typos, less reliable for "John" vs "Jon").
- ML-based "is this the same person across systems" matching — Phase 20+.

---

## ESCALATION

Stop and ping Andrew only if:
- Bulk-archive endpoint times out (archive in batches of 1,000 if needed).
- A print page can't be threaded through server-side i18n without refactoring the page itself (then file as Phase 17 follow-up).

---

## REPORT BACK

```
Per-track status:
T1 (bulk-archive notifications) — ✅ shipped <hash>, archived N of 5,317
T2 (verify print page i18n) — ✅ all 6 pages translate / 🟡 N pages still English (list)
T3 (verify duplicate-key cleanup) — ✅ all 3 locales at 156 / 🟡 N locales still off
T4 (similar-email admin UI) — ✅ shipped <hash>
T5 (verify) — fzcron diag-all-surfaces ✅ / ❌

New routes: <list>
Schema changes pushed: <list>
i18n keys added: <count>
Notifications archived: <count>
```
