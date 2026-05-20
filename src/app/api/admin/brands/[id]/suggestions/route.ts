// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  computeBrandSuggestions,
  SUGGESTION_DISMISS_NOTE_PREFIX,
} from "@/lib/suggestions";

/**
 * GET    /api/admin/brands/[id]/suggestions
 *   Compute the suggested-next-moves panel for this brand.
 *
 * POST   /api/admin/brands/[id]/suggestions
 *   Body: { suggestionId: string, reason?: string }
 *   Dismiss a suggestion for 7 days by stamping a Note row keyed on
 *   the suggestion id. The lib's loader filters those out for 7d.
 */

const ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const suggestions = await computeBrandSuggestions(id);
  return NextResponse.json({ ok: true, suggestions });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const suggestionId = (body.suggestionId || "").trim();
  if (!suggestionId) {
    return NextResponse.json(
      { ok: false, error: "suggestionId required" },
      { status: 400 },
    );
  }
  const reason = (body.reason || "").trim();

  try {
    await prisma.note.create({
      data: {
        brandId: id,
        userId: user.id, // Note model field is userId, not authorId (schema-drift fix 2026-05-18)
        noteType: "ACTIVITY",
        date: new Date(),
        content: `${SUGGESTION_DISMISS_NOTE_PREFIX} ${suggestionId}${reason ? ` — ${reason}` : ""}`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to dismiss" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
