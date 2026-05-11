/**
 * Phase 15 IMP-1 — infer the most likely Brand from a user's email
 * address. Splits at @, lowercases, looks for any Brand whose
 * website hostname matches the email domain. Returns the first
 * match (most brands have unique domains; if there's overlap, the
 * /api/brand-portal/brands?q= typeahead resolves manually).
 */
import { prisma } from "@/lib/prisma";

export function emailDomainOf(email: string): string | null {
  if (!email) return null;
  const idx = email.indexOf("@");
  if (idx < 0) return null;
  const raw = email.slice(idx + 1).trim().toLowerCase();
  // Strip plus-tag bits or whitespace just in case.
  return raw.replace(/\s+/g, "") || null;
}

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "163.com",
  "126.com",
  "aol.com",
]);

function hostnameFromWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

export async function inferBrandFromEmail(email: string): Promise<{
  brand: { id: string; name: string; website: string | null } | null;
  domain: string | null;
} | null> {
  const domain = emailDomainOf(email);
  if (!domain || PERSONAL_DOMAINS.has(domain)) {
    return { brand: null, domain };
  }
  // Cheap search — pull every brand with a non-null website, filter
  // in-memory by hostname match. Brand counts are in the hundreds at
  // most; this is fine and avoids a full LIKE scan.
  const candidates = await prisma.brand.findMany({
    where: { website: { not: null } },
    select: { id: true, name: true, website: true },
  });
  const match = candidates.find((b) => {
    const host = hostnameFromWebsite(b.website);
    if (!host) return false;
    return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
  });
  return { brand: match || null, domain };
}
