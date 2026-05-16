// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateAndPersistNarration } from "@/lib/test-narration";

/**
 * POST /api/admin/tests/[id]/regenerate-narration
 *
 * Admin/Employee-only. Re-runs MB-3 narration generation for a
 * TestRun and overwrites whatever was stored. Useful when (a) the
 * Claude prompt changes, (b) the brand-voice gate caught a bad
 * earlier output and the stamp was retried, (c) admin manually
 * rejected the prior text.
 */
const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "TESTING_MANAGER"]);

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await generateAndPersistNarration(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, text: result.text });
}
