// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── POST /api/tests/[id]/icp ──────────────────────────────────────
   Internal-staff-only ICP entry. Upserts the run's IcpResult so Tina
   (and other lab/internal staff) can hand-key an Ag/Au value onto an
   ITS-uploaded orphan run that arrived without a parsed icpResult.
   Creates the IcpResult if missing, updates it if present. The test
   date lives on TestRun (IcpResult has no date column), so it's
   proxied there when supplied.                                        */

// Mirrors the internal-staff gate used on /admin/product-documents.
const INTERNAL_STAFF_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "FABRIC_MANAGER",
  "TESTING_MANAGER",
];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const user = await getCurrentUser().catch(() => null);
    if (!user || !INTERNAL_STAFF_ROLES.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const { agValue, auValue, unit, testDate } = body;

    const testRun = await prisma.testRun.findUnique({
      where: { id },
      include: { icpResult: true },
    });
    if (!testRun) {
      return NextResponse.json({ ok: false, error: "Test run not found" }, { status: 404 });
    }

    // Parse numerics — blank/absent → null (clears the field).
    const parseNum = (v: any) => {
      if (v === "" || v == null) return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    const ag = parseNum(agValue);
    const au = parseNum(auValue);
    const u = (typeof unit === "string" && unit.trim()) || "mg/kg";

    const data: any = {
      agValue: ag,
      auValue: au,
      unit: u,
      agRaw: ag != null ? String(ag) : null,
      auRaw: au != null ? String(au) : null,
    };

    if (testRun.icpResult) {
      await prisma.icpResult.update({ where: { id: testRun.icpResult.id }, data });
    } else {
      await prisma.icpResult.create({ data: { testRunId: id, ...data } });
    }

    // Test date lives on TestRun. Only touch it when explicitly supplied.
    if (testDate !== undefined) {
      let parsed: Date | null = null;
      if (testDate) {
        const d = new Date(testDate);
        parsed = !isNaN(d.getTime()) ? d : null;
      }
      await prisma.testRun.update({ where: { id }, data: { testDate: parsed } });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("ICP entry error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
