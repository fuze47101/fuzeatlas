/**
 * NEED-1 — seed-lab
 *
 * Idempotent. Creates a Lab + LabService rows with median market
 * prices + standard turnaround. The LabService model is the lab's
 * own catalog (priceUSD = our negotiated price, listPriceUSD = lab
 * list price). LabTest is the Phase 10B per-protocol catalog used
 * by /admin/data-entry — seed-lab uses LabService since it's the
 * legacy row Lab Pipeline reads from.
 *
 * Usage:
 *   npx tsx scripts/seed-lab.ts \
 *     --name="ITS Taiwan" \
 *     --country=Taiwan \
 *     --accreditations="ISO 17025,TAF,CNAS" \
 *     --tests="ICP,ANTIBACTERIAL,ANTIVIRAL"
 *
 *   # Optional:
 *   --city="Taipei"
 *   --email=ops@its.com.tw
 *
 * Median defaults (USD, per-test):
 *   ICP:           $35 / 7d turnaround (ICP-MS implied)
 *   ANTIBACTERIAL: $120 / 14d (AATCC 100 default protocol)
 *   ANTIVIRAL:     $400 / 21d (ISO 18184)
 *   FUNGAL:        $200 / 14d (AATCC 30)
 *   ODOR:          $250 / 21d
 *
 * Production safety: refuses unless ALLOW_PROD_SEED=1.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ServiceDefault {
  testType: string;
  testMethod: string | null;
  priceUSD: number;
  turnaroundDays: number;
}

const SERVICE_DEFAULTS: Record<string, ServiceDefault> = {
  ICP: { testType: "ICP", testMethod: "ICP-MS", priceUSD: 35, turnaroundDays: 7 },
  ANTIBACTERIAL: {
    testType: "ANTIBACTERIAL",
    testMethod: "AATCC 100",
    priceUSD: 120,
    turnaroundDays: 14,
  },
  ANTIVIRAL: {
    testType: "ANTIVIRAL",
    testMethod: "ISO 18184",
    priceUSD: 400,
    turnaroundDays: 21,
  },
  FUNGAL: {
    testType: "FUNGAL",
    testMethod: "AATCC 30",
    priceUSD: 200,
    turnaroundDays: 14,
  },
  ODOR: { testType: "ODOR", testMethod: null, priceUSD: 250, turnaroundDays: 21 },
  ASTM_E2149: {
    testType: "ANTIBACTERIAL",
    testMethod: "ASTM E2149",
    priceUSD: 180,
    turnaroundDays: 14,
  },
};

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? "true";
  }
  return out;
}

function need(args: Record<string, string>, key: string): string {
  const v = args[key];
  if (!v) {
    console.error(`✗ Missing required --${key}`);
    process.exit(2);
  }
  return v;
}

function refuseProdWithoutFlag() {
  const dsn = process.env.DATABASE_URL || "";
  const looksProd =
    process.env.NODE_ENV === "production" ||
    dsn.includes(".rlwy.net:28355") ||
    dsn.includes("postgres.railway.internal");
  if (looksProd && process.env.ALLOW_PROD_SEED !== "1") {
    console.error("✗ Refusing prod DSN. Set ALLOW_PROD_SEED=1 to override.");
    process.exit(2);
  }
}

async function main() {
  refuseProdWithoutFlag();
  const args = parseArgs();

  const labName = need(args, "name");
  const country = need(args, "country");
  const accreditationsCsv = (args["accreditations"] || "").trim();
  const testsCsv = (args["tests"] || "").trim();
  const city = args["city"] || null;
  const email = args["email"] || null;
  const website = args["website"] || null;

  // Lab upsert (natural key: name).
  const lab = await prisma.lab.upsert({
    where: { name: labName },
    create: {
      name: labName,
      country,
      city,
      email,
      website,
      accreditations: accreditationsCsv || null,
      active: true,
    },
    update: {
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(email ? { email } : {}),
      ...(website ? { website } : {}),
      ...(accreditationsCsv ? { accreditations: accreditationsCsv } : {}),
    },
  });
  const isNew = lab.createdAt && Date.now() - lab.createdAt.getTime() < 5_000;
  console.log(`${isNew ? "✓" : "="} Lab "${lab.name}" (${country})`);
  if (accreditationsCsv) {
    console.log(`  Accreditations: ${accreditationsCsv}`);
  }

  // Approval flags — flip based on the seeded test list.
  const tests = testsCsv ? testsCsv.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const approvalPatch: Record<string, boolean> = {};
  for (const t of tests) {
    const key = t.toUpperCase();
    if (key === "ICP") approvalPatch.icpApproved = true;
    if (key === "ANTIBACTERIAL" || key === "ASTM_E2149") approvalPatch.abApproved = true;
    if (key === "FUNGAL") approvalPatch.fungalApproved = true;
    if (key === "ODOR") approvalPatch.odorApproved = true;
  }
  if (Object.keys(approvalPatch).length > 0) {
    await prisma.lab.update({ where: { id: lab.id }, data: approvalPatch });
    console.log(`  Approvals: ${Object.keys(approvalPatch).join(", ")}`);
  }

  // Service rows — upsert one per test type. Unique key
  // is (labId, testType, testMethod).
  let created = 0;
  let skipped = 0;
  for (const t of tests) {
    const key = t.toUpperCase();
    const def = SERVICE_DEFAULTS[key];
    if (!def) {
      console.warn(`  ⚠ Unknown test "${t}" — skipped. Known: ${Object.keys(SERVICE_DEFAULTS).join(", ")}`);
      continue;
    }
    const row = await prisma.labService.upsert({
      where: {
        labId_testType_testMethod: {
          labId: lab.id,
          testType: def.testType,
          testMethod: def.testMethod,
        },
      },
      create: {
        labId: lab.id,
        testType: def.testType,
        testMethod: def.testMethod,
        priceUSD: def.priceUSD,
        listPriceUSD: def.priceUSD,
        turnaroundDays: def.turnaroundDays,
        description: `${def.testType}${def.testMethod ? ` — ${def.testMethod}` : ""} (seeded defaults)`,
      },
      update: {
        // Don't trample if the lab has already negotiated prices.
        // Only fill nulls.
        priceUSD: undefined,
        turnaroundDays: undefined,
      },
    });
    const newRow = Date.now() - row.createdAt.getTime() < 5_000;
    if (newRow) created++;
    else skipped++;
    console.log(
      `  ${newRow ? "✓" : "="} ${def.testType}${def.testMethod ? ` (${def.testMethod})` : ""}: $${def.priceUSD} / ${def.turnaroundDays}d`,
    );
  }
  console.log(`\nLab id: ${lab.id}`);
  console.log(`Services: ${created} created, ${skipped} already in place`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("✗ Failed:", err?.message || err);
    await prisma.$disconnect();
    process.exit(4);
  });
