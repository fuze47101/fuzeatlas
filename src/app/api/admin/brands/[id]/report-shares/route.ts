// @ts-nocheck
/**
 * GET /api/admin/brands/[id]/report-shares
 *
 * Returns every Phase 2 Application Report that has been emailed to
 * any recipient for any fabric tied to this brand. Powers the
 * "Reports" tab on the brand detail page so reps can see:
 *   - what was sent, when, to whom
 *   - whether the recipient opened it (viewedCount + lastViewedAt)
 *   - which fabric / customer reference each report covers
 *   - direct link to re-open the same /report/[token] URL
 *
 * Two ways a share is "for this brand":
 *   (a) FabricReportShare.brandId == this brand
 *   (b) FabricReportShare.fabric.brandId == this brand
 *
 * (b) is the common case (the share is created for a fabric that
 * belongs to the brand). (a) is set explicitly when the rep emails
 * a report from the brand context. We OR them so both surface.
 *
 * Auth: any internal user. The portal-side equivalent for customers
 * is /api/portal/my-reports (already shipped Phase 2).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const allowed = [
      "ADMIN",
      "EMPLOYEE",
      "SALES_MANAGER",
      "SALES_REP",
      "BD_REP",
      "LAB_USER",
      "LAB_MANAGER",
    ];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const shares = await prisma.fabricReportShare.findMany({
      where: {
        OR: [
          { brandId: id },
          { fabric: { brandId: id } },
        ],
      },
      orderBy: { sentAt: "desc" },
      take: 200,
      include: {
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            customerReference: true,
            fabricCategory: true,
            color: true,
            weightGsm: true,
          },
        },
      },
    });

    // Roll up engagement stats so the panel can show a top-line
    // "X reports sent, Y opened (Z%)" without re-counting client-side.
    const totalSent = shares.length;
    const totalOpened = shares.filter((s: any) => s.viewedCount > 0).length;
    const totalActive = shares.filter(
      (s: any) =>
        !s.revokedAt && (!s.expiresAt || s.expiresAt.getTime() > Date.now()),
    ).length;
    const openedRate = totalSent > 0 ? totalOpened / totalSent : 0;

    return NextResponse.json({
      ok: true,
      shares: shares.map((s: any) => ({
        id: s.id,
        token: s.token,
        recipientEmail: s.recipientEmail,
        recipientName: s.recipientName,
        subjectLine: s.subjectLine,
        tier: s.tier,
        sentAt: s.sentAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        viewedCount: s.viewedCount,
        lastViewedAt: s.lastViewedAt,
        fabric: s.fabric,
      })),
      summary: {
        totalSent,
        totalOpened,
        totalActive,
        openedRate,
      },
    });
  } catch (e: any) {
    console.error("[brand.report-shares] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
