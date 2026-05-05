/**
 * scripts/toray-brand-to-factory.ts
 *
 * Andrew clarified (2026-05-04, on phone with Tina):
 *   "Toray has a factory and a brand. They should not have a brand but I
 *    think Yau uploaded stuff as a brand, or can't see her factories from
 *    when she registered as a brand and we had to fix her."
 *
 * Action: re-point everything currently on the Toray Brand record over to
 * the Toray Factory record, then delete the brand. Yau Kalee + the 5 fabrics
 * + 5 test requests + 1 contact should all live under the Factory.
 *
 *   --apply   actually mutates. Default is audit only.
 */
import { prisma } from "../src/lib/prisma";

const BRAND_ID = "cmmsibclt0000l70a3doclv1d"; // Toray Industries (H.K.) Ltd
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${APPLY ? "🟢 APPLY" : "🔵 audit only"}\n`);

  // Verify the brand exists
  const brand = await prisma.brand.findUnique({
    where: { id: BRAND_ID },
    include: {
      _count: {
        select: {
          contacts: true,
          notes: true,
          fabrics: true,
          submissions: true,
          projects: true,
          testRequests: true,
          fuzeOrders: true,
          invoices: true,
          sows: true,
        },
      },
    },
  });
  if (!brand) {
    console.error(`Brand ${BRAND_ID} not found.`);
    process.exit(1);
  }
  console.log(`Brand:   ${brand.name} (${brand.id})`);
  console.log(`Counts:`, brand._count);

  // Find a Toray factory
  const factories = await prisma.factory.findMany({
    where: { name: { contains: "toray", mode: "insensitive" } },
    select: { id: true, name: true, country: true, _count: { select: { contacts: true, fabrics: true } } },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nToray-named factories (${factories.length}):`);
  for (const f of factories) {
    console.log(`  • ${f.name.padEnd(35)} ${f.id}  ${f.country || ""}  contacts:${f._count.contacts} fabrics:${f._count.fabrics}`);
  }

  if (factories.length === 0) {
    console.error(`\n❌ No Toray factory exists. Create one first via /factories or rerun once you've created it.`);
    process.exit(1);
  }
  if (factories.length > 1) {
    console.error(`\n❌ Multiple Toray factories found. Edit this script and set TARGET_FACTORY_ID to the right one.`);
    process.exit(1);
  }
  const factory = factories[0];
  console.log(`\n→ Will re-point everything onto: ${factory.name} (${factory.id})`);

  if (!APPLY) {
    console.log(`\nRe-run with --apply to migrate.`);
    return;
  }

  // ════ APPLY ═════════════════════════════════════════════════════
  console.log(`\nApplying…`);

  await prisma.$transaction(async (tx) => {
    // Contacts: brand → factory. Set factoryId, clear brandId.
    const c = await tx.contact.updateMany({
      where: { brandId: BRAND_ID },
      data: { brandId: null, factoryId: factory.id },
    });
    console.log(`  contacts re-pointed:     ${c.count}`);

    // Fabrics: brand → factory.
    const f = await tx.fabric.updateMany({
      where: { brandId: BRAND_ID },
      data: { brandId: null, factoryId: factory.id },
    });
    console.log(`  fabrics re-pointed:      ${f.count}`);

    // FabricSubmissions: brand → factory.
    const s = await tx.fabricSubmission.updateMany({
      where: { brandId: BRAND_ID },
      data: { brandId: null, factoryId: factory.id },
    });
    console.log(`  submissions re-pointed:  ${s.count}`);

    // TestRequests: brand only — null it out (TestRequest has no factoryId column).
    // The submission still carries the factory linkage for any test request that
    // references it, so we don't lose context.
    try {
      const t = await tx.testRequest.updateMany({
        where: { brandId: BRAND_ID },
        data: { brandId: null },
      });
      console.log(`  testRequests cleared:    ${t.count}`);
    } catch (e: any) {
      console.warn(`  testRequests skipped (no brandId column?): ${e?.message}`);
    }

    // Notes: brand → factory.
    try {
      const n = await tx.note.updateMany({
        where: { brandId: BRAND_ID },
        data: { brandId: null, factoryId: factory.id },
      });
      console.log(`  notes re-pointed:        ${n.count}`);
    } catch (e: any) {
      console.warn(`  notes skipped: ${e?.message}`);
    }

    // OutreachMessage / ContactOutreach / EntityManager — these don't have
    // factoryId so we just null brandId so the brand can be deleted.
    for (const m of ["outreachMessage", "contactOutreach", "entityManager", "brandEngagement", "meeting", "shipment", "sOW", "invoice", "fuzeOrder", "project", "product"] as const) {
      try {
        // @ts-expect-error dynamic
        const r = await tx[m].updateMany({
          where: { brandId: BRAND_ID },
          data: { brandId: null },
        });
        if (r.count > 0) console.log(`  ${m} brandId cleared:   ${r.count}`);
      } catch (e: any) {
        if (!String(e?.message || "").includes("Unknown")) {
          console.warn(`  ${m} skipped: ${e?.message}`);
        }
      }
    }

    // Delete the brand
    await tx.brand.delete({ where: { id: BRAND_ID } });
    console.log(`  ✓ brand deleted`);
  }, { timeout: 30_000 });

  console.log(`\nDone. Verify Yau Kalee in /factories/${factory.id} → Contacts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
