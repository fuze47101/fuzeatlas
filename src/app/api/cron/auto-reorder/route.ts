// @ts-nocheck
/**
 * GET /api/cron/auto-reorder — Phase 11F.
 *
 * Bearer-authed cron. Runs every 6h (vercel.json). Two passes:
 *
 *  Pass 1 — DRAFT_AUTO creation:
 *    For each Distributor with autoReorderEnabled=true and a
 *    DistributorInventory whose fuzeStockLiters <= reorderPointLiters,
 *    and no pending FuzeOrder with status=DRAFT_AUTO in the last 48h,
 *    create a FuzeOrder with status=DRAFT_AUTO. Volume defaults to
 *    DistributorInventory.reorderQtyLiters when present, otherwise
 *    the median 90-day order volume for this distributor.
 *    Notify distributor's user pool + admins.
 *
 *  Pass 2 — auto-confirm after 24h:
 *    Walk DRAFT_AUTO FuzeOrders older than 24h that haven't been
 *    edited by a human (status still DRAFT_AUTO). Flip to APPROVED,
 *    fire a confirmation notification.
 *
 * Sentinel factory: the FuzeOrder schema requires factoryId. We
 * pick the first internal Factory tagged with a customerType
 * marker (e.g. "FUZE-HQ"), or fall back to the oldest active
 * factory in the system. If neither exists, the cron logs and
 * skips Pass 1 — it's safe to wait until Andrew flags one.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DRAFT_STATUS = "DRAFT_AUTO";
const APPROVED_STATUS = "APPROVED";

function ymd(d: Date) {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

async function pickSentinelFactoryId(): Promise<string | null> {
  const tagged = await prisma.factory.findFirst({
    where: { customerType: "FUZE-HQ" },
    select: { id: true },
  });
  if (tagged) return tagged.id;
  const fallback = await prisma.factory.findFirst({
    where: { country: "United States" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback?.id || null;
}

async function generateOrderNumber(): Promise<string> {
  const prefix = `FUZE-ORD-${ymd(new Date())}-AUTO`;
  const seq = await prisma.fuzeOrder.count({
    where: { orderNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

async function medianRestockVolume(distributorId: string): Promise<number | null> {
  const since = new Date(Date.now() - 90 * 86400_000);
  const orders = await prisma.fuzeOrder.findMany({
    where: { distributorId, createdAt: { gte: since }, volumeLiters: { not: null } },
    select: { volumeLiters: true },
  });
  if (orders.length === 0) return null;
  const sorted = orders.map((o) => o.volumeLiters!).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60_000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60_000);

  const adminIds = (
    await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    })
  ).map((u) => u.id);

  // ─── Pass 1: scan low-stock + create DRAFT_AUTO ──────────────
  const distributors = await prisma.distributor.findMany({
    where: { autoReorderEnabled: true, active: true },
    select: { id: true, name: true },
  });

  const created: any[] = [];
  let pass1Skipped = 0;

  const sentinelFactoryId = await pickSentinelFactoryId();

  for (const d of distributors) {
    const inv = await prisma.distributorInventory.findFirst({
      where: { distributorId: d.id },
      select: {
        id: true,
        fuzeStockLiters: true,
        reorderPointLiters: true,
        reorderQtyLiters: true,
      },
    });
    if (!inv?.reorderPointLiters) continue;
    if (inv.fuzeStockLiters > inv.reorderPointLiters) continue;

    const pending = await prisma.fuzeOrder.findFirst({
      where: {
        distributorId: d.id,
        status: DRAFT_STATUS,
        createdAt: { gte: fortyEightHoursAgo },
      },
      select: { id: true },
    });
    if (pending) {
      pass1Skipped++;
      continue;
    }

    if (!sentinelFactoryId) {
      pass1Skipped++;
      continue;
    }

    const median = await medianRestockVolume(d.id);
    const volumeLiters = inv.reorderQtyLiters || median || 608; // 1 gaylord = 608L default

    const orderNumber = await generateOrderNumber();
    const order = await prisma.fuzeOrder.create({
      data: {
        factoryId: sentinelFactoryId,
        orderNumber,
        orderType: "PRODUCTION",
        volumeLiters,
        distributorId: d.id,
        status: DRAFT_STATUS,
        purposeNote: `Auto-drafted because on-hand (${inv.fuzeStockLiters}L) dropped to reorder threshold (${inv.reorderPointLiters}L).`,
      },
      select: { id: true, orderNumber: true },
    });

    const distUsers = await prisma.user.findMany({
      where: { distributorId: d.id, status: "ACTIVE" },
      select: { id: true },
    });
    const recipients = new Set<string>(adminIds);
    for (const u of distUsers) recipients.add(u.id);

    await Promise.all(
      Array.from(recipients).map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: "PO_STATUS",
            title: `🤖 Auto-draft restock order for ${d.name}`,
            message: `On-hand ${inv.fuzeStockLiters}L at reorder threshold ${inv.reorderPointLiters}L. Drafted ${volumeLiters}L restock. Auto-confirms in 24h if no edits.`,
            link: `/distributor-portal/restock?orderId=${order.id}`,
            metadata: {
              source: "auto-reorder",
              orderId: order.id,
              distributorId: d.id,
            },
          },
        }),
      ),
    );

    created.push({ distributor: d.name, orderNumber: order.orderNumber, volumeLiters });
  }

  // ─── Pass 2: auto-confirm DRAFT_AUTO older than 24h ──────────
  const stale = await prisma.fuzeOrder.findMany({
    where: {
      status: DRAFT_STATUS,
      createdAt: { lte: twentyFourHoursAgo },
    },
    select: { id: true, orderNumber: true, distributorId: true, volumeLiters: true },
  });

  const confirmed: any[] = [];
  for (const o of stale) {
    await prisma.fuzeOrder.update({
      where: { id: o.id },
      data: { status: APPROVED_STATUS },
    });
    if (!o.distributorId) continue;
    const distUsers = await prisma.user.findMany({
      where: { distributorId: o.distributorId, status: "ACTIVE" },
      select: { id: true },
    });
    const recipients = new Set<string>(adminIds);
    for (const u of distUsers) recipients.add(u.id);
    await Promise.all(
      Array.from(recipients).map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: "PO_STATUS",
            title: `✅ Auto-confirmed: ${o.orderNumber}`,
            message: `No edits within 24h — ${o.volumeLiters}L restock auto-approved.`,
            link: `/distributor-portal/restock?orderId=${o.id}`,
            metadata: { source: "auto-reorder-confirm", orderId: o.id },
          },
        }),
      ),
    );
    confirmed.push({ orderNumber: o.orderNumber });
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    distributorsChecked: distributors.length,
    pass1Created: created.length,
    pass1Skipped,
    pass2Confirmed: confirmed.length,
    sentinelFactoryId,
    created,
    confirmed,
  });
}
