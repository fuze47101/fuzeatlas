// @ts-nocheck
/**
 * POST /api/admin/hubspot-import/contacts
 *
 * Pulls a bounded batch of HubSpot Contacts → Atlas Contact rows.
 * Body: { after?: string, limit?: number = 50 }
 *
 * Match strategy (idempotency):
 *   1. existing.hubspotId === contact.id → update
 *   2. existing.email === contact.email (case-insensitive) → update +
 *      stamp hubspotId for future runs
 *   3. None match → create a new Contact, link to Brand via the
 *      contact's primary HubSpot company association if we've
 *      already imported that company (matched on Brand.hubspotId)
 *
 * Brands MUST be imported before contacts so the linking step works.
 * If the contact's company hasn't been imported yet, the contact is
 * created without a brandId and the importer logs it for later
 * relinking.
 *
 * Re-runnable safely. Returns next cursor.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listContacts } from "@/lib/hubspot-client";

export const maxDuration = 300;

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

    const page = await listContacts({ limit, after });

    const stats = {
      pulled: page.results.length,
      created: 0,
      updatedById: 0,
      updatedByEmail: 0,
      linkedToBrand: 0,
      unlinked: 0,
      skipped: 0,
    };
    const log: any[] = [];

    for (const c of page.results) {
      const props = c.properties || {};
      const email = (props.email || "").trim().toLowerCase() || null;
      const firstName = props.firstname || null;
      const lastName = props.lastname || null;
      const name =
        [firstName, lastName].filter(Boolean).join(" ").trim() || email || null;

      // Skip ghost rows with no email AND no name — HubSpot accumulates
      // these from form submissions and they're useless to import.
      if (!email && !firstName && !lastName) {
        stats.skipped++;
        log.push({ id: c.id, status: "skipped_no_identity" });
        continue;
      }

      // Resolve the brand link from HubSpot's associations payload.
      let brandId: string | null = null;
      const associatedCompanyId =
        c.associations?.companies?.results?.[0]?.id ||
        c.associations?.companies?.results?.[0]?.toObjectId ||
        null;
      if (associatedCompanyId) {
        const brand = await prisma.brand.findUnique({
          where: { hubspotId: associatedCompanyId },
          select: { id: true },
        });
        if (brand) {
          brandId = brand.id;
          stats.linkedToBrand++;
        } else {
          stats.unlinked++;
        }
      } else {
        stats.unlinked++;
      }

      const data: any = {
        hubspotId: c.id,
        hubspotImportedAt: new Date(),
        enrichmentSource: "hubspot_migration",
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name: name || undefined,
        email: email || undefined,
        phone: props.phone || props.mobilephone || undefined,
        jobTitle: props.jobtitle || undefined,
        title: props.jobtitle || undefined,
        linkedinUrl: props.linkedin_url || undefined,
      };
      if (brandId) data.brandId = brandId;

      // 1. Match on hubspotId
      let existing = await prisma.contact.findUnique({
        where: { hubspotId: c.id },
      });
      let matchPath: "id" | "email" | null = existing ? "id" : null;

      // 2. Match on email
      if (!existing && email) {
        existing = await prisma.contact.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (existing) matchPath = "email";
      }

      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          // Don't stomp existing brandId if we couldn't resolve the
          // HubSpot association — better to keep the manual link than
          // null it out.
          data: brandId ? data : { ...data, brandId: undefined },
        });
        if (matchPath === "id") stats.updatedById++;
        if (matchPath === "email") stats.updatedByEmail++;
        log.push({
          id: c.id,
          email,
          status: `updated_by_${matchPath}`,
          atlasContactId: existing.id,
        });
      } else {
        const created = await prisma.contact.create({ data });
        stats.created++;
        log.push({
          id: c.id,
          email,
          status: "created",
          atlasContactId: created.id,
          brandId,
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
    console.error("[hubspot-import.contacts] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
