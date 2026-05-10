// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin CRUD for SupplyChainLink (Phase 4A — ROADMAP_v2 keystone).
 *
 * Single-file handlers since SupplyChainLink rows are simple by
 * design. ADMIN / EMPLOYEE / SALES_MANAGER can write; everyone
 * authenticated can read (portal endpoints layer their own scope on
 * top of this).
 *
 *   GET    ?fromType=&fromId=&toType=&toId=&relation=&active=
 *   POST   { fromType, fromId, toType, toId, relation, notes? }
 *   PATCH  { id, active?, notes? }
 *   DELETE ?id=
 */

const ENTITY_TYPES = ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB", "FUZE"] as const;
const RELATIONS = ["SUPPLIES", "DISTRIBUTES_TO", "TESTS_FOR", "OWNS", "CONSULTS_FOR"] as const;
const WRITE_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}
function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

function validateEntityType(t: any) {
  return typeof t === "string" && ENTITY_TYPES.includes(t as any);
}
function validateRelation(r: any) {
  return typeof r === "string" && RELATIONS.includes(r as any);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const where: any = {};
  if (url.searchParams.get("fromType")) where.fromType = url.searchParams.get("fromType");
  if (url.searchParams.get("fromId")) where.fromId = url.searchParams.get("fromId");
  if (url.searchParams.get("toType")) where.toType = url.searchParams.get("toType");
  if (url.searchParams.get("toId")) where.toId = url.searchParams.get("toId");
  if (url.searchParams.get("relation")) where.relation = url.searchParams.get("relation");
  if (url.searchParams.get("active") === "true") where.active = true;
  if (url.searchParams.get("active") === "false") where.active = false;

  const links = await prisma.supplyChainLink.findMany({
    where,
    orderBy: [{ relation: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({ ok: true, links });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!WRITE_ROLES.includes(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!validateEntityType(body.fromType)) return bad("fromType invalid");
  if (!validateEntityType(body.toType)) return bad("toType invalid");
  if (!validateRelation(body.relation)) return bad("relation invalid");
  if (!body.fromId || !body.toId) return bad("fromId + toId required");

  const link = await prisma.supplyChainLink.upsert({
    where: {
      supply_chain_link_unique: {
        fromType: body.fromType,
        fromId: body.fromId,
        toType: body.toType,
        toId: body.toId,
        relation: body.relation,
      },
    },
    create: {
      fromType: body.fromType,
      fromId: body.fromId,
      toType: body.toType,
      toId: body.toId,
      relation: body.relation,
      notes: body.notes || null,
      active: true,
    },
    update: {
      active: true,
      notes: body.notes ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, link });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!WRITE_ROLES.includes(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id required");

  const data: any = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes;

  const link = await prisma.supplyChainLink.update({
    where: { id: body.id },
    data,
  });
  return NextResponse.json({ ok: true, link });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!WRITE_ROLES.includes(user.role)) return forbidden();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return bad("id required");

  await prisma.supplyChainLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
