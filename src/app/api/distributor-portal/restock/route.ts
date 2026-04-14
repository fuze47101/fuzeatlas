// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Distributor Restock Orders
 *
 * Distributors order FUZE product directly from FUZE HQ.
 * Units: CARBOY (19L), GAYLORD (608L), CONTAINER_20 (6,080L), CONTAINER_40 (12,160L)
 *
 * GET  /api/distributor-portal/restock — list restock orders + distributor pricing
 * POST /api/distributor-portal/restock — create new restock order
 */

const UNIT_LITERS: Record<string, number> = {
  CARBOY: 19,
  GAYLORD: 608,         // 32 × 19L
  CONTAINER_20: 6080,   // 10 × 608L
  CONTAINER_40: 12160,  // 20 × 608L
};

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FUZE-RST-${ymd}-${rand}`;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const distributorId = isDistributor ? user.distributorId : url.searchParams.get("distributorId");
    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { id: distributorId },
      select: {
        id: true,
        name: true,
        country: true,
        address: true,
        city: true,
        fuzeRestockPricePerLiter: true,
        fuzeRestockCurrency: true,
        fuzeRestockNotes: true,
      },
    });

    if (!distributor) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const orders = await prisma.distributorRestockOrder.findMany({
      where: { distributorId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      distributor,
      orders,
      unitLiters: UNIT_LITERS,
    });
  } catch (e: any) {
    console.error("Restock GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isDistributor && !isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { unitType, unitQuantity, shippingAddress, shippingCity, shippingCountry, notes } = body;
    const distributorId = isDistributor ? user.distributorId : body.distributorId;

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor ID required" }, { status: 400 });
    }
    if (!unitType || !UNIT_LITERS[unitType]) {
      return NextResponse.json({ ok: false, error: "Invalid unit type" }, { status: 400 });
    }
    const qty = Number(unitQuantity);
    if (!qty || qty < 1) {
      return NextResponse.json({ ok: false, error: "Quantity must be at least 1" }, { status: 400 });
    }

    // Enforce international minimum: at least 1 Gaylord for non-USA
    const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const isUSA = (distributor.country || "").toUpperCase().includes("USA") ||
                  (distributor.country || "").toUpperCase().includes("UNITED STATES");
    if (!isUSA && unitType === "CARBOY") {
      return NextResponse.json({
        ok: false,
        error: "International shipments require a minimum of 1 Gaylord (32 carboys). Please select Gaylord or larger.",
      }, { status: 400 });
    }

    const totalLiters = UNIT_LITERS[unitType] * qty;
    const pricePerLiter = distributor.fuzeRestockPricePerLiter || 0;
    const currency = distributor.fuzeRestockCurrency || "USD";
    const totalPrice = pricePerLiter * totalLiters;

    if (pricePerLiter === 0) {
      return NextResponse.json({
        ok: false,
        error: "No FUZE pricing set for this distributor. Please contact FUZE HQ (andrew@fuze47.com) to establish pricing.",
      }, { status: 400 });
    }

    const order = await prisma.distributorRestockOrder.create({
      data: {
        orderNumber: generateOrderNumber(),
        distributorId,
        orderedById: user.id,
        unitType,
        unitQuantity: qty,
        totalLiters,
        pricePerLiter,
        currency,
        totalPrice,
        shippingAddress: shippingAddress || distributor.address,
        shippingCity: shippingCity || distributor.city,
        shippingCountry: shippingCountry || distributor.country,
        notes,
        status: "PENDING_APPROVAL",
      },
    });

    // Notify admins
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "EMPLOYEE"] }, status: "ACTIVE" },
        select: { id: true },
      });
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "PO_STATUS",
          title: "New Distributor Restock Order",
          message: `${distributor.name} ordered ${qty} × ${unitType.replace("_", " ")} (${totalLiters}L) — ${currency} ${totalPrice.toFixed(2)}`,
          link: `/admin/distributor-restock/${order.id}`,
        })),
      });
    } catch (e) {
      console.error("Notify admins failed:", e);
    }

    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    console.error("Restock POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
