// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/distributors/[id] — single distributor detail
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const d = await prisma.distributor.findUnique({
      where: { id },
      include: {
        inventory: true,
        pricing: true,
        factories: { select: { id: true, name: true, country: true } },
        contacts: true,
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!d) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, distributor: d });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/distributors/[id] — update distributor fields
 *
 * Body: { name?, chineseName?, country?, region?, city?, address?,
 *         email?, phone?, website?, status?, active?, coverageCountries?, localCurrency?, notes? }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();

    // Whitelist updatable fields. Added the FUZE restock pricing fields
    // (#P1 distributor portal pass) so admins can set the wholesale rate
    // through the UI instead of running SQL — this was Tina's #3 blocker
    // (GS / Texwell can't restock until pricing is set).
    const allowed = [
      "name", "chineseName", "specialty", "country", "region", "city", "address",
      "email", "phone", "website", "status", "active", "coverageCountries", "localCurrency", "notes",
      "fuzeRestockPricePerLiter", "fuzeRestockCurrency", "fuzeRestockNotes",
      // Master/sub hierarchy + master→sub wholesale pricing.
      "parentDistributorId", "subDistributorPricePerLiter", "subDistributorCurrency", "subDistributorNotes",
    ];

    const data: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        // coverageCountries comes as array, store as JSON string
        if (key === "coverageCountries" && Array.isArray(body[key])) {
          data[key] = JSON.stringify(body[key]);
        } else if (
          key === "fuzeRestockPricePerLiter" ||
          key === "subDistributorPricePerLiter"
        ) {
          // Coerce empty string to null (clears the price) and parse
          // numeric input as a Float. Refuse to write a NaN or negative.
          if (body[key] === "" || body[key] === null) {
            data[key] = null;
          } else {
            const n = Number(body[key]);
            if (!Number.isFinite(n) || n < 0) {
              return NextResponse.json(
                { ok: false, error: `${key} must be a non-negative number` },
                { status: 400 },
              );
            }
            data[key] = n;
          }
        } else if (key === "parentDistributorId") {
          // Empty string clears the parent; non-empty must reference
          // a real distributor. Cycle protection: parent can't be
          // self, and parent itself must not be a sub of this dist.
          if (body[key] === "" || body[key] === null) {
            data[key] = null;
          } else {
            const candidateId = String(body[key]);
            if (candidateId === id) {
              return NextResponse.json(
                { ok: false, error: "A distributor cannot be its own parent" },
                { status: 400 },
              );
            }
            const candidate = await prisma.distributor.findUnique({
              where: { id: candidateId },
              select: { id: true, parentDistributorId: true },
            });
            if (!candidate) {
              return NextResponse.json(
                { ok: false, error: "Parent distributor not found" },
                { status: 400 },
              );
            }
            if (candidate.parentDistributorId === id) {
              return NextResponse.json(
                { ok: false, error: "Cycle detected — that distributor is already a sub of this one" },
                { status: 400 },
              );
            }
            data[key] = candidateId;
          }
        } else {
          data[key] = body[key];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.distributor.update({
      where: { id },
      data,
      select: {
        id: true, name: true, chineseName: true, country: true, region: true,
        city: true, address: true, email: true, phone: true, website: true,
        status: true, active: true, coverageCountries: true, localCurrency: true, notes: true,
        fuzeRestockPricePerLiter: true, fuzeRestockCurrency: true, fuzeRestockNotes: true,
        parentDistributorId: true, subDistributorPricePerLiter: true,
        subDistributorCurrency: true, subDistributorNotes: true,
      },
    });

    return NextResponse.json({ ok: true, distributor: updated });
  } catch (e: any) {
    console.error("Distributor update error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Update failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/distributors/[id] — deactivate (not hard delete)
 */
/**
 * DELETE /api/admin/distributors/[id]
 *
 * Default: SOFT DELETE — flips active=false + status=INACTIVE.
 *   Use this for distributors who used to be active but no longer
 *   ship (e.g. legacy chemical suppliers).
 *
 * ?hard=true: HARD DELETE — removes the row entirely.
 *   Refuses if the distributor has any attached data
 *   (contacts, factories, orders, users, projects, etc.) so you
 *   can't accidentally orphan rows. Returns 409 with a per-relation
 *   blocker list. Used for clearing out junk records that never
 *   should have existed (e.g. duplicate HubSpot imports).
 *
 * ?force=true: HARD DELETE + cascade-style cleanup of safe links.
 *   Detaches factories, projects, fabrics from the distributor
 *   (sets distributorId=null) but still refuses if there are
 *   orders, invoices, or test requests attached. Use sparingly.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "true";
    const force = url.searchParams.get("force") === "true";

    if (!hard && !force) {
      // Legacy soft-delete (deactivate)
      await prisma.distributor.update({
        where: { id },
        data: { active: false, status: "INACTIVE" },
      });
      return NextResponse.json({ ok: true, message: "Distributor deactivated" });
    }

    // Pre-flight blocker check — count every related row so the
    // admin sees exactly what's keeping the row alive.
    const dist = await prisma.distributor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            contacts: true,
            factories: true,
            projects: true,
            invoices: true,
            documents: true,
            users: true,
            fuzeOrders: true,
            testRequests: true,
            pricing: true,
            restockOrders: true,
            incomingSubOrders: true,
            fabrics: true,
            subDistributors: true,
            sourceRecords: true,
          },
        },
      },
    });
    if (!dist) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const c = dist._count;
    // Hard blockers — refuse delete even with force=true. These
    // represent real business data that would orphan or corrupt
    // if the parent goes away.
    const hardBlockers: Record<string, number> = {};
    if (c.fuzeOrders > 0) hardBlockers.fuzeOrders = c.fuzeOrders;
    if (c.invoices > 0) hardBlockers.invoices = c.invoices;
    if (c.testRequests > 0) hardBlockers.testRequests = c.testRequests;
    if (c.restockOrders > 0) hardBlockers.restockOrders = c.restockOrders;
    if (c.incomingSubOrders > 0) hardBlockers.incomingSubOrders = c.incomingSubOrders;
    if (c.subDistributors > 0) hardBlockers.subDistributors = c.subDistributors;
    if (c.users > 0) hardBlockers.users = c.users;

    // Soft blockers — refuse when hard=true (safe mode) but
    // detach when force=true.
    const softBlockers: Record<string, number> = {};
    if (c.contacts > 0) softBlockers.contacts = c.contacts;
    if (c.factories > 0) softBlockers.factories = c.factories;
    if (c.projects > 0) softBlockers.projects = c.projects;
    if (c.documents > 0) softBlockers.documents = c.documents;
    if (c.pricing > 0) softBlockers.pricing = c.pricing;
    if (c.fabrics > 0) softBlockers.fabrics = c.fabrics;
    if (c.sourceRecords > 0) softBlockers.sourceRecords = c.sourceRecords;

    if (Object.keys(hardBlockers).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `"${dist.name}" has business records attached and cannot be deleted.`,
          name: dist.name,
          hardBlockers,
          hint: "Move or close out the orders, invoices, and test requests first. Or deactivate instead (default DELETE without ?hard=true).",
        },
        { status: 409 },
      );
    }

    if (!force && Object.keys(softBlockers).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `"${dist.name}" has soft-attached records (contacts, factories, etc.). Re-send with ?force=true to detach them and proceed with the delete.`,
          name: dist.name,
          softBlockers,
          hint: "force=true detaches contacts, factories, projects, documents, pricing tiers, fabrics from this distributor (sets distributorId=null) and then deletes the row.",
        },
        { status: 409 },
      );
    }

    // Force mode — detach soft-linked rows in a transaction, then
    // delete the distributor.
    const result = await prisma.$transaction(async (tx) => {
      const counts: Record<string, number> = {};
      // Null out brandless / detachable references
      const r1 = await tx.contact.updateMany({
        where: { distributorId: id },
        data: { distributorId: null },
      });
      counts.contactsDetached = r1.count;

      const r2 = await tx.factory.updateMany({
        where: { distributorId: id },
        data: { distributorId: null, distributorTierIndex: null },
      });
      counts.factoriesDetached = r2.count;

      const r3 = await tx.project.updateMany({
        where: { distributorId: id },
        data: { distributorId: null },
      });
      counts.projectsDetached = r3.count;

      const r4 = await tx.fabric.updateMany({
        where: { distributorId: id },
        data: { distributorId: null },
      });
      counts.fabricsDetached = r4.count;

      // Delete tightly-owned rows (pricing, documents, sourceRecords)
      const r5 = await tx.distributorPricing.deleteMany({
        where: { distributorId: id },
      });
      counts.pricingDeleted = r5.count;

      try {
        const r6 = await tx.distributorDocument.deleteMany({
          where: { distributorId: id },
        });
        counts.documentsDeleted = r6.count;
      } catch {}

      try {
        const r7 = await tx.sourceRecord.deleteMany({
          where: { distributorId: id },
        });
        counts.sourceRecordsDeleted = r7.count;
      } catch {}

      // Delete inventory + the distributor itself
      try {
        await tx.distributorInventory.deleteMany({ where: { distributorId: id } });
      } catch {}

      await tx.distributor.delete({ where: { id } });
      return counts;
    });

    return NextResponse.json({
      ok: true,
      message: `Deleted "${dist.name}" + detached related rows`,
      detail: result,
    });
  } catch (e: any) {
    console.error("Distributor DELETE error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Delete failed" },
      { status: 500 },
    );
  }
}
