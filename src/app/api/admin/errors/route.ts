// @ts-nocheck
import { NextResponse } from "next/server";
import { getRecentErrors } from "@/lib/sentry";

/**
 * GET /api/admin/errors
 * Returns the most recent captured errors (admin-only via middleware).
 * This is a lightweight stand-in until full Sentry is installed.
 */
export async function GET() {
  const errors = getRecentErrors();
  return NextResponse.json({ ok: true, count: errors.length, errors });
}
