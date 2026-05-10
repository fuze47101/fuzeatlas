// @ts-nocheck
/**
 * /api/admin/brands/[id]/hangtag-qr — Phase 12B.
 *
 * GET   → list HangtagQR rows for this brand (most recent first)
 * POST  → bulk-mint N tokens. Body: { count: 1..500, fabricId?,
 *         productSku?, batchCode? }
 * DELETE → wipe a specific token by id (admin only). Query: ?tokenId
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { randomBytes } from "node:crypto";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

// Crockford base32 — 12 chars from 60 bits = ~10^18 keyspace.
const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function mintToken(): string {
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += BASE32[buf[i % 8] % 32];
  }
  return out;
}

async function authz() {
  const user = await getCurrentUser();
  if (!user) return { err: "Unauthorized", status: 401 };
  if (!ADMIN_ROLES.includes(user.role)) return { err: "Forbidden", status: 403 };
  return { user };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const { id } = await params;
  const rows = await prisma.hangtagQR.findMany({
    where: { brandId: id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      token: true,
      productSku: true,
      batchCode: true,
      printedAt: true,
      scannedCount: true,
      firstScannedAt: true,
      lastScannedAt: true,
      createdAt: true,
      fabric: { select: { id: true, fuzeNumber: true } },
    },
  });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const count = Math.max(1, Math.min(500, Number(body?.count) || 1));
  const fabricId = body?.fabricId || null;
  const productSku = body?.productSku || null;
  const batchCode = body?.batchCode || null;

  const created: any[] = [];
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let row: any = null;
    while (attempts < 5 && !row) {
      try {
        row = await prisma.hangtagQR.create({
          data: {
            token: mintToken(),
            brandId: id,
            fabricId,
            productSku,
            batchCode,
          },
          select: { id: true, token: true },
        });
      } catch {
        attempts++;
      }
    }
    if (row) created.push(row);
  }

  return NextResponse.json({ ok: true, count: created.length, tokens: created });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const url = new URL(req.url);
  const tokenId = url.searchParams.get("tokenId");
  if (!tokenId) {
    return NextResponse.json({ ok: false, error: "tokenId required" }, { status: 400 });
  }
  const { id } = await params;
  // Defensive: scope delete to the brand on the URL.
  const target = await prisma.hangtagQR.findUnique({
    where: { id: tokenId },
    select: { brandId: true },
  });
  if (!target || target.brandId !== id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  await prisma.hangtagQR.delete({ where: { id: tokenId } });
  return NextResponse.json({ ok: true });
}
