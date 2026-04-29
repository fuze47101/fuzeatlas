// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/distributors
 * Returns all distributors with full details, inventory, pricing, factory counts, order stats.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const distributors = await prisma.distributor.findMany({
      include: {
        inventory: true,
        pricing: { take: 5, orderBy: { createdAt: "desc" } },
        factories: { select: { id: true, name: true, country: true } },
        contacts: { select: { id: true, name: true, email: true, phone: true, title: true } },
        users: { select: { id: true, name: true, email: true, role: true, status: true } },
        _count: {
          select: {
            fuzeOrders: true,
            invoices: true,
            documents: true,
            factories: true,
          },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    // Get order volume stats per distributor
    const orderStats = await prisma.fuzeOrder.groupBy({
      by: ["distributorId"],
      where: { distributorId: { not: null } },
      _sum: { volumeLiters: true, totalPrice: true },
      _count: true,
    });

    const statsMap: Record<string, { totalLiters: number; totalRevenue: number; orderCount: number }> = {};
    for (const s of orderStats) {
      if (s.distributorId) {
        statsMap[s.distributorId] = {
          totalLiters: s._sum.volumeLiters || 0,
          totalRevenue: s._sum.totalPrice || 0,
          orderCount: s._count,
        };
      }
    }

    const result = distributors.map((d) => {
      const stats = statsMap[d.id] || { totalLiters: 0, totalRevenue: 0, orderCount: 0 };
      let coverageCountries: string[] = [];
      try {
        coverageCountries = d.coverageCountries ? JSON.parse(d.coverageCountries) : [];
      } catch { coverageCountries = []; }

      return {
        id: d.id,
        name: d.name,
        chineseName: d.chineseName,
        specialty: d.specialty,
        country: d.country,
        region: d.region,
        city: d.city,
        address: d.address,
        email: d.email,
        phone: d.phone,
        website: d.website,
        status: d.status,
        active: d.active,
        coverageCountries,
        localCurrency: d.localCurrency,
        notes: d.notes,
        // FUZE wholesale pricing — used by the restock-from-FUZE flow.
        fuzeRestockPricePerLiter: d.fuzeRestockPricePerLiter,
        fuzeRestockCurrency: d.fuzeRestockCurrency,
        fuzeRestockNotes: d.fuzeRestockNotes,
        // Master / sub hierarchy.
        parentDistributorId: d.parentDistributorId,
        subDistributorPricePerLiter: d.subDistributorPricePerLiter,
        subDistributorCurrency: d.subDistributorCurrency,
        subDistributorNotes: d.subDistributorNotes,
        // Inventory
        stockLiters: d.inventory?.fuzeStockLiters || 0,
        stockKg: (d.inventory?.fuzeStockLiters || 0) * 0.03,
        stockBottles: d.inventory?.fuzeStockBottles || 0,
        reorderThresholdLiters: d.inventory?.reorderPointLiters || 0,
        lowStock: (d.inventory?.fuzeStockLiters || 0) <= (d.inventory?.reorderPointLiters || 0),
        // Counts
        factoryCount: d._count.factories,
        orderCount: d._count.fuzeOrders,
        invoiceCount: d._count.invoices,
        documentCount: d._count.documents,
        // Order stats
        totalLitersShipped: Math.round(stats.totalLiters * 100) / 100,
        totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
        // Relations
        factories: d.factories.slice(0, 10),
        contacts: d.contacts,
        users: d.users,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      };
    });

    const active = result.filter((d) => d.active);
    const inactive = result.filter((d) => !d.active);

    return NextResponse.json({
      ok: true,
      distributors: result,
      summary: {
        total: result.length,
        active: active.length,
        inactive: inactive.length,
        lowStock: result.filter((d) => d.lowStock && d.active).length,
        totalStockLiters: Math.round(active.reduce((s, d) => s + d.stockLiters, 0) * 100) / 100,
        totalRevenue: Math.round(result.reduce((s, d) => s + d.totalRevenue, 0) * 100) / 100,
      },
    });
  } catch (e: any) {
    console.error("Admin distributors error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load distributors" }, { status: 500 });
  }
}

/**
 * POST /api/admin/distributors
 * Create a new distributor record. Admin/Employee only.
 *
 * Body: {
 *   name (required), country, region, city, address,
 *   email, phone, website, status, active, specialty,
 *   coverageCountries (string or array), localCurrency, notes
 * }
 *
 * Created distributors land with status="ACTIVE" + active=true unless
 * overridden. They show up immediately in the network list and become
 * available as the assignment target on /admin/users when wiring up
 * a DISTRIBUTOR_USER (or as a "View As" target for admins like Tina
 * who use the impersonation feature for QA).
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Distributor name is required" },
        { status: 400 },
      );
    }

    // Refuse on duplicate name (case-insensitive) so Tina doesn't
    // accidentally create a second "Texwell" while testing.
    const existing = await prisma.distributor.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `A distributor named "${existing.name}" already exists.`,
          existingId: existing.id,
        },
        { status: 409 },
      );
    }

    // Coerce coverage to a JSON-encoded array (the schema expects
    // a string but the rest of the codebase parses JSON).
    let coverageCountries: string | null = null;
    if (Array.isArray(body.coverageCountries)) {
      coverageCountries = JSON.stringify(
        body.coverageCountries.map((s: any) => String(s).trim()).filter(Boolean),
      );
    } else if (typeof body.coverageCountries === "string" && body.coverageCountries.trim()) {
      const arr = body.coverageCountries
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      coverageCountries = JSON.stringify(arr);
    }

    const data: any = {
      name,
      status: body.status || "ACTIVE",
      active: body.active === undefined ? true : !!body.active,
    };
    if (body.country) data.country = String(body.country).trim();
    if (body.region) data.region = String(body.region).trim();
    if (body.city) data.city = String(body.city).trim();
    if (body.address) data.address = String(body.address).trim();
    if (body.email) data.email = String(body.email).trim();
    if (body.phone) data.phone = String(body.phone).trim();
    if (body.website) data.website = String(body.website).trim();
    if (body.specialty) data.specialty = String(body.specialty).trim();
    if (body.localCurrency) data.localCurrency = String(body.localCurrency).trim();
    if (body.notes) data.notes = String(body.notes).trim();
    if (coverageCountries) data.coverageCountries = coverageCountries;

    const distributor = await prisma.distributor.create({ data });

    // Optional: create a starter DISTRIBUTOR_USER linked to this
    // distributor so the admin can immediately "View As" them and
    // test the distributor portal flow without manually wiring up
    // a user account afterwards. Set body.createTestUser=true and
    // (optionally) body.testUserEmail. Falls back to a generated
    // email if not provided.
    let testUser = null;
    if (body.createTestUser) {
      const safeName = name
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase()
        .slice(0, 20);
      const generatedEmail =
        body.testUserEmail?.trim() ||
        `qa+${safeName}-${Date.now().toString().slice(-6)}@fuze47.com`;
      const userName = body.testUserName?.trim() || `${name} (test user)`;
      try {
        // Check if email already exists — re-link instead of error
        const existingUser = await prisma.user.findUnique({
          where: { email: generatedEmail },
        });
        if (existingUser) {
          testUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              role: "DISTRIBUTOR_USER",
              distributorId: distributor.id,
              status: "ACTIVE",
            },
          });
        } else {
          testUser = await prisma.user.create({
            data: {
              email: generatedEmail,
              name: userName,
              role: "DISTRIBUTOR_USER",
              distributorId: distributor.id,
              status: "ACTIVE",
              // No password — test user is for impersonation only.
              // If you ever want them to log in directly, set a
              // password via /admin/users.
            },
          });
        }
      } catch (uErr: any) {
        console.warn(
          "Distributor created but test user creation failed:",
          uErr?.message,
        );
      }
    }

    return NextResponse.json({ ok: true, distributor, testUser });
  } catch (e: any) {
    console.error("Admin distributors POST error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to create distributor" },
      { status: 500 },
    );
  }
}
