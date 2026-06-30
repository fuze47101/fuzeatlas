# Phase 53 — Meeting Notes Module

**Filed:** 2026-05-27
**Why:** Andrew needs a meeting notes module for FUZE project meetings —
weekly per-brand and per-factory check-ins plus the Monday night global
team meeting. Identifies who wrote each note, auto-extracts action items
with assignees + due dates + priority, emails assignees, surfaces a
personal "/my-tasks" board per user.

**Andrew's answers (locked):**
- **Access:** FUZE internal only. No brand/factory user visibility.
- **Cadence:** Recurring series with templates (Monday Global Meeting
  auto-creates next week's note doc).
- **Action items:** Inline mentions in notes auto-create first-class
  task objects on a personal "/my-tasks" page.
- **Email:** Immediate-on-assignment + daily 7am digest of open items.
- **Priority:** Action items sortable by priority (LOW/NORMAL/HIGH/URGENT).

**Self-sufficient — standing rules from CLAUDE.md "NON-NEGOTIABLE
WORKFLOW RULES" apply absolutely. 300-second auto-resume rule. No
questions to Andrew between tracks.**

---

## Track 1 — Schema

Three new Prisma models, applied via bearer-authed `migrate-53-bundle` cron.

```prisma
model MeetingSeries {
  id          String   @id @default(cuid())
  name        String   // "Monday Global Meeting", "KUIU Weekly", "Penfabric Check-in"
  description String?
  cadence     String?  // "weekly", "biweekly", "monthly", "adhoc"
  cadenceDay  Int?     // 0=Sun, 1=Mon, etc. for weekly/biweekly
  cadenceHour Int?     // 0-23 UTC for the auto-creation trigger
  templateMd  String?  // standing agenda template (markdown)

  // Optional brand/factory association — drives auto-tagging on
  // every meeting in the series. Null = internal/global series.
  brandId   String?
  brand     Brand?   @relation(fields: [brandId], references: [id])
  factoryId String?
  factory   Factory? @relation(fields: [factoryId], references: [id])

  active   Boolean @default(true)
  meetings Meeting[]

  createdById String?
  createdBy   User?    @relation("MeetingSeriesCreator", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([active])
  @@index([brandId])
  @@index([factoryId])
}

model Meeting {
  id        String          @id @default(cuid())
  seriesId  String?
  series    MeetingSeries?  @relation(fields: [seriesId], references: [id])

  title         String     // "Monday Global Meeting — 2026-05-26", "KUIU Weekly 2026-W22"
  meetingDate   DateTime
  notesMd       String     @default("")  // append-only markdown body
  status        String     @default("DRAFT") // DRAFT, IN_PROGRESS, COMPLETED, ARCHIVED

  // Tag inheritance — if seriesId is set, brandId/factoryId are
  // inherited at create time but can be overridden per meeting.
  brandId   String?
  brand     Brand?   @relation("MeetingBrand", fields: [brandId], references: [id])
  factoryId String?
  factory   Factory? @relation("MeetingFactory", fields: [factoryId], references: [id])

  // Authorship — who created the meeting record (may not be the only contributor)
  createdById String?
  createdBy   User?   @relation("MeetingCreator", fields: [createdById], references: [id])

  // Append-only per-user note entries — every paragraph or comment a user
  // writes lands as a MeetingNoteEntry so attribution is preserved even
  // if the meeting Markdown gets edited later.
  entries     MeetingNoteEntry[]
  actionItems MeetingActionItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([meetingDate])
  @@index([seriesId])
  @@index([brandId])
  @@index([factoryId])
  @@index([status])
}

model MeetingNoteEntry {
  id        String   @id @default(cuid())
  meetingId String
  meeting   Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  authorId  String
  author    User     @relation(fields: [authorId], references: [id])

  bodyMd    String   // markdown body of this contribution
  isEdit    Boolean  @default(false) // true if this entry edits a prior entry
  editsId   String?  // the MeetingNoteEntry this one edits (nullable)
  edits     MeetingNoteEntry? @relation("EntryEdits", fields: [editsId], references: [id])
  editedBy  MeetingNoteEntry[] @relation("EntryEdits")

  createdAt DateTime @default(now())

  @@index([meetingId])
  @@index([authorId])
}

model MeetingActionItem {
  id        String   @id @default(cuid())
  meetingId String
  meeting   Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  // The MeetingNoteEntry where this action item was extracted from
  // (for traceability — click an action item to jump to its origin)
  sourceEntryId String?
  sourceEntry   MeetingNoteEntry? @relation("ActionItemSource", fields: [sourceEntryId], references: [id])

  description String     // free-text description from the original mention
  assigneeId  String?
  assignee    User?      @relation("ActionItemAssignee", fields: [assigneeId], references: [id])

  // Priority for the /my-tasks sort
  priority    String     @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  dueDate     DateTime?

  status      String     @default("OPEN")   // OPEN, DONE, BLOCKED, CANCELLED
  doneAt      DateTime?
  doneById    String?
  doneBy      User?      @relation("ActionItemCloser", fields: [doneById], references: [id])

  createdById String?
  createdBy   User?      @relation("ActionItemCreator", fields: [createdById], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([assigneeId, status])
  @@index([meetingId])
  @@index([dueDate])
  @@index([priority])
  @@index([status])
}
```

Reverse relations added to User model:
- `meetingsCreated MeetingSeries[] @relation("MeetingSeriesCreator")`
- `meetingsAuthored Meeting[] @relation("MeetingCreator")`
- `meetingEntries MeetingNoteEntry[]`
- `actionItemsAssigned MeetingActionItem[] @relation("ActionItemAssignee")`
- `actionItemsClosed MeetingActionItem[] @relation("ActionItemCloser")`
- `actionItemsCreated MeetingActionItem[] @relation("ActionItemCreator")`

Reverse relations added to Brand and Factory for the brand/factory
auto-tagging.

Apply via `fzcron migrate-53-bundle -X POST` after deploy.

---

## Track 2 — Auto-create-next-meeting cron

`POST /api/cron/create-next-meetings` runs hourly (registered in
vercel.json). For each active MeetingSeries with cadence set:

1. Find the most recent Meeting in the series.
2. Compute the next meeting date based on cadence (weekly = +7 days
   from previous meeting date, biweekly = +14, monthly = +30, adhoc
   = skip — adhoc series never auto-create).
3. If `now() >= nextMeetingDate - 24h`, create a new Meeting with:
   - `title = "${series.name} — ${nextMeetingDate.toISOString().slice(0,10)}"`
   - `notesMd = series.templateMd || ""`
   - `meetingDate = nextMeetingDate`
   - `seriesId = series.id`
   - `brandId = series.brandId` (inherited)
   - `factoryId = series.factoryId` (inherited)
   - `createdById = series.createdById`
   - `status = "DRAFT"`
4. Notify the series creator: "Next meeting in series 'X' has been
   auto-created. Add agenda items before [date]."

Idempotent: if a meeting already exists for the next date in the
series, skip.

---

## Track 3 — Inline mention parser + action item extractor

`src/lib/meeting-mentions.ts` — pure helper. Given a markdown body
and the list of known users, returns:

```typescript
interface ExtractedAction {
  description: string;       // the full sentence/clause
  assignee: User | null;     // matched @mention
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDate: Date | null;
}

export function extractActionItems(
  bodyMd: string,
  users: User[]
): ExtractedAction[];
```

**Mention patterns recognized:**

- `@Tina to send Silvadur SDS by Friday` → assignee=Tina, due=Friday, priority=NORMAL
- `@Tina URGENT: send Silvadur SDS by EOD` → priority=URGENT
- `@andrew to review the KUIU response (high priority) by 2026-06-01` → priority=HIGH, due=2026-06-01
- `@kaylee verify Jany login by tomorrow` → assignee=Kaylee, due=tomorrow
- `[ ] @barth follow up on NY hospitality contracts` → assignee=Barth, no due date, NORMAL

**Name matching:** case-insensitive, first-name OR email-prefix OR
full name. Multiple matches → pick the most-recently-active user.
Ambiguous (e.g., two Tinas) → assignee=null and flag in the action
item description "(@Tina ambiguous — please assign)".

**Priority keywords:** URGENT / HIGH PRIORITY / HIGH / LOW PRIORITY /
LOW (case-insensitive, anywhere in the same paragraph as the mention).

**Date parsing:** absolute (YYYY-MM-DD, MM/DD/YYYY) and relative
(today, tomorrow, Monday, next Friday, EOD, EOW, end of week, by
[date]). Use the existing chrono-node dep if present in package.json,
otherwise small regex-based parser.

Pure function. No DB writes. Called by the meeting save endpoint.

---

## Track 4 — Meeting save + entry-attribution + action-item creation

`POST /api/meetings/[id]/entries` — append a note entry to a meeting:

Body: `{ bodyMd: string, editsEntryId?: string }`

Pipeline:
1. Create a `MeetingNoteEntry` with authorId = currentUser.id.
2. Append the entry body to `Meeting.notesMd` (with author header
   `**[Tina H, 2026-05-27 14:23]**` so the markdown body reads
   chronologically and shows attribution).
3. Run `extractActionItems(bodyMd, allUsers)` on the new entry.
4. For each extracted action item, create a `MeetingActionItem` with
   `sourceEntryId = entry.id`, `createdById = currentUser.id`, and
   the parsed assignee/priority/dueDate.
5. For each newly-created action item with an assignee:
   - Create a Notification for the assignee (existing notification
     system, type="MEETING_ACTION_ASSIGNED").
   - Send the immediate-assignment email (Track 7).

ACL: ADMIN, EMPLOYEE, SALES_MANAGER, SALES_REP, BD_REP. Brand /
factory / distributor / lab roles → 403.

`PATCH /api/meetings/[id]/entries/[entryId]` — edit an existing
entry. Creates a new MeetingNoteEntry with `isEdit=true` and
`editsId=originalEntryId` rather than mutating the original. Original
entry stays in DB for audit; rendering surfaces the latest non-edit
version per author.

---

## Track 5 — `/meetings` and `/meetings/[id]` pages

`/meetings` — landing page with two-column layout:
- Left: list of MeetingSeries (active, sorted by most recently
  updated). Click → filter the right side to that series.
- Right: list of recent Meetings (last 90 days), filterable by series
  + brand + factory + status. Click → open meeting detail.

Headers:
- "New Meeting Series" button — opens modal to create a new
  MeetingSeries with cadence picker + brand/factory association.
- "New Ad-hoc Meeting" button — opens a meeting without a series.

`/meetings/[id]` — meeting detail:
- Header: title, meeting date, series link (if any), brand/factory
  chip, status (DRAFT / IN_PROGRESS / COMPLETED / ARCHIVED)
- Notes panel: rendered markdown of `Meeting.notesMd` with author
  attribution preserved. Inline `@mentions` rendered as styled chips.
  Action items rendered with checkbox + assignee chip + priority
  pill + due date.
- "Add note" footer: persistent text area at the bottom, always-visible
  Save button. Posts to `/api/meetings/[id]/entries`. Triggers
  re-render with the new entry appended.
- Sidebar: list of all action items extracted from this meeting,
  grouped by assignee, with priority sort.
- Status toggle: "Mark Completed" button moves the meeting from
  IN_PROGRESS → COMPLETED.

Real-time-ish: the page polls every 30 seconds for new entries (no
WebSocket needed for v1). Multiple people typing simultaneously will
result in append-after-append entries, attribution preserved.

---

## Track 6 — `/my-tasks` personal action item board

Every user's personal action item dashboard. Pulls every
MeetingActionItem with `assigneeId = currentUser.id`.

Columns / filters:
- **Default view:** open items sorted by (priority desc, dueDate asc).
- **Filters:** status (open/done/blocked/cancelled), priority,
  meeting series, brand/factory, due-date range.
- **Sort:** priority, due date, created date, meeting date.
- **Actions per item:** mark done (single click, stamps doneAt + doneById),
  reassign, change priority, change due date, jump to source meeting.

Surfaces in the sidebar as "✓ My Tasks (N)" where N is the open-item
count, badge updates via the existing pending-counts cron pattern.

ACL: every authenticated user has their own /my-tasks. Admins also
have `/admin/all-tasks` view of everyone's open items grouped by
assignee.

---

## Track 7 — Email — immediate assignment + daily digest

**Immediate assignment email** — fires from the entry creation pipeline
in Track 4 when an action item is assigned. Subject:
`[FUZE Atlas] New action item: ${first 60 chars of description}`.
Body: assigner name, meeting title, full description, priority pill,
due date, deep link to /my-tasks and to the source meeting. Uses the
existing Resend transport.

**Daily digest cron** — `POST /api/cron/action-item-digest`, runs
every day at 7am UTC. For every user with at least one OPEN action
item:
1. Pull all OPEN action items assigned to that user.
2. Group by meeting, within meeting by priority desc.
3. Send email subject: `[FUZE Atlas] You have N open action items`.
4. Body: grouped table with meeting / description / priority / due
   date columns. Deep links to /my-tasks and each source meeting.
5. Silent for users with zero open items — no "inbox zero" noise.

Both email handlers wrapped in try/catch with error-fallback email to
andrew@fuze47.com on uncaught exception, matching the pattern from
the existing CRM digest cron.

---

## Track 8 — Sidebar + module integration

Add new "Meetings" module to the home page card grid and the sidebar
module list (`src/lib/modules.ts`):

```typescript
{
  id: "meetings",
  label: "Meetings",
  labelKey: "meetings",
  icon: "🗒",
  description: "Project meeting notes, action items, weekly standups",
  href: "/meetings",
  isInternal: true,
  items: [
    { label: "All Meetings", labelKey: "meetingsAll", href: "/meetings", icon: "📋" },
    { label: "My Tasks", labelKey: "myTasks", href: "/my-tasks", icon: "✓", badgeKey: "openActionItems" },
    { label: "Series", labelKey: "meetingSeries", href: "/meetings/series", icon: "🔁" },
    { label: "All Tasks (admin)", labelKey: "allTasks", href: "/admin/all-tasks", icon: "📊", adminOnly: true },
  ],
}
```

Wire `openActionItems` badge into `/api/admin/pending-counts` for the
current user's open MeetingActionItem count.

Extend the badgeKey union in `src/lib/modules.ts:32` to include
`"openActionItems"` per the bug we caught with Phase 16.6/17.

i18n keys for the meetings namespace added to `src/i18n/en.ts` —
auto-translate pipeline (once running again post i18n-writer fix)
fans to 16 locales.

---

## Track 9 — Migration cron + diag probes

`POST /api/cron/migrate-53-bundle`:
- `CREATE TABLE IF NOT EXISTS "MeetingSeries"` ...
- `CREATE TABLE IF NOT EXISTS "Meeting"` ...
- `CREATE TABLE IF NOT EXISTS "MeetingNoteEntry"` ...
- `CREATE TABLE IF NOT EXISTS "MeetingActionItem"` ...
- Indexes per the schema definitions.
- Seed one initial MeetingSeries: "Monday Global Meeting" with
  cadence="weekly", cadenceDay=1 (Mon), cadenceHour=2 (Mon 02:00 UTC
  = Sunday 7pm Mountain), templateMd = a starter agenda template.

Extend `/api/cron/diag-all-surfaces` with 4 new probes:
- "Meeting table readable"
- "MeetingActionItem column priority readable"
- "/api/cron/action-item-digest reachable"
- "/api/cron/create-next-meetings reachable"

Update vercel.json:
- `/api/cron/create-next-meetings` — runs hourly (`0 * * * *`)
- `/api/cron/action-item-digest` — runs daily at 7am UTC (`0 7 * * *`)

---

## Track 10 — Verification + push

1. `npx tsc --noEmit` — typecheck clean.
2. Commit per track (one per track for blast-radius control).
3. Push, verify Vercel green between commits.
4. Fire `fzcron migrate-53-bundle -X POST` after final commit.
5. Verify by:
   - Creating a Monday Global Meeting series via the UI
   - Creating an ad-hoc meeting on a brand
   - Adding a note with "@tina to send Silvadur SDS by Friday URGENT"
     → confirm action item created, assigned to Tina, priority=URGENT,
     due=Friday
   - Visit /my-tasks as Andrew, confirm appropriate items appear
   - Wait for next 7am UTC OR fire `fzcron action-item-digest -X POST`
     to confirm the daily digest email path works
6. `fzcron diag-all-surfaces` — should remain green.

---

## Done criteria

- 3 new Prisma models live in prod via migrate-53-bundle
- /meetings page lists series + recent meetings
- /meetings/[id] supports per-user attributed entries
- @mention parser auto-creates action items with priority + due date
- /my-tasks page sorts by priority
- Immediate-assignment email fires on action item creation
- Daily 7am digest cron registered + tested
- Sidebar surfaces Meetings module + My Tasks badge
- Auto-create-next-meeting cron registered + tested
- diag-all-surfaces 50+/N healthy

Report back with: commit chain SHAs, deploy URLs, the Monday Global
Meeting series ID created during seed, one screenshot of the @mention
→ action item conversion working end-to-end.
