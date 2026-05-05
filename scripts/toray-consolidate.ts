/**
 * scripts/toray-consolidate.ts
 *
 * Audit + atomic merge for the Toray entity sprawl.
 *
 * Andrew on the phone with Tina (2026-05-04): all users + submissions need to
 * roll up under "Toray Industries", and Toray Hong Kong (currently a Brand
 * record) needs to die because it's part of the duplicate problem. Yau Kalee
 * is double-attached (Toray Industries + Toray Hong Kong).
 *
 * Two modes:
 *   - DEFAULT (audit only):
 *       npx tsx scripts/toray-consolidate.ts
 *       Prints every Brand / Factory / Distributor / Contact / Fabric /
 *       Submission row whose name or email contains "toray" (case-insensitive)
 *       plus the canonical keep target. Makes no writes.
 *
 *   - APPLY (run the merges):
 *       npx tsx scripts/toray-consolidate.ts --apply
 *       Picks the canonical "Toray Industries" Brand (must exist already),
 *       then for every other Toray-named Brand: re-points contacts, notes,
 *       fabrics, submissions, projects, etc. into Toray Industries via the
 *       same brand-merge transaction the admin UI uses, and deletes the
 *       merge-side brand.
 *
 *       For Factory / Distributor rows containing "toray" we DON'T auto-merge —
 *       script prints them and asks Andrew to handle from the UI, because the
 *       cross-table merge is more nuanced (Toray is both a brand AND a factory
 *       owner of the same name and we can't blindly collapse them).
 *
 * Yau Kalee:
 *   The script identifies every Contact named "Yau Kalee" (or close variants)
 *   on a Toray-named brand, and after the merge they'll all be on Toray
 *   Industries. If there are duplicate contact rows (same email) post-merge,
 *   the script collapses them to the oldest by createdAt.
 */
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const KEEP_NAME = "Toray Industries";

async function main() {
  console.log("════════════════════════════════════════");
  console.log("  TORAY CONSOLIDATION");
  console.log(`  Mode: ${APPLY ? "🟢 APPLY (will write)" : "🔵 audit only (read-only)"}`);
  console.log("════════════════════════════════════════\n");

  // ── 1. Find every Toray-named Brand ─────────────────────────────
  const brands = await prisma.brand.findMany({
    where: { name: { contains: "toray", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      website: true,
      createdAt: true,
      _count: {
        select: {
          contacts: true,
          notes: true,
          fabrics: true,
          submissions: true,
          projects: true,
          products: true,
          fuzeOrders: true,
          invoices: true,
          sows: true,
          testRequests: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${brands.length} Brand row(s) named "*toray*":\n`);
  for (const b of brands) {
    console.log(
      `  • ${b.name.padEnd(30)} ${b.id}  (${b.createdAt.toISOString().slice(0, 10)})`,
    );
    console.log(
      `      contacts:${b._count.contacts} notes:${b._count.notes} fabrics:${b._count.fabrics} submissions:${b._count.submissions} projects:${b._count.projects} products:${b._count.products} fuzeOrders:${b._count.fuzeOrders} invoices:${b._count.invoices} sows:${b._count.sows} testRequests:${b._count.testRequests}`,
    );
    if (b.website) console.log(`      website: ${b.website}`);
  }

  // Find the keep target
  const keep =
    brands.find((b) => b.name.trim().toLowerCase() === KEEP_NAME.toLowerCase()) || null;

  if (!keep) {
    console.log(`\n❌ No Brand row exactly named "${KEEP_NAME}" found.`);
    console.log(`   Pick one of the rows above and rename it to "${KEEP_NAME}" first,`);
    console.log(`   then re-run this script.`);
    return;
  }

  const mergeBrands = brands.filter((b) => b.id !== keep.id);
  console.log(`\n→ Keep:  ${keep.name} (${keep.id})`);
  console.log(`→ Merge into keep: ${mergeBrands.length} brand(s)`);
  for (const m of mergeBrands) {
    console.log(`     - ${m.name} (${m.id})`);
  }

  // ── 2. Toray-named Factory + Distributor rows (informational) ─────
  const [factories, distributors] = await Promise.all([
    prisma.factory.findMany({
      where: { name: { contains: "toray", mode: "insensitive" } },
      select: { id: true, name: true, country: true, _count: { select: { contacts: true, fabrics: true } } },
    }),
    prisma.distributor.findMany({
      where: { name: { contains: "toray", mode: "insensitive" } },
      select: { id: true, name: true, country: true, active: true, _count: { select: { contacts: true } } },
    }),
  ]);

  console.log(`\nFactory rows containing "toray": ${factories.length}`);
  for (const f of factories) {
    console.log(`  • ${f.name.padEnd(30)} ${f.id}  ${f.country || ""}  contacts:${f._count.contacts} fabrics:${f._count.fabrics}`);
  }
  console.log(`\nDistributor rows containing "toray": ${distributors.length}`);
  for (const d of distributors) {
    console.log(
      `  • ${d.name.padEnd(30)} ${d.id}  ${d.country || ""}  active:${d.active}  contacts:${d._count.contacts}`,
    );
  }
  if (factories.length || distributors.length) {
    console.log(
      `\n  ⚠ These cross-table rows are NOT touched by this script. Use /admin/hubspot-import → audit-duplicates to merge if needed.`,
    );
  }

  // ── 3. Yau Kalee occurrences ──────────────────────────────────────
  const yauContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { name: { contains: "yau", mode: "insensitive" } },
        { name: { contains: "kalee", mode: "insensitive" } },
        { firstName: { contains: "yau", mode: "insensitive" } },
        { lastName: { contains: "kalee", mode: "insensitive" } },
        { email: { contains: "yau", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
      distributor: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nContacts matching "yau" / "kalee": ${yauContacts.length}`);
  for (const c of yauContacts) {
    const where = c.brand
      ? `brand:${c.brand.name}`
      : c.factory
      ? `factory:${c.factory.name}`
      : c.distributor
      ? `distributor:${c.distributor.name}`
      : "(unattached)";
    console.log(`  • ${(c.name || `${c.firstName ?? ""} ${c.lastName ?? ""}`).trim().padEnd(28)} ${c.email || "(no email)"}  → ${where}  ${c.id}`);
  }

  if (!APPLY) {
    console.log(`\n────────────────────────────────────────`);
    console.log(`Audit complete. Re-run with --apply to merge.`);
    console.log(`────────────────────────────────────────`);
    return;
  }

  // ════════════════════════════════════════════════════════════════════
  // APPLY MODE — atomic merge for each merge-side brand into keep.
  // ════════════════════════════════════════════════════════════════════
  console.log(`\n════════════════════════════════════════`);
  console.log(`  APPLYING — ${mergeBrands.length} brand merge(s)`);
  console.log(`════════════════════════════════════════\n`);

  for (const m of mergeBrands) {
    console.log(`→ Merging "${m.name}" (${m.id}) into "${keep.name}" (${keep.id}) …`);
    try {
      await mergeBrandIntoKeep(m.id, keep.id);
      console.log(`  ✓ done`);
    } catch (e: any) {
      console.error(`  ✗ FAILED: ${e?.message || e}`);
      console.error(`  Continuing with the rest — re-run with --apply after fixing.`);
    }
  }

  // ── 4. Collapse duplicate Yau Kalee contacts post-merge ──────────
  // After the merge, all Yau contacts that were on Toray-named brands now sit
  // on Toray Industries. If two have the same email, keep the oldest and
  // re-point any FK referencing the duplicate.
  await collapseDuplicateContactsByEmail(keep.id);

  console.log(`\n✓ Done. Re-run without --apply to verify zero merge-side rows remain.`);
}

/**
 * Walk every model that has a brandId and re-point rows from mergeBrandId →
 * keepBrandId. For models with @@unique constraints involving brandId we walk
 * row-by-row and delete merge-side dupes that would collide. Mirrors the
 * /api/admin/brand-duplicates/merge handler. Wraps the whole thing in a
 * single $transaction so partial failure rolls back.
 */
async function mergeBrandIntoKeep(mergeBrandId: string, keepBrandId: string) {
  // Models with brandId-only updates (no composite unique conflicts):
  const SIMPLE_MODELS = [
    "contact",
    "note",
    "fabric",
    "fabricSubmission",
    "sOW",
    "invoice",
    "testRequest",
    "fuzeOrder",
    "outreachMessage",
    "contactOutreach",
    "entityManager",
    "brandEngagement",
    "meeting",
    "shipment",
  ] as const;

  // Models with composite unique constraints involving brandId — these can
  // collide when both keep + merge brand have a row that collapses to the
  // same key. Walk row-by-row, skip on collision, otherwise re-point.
  const COMPOSITE_MODELS: Array<{
    model: keyof typeof prisma;
    label: string;
    uniqueFields: string[];
  }> = [
    { model: "project" as any, label: "Project", uniqueFields: ["name", "brandId"] },
    { model: "product" as any, label: "Product", uniqueFields: ["brandId", "name"] },
  ];

  await prisma.$transaction(async (tx: any) => {
    // Clear merge-side unique fields up-front so the keep-side overlay
    // doesn't collide with itself. Mirrors the API handler.
    await tx.brand.update({
      where: { id: mergeBrandId },
      data: { website: null, hubspotId: null, knackId: null },
    });

    for (const m of SIMPLE_MODELS) {
      try {
        // @ts-expect-error dynamic model name
        const result = await tx[m].updateMany({
          where: { brandId: mergeBrandId },
          data: { brandId: keepBrandId },
        });
        if (result.count > 0) {
          console.log(`    ${m}: re-pointed ${result.count}`);
        }
      } catch (err: any) {
        // Some models in SIMPLE_MODELS may not have brandId on every schema
        // version. Swallow Unknown-arg errors and keep going.
        if (!String(err?.message || "").includes("Unknown")) {
          throw err;
        }
      }
    }

    for (const cfg of COMPOSITE_MODELS) {
      const rows = await (tx as any)[cfg.model].findMany({
        where: { brandId: mergeBrandId },
        select: Object.fromEntries([
          ["id", true],
          ...cfg.uniqueFields.map((f) => [f, true]),
        ]) as any,
      });
      let repointed = 0;
      let collisions = 0;
      for (const r of rows) {
        // Build the would-be keep-side composite key
        const candidate: any = {};
        for (const f of cfg.uniqueFields) {
          candidate[f] = f === "brandId" ? keepBrandId : (r as any)[f];
        }
        const existing = await (tx as any)[cfg.model].findFirst({
          where: candidate,
          select: { id: true },
        });
        if (existing) {
          // Keep already has it — drop merge-side row
          await (tx as any)[cfg.model].delete({ where: { id: r.id } });
          collisions++;
        } else {
          await (tx as any)[cfg.model].update({
            where: { id: r.id },
            data: { brandId: keepBrandId },
          });
          repointed++;
        }
      }
      if (repointed || collisions) {
        console.log(`    ${cfg.label}: re-pointed ${repointed}, dedup-deleted ${collisions}`);
      }
    }

    // Finally delete the brand
    await tx.brand.delete({ where: { id: mergeBrandId } });
  }, { timeout: 30_000 });
}

/**
 * Find contacts on the keep brand that share an email (case-insensitive),
 * keep the oldest, re-point any references to the duplicates, then delete
 * the duplicates. After we've collapsed Toray HK into Toray Industries we
 * may have two "Yau Kalee" rows with the same email.
 */
async function collapseDuplicateContactsByEmail(brandId: string) {
  const contacts = await prisma.contact.findMany({
    where: { brandId, email: { not: null } },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byEmail = new Map<string, { id: string; createdAt: Date }[]>();
  for (const c of contacts) {
    if (!c.email) continue;
    const key = c.email.toLowerCase().trim();
    const list = byEmail.get(key) || [];
    list.push({ id: c.id, createdAt: c.createdAt });
    byEmail.set(key, list);
  }

  let collapsed = 0;
  for (const [email, list] of byEmail) {
    if (list.length < 2) continue;
    const [keep, ...dupes] = list;
    console.log(`  Collapsing ${list.length} contacts with email ${email} (keep: ${keep.id})`);
    for (const d of dupes) {
      try {
        await prisma.$transaction(async (tx) => {
          // Re-point any references to the duplicate
          for (const m of [
            "note",
            "outreachMessage",
            "contactOutreach",
            "bDSequence",
            "meeting",
          ] as const) {
            try {
              // @ts-expect-error dynamic model
              await tx[m].updateMany({
                where: { contactId: d.id },
                data: { contactId: keep.id },
              });
            } catch (e: any) {
              if (!String(e?.message || "").includes("Unknown")) throw e;
            }
          }
          await tx.contact.delete({ where: { id: d.id } });
        });
        collapsed++;
      } catch (e: any) {
        console.error(`    ✗ could not collapse ${d.id}: ${e?.message || e}`);
      }
    }
  }
  if (collapsed) {
    console.log(`\n  Collapsed ${collapsed} duplicate contact(s) post-merge.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
