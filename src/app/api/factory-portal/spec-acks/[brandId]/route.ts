// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { acknowledgeSpec } from "@/lib/spec-acks";
import { notifySpecAcknowledged } from "@/lib/notify";

/**
 * GET  /api/factory-portal/spec-acks/[brandId] — preview the spec
 *      the factory is being asked to confirm. Returns brand spec
 *      snapshot + last ack history for context.
 *
 * POST /api/factory-portal/spec-acks/[brandId] — record the ack.
 *      Stamps BrandSpecAcknowledgement with the brand's current
 *      brandSpecUpdatedAt as the specVersion. Fans notify to the
 *      brand's primary AM.
 */

export async function GET(req: Request, ctx: { params: Promise<{ brandId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  const { brandId } = await ctx.params;

  // Confirm there's an active supply link before we expose the spec.
  const link = await prisma.supplyChainLink.findFirst({
    where: {
      fromType: "BRAND",
      fromId: brandId,
      toType: "FACTORY",
      toId: user.factoryId,
      relation: "SUPPLIES",
      active: true,
    },
    select: { id: true },
  });
  if (!link) {
    return NextResponse.json(
      { ok: false, error: "Your factory doesn't supply this brand" },
      { status: 403 },
    );
  }

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      brandSpecUpdatedAt: true,
      requiredFuzeTier: true,
      icpCadenceEveryNBatches: true,
      icpCadenceEveryLitersConsumed: true,
      requiresApproval: true,
      protocolDocUrl: true,
    },
  });
  if (!brand)
    return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  let history: any[] = [];
  try {
    history = await prisma.brandSpecAcknowledgement.findMany({
      where: { brandId: brand.id, factoryId: user.factoryId },
      include: {
        acknowledgedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { specVersion: "desc" },
      take: 10,
    });
  } catch {
    /* table not provisioned yet; gracefully empty */
  }

  const currentVersion = brand.brandSpecUpdatedAt;
  const latest = history[0] || null;
  const isPending =
    !!currentVersion &&
    (!latest || latest.specVersion < currentVersion);

  return NextResponse.json({
    ok: true,
    brand,
    isPending,
    history: history.map((h: any) => ({
      id: h.id,
      specVersion: h.specVersion.toISOString(),
      acknowledgedAt: h.acknowledgedAt.toISOString(),
      acknowledgedBy: h.acknowledgedBy
        ? {
            id: h.acknowledgedBy.id,
            name: h.acknowledgedBy.name,
            email: h.acknowledgedBy.email,
          }
        : null,
      acknowledgedTier: h.acknowledgedTier,
      acknowledgedCadenceBatches: h.acknowledgedCadenceBatches,
      acknowledgedCadenceLiters: h.acknowledgedCadenceLiters,
      acknowledgedProtocolDocUrl: h.acknowledgedProtocolDocUrl,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ brandId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  const { brandId } = await ctx.params;

  const result = await acknowledgeSpec({
    brandId,
    factoryId: user.factoryId,
    userId: user.id,
  });
  if (!result.acknowledged) {
    return NextResponse.json(
      { ok: false, error: result.error || "Failed to record acknowledgement" },
      { status: 400 },
    );
  }

  // Fan to brand's primary AM + admins. Fire-and-forget so a notify
  // failure doesn't block the ack itself.
  const factory = await prisma.factory.findUnique({
    where: { id: user.factoryId },
    select: { name: true },
  });
  notifySpecAcknowledged({
    brandId,
    factoryId: user.factoryId,
    factoryName: factory?.name || null,
    acknowledgedByUserId: user.id,
    acknowledgedByName: user.name || null,
  }).catch((e) => console.warn("[spec-ack] notify failed:", e));

  return NextResponse.json({
    ok: true,
    acknowledgementId: result.id,
    specVersion: result.specVersion?.toISOString() || null,
  });
}
