// @ts-nocheck
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Phase 17 Track 2 — TestTrackingEvent recording infrastructure.
 *
 * Single entry point for state transitions. Inserts a TestTrackingEvent
 * row, denormalizes the latest state onto TestRequest, and fans out to
 * subscribers (in-app + email channels). Web push and SMS deferred per
 * spec's Phase 17.5.
 */

const STATE_LABELS: Record<string, string> = {
  REQUEST_SUBMITTED: "Test request submitted",
  REQUEST_APPROVED: "Approved by FUZE — preparing shipping label",
  SAMPLE_SHIPPED: "Sample shipped from factory",
  SAMPLE_IN_TRANSIT: "Sample in transit",
  SAMPLE_RECEIVED: "Received at lab — in queue",
  LAB_IN_QUEUE: "In queue — awaiting lab start",
  LAB_TESTING: "Testing in progress",
  RESULTS_AVAILABLE: "Results ready — under review",
  BRAND_VISIBLE: "Report sent to brand",
  COMPLETE: "Closed",
  CANCELLED: "Cancelled",
};

export function generateTrackingToken(): string {
  // 24 bytes → 32-char base64url. URL-safe, public-shareable.
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Ensure a TestTrackingToken row exists for a TestRequest. Idempotent.
 * Returns the token string.
 */
export async function ensureTrackingToken(testRequestId: string): Promise<string | null> {
  if (!testRequestId) return null;
  try {
    const existing = await (prisma as any).testTrackingToken.findUnique({
      where: { testRequestId },
      select: { token: true },
    });
    if (existing?.token) return existing.token;
    const token = generateTrackingToken();
    const created = await (prisma as any).testTrackingToken.create({
      data: { testRequestId, token },
      select: { token: true },
    });
    return created.token;
  } catch {
    return null;
  }
}

/**
 * Record a tracking event for a test request. Idempotent for "same
 * state-already-latest" — won't double-stamp if the state hasn't
 * actually transitioned.
 *
 * Fires (async, non-blocking) notification fan-out to subscribers.
 */
export async function recordTrackingEvent(opts: {
  testRequestId: string;
  state: string;
  label?: string;
  metadata?: any;
  occurredById?: string | null;
  isPublic?: boolean;
}): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  const { testRequestId, state } = opts;
  if (!testRequestId || !state) return { ok: false, error: "testRequestId + state required" };

  try {
    // Skip duplicate-stamp of the same state if it's already latest.
    const tr = await prisma.testRequest.findUnique({
      where: { id: testRequestId },
      select: { id: true, trackingState: true, brandId: true, poNumber: true },
    }).catch(() => null);
    if (!tr) return { ok: false, error: "TestRequest not found" };
    if (tr.trackingState === state) {
      return { ok: true, eventId: undefined };
    }

    const label = opts.label || STATE_LABELS[state] || state;

    const event = await (prisma as any).testTrackingEvent.create({
      data: {
        testRequestId,
        state,
        label,
        occurredById: opts.occurredById || null,
        metadata: opts.metadata || undefined,
        isPublic: opts.isPublic !== false,
      },
      select: { id: true },
    });

    await prisma.testRequest.update({
      where: { id: testRequestId },
      data: { trackingState: state, trackingUpdatedAt: new Date() },
    }).catch(() => null);

    // Ensure a tracking token exists once we know about the request.
    void ensureTrackingToken(testRequestId);

    // Fire fan-out async — failure here must not break the calling
    // state transition. Subscribers are best-effort.
    void fanOutToSubscribers(testRequestId, state, label).catch(() => null);

    return { ok: true, eventId: event.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || "record failed" };
  }
}

async function fanOutToSubscribers(testRequestId: string, state: string, label: string) {
  try {
    const subs = await (prisma as any).testTrackingSubscription.findMany({
      where: { testRequestId, unsubscribedAt: null },
      select: { id: true, userId: true, email: true, channels: true },
    });
    if (!subs?.length) return;

    const tr = await prisma.testRequest.findUnique({
      where: { id: testRequestId },
      select: {
        poNumber: true,
        brand: { select: { name: true } },
        trackingToken: { select: { token: true } },
      },
    });
    const trackingUrl = tr?.trackingToken?.token
      ? `${process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com"}/track/${tr.trackingToken.token}`
      : null;

    for (const sub of subs) {
      const channels = String(sub.channels || "").toUpperCase().split(",").map((c) => c.trim());

      if (channels.includes("IN_APP") && sub.userId) {
        await prisma.notification.create({
          data: {
            userId: sub.userId,
            type: "TEST_RESULTS",
            title: `Test ${tr?.poNumber || ""} — ${label}`,
            message: `${tr?.brand?.name || "FUZE"} • ${label}`,
            link: trackingUrl || `/admin/test-requests/${testRequestId}`,
          },
        }).catch(() => null);
      }

      if (channels.includes("EMAIL") && sub.email) {
        try {
          const { sendEmail } = await import("@/lib/email");
          const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com"}/track/unsubscribe/${sub.id}`;
          await sendEmail({
            to: sub.email,
            subject: `[FUZE Atlas] Test ${tr?.poNumber || ""} — ${label}`,
            html: `
              <h2>${label}</h2>
              <p>Test <strong>${tr?.poNumber || ""}</strong> for <strong>${tr?.brand?.name || ""}</strong> has moved to <strong>${state}</strong>.</p>
              ${trackingUrl ? `<p><a href="${trackingUrl}">Open tracking page →</a></p>` : ""}
              <hr/>
              <p style="font-size:11px;color:#777"><a href="${unsubUrl}">Unsubscribe from updates for this test</a></p>
            `,
          });
        } catch {}
      }
    }
  } catch {
    // best-effort; swallow.
  }
}
