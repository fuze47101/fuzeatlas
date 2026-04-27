// @ts-nocheck
/**
 * Find users with a SALES role tag who are actually external entity
 * contacts. Two detection paths:
 *
 *   PATH A — entity link already set
 *     User has brandId / factoryId / distributorId / labId set AND a
 *     SALES role. Clearly mis-tagged. Flip to the matching role for
 *     that entity type.
 *
 *   PATH B — email domain matches an entity website
 *     User has SALES role + no entity link, but their email domain
 *     matches a Brand.website / Factory.website / Distributor.website.
 *     Flip role AND set the entity link.
 *
 *   Path B catches Josie Ross-MacLeod at spanx.com — she had role
 *   SALES_REP but no brandId, just a domain match against the Spanx
 *   brand record.
 *
 * Skips FUZE-internal domains (fuze47.com, 801inc.com, fuzebiotech.com,
 * akcelpartners.com — Connie/Barth's domain, srsus.com — Jeremy/Scott
 * Smith's domain). Those are correctly tagged as FUZE BD reps.
 *
 *   npx tsx scripts/fix-misroled-users.ts            # dry run
 *   npx tsx scripts/fix-misroled-users.ts --apply    # write fixes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const BD_ROLES = ["SALES_REP", "SALES_MANAGER", "BD_REP"];

// Domains that ARE legitimately FUZE BD-side. Anyone at these domains
// keeps their SALES role even with no entity link.
const FUZE_INTERNAL_DOMAINS = new Set([
  "fuze47.com",
  "fuze47.jp",
  "801inc.com",
  "fuzebiotech.com",
  "akcelpartners.com", // Connie + Barth (FUZE-side via Akcel)
  "srsus.com", // Jeremy + Scott Smith (SRS-paid but doing FUZE BD)
  "harrisandmenukchem.com", // Kathir
  "texwell.com.cn", // Tandy
  "globalshine.com.tw", // Danny et al
]);

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function websiteToDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function main() {
  // Pull every user with a BD role tag for inspection.
  const users = await prisma.user.findMany({
    where: { role: { in: BD_ROLES } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      brandId: true,
      factoryId: true,
      distributorId: true,
      labId: true,
    },
    orderBy: { name: "asc" },
  });

  // Pull all entities with websites so we can domain-match.
  const [brands, factories, distributors] = await Promise.all([
    prisma.brand.findMany({
      where: { website: { not: null } },
      select: { id: true, name: true, website: true },
    }),
    prisma.factory.findMany({
      where: { website: { not: null } },
      select: { id: true, name: true, website: true },
    }),
    prisma.distributor.findMany({
      where: { website: { not: null } },
      select: { id: true, name: true, website: true },
    }),
  ]);

  const brandByDomain: Record<string, any> = {};
  for (const b of brands) {
    const d = websiteToDomain(b.website);
    if (d) brandByDomain[d] = b;
  }
  const factoryByDomain: Record<string, any> = {};
  for (const f of factories) {
    const d = websiteToDomain(f.website);
    if (d) factoryByDomain[d] = f;
  }
  const distributorByDomain: Record<string, any> = {};
  for (const d of distributors) {
    const dom = websiteToDomain(d.website);
    if (dom) distributorByDomain[dom] = d;
  }

  type Fix = {
    userId: string;
    name: string;
    email: string;
    fromRole: string;
    toRole: string;
    setLink: { brandId?: string; factoryId?: string; distributorId?: string };
    reason: string;
  };
  const fixes: Fix[] = [];

  for (const u of users) {
    // Path A — already linked to an entity
    if (u.brandId || u.factoryId || u.distributorId || u.labId) {
      let toRole = "EMPLOYEE";
      if (u.brandId) toRole = "BRAND_USER";
      else if (u.factoryId) toRole = "FACTORY_USER";
      else if (u.distributorId) toRole = "DISTRIBUTOR_USER";
      else if (u.labId) toRole = "LAB_USER";
      fixes.push({
        userId: u.id,
        name: u.name || "(no name)",
        email: u.email,
        fromRole: u.role,
        toRole,
        setLink: {},
        reason: "Already linked to an external entity",
      });
      continue;
    }

    // Path B — domain match
    const dom = emailDomain(u.email);
    if (!dom) continue;
    if (FUZE_INTERNAL_DOMAINS.has(dom)) continue;

    if (brandByDomain[dom]) {
      const b = brandByDomain[dom];
      fixes.push({
        userId: u.id,
        name: u.name || "(no name)",
        email: u.email,
        fromRole: u.role,
        toRole: "BRAND_USER",
        setLink: { brandId: b.id },
        reason: `Email domain ${dom} matches Brand "${b.name}" (${b.website})`,
      });
      continue;
    }
    if (factoryByDomain[dom]) {
      const f = factoryByDomain[dom];
      fixes.push({
        userId: u.id,
        name: u.name || "(no name)",
        email: u.email,
        fromRole: u.role,
        toRole: "FACTORY_USER",
        setLink: { factoryId: f.id },
        reason: `Email domain ${dom} matches Factory "${f.name}"`,
      });
      continue;
    }
    if (distributorByDomain[dom]) {
      const d = distributorByDomain[dom];
      fixes.push({
        userId: u.id,
        name: u.name || "(no name)",
        email: u.email,
        fromRole: u.role,
        toRole: "DISTRIBUTOR_USER",
        setLink: { distributorId: d.id },
        reason: `Email domain ${dom} matches Distributor "${d.name}"`,
      });
      continue;
    }
    // No match — could be a legitimate FUZE rep at a non-listed domain,
    // or noise. Don't auto-flip; surface for review.
    if (!FUZE_INTERNAL_DOMAINS.has(dom)) {
      console.log(
        `  ?  ${u.name || "(no name)"} <${u.email}>  role=${u.role}  domain=${dom} — no entity match, no FUZE-internal allowlist match. Review manually if needed.`,
      );
    }
  }

  if (fixes.length === 0) {
    console.log("\n✅ No mis-roled users to fix.\n");
    return;
  }

  console.log(`\nFound ${fixes.length} mis-roled user(s):\n`);
  for (const f of fixes) {
    console.log(
      `  ${f.name} <${f.email}>  ${f.fromRole}  →  ${f.toRole}`,
    );
    console.log(`    why: ${f.reason}`);
    if (Object.keys(f.setLink).length > 0) {
      console.log(`    + setting: ${JSON.stringify(f.setLink)}`);
    }
    if (APPLY) {
      await prisma.user.update({
        where: { id: f.userId },
        data: { role: f.toRole, ...f.setLink },
      });
      console.log("    ✓ updated");
    }
  }

  console.log("");
  if (!APPLY) {
    console.log("Dry run — no writes. Re-run with --apply to fix.\n");
  } else {
    console.log("Done.\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
