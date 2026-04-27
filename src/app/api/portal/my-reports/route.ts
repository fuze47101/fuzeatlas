// @ts-nocheck
/**
 * GET /api/portal/my-reports
 *
 * Returns FabricReportShare rows visible to the logged-in user.
 * Visibility logic:
 *   - Email match: share.recipientEmail == user.email (case-insensitive)
 *   - Brand match: share.brandId in user's accessible brand IDs
 *   - Internal: ADMIN/EMPLOYEE/SALES_* see everything (handy for support
 *     or impersonating a customer view).
 *
 * Optional query: ?q= search across customer reference / brand / FUZE#
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const includeExpired =
      url.searchParams.get("includeExpired") === "1" || false;

    const isInternal = [
      "ADMIN",
      "EMPLOYEE",
      "SALES_MANAGER",
      "SALES_REP",
      "BD_REP",
    ].includes(user.role);

    const ors: any[] = [];
    // Email match — primary path for customer recipients with an Atlas
    // login.
    if (user.email) {
      ors.push({
        recipientEmail: { equals: user.email, mode: "insensitive" },
      });
    }
    // Brand match — for users whose contact record is tied to the brand
    // the report was sent on.
    if (user.brandId) {
      ors.push({ brandId: user.brandId });
    }
    if (user.contactId) {
      ors.push({ contactId: user.contactId });
    }

    let where: any;
    if (isInternal) {
      where = {}; // see everything
    } else {
      if (ors.length === 0) {
        return NextResponse.json({ ok: true, reports: [] });
      }
      where = { OR: ors };
    }

    const ands: any[] = [];
    if (!includeExpired) {
      ands.push({
        OR: [
          { expiresAt: { gt: new Date() } },
          { expiresAt: null },
        ],
      });
      ands.push({ revokedAt: null });
    }
    if (q) {
      const fuzeNum = /^\d+$/.test(q) ? parseInt(q, 10) : null;
      ands.push({
        OR: [
          { fabric: { customerReference: { contains: q, mode: "insensitive" } } },
          { fabric: { customerCode: { contains: q, mode: "insensitive" } } },
          { fabric: { factoryCode: { contains: q, mode: "insensitive" } } },
          ...(fuzeNum !== null
            ? [{ fabric: { fuzeNumber: fuzeNum } }]
            : []),
          { fabric: { brand: { name: { contains: q, mode: "insensitive" } } } },
          { recipientEmail: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (ands.length > 0) {
      where = { AND: [where, ...ands].filter((x: any) => x && Object.keys(x).length > 0) };
    }

    const shares = await prisma.fabricReportShare.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 100,
      include: {
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            customerReference: true,
            fabricCategory: true,
            color: true,
            weightGsm: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      reports: shares.map((s: any) => ({
        id: s.id,
        token: s.token,
        recipientEmail: s.recipientEmail,
        recipientName: s.recipientName,
        sentAt: s.sentAt,
        expiresAt: s.expiresAt,
        viewedCount: s.viewedCount,
        lastViewedAt: s.lastViewedAt,
        revokedAt: s.revokedAt,
        tier: s.tier,
        subjectLine: s.subjectLine,
        fabric: s.fabric,
      })),
    });
  } catch (e: any) {
    console.error("[my-reports] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
