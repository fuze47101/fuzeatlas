// @ts-nocheck
/**
 * Audit: distributor portal readiness.
 *
 * The distributor portal has four main flows (orders, restock, test
 * request, test reports) and they all silently degrade to empty state
 * when the underlying setup is incomplete. Tina's review (Apr 2026)
 * surfaced four "the dropdown is empty" bugs that all root-caused to
 * setup gaps, not code bugs.
 *
 * This script walks every DISTRIBUTOR_USER and every Distributor
 * record and reports which of these prerequisites are missing:
 *
 *   USER LEVEL
 *     [ ] User.distributorId is set
 *     [ ] User.status === ACTIVE
 *
 *   DISTRIBUTOR LEVEL (record this user is linked to)
 *     [ ] At least one Factory has Factory.distributorId === <this dist>
 *         → otherwise fabric-search and test-reports return []
 *     [ ] At least one Project has Project.distributorId === <this dist>
 *         → optional, but unlocks brand-scoped fabric search
 *     [ ] Distributor.fuzeRestockPricePerLiter is set
 *         → otherwise restock from FUZE returns 400
 *     [ ] At least one DistributorPricing row exists
 *         → otherwise the rep has no per-factory tier to bill against
 *
 * Run from your Mac:
 *   npx tsx scripts/audit-distributor-setup.ts
 *
 * Read-only — never writes.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const distributors = await prisma.distributor.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      country: true,
      fuzeRestockPricePerLiter: true,
      fuzeRestockCurrency: true,
    },
    orderBy: { name: "asc" },
  });

  const users = await prisma.user.findMany({
    where: { role: "DISTRIBUTOR_USER" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      distributorId: true,
    },
    orderBy: { name: "asc" },
  });

  // NOTE: Factory model has no `active` boolean (per CLAUDE.md — only
  // Distributor does). Just count every factory assigned to a distributor.
  const factoriesByDist = await prisma.factory.groupBy({
    by: ["distributorId"],
    where: { distributorId: { not: null } },
    _count: { _all: true },
  });
  const factoryCount: Record<string, number> = {};
  for (const r of factoriesByDist) {
    if (r.distributorId) factoryCount[r.distributorId] = r._count._all;
  }

  const projectsByDist = await prisma.project.groupBy({
    by: ["distributorId"],
    where: { distributorId: { not: null } },
    _count: { _all: true },
  });
  const projectCount: Record<string, number> = {};
  for (const r of projectsByDist) {
    if (r.distributorId) projectCount[r.distributorId] = r._count._all;
  }

  const pricingByDist = await prisma.distributorPricing.groupBy({
    by: ["distributorId"],
    where: { active: true },
    _count: { _all: true },
  });
  const pricingCount: Record<string, number> = {};
  for (const r of pricingByDist) {
    if (r.distributorId) pricingCount[r.distributorId] = r._count._all;
  }

  console.log(
    `\n=== Distributor Setup Audit · ${distributors.length} distributors · ${users.length} dist-users ===\n`,
  );

  console.log("DISTRIBUTORS");
  console.log("-".repeat(112));
  console.log(
    "name".padEnd(26) +
      "country".padEnd(16) +
      "factories".padStart(11) +
      "projects".padStart(10) +
      "pricing tiers".padStart(15) +
      "FUZE $/L".padStart(12) +
      "  status",
  );
  for (const d of distributors) {
    const f = factoryCount[d.id] || 0;
    const p = projectCount[d.id] || 0;
    const pt = pricingCount[d.id] || 0;
    const restock = d.fuzeRestockPricePerLiter
      ? `${d.fuzeRestockPricePerLiter} ${d.fuzeRestockCurrency || "USD"}`
      : "—";
    const issues = [];
    if (f === 0) issues.push("no factories");
    if (pt === 0) issues.push("no pricing");
    if (!d.fuzeRestockPricePerLiter) issues.push("no FUZE $/L");
    const status =
      issues.length === 0 ? "✅ ready" : `❌ ${issues.join(", ")}`;
    console.log(
      (d.name || "").padEnd(26).slice(0, 26) +
        (d.country || "").padEnd(16).slice(0, 16) +
        String(f).padStart(11) +
        String(p).padStart(10) +
        String(pt).padStart(15) +
        restock.padStart(12) +
        "  " +
        status,
    );
  }

  console.log("\nDISTRIBUTOR USERS");
  console.log("-".repeat(112));
  console.log(
    "name".padEnd(22) +
      "email".padEnd(34) +
      "status".padEnd(10) +
      "linked distributor".padEnd(28) +
      "  diagnosis",
  );
  for (const u of users) {
    let dist: any = null;
    if (u.distributorId) {
      dist = distributors.find((d) => d.id === u.distributorId) || null;
    }
    const issues: string[] = [];
    if (!u.distributorId) issues.push("⚠ not linked to distributor");
    if (u.status !== "ACTIVE") issues.push(`⚠ status=${u.status}`);
    if (dist) {
      if ((factoryCount[dist.id] || 0) === 0)
        issues.push("dist has no factories");
      if ((pricingCount[dist.id] || 0) === 0)
        issues.push("dist has no pricing tiers");
      if (!dist.fuzeRestockPricePerLiter) issues.push("dist has no FUZE $/L");
    }
    const diag = issues.length === 0 ? "✅ portal will work" : issues.join("; ");

    console.log(
      (u.name || "").padEnd(22).slice(0, 22) +
        (u.email || "").padEnd(34).slice(0, 34) +
        (u.status || "").padEnd(10) +
        (dist?.name || "(none)").padEnd(28).slice(0, 28) +
        "  " +
        diag,
    );
  }

  console.log("\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
