// @ts-nocheck
/**
 * Thin HubSpot API client used by the migration importer
 * (/api/admin/hubspot-import/*). Auth via Private App access token
 * stored in HUBSPOT_API_KEY env var.
 *
 * Coverage right now (Day 1):
 *   - listContacts     — paginated GET /crm/v3/objects/contacts
 *   - listCompanies    — paginated GET /crm/v3/objects/companies
 *   - getContactAssociatedCompanies — for linking a contact to its
 *     company on Atlas's brandId field
 *
 * Day 2 will add: listNotes, listEngagements, getNotesForContact.
 *
 * HubSpot pagination: cursor-based. Each response includes a
 * `paging.next.after` cursor that you pass back as the `after` query
 * param on the next call. When no cursor is returned, you've reached
 * the end. We surface this as `nextCursor` in the return value.
 *
 * Rate limits (Private App, free tier): 100 requests / 10 seconds.
 * The importer is bounded per-request (see endpoints) so a typical
 * import call uses 5-15 requests. No throttling logic here — the
 * caller's batch size is the limit.
 */

const HUBSPOT_BASE = "https://api.hubapi.com";

function getKey(): string | null {
  const k = process.env.HUBSPOT_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

async function hubspotFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = getKey();
  if (!key) {
    throw new Error(
      "HUBSPOT_API_KEY not set. Generate a Private App token in HubSpot → Settings → Integrations → Private Apps and add it to Vercel env.",
    );
  }
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  return fetch(`${HUBSPOT_BASE}${path}`, { ...init, headers });
}

/**
 * Whitelist of contact properties we care about. HubSpot returns only
 * what you ask for via the `properties` query param. Anything else
 * gets dropped silently — adding a property here is the only way to
 * pull it.
 */
export const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "phone",
  "mobilephone",
  "jobtitle",
  "company",
  "lifecyclestage",
  "hs_lead_status",
  "linkedin_url",
  "linkedinbio",
  "city",
  "state",
  "country",
  "createdate",
  "lastmodifieddate",
  "hs_object_id",
];

export const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "website",
  "industry",
  "country",
  "city",
  "state",
  "numberofemployees",
  "annualrevenue",
  "lifecyclestage",
  "hs_lead_status",
  "description",
  "createdate",
  "lastmodifieddate",
  "hs_object_id",
];

export type HubSpotPage<T> = {
  results: T[];
  nextCursor: string | null;
};

export async function listContacts(opts: { after?: string; limit?: number } = {}): Promise<HubSpotPage<any>> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(Math.max(opts.limit ?? 100, 1), 100)));
  if (opts.after) params.set("after", opts.after);
  for (const p of CONTACT_PROPERTIES) params.append("properties", p);
  // Pull associations to companies so we can link Contact.brandId
  // without a follow-up lookup per contact.
  params.append("associations", "companies");

  const res = await hubspotFetch(`/crm/v3/objects/contacts?${params.toString()}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HubSpot contacts list failed: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return {
    results: Array.isArray(json.results) ? json.results : [],
    nextCursor: json.paging?.next?.after || null,
  };
}

export async function listCompanies(opts: { after?: string; limit?: number } = {}): Promise<HubSpotPage<any>> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(Math.max(opts.limit ?? 100, 1), 100)));
  if (opts.after) params.set("after", opts.after);
  for (const p of COMPANY_PROPERTIES) params.append("properties", p);

  const res = await hubspotFetch(`/crm/v3/objects/companies?${params.toString()}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HubSpot companies list failed: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return {
    results: Array.isArray(json.results) ? json.results : [],
    nextCursor: json.paging?.next?.after || null,
  };
}

/**
 * Get the primary company id associated with a contact, if any.
 * Used as a fallback when the inline associations payload didn't
 * include companies (some HubSpot tiers omit it).
 */
export async function getContactPrimaryCompanyId(contactId: string): Promise<string | null> {
  const res = await hubspotFetch(
    `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/companies`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  const first = Array.isArray(json.results) ? json.results[0] : null;
  return first?.id || first?.toObjectId || null;
}

/**
 * Search endpoint variant — returns `total` count alongside the page.
 * Used by the live-preview panel so the admin can see "you have 8500
 * contacts in HubSpot, here's a sample of 5" before clicking Pull.
 *
 * The `/search` endpoint accepts a body with sorts + filterGroups
 * (we don't filter for the preview — just count + sample).
 */
async function searchObjects(
  objectType: "contacts" | "companies",
  properties: string[],
  limit = 5,
): Promise<{ total: number; results: any[] }> {
  const res = await hubspotFetch(`/crm/v3/objects/${objectType}/search`, {
    method: "POST",
    body: JSON.stringify({
      limit,
      properties,
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `HubSpot ${objectType} search failed: HTTP ${res.status} — ${txt.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  return {
    total: typeof json.total === "number" ? json.total : 0,
    results: Array.isArray(json.results) ? json.results : [],
  };
}

export function searchContactsPreview(limit = 5) {
  return searchObjects("contacts", CONTACT_PROPERTIES, limit);
}

export function searchCompaniesPreview(limit = 5) {
  return searchObjects("companies", COMPANY_PROPERTIES, limit);
}

/**
 * Smoke-test the HubSpot key with a tiny request. Returns
 * { ok: true } if the key works, or { ok: false, error: ... }.
 * Used by the admin UI to verify auth before the user kicks off a
 * full migration batch.
 */
export async function testConnection(): Promise<{ ok: boolean; error?: string; portal?: string }> {
  try {
    const res = await hubspotFetch("/crm/v3/objects/contacts?limit=1");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${res.status} — ${txt.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch failed" };
  }
}

/**
 * Map HubSpot's createdate / lastmodifieddate strings to JS Date or null.
 */
export function parseHubSpotDate(s: any): Date | null {
  if (!s) return null;
  const t = typeof s === "string" ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? new Date(t) : null;
}
