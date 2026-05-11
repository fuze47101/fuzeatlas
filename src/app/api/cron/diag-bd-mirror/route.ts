// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-bd-mirror
 *
 * Mirrors the EXACT query path that /api/admin/bd/scoreboard?all=1&days=30
 * runs, but is bearer-authed instead of session-authed so we can run it
 * from CLI without a cookie. Reports the row count after each step so we
 * can pinpoint which query is silently dropping data.
 *
 * Returns:
 *   - step1_activeAuthors   — distinct sentBy in OutreachMessage in window
 *   - step2_activeSeqOwners — distinct repId in BDSequence in window
 *   - step3_repsMatched     — User.findMany result with the OR clause
 *   - step4_outreachRows    — OutreachMessage rows for matched repIds
 *   - step5_perRepRollup    — what the scoreboard would actually return
 *   - errors                — per-step error capture (each query is isolated
 *     so a single failure doesn't black-hole the whole response)
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const errors: Record<string, string> = {};
  const since = new Date(Date.now() - 30 * 86400_000);

  // ── Step 1 — distinct sentBy from OutreachMessage in window ─────────────
  let activeAuthors: any[] = [];
  try {
    activeAuthors = await prisma.outreachMessage.findMany({
      where: { sentAt: { gte: since }, sentBy: { not: null } },
      select: { sentBy: true },
      distinct: ["sentBy"],
    });
  } catch (e: any) {
    errors.step1 = e?.message || String(e);
  }

  // ── Step 2 — distinct repId from BDSequence in window ───────────────────
  let activeSeqOwners: any[] = [];
  try {
    activeSeqOwners = await prisma.bDSequence.findMany({
      where: { startedAt: { gte: since } },
      select: { repId: true },
      distinct: ["repId"],
    });
  } catch (e: any) {
    errors.step2 = e?.message || String(e);
  }

  const activityIds = new Set<string>();
  for (const m of activeAuthors) if (m.sentBy) activityIds.add(m.sentBy);
  for (const s of activeSeqOwners) if (s.repId) activityIds.add(s.repId);

  // ── Step 3 — User.findMany with the OR clause ────────────────────────────
  let reps: any[] = [];
  try {
    reps = await prisma.user.findMany({
      where: {
        OR: [
          {
            AND: [
              { role: { in: ["SALES_REP", "SALES_MANAGER", "BD_REP"] } },
              { brandId: null },
              { factoryId: null },
              { distributorId: null },
              { labId: null },
              { status: "ACTIVE" },
            ],
          },
          ...(activityIds.size > 0
            ? [{ id: { in: Array.from(activityIds) } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
        labId: true,
      },
      orderBy: { name: "asc" },
    });
  } catch (e: any) {
    errors.step3 = e?.message || String(e);
  }
  const repIds = reps.map((r) => r.id);

  // ── Step 4 — OutreachMessage rows for matched repIds ────────────────────
  let outreachRows: any[] = [];
  try {
    outreachRows = await prisma.outreachMessage.findMany({
      where: { sentBy: { in: repIds }, sentAt: { gte: since } },
      select: { sentBy: true, channel: true, contactId: true, openedAt: true, repliedAt: true },
    });
  } catch (e: any) {
    errors.step4 = e?.message || String(e);
  }

  // ── Step 5 — per-rep rollup like the scoreboard would build ─────────────
  const perRep: Record<string, { emails: number; linkedin: number; contacts: Set<string>; opens: number; replies: number }> = {};
  for (const m of outreachRows) {
    const rid = m?.sentBy;
    if (!rid) continue;
    if (!perRep[rid]) perRep[rid] = { emails: 0, linkedin: 0, contacts: new Set(), opens: 0, replies: 0 };
    if (m.channel === "email") perRep[rid].emails += 1;
    if (m.channel === "linkedin") perRep[rid].linkedin += 1;
    if (m.contactId) perRep[rid].contacts.add(m.contactId);
    if (m.openedAt) perRep[rid].opens += 1;
    if (m.repliedAt) perRep[rid].replies += 1;
  }
  const perRepRollup = reps.map((r) => ({
    rep: { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status },
    entityFlags: {
      brandId: r.brandId,
      factoryId: r.factoryId,
      distributorId: r.distributorId,
      labId: r.labId,
    },
    emailsSent: perRep[r.id]?.emails || 0,
    linkedinSent: perRep[r.id]?.linkedin || 0,
    contactsWorked: perRep[r.id]?.contacts.size || 0,
    opens: perRep[r.id]?.opens || 0,
    replies: perRep[r.id]?.replies || 0,
  }));

  // Verdict heuristic
  let verdict = "unknown";
  if (Object.keys(errors).length > 0) {
    verdict = `query-failure: ${Object.keys(errors).join(",")}`;
  } else if (activeAuthors.length === 0 && activeSeqOwners.length === 0) {
    verdict = "no-activity-in-window — neither OutreachMessage nor BDSequence has rows in the last 30 days";
  } else if (reps.length === 0) {
    verdict = "user-filter-rejected-everyone — activityIds had ids but User.findMany returned 0 rows";
  } else if (outreachRows.length === 0) {
    verdict = "outreach-fetch-empty — reps matched but their messages did not return";
  } else if (perRepRollup.every((r) => r.emailsSent === 0 && r.linkedinSent === 0)) {
    verdict = "rollup-all-zero — outreach rows came back but did not match any rep id";
  } else {
    verdict = "scoreboard-should-be-populated — bug must be downstream (sort, totals, or page render)";
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    windowSince: since.toISOString(),
    step1_activeAuthorsCount: activeAuthors.length,
    step1_activeAuthors: activeAuthors.map((a) => a.sentBy),
    step2_activeSeqOwnersCount: activeSeqOwners.length,
    step2_activeSeqOwners: activeSeqOwners.map((s) => s.repId),
    activityIdsCount: activityIds.size,
    step3_repsMatched: reps.length,
    step4_outreachRowCount: outreachRows.length,
    step5_perRepRollup: perRepRollup,
    errors,
    verdict,
  });
}
