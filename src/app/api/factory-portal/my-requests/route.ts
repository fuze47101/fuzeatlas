// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/my-requests
 * Returns all FUZE test requests for the current factory user.
 * Queries fuzeTestRequest (where factory portal submissions actually live).
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const userId = sessionUser.id;
    const factoryId = sessionUser.factoryId;

    // Build filter: show requests from this user, or from their factory
    const where: any = {
      OR: [{ requestedBy: userId }],
    };

    if (factoryId) {
      where.OR.push({ factoryId });
    }

    const requests = await prisma.fuzeTestRequest.findMany({
      where,
      include: {
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also try to find any linked admin TestRequests (POs) for status context
    const formatted = requests.map((r: any) => ({
      id: r.id,
      fabricId: r.fabricId,
      fabric: r.fabric,
      selectedTests: r.selectedTests || [],
      status: r.status,
      controlRequired: r.controlRequired,
      totalMoqMeters: r.totalMoqMeters,
      trackingNumber: r.trackingNumber,
      shippedDate: r.shippedDate,
      receivedDate: r.receivedDate,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({ ok: true, requests: formatted });
  } catch (error: any) {
    console.error("Error fetching factory test requests:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch test requests" },
      { status: 500 }
    );
  }
}
