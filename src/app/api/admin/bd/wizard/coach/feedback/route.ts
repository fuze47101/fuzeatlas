// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/coach/feedback — Phase 11B.
 *
 * Records whether the rep applied a coach suggestion (and if not,
 * an optional reason). Feeds into future training signal.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.suggestionId || !body?.kind || typeof body.applied !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "suggestionId, kind, applied required" },
      { status: 400 },
    );
  }
  await prisma.coachFeedback.create({
    data: {
      userId: user.id,
      suggestionId: String(body.suggestionId),
      kind: String(body.kind),
      applied: !!body.applied,
      feedback: body.feedback || null,
    },
  });
  return NextResponse.json({ ok: true });
}
