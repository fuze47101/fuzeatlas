// @ts-nocheck
/**
 * POST /api/admin/brand-duplicates/merge
 *
 * Merges a duplicate Brand row into a canonical Brand row in one
 * atomic transaction:
 *
 *   1. Re-point every brandId FK from duplicate → canonical:
 *      - Contact, OutreachMessage, Note, ContactOutreach
 *      - Fabric, FabricSubmission, Project, Product
 *      - SOW, Invoice, TestRequest, SampleTrialRequest
 *      - FuzeOrder, FuzeConsumption, BDSequence, Meeting
 *      - User (BrandUsers), CrmTask, BrandFactory (handle uniqueness)
 *
 *   2. Copy missing scalar fields from duplicate → canonical
 *      (only fields that are null on canonical AND non-null on
 *      duplicate so we never overwrite real data).
 *
 *   3. Hard-delete the duplicate row.
 *
 * Body: { keepBrandId, mergeBrandId }
 *
 * Returns:
 *   {
 *     ok: true,
 *     keepBrandId,
 *     mergedBrandId,
 *     keepBrandName,
 *     mergedBrandName,
 *     reassignments: { contacts, notes, projects, submissions,
 *                      fabrics, fuzeOrders, sows, invoices,
 *                      testRequests, sampleTrials,
 *                      brandFactories, users, ... },
 *     fieldsCopied: string[],
 *     duplicateBrandFactoryConflicts: number,
 *   }
 *
 * If anything throws inside the transaction it rolls back fully —
 * partial merges leave bad data.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Admin / employee only" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { keepBrandId, mergeBrandId } = body;
    if (!keepBrandId || !mergeBrandId) {
      return NextResponse.json(
        { ok: false, error: "Missing keepBrandId or mergeBrandId" },
        { status: 400 },
      );
    }
    if (keepBrandId === mergeBrandId) {
      return NextResponse.json(
        { ok: false, error: "keep and merge brand must be different" },
        { status: 400 },
      );
    }

    // Pull both brands so we can validate + copy scalar fields
    const [keep, merge] = await Promise.all([
      prisma.brand.findUnique({ where: { id: keepBrandId } }),
      prisma.brand.findUnique({ where: { id: mergeBrandId } }),
    ]);
    if (!keep) {
      return NextResponse.json({ ok: false, error: "keep brand not found" }, { status: 404 });
    }
    if (!merge) {
      return NextResponse.json({ ok: false, error: "merge brand not found" }, { status: 404 });
    }

    // Compute scalar field overlay — copy any field that's set on
    // merge but null on keep. Don't touch fields already set on keep.
    const COPYABLE_SCALARS = [
      "knackId",
      "hubspotId",
      "hubspotImportedAt",
      "customerType",
      "leadReferralSource",
      "dateOfInitialContact",
      "website",
      "linkedInProfile",
      "backgroundInfo",
      "researchData",
      "researchDate",
      "projectType",
      "projectDescription",
      "presentationDate",
      "forecast",
      "deliverables",
      "validationStatus",
      "validationReason",
      "validationDate",
      "fuzeRelevance",
      "textileCategory",
      "companyStatus",
      "validationData",
      "salesRepId",
      "lastActivityAt",
    ];
    const overlay: any = {};
    const fieldsCopied: string[] = [];
    for (const f of COPYABLE_SCALARS) {
      const keepVal = (keep as any)[f];
      const mergeVal = (merge as any)[f];
      const keepEmpty = keepVal === null || keepVal === undefined || keepVal === "";
      const mergeFilled = mergeVal !== null && mergeVal !== undefined && mergeVal !== "";
      if (keepEmpty && mergeFilled) {
        overlay[f] = mergeVal;
        fieldsCopied.push(f);
      }
    }

    // Some FKs have unique-constraints that could collide if both
    // brands are in the same junction. We handle BrandFactory and
    // OrderBrandAllocation explicitly. Other tables we just
    // updateMany.
    const result = await prisma.$transaction(
      async (tx) => {
        const counts: Record<string, number> = {};
        let lastModel: string = "<init>";

        // Helper: re-point any brandId FK. Wrapped to surface which
        // model was being processed when something throws.
        async function repoint(model: keyof typeof tx, label: string) {
          lastModel = label;
          try {
            // @ts-expect-error — dynamic model access
            const r = await tx[model].updateMany({
              where: { brandId: mergeBrandId },
              data: { brandId: keepBrandId },
            });
            counts[label] = r.count;
          } catch (e: any) {
            throw new Error(
              `Failed to repoint ${label} (${String(model)}): ${e?.message || e}`,
            );
          }
        }

        /**
         * Safer repoint for tables with a unique constraint that
         * includes brandId — Project @@unique([name, brandId]),
         * Product @@unique([brandId, name]), BDSequence
         * @@unique([brandId, contactId, repId, status]). A naive
         * updateMany would fail the whole transaction the moment
         * both keep + merge brands have a row that would collapse
         * into the same composite key. Walk per-row, detect the
         * collision via findFirst, and delete the duplicate from
         * the merge side rather than moving it.
         */
        async function repointWithUniqueConflicts(
          model: keyof typeof tx,
          label: string,
          uniqueFields: string[],
        ) {
          lastModel = label;
          let conflicts = 0;
          let moved = 0;
          try {
            const select: any = { id: true };
            for (const f of uniqueFields) select[f] = true;
            // @ts-expect-error — dynamic model access
            const mergeRows = await tx[model].findMany({
              where: { brandId: mergeBrandId },
              select,
            });
            for (const row of mergeRows) {
              const where: any = { brandId: keepBrandId };
              for (const f of uniqueFields) where[f] = (row as any)[f];
              // @ts-expect-error
              const existing = await tx[model].findFirst({
                where,
                select: { id: true },
              });
              if (existing) {
                // @ts-expect-error
                await tx[model].delete({ where: { id: row.id } });
                conflicts++;
              } else {
                // @ts-expect-error
                await tx[model].update({
                  where: { id: row.id },
                  data: { brandId: keepBrandId },
                });
                moved++;
              }
            }
            counts[label] = moved;
            if (conflicts > 0) counts[`${label}Conflicts`] = conflicts;
          } catch (e: any) {
            throw new Error(
              `Failed to repoint ${label} (${String(model)}): ${e?.message || e}`,
            );
          }
        }

        await repoint("contact", "contacts");
        // OutreachMessage + ContactOutreach DO NOT have a direct brandId
        // column — they're linked to Brand transitively through
        // contactId → Contact.brandId. When contacts move (above),
        // every outreach row attached to those contacts implicitly
        // moves with them. Listing them in the repoint pass would
        // throw "Unknown argument brandId" because those columns don't
        // exist on those tables.
        await repoint("note", "notes");
        await repoint("fabric", "fabrics");
        await repoint("fabricSubmission", "submissions");
        // Project @@unique([name, brandId]) — collisions when both
        // brands have a project with the same name
        await repointWithUniqueConflicts("project", "projects", ["name"]);
        // Product @@unique([brandId, name]) — same collision risk
        await repointWithUniqueConflicts("product", "products", ["name"]);
        await repoint("sOW", "sows");
        await repoint("invoice", "invoices");
        await repoint("testRequest", "testRequests");
        await repoint("sampleTrialRequest", "sampleTrials");
        await repoint("fuzeOrder", "fuzeOrders");
        await repoint("fuzeConsumption", "fuzeConsumptions");
        // BDSequence @@unique([brandId, contactId, repId, status]) —
        // collisions when both brands have a sequence to the same
        // contact / rep / status combination
        await repointWithUniqueConflicts("bDSequence", "bdSequences", [
          "contactId",
          "repId",
          "status",
        ]);
        await repoint("meeting", "meetings");
        await repoint("user", "users");
        // FabricReportShare has brandId without a Prisma `brand`
        // relation, so no FK enforced — but we still re-point so
        // the dangling reference doesn't survive the merge.
        try {
          // @ts-expect-error — model may not exist depending on schema
          const r = await tx.fabricReportShare.updateMany({
            where: { brandId: mergeBrandId },
            data: { brandId: keepBrandId },
          });
          counts["fabricReportShares"] = r.count;
        } catch {
          // Skip silently if the model isn't in the client
        }
        // CrmTask uses relation name "BrandCrmTasks" but field is brandId
        try {
          // @ts-expect-error — model may not exist depending on schema variant
          const r = await tx.crmTask.updateMany({
            where: { brandId: mergeBrandId },
            data: { brandId: keepBrandId },
          });
          counts["crmTasks"] = r.count;
        } catch {
          // Schema may not have CrmTask — skip silently
        }

        // OrderBrandAllocation — junction table with @@unique([orderId, brandId]).
        // If both keep and merge brands are allocated to the same order,
        // the move would collide. Walk per-row, delete the merge-side
        // duplicate when a keep-side allocation already exists, else
        // re-point. brandId here is REQUIRED so we can't null it.
        lastModel = "orderBrandAllocations";
        try {
          const mergeAllocs = await tx.orderBrandAllocation.findMany({
            where: { brandId: mergeBrandId },
            select: { id: true, orderId: true },
          });
          let allocConflicts = 0;
          let allocMoved = 0;
          for (const alloc of mergeAllocs) {
            const existing = await tx.orderBrandAllocation.findFirst({
              where: { brandId: keepBrandId, orderId: alloc.orderId },
              select: { id: true },
            });
            if (existing) {
              await tx.orderBrandAllocation.delete({ where: { id: alloc.id } });
              allocConflicts++;
            } else {
              await tx.orderBrandAllocation.update({
                where: { id: alloc.id },
                data: { brandId: keepBrandId },
              });
              allocMoved++;
            }
          }
          counts["orderBrandAllocations"] = allocMoved;
          if (allocConflicts > 0) {
            counts["orderBrandAllocationConflicts"] = allocConflicts;
          }
        } catch (e: any) {
          // If the model doesn't exist in the schema we silently skip.
          // If something else went wrong, surface it with context.
          if (!/Cannot read|Unknown arg|does not exist/i.test(e?.message || "")) {
            throw new Error(
              `Failed to repoint orderBrandAllocations: ${e?.message || e}`,
            );
          }
        }

        // BrandFactory has @@unique([brandId, factoryId]) — if both
        // keep and merge link to the same factory, the move would
        // collide. Detect collisions and delete the duplicates from
        // merge side, then move the rest.
        const mergeFactoryLinks = await tx.brandFactory.findMany({
          where: { brandId: mergeBrandId },
          select: { id: true, factoryId: true },
        });
        let conflicts = 0;
        let movedFactoryLinks = 0;
        for (const link of mergeFactoryLinks) {
          const existing = await tx.brandFactory.findFirst({
            where: { brandId: keepBrandId, factoryId: link.factoryId },
            select: { id: true },
          });
          if (existing) {
            // Already linked from keep side — delete the merge-side
            // duplicate to avoid the unique constraint violation.
            await tx.brandFactory.delete({ where: { id: link.id } });
            conflicts++;
          } else {
            await tx.brandFactory.update({
              where: { id: link.id },
              data: { brandId: keepBrandId },
            });
            movedFactoryLinks++;
          }
        }
        counts["brandFactories"] = movedFactoryLinks;

        // BrandEngagement has brandId @unique (1:1). If both have
        // engagements, prefer keep's existing one and delete merge's.
        try {
          // @ts-expect-error — model may not exist
          const mergeEng = await tx.brandEngagement.findUnique({
            where: { brandId: mergeBrandId },
            select: { id: true },
          });
          if (mergeEng) {
            // @ts-expect-error
            const keepEng = await tx.brandEngagement.findUnique({
              where: { brandId: keepBrandId },
              select: { id: true },
            });
            if (keepEng) {
              // @ts-expect-error
              await tx.brandEngagement.delete({ where: { id: mergeEng.id } });
              counts["brandEngagementsDeleted"] = 1;
            } else {
              // @ts-expect-error
              await tx.brandEngagement.update({
                where: { id: mergeEng.id },
                data: { brandId: keepBrandId },
              });
              counts["brandEngagementsMoved"] = 1;
            }
          }
        } catch {
          // Engagement model may not exist — skip
        }

        // Apply scalar overlay (must NOT include name — name is unique
        // and we're keeping the canonical name).
        if (Object.keys(overlay).length > 0) {
          await tx.brand.update({
            where: { id: keepBrandId },
            data: overlay,
          });
        }

        // Finally, delete the duplicate brand. With every FK now
        // re-pointed away from it, the delete should succeed cleanly.
        // If something is still pointing at it (table we forgot to
        // re-point), Prisma throws and the whole transaction rolls
        // back.
        await tx.brand.delete({ where: { id: mergeBrandId } });

        return { counts, conflicts, lastModel };
      },
      { timeout: 60_000 }, // 60s — brand with hundreds of contacts is fine
    );

    return NextResponse.json({
      ok: true,
      keepBrandId,
      mergedBrandId: mergeBrandId,
      keepBrandName: keep.name,
      mergedBrandName: merge.name,
      reassignments: result.counts,
      fieldsCopied,
      duplicateBrandFactoryConflicts: result.conflicts,
    });
  } catch (e: any) {
    console.error("[brand-duplicates.merge] error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Merge failed" },
      { status: 500 },
    );
  }
}
