// FUZE Team resolver (brand-portal item 8).
//
// The brand-portal "Contacts" page used to list the brand's OWN contacts.
// It now shows the brand's FUZE-side people — the humans at FUZE who own the
// relationship: Account Manager, Region Manager, Lab Manager, and the Exec
// Team. The Account Manager is resolved from live data (EntityManager →
// Brand.salesRepId). The other three come from the defaults below, with a
// per-brand override when an EntityManager row with the matching role exists.
//
// ⚠️ ANDREW — CONFIRM THESE NAMES + EMAILS. The static roster below is a
// best-guess seed from CLAUDE.md (Tina = lab ops / Asia; Tandy + Scott =
// regional; Andrew + Scott Pace = exec). Correct the emails to the real
// mailboxes and adjust the region→director mapping as needed.

import { prisma } from "@/lib/prisma";

export interface TeamMember {
  name: string;
  email: string;
  role: string;
  note?: string;
}

export interface FuzeTeam {
  accountManager: TeamMember | null;
  regionManager: TeamMember | null;
  labManager: TeamMember | null;
  execTeam: TeamMember[];
}

// ── Static roster (override per-brand via EntityManager roles below) ──
const REGION_DIRECTORS: Record<string, TeamMember> = {
  ASIA: { name: "Tina Hong", email: "tina@fuze47.com", role: "Region Manager — Asia" },
  AMERICAS: { name: "Scott Pace", email: "scott@fuze47.com", role: "Region Manager — Americas" },
  EUROPE: { name: "Tandy", email: "tandy@fuze47.com", role: "Region Manager — Europe / EMEA" },
};
const DEFAULT_REGION = "ASIA";

const LAB_MANAGER: TeamMember = {
  name: "Tina Hong",
  email: "tina@fuze47.com",
  role: "Lab Manager",
};

const EXEC_TEAM: TeamMember[] = [
  { name: "Andrew Peterson", email: "andrew@fuze47.com", role: "CEO / Founder" },
  { name: "Scott Pace", email: "scott@fuze47.com", role: "Executive Team" },
];

const DEFAULT_ACCOUNT_MANAGER: TeamMember = {
  name: "FUZE Account Team",
  email: "hello@fuze47.com",
  role: "Account Manager",
};

// Country → region bucket. Extend as new mills come online.
const COUNTRY_REGION: Record<string, string> = {
  china: "ASIA", "chinese mainland": "ASIA", taiwan: "ASIA", vietnam: "ASIA",
  bangladesh: "ASIA", india: "ASIA", korea: "ASIA", "south korea": "ASIA",
  thailand: "ASIA", japan: "ASIA", indonesia: "ASIA", malaysia: "ASIA",
  pakistan: "ASIA", cambodia: "ASIA", turkey: "ASIA", "türkiye": "ASIA",
  usa: "AMERICAS", "united states": "AMERICAS", mexico: "AMERICAS",
  brazil: "AMERICAS", canada: "AMERICAS",
  italy: "EUROPE", spain: "EUROPE", portugal: "EUROPE", germany: "EUROPE",
  france: "EUROPE", "united kingdom": "EUROPE", uk: "EUROPE",
};

function regionForCountry(country?: string | null): string {
  if (!country) return DEFAULT_REGION;
  return COUNTRY_REGION[country.trim().toLowerCase()] || DEFAULT_REGION;
}

function memberFromUser(u: { name: string | null; email: string; role?: string } | null, roleLabel: string): TeamMember | null {
  if (!u) return null;
  return { name: u.name || u.email, email: u.email, role: roleLabel };
}

/**
 * Resolve the FUZE-side team for a brand.
 * Real data drives the Account Manager; static defaults (overridable via
 * EntityManager roles) fill Region/Lab/Exec.
 */
export async function resolveFuzeTeam(brandId: string): Promise<FuzeTeam> {
  const [brand, ems] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, salesRep: { select: { name: true, email: true } } },
    }),
    prisma.entityManager.findMany({
      where: { entityType: "BRAND", entityId: brandId },
      select: { userId: true, role: true, isPrimary: true },
    }),
  ]);

  // Resolve the users referenced by EntityManager rows in one query.
  const userIds = Array.from(new Set(ems.map((e) => e.userId)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const pickByRole = (role: string) => {
    const rows = ems.filter((e) => e.role === role);
    const primary = rows.find((r) => r.isPrimary) || rows[0];
    return primary ? userMap.get(primary.userId) || null : null;
  };

  // Account Manager — EntityManager(ACCOUNT_MANAGER) → salesRep → default.
  const amUser = pickByRole("ACCOUNT_MANAGER");
  const accountManager: TeamMember =
    memberFromUser(amUser || null, "Account Manager") ||
    memberFromUser(brand?.salesRep || null, "Account Manager") ||
    DEFAULT_ACCOUNT_MANAGER;

  // Region — override via EntityManager(REGION_MANAGER), else map from the
  // brand's factory countries, else default region.
  const regionOverride = pickByRole("REGION_MANAGER");
  let regionManager: TeamMember | null = memberFromUser(regionOverride || null, "Region Manager");
  if (!regionManager) {
    let region = DEFAULT_REGION;
    try {
      const bf = await prisma.brandFactory.findMany({
        where: { brandId },
        select: { isPrimary: true, factory: { select: { country: true } } },
        orderBy: { isPrimary: "desc" },
      });
      const country = bf.find((r) => r.factory?.country)?.factory?.country;
      region = regionForCountry(country);
    } catch {
      /* fall back to default region */
    }
    regionManager = REGION_DIRECTORS[region] || REGION_DIRECTORS[DEFAULT_REGION];
  }

  // Lab Manager — override via EntityManager(LAB_MANAGER), else default.
  const labOverride = pickByRole("LAB_MANAGER");
  const labManager: TeamMember =
    memberFromUser(labOverride || null, "Lab Manager") || LAB_MANAGER;

  // Exec Team — any EntityManager(EXEC) rows override the static exec list.
  const execRows = ems.filter((e) => e.role === "EXEC");
  const execOverrides = execRows
    .map((e) => userMap.get(e.userId))
    .filter(Boolean)
    .map((u) => memberFromUser(u!, "Executive Team")!)
    .filter(Boolean);
  const execTeam = execOverrides.length ? execOverrides : EXEC_TEAM;

  return { accountManager, regionManager, labManager, execTeam };
}
