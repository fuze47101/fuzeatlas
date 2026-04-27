// @ts-nocheck
/**
 * Apollo people-search by domain — used by both the bulk-enrich script
 * (scripts/bulk-enrich-empty-brands.ts) and the brand-discovery flow
 * (/api/brands/discover) so newly-discovered brands land with contacts
 * already attached. Without this, discovery creates empty Brand rows
 * and the BD Wizard skips them via its `contacts: { some: {} }` filter.
 *
 * Returns up to PER_BRAND_LIMIT senior contacts ranked by:
 *   1. Title keyword match (sustainability / sourcing / product /
 *      innovation / supply chain / etc — the FUZE buyer personas)
 *   2. Apollo seniority enum (founder > c_suite > vp > head > director)
 *
 * Apollo cost: ~1 credit per call. Skip brands without a parseable
 * domain — Apollo people-search needs a domain to be useful.
 */

const PER_BRAND_LIMIT = 8;

const SENIORITIES = [
  "founder",
  "c_suite",
  "owner",
  "partner",
  "vp",
  "head",
  "director",
];

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

export function extractDomain(website: string | null | undefined): string | null {
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

export type ApolloPerson = {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  seniority?: string;
};

/**
 * Search Apollo for senior contacts at a domain. Returns ranked + capped
 * list. Empty array on failure / no results / missing API key — never
 * throws so callers can fire-and-forget without try/catch noise.
 */
export async function searchApolloByDomain(domain: string): Promise<ApolloPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];
  if (!domain) return [];

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
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const people: ApolloPerson[] = Array.isArray(json.people) ? json.people : [];
    const rank = (p: ApolloPerson) => {
      const title = (p.title || "").toLowerCase();
      const titleHit = TITLE_KEYWORDS.findIndex((k) => title.includes(k));
      const seniorityRank = SENIORITIES.indexOf(p.seniority || "zzz");
      return (
        (titleHit === -1 ? 99 : titleHit) * 100 +
        (seniorityRank === -1 ? 99 : seniorityRank)
      );
    };
    return people.sort((a, b) => rank(a) - rank(b)).slice(0, PER_BRAND_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Apollo person → Prisma Contact create payload (without brandId).
 * Caller adds brandId. Stamps `enrichmentSource: "apollo_discover"`
 * (or whatever you pass) so we can audit which contacts came from
 * the auto-enrich path vs manual creation.
 */
export function apolloPersonToContactData(p: ApolloPerson, source: string = "apollo_discover") {
  const fullName = p.name || [p.first_name, p.last_name].filter(Boolean).join(" ");
  return {
    firstName: p.first_name || null,
    lastName: p.last_name || null,
    name: fullName || null,
    title: p.title || null,
    jobTitle: p.title || null,
    email: p.email && p.email_status !== "unavailable" ? p.email : null,
    emailStatus: p.email_status || null,
    linkedinUrl: p.linkedin_url || null,
    seniority: p.seniority || null,
    apolloId: p.id || null,
    enrichmentSource: source,
    enrichedAt: new Date(),
  };
}
