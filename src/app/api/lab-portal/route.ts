// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── GET /api/lab-portal ── Lab user: get their lab + services + incoming requests */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "LAB_USER" || !user.labId) {
      return NextResponse.json({ ok: false, error: "Lab access required" }, { status: 403 });
    }

    const lab = await prisma.lab.findUnique({
      where: { id: user.labId },
      include: {
        services: { orderBy: { testMethod: "asc" } },
        documents: {
          where: { kind: "LAB_FORM" },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            testRuns: true,
            testRequests: true,
          },
        },
      },
    });

    if (!lab) {
      return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });
    }

    // Get incoming test requests for this lab
    const testRequests = await prisma.testRequest.findMany({
      where: { labId: user.labId },
      include: {
        brand: { select: { id: true, name: true } },
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true, construction: true, weightGsm: true } },
        requestedBy: { select: { id: true, name: true } },
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Stats
    const stats = {
      totalServices: lab.services.length,
      totalTestRuns: lab._count.testRuns,
      pendingRequests: testRequests.filter((r) => ["PENDING_APPROVAL", "APPROVED", "SUBMITTED"].includes(r.status)).length,
      activeRequests: testRequests.filter((r) => r.status === "IN_PROGRESS").length,
      completedRequests: testRequests.filter((r) => ["RESULTS_RECEIVED", "COMPLETE"].includes(r.status)).length,
    };

    return NextResponse.json({
      ok: true,
      lab: {
        id: lab.id,
        name: lab.name,
        address: lab.address,
        city: lab.city,
        state: lab.state,
        country: lab.country,
        region: lab.region,
        website: lab.website,
        email: lab.email,
        phone: lab.phone,
        accreditations: lab.accreditations,
        icpApproved: lab.icpApproved,
        abApproved: lab.abApproved,
        fungalApproved: lab.fungalApproved,
        odorApproved: lab.odorApproved,
        uvApproved: lab.uvApproved,
        notes: lab.notes,
        customerNumber: lab.customerNumber,
      },
      services: lab.services,
      documents: lab.documents,
      testRequests: testRequests.map((r) => ({
        id: r.id,
        poNumber: r.poNumber,
        status: r.status,
        priority: r.priority,
        brand: r.brand,
        fabric: r.fabric,
        requestedBy: r.requestedBy,
        estimatedCost: r.estimatedCost,
        specialInstructions: r.specialInstructions,
        lines: r.lines,
        createdAt: r.createdAt,
      })),
      stats,
    });
  } catch (e: any) {
    console.error("Lab portal GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load lab portal data" }, { status: 500 });
  }
}

/* ── PUT /api/lab-portal ── Lab user: update their services (catalog) */
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "LAB_USER" || !user.labId) {
      return NextResponse.json({ ok: false, error: "Lab access required" }, { status: 403 });
    }

    const body = await req.json();
    const { services, profile } = body;

    // Update lab profile if provided
    if (profile) {
      await prisma.lab.update({
        where: { id: user.labId },
        data: {
          ...(profile.address !== undefined && { address: profile.address || null }),
          ...(profile.city !== undefined && { city: profile.city || null }),
          ...(profile.state !== undefined && { state: profile.state || null }),
          ...(profile.country !== undefined && { country: profile.country || null }),
          ...(profile.website !== undefined && { website: profile.website || null }),
          ...(profile.email !== undefined && { email: profile.email || null }),
          ...(profile.phone !== undefined && { phone: profile.phone || null }),
          ...(profile.accreditations !== undefined && { accreditations: profile.accreditations || null }),
        },
      });
    }

    // Update services if provided
    if (Array.isArray(services)) {
      const existingIds = services.filter((s) => s.id).map((s) => s.id);

      // Delete removed services
      await prisma.labService.deleteMany({
        where: { labId: user.labId, id: { notIn: existingIds } },
      });

      for (const svc of services) {
        const data = {
          testType: svc.testType,
          testMethod: svc.testMethod || null,
          description: svc.description || null,
          // Lab users set listPriceUSD (their price); FUZE admin sets priceUSD (negotiated)
          listPriceUSD: svc.listPriceUSD != null ? Number(svc.listPriceUSD) : null,
          turnaroundDays: svc.turnaroundDays != null ? Number(svc.turnaroundDays) : null,
          rushPriceUSD: svc.rushPriceUSD != null ? Number(svc.rushPriceUSD) : null,
          rushDays: svc.rushDays != null ? Number(svc.rushDays) : null,
          notes: svc.notes || null,
        };

        if (svc.id) {
          await prisma.labService.update({
            where: { id: svc.id },
            data,
          });
        } else {
          await prisma.labService.create({
            data: { labId: user.labId, ...data },
          });
        }
      }
    }

    // Re-fetch updated data
    const updated = await prisma.lab.findUnique({
      where: { id: user.labId },
      include: {
        services: { orderBy: { testMethod: "asc" } },
      },
    });

    return NextResponse.json({ ok: true, lab: updated });
  } catch (e: any) {
    console.error("Lab portal PUT error:", e);
    return NextResponse.json({ ok: false, error: "Failed to update lab data" }, { status: 500 });
  }
}
