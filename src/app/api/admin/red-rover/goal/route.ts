// @ts-nocheck
/**
 * GET   /api/admin/red-rover/goal — the annual book-value goal (singleton).
 * PATCH /api/admin/red-rover/goal — set it ({ annualGoalUsd }).
 * getRealUser admin gate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

async function getGoal() {
  return prisma.redRoverGoal.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", annualGoalUsd: 0 },
  });
}

export async function GET() {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const goal = await getGoal();
  return NextResponse.json({ ok: true, annualGoalUsd: goal.annualGoalUsd, updatedAt: goal.updatedAt });
}

export async function PATCH(req: Request) {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const v = Number(body.annualGoalUsd);
  if (!Number.isFinite(v) || v < 0) {
    return NextResponse.json({ ok: false, error: "annualGoalUsd must be a non-negative number" }, { status: 400 });
  }
  const goal = await prisma.redRoverGoal.upsert({
    where: { id: "singleton" },
    update: { annualGoalUsd: v, updatedById: user.id },
    create: { id: "singleton", annualGoalUsd: v, updatedById: user.id },
  });
  return NextResponse.json({ ok: true, annualGoalUsd: goal.annualGoalUsd });
}
