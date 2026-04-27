// @ts-nocheck
/**
 * POST /api/admin/hubspot-import/companies
 *
 * Pulls a bounded batch of HubSpot Companies → Atlas Brand rows.
 * Body: { after?: string, limit?: number = 50 }
 *
 * Match strategy (idempotency):
 *   1. existing.hubspotId === company.id → update (canonical match)
 *   2. existing.website domain === company.domain → update + stamp
 *      hubspotId so future re-runs skip step 2
 *   3. existing.name === company.name (case-insensitive, no other
 *      match found) → update + stamp hubspotId
 *   4. None match → create a new Brand in LEAD stage with hubspotId
 *      stamped
 *
 * Re-runnable safely. Returns next cursor so the UI can drive
 * "Pull next 50 → Pull next 50 → done" without leaving the page.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listCompanies, parseHubSpotDate } from "@/lib/hubspot-client";

export const maxDuration = 300;

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin / employee only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body.limit || "50", 10), 1), 100);
    const after = body.after || undefined;

    const page = await listCompanies({ limit, after });

    const stats = {
      pulled: page.results.length,
      created: 0,
      updatedById: 0,
      updatedByDomain: 0,
      updatedByName: 0,
      skippedNoName: 0,
    };
    const log: any[] = [];

    for (const c of page.results) {
      const props = c.properties || {};
      const name = (props.name || "").trim();
      if (!name) {
        stats.skippedNoName++;
        log.push({ id: c.id, status: "skipped_no_name" });
        continue;
      }

      const domain = extractDomain(props.website || props.domain || null);
      const data: any = {
        hubspotId: c.id,
        hubspotImportedAt: new Date(),
        // Don't stomp stage if the brand is already past LEAD — only
        // set the default on creation.
      };
      // Optional fields — only set when present so we don't overwrite
      // existing Atlas data with an empty HubSpot value.
      if (props.website) data.website = props.website;
      if (props.industry) data.customerType = props.industry;
      if (props.description) data.backgroundInfo = props.description;
      if (props.country || props.city || props.state) {
        data.researchData = {
          ...(data.researchData || {}),
          hubspotLocation: [props.city, props.state, props.country]
            .filter(Boolean)
            .join(", "),
        };
      }

      // 1. Match on hubspotId
      let existing = await prisma.brand.findUnique({
        where: { hubspotId: c.id },
      });
      let matchPath: "id" | "domain" | "name" | null = existing ? "id" : null;

      // 2. Match on domain
      if (!existing && domain) {
        existing = await prisma.brand.findFirst({
          where: {
            website: { contains: domain, mode: "insensitive" },
          },
        });
        if (existing) matchPath = "domain";
      }

      // 3. Match on name (case-insensitive)
      if (!existing) {
        existing = await prisma.brand.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        if (existing) matchPath = "name";
      }

      if (existing) {
        await prisma.brand.update({
          where: { id: existing.id },
          data,
        });
        if (matchPath === "id") stats.updatedById++;
        if (matchPath === "domain") stats.updatedByDomain++;
        if (matchPath === "name") stats.updatedByName++;
        log.push({
          id: c.id,
          name,
          status: `updated_by_${matchPath}`,
          atlasBrandId: existing.id,
        });
      } else {
        const created = await prisma.brand.create({
          data: {
            ...data,
            name,
            pipelineStage: "LEAD",
            // Store HubSpot raw payload so we don't lose any custom
            // properties. Populate `raw` per existing Brand convention.
            raw: { hubspot: props },
          },
        });
        stats.created++;
        log.push({
          id: c.id,
          name,
          status: "created",
          atlasBrandId: created.id,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ...stats,
      nextCursor: page.nextCursor,
      done: page.nextCursor == null,
      log,
    });
  } catch (e: any) {
    console.error("[hubspot-import.companies] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
