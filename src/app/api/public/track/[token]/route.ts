// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { projectNextEta, TRACKING_STATES } from "@/lib/test-tracking-eta";

/**
 * GET /api/public/track/[token]
 *
 * Phase 17 Track 3 — public, no-auth read endpoint that powers the
 * /track/[token] page. Validates token, returns timeline + ETA.
 * Bumps viewCount on every hit.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token required" }, { status: 400 });
  }

  const tt = await (prisma as any).testTrackingToken.findUnique({
    where: { token },
    select: {
      id: true,
      testRequestId: true,
      expiresAt: true,
      viewCount: true,
      testRequest: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          trackingState: true,
          trackingUpdatedAt: true,
          fuzeFabricNumber: true,
          customerFabricCode: true,
          createdAt: true,
          brand: { select: { name: true } },
          fabric: { select: { fuzeNumber: true, customerCode: true } },
        },
      },
    },
  });

  if (!tt || !tt.testRequest) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (tt.expiresAt && new Date(tt.expiresAt) < new Date()) {
    return NextResponse.json({ ok: false, error: "Token expired" }, { status: 410 });
  }

  // Bump view counter, non-blocking.
  void (prisma as any).testTrackingToken
    .update({
      where: { id: tt.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
    .catch(() => null);

  const events = await (prisma as any).testTrackingEvent.findMany({
    where: { testRequestId: tt.testRequestId, isPublic: true },
    orderBy: { occurredAt: "asc" },
    select: { id: true, state: true, label: true, occurredAt: true, metadata: true },
  });

  // Compute ETA from the latest event timestamp.
  let eta: any = null;
  const currentState = tt.testRequest.trackingState || (events.at(-1)?.state ?? null);
  const latestAt = events.at(-1)?.occurredAt || tt.testRequest.trackingUpdatedAt || tt.testRequest.createdAt;
  if (currentState && latestAt) {
    eta = await projectNextEta(currentState, new Date(latestAt));
  }

  return NextResponse.json({
    ok: true,
    test: {
      poNumber: tt.testRequest.poNumber,
      brandName: tt.testRequest.brand?.name || null,
      fuzeNumber: tt.testRequest.fuzeFabricNumber || tt.testRequest.fabric?.fuzeNumber || null,
      customerCode: tt.testRequest.customerFabricCode || tt.testRequest.fabric?.customerCode || null,
      status: tt.testRequest.status,
      trackingState: currentState,
    },
    timeline: events,
    eta,
    states: TRACKING_STATES,
  });
}
