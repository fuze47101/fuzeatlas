// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Factory-side RecipeRequest endpoints (Phase 4C).
 *
 * GET — list every RecipeRequest pointed at the caller's factory,
 *       newest first, with brand context.
 *
 * PATCH — factory-side acknowledgement. The only legal transition
 *         from this side is OPEN → IN_DEVELOPMENT (factory has seen
 *         it and is working on it). DECLINED + RECIPE_PROVIDED are
 *         FUZE-ops-only and live on the admin endpoint.
 */

const ACK_ROLES = ["ADMIN", "EMPLOYEE", "FACTORY_USER", "FACTORY_MANAGER", "SALES_MANAGER"];

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
  if (!user.factoryId) return forbidden();

  const requests = await prisma.recipeRequest.findMany({
    where: { factoryId: user.factoryId },
    select: SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ ok: true, requests });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ACK_ROLES.includes(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id required");

  const existing = await prisma.recipeRequest.findUnique({
    where: { id: body.id },
    select: { id: true, factoryId: true, status: true },
  });
  if (!existing) return bad("RecipeRequest not found");

  // Factory users can only patch requests pointed at their factory.
  // Admins / employees can patch any.
  const isFactoryUser = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
  if (isFactoryUser && existing.factoryId !== user.factoryId) return forbidden();

  // Legal transitions from this endpoint: OPEN → IN_DEVELOPMENT.
  // Any other transition gets rejected — fulfillment / decline are
  // ops-only and live on the admin endpoint.
  if (existing.status !== "OPEN") {
    return bad(`Cannot acknowledge a request in status ${existing.status}`);
  }

  const updated = await prisma.recipeRequest.update({
    where: { id: body.id },
    data: { status: "IN_DEVELOPMENT" },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, request: updated });
}
