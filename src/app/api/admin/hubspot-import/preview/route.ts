// @ts-nocheck
/**
 * GET /api/admin/hubspot-import/preview
 *
 * Returns total counts + a 5-row sample of both contacts and companies
 * from HubSpot. Used by the admin UI to "look before you leap" — see
 * exactly what's in your HubSpot account before kicking off a full
 * migration. Helps catch surprises like:
 *   - "Wait, why are there 47,000 contacts?" (form-submission ghosts)
 *   - "Why are these all gmail.com addresses?" (spam imports)
 *   - "Why are companies missing domains?" (bad data hygiene)
 *
 * Costs 2 HubSpot API requests per call.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  searchContactsPreview,
  searchCompaniesPreview,
} from "@/lib/hubspot-client";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin / employee only" }, { status: 403 });
    }

    const [contactsPreview, companiesPreview] = await Promise.all([
      searchContactsPreview(5).catch((e: any) => ({
        total: 0,
        results: [],
        error: e.message,
      })),
      searchCompaniesPreview(5).catch((e: any) => ({
        total: 0,
        results: [],
        error: e.message,
      })),
    ]);

    // Strip down the preview payload — no need to ship every property
    // back, just the human-readable identifying ones.
    const trimContact = (c: any) => ({
      id: c.id,
      email: c.properties?.email || null,
      name: [c.properties?.firstname, c.properties?.lastname]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
      jobTitle: c.properties?.jobtitle || null,
      lastModified: c.properties?.lastmodifieddate || null,
    });
    const trimCompany = (c: any) => ({
      id: c.id,
      name: c.properties?.name || null,
      domain: c.properties?.domain || null,
      industry: c.properties?.industry || null,
      country: c.properties?.country || null,
      lastModified: c.properties?.lastmodifieddate || null,
    });

    return NextResponse.json({
      ok: true,
      contacts: {
        total: contactsPreview.total,
        sample: (contactsPreview.results || []).map(trimContact),
        error: (contactsPreview as any).error || null,
      },
      companies: {
        total: companiesPreview.total,
        sample: (companiesPreview.results || []).map(trimCompany),
        error: (companiesPreview as any).error || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
