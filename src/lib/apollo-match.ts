// @ts-nocheck
/**
 * Thin Apollo People Match wrapper used by the BD Enrich flow
 * (/api/admin/bd/enrich-brand/[id]). One call per existing contact, fanned
 * out in parallel with the 4 AI research calls.
 *
 * Returns a normalised shape matching the {name, email, linkedin, title,
 * seniority, phone} fields the cross-validator compares against AI sources.
 * Keeps the Apollo-specific fields the V1 `/api/admin/outreach/enrich` route
 * saves (apolloId, emailStatus, personalEmails) so the enrich endpoint can
 * still persist them.
 */

export type ApolloMatchInput = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  apolloId?: string | null;
  brandName?: string | null;
  brandWebsite?: string | null;
};

export type ApolloMatchResult = {
  matched: boolean;
  source: "apollo";
  apolloId?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  email?: string | null;
  emailStatus?: string | null;
  personalEmails?: string[];
  linkedin?: string | null;
  phone?: string | null;
  seniority?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  companyRevenue?: string | null;
  raw?: any;
  error?: string;
};

export async function apolloPeopleMatch(
  input: ApolloMatchInput,
): Promise<ApolloMatchResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { matched: false, source: "apollo", error: "APOLLO_API_KEY not configured" };

  const body: any = { reveal_personal_emails: true };
  if (input.apolloId) {
    body.id = input.apolloId;
  } else {
    if (input.firstName) body.first_name = input.firstName;
    if (input.lastName) body.last_name = input.lastName;
    if (input.name && !input.firstName) body.name = input.name;
    if (input.email) body.email = input.email;
    if (input.linkedinUrl) body.linkedin_url = input.linkedinUrl;
    if (input.brandName) body.organization_name = input.brandName;
    if (input.brandWebsite) {
      try {
        const url = input.brandWebsite.startsWith("http")
          ? input.brandWebsite
          : `https://${input.brandWebsite}`;
        body.domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {}
    }
  }

  try {
    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.person) {
      return {
        matched: false,
        source: "apollo",
        error: json.error || json.message || `HTTP ${res.status}`,
      };
    }
    const p = json.person;
    return {
      matched: true,
      source: "apollo",
      apolloId: p.id || null,
      name: p.name || null,
      firstName: p.first_name || null,
      lastName: p.last_name || null,
      title: p.title || null,
      email: p.email && p.email_status !== "unavailable" ? p.email : null,
      emailStatus: p.email_status || null,
      personalEmails: Array.isArray(p.personal_emails) ? p.personal_emails : [],
      linkedin: p.linkedin_url || null,
      phone:
        p.phone_numbers?.[0]?.sanitized_number ||
        p.organization?.primary_phone?.sanitized_number ||
        null,
      seniority: p.seniority || null,
      city: p.city || null,
      state: p.state || null,
      country: p.country || null,
      companyRevenue: p.organization?.organization_revenue_printed || null,
      raw: p,
    };
  } catch (e: any) {
    return { matched: false, source: "apollo", error: e.message || "fetch failed" };
  }
}
