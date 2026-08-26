// @ts-nocheck
/**
 * POST /api/admin/dedupe/reallocate
 * body { brandId, factoryId, dryRun }
 *
 * ADMIN-only, impersonation-safe. Reallocates a mis-typed Brand's cleanly-
 * mappable rows (contacts + CRM notes) onto the correct Factory, flags brand-
 * semantic rows for manual review, and removes the Brand husk only if empty.
 * Defaults to dryRun=true.
 */
import { NextResponse } from "next/server";
import { getRealUser } from "@/lib/auth";
import { reallocateBrandToFactory } from "@/lib/dedupe-merge";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getRealUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandId, factoryId } = body || {};
  if (!brandId || !factoryId) {
    return NextResponse.json(
      { ok: false, error: "brandId and factoryId required" },
      { status: 400 },
    );
  }

  const result = await reallocateBrandToFactory({
    brandId,
    factoryId,
    dryRun: body.dryRun !== false, // default TRUE
    actor: { id: user.id, name: user.name, email: user.email },
  });

  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
