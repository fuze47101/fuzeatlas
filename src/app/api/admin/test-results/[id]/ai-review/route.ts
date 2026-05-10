// @ts-nocheck
/**
 * /api/admin/test-results/[id]/ai-review — Phase 10G.
 *
 * GET  → return current AiTestReview row (or null if none yet)
 * POST → re-trigger the review and persist
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { persistAiTestReview } from "@/lib/ai-test-review";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "LAB_USER", "LAB_MANAGER"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const review = await prisma.aiTestReview.findUnique({ where: { testRunId: id } });
  return NextResponse.json({ ok: true, review });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const review = await persistAiTestReview(id);
  const persisted = await prisma.aiTestReview.findUnique({ where: { testRunId: id } });
  return NextResponse.json({ ok: true, review: persisted, ...review });
}
