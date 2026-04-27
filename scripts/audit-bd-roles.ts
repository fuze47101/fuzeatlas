// @ts-nocheck
/**
 * Audit script: list every Atlas user, their role, and how much BD
 * activity they've done in the last 30 days. Surfaces the "Ryan and
 * Barth are missing from the scoreboard" class of bug (#8) — anyone
 * with BD activity but a non-BD role tag.
 *
 * Run from your Mac:
 *   npx tsx scripts/audit-bd-roles.ts
 *
 * Optional:
 *   npx tsx scripts/audit-bd-roles.ts --apply
 *     Promotes any EMPLOYEE / ADMIN user with > 5 outreach messages
 *     in the window to BD_REP. Read-only by default.
 *
 * The scoreboard query in src/app/api/admin/bd/scoreboard/route.ts is
 * also now self-healing — anyone with OutreachMessage or BDSequence
 * activity in the window will show up regardless of their role tag.
 * This script's `--apply` is just a tidy-up pass to make the role
 * tags reflect reality.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const WINDOW_DAYS = 30;
const PROMOTE_THRESHOLD = 5; // ≥ N outreach messages → BD-eligible

const BD_ROLES = ["SALES_REP", "SALES_MANAGER", "BD_REP"];
const PROMOTABLE_ROLES = ["EMPLOYEE"]; // Don't auto-touch ADMIN

async function main() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
    orderBy: { name: "asc" },
  });

  // Pull every OutreachMessage in window, group by sentBy
  const outreach = await prisma.outreachMessage.groupBy({
    by: ["sentBy"],
    where: { sentAt: { gte: since }, sentBy: { not: null } },
    _count: { _all: true },
  });
  const byUserOut: Record<string, number> = {};
  for (const r of outreach) {
    if (r.sentBy) byUserOut[r.sentBy] = r._count?._all ?? 0;
  }

  // BDSequence.repId is non-nullable, so the `not: null` filter we
  // had here was invalid. Just window by startedAt and group.
  const seqs = await prisma.bDSequence.groupBy({
    by: ["repId"],
    where: { startedAt: { gte: since } },
    _count: { _all: true },
  });
  const byUserSeq: Record<string, number> = {};
  for (const r of seqs) {
    if (r.repId) byUserSeq[r.repId] = r._count?._all ?? 0;
  }

  console.log(
    `\n=== BD Role Audit · last ${WINDOW_DAYS} days · ${users.length} users ===\n`,
  );
  console.log(
    "name".padEnd(28) +
      "email".padEnd(36) +
      "role".padEnd(18) +
      "status".padEnd(10) +
      "msgs".padStart(6) +
      "seqs".padStart(6) +
      "  show?",
  );
  console.log("-".repeat(112));

  const promotionCandidates: { id: string; name: string; email: string; msgs: number }[] = [];

  for (const u of users) {
    const msgs = byUserOut[u.id] || 0;
    const sequencesStarted = byUserSeq[u.id] || 0;
    const inBdRole = BD_ROLES.includes(u.role);
    const hasActivity = msgs > 0 || sequencesStarted > 0;
    const showsOnScoreboard = inBdRole || hasActivity;
    const flagPromote =
      !inBdRole &&
      PROMOTABLE_ROLES.includes(u.role) &&
      msgs >= PROMOTE_THRESHOLD;

    let mark = "";
    if (!showsOnScoreboard && hasActivity) mark = "❌ MISSING (will fix on next view)";
    else if (showsOnScoreboard && hasActivity) mark = "✅";
    else if (inBdRole && !hasActivity) mark = "💤 (no activity)";
    else if (!inBdRole && !hasActivity) mark = "—";

    if (flagPromote) {
      mark = `⚡ PROMOTE → BD_REP (${msgs} msgs)`;
      promotionCandidates.push({
        id: u.id,
        name: u.name || "(no name)",
        email: u.email,
        msgs,
      });
    }

    console.log(
      (u.name || "").padEnd(28).slice(0, 28) +
        (u.email || "").padEnd(36).slice(0, 36) +
        (u.role || "").padEnd(18) +
        (u.status || "").padEnd(10) +
        String(msgs).padStart(6) +
        String(sequencesStarted).padStart(6) +
        "  " +
        mark,
    );
  }

  console.log("\n");
  console.log(
    `${promotionCandidates.length} user(s) qualify for promotion to BD_REP based on activity.`,
  );

  if (APPLY && promotionCandidates.length > 0) {
    console.log("\nApplying role promotions:");
    for (const c of promotionCandidates) {
      await prisma.user.update({
        where: { id: c.id },
        data: { role: "BD_REP" },
      });
      console.log(`  ✓ ${c.name} (${c.email}) → BD_REP`);
    }
    console.log("\nDone. Scoreboard should now show these reps with their proper role tag.");
  } else if (promotionCandidates.length > 0) {
    console.log(
      "\nDry run — no changes made. Re-run with `--apply` to promote these users.",
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
