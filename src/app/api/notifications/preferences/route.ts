// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/notifications/preferences
 * PATCH /api/notifications/preferences
 *
 * Per-user notification preferences. Defaults all-on (missing key
 * means subscribed). PATCH accepts a partial { category: boolean }
 * map and merges it into the stored preferences JSON.
 */

const KNOWN_CATEGORIES = [
  "fabric_submission_received",
  "fabric_submission_status_change",
  "test_request_status_change",
  "test_result_brand_visible",
  "icp_validated",
  "recipe_graduated",
  "icp_cadence_overdue",
  "order_placed",
  "order_status_change",
  "order_application_flag",
  "crm_activity",
  "weekly_digest",
  "monthly_digest",
  "approval_pending",
  "approval_overdue",
];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const sub = await prisma.notificationSubscription.findUnique({
    where: { userId: user.id },
    select: { preferences: true, updatedAt: true },
  });
  return NextResponse.json({
    ok: true,
    preferences: (sub?.preferences as Record<string, boolean>) || {},
    knownCategories: KNOWN_CATEGORIES,
    updatedAt: sub?.updatedAt || null,
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  if (!body.preferences || typeof body.preferences !== "object") {
    return NextResponse.json(
      { ok: false, error: "preferences object required" },
      { status: 400 },
    );
  }

  // Merge with existing — PATCH semantics: only flip the keys passed in.
  const existing = await prisma.notificationSubscription.findUnique({
    where: { userId: user.id },
    select: { preferences: true },
  });
  const merged = {
    ...((existing?.preferences as Record<string, boolean>) || {}),
    ...Object.fromEntries(
      Object.entries(body.preferences).map(([k, v]) => [k, Boolean(v)]),
    ),
  };

  const sub = await prisma.notificationSubscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, preferences: merged },
    update: { preferences: merged },
    select: { preferences: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, preferences: sub.preferences, updatedAt: sub.updatedAt });
}
