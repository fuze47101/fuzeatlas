// @ts-nocheck
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

/* ── POST /api/compliance-docs/[id]/share ──
 *  Issue (or re-issue) a public shareable link for a document. ADMIN/EMPLOYEE
 *  only, gated on getRealUser() (impersonation-safe). Generates a shareToken
 *  if the doc has none, and always (re)sets shareExpiresAt to now + 90 days.
 *  Returns the public URL https://fuzeatlas.com/d/<token>.
 * ────────────────────────────────────────── */
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRealUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json(
        { ok: false, error: "Only admins can create share links" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const doc = await prisma.complianceDocument.findUnique({
      where: { id },
      select: { id: true, shareToken: true },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    const token = doc.shareToken || randomUUID();
    const shareExpiresAt = new Date(Date.now() + NINETY_DAYS_MS);

    await prisma.complianceDocument.update({
      where: { id },
      data: { shareToken: token, shareExpiresAt },
    });

    return NextResponse.json({
      ok: true,
      shareToken: token,
      shareExpiresAt: shareExpiresAt.toISOString(),
      url: `https://fuzeatlas.com/d/${token}`,
    });
  } catch (err: any) {
    console.error("Error creating share link:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
