// FUZE Team directory + resolver (brand-portal item 8).
//
// The brand-portal "FUZE Team" page tells a brand WHO AT FUZE to contact to
// get answers — scoped to the region/countries their supply chain operates
// in. This is NOT the brand's own contacts. The Account Manager is resolved
// from live data (EntityManager → Brand.salesRepId); Corporate is always
// shown; Regional Managers and Technical Contacts are computed from the
// brand's factory countries against the directory below.
//
// Names/titles/emails below are authoritative per Andrew (2026-07 spec).

import { prisma } from "@/lib/prisma";

export interface TeamContact {
  name: string;
  title: string;
  email: string;
  /** Human-readable coverage: "Corporate Office", "Asia", a country, etc. */
  scope: string;
}

export interface FuzeTeam {
  accountManager: TeamContact | null;
  corporate: TeamContact[];
  regionalManagers: TeamContact[];
  technicalContacts: TeamContact[];
  /** False when no factory/region could be resolved yet. */
  hasRegion: boolean;
}

// ── Corporate / Exec — always shown to every brand ──
const CORPORATE: TeamContact[] = [
  {
    name: "Andrew Peterson",
    title: "Founder & President",
    email: "Andrew@fuze47.com",
    scope: "Corporate Office",
  },
  {
    name: "Scott Pace",
    title: "Director of Operations",
    email: "Scott@fuze47.com",
    scope: "Corporate Office",
  },
];

// ── Regional managers, keyed by a region whose country set decides coverage ──
interface Region {
  key: string;
  label: string;
  countries: string[]; // lowercased country names / aliases
  manager: Omit<TeamContact, "scope">;
}

const REGIONS: Region[] = [
  {
    key: "ASIA",
    label: "Asia",
    countries: [
      "taiwan", "vietnam", "japan", "china", "chinese mainland", "korea",
      "south korea", "hong kong", "thailand", "indonesia", "malaysia", "cambodia",
    ],
    manager: { name: "Tina Hong", title: "Director of Asia Operations", email: "Tina@fuze47.com" },
  },
  {
    key: "SOUTH_ASIA_GULF",
    label: "South Asia & Gulf",
    countries: [
      "india", "sri lanka", "bangladesh", "pakistan", "uae",
      "united arab emirates", "dubai",
    ],
    manager: { name: "Scott Pace", title: "Director of Operations", email: "Scott@fuze47.com" },
  },
  {
    key: "EUROPE_TURKEY",
    label: "Europe & Türkiye",
    countries: [
      "turkey", "türkiye", "italy", "spain", "portugal", "germany", "france",
      "united kingdom", "uk", "netherlands", "poland",
    ],
    // Until a named EMEA regional manager exists, Andrew covers it.
    manager: { name: "Andrew Peterson", title: "Founder & President", email: "Andrew@fuze47.com" },
  },
  {
    key: "AMERICAS",
    label: "Americas",
    countries: ["usa", "united states", "mexico", "canada", "brazil", "peru", "colombia"],
    manager: { name: "Andrew Peterson", title: "Founder & President", email: "Andrew@fuze47.com" },
  },
];

// ── Country-level technical / director contacts (extend as more are named) ──
const TECHNICAL_BY_COUNTRY: Record<string, Omit<TeamContact, "scope">> = {
  china: { name: "Tandy Xia", title: "Director of China / Technical Contact", email: "Tandy@fuze47.com" },
  "chinese mainland": { name: "Tandy Xia", title: "Director of China / Technical Contact", email: "Tandy@fuze47.com" },
};

const norm = (c?: string | null) => (c || "").trim().toLowerCase();

/** Collect the distinct lowercased countries of a brand's factories. */
async function brandCountries(brandId: string): Promise<string[]> {
  const set = new Set<string>();
  try {
    const [bf, fabrics] = await Promise.all([
      prisma.brandFactory.findMany({
        where: { brandId },
        select: { factory: { select: { country: true, secondaryCountry: true } } },
      }),
      prisma.fabric.findMany({
        where: { brandId, factoryId: { not: null } },
        select: { factory: { select: { country: true, secondaryCountry: true } } },
      }),
    ]);
    for (const r of [...bf, ...fabrics]) {
      if (r.factory?.country) set.add(norm(r.factory.country));
      if (r.factory?.secondaryCountry) set.add(norm(r.factory.secondaryCountry));
    }
  } catch {
    /* fall through — no region resolved */
  }
  set.delete("");
  return Array.from(set);
}

/**
 * Resolve the FUZE-side team for a brand: Account Manager (live), Corporate
 * (always), Regional Managers + Technical Contacts (from the brand's factory
 * countries).
 */
export async function resolveFuzeTeam(brandId: string): Promise<FuzeTeam> {
  const [brand, ems, countries] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { salesRep: { select: { name: true, email: true } } },
    }),
    prisma.entityManager.findMany({
      where: { entityType: "BRAND", entityId: brandId, role: "ACCOUNT_MANAGER" },
      select: { userId: true, isPrimary: true },
    }),
    brandCountries(brandId),
  ]);

  // Account Manager — EntityManager(ACCOUNT_MANAGER) → salesRep.
  let accountManager: TeamContact | null = null;
  const amRow = ems.find((e) => e.isPrimary) || ems[0];
  if (amRow) {
    const u = await prisma.user.findUnique({
      where: { id: amRow.userId },
      select: { name: true, email: true },
    });
    if (u) {
      accountManager = {
        name: u.name || u.email,
        title: "Account Manager",
        email: u.email,
        scope: "Your account",
      };
    }
  }
  if (!accountManager && brand?.salesRep) {
    accountManager = {
      name: brand.salesRep.name || brand.salesRep.email,
      title: "Account Manager",
      email: brand.salesRep.email,
      scope: "Your account",
    };
  }

  // Regional managers — one per matched region, deduped by email so a manager
  // covering multiple regions (e.g. Andrew over Europe + Americas) shows once
  // with a combined scope.
  const regionalByEmail = new Map<string, TeamContact>();
  for (const region of REGIONS) {
    const matched = countries.filter((c) => region.countries.includes(c));
    if (matched.length === 0) continue;
    const key = region.manager.email.toLowerCase();
    if (regionalByEmail.has(key)) {
      const existing = regionalByEmail.get(key)!;
      existing.scope = `${existing.scope}, ${region.label}`;
    } else {
      regionalByEmail.set(key, { ...region.manager, scope: region.label });
    }
  }

  // Technical / country contacts — deduped by email.
  const techByEmail = new Map<string, TeamContact>();
  for (const c of countries) {
    const tech = TECHNICAL_BY_COUNTRY[c];
    if (!tech) continue;
    const key = tech.email.toLowerCase();
    if (!techByEmail.has(key)) {
      // Title-case the matched country for the scope label.
      const scope = c.replace(/\b\w/g, (m) => m.toUpperCase());
      techByEmail.set(key, { ...tech, scope });
    }
  }

  return {
    accountManager,
    corporate: CORPORATE,
    regionalManagers: Array.from(regionalByEmail.values()),
    technicalContacts: Array.from(techByEmail.values()),
    hasRegion: countries.length > 0,
  };
}
