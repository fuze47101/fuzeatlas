// @ts-nocheck
/**
 * GET /api/email-templates/bd-slots
 *
 * Returns the current user's BD Wizard quick-pick map — a 10-element array
 * where index i corresponds to slot i+1. Slots the user hasn't filled are
 * `null`. The wizard Draft step renders this as a numbered button strip so
 * the rep can one-click-populate subject + body with their favourite 10
 * openers. (#100 — Andrew 2026-04-22.)
 *
 * We also return a `available` array of every PRIVATE template the user
 * owns that ISN'T currently pinned — useful for the profile/settings page
 * where they pick what goes in each slot.
 *
 * Response:
 *   {
 *     ok: true,
 *     slots: [
 *       { slot: 1, template: {...} | null },
 *       ...
 *       { slot: 10, template: {...} | null },
 *     ],
 *     available: [ {...}, ... ]   // PRIVATE templates not currently pinned
 *   }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const TEMPLATE_SELECT = {
  id: true,
  title: true,
  subject: true,
  body: true,
  category: true,
  scope: true,
  useCount: true,
  lastUsedAt: true,
  bdSlot: true,
  ownerId: true,
};

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // All of my PRIVATE, non-archived templates — we slice off pinned vs
    // available in one pass.
    const mine = await prisma.emailTemplate.findMany({
      where: { ownerId: me.id, scope: "PRIVATE", archivedAt: null },
      orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
      select: TEMPLATE_SELECT,
    });

    const bySlot = new Map<number, (typeof mine)[number]>();
    const available: typeof mine = [];
    for (const t of mine) {
      if (t.bdSlot && t.bdSlot >= 1 && t.bdSlot <= 10) {
        bySlot.set(t.bdSlot, t);
      } else {
        available.push(t);
      }
    }

    const slots = Array.from({ length: 10 }, (_, i) => ({
      slot: i + 1,
      template: bySlot.get(i + 1) || null,
    }));

    return NextResponse.json({ ok: true, slots, available });
  } catch (e: any) {
    console.error("[email-templates/bd-slots GET]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
