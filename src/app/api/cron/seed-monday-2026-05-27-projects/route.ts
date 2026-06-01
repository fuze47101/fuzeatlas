// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractActionItems } from "@/lib/meeting-mentions";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * POST /api/cron/seed-monday-2026-05-27-projects
 *
 * One-shot, idempotent. For each of the 16 topics in Andrew's
 * 2026-05-27 Monday Global Meeting, materializes a Project via the
 * Phase 54 atomic flow:
 *
 *   Project + Kickoff MeetingNote + MeetingNoteEntry + N MeetingActionItem
 *
 * The kickoff entry body = the section bullets verbatim (parser then
 * extracts @mentions → action items with assignee/priority/dueDate).
 *
 * Idempotency: a Project with the matching `name` is skipped (its
 * action items stay where they are).
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

const NOTES_BODY = `**MMI**
- @Ryan global follow-up
- @Kaylee to prep for ICP and send the 4 samples to CTLA today (5-day process)
- @Andrew emailed Tandy to find out application process

**Target**
- @Ryan global follow-up
- @Andrew emailed John for a circle-up
- @Kathir determined that they are using a Rudolf product for antimicrobial in India at Trident
- @Andrew did full research on the Rudolf product for competitive analysis

**Tencate**
- @Ryan global follow-up
- @Andrew visited factories
- Tencate (Matthew) applied at spin finish
- Waiting on the samples of spin finish to determine pickup by ICP
- Waiting on master batch samples from John Greenup

**Hurricane**
- @Andrew global follow-up
- @Andrew completed site visit
- Hurricane arranging upgrade and install of air compressors
- @Andrew to send Hurricane engineering drawings

**Nike — Priority 1 URGENT**
- @Andrew global follow-up
- @Andrew to replace the Pi on the Solaris machine — add a temp sensor above the fabric with humidity
- Samples to be made: 1 control + 5 Helios (au sprays), FUZE, and Combo at 1 spray, 2 spray, 3 spray, 4 spray, 5 spray
- Testing: Quick dry and wicking on the Baals machine; Solaris Testing machine on all 16 samples in frame and draped

**Allied**
- @Andrew to complete new test device in refrigeration
- Luke is in town for 2 days next week in lab

**Project Red Rover**
- @Ryan LinkedIn reach-out for contact — soft requests on consulting availability: Lee Howarth, Harry Schmoot, Bryan Dill

**PVH**
- @Barth global follow-up — next steps
- @Andrew follow up on Sri Lanka TeeJay trial

**SanMar**
- @Tina global follow-up
- @Kaylee to perform antimicrobial testing on Paradise fabric (Antimicrobial + ICP), Hone Strong (Antimicrobial + ICP), Fountain Set (Antimicrobial + ICP)
- @Andrew to confirm wash data

**Skims**
- @Scott global follow-up
- @Andrew to message Brittany and Mario
- Relay to @Tina — Best Pacific has manufacturing in mainland China, Vietnam, and Sri Lanka

**Loftex**
- @Barth global follow-up
- Meeting to discuss pricing on May 27th at 12:20
- Review testing protocol — ICP Report: Pad and Bath at 0.25 for 0 wash and 0.22 at 100 wash

**WooJoo**
- @Andrew global follow-up
- @Andrew to send email to determine if it came treated or not
- Perform recipe analysis
- ICP recipe is due back next week

**Patriots**
- @Scott global follow-up
- @Scott to build new sprayers — equipment all here
- @Tina to call and see if we can get new plastic heads for the 30 broken pumps — new pump order 10?

**Seissence**
- @Andrew to send completed test report

**Gul Ahmed**
- @Scott global follow-up (Sky Home also @Barth)
- Pakistan sent back fabric with low ICP — 0.01 when target was 0.5
- @Scott to follow up on the ICP testing and their pitch to Wal-Mart for FUZE
- @Kaylee to create a recipe build for their failed fabric

**Classic Fashion**
- @Barth global follow-up
- @Tandy to reach out to Changzhou factory to discuss new approval of FUZE by Target and Wal-Mart (Logesh)
- @Barth follow up Richard Tinsley`;

type Spec = {
  name: string;
  projectType: "BRAND" | "FACTORY" | "INTERNAL";
  lookupKey: string | null; // entity name to fuzzy-resolve (null = no entity)
  ownerFirst: string; // first-name tag for owner lookup
};

const SPECS: Spec[] = [
  { name: "MMI", projectType: "BRAND", lookupKey: "MMI", ownerFirst: "ryan" },
  { name: "Target", projectType: "BRAND", lookupKey: "Target", ownerFirst: "ryan" },
  { name: "Tencate", projectType: "FACTORY", lookupKey: "Tencate", ownerFirst: "ryan" },
  { name: "Hurricane", projectType: "FACTORY", lookupKey: "Hurricane", ownerFirst: "andrew" },
  { name: "Nike", projectType: "BRAND", lookupKey: "Nike", ownerFirst: "andrew" },
  { name: "Allied", projectType: "FACTORY", lookupKey: "Allied", ownerFirst: "andrew" },
  { name: "Project Red Rover", projectType: "INTERNAL", lookupKey: null, ownerFirst: "ryan" },
  { name: "PVH", projectType: "BRAND", lookupKey: "PVH", ownerFirst: "barth" },
  { name: "SanMar", projectType: "BRAND", lookupKey: "SanMar", ownerFirst: "tina" },
  { name: "Skims", projectType: "BRAND", lookupKey: "Skims", ownerFirst: "scott" },
  { name: "Loftex", projectType: "FACTORY", lookupKey: "Loftex", ownerFirst: "barth" },
  { name: "WooJoo", projectType: "FACTORY", lookupKey: "WooJoo", ownerFirst: "andrew" },
  { name: "Patriots", projectType: "INTERNAL", lookupKey: null, ownerFirst: "scott" },
  { name: "Seissence", projectType: "BRAND", lookupKey: "Seissence", ownerFirst: "andrew" },
  { name: "Gul Ahmed", projectType: "FACTORY", lookupKey: "Gul Ahmed", ownerFirst: "scott" },
  { name: "Classic Fashion", projectType: "FACTORY", lookupKey: "Classic Fashion", ownerFirst: "barth" },
];

function parseSections(notesMd: string): Map<string, string> {
  const lines = notesMd.split(/\r?\n/);
  const out = new Map<string, string>();
  let header: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (header) {
      const clean = header.replace(/\s*[—\-]\s*Priority.*$/i, "")
        .replace(/\s*[—\-]\s*URGENT.*$/i, "")
        .replace(/\s*\(URGENT\)/i, "")
        .trim();
      out.set(clean.toLowerCase(), buf.join("\n").trim());
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^\*\*(.+)\*\*$/);
    if (m && !/@/.test(m[1])) {
      flush();
      header = m[1];
      buf = [];
      continue;
    }
    if (header) buf.push(line);
  }
  flush();
  return out;
}

async function resolveEntity(
  type: "BRAND" | "FACTORY",
  lookupKey: string,
): Promise<{ id: string; name: string } | null> {
  const model = type === "BRAND" ? (prisma as any).brand : (prisma as any).factory;
  // exact insensitive
  const exact = await model.findFirst({
    where: { name: { equals: lookupKey, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (exact) return exact;
  // contains (case-insensitive)
  const contains = await model.findMany({
    where: { name: { contains: lookupKey, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
    orderBy: { name: "asc" },
  });
  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    // Prefer the shortest name match (heuristic: "MMI Textiles" beats "MMI Global LLC")
    contains.sort((a: any, b: any) => a.name.length - b.name.length);
    return contains[0];
  }
  return null;
}

async function resolveOwner(firstTag: string): Promise<{ id: string; name: string | null; email: string | null } | null> {
  // Prefer @fuze47.com email match; fall back to first-name in name.
  const fuze = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      email: { startsWith: `${firstTag.toLowerCase()}@`, mode: "insensitive" },
    },
    select: { id: true, name: true, email: true },
  });
  if (fuze) return fuze;
  // Any user whose first name = firstTag.
  const all = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });
  const matches = all.filter((u) => {
    const first = String(u.name || "").split(/\s+/)[0]?.toLowerCase();
    const local = String(u.email || "").split("@")[0]?.toLowerCase();
    return first === firstTag.toLowerCase() || local === firstTag.toLowerCase();
  });
  if (matches.length === 0) return null;
  // Prefer @fuze47.com
  const fuze47 = matches.filter((u) => /@fuze47\.com$/i.test(u.email || ""));
  if (fuze47.length === 1) return fuze47[0];
  return matches[0];
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Andrew (system actor for createdById).
  const andrew = await prisma.user.findFirst({
    where: { email: { in: ["andrew@fuze47.com", "andrew@801inc.com"] } },
    select: { id: true, name: true, email: true },
  });
  if (!andrew) {
    return NextResponse.json({ ok: false, error: "Andrew user not found" }, { status: 404 });
  }

  // Andrew as default owner fallback.
  const sections = parseSections(NOTES_BODY);
  const allUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true, updatedAt: true },
  });

  const results: any[] = [];

  for (const spec of SPECS) {
    const sectionKey = spec.name.toLowerCase();
    const bodyMd = sections.get(sectionKey) || "";

    // Idempotency: skip if a Project with the same name already exists.
    const existing = await prisma.project.findFirst({
      where: { name: spec.name },
      select: { id: true, name: true },
    });
    if (existing) {
      results.push({
        name: spec.name,
        skipped: true,
        reason: "project already exists",
        projectId: existing.id,
      });
      continue;
    }

    // Resolve entity.
    let brandId: string | null = null;
    let factoryId: string | null = null;
    let entityName: string | null = null;
    let entityLookupFailed: string | null = null;

    if (spec.projectType === "BRAND" && spec.lookupKey) {
      const ent = await resolveEntity("BRAND", spec.lookupKey);
      if (ent) {
        brandId = ent.id;
        entityName = ent.name;
      } else {
        entityLookupFailed = `BRAND ${spec.lookupKey} not found`;
      }
    } else if (spec.projectType === "FACTORY" && spec.lookupKey) {
      const ent = await resolveEntity("FACTORY", spec.lookupKey);
      if (ent) {
        factoryId = ent.id;
        entityName = ent.name;
      } else {
        entityLookupFailed = `FACTORY ${spec.lookupKey} not found`;
      }
    }

    // Resolve owner; default to Andrew on miss.
    const owner = (await resolveOwner(spec.ownerFirst)) || andrew;

    // Extract action items from the section body.
    const extracted = extractActionItems(bodyMd, allUsers as any);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            name: spec.name,
            brandId,
            factoryId,
            stage: "DEVELOPMENT",
            projectType: spec.projectType,
            ownerId: owner.id,
            goalMd: bodyMd || null,
          } as any,
          select: { id: true, name: true },
        });

        const kickoff = await (tx as any).meetingNote.create({
          data: {
            title: `Project Kickoff — ${project.name}`,
            meetingDate: new Date(),
            status: "COMPLETED",
            notesMd: "",
            brandId,
            factoryId,
            projectId: project.id,
            createdById: andrew.id,
          },
          select: { id: true },
        });

        await tx.project.update({
          where: { id: project.id },
          data: { kickoffMeetingNoteId: kickoff.id } as any,
        });

        const stamp = `**[${andrew.name || andrew.email}, ${new Date().toISOString().slice(0, 16).replace("T", " ")}]**`;
        const entryBody = `${stamp}\n\n## Project Goal\n\n${bodyMd || "(seeded from Monday Global Meeting 2026-05-27)"}`;
        const entry = await (tx as any).meetingNoteEntry.create({
          data: {
            meetingNoteId: kickoff.id,
            authorId: andrew.id,
            bodyMd: entryBody,
          },
          select: { id: true },
        });

        await (tx as any).meetingNote.update({
          where: { id: kickoff.id },
          data: { notesMd: entryBody },
        });

        const createdAis: Array<{ id: string; description: string; assigneeId: string | null; priority: string }> = [];
        for (const ex of extracted) {
          const ai = await (tx as any).meetingActionItem.create({
            data: {
              meetingNoteId: kickoff.id,
              sourceEntryId: entry.id,
              description: ex.description,
              assigneeId: ex.assigneeId || null,
              priority: ex.priority,
              dueDate: ex.dueDate || null,
              status: "OPEN",
              createdById: andrew.id,
            },
            select: { id: true, description: true, assigneeId: true, priority: true },
          });
          createdAis.push(ai);
        }
        return { projectId: project.id, kickoffMeetingNoteId: kickoff.id, actionItems: createdAis };
      });

      // Post-commit: fire emails for assigned tasks (best-effort).
      for (const ai of result.actionItems) {
        if (ai.assigneeId) {
          void sendImmediateAssignmentEmail({ actionItemId: ai.id }).catch(() => null);
        }
      }

      results.push({
        name: spec.name,
        skipped: false,
        projectId: result.projectId,
        kickoffMeetingNoteId: result.kickoffMeetingNoteId,
        entityName,
        entityLookupFailed,
        owner: owner.email,
        actionItemCount: result.actionItems.length,
        actionItems: result.actionItems.map((a) => ({
          id: a.id,
          description: a.description.slice(0, 120),
          assigneeId: a.assigneeId,
          priority: a.priority,
        })),
      });
    } catch (e: any) {
      results.push({
        name: spec.name,
        skipped: false,
        error: e?.message || "create failed",
      });
    }
  }

  const summary = {
    projectsCreated: results.filter((r) => !r.skipped && !r.error).length,
    projectsSkipped: results.filter((r) => r.skipped).length,
    projectsFailed: results.filter((r) => r.error).length,
    entityLookupFailures: results.filter((r) => r.entityLookupFailed).map((r) => ({ name: r.name, msg: r.entityLookupFailed })),
    totalActionItemsCreated: results.reduce((s, r) => s + (r.actionItemCount || 0), 0),
  };

  return NextResponse.json({ ok: true, summary, results });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
