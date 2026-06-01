// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * POST /api/admin/projects
 *
 * Phase 54 Track 3 — atomic Project Start Wizard submission. Creates:
 *   1. Project row (projectType + brand/factory FK + owner + goalMd)
 *   2. Kickoff MeetingNote tagged to the project (status=COMPLETED)
 *   3. MeetingNoteEntry stamping the goal + initial-tasks summary
 *   4. One MeetingActionItem per initial-task row
 *   5. Patches Project.kickoffMeetingNoteId
 *
 * All wrapped in prisma.$transaction — any step failure rolls back.
 * After commit, fires the existing immediate-assignment email pipeline
 * (Phase 53 T7) for each task with an assignee.
 *
 * ACL: ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP / BD_REP.
 */

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
]);

const VALID_TYPES = new Set(["BRAND", "FACTORY", "DISTRIBUTOR", "INTERNAL"]);
const VALID_PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return bad("Unauthorized", 401);
  if (!ALLOWED_ROLES.has(user.role)) return bad("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const projectType = String(body?.projectType || "").trim().toUpperCase();
  const brandId = body?.brandId || null;
  const factoryId = body?.factoryId || null;
  const distributorId = body?.distributorId || null;
  const ownerId = String(body?.ownerId || "").trim();
  const goalMd = body?.goalMd ? String(body.goalMd) : null;
  const initialTasks = Array.isArray(body?.initialTasks) ? body.initialTasks : [];

  if (!name) return bad("name required");
  if (!VALID_TYPES.has(projectType)) return bad("projectType must be BRAND, FACTORY, DISTRIBUTOR, or INTERNAL");
  if (projectType === "BRAND" && !brandId) return bad("brandId required for BRAND projects");
  if (projectType === "FACTORY" && !factoryId) return bad("factoryId required for FACTORY projects");
  if (projectType === "DISTRIBUTOR" && !distributorId) return bad("distributorId required for DISTRIBUTOR projects");
  if (projectType === "INTERNAL" && user.role !== "ADMIN") return bad("INTERNAL projects are admin-only", 403);
  if (!ownerId) return bad("ownerId required");

  // Resolve owner + assignees up-front so we can fail-fast with a clear error.
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, name: true, email: true },
  });
  if (!owner) return bad("owner user not found", 404);

  for (const t of initialTasks) {
    if (!t?.description || !String(t.description).trim()) continue;
    if (t.priority && !VALID_PRIORITIES.has(String(t.priority).toUpperCase())) {
      return bad(`invalid priority: ${t.priority}`);
    }
    if (t.assigneeId) {
      const exists = await prisma.user.findUnique({
        where: { id: String(t.assigneeId) },
        select: { id: true },
      });
      if (!exists) return bad(`assignee user not found: ${t.assigneeId}`, 404);
    }
  }

  // Atomic transaction. Heavy lift in a single $transaction so a
  // partial failure rolls everything back.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          brandId: projectType === "BRAND" ? brandId : null,
          factoryId: projectType === "FACTORY" ? factoryId : null,
          distributorId: projectType === "DISTRIBUTOR" ? distributorId : null,
          stage: "DEVELOPMENT",
          projectType,
          ownerId,
          goalMd,
        } as any,
        select: { id: true, name: true, projectType: true, brandId: true, factoryId: true, distributorId: true },
      });

      const kickoff = await (tx as any).meetingNote.create({
        data: {
          title: `Project Kickoff — ${project.name}`,
          meetingDate: new Date(),
          status: "COMPLETED",
          notesMd: "",
          brandId: project.brandId,
          factoryId: project.factoryId,
          projectId: project.id,
          createdById: user.id,
        },
        select: { id: true },
      });

      await tx.project.update({
        where: { id: project.id },
        data: { kickoffMeetingNoteId: kickoff.id } as any,
      });

      // Build the entry body summarizing goal + initial tasks.
      const cleanTasks = initialTasks.filter(
        (t: any) => t?.description && String(t.description).trim(),
      );
      const taskLines = cleanTasks
        .map((t: any) => {
          const dueLabel = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "unset";
          return `- ${String(t.description).trim()} (assignee: ${t.assigneeId ? t.assigneeId.slice(-6) : "unassigned"}, ${String(t.priority || "NORMAL").toUpperCase()}, due ${dueLabel})`;
        })
        .join("\n");

      const stamp = `**[${user.name || user.email}, ${new Date().toISOString().slice(0, 16).replace("T", " ")}]**`;
      const bodyMd = `${stamp}\n\n## Project Goal\n\n${goalMd || "(no goal narrative provided)"}\n\n## Initial Tasks\n\n${taskLines || "(none)"}`;
      const entry = await (tx as any).meetingNoteEntry.create({
        data: {
          meetingNoteId: kickoff.id,
          authorId: user.id,
          bodyMd,
        },
        select: { id: true },
      });

      // Also stamp the same body into MeetingNote.notesMd so the
      // detail page renders it directly (no entry-replay needed).
      await (tx as any).meetingNote.update({
        where: { id: kickoff.id },
        data: { notesMd: bodyMd },
      });

      const createdActionItems: Array<{ id: string; assigneeId: string | null }> = [];
      for (const t of cleanTasks) {
        const ai = await (tx as any).meetingActionItem.create({
          data: {
            meetingNoteId: kickoff.id,
            sourceEntryId: entry.id,
            description: String(t.description).trim(),
            assigneeId: t.assigneeId || null,
            priority: String(t.priority || "NORMAL").toUpperCase(),
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            status: "OPEN",
            createdById: user.id,
          },
          select: { id: true, assigneeId: true },
        });
        createdActionItems.push(ai);
      }

      return {
        projectId: project.id,
        kickoffMeetingNoteId: kickoff.id,
        actionItems: createdActionItems,
      };
    });

    // Fire immediate-assignment emails post-commit (best-effort,
    // non-blocking — a Resend hiccup should not roll back the project).
    for (const ai of result.actionItems) {
      if (ai.assigneeId) {
        void sendImmediateAssignmentEmail({ actionItemId: ai.id }).catch(() => null);
      }
    }

    return NextResponse.json({
      ok: true,
      projectId: result.projectId,
      kickoffMeetingNoteId: result.kickoffMeetingNoteId,
      actionItemCount: result.actionItems.length,
      actionItems: result.actionItems,
    });
  } catch (e: any) {
    console.error("[POST /api/admin/projects]", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Project creation failed" },
      { status: 500 },
    );
  }
}
