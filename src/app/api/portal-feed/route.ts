// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/portal-feed  (Phase 8A)
 *
 * Returns last 10 Notification rows for the caller. The "what just
 * happened" feed mounted at the top of every portal landing. Read-
 * only and per-user — no role-specific filtering beyond
 * Notification.userId already scoping to the caller.
 *
 * Each event carries severity (info/warn/error) derived from the
 * notification metadata.severity when present, otherwise falls
 * back to "info".
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function severityFor(n: any): "info" | "warn" | "error" {
  const m = (n.metadata || {}) as Record<string, any>;
  if (m.severity === "error") return "error";
  if (m.severity === "warn" || m.severity === "warning") return "warn";
  // Title heuristics for older rows that didn't stamp severity.
  const title = String(n.title || "");
  if (title.startsWith("🚨")) return "error";
  if (title.startsWith("⚠")) return "warn";
  return "info";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      link: true,
      read: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const events = notifications.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    severity: severityFor(n),
    kind: (n.metadata as any)?.kind || null,
    createdAt: n.createdAt,
  }));

  // Edge-friendly cache hint — 10s freshness, can stale-while-revalidate
  // for a minute. Notifications fan out near-real-time; clients are fine
  // with a brief lag.
  const res = NextResponse.json({ ok: true, events });
  res.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
  return res;
}
