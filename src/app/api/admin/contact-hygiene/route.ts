// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/contact-hygiene
 *
 * List contacts with their persisted hygiene snapshot. Drives the admin
 * dashboard at /admin/contact-hygiene. Returns only contacts that have
 * actually been scanned (hygieneCheckedAt != null) plus the never-scanned
 * set when `?verdict=unscanned` is passed.
 *
 * Query params:
 *   - verdict:  real | suspicious | placeholder | role_account | unscanned
 *               (default: everything with a snapshot)
 *   - hidden:   "true" | "false"  — filter by hiddenFromWizard
 *   - q:        free-text match on name/email
 *   - brandId:  scope to a single brand
 *   - limit:    default 200, max 1000
 *
 * Admin + EMPLOYEE + SALES_MANAGER only.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin or manager only" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const verdict = sp.get("verdict");
    const hidden = sp.get("hidden");
    const q = sp.get("q")?.trim();
    const brandId = sp.get("brandId");
    const rawLimit = parseInt(sp.get("limit") || "200", 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 1000);

    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (verdict === "unscanned") {
      where.hygieneCheckedAt = null;
    } else if (verdict && ["real", "suspicious", "placeholder", "role_account"].includes(verdict)) {
      where.hygieneVerdict = verdict;
    } else {
      // Default list: only rows that have been scanned at least once.
      where.hygieneCheckedAt = { not: null };
    }
    if (hidden === "true") where.hiddenFromWizard = true;
    else if (hidden === "false") where.hiddenFromWizard = false;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ];
    }

    // Totals by verdict so the dashboard can show counts without a
    // second round trip. Run in parallel with the row query.
    const [rows, totals] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [
          { hygieneScore: "asc" }, // worst first
          { updatedAt: "desc" },
        ],
        take: limit,
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          jobTitle: true,
          linkedinUrl: true,
          hygieneScore: true,
          hygieneVerdict: true,
          hygieneFlags: true,
          hygieneCheckedAt: true,
          emailValidity: true,
          linkedinValidity: true,
          hiddenFromWizard: true,
          outreachStatus: true,
          brand: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
        },
      }),
      prisma.contact.groupBy({
        by: ["hygieneVerdict"],
        _count: { _all: true },
      }),
    ]);

    const byVerdict: Record<string, number> = {};
    for (const t of totals) {
      const k = t.hygieneVerdict || "unscanned";
      byVerdict[k] = (byVerdict[k] || 0) + (t._count?._all || 0);
    }

    const hiddenCount = await prisma.contact.count({ where: { hiddenFromWizard: true } });

    return NextResponse.json({
      ok: true,
      rows: rows.map((r: any) => ({
        ...r,
        // Parse the JSON reasons array lazily. Returned as a plain array
        // so the client doesn't have to deal with a stringified payload.
        hygieneFlags: safeParseJsonArray(r.hygieneFlags),
      })),
      totals: byVerdict,
      hiddenCount,
      limit,
    });
  } catch (e: any) {
    console.error("[contact-hygiene GET] failed:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function safeParseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
