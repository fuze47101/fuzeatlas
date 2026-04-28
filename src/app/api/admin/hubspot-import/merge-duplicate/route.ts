// @ts-nocheck
/**
 * POST /api/admin/hubspot-import/merge-duplicate
 *
 * Cleanup action for HubSpot duplicates surfaced by the audit-duplicates
 * endpoint. Merges a duplicate Brand row into a target Factory or
 * Distributor, in one atomic transaction:
 *
 *   1. Stamp the brand's hubspotId + hubspotImportedAt onto the
 *      target Factory/Distributor (so future re-runs of the importer
 *      hit hubspotId match → update, instead of re-creating the
 *      duplicate brand).
 *   2. Reassign every Contact attached to the duplicate brand —
 *      brandId cleared, factoryId or distributorId set to the
 *      target.
 *   3. Reassign every OutreachMessage / ContactOutreach / Note that
 *      belongs to the duplicate brand's contacts — they ride along
 *      with the contact since the FK is on contactId.
 *   4. Delete the duplicate brand row.
 *
 * Body: { brandId, targetKind: "factory" | "distributor", targetId }
 *
 * Returns:
 *   { ok, contactsMoved, brandDeleted, target: {kind, id, name, hubspotId} }
 *
 * Idempotent on stamping — if the target already has a different
 * hubspotId, we abort with a 409 so the admin can resolve manually
 * (could mean two different HubSpot rows both legitimately belong on
 * the same factory).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
    const { brandId, targetKind, targetId } = body;
    if (!brandId || !targetKind || !targetId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing brandId / targetKind / targetId",
        },
        { status: 400 },
      );
    }
    if (!["factory", "distributor"].includes(targetKind)) {
      return NextResponse.json(
        { ok: false, error: "targetKind must be factory or distributor" },
        { status: 400 },
      );
    }

    // Pre-flight checks outside the transaction so we can return
    // friendlier errors than a Prisma collision dump.
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        hubspotId: true,
        hubspotImportedAt: true,
        _count: { select: { contacts: true } },
      },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }
    if (!brand.hubspotImportedAt) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Refusing to merge — this brand was not imported from HubSpot. Use a separate manual cleanup if you actually want to merge it.",
        },
        { status: 400 },
      );
    }

    // We try to read hubspotId so we can detect collisions, but if
    // the schema migration hasn't run yet (Factory.hubspotId column
    // doesn't exist) we fall back to a select without it. The merge
    // still works — we just skip the stamp step at the bottom and
    // tell the admin to run `npx prisma db push` to enable stamping.
    let target: any = null;
    let schemaMigrated = true;
    try {
      target =
        targetKind === "factory"
          ? await prisma.factory.findUnique({
              where: { id: targetId },
              select: { id: true, name: true, hubspotId: true },
            })
          : await prisma.distributor.findUnique({
              where: { id: targetId },
              select: { id: true, name: true, hubspotId: true },
            });
    } catch (selErr: any) {
      if (
        /does not exist/i.test(selErr?.message || "") &&
        /hubspotId/i.test(selErr?.message || "")
      ) {
        schemaMigrated = false;
        target =
          targetKind === "factory"
            ? await prisma.factory.findUnique({
                where: { id: targetId },
                select: { id: true, name: true },
              })
            : await prisma.distributor.findUnique({
                where: { id: targetId },
                select: { id: true, name: true },
              });
        if (target) target.hubspotId = null;
      } else {
        throw selErr;
      }
    }
    if (!target) {
      return NextResponse.json(
        { ok: false, error: `Target ${targetKind} not found` },
        { status: 404 },
      );
    }

    // Refuse if target already has a different hubspotId — that's a
    // separate HubSpot row legitimately attached, and overwriting
    // would lose the link. Admin can resolve manually.
    if (
      target.hubspotId &&
      brand.hubspotId &&
      target.hubspotId !== brand.hubspotId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Target ${targetKind} already has a different hubspotId stamped (${target.hubspotId}). Resolve manually.`,
        },
        { status: 409 },
      );
    }

    // Run the cleanup as one transaction so partial-failures don't
    // leave the DB in a half-merged state.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Stamp hubspotId on the target — only if we have one to stamp,
      //    the target doesn't already have it, and the schema actually
      //    has the column. If the migration hasn't run we skip this
      //    step but still proceed with contact reassignment + brand
      //    delete (the merge is still useful, the stamp is just nice).
      if (schemaMigrated && brand.hubspotId && !target.hubspotId) {
        if (targetKind === "factory") {
          await tx.factory.update({
            where: { id: targetId },
            data: {
              hubspotId: brand.hubspotId,
              hubspotImportedAt: brand.hubspotImportedAt || new Date(),
            },
          });
        } else {
          await tx.distributor.update({
            where: { id: targetId },
            data: {
              hubspotId: brand.hubspotId,
              hubspotImportedAt: brand.hubspotImportedAt || new Date(),
            },
          });
        }
      }

      // 2. Reassign every contact from the duplicate brand → target.
      //    Clear brandId, set factoryId or distributorId.
      const contactUpdate =
        targetKind === "factory"
          ? { brandId: null, factoryId: targetId, distributorId: null }
          : { brandId: null, factoryId: null, distributorId: targetId };
      const movedContacts = await tx.contact.updateMany({
        where: { brandId },
        data: contactUpdate,
      });

      // 3. Delete the duplicate brand. Cascade-delete on related rows
      //    (notes/outreach attached directly to brand, not contact)
      //    relies on the schema's onDelete behavior. If anything is
      //    set to RESTRICT on Brand, this will throw and roll back —
      //    which is the right behavior. Admin then resolves manually.
      await tx.brand.delete({ where: { id: brandId } });

      return {
        contactsMoved: movedContacts.count,
        brandDeleted: true,
        targetStampedHubspotId: brand.hubspotId,
      };
    });

    return NextResponse.json({
      ok: true,
      brandId,
      brandName: brand.name,
      ...result,
      schemaMigrated,
      warning: schemaMigrated
        ? null
        : "Merge succeeded — contacts moved + duplicate brand deleted. " +
          "BUT hubspotId could not be stamped on the target because " +
          "the Factory.hubspotId / Distributor.hubspotId columns don't " +
          "exist in this database yet. Run `npx prisma db push` from " +
          "your local machine and re-run the audit to stamp them.",
      target: {
        kind: targetKind,
        id: target.id,
        name: target.name,
        hubspotId: brand.hubspotId || target.hubspotId,
      },
    });
  } catch (e: any) {
    console.error("[hubspot-import.merge-duplicate] error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e.message || "Merge failed",
      },
      { status: 500 },
    );
  }
}
