/**
 * list-open-tickets.ts
 *
 * Dump all open (non-resolved, non-dismissed) support tickets grouped by
 * status, ordered oldest-first so we triage the stale ones first.
 *
 * Run: npx tsx scripts/list-open-tickets.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.feedbackReport.findMany({
    where: {
      status: { notIn: ["FIXED", "REJECTED", "DUPLICATE", "CLOSED"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      category: true,
      title: true,
      description: true,
      status: true,
      userEmail: true,
      userName: true,
      userRole: true,
      portal: true,
      url: true,
      createdAt: true,
      triageNotes: true,
    },
  });

  if (tickets.length === 0) {
    console.log("No open tickets — inbox zero.");
    return;
  }

  console.log(`\n${tickets.length} open ticket(s):\n`);

  // Group by status for scannable output
  const byStatus: Record<string, typeof tickets> = {};
  for (const t of tickets) {
    (byStatus[t.status] = byStatus[t.status] || []).push(t);
  }

  const statusOrder = ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"];
  for (const status of [
    ...statusOrder,
    ...Object.keys(byStatus).filter((s) => !statusOrder.includes(s)),
  ]) {
    const group = byStatus[status];
    if (!group || group.length === 0) continue;
    console.log(`\n═══ ${status} (${group.length}) ═══`);
    for (const t of group) {
      const age = Math.floor(
        (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      console.log(`\n  [${t.category}] ${t.title}`);
      console.log(`    id: ${t.id}`);
      console.log(`    from: ${t.userName || "—"} <${t.userEmail || "—"}> (${t.userRole || "—"})`);
      console.log(`    where: ${t.portal || "—"} · ${t.url || "—"}`);
      console.log(`    age: ${age}d · created ${new Date(t.createdAt).toLocaleDateString()}`);
      const desc = (t.description || "").split("\n").slice(0, 8).join("\n    ").trim();
      if (desc) console.log(`    description:\n    ${desc}`);
      if (t.triageNotes) console.log(`    triage: ${t.triageNotes}`);
    }
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
