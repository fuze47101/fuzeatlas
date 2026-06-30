# Phase 54 — Project Start Wizard

**Filed:** 2026-05-27
**Why:** Andrew wants a wizard for creating new FUZE projects with
clear owner, internal-hit-list goal narrative, and a starting set of
action items. Pairs naturally with the Phase 52 sample grid view at
`/admin/projects/[id]` and the Phase 53 meeting notes module.

**Andrew's locked answers:**
- **Customer types:** Three options — Brand, Factory, or Internal
  (Internal covers competitive poaching like "Project Red Rover",
  R&D, etc. — no customer FK required).
- **Initial tasks:** Explicit per-task form rows (description +
  assignee + priority + due date). No @mention parsing in the
  wizard — that magic stays in ongoing meeting notes.

**Self-sufficient — standing rules from CLAUDE.md "NON-NEGOTIABLE
WORKFLOW RULES" apply absolutely. 300-second auto-resume rule. No
questions to Andrew between tracks.**

---

## Track 1 — Schema additions

Extend the existing `Project` model in `prisma/schema.prisma`:

```prisma
model Project {
  // ... existing fields ...

  // ─── Phase 54 — Project Start Wizard fields ──────────────
  projectType String @default("BRAND") // BRAND, FACTORY, INTERNAL
  ownerId     String?
  owner       User?   @relation("ProjectOwner", fields: [ownerId], references: [id])
  goalMd      String?  // markdown body — internal hit-list narrative

  // FK to the auto-created Project Kickoff meeting (Phase 53 Meeting model)
  kickoffMeetingId String? @unique
  kickoffMeeting   Meeting? @relation("ProjectKickoff", fields: [kickoffMeetingId], references: [id])

  // ... existing relations ...

  @@index([projectType])
  @@index([ownerId])
}
```

Reverse relations:
- `User.projectsOwned Project[] @relation("ProjectOwner")`
- `Meeting.projectKickoffFor Project? @relation("ProjectKickoff")` (1:1, unique)

**Existing `Meeting` model from Phase 53:** add an optional `projectId` so
a meeting can be tagged to a project (initial kickoff meeting + future
project standups):

```prisma
model Meeting {
  // ... existing fields ...
  projectId String?
  project   Project? @relation("MeetingProject", fields: [projectId], references: [id])
  @@index([projectId])
}
```

Reverse on Project: `meetings Meeting[] @relation("MeetingProject")`.

Apply via bearer-authed `POST /api/cron/migrate-54-bundle` — idempotent
ALTER TABLE ADD COLUMN IF NOT EXISTS for all four columns + indexes.

---

## Track 2 — Wizard page at `/admin/projects/new`

4 steps, client-rendered, posts to `/api/admin/projects` on submit.

### Step 1 — Customer type

Three large cards side-by-side:

| Card | Label | Description |
|---|---|---|
| 🏷 BRAND | Brand project | "Tied to a specific brand partner. e.g., KUIU Performance Line, North Face Activewear, Lululemon F1 Pilot." |
| 🏭 FACTORY | Factory project | "Tied to a specific factory partner. e.g., Penfabric Capacity Expansion, Hurricane Site Setup, Welspun Onboarding." |
| 💼 INTERNAL | Internal project | "FUZE-internal initiative without an external customer. e.g., Project Red Rover, Sustainability PDF Series, Lab Equipment Build." |

Pick one. Next button enabled on selection. Saved to wizard state.

### Step 2 — Pick the entity (Brand or Factory only)

For BRAND: autocomplete search over Brand list (admin scope — sees
all brands). Pre-fills the search with any active filter on
`/admin/brand-pipeline` if the wizard was opened from there.

For FACTORY: autocomplete over Factory list.

For INTERNAL: **skip this step entirely**, advance straight to Step 3.

Both pickers render selected entity with a small card showing name +
location + sales rep (for brands) or country + active distributor
(for factories) so the user confirms before proceeding.

### Step 3 — Project name, owner, goal

Three form fields:

1. **Project name** (required) — e.g., "KUIU Performance Fabric F1
   Trial", "Penfabric Q3 Production Ramp", "Project Red Rover".
   For Brand/Factory projects, auto-suggest a default: `${brand|factory.name} — ${monthYear}` editable.

2. **Owner** (required) — autocomplete over internal users with role in
   {ADMIN, EMPLOYEE, SALES_MANAGER, SALES_REP, BD_REP}. Default to
   the brand's `salesRepId` or factory's `salesRepId` if set, otherwise
   the current user.

3. **Goal — internal hit list** (optional but encouraged) — markdown
   textarea, monospace font, ~12 rows tall. Help text below:
   "Internal-only narrative. Why we're doing this, what success looks
   like, who needs to be involved, what we're not committing to.
   Different from the customer-facing SOW. Markdown supported."

Next advances to Step 4.

### Step 4 — Initial tasks (explicit form rows)

Repeating row table:

| Description | Assignee | Priority | Due Date | (X) |
|---|---|---|---|---|

- **Description** — text input, required when row has content
- **Assignee** — autocomplete user picker, defaults to owner from Step 3
- **Priority** — dropdown: LOW / NORMAL / HIGH / URGENT (default NORMAL)
- **Due Date** — date picker, optional. Quick-buttons for "Today", "EOW", "Next Friday", "+1 week", "+2 weeks"
- **(X)** — remove row

"+ Add task" button below the table adds another empty row. Page
starts with 3 empty rows. Empty rows on submit are ignored.

No @mention parsing — pure form data. Andrew's answer locks this.

### Step 5 — Review + Create

Summary screen showing every field selected. "Create Project" button
fires the POST.

Modal cancel from any step returns to `/admin/projects` (or wherever
they came from) without persisting state.

---

## Track 3 — `POST /api/admin/projects`

Single atomic transaction creating Project + optionally Meeting +
MeetingActionItem rows. ACL: ADMIN, EMPLOYEE, SALES_MANAGER,
SALES_REP, BD_REP.

Request body shape:

```typescript
{
  name: string;
  projectType: "BRAND" | "FACTORY" | "INTERNAL";
  brandId?: string;       // required if projectType=BRAND
  factoryId?: string;     // required if projectType=FACTORY
  ownerId: string;
  goalMd?: string;
  initialTasks: Array<{
    description: string;
    assigneeId: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    dueDate?: string;     // ISO date
  }>;
}
```

Validation:
- `name` required, non-empty
- `projectType` valid enum
- `brandId` required when `projectType === "BRAND"`, similarly for factory
- `ownerId` references a real User
- Every `initialTasks[i].assigneeId` references a real User

Pipeline:

1. Begin Prisma transaction
2. Create `Project` with name, projectType, brandId/factoryId,
   ownerId, goalMd, stage="DEVELOPMENT"
3. Create kickoff `Meeting`:
   - title = `"Project Kickoff — ${project.name}"`
   - meetingDate = now()
   - status = "COMPLETED"
   - projectId = the new project.id
   - brandId / factoryId inherited from project
   - createdById = currentUser.id
4. Patch `Project.kickoffMeetingId = meeting.id`
5. Create `MeetingNoteEntry` on the kickoff meeting:
   - authorId = currentUser.id
   - bodyMd = `"## Project Goal\n\n${goalMd || '(no goal narrative provided)'}\n\n## Initial Tasks\n\n${initialTasks.map(t => '- ' + t.description + ' (@' + t.assignee.firstName + ', ' + t.priority + ', due ' + (t.dueDate || 'unset') + ')').join('\n')}"`
6. For each `initialTasks[i]`, create a `MeetingActionItem`:
   - meetingId = the kickoff meeting
   - sourceEntryId = the entry above
   - description, assigneeId, priority, dueDate per the row
   - status = "OPEN"
   - createdById = currentUser.id
7. Commit transaction
8. For each created action item, fire the existing immediate-assignment
   email pipeline from Phase 53 Track 7
9. Return `{ ok, projectId, kickoffMeetingId, actionItemCount, actionItems: [...] }`

If any step throws, rollback the entire transaction. Return error with
diagnostic detail so the UI can surface what went wrong.

---

## Track 4 — Extend `/admin/projects/[id]` page

Phase 52 Track 3 already shipped the sample grid view. Add a header
section above it:

```
┌─────────────────────────────────────────────────────────┐
│ [Project Name]                       [🏷 BRAND] [Stage]  │
│ Owner: [Avatar] Tina Hong (change ▾)                    │
│ Brand: KUIU                                              │
│ Created: 2026-05-27 by Andrew                            │
├─────────────────────────────────────────────────────────┤
│ [Tabs: Overview | Sample Grid | Tasks | Meetings]       │
└─────────────────────────────────────────────────────────┘
```

**Overview tab:**
- Goal section (rendered markdown of `project.goalMd`, with Edit
  button for owner + admins)
- Stats tiles: # action items (open/total), # meetings, # samples,
  # test requests, projected value (BRAND/FACTORY only — hidden for
  INTERNAL)
- Recent activity feed (last 5 entries: meeting note entries, action
  item state changes, sample submissions) sorted by most recent

**Sample Grid tab:** existing Phase 52 view, unchanged.

**Tasks tab:** every `MeetingActionItem` where the parent `Meeting.projectId === project.id`.
Same UI as `/my-tasks` but scoped to this project. Sortable by priority
+ due date. Click an action item to mark done / change assignee /
change priority.

**Meetings tab:** every `Meeting` with `projectId === project.id`,
sorted by date desc. Click into any meeting → opens the existing
`/meeting-notes/[id]` page.

**Change owner button:** opens a modal with user autocomplete, posts
`PATCH /api/admin/projects/[id]` with `{ ownerId }`. ACL: ADMIN +
current owner only.

---

## Track 5 — Edit project endpoint

`PATCH /api/admin/projects/[id]` — accepts partial updates:

```typescript
{
  name?: string;
  ownerId?: string;
  goalMd?: string;
  projectType?: string;
  stage?: string;
  brandId?: string | null;
  factoryId?: string | null;
}
```

ACL: ADMIN, EMPLOYEE, SALES_MANAGER, plus the current project owner
can edit `goalMd` and `name` (but not `ownerId` — owner-change requires
admin or the outgoing owner approving).

On owner change, notify the new owner via the existing notification
system: "You've been assigned ownership of project: ${name}".

---

## Track 6 — Sidebar + module integration

The "Meetings" module from Phase 53 stays. Add a new "Projects" entry
on the existing module hierarchy (Phase 52 Track 3 shipped
`/admin/projects` list page).

Sidebar item structure under the existing "Operations" or "Sales &
Pipeline" module group (read `src/lib/modules.ts` to find the right
home — likely a new top-level "Projects" entry alongside Meetings):

```typescript
{
  id: "projects",
  label: "Projects",
  labelKey: "projects",
  icon: "🎯",
  href: "/admin/projects",
  isInternal: true,
  items: [
    { label: "All Projects", labelKey: "projectsAll", href: "/admin/projects", icon: "📋" },
    { label: "New Project", labelKey: "projectNew", href: "/admin/projects/new", icon: "+" },
    { label: "My Projects", labelKey: "projectsMine", href: "/admin/projects?owner=me", icon: "👤" },
  ],
}
```

i18n keys added to `src/i18n/en.ts` under a new `projects` namespace.

---

## Track 7 — Migration cron + diag probes

`POST /api/cron/migrate-54-bundle`:

```sql
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'BRAND';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "goalMd" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "kickoffMeetingId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Project_projectType_idx" ON "Project"("projectType");
CREATE INDEX IF NOT EXISTS "Project_ownerId_idx" ON "Project"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_kickoffMeetingId_key" ON "Project"("kickoffMeetingId") WHERE "kickoffMeetingId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Meeting_projectId_idx" ON "Meeting"("projectId");
```

Add foreign-key constraints conditionally if they don't exist (use
information_schema check; PostgreSQL will reject duplicate FK names).

Extend `/api/cron/diag-all-surfaces` with:
- "Project.projectType column readable"
- "Project.ownerId column readable"
- "Meeting.projectId column readable"
- "/api/admin/projects POST endpoint reachable"

---

## Track 8 — Verification + push

1. `npx tsc --noEmit` — typecheck clean
2. Commit per track (one per track):
   - `feat(schema): Project owner + goal + kickoff meeting + projectType (track 1 phase 54)`
   - `feat(api): POST /api/admin/projects atomic transaction (track 3)`
   - `feat(ui): /admin/projects/new wizard (track 2)`
   - `feat(ui): /admin/projects/[id] header + Overview/Tasks/Meetings tabs (track 4)`
   - `feat(api): PATCH /api/admin/projects/[id] (track 5)`
   - `feat(sidebar): Projects module integration (track 6)`
   - `feat(migrate-54): bundle + diag probes (track 7)`
3. Push, verify Vercel green between commits
4. Fire `fzcron migrate-54-bundle -X POST`
5. Verify by:
   - Open `/admin/projects/new`, walk through wizard with a BRAND project (e.g., KUIU), confirm Project + Kickoff Meeting + initial tasks created
   - Walk a second wizard with INTERNAL type ("Project Red Rover"), confirm step 2 is skipped and project saves without brand/factory FK
   - Open the new project detail page, confirm Overview/Tasks/Meetings tabs render
   - Click "Change owner" on the new project, confirm new owner gets the notification
   - Run `fzcron diag-all-surfaces` — should remain green at 62+ surfaces

---

## Done criteria

- Project Start Wizard live at `/admin/projects/new`
- 3 customer types supported (BRAND/FACTORY/INTERNAL)
- Owner change works post-creation
- Goal narrative renders on detail page
- Initial tasks created as MeetingActionItems linked to auto-created Kickoff Meeting
- Action items appear on assignees' `/my-tasks` pages with priority sort
- Immediate-assignment emails fire for each initial task assigned
- diag-all-surfaces green at 62+ surfaces

Report back with: commit chain SHAs, deploy URLs, one wizard
walkthrough that creates a real test project (use "Test Project —
Wizard QA" as the name), and the assignee email confirmation.
