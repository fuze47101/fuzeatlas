// @ts-nocheck
/**
 * GET /api/brand-portal/infer-brand — Phase 15 IMP-1.
 *
 * Server-side email-domain match. The client never sees a brand
 * suggestion it can spoof — this endpoint resolves on the
 * authenticated user's actual email.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { inferBrandFromEmail } from "@/lib/brand-inference";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, brand: null, domain: null }, { status: 401 });
  const inferred = await inferBrandFromEmail(user.email || "");
  return NextResponse.json({ ok: true, ...inferred });
}
