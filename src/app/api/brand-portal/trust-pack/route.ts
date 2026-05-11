// @ts-nocheck
/**
 * POST /api/brand-portal/trust-pack — Phase 15 IMP-5 stub.
 *
 * Will eventually return a ZIP of EPA + California EPA +
 * OEKO-TEX + bluesign + PFAS attestation + SDS + this brand's
 * protocol doc + most-recent ICP per factory. Composing a real
 * ZIP server-side needs jszip or similar — deferred so the
 * Phase 15 imperative tier can land. Returns 501 with a
 * descriptive message so the UI surfaces a polite "coming soon"
 * instead of a silent failure.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    {
      ok: false,
      code: "not_implemented",
      message:
        "Trust-pack ZIP composer is coming soon. In the meantime download each compliance doc individually from the list above.",
    },
    { status: 501 },
  );
}
