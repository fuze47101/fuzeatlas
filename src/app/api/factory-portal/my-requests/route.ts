// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factory-portal/my-requests
 * Returns all test requests for the current user (by requestedById)
 * Used by factory portal "My Test Requests" page
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
      OR: [
        { requestedById: userId },
      ],
    };

    // If factory user, also show requests linked to fabrics from their factory
    if (factoryId) {
      where.OR.push({
        fabric: { factoryId: factoryId },
      });
    }

    const requests = await prisma.testRequest.findMany({
      where,
      include: {
        lab: { select: { id: true, name: true } },
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true, factoryCode: true } },
        lines: {
          select: {
            id: true,
            testType: true,
            testMethod: true,
            estimatedDays: true,
            status: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            shipDate: true,
            status: true,
            actualArrival: true,
            receivedCondition: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, requests });
  } catch (error: any) {
    console.error("Error fetching factory test requests:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch test requests" },
      { status: 500 }
    );
  }
}
