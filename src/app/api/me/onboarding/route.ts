// @ts-nocheck
/**
 * POST /api/me/onboarding — Phase 14E.
 *
 * Body: { completed: boolean, state?: Json }
 * Flips User.onboardingCompletedAt and persists onboardingState.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      onboardingCompletedAt: body?.completed ? new Date() : null,
      onboardingState: body?.state ?? undefined,
    },
  });
  return NextResponse.json({ ok: true });
}
