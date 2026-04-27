// @ts-nocheck
/**
 * Bulk-enrich LEAD brands that have zero contacts.
 *
 * Why this exists: bd-pipeline-status.ts surfaced 1083 LEAD brands with
 * no contacts attached — that's why Ryan's wizard returned "out of
 * contacts." The discovery cron creates Brand records, but it doesn't
 * follow up with people-search to populate them, so brands land empty.
 *
 * For each empty LEAD brand with a parseable domain, this script calls
 * Apollo's mixed_people/search with the brand's domain + a target set
 * of senior titles (c_suite, vp, director, founder, head). It writes
 * up to N contacts per brand and stamps each Contact with email,
 * linkedin, title, seniority, and apolloId — same shape the wizard
 * already reads.
 *
 * Apollo cost per call: ~1 credit. 1083 brands ≈ 1083 credits. Use
 * --limit to cap the batch and sanity-check on a small slice first.
 *
 *   npx tsx scripts/bulk-enrich-empty-brands.ts                  # dry run, all
 *   npx tsx scripts/bulk-enrich-empty-brands.ts --limit 25       # dry, first 25
 *   npx tsx scripts/bulk-enrich-empty-brands.ts --limit 25 --apply  # write 25
 *   npx tsx scripts/bulk-enrich-empty-brands.ts --apply          # write all
 *
 * Skips brands that:
 *   - already have at least one contact (defensive)
 *   - have no website / unparseable website
 *   - have validationStatus in dead/duplicate/irrelevant
 *
 * Re-runnable safely. Idempotent on (brandId, apolloId) — if a contact
 * with the same apolloId already exists on the brand, we update it
 * instead of duplicating.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 0;
const PER_BRAND_LIMIT = 8; // up to 8 contacts per brand
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

if (!APOLLO_API_KEY) {
  console.error("APOLLO_API_KEY not set in environment.");
  process.exit(1);
}

// Senior titles we care about for FUZE BD outreach. Apollo's
// person_seniorities is the cleanest filter; we layer person_titles
// to bias toward sustainability / sourcing / product / R&D roles
// since those are the FUZE buyer personas.
const SENIORITIES = ["founder", "c_suite", "owner", "partner", "vp", "head", "director"];
const TITLE_KEYWORDS = [
  "sustainability",
  "sourcing",
  "product",
  "innovation",
  "supply chain",
  "operations",
  "merchandising",
  "design",
  "research",
  "development",
  "ceo",
  "founder",
  "president",
  "coo",
  "cpo",
];

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === "undefined" || host.length < 4) return null;
    return host;
  } catch {
    return null;
  }
}

async function searchApollo(domain: string): Promise<any[]> {
  const body: any = {
    q_organization_domains_list: [domain],
    person_seniorities: SENIORITIES,
    page: 1,
    per_page: 25,
  };
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`  ⚠ Apollo HTTP ${res.status} for ${domain}: ${txt.slice(0, 120)}`);
      return [];
    }
    const json = await res.json();
    const people = Array.isArray(json.people) ? json.people : [];
    // Re-rank: titles matching our keywords first, then by seniority order.
    const rank = (p: any) => {
      const title = (p.title || "").toLowerCase();
      const titleHit = TITLE_KEYWORDS.findIndex((k) => title.includes(k));
      const seniorityRank = SENIORITIES.indexOf(p.seniority || "zzz");
      return (titleHit === -1 ? 99 : titleHit) * 100 + (seniorityRank === -1 ? 99 : seniorityRank);
    };
    return people.sort((a: any, b: any) => rank(a) - rank(b)).slice(0, PER_BRAND_LIMIT);
  } catch (e: any) {
    console.warn(`  ⚠ Apollo fetch failed for ${domain}: ${e.message}`);
    return [];
  }
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

  let stats = {
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

    const people = await searchApollo(domain);
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
      // Idempotency: if a contact with this apolloId already exists on
      // this brand, update it instead of creating a duplicate.
      const existing = apolloId
        ? await prisma.contact.findFirst({
            where: { brandId: b.id, apolloId },
            select: { id: true },
          })
        : null;

      const data: any = {
        brandId: b.id,
        firstName: p.first_name || null,
        lastName: p.last_name || null,
        name: fullName || null,
        title: p.title || null,
        jobTitle: p.title || null,
        email:
          p.email && p.email_status !== "unavailable" ? p.email : null,
        emailStatus: p.email_status || null,
        linkedinUrl: p.linkedin_url || null,
        seniority: p.seniority || null,
        apolloId,
        enrichmentSource: "apollo_bulk",
        enrichedAt: new Date(),
      };

      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data,
        });
        stats.contactsUpdated++;
      } else {
        await prisma.contact.create({ data });
        stats.contactsCreated++;
      }
    }

    // Light rate-limit pause: Apollo's standard plan allows ~600 req/min,
    // but a 50ms delay between requests is friendly + keeps logs readable.
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
