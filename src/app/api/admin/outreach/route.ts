// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/outreach
 * Returns brands with contacts, enrichment status, and outreach history.
 * Supports filters: vertical, outreachStatus, emailStatus, pipelineStage, search
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const vertical = searchParams.get("vertical") || "";
    const outreachStatus = searchParams.get("outreachStatus") || "";
    const emailStatus = searchParams.get("emailStatus") || "";
    const pipelineStage = searchParams.get("pipelineStage") || "";
    const hasEmail = searchParams.get("hasEmail") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build contact filter
    const contactWhere: any = {};
    if (vertical) contactWhere.vertical = vertical;
    if (outreachStatus) contactWhere.outreachStatus = outreachStatus;
    if (emailStatus) contactWhere.emailStatus = emailStatus;
    if (hasEmail === "true") contactWhere.email = { not: null };
    if (hasEmail === "false") contactWhere.email = null;

    // Build brand filter
    const brandWhere: any = {};
    if (pipelineStage) brandWhere.pipelineStage = pipelineStage;
    if (search) {
      brandWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contacts: { some: { name: { contains: search, mode: "insensitive" } } } },
        { contacts: { some: { email: { contains: search, mode: "insensitive" } } } },
      ];
    }

    // Get brands with their contacts and outreach data
    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where: brandWhere,
        include: {
          contacts: {
            where: Object.keys(contactWhere).length > 0 ? contactWhere : undefined,
            include: {
              outreachMessages: {
                orderBy: { sentAt: "desc" },
                take: 3,
              },
            },
            orderBy: { updatedAt: "desc" },
          },
          salesRep: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.brand.count({ where: brandWhere }),
    ]);

    // Get aggregate stats
    const stats = await prisma.contact.groupBy({
      by: ["outreachStatus"],
      _count: true,
      where: { brandId: { not: null } },
    });

    const emailStats = await prisma.contact.groupBy({
      by: ["emailStatus"],
      _count: true,
      where: { brandId: { not: null } },
    });

    const totalContacts = await prisma.contact.count({ where: { brandId: { not: null } } });
    const withEmail = await prisma.contact.count({ where: { brandId: { not: null }, email: { not: null } } });
    const withPhone = await prisma.contact.count({ where: { brandId: { not: null }, phone: { not: null } } });
    const enriched = await prisma.contact.count({ where: { brandId: { not: null }, enrichedAt: { not: null } } });

    return NextResponse.json({
      ok: true,
      brands,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        totalContacts,
        withEmail,
        withPhone,
        enriched,
        byOutreachStatus: Object.fromEntries(stats.map((s) => [s.outreachStatus || "not_contacted", s._count])),
        byEmailStatus: Object.fromEntries(emailStats.map((s) => [s.emailStatus || "unknown", s._count])),
      },
    });
  } catch (error: any) {
    console.error("Outreach API error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
