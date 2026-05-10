// @ts-nocheck
/**
 * GET /api/cron/seed-fuze-protocols — Phase 10I.
 *
 * Idempotent. For every active LabTest row whose testType matches
 * one of the canonical FUZE protocols, stamps the protocolJson
 * column with the FUZE-specified parameters. Re-runs are no-ops.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROTOCOLS: Record<string, any> = {
  ICP_MS: {
    method: "ICP-MS",
    note: "FUZE policy: ICP testing is ICP-MS only. ICP-OES results are not accepted.",
  },
  ASTM_E2149: {
    incubationHours: 24,
    broth: "Mueller Hinton low-sulfur",
    sterilizationMethod: "UV only",
    additionalRequirements:
      "Do not autoclave or chemically sterilize — those methods bury FUZE metamaterial in synthetic fibers and invalidate the test.",
  },
  AATCC_100: {
    initialInoculumCfuPerMl: { min: 1e5, max: 5e5 },
    additionalRequirements:
      "Record initial inoculum count. FUZE expects 1-5×10^5 CFU/mL range; out-of-range counts get flagged in AI review.",
  },
  AATCC_30: {
    additionalRequirements: "Antifungal protocol per AATCC 30 standard.",
  },
  ISO_18184: {
    additionalRequirements: "Antiviral protocol per ISO 18184.",
  },
  ISO_20743: {
    additionalRequirements: "Quantitative antibacterial activity per ISO 20743.",
  },
};

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];
  for (const [testType, protocol] of Object.entries(PROTOCOLS)) {
    const updated = await prisma.labTest.updateMany({
      where: {
        testType,
        active: true,
        protocolJson: { equals: null },
      },
      data: { protocolJson: protocol },
    });
    results.push({ testType, updated: updated.count });
  }

  return NextResponse.json({ ok: true, results });
}
