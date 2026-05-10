// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin inventory endpoints (Phase 4D).
 *
 * GET — list every FuzeHQInventory row, ordered by sku.
 * POST — create a new SKU row (sku + description required).
 * PATCH — adjust onHandLiters / reservedLiters / reorderThreshold /
 *         notes / description on a row by id. lastInventoryAt
 *         auto-stamps when onHandLiters changes (manual count cycle).
 *
 * ADMIN / EMPLOYEE only.
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE"];

const SELECT = {
  id: true,
  sku: true,
  description: true,
  onHandLiters: true,
  reservedLiters: true,
  reorderThreshold: true,
  lastInventoryAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
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
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const rows = await prisma.fuzeHQInventory.findMany({
    select: SELECT,
    orderBy: { sku: "asc" },
  });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.sku) return bad("sku required");
  if (!body.description) return bad("description required");

  const created = await prisma.fuzeHQInventory.create({
    data: {
      sku: String(body.sku).trim(),
      description: String(body.description).trim(),
      onHandLiters: Number(body.onHandLiters) || 0,
      reservedLiters: Number(body.reservedLiters) || 0,
      reorderThreshold:
        body.reorderThreshold !== undefined && body.reorderThreshold !== null && body.reorderThreshold !== ""
          ? Number(body.reorderThreshold)
          : null,
      notes: body.notes || null,
    },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, row: created });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id required");

  const data: any = {};
  if (body.description !== undefined) data.description = String(body.description);
  if (body.onHandLiters !== undefined) {
    data.onHandLiters = Number(body.onHandLiters);
    data.lastInventoryAt = new Date();
  }
  if (body.reservedLiters !== undefined) data.reservedLiters = Number(body.reservedLiters);
  if (body.reorderThreshold !== undefined) {
    data.reorderThreshold =
      body.reorderThreshold === null || body.reorderThreshold === ""
        ? null
        : Number(body.reorderThreshold);
  }
  if (body.notes !== undefined) data.notes = body.notes || null;

  const updated = await prisma.fuzeHQInventory.update({
    where: { id: body.id },
    data,
    select: SELECT,
  });
  return NextResponse.json({ ok: true, row: updated });
}
