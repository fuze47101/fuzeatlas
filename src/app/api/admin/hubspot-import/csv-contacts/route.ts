// @ts-nocheck
/**
 * POST /api/admin/hubspot-import/csv-contacts
 *
 * Imports a chunk of HubSpot Contact rows from the CSV export.
 * Mirrors the company importer (see ./csv-companies/route.ts) but
 * links each contact to a Brand via HubSpot's
 *   "Associated Company IDs (Primary)"
 * column matched against Brand.hubspotId stamped during the company
 * import.
 *
 * The CSV doesn't carry an industry tag on the contact itself, so the
 * filtering decision lives on the brand: if the brand was EXCLUDED at
 * company import time, the contact has nothing to attach to and gets
 * skipped. The orphan count is surfaced in the response so the UI can
 * tell the user "12,847 of 16,307 contacts dropped because their
 * company was filtered out".
 *
 * Body:
 *   {
 *     rows: Array<Record<string, string>>,
 *     dryRun?: boolean,
 *     allowOrphans?: boolean,   // create contact even if no brand match
 *   }
 *
 * Match strategy (idempotency):
 *   1. Contact.hubspotId === row Record ID → update
 *   2. Contact.email case-insensitive matches → update + stamp hubspotId
 *   3. None match → create new Contact
 *
 * Re-runnable safely.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPersonalEmailDomain } from "@/lib/hubspot-classifier";

export const maxDuration = 300;

/**
 * Pull the primary associated company ID. HubSpot exports it as a
 * single value or comma-separated list — we take the first.
 */
function extractPrimaryCompanyId(row: Record<string, string>): string | null {
  const raw = (row["Associated Company IDs (Primary)"] || "").trim();
  if (!raw) {
    // fallback to the non-primary variant
    const alt = (row["Associated Company IDs"] || "").trim();
    if (!alt) return null;
    return alt.split(/[,;]/)[0].trim() || null;
  }
  return raw.split(/[,;]/)[0].trim() || null;
}

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim() || null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Admin / employee only" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const rows: Array<Record<string, string>> = Array.isArray(body.rows) ? body.rows : [];
    const dryRun = !!body.dryRun;
    const allowOrphans = !!body.allowOrphans;

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No rows in body" },
        { status: 400 },
      );
    }
    if (rows.length > 500) {
      return NextResponse.json(
        {
          ok: false,
          error: `Batch too large (${rows.length} rows). Send ≤ 500 per call so the function doesn't time out.`,
        },
        { status: 400 },
      );
    }

    const stats = {
      processed: rows.length,
      created: 0,
      updatedById: 0,
      updatedByEmail: 0,
      linkedToBrand: 0,
      linkedToFactory: 0,
      linkedToDistributor: 0,
      skippedNoIdentity: 0,
      skippedOrphan: 0,
      skippedReviewBrand: 0,
      personalEmail: 0,
      errors: 0,
      // Dry-run dedupe counters
      wouldCreate: 0,
      wouldUpdateById: 0,
      wouldUpdateByEmail: 0,
    };
    const log: any[] = [];

    for (const row of rows) {
      try {
        const hubspotId = (row["Record ID"] || "").trim();
        const firstName = (row["First Name"] || "").trim() || null;
        const lastName = (row["Last Name"] || "").trim() || null;
        const email =
          ((row["Email"] || "").trim().toLowerCase() || null) as string | null;
        const fullName =
          [firstName, lastName].filter(Boolean).join(" ").trim() ||
          email ||
          null;

        // Skip ghost rows with no identity at all
        if (!email && !firstName && !lastName) {
          stats.skippedNoIdentity++;
          log.push({ hubspotId, status: "skipped_no_identity" });
          continue;
        }

        // Resolve associated company across all three entity types.
        // HubSpot's "Associated Company IDs (Primary)" points to a
        // single HubSpot company id. That company may have been
        // imported into Atlas as a Brand, a Factory, or a
        // Distributor (the company importer stamps hubspotId on
        // whichever table it landed in). We check in order:
        // Brand → Factory → Distributor.
        const associatedCompanyId = extractPrimaryCompanyId(row);
        let entity:
          | { kind: "brand"; id: string; name: string; validationStatus: string | null }
          | { kind: "factory"; id: string; name: string }
          | { kind: "distributor"; id: string; name: string }
          | null = null;
        if (associatedCompanyId) {
          const brandMatch = await prisma.brand.findUnique({
            where: { hubspotId: associatedCompanyId },
            select: { id: true, name: true, validationStatus: true },
          });
          if (brandMatch) {
            entity = { kind: "brand", ...brandMatch };
          } else {
            const factoryMatch = await prisma.factory.findUnique({
              where: { hubspotId: associatedCompanyId },
              select: { id: true, name: true },
            });
            if (factoryMatch) {
              entity = { kind: "factory", ...factoryMatch };
            } else {
              const distMatch = await prisma.distributor.findUnique({
                where: { hubspotId: associatedCompanyId },
                select: { id: true, name: true },
              });
              if (distMatch) {
                entity = { kind: "distributor", ...distMatch };
              }
            }
          }
        }

        // If no entity was matched and orphans aren't allowed, skip.
        // Most "orphan" contacts in the CSV are either: (a) form-submission
        // ghosts, (b) contacts whose company we EXCLUDED at company-import
        // time, or (c) contacts with personal gmail/yahoo addresses and
        // no company association.
        if (!entity && !allowOrphans) {
          stats.skippedOrphan++;
          log.push({
            hubspotId,
            email,
            status: "skipped_orphan",
            reason: associatedCompanyId
              ? "company_not_imported"
              : "no_associated_company",
            associatedCompanyId,
          });
          continue;
        }

        // Skip contacts whose brand is in pending review — admin should
        // approve the brand first, then re-run contact import.
        // (Factory/Distributor matches don't have a review state,
        // so they always proceed.)
        if (
          entity &&
          entity.kind === "brand" &&
          entity.validationStatus === "pending_review" &&
          !allowOrphans
        ) {
          stats.skippedReviewBrand++;
          log.push({
            hubspotId,
            email,
            status: "skipped_review_brand",
            brandName: entity.name,
            atlasBrandId: entity.id,
          });
          continue;
        }

        // Personal-email contacts (gmail/yahoo/etc) get a flag but
        // still come in if the company matched.
        const isPersonal = isPersonalEmailDomain(emailDomain(email));
        if (isPersonal) stats.personalEmail++;

        if (dryRun) {
          // Mirror the live importer's match strategy without
          // writing — gives the admin a pre-flight count of how
          // many rows would create vs. update.
          let existing = hubspotId
            ? await prisma.contact.findUnique({
                where: { hubspotId },
                select: { id: true, email: true, name: true, brandId: true },
              })
            : null;
          let matchPath: "id" | "email" | null = existing ? "id" : null;
          if (!existing && email) {
            existing = await prisma.contact.findFirst({
              where: { email: { equals: email, mode: "insensitive" } },
              select: { id: true, email: true, name: true, brandId: true },
            });
            if (existing) matchPath = "email";
          }

          if (existing) {
            if (matchPath === "id") stats.wouldUpdateById++;
            else if (matchPath === "email") stats.wouldUpdateByEmail++;
            log.push({
              hubspotId,
              email,
              name: fullName,
              status: `dry_run_would_update_by_${matchPath}`,
              entityKind: entity?.kind,
              entityName: entity?.name,
              entityId: entity?.id,
              matchedAtlasContactId: existing.id,
              matchedAtlasContactEmail: existing.email,
            });
          } else {
            stats.wouldCreate++;
            log.push({
              hubspotId,
              email,
              name: fullName,
              status: "dry_run_would_create",
              entityKind: entity?.kind,
              entityName: entity?.name,
              entityId: entity?.id,
            });
          }
          if (entity?.kind === "brand") stats.linkedToBrand++;
          else if (entity?.kind === "factory") stats.linkedToFactory++;
          else if (entity?.kind === "distributor") stats.linkedToDistributor++;
          continue;
        }

        const data: any = {
          hubspotId: hubspotId || undefined,
          hubspotImportedAt: new Date(),
          enrichmentSource: "hubspot_migration",
        };
        if (firstName) data.firstName = firstName;
        if (lastName) data.lastName = lastName;
        if (fullName) data.name = fullName;
        if (email) data.email = email;
        const phone = (row["Phone Number"] || row["Mobile Phone Number"] || "").trim();
        if (phone) data.phone = phone;
        const jobTitle = (row["Job Title"] || "").trim();
        if (jobTitle) {
          data.jobTitle = jobTitle;
          data.title = jobTitle;
        }
        const linkedin = (
          row["LinkedIn URL"] ||
          row["LinkedIn Profile"] ||
          ""
        ).trim();
        if (linkedin) data.linkedinUrl = linkedin;

        // Set whichever of brandId / factoryId / distributorId
        // applies. Contact has all three FKs so we just write the
        // one that matched. Leaves the other two undefined so we
        // don't stomp existing manual links if the matcher returned
        // a different kind on a re-run.
        if (entity?.kind === "brand") {
          data.brandId = entity.id;
          stats.linkedToBrand++;
        } else if (entity?.kind === "factory") {
          data.factoryId = entity.id;
          stats.linkedToFactory++;
        } else if (entity?.kind === "distributor") {
          data.distributorId = entity.id;
          stats.linkedToDistributor++;
        }

        // 1. Match on hubspotId
        let existing = hubspotId
          ? await prisma.contact.findUnique({ where: { hubspotId } })
          : null;
        let matchPath: "id" | "email" | null = existing ? "id" : null;

        // 2. Match on email
        if (!existing && email) {
          existing = await prisma.contact.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
          });
          if (existing) matchPath = "email";
        }

        if (existing) {
          // Preserve whichever FK is already set if we couldn't
          // resolve a new one — never null out a manual link.
          const updateData: any = { ...data };
          if (!entity) {
            delete updateData.brandId;
            delete updateData.factoryId;
            delete updateData.distributorId;
          }
          await prisma.contact.update({
            where: { id: existing.id },
            data: updateData,
          });
          if (matchPath === "id") stats.updatedById++;
          if (matchPath === "email") stats.updatedByEmail++;
          log.push({
            hubspotId,
            email,
            status: `updated_by_${matchPath}`,
            atlasContactId: existing.id,
            entityKind: entity?.kind,
            entityId: entity?.id,
          });
        } else {
          const created = await prisma.contact.create({ data });
          stats.created++;
          log.push({
            hubspotId,
            email,
            status: "created",
            atlasContactId: created.id,
            entityKind: entity?.kind,
            entityId: entity?.id,
          });
        }
      } catch (rowErr: any) {
        stats.errors++;
        log.push({
          hubspotId: (row["Record ID"] || "").trim(),
          email: row["Email"] || null,
          status: "error",
          error: rowErr?.message || String(rowErr),
        });
      }
    }

    return NextResponse.json({ ok: true, ...stats, log });
  } catch (e: any) {
    console.error("[hubspot-import.csv-contacts] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
