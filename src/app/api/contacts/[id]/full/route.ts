// @ts-nocheck
/**
 * GET /api/contacts/[id]/full
 *
 * Full Contact projection for the per-contact detail page. The /activity
 * route returns a thin projection (name + email only) so the page used
 * to render badges and verification chips against missing fields. This
 * route returns the full row including emailValidity / linkedinValidity /
 * raw timestamps so ContactVerifyButtons can render "last checked" beside
 * each affordance.
 *
 * ACL: same as the verify endpoints — ADMIN/EMPLOYEE/SALES_MANAGER/
 * SALES_REP/BD_REP. (BRAND_USER etc. can't view other people's contact
 * records; they go through the brand portal.)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me || !ALLOWED_ROLES.includes(me.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, contact });
  } catch (e: any) {
    console.error("[contacts/full] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
