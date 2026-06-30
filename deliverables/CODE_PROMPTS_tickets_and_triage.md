# Code prompts — clear the ticket backlog + fix the auto-triage robot

Two self-contained prompts. Paste **Prompt 1** into Claude Code first (fixes the 3 real bugs and auto-closes the tickets), then **Prompt 2** (makes the auto-triage robot actually pull the backlog).

Live state at hand-off: 11 open feedback tickets (10 NEW + 1 parked). Auto-triage workflow runs green but every run records `newTicketCount: 0 / ticketsAttempted: 0 / prsCreated: 0` while `/api/cron/feedback-list?status=NEW` returns 10 tickets when called directly — so the robot is "green but empty."

---

## PROMPT 1 — Fix the 3 real bugs and auto-close their tickets

```
You are working in the fuzeatlas repo (Next.js 15 / Prisma / Vercel, main = production). Follow the repo conventions in CLAUDE.md: commit with `--no-verify`, `rm -f .git/HEAD.lock .git/index.lock` before each commit, schema changes via `npx prisma db push` (NOT migrate), and use `getRealUser()` for permission gates. Do NOT pause for check-ins — run your own verification (tsc/next build + `fzcron diag-all-surfaces`) between fixes and only escalate on genuine ambiguity or an unrecoverable error.

Fix these three production bugs reported via the feedback widget. For EACH, reproduce first using the existing diagnostic instrumentation, fix the root cause, add a bearer-authed diag probe under /api/cron that asserts the fix in a rolled-back transaction, then commit with the ticket cuid in the commit body using the `Closes <cuid>` convention so the hourly /api/cron/auto-resolve-from-commits cron flips the ticket to FIXED and emails the reporter.

BUG 1 — Kaylee Pace (ticket cmpyq564c0001l404naf8m4hj, PROBLEM): "report submitted, test request not cleared."
- Repro context: she uploaded an ICP report; the TestRequest at /tests/cmpyhpdjy0003kz042e0rgk35 never flipped to a completed/results-received state.
- Root cause I localized: src/app/api/tests/upload/route.ts creates the Document + TestRun but never updates the originating TestRequest status. (src/app/api/tests/[id]/route.ts already has the brand-visible flip + notify pattern to copy from.)
- Fix: when an uploaded report is tied to a TestRequest (directly via a testRequestId, or via the fabric/FabricSubmission the report belongs to), transition that TestRequest to the correct terminal status (read the TestRequestStatus enum from prisma/schema.prisma — likely RESULTS_RECEIVED then COMPLETE — do NOT guess values), stamp the resultsReceivedAt timestamp, and fan out notifyTestRequestStatus to the brand + factory user pools + admins (Penfabric fan-out pattern). Make it idempotent.
- Verify: add /api/cron/diag-replay-report-upload that replays an upload against a TestRequest in a rolled-back tx and asserts the status transitions. Confirm /tests/[id] shows the request cleared.

BUG 2 — Scott Smith (ticket cmpwzk1yw0001jv04eb58u6tk, PROBLEM): "task doesn't open" — on /my-tasks, clicking a task just returns him to the tasks list.
- Root cause I localized: src/app/my-tasks/page.tsx renders src/components/TaskInlineRow.tsx. The rows are inline-edit only — clicking the description calls setEditingDesc(true); the only navigation is a tiny meeting link to /meeting-notes/[meetingNote.id]. There is no reliable "open this task" affordance, so a click looks like a no-op / bounce.
- Fix: make a task row open its source meeting note and surface the specific action item — navigate to /meeting-notes/[meetingNote.id] with the task expanded/scrolled-to/highlighted (e.g. ?task=<id> or #task-<id>, and have /meeting-notes/[id] honor it). Keep the inline-edit affordances (assignee/due/status) working — don't let the whole row navigation swallow those control clicks. Rows where meetingNote is null must degrade gracefully (no dead click). Use the existing [CLICK]/window.__lastClick diagnostics to confirm where the click lands before and after.
- Verify: clicking a task on /my-tasks lands on the correct meeting note with that task visible/highlighted.

BUG 3 — Tina Hong (ticket cmplvllhg0001lb04ysg3sj9u, ERROR): "I clicked on the language and it goes upside down" — selecting a language from the sidebar switcher visually flips/breaks the page.
- Root cause to confirm: src/components/Sidebar.tsx language switcher → src/i18n/I18nProvider.tsx setLocale, which sets document.documentElement.dir = (locale === "ur" ? "rtl" : "ltr"); src/app/layout.tsx also sets RTL; globals.css only styles html[dir="rtl"] .sidebar-nav + inputs. The app is not RTL-ready, so an RTL locale mirrors/breaks the layout. BUT Tina is a Mandarin/JP/KO native and most likely tested zh-CN / zh-TW / ja / ko — so reproduce by cycling ALL 17 locales through the sidebar switcher and identify exactly which one(s) invert the layout and what CSS/transform/dir causes it (grep for stray transform/scaleY/rotate/dir handling).
- Fix: switching to ANY of the 17 locales must change text only — no layout inversion, mirroring, or flip. If the cause is the Urdu dir=rtl on a non-RTL app and full RTL support is out of scope, gate it (keep dir=ltr) so the layout doesn't break, and leave a TODO noting RTL is a future project. If it's a stray transform/CSS rule, remove/scope it.
- Verify: add a short note in the commit on which locale broke and why; confirm cycling all 17 no longer flips anything.

After all three: run `npx tsc --noEmit` (and a production `next build` if feasible), keep `fzcron diag-all-surfaces` green and add probe entries for the three fixes, push to main with the three `Closes <cuid>` commits, confirm the Vercel deploy reaches READY, then run `fzcron auto-resolve-from-commits` to force the close-loop emails to Kaylee, Scott, and Tina.
```

---

## PROMPT 2 — Make the auto-triage robot actually pull the backlog

```
Work in the fuzeatlas repo. The GitHub Action .github/workflows/auto-triage.yml was rebuilt in Phase 57 and now runs without errors (TriageRun rows show healthy:true, lastRunFailed:false), but every run records newTicketCount:0 / ticketsAttempted:0 / prsCreated:0 — while calling /api/cron/feedback-list?status=NEW directly returns the real open NEW tickets. The robot is "green but empty." Diagnose and fix so it pulls and attempts the real backlog, and make the 0-count debuggable for the future.

1. Make the fetch visible. In auto-triage.yml's fetch step (it curls "$ATLAS_BASE_URL/api/cron/feedback-list?status=NEW&limit=50"), log: the HTTP status, the raw response body length, the parsed `.reports | length`, and the first/last ticket ids — into the run's $GITHUB_STEP_SUMMARY. Also extend the callback payload to /api/cron/triage-callback with `rawFetchCount` and `sampleIds`, and surface those on /api/cron/triage-status + the run summary panel, so we never again have an invisible 0-count.

2. Find why the Action sees 0 while the endpoint returns N. Check, in order: (a) is the ATLAS_BASE_URL repo secret set and correct in the Action environment? (b) does the Action's CRON_SECRET secret match the Vercel production CRON_SECRET (a mismatch returns 401, which the HTTP-code guard should catch — confirm it actually does)? (c) are the two recorded TriageRun rows from the Phase-57 smoke-test step posting a 0-count TriageRun rather than the real triage pass? Fix whichever is true. Add the secret pre-check output to the run summary so a missing/wrong secret is obvious.

3. Confirm no later filter drops tickets. The fetch already requests status=NEW (all open NEW, not a delta), so once the fetch works it should pick up every open NEW ticket. Verify nothing downstream re-filters to "created since last run."

4. Re-run and prove it. Trigger via workflow_dispatch and confirm on /api/cron/triage-status that newTicketCount equals the live open-NEW count and ticketsAttempted > 0. NOTE: the triage prompt is intentionally scoped to attempt only BUG / BROKEN_LINK / ERROR / PROBLEM + clear-UI SUGGESTION, so expect it to ATTEMPT the real bugs and SKIP the suggestions/OTHER/parked items — that is correct behavior, not a failure. If Prompt 1 already closed the three bugs, there may be 0 NEW bugs left to attempt; in that case prove the path with the workflow_dispatch `ticket_id` single-ticket input against any one ticket, or by temporarily lowering the scope, then revert.

Self-verify (no check-ins): the workflow run is green, the run summary shows rawFetchCount matching the live count, triage-status shows runsThisWeek incremented with ticketsAttempted > 0 and lastRunFailed:false. Push any code/workflow changes to main with `--no-verify`.
```

---

### Ordering & notes
- Run **Prompt 1 first** — it fixes and closes the three customer-facing bugs today, independent of the robot.
- Then **Prompt 2** repairs the pull→attempt loop so the next batch of bug tickets gets auto-attempted. (Once Prompt 1 closes the three bugs, the robot may legitimately have 0 NEW *bugs* to attempt — Prompt 2 still fixes the 0-count blindspot and proves the path.)
- The 5 SUGGESTION tickets + 2 OTHER + 1 parked ACCEPTED (Tina's Silvadur) are product decisions, not auto-fixes — triage will correctly skip them. Tell me if you want any of them built or acknowledged.
- Connect GitHub via `/mcp` and I can read the actual Action run logs to confirm the exact 0-count cause before you even run Prompt 2.
```
