// @ts-nocheck
import { prisma } from "@/lib/prisma";

/**
 * Builds the Phase 53/54/54.5/56 entries that belong on a brand or
 * factory ActivityFeed. Returns rows shaped to merge into the
 * existing /api/brands/[id]/activity + /api/factories/[id]/activity
 * timeline arrays:
 *
 *   { type, subtype, id, date, ...payload }
 *
 * Scope: pass exactly one of brandId / factoryId. All entries are
 * filtered down to rows that resolve to that customer.
 *
 * Entries emitted:
 *
 *  1. project_created       — Project.createdAt
 *  2. project_weekly_update — every MeetingNoteEntry on the
 *                             project's kickoff MeetingNote AFTER
 *                             the seed entry. Each = a weekly status.
 *  3. project_completed     — Project.closedAt
 *  4. task_assigned         — MeetingActionItem.createdAt for items
 *                             tied (via projectBlock or via the
 *                             project's kickoffMeetingNote) to the
 *                             scope brand/factory.
 *  5. task_completed        — MeetingActionItem.doneAt for the same
 *                             set.
 *  6. block_discussion      — MeetingProjectBlock.updatedAt when
 *                             discussionMd is non-empty.
 */
export async function buildProjectTimeline(opts: {
  brandId?: string | null;
  factoryId?: string | null;
}): Promise<any[]> {
  const { brandId, factoryId } = opts;
  if (!brandId && !factoryId) return [];

  const projectScope: any = brandId ? { brandId } : { factoryId };
  const blockScope: any = brandId ? { brandId } : { factoryId };

  const [projects, blocks] = await Promise.all([
    prisma.project.findMany({
      where: projectScope,
      select: {
        id: true,
        name: true,
        createdAt: true,
        closedAt: true,
        closingNotes: true,
        goalMd: true,
        kickoffMeetingNoteId: true,
        createdBy: { select: { id: true, name: true, email: true } } as any,
        closedBy: { select: { id: true, name: true, email: true } } as any,
        owner: { select: { id: true, name: true, email: true } } as any,
      } as any,
    }),
    (prisma as any).meetingProjectBlock.findMany({
      where: blockScope,
      select: {
        id: true,
        discussionMd: true,
        updatedAt: true,
        createdAt: true,
        meetingNoteId: true,
        meetingNote: { select: { id: true, title: true } },
      },
    }),
  ]);

  const projectIds = projects.map((p: any) => p.id);
  const kickoffIds = projects.map((p: any) => p.kickoffMeetingNoteId).filter(Boolean);
  const blockIds = blocks.map((b: any) => b.id);

  // One round-trip for entries on the kickoff MeetingNotes (powers
  // "weekly status update" entries — every entry after the first).
  const entries = kickoffIds.length
    ? await (prisma as any).meetingNoteEntry.findMany({
        where: { meetingNoteId: { in: kickoffIds } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          bodyMd: true,
          createdAt: true,
          meetingNoteId: true,
          author: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  // Action items tied to a scope project or scope block.
  const actionWhere: any = {
    OR: [
      ...(blockIds.length ? [{ projectBlockId: { in: blockIds } }] : []),
      ...(kickoffIds.length ? [{ meetingNoteId: { in: kickoffIds } }] : []),
    ],
  };
  const actionItems = actionWhere.OR.length
    ? await (prisma as any).meetingActionItem.findMany({
        where: actionWhere,
        select: {
          id: true,
          description: true,
          priority: true,
          dueDate: true,
          status: true,
          createdAt: true,
          doneAt: true,
          meetingNoteId: true,
          projectBlockId: true,
          assignee: { select: { id: true, name: true, email: true } },
          doneBy: { select: { id: true, name: true, email: true } } as any,
          createdBy: { select: { id: true, name: true, email: true } } as any,
        },
      })
    : [];

  const out: any[] = [];

  // 1. project_created
  for (const p of projects) {
    out.push({
      type: "project_created",
      subtype: "PROJECT",
      id: `pc-${p.id}`,
      projectId: p.id,
      projectName: p.name,
      date: p.createdAt,
      user: p.createdBy || p.owner || null,
      content: p.goalMd ? String(p.goalMd).slice(0, 140) : null,
      link: `/admin/projects/${p.id}`,
    });
  }

  // 2. project_weekly_update — every entry on a kickoff note AFTER
  // the first (the first IS the goal narrative). Group entries by
  // meetingNoteId, drop the earliest one, emit the rest.
  const entriesByKickoff = new Map<string, any[]>();
  for (const e of entries) {
    if (!entriesByKickoff.has(e.meetingNoteId)) entriesByKickoff.set(e.meetingNoteId, []);
    entriesByKickoff.get(e.meetingNoteId)!.push(e);
  }
  for (const p of projects) {
    if (!p.kickoffMeetingNoteId) continue;
    const list = entriesByKickoff.get(p.kickoffMeetingNoteId) || [];
    // First entry = goal narrative seed; weekly updates start at index 1.
    const updates = list.slice(1);
    for (const e of updates) {
      out.push({
        type: "project_weekly_update",
        subtype: "WEEKLY",
        id: `pw-${e.id}`,
        projectId: p.id,
        projectName: p.name,
        date: e.createdAt,
        user: e.author,
        content: String(e.bodyMd || "").slice(0, 220),
        link: `/meeting-notes/${e.meetingNoteId}`,
      });
    }
  }

  // 3. project_completed
  for (const p of projects) {
    if (!p.closedAt) continue;
    out.push({
      type: "project_completed",
      subtype: "PROJECT_DONE",
      id: `pd-${p.id}`,
      projectId: p.id,
      projectName: p.name,
      date: p.closedAt,
      user: p.closedBy || null,
      content: p.closingNotes ? String(p.closingNotes).slice(0, 200) : null,
      link: `/admin/projects?status=closed`,
    });
  }

  // 4 & 5. task_assigned + task_completed
  for (const t of actionItems) {
    out.push({
      type: "task_assigned",
      subtype: t.priority || "NORMAL",
      id: `ta-${t.id}`,
      taskId: t.id,
      description: t.description,
      priority: t.priority,
      dueDate: t.dueDate,
      date: t.createdAt,
      assignee: t.assignee,
      user: t.createdBy || null,
      link: `/meeting-notes/${t.meetingNoteId}`,
    });
    if (t.doneAt) {
      out.push({
        type: "task_completed",
        subtype: "DONE",
        id: `tc-${t.id}`,
        taskId: t.id,
        description: t.description,
        date: t.doneAt,
        user: t.doneBy || null,
        link: `/meeting-notes/${t.meetingNoteId}`,
      });
    }
  }

  // 6. block_discussion — only blocks whose discussion has content.
  for (const b of blocks) {
    if (!b.discussionMd || !String(b.discussionMd).trim()) continue;
    out.push({
      type: "block_discussion",
      subtype: "DISCUSSION",
      id: `bd-${b.id}`,
      blockId: b.id,
      date: b.updatedAt,
      meetingTitle: b.meetingNote?.title || "(meeting)",
      content: String(b.discussionMd).slice(0, 240),
      link: `/meeting-notes/${b.meetingNoteId}`,
    });
  }

  return out;
}
