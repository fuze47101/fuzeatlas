// @ts-nocheck
/**
 * GET /api/admin/bd/wizard/brand/[id]
 *
 * Returns a specific brand + contacts in the same shape as
 * /api/admin/bd/wizard/next-brand, but for a rep who has already picked
 * the brand they want to email (e.g. from the 📧 Email button on
 * /brands/[id]). Bypasses the next-brand queue + ranking.
 *
 * Unlike next-brand this does NOT require pipelineStage=LEAD or
 * salesRepId=null — any brand the rep has access to via the brand detail
 * page can be used to launch the wizard.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isBDEligible =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP" ||
      user.role === "BD_REP" ||
      user.role === "DISTRIBUTOR_USER";
    if (!isBDEligible) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "brand id required" }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        contacts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            personalEmail: true,
            linkedinUrl: true,
            jobTitle: true,
            seniority: true,
            emailStatus: true,
            outreachStatus: true,
            lastContactedAt: true,
          },
        },
      },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      brand: {
        id: brand.id,
        name: brand.name,
        website: brand.website,
        linkedInProfile: brand.linkedInProfile,
        backgroundInfo: brand.backgroundInfo,
        fuzeRelevance: brand.fuzeRelevance,
        validationStatus: brand.validationStatus,
        textileCategory: brand.textileCategory,
        researchData: brand.researchData || null,
        researchDate: brand.researchDate ? brand.researchDate.toISOString() : null,
        updatedAt: brand.updatedAt.toISOString(),
        contacts: (brand.contacts || []).map((c: any) => ({
          id: c.id,
          name: c.name || [c.firstName, c.lastName].filter(Boolean).join(" "),
          email: c.email,
          personalEmail: c.personalEmail,
          linkedinUrl: c.linkedinUrl,
          jobTitle: c.jobTitle,
          seniority: c.seniority,
          emailStatus: c.emailStatus,
          outreachStatus: c.outreachStatus,
          lastContactedAt: c.lastContactedAt ? c.lastContactedAt.toISOString() : null,
        })),
      },
      queueDepth: 0,
    });
  } catch (err: any) {
    console.error("[bd/wizard/brand/[id]] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load brand" },
      { status: 500 },
    );
  }
}
