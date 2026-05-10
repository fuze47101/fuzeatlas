// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin / FUZE-Ops side of RecipeRequest (Phase 4C).
 *
 * GET — full list with optional filters: ?status=OPEN, ?brandId=,
 *       ?factoryId=. Newest-first within each status.
 *
 * PATCH — fulfillment / decline. Body shapes:
 *   { id, status: "RECIPE_PROVIDED", fulfilledRecipeId: <FabricRecipe.id> }
 *   { id, status: "DECLINED", notes?: "<reason>" }
 *   { id, status: "IN_DEVELOPMENT" }   // ops-side ack equivalent
 *   { id, status: "EXPIRED" }          // bulk hygiene
 *
 * fulfilledAt auto-stamps when status flips to RECIPE_PROVIDED.
 *
 * Edit gated to ADMIN / EMPLOYEE / SALES_MANAGER.
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];
const VALID_STATUSES = ["OPEN", "IN_DEVELOPMENT", "RECIPE_PROVIDED", "DECLINED", "EXPIRED"];

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
  brand: { select: { id: true, name: true } },
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

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const url = new URL(req.url);
  const where: any = {};
  if (url.searchParams.get("status")) where.status = url.searchParams.get("status");
  if (url.searchParams.get("brandId")) where.brandId = url.searchParams.get("brandId");
  if (url.searchParams.get("factoryId")) where.factoryId = url.searchParams.get("factoryId");

  const requests = await prisma.recipeRequest.findMany({
    where,
    select: SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  return NextResponse.json({ ok: true, requests });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id required");
  if (body.status && !VALID_STATUSES.includes(body.status)) return bad("status invalid");

  const data: any = {};
  if (body.status) data.status = body.status;
  if (body.fulfilledRecipeId !== undefined)
    data.fulfilledRecipeId = body.fulfilledRecipeId || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.status === "RECIPE_PROVIDED") data.fulfilledAt = new Date();

  const updated = await prisma.recipeRequest.update({
    where: { id: body.id },
    data,
    select: SELECT,
  });
  return NextResponse.json({ ok: true, request: updated });
}
