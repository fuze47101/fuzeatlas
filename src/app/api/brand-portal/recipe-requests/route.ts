// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Brand-side RecipeRequest endpoints (Phase 4C).
 *
 * GET — list every RecipeRequest belonging to the caller's brand,
 *       newest first, with factory + fabric context.
 *
 * POST — create a new RecipeRequest. brandId is taken from the
 *        session, factoryId + fabricId + requestedTier + notes from
 *        the body. status defaults to OPEN. Edit gated to brand
 *        managers + admin-like roles.
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];

const SELECT = {
  id: true,
  brandId: true,
  factoryId: true,
  fabricId: true,
  requestedTier: true,
  notes: true,
  status: true,
  requestedAt: true,
  fulfilledRecipeId: true,
  fulfilledAt: true,
  createdAt: true,
  updatedAt: true,
  factory: { select: { id: true, name: true, country: true } },
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}
function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.brandId) return forbidden();

  const requests = await prisma.recipeRequest.findMany({
    where: { brandId: user.brandId },
    select: SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ ok: true, requests });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();
  if (!user.brandId) return bad("No brand associated with this account");

  const body = await req.json().catch(() => ({}));
  if (!body.factoryId) return bad("factoryId required");
  if (body.requestedTier && !["F1", "F2", "F3", "F4"].includes(body.requestedTier)) {
    return bad("requestedTier must be F1, F2, F3, or F4");
  }

  // Confirm the factory exists before persisting (better error than
  // FK violation).
  const factory = await prisma.factory.findUnique({
    where: { id: body.factoryId },
    select: { id: true },
  });
  if (!factory) return bad("Factory not found");

  const created = await prisma.recipeRequest.create({
    data: {
      brandId: user.brandId,
      factoryId: body.factoryId,
      fabricId: body.fabricId || null,
      requestedTier: body.requestedTier || null,
      notes: body.notes || null,
      requestedById: user.id,
      status: "OPEN",
    },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, request: created });
}
