// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyNewOrder, notifyOrderStatusChange, notifyLowInventory } from "@/lib/notify";
import { sendNewOrderEmail, sendOrderStatusEmail, sendDistributorOrderEmail } from "@/lib/email";

const BOTTLE_LITERS = 19;
const DEFAULT_PRICE_PER_LITER = 36; // USD fallback

/**
 * Generate an order number: FUZE-ORD-YYYYMMDD-XXXX
 */
async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.fuzeOrder.count({
    where: { createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
  });
  return `FUZE-ORD-${dateStr}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Generate a quote number: FUZE-QTE-YYYYMMDD-XXXX
 */
async function generateQuoteNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.fuzeOrder.count({
    where: { quoteNumber: { not: null }, createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
  });
  return `FUZE-QTE-${dateStr}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Resolve the best distributor + pricing for a factory order
 */
async function resolveDistributorPricing(factoryId: string, volumeLiters?: number) {
  // 1. Get factory's assigned distributor
  const factory = await prisma.factory.findUnique({
    where: { id: factoryId },
    select: { distributorId: true, country: true },
  });

  if (!factory?.distributorId) {
    // No distributor → direct from USA
    return { source: "DIRECT_USA", distributorId: null, pricePerLiter: DEFAULT_PRICE_PER_LITER, discount: 0 };
  }

  // 2. Find most specific pricing: factory-specific > country > region > default
  const pricing = await prisma.distributorPricing.findMany({
    where: { distributorId: factory.distributorId, active: true },
    orderBy: { createdAt: "desc" },
  });

  // Priority: factory-specific → country → region → default
  const factoryPrice = pricing.find((p) => p.factoryId === factoryId);
  const countryPrice = pricing.find((p) => p.country === factory.country && !p.factoryId);
  const defaultPrice = pricing.find((p) => p.isDefault);

  const bestPrice = factoryPrice || countryPrice || defaultPrice;

  if (!bestPrice) {
    return { source: "DISTRIBUTOR", distributorId: factory.distributorId, pricePerLiter: DEFAULT_PRICE_PER_LITER, discount: 0 };
  }

  // 3. Apply volume discount if applicable
  let discount = 0;
  if (bestPrice.volumeDiscounts && volumeLiters) {
    try {
      const tiers = typeof bestPrice.volumeDiscounts === "string"
        ? JSON.parse(bestPrice.volumeDiscounts)
        : bestPrice.volumeDiscounts;

      if (Array.isArray(tiers)) {
        // Sort descending by minLiters and find the applicable tier
        const sorted = tiers.sort((a: any, b: any) => (b.minLiters || 0) - (a.minLiters || 0));
        const tier = sorted.find((t: any) => volumeLiters >= (t.minLiters || 0));
        if (tier) discount = tier.discountPct || 0;
      }
    } catch {}
  }

  return {
    source: "DISTRIBUTOR",
    distributorId: factory.distributorId,
    pricePerLiter: bestPrice.pricePerLiter,
    currency: bestPrice.currency,
    discount,
    leadTimeDays: bestPrice.leadTimeDays,
    hangtagPricePerUnit: bestPrice.hangtagPricePerUnit,
  };
}

/**
 * Resolve the account manager for a factory
 */
async function resolveAccountManager(factoryId: string): Promise<string | null> {
  const factory = await prisma.factory.findUnique({
    where: { id: factoryId },
    select: { salesRepId: true },
  });
  return factory?.salesRepId || null;
}

/**
 * GET /api/orders — List orders (filtered by role)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const orderType = url.searchParams.get("type");

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    const isFactory = ["FACTORY_USER", "FACTORY_MANAGER"].includes(user.role);
    const isDistributor = user.role === "DISTRIBUTOR_USER";

    const where: any = {};

    // Role-based filtering
    if (isFactory && user.factoryId) {
      where.factoryId = user.factoryId;
    } else if (isDistributor && user.distributorId) {
      where.distributorId = user.distributorId;
    } else if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // Optional filters
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;

    // For account managers, show their orders
    if (isInternal && url.searchParams.get("mine") === "true") {
      where.accountManagerId = user.id;
    }

    const orders = await prisma.fuzeOrder.findMany({
      where,
      include: {
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true } },
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
        distributor: { select: { id: true, name: true } },
        orderedBy: { select: { id: true, name: true } },
        accountManager: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Stats
    const stats = {
      total: orders.length,
      pending: orders.filter((o) => ["DRAFT", "QUOTED", "PENDING_APPROVAL"].includes(o.status)).length,
      approved: orders.filter((o) => o.status === "APPROVED").length,
      processing: orders.filter((o) => o.status === "PROCESSING").length,
      shipped: orders.filter((o) => o.status === "SHIPPED").length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
      totalRevenue: orders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0),
    };

    return NextResponse.json({ ok: true, orders, stats });
  } catch (e: any) {
    console.error("Orders GET error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load orders" }, { status: 500 });
  }
}

/**
 * POST /api/orders — Factory submits a new order
 * Auto-generates quote from distributor pricing, routes to account manager
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      factoryId, orderType = "PRODUCTION",
      volumeLiters, fuzeTier, bottles,
      hangtagQty, hangtagDesign,
      brandId, fabricId, purposeNote,
      shippingAddress, shippingCity, shippingCountry,
      notes,
    } = body;

    // Factory users can only order for their own factory
    const isFactory = ["FACTORY_USER", "FACTORY_MANAGER"].includes(user.role);
    const targetFactoryId = isFactory ? user.factoryId : factoryId;

    if (!targetFactoryId) {
      return NextResponse.json({ ok: false, error: "Factory ID required" }, { status: 400 });
    }

    // Validate order type
    if (!["PRODUCTION", "SAMPLE", "HANGTAG"].includes(orderType)) {
      return NextResponse.json({ ok: false, error: "Invalid order type" }, { status: 400 });
    }

    // Resolve distributor + pricing
    const pricingInfo = await resolveDistributorPricing(
      targetFactoryId,
      orderType === "HANGTAG" ? undefined : Number(volumeLiters || 0)
    );

    // Calculate totals
    let totalPrice = 0;
    let effectiveVolume = volumeLiters ? Number(volumeLiters) : null;
    let effectiveBottles = bottles ? Number(bottles) : null;
    let effectiveHangtagQty = hangtagQty ? Number(hangtagQty) : null;

    if (orderType === "HANGTAG") {
      const perUnit = pricingInfo.hangtagPricePerUnit || 0.15; // Default hangtag price
      totalPrice = (effectiveHangtagQty || 0) * perUnit;
    } else {
      // Calculate bottles from volume if not provided
      if (effectiveVolume && !effectiveBottles) {
        effectiveBottles = Math.ceil(effectiveVolume / BOTTLE_LITERS);
      }
      // Calculate volume from bottles if not provided
      if (effectiveBottles && !effectiveVolume) {
        effectiveVolume = effectiveBottles * BOTTLE_LITERS;
      }

      const pricePerLiter = pricingInfo.pricePerLiter || DEFAULT_PRICE_PER_LITER;
      const discount = pricingInfo.discount || 0;
      const discountedPrice = pricePerLiter * (1 - discount / 100);
      totalPrice = (effectiveVolume || 0) * discountedPrice;
    }

    // Sample subsidy — FUZE covers partial cost for sample orders
    let isSampleSubsidized = false;
    let subsidyAmount = 0;
    if (orderType === "SAMPLE") {
      isSampleSubsidized = true;
      subsidyAmount = totalPrice * 0.5; // 50% subsidy on samples
    }

    // Resolve account manager
    const accountManagerId = await resolveAccountManager(targetFactoryId);

    // Generate numbers
    const [orderNumber, quoteNumber] = await Promise.all([
      generateOrderNumber(),
      generateQuoteNumber(),
    ]);

    const order = await prisma.fuzeOrder.create({
      data: {
        orderNumber,
        orderType,
        quoteNumber,

        factoryId: targetFactoryId,
        orderedById: user.id,

        volumeLiters: effectiveVolume,
        fuzeTier: fuzeTier || null,
        bottles: effectiveBottles,

        hangtagQty: effectiveHangtagQty,
        hangtagDesign: hangtagDesign || null,

        brandId: brandId || null,
        fabricId: fabricId || null,
        purposeNote: purposeNote || null,

        pricePerLiter: pricingInfo.pricePerLiter || DEFAULT_PRICE_PER_LITER,
        pricePerHangtag: pricingInfo.hangtagPricePerUnit || null,
        totalPrice,
        currency: pricingInfo.currency || "USD",
        discountPct: pricingInfo.discount || null,
        quoteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days

        fulfillmentSource: pricingInfo.source,
        distributorId: pricingInfo.distributorId || null,
        accountManagerId,

        isSampleSubsidized,
        subsidyAmount: subsidyAmount || null,

        shippingAddress: shippingAddress || null,
        shippingCity: shippingCity || null,
        shippingCountry: shippingCountry || null,

        notes: notes || null,

        // Auto-advance to QUOTED since we have pricing
        status: "QUOTED",
      },
      include: {
        factory: { select: { name: true } },
        brand: { select: { name: true } },
        distributor: { select: { name: true } },
      },
    });

    // ─── Trigger notifications (fire-and-forget) ───
    try {
      // In-app notification to AM + admins
      notifyNewOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        factoryName: order.factory?.name || "Unknown",
        volumeLiters: order.volumeLiters || undefined,
        hangtagQty: order.hangtagQty || undefined,
        totalPrice: order.totalPrice || 0,
        accountManagerId: accountManagerId || undefined,
        brandName: order.brand?.name || undefined,
      });

      // Email notification to account manager
      if (accountManagerId) {
        const am = await prisma.user.findUnique({ where: { id: accountManagerId }, select: { email: true, name: true } });
        if (am?.email) {
          sendNewOrderEmail({
            email: am.email,
            managerName: am.name || "Account Manager",
            orderNumber: order.orderNumber,
            orderType: order.orderType,
            factoryName: order.factory?.name || "Unknown",
            volumeLiters: order.volumeLiters || undefined,
            hangtagQty: order.hangtagQty || undefined,
            totalPrice: order.totalPrice || 0,
            currency: order.currency,
            brandName: order.brand?.name || undefined,
          });
        }
      }
    } catch (notifyErr) {
      console.error("[ORDER] Notification error (non-blocking):", notifyErr);
    }

    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    console.error("Orders POST error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to create order" }, { status: 500 });
  }
}

/**
 * PATCH /api/orders — Update order status (approval, fulfillment, etc.)
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { orderId, action, ...updateData } = body;

    if (!orderId || !action) {
      return NextResponse.json({ ok: false, error: "orderId and action required" }, { status: 400 });
    }

    const order = await prisma.fuzeOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    let data: any = {};

    switch (action) {
      case "accept_quote":
        data = { status: "PENDING_APPROVAL", quoteAccepted: true, quoteAcceptedAt: new Date() };
        break;

      case "approve":
        data = { status: "APPROVED", approvedAt: new Date(), approvedById: user.id };
        break;

      case "process":
        data = { status: "PROCESSING" };
        break;

      case "ship":
        data = {
          status: "SHIPPED",
          shippedDate: new Date(),
          trackingNumber: updateData.trackingNumber || null,
          carrier: updateData.carrier || null,
        };
        // Deduct from distributor inventory if applicable
        if (order.distributorId && order.volumeLiters) {
          try {
            await prisma.distributorInventory.update({
              where: { distributorId: order.distributorId },
              data: {
                fuzeStockLiters: { decrement: order.volumeLiters },
                fuzeStockBottles: { decrement: order.bottles || 0 },
                lastStockUpdate: new Date(),
              },
            });
          } catch {} // Inventory record may not exist yet
        }
        break;

      case "deliver":
        data = { status: "DELIVERED", deliveredDate: new Date() };
        break;

      case "cancel":
        data = { status: "CANCELLED", adminNotes: updateData.reason || null };
        break;

      default:
        return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    // Allow additional field updates
    if (updateData.adminNotes) data.adminNotes = updateData.adminNotes;

    const updated = await prisma.fuzeOrder.update({
      where: { id: orderId },
      data,
      include: {
        factory: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });

    // ─── Trigger notifications on status changes (fire-and-forget) ───
    try {
      const shouldNotify = ["APPROVED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(updated.status);
      if (shouldNotify) {
        // In-app notification to factory
        notifyOrderStatusChange({
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          newStatus: updated.status,
          factoryId: updated.factoryId,
          factoryName: updated.factory?.name || "Unknown",
          trackingNumber: updated.trackingNumber || undefined,
          carrier: updated.carrier || undefined,
          distributorId: updated.distributorId || undefined,
        });

        // Email to factory contact (ordered by user)
        if (updated.orderedById) {
          const orderer = await prisma.user.findUnique({ where: { id: updated.orderedById }, select: { email: true, name: true } });
          if (orderer?.email) {
            sendOrderStatusEmail({
              email: orderer.email,
              contactName: orderer.name || "Factory Team",
              orderNumber: updated.orderNumber,
              newStatus: updated.status,
              factoryName: updated.factory?.name || "Unknown",
              trackingNumber: updated.trackingNumber || undefined,
              carrier: updated.carrier || undefined,
            });
          }
        }

        // When order is approved, notify distributor to fulfill
        if (updated.status === "APPROVED" && updated.distributorId) {
          const distUsers = await prisma.user.findMany({
            where: { distributorId: updated.distributorId, status: "ACTIVE" },
            select: { email: true, name: true },
          });
          for (const du of distUsers) {
            if (du.email) {
              sendDistributorOrderEmail({
                email: du.email,
                distributorName: du.name || updated.distributor?.name || "Distributor",
                orderNumber: updated.orderNumber,
                factoryName: updated.factory?.name || "Unknown",
                volumeLiters: updated.volumeLiters || undefined,
                hangtagQty: updated.hangtagQty || undefined,
                shippingAddress: updated.shippingAddress || undefined,
                shippingCity: updated.shippingCity || undefined,
                shippingCountry: updated.shippingCountry || undefined,
              });
            }
          }
        }

        // After shipment, check distributor inventory for low-stock alert
        if (updated.status === "SHIPPED" && updated.distributorId) {
          try {
            const inv = await prisma.distributorInventory.findUnique({ where: { distributorId: updated.distributorId } });
            if (inv && inv.fuzeStockLiters < inv.reorderThresholdLiters) {
              const dist = await prisma.distributor.findUnique({ where: { id: updated.distributorId }, select: { name: true } });
              notifyLowInventory({
                distributorId: updated.distributorId,
                distributorName: dist?.name || "Distributor",
                currentLiters: inv.fuzeStockLiters,
                thresholdLiters: inv.reorderThresholdLiters,
              });
            }
          } catch {}
        }
      }

      // When order is delivered, auto-log consumption for the factory
      if (updated.status === "DELIVERED" && updated.volumeLiters) {
        try {
          await prisma.fuzeConsumption.create({
            data: {
              factoryId: updated.factoryId,
              brandId: updated.brandId || null,
              fabricId: updated.fabricId || null,
              litersUsed: updated.volumeLiters,
              fuzeTier: updated.fuzeTier || "F1",
              orderId: updated.id,
              notes: `Auto-logged from delivered order ${updated.orderNumber}`,
            },
          });
        } catch (consErr) {
          console.error("[ORDER] Auto-consumption log error:", consErr);
        }
      }
    } catch (notifyErr) {
      console.error("[ORDER] Notification error (non-blocking):", notifyErr);
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (e: any) {
    console.error("Orders PATCH error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to update order" }, { status: 500 });
  }
}
