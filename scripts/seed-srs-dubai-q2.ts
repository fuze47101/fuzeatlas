/**
 * Seed SRS Dubai shipments for Q2 exec report (#69).
 *
 * Background
 * ----------
 * Two real-world shipments to the SRS warehouse in Dubai:
 *   - Week of Apr 6, 2026 — 4 gaylords
 *   - Week of Apr 13, 2026 — 3 gaylords
 *   - 1 gaylord = 608 L
 *   - 7 gaylords × 608 L = 4,256 L total
 *
 * The /admin/weekly-review snapshot's Sales & Distribution panel reads
 * exclusively from `prisma.fuzeOrder` (see src/lib/weekly-review/snapshot.ts
 * lines 79-93), so each gaylord lands as one FuzeOrder row with
 * fulfillmentSource = "DISTRIBUTOR" and the SRS distributor attached.
 *
 * Idempotency
 * -----------
 * Each FuzeOrder is keyed by a deterministic orderNumber:
 *   FUZE-ORD-20260406-DUB-1, ...-2, ...-3, ...-4   (week 1)
 *   FUZE-ORD-20260413-DUB-1, ...-2, ...-3          (week 2)
 *
 * Re-running upserts on that orderNumber so a second run won't
 * double-count revenue.
 *
 * Usage
 * -----
 *   npx tsx scripts/seed-srs-dubai-q2.ts
 *
 * Tweak the CONSTANTS block below before running if pricing or tier
 * differs from the SRS canonical defaults seeded in
 * src/app/api/admin/seed-distributors/route.ts.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── CONSTANTS — review before running ──────────────────────────────────
const SRS_DISTRIBUTOR_NAME = "SRS"; // matches seed-distributors
const WAREHOUSE_FACTORY_NAME = "SRS Dubai Warehouse"; // proxy "factory" so the
// FuzeOrder.factoryId
// FK is satisfied
const PRICE_PER_LITER_USD = 36; // SRS canonical pricing
const ORDER_TYPE = "PRODUCTION"; // PRODUCTION | SAMPLE
const FUZE_TIER = "F1"; // most common SRS tier
const LITERS_PER_GAYLORD = 608;
const PURPOSE_NOTE = "SRS Dubai warehouse restock — Q2 2026";

// Shipments — { orderDate, shipDate, weekTag, count }
const SHIPMENTS = [
  {
    weekTag: "20260406",
    orderDate: new Date("2026-04-06T09:00:00Z"),
    shipDate: new Date("2026-04-08T17:00:00Z"),
    count: 4,
  },
  {
    weekTag: "20260413",
    orderDate: new Date("2026-04-13T09:00:00Z"),
    shipDate: new Date("2026-04-15T17:00:00Z"),
    count: 3,
  },
];

async function main() {
  console.log("🚢 Seeding SRS Dubai Q2 shipments…");

  // 1. Resolve SRS distributor
  const srs = await prisma.distributor.findFirst({
    where: { name: SRS_DISTRIBUTOR_NAME },
    select: { id: true, name: true, city: true },
  });
  if (!srs) {
    throw new Error(
      `Distributor "${SRS_DISTRIBUTOR_NAME}" not found. Run /api/admin/seed-distributors first.`,
    );
  }
  console.log(`  ✓ Found distributor: ${srs.name} (${srs.city || "—"})`);

  // 2. Resolve / create the proxy "Dubai warehouse" factory.
  //    FuzeOrder.factoryId is REQUIRED by the schema even when the order
  //    is fulfilled to a distributor warehouse rather than a brand
  //    factory. We use a clearly-named proxy so the rows are easy to
  //    audit later.
  let warehouse = await prisma.factory.findFirst({
    where: { name: WAREHOUSE_FACTORY_NAME },
    select: { id: true, name: true },
  });
  if (!warehouse) {
    warehouse = await prisma.factory.create({
      data: {
        name: WAREHOUSE_FACTORY_NAME,
        country: "United Arab Emirates",
        city: "Dubai",
        notes:
          "Proxy factory record for the SRS distributor warehouse in Dubai. Created by scripts/seed-srs-dubai-q2.ts so FuzeOrder.factoryId is satisfied for distributor restock shipments.",
      },
      select: { id: true, name: true },
    });
    console.log(`  ✓ Created proxy factory: ${warehouse.name}`);
  } else {
    console.log(`  ✓ Found proxy factory: ${warehouse.name}`);
  }

  // 3. Upsert one FuzeOrder per gaylord
  let created = 0;
  let updated = 0;
  let totalLiters = 0;
  let totalDollars = 0;

  for (const shipment of SHIPMENTS) {
    for (let i = 1; i <= shipment.count; i++) {
      const orderNumber = `FUZE-ORD-${shipment.weekTag}-DUB-${i}`;
      const totalPrice = LITERS_PER_GAYLORD * PRICE_PER_LITER_USD;
      const data = {
        orderType: ORDER_TYPE,
        volumeLiters: LITERS_PER_GAYLORD,
        fuzeTier: FUZE_TIER,
        pricePerLiter: PRICE_PER_LITER_USD,
        totalPrice,
        currency: "USD",
        factoryId: warehouse.id,
        distributorId: srs.id,
        fulfillmentSource: "DISTRIBUTOR",
        purposeNote: PURPOSE_NOTE,
        shippedDate: shipment.shipDate,
        shippingCity: "Dubai",
        shippingCountry: "United Arab Emirates",
        status: "SHIPPED",
        createdAt: shipment.orderDate,
      };

      const existing = await prisma.fuzeOrder.findUnique({
        where: { orderNumber },
        select: { id: true },
      });
      if (existing) {
        await prisma.fuzeOrder.update({ where: { orderNumber }, data });
        updated++;
        console.log(`  ↻ Updated ${orderNumber}`);
      } else {
        await prisma.fuzeOrder.create({ data: { orderNumber, ...data } });
        created++;
        console.log(
          `  + Created ${orderNumber} (${LITERS_PER_GAYLORD} L · $${totalPrice.toLocaleString()})`,
        );
      }
      totalLiters += LITERS_PER_GAYLORD;
      totalDollars += totalPrice;
    }
  }

  console.log("");
  console.log("─────────────────────────────────────────────");
  console.log(`✅ Done. ${created} created · ${updated} updated`);
  console.log(
    `   Total: ${totalLiters.toLocaleString()} L · $${totalDollars.toLocaleString()} USD`,
  );
  console.log("");
  console.log("Next:");
  console.log("  1. Hard-refresh /admin/weekly-review");
  console.log("  2. Click 'Refresh snapshot' to re-run buildSnapshot");
  console.log("  3. Sales & Distribution card should now show real Q2 numbers");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
