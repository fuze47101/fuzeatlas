// @ts-nocheck
/**
 * POST /api/admin/hubspot-import/csv-companies
 *
 * Imports a chunk of HubSpot Company rows from the CSV export.
 * The client-side parser feeds us pre-parsed rows so we can stay
 * under Vercel's 4.5MB request body cap without uploading the full
 * 15MB CSV.
 *
 * Body:
 *   {
 *     rows: Array<Record<string, string>>,   // already parsed CSV rows
 *     dryRun?: boolean,                      // classify only, don't write
 *   }
 *
 * The classifier (src/lib/hubspot-classifier.ts) splits each row into:
 *   KEEP   → Brand row created/updated, validationStatus left untouched
 *   REVIEW → Brand row created/updated, validationStatus="pending_review"
 *   EXCLUDE → row dropped, included in audit log only
 *
 * Idempotency match strategy (same as the API-based importer):
 *   1. Brand.hubspotId === row Record ID → update
 *   2. Brand.website domain matches row "Company Domain Name" → update + stamp hubspotId
 *   3. Brand.name case-insensitive equals row "Company name" → update + stamp hubspotId
 *   4. None match → create new Brand
 *
 * Returns per-batch stats so the UI can build a running progress bar.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { classifyHubSpotCompanyRow } from "@/lib/hubspot-classifier";

export const maxDuration = 300;

function extractDomain(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.trim();
  if (!cleaned) return null;
  try {
    const url = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // Domain might already be a bare hostname like "rhone.com"
    return cleaned.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0] || null;
  }
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
      keepCreated: 0,
      keepUpdatedById: 0,
      keepUpdatedByDomain: 0,
      keepUpdatedByName: 0,
      reviewCreated: 0,
      reviewUpdated: 0,
      excludedSkipped: 0,
      skippedNoName: 0,
      errors: 0,
      // Dry-run-specific stats — let the caller see what would happen
      // without writing anything. Mirrors the live counters above.
      wouldCreate: 0,
      wouldUpdateById: 0,
      wouldUpdateByDomain: 0,
      wouldUpdateByName: 0,
    };
    const log: any[] = [];

    for (const row of rows) {
      try {
        const hubspotId = (row["Record ID"] || "").trim();
        const name = (row["Company name"] || row["Company Name"] || "").trim();
        if (!name) {
          stats.skippedNoName++;
          log.push({ hubspotId, status: "skipped_no_name" });
          continue;
        }

        const classification = classifyHubSpotCompanyRow(row);

        if (classification.bucket === "EXCLUDE") {
          stats.excludedSkipped++;
          log.push({
            hubspotId,
            name,
            status: "excluded",
            reason: classification.reason,
            matchedTerm: classification.matchedTerm || null,
          });
          continue;
        }

        // Resolve domain from "Company Domain Name" or "Website URL".
        // We need this for both the dry-run dedupe check and the
        // actual import.
        const domain = extractDomain(row["Company Domain Name"] || row["Website URL"] || null);

        if (dryRun) {
          // Run the SAME 3-step match the live importer uses, but
          // don't write. This tells the admin "of these N rows,
          // X are already in Atlas (will update) and Y are net new
          // (will create)" — so they can sanity-check before
          // pulling the trigger.
          let existing = hubspotId
            ? await prisma.brand.findUnique({
                where: { hubspotId },
                select: { id: true, name: true },
              })
            : null;
          let matchPath: "id" | "domain" | "name" | null = existing ? "id" : null;

          if (!existing && domain) {
            existing = await prisma.brand.findFirst({
              where: { website: { contains: domain, mode: "insensitive" } },
              select: { id: true, name: true },
            });
            if (existing) matchPath = "domain";
          }
          if (!existing && name) {
            existing = await prisma.brand.findFirst({
              where: { name: { equals: name, mode: "insensitive" } },
              select: { id: true, name: true },
            });
            if (existing) matchPath = "name";
          }

          if (existing) {
            if (matchPath === "id") stats.wouldUpdateById++;
            else if (matchPath === "domain") stats.wouldUpdateByDomain++;
            else if (matchPath === "name") stats.wouldUpdateByName++;
            log.push({
              hubspotId,
              name,
              status: `dry_run_would_update_by_${matchPath}`,
              bucket: classification.bucket,
              reason: classification.reason,
              matchedAtlasName: existing.name,
              matchedAtlasBrandId: existing.id,
            });
          } else {
            stats.wouldCreate++;
            log.push({
              hubspotId,
              name,
              status: "dry_run_would_create",
              bucket: classification.bucket,
              reason: classification.reason,
            });
          }
          continue;
        }

        // Build Brand data — only set fields that are present so we
        // don't stomp Atlas data with empty HubSpot values.
        const data: any = {
          hubspotId: hubspotId || undefined,
          hubspotImportedAt: new Date(),
        };
        if (row["Website URL"]) data.website = row["Website URL"].trim();
        else if (row["Company Domain Name"]) data.website = row["Company Domain Name"].trim();
        if (row["Industry"]) data.customerType = row["Industry"].trim();
        if (row["Description"]) data.backgroundInfo = row["Description"].trim();
        else if (row["About Us"]) data.backgroundInfo = row["About Us"].trim();
        if (row["LinkedIn Company Page"] || row["LinkedIn Page URL"] || row["LinkedIn Bio"]) {
          data.linkedInProfile =
            (row["LinkedIn Company Page"] || row["LinkedIn Page URL"] || row["LinkedIn Bio"] || "").trim() ||
            undefined;
        }

        const locationParts = [
          row["City"],
          row["State/Region"],
          row["Country/Region"],
        ]
          .filter((s) => s && s.trim())
          .map((s) => s.trim());
        if (locationParts.length) {
          data.researchData = {
            hubspotLocation: locationParts.join(", "),
            hubspotIndustry: row["Industry"] || null,
            hubspotBusinessType: row["Business Type"] || null,
            hubspotEmployees: row["Number of Employees"] || null,
            hubspotRevenue: row["Annual Revenue"] || null,
            classification: {
              bucket: classification.bucket,
              reason: classification.reason,
              matchedTerm: classification.matchedTerm || null,
            },
          };
        } else {
          data.researchData = {
            hubspotIndustry: row["Industry"] || null,
            hubspotBusinessType: row["Business Type"] || null,
            classification: {
              bucket: classification.bucket,
              reason: classification.reason,
              matchedTerm: classification.matchedTerm || null,
            },
          };
        }

        // REVIEW bucket → mark for human review so it doesn't show up
        // in BD wizard / pipeline until a human approves.
        if (classification.bucket === "REVIEW") {
          data.validationStatus = "pending_review";
          data.validationReason = `Auto-flagged from HubSpot import: ${classification.reason}${
            classification.matchedTerm ? ` (${classification.matchedTerm})` : ""
          }`;
          data.validationDate = new Date();
        }

        // 1. Match on hubspotId
        let existing = hubspotId
          ? await prisma.brand.findUnique({ where: { hubspotId } })
          : null;
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

        // 3. Match on name
        if (!existing && name) {
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
          if (classification.bucket === "REVIEW") {
            stats.reviewUpdated++;
          } else if (matchPath === "id") {
            stats.keepUpdatedById++;
          } else if (matchPath === "domain") {
            stats.keepUpdatedByDomain++;
          } else if (matchPath === "name") {
            stats.keepUpdatedByName++;
          }
          log.push({
            hubspotId,
            name,
            status: `updated_by_${matchPath}`,
            bucket: classification.bucket,
            reason: classification.reason,
            atlasBrandId: existing.id,
          });
        } else {
          const created = await prisma.brand.create({
            data: {
              ...data,
              name,
              pipelineStage: "LEAD",
              raw: {
                hubspot_csv: {
                  recordId: hubspotId,
                  industry: row["Industry"] || null,
                  businessType: row["Business Type"] || null,
                  lifecycleStage: row["Lifecycle Stage"] || null,
                  numberOfEmployees: row["Number of Employees"] || null,
                  annualRevenue: row["Annual Revenue"] || null,
                  createDate: row["Create Date"] || null,
                  classification: {
                    bucket: classification.bucket,
                    reason: classification.reason,
                    matchedTerm: classification.matchedTerm || null,
                  },
                },
              },
            },
          });
          if (classification.bucket === "REVIEW") {
            stats.reviewCreated++;
          } else {
            stats.keepCreated++;
          }
          log.push({
            hubspotId,
            name,
            status: "created",
            bucket: classification.bucket,
            reason: classification.reason,
            atlasBrandId: created.id,
          });
        }
      } catch (rowErr: any) {
        stats.errors++;
        log.push({
          hubspotId: (row["Record ID"] || "").trim(),
          name: row["Company name"] || row["Company Name"] || null,
          status: "error",
          error: rowErr?.message || String(rowErr),
        });
      }
    }

    return NextResponse.json({ ok: true, ...stats, log });
  } catch (e: any) {
    console.error("[hubspot-import.csv-companies] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
