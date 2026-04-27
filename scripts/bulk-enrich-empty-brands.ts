// @ts-nocheck
/**
 * Bulk-enrich LEAD brands that have zero contacts.
 *
 * Companion to the auto-enrich-on-discovery flow in
 * /api/brands/discover. That flow handles new brands going forward;
 * this script catches up the existing 1000+ empty brands that landed
 * before auto-enrich was wired in.
 *
 * Both paths share src/lib/apollo-people-search.ts so the enrichment
 * shape stays identical.
 *
 * Apollo cost: ~1 credit per brand (single mixed_people/search call).
 *
 *   npx tsx scripts/bulk-enrich-empty-brands.ts                   # dry, all
 *   npx tsx scripts/bulk-enrich-empty-brands.ts --limit=25        # dry, first 25
 *   npx tsx scripts/bulk-enrich-empty-brands.ts --limit=25 --apply
 *   npx tsx scripts/bulk-enrich-empty-brands.ts --apply           # write all
 *
 * Skips brands that:
 *   - already have at least one contact
 *   - have no website / unparseable website
 *   - have validationStatus in dead/duplicate/irrelevant
 *
 * Re-runnable safely. Idempotent on (brandId, apolloId) — if a contact
 * with the same apolloId already exists on the brand, we update it
 * instead of duplicating.
 */

import { PrismaClient } from "@prisma/client";
import {
  extractDomain,
  searchApolloByDomain,
  apolloPersonToContactData,
} from "../src/lib/apollo-people-search";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 0;

if (!process.env.APOLLO_API_KEY) {
  console.error("APOLLO_API_KEY not set in environment.");
  process.exit(1);
}

async function main() {
  const candidates = await prisma.brand.findMany({
    where: {
      pipelineStage: "LEAD",
      validationStatus: { notIn: ["dead", "duplicate", "irrelevant"] },
      contacts: { none: {} },
      website: { not: null },
    },
    select: {
      id: true,
      name: true,
      website: true,
    },
    orderBy: { updatedAt: "desc" },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log(
    `\n${candidates.length} LEAD brand(s) with no contacts and a website.${LIMIT > 0 ? ` (Capped at --limit=${LIMIT}.)` : ""}\n`,
  );
  if (!APPLY) {
    console.log("DRY RUN — no writes will be made. Pass --apply to enrich.\n");
  }

  const stats = {
    processed: 0,
    skippedNoDomain: 0,
    foundContacts: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    apolloEmpty: 0,
  };

  for (const b of candidates) {
    stats.processed++;
    const domain = extractDomain(b.website);
    if (!domain) {
      stats.skippedNoDomain++;
      console.log(`  ⊘ ${b.name} — unparseable website: ${b.website}`);
      continue;
    }

    const people = await searchApolloByDomain(domain);
    if (people.length === 0) {
      stats.apolloEmpty++;
      console.log(`  ✗ ${b.name} (${domain}) — Apollo returned 0 senior people`);
      continue;
    }

    stats.foundContacts += people.length;
    console.log(`  ✓ ${b.name} (${domain}) — ${people.length} contact(s)`);
    for (const p of people) {
      const fullName =
        p.name || [p.first_name, p.last_name].filter(Boolean).join(" ");
      console.log(
        `      · ${fullName} — ${p.title || "(no title)"} ${p.seniority ? `[${p.seniority}]` : ""}${p.email ? ` · ${p.email}` : ""}`,
      );
      if (!APPLY) continue;

      const apolloId = p.id || null;
      const existing = apolloId
        ? await prisma.contact.findFirst({
            where: { brandId: b.id, apolloId },
            select: { id: true },
          })
        : null;
      const data = {
        brandId: b.id,
        ...apolloPersonToContactData(p, "apollo_bulk"),
      };
      if (existing) {
        await prisma.contact.update({ where: { id: existing.id }, data });
        stats.contactsUpdated++;
      } else {
        await prisma.contact.create({ data });
        stats.contactsCreated++;
      }
    }

    // Light rate-limit pause: friendly to Apollo + keeps logs readable.
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log("\n═══ Bulk Enrichment Summary ═══\n");
  console.log(`  Brands processed:        ${stats.processed}`);
  console.log(`  Skipped (no domain):     ${stats.skippedNoDomain}`);
  console.log(`  Apollo returned empty:   ${stats.apolloEmpty}`);
  console.log(`  Total contacts found:    ${stats.foundContacts}`);
  if (APPLY) {
    console.log(`  Contacts created:        ${stats.contactsCreated}`);
    console.log(`  Contacts updated:        ${stats.contactsUpdated}`);
  } else {
    console.log(`  (Dry run — no writes. Pass --apply to commit.)`);
  }
  console.log("");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
