// @ts-nocheck
/**
 * POST /api/admin/dedupe/merge
 * body { entityType: "BRAND" | "FACTORY", keeperId, loserIds: string[], dryRun }
 *
 * ADMIN-only, impersonation-safe. Defaults to dryRun=true — a commit requires
 * an explicit dryRun:false. All work happens inside one transaction in the
 * merge engine.
 */
import { NextResponse } from "next/server";
import { getRealUser } from "@/lib/auth";
import { mergeEntities } from "@/lib/dedupe-merge";

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

  const { entityType, keeperId, loserIds } = body || {};
  if (entityType !== "BRAND" && entityType !== "FACTORY") {
    return NextResponse.json(
      { ok: false, error: "entityType must be BRAND or FACTORY" },
      { status: 400 },
    );
  }
  if (!keeperId || !Array.isArray(loserIds) || loserIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "keeperId and non-empty loserIds[] required" },
      { status: 400 },
    );
  }

  const result = await mergeEntities({
    entityType,
    keeperId,
    loserIds,
    dryRun: body.dryRun !== false, // default TRUE
    actor: { id: user.id, name: user.name, email: user.email },
  });

  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
