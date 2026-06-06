// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── PATCH /api/contacts/[id] ── update a contact ──────────
 *
 * Mirrors POST /api/contacts: accepts core + enrichment + categorization
 * fields. Only updates fields that are explicitly present in the body.
 *
 * Also supports REASSIGN-TO-NEW-BRAND (Ryan Prince #cmo8uuuj3): pass
 * `brandId` in the body and the contact moves over. Logs a Note on
 * the OLD brand recording the move so history isn't lost.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const user = await getCurrentUser();

    const data: any = {};
    // Core
    if (body.firstName !== undefined) data.firstName = body.firstName?.trim() || null;
    if (body.lastName !== undefined) data.lastName = body.lastName?.trim() || null;
    if (body.firstName !== undefined || body.lastName !== undefined) {
      data.name =
        [body.firstName ?? "", body.lastName ?? ""].filter(Boolean).join(" ") || null;
    }
    if (body.title !== undefined) data.title = body.title?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim()?.toLowerCase() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    // Enrichment
    if (body.personalEmail !== undefined) data.personalEmail = body.personalEmail?.trim()?.toLowerCase() || null;
    if (body.linkedinUrl !== undefined) data.linkedinUrl = body.linkedinUrl?.trim() || null;
    if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle?.trim() || null;
    if (body.seniority !== undefined) data.seniority = body.seniority || null;
    if (body.emailStatus !== undefined) data.emailStatus = body.emailStatus || null;
    if (body.enrichmentSource !== undefined) data.enrichmentSource = body.enrichmentSource || null;
    if (body.apolloId !== undefined) data.apolloId = body.apolloId || null;
    if (body.enrichedAt !== undefined)
      data.enrichedAt = body.enrichedAt ? new Date(body.enrichedAt) : null;
    // Categorization
    if (body.vertical !== undefined) data.vertical = body.vertical || null;
    if (body.decisionMaker !== undefined) data.decisionMaker = !!body.decisionMaker;
    if (body.companyRevenue !== undefined) data.companyRevenue = body.companyRevenue || null;
    // Outreach
    if (body.outreachStatus !== undefined) data.outreachStatus = body.outreachStatus;
    if (body.lastContactedAt !== undefined)
      data.lastContactedAt = body.lastContactedAt ? new Date(body.lastContactedAt) : null;

    // ─── Reassign to a different brand (Ryan #cmo8uuuj3) ──────
    // Distinct from a regular field update — we want to log a Note
    // on the OLD brand recording the move so history isn't lost.
    let reassignNote: { fromBrandId: string; toBrandId: string } | null = null;
    if (body.brandId !== undefined) {
      const existing = await prisma.contact.findUnique({
        where: { id },
        select: { brandId: true },
      });
      const oldBrandId = existing?.brandId || null;
      const newBrandId = body.brandId || null;
      data.brandId = newBrandId;
      if (oldBrandId && newBrandId && oldBrandId !== newBrandId) {
        reassignNote = { fromBrandId: oldBrandId, toBrandId: newBrandId };
      }
    }
    // Allow factory reassignment too while we're here.
    if (body.factoryId !== undefined) {
      data.factoryId = body.factoryId || null;
    }
    if (body.distributorId !== undefined) {
      data.distributorId = body.distributorId || null;
    }

    // FEATURE 5 (Barth 2026-06-05) — when caller sets isPrimary:true,
    // demote every other contact at the same company first so the
    // "only one primary" invariant holds.
    if (body.isPrimary === true) {
      const me = await prisma.contact.findUnique({
        where: { id },
        select: { brandId: true, factoryId: true, distributorId: true } as any,
      });
      if (me) {
        const scope: any = {};
        if ((me as any).brandId) scope.brandId = (me as any).brandId;
        else if ((me as any).factoryId) scope.factoryId = (me as any).factoryId;
        else if ((me as any).distributorId) scope.distributorId = (me as any).distributorId;
        if (Object.keys(scope).length > 0) {
          await prisma.contact.updateMany({
            where: { ...scope, id: { not: id }, isPrimary: true } as any,
            data: { isPrimary: false } as any,
          });
        }
      }
      data.isPrimary = true;
    } else if (body.isPrimary === false) {
      data.isPrimary = false;
    }

    const contact = await prisma.contact.update({ where: { id }, data });

    // Log the reassignment as a Note on the OLD brand so the audit
    // trail stays intact when the contact disappears from their
    // pipeline.
    if (reassignNote) {
      try {
        const [oldBrand, newBrand] = await Promise.all([
          prisma.brand.findUnique({
            where: { id: reassignNote.fromBrandId },
            select: { name: true },
          }),
          prisma.brand.findUnique({
            where: { id: reassignNote.toBrandId },
            select: { name: true },
          }),
        ]);
        const fromName = oldBrand?.name || "(unknown)";
        const toName = newBrand?.name || "(unknown)";
        const movedBy = user?.name || user?.email || "an admin";
        const contactLabel = contact.name || contact.email || id;
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
        // Phase 15 NEED-FB-5 — career-change framing on both ends. The
        // outreach history under the new brand keeps continuity since
        // OutreachMessage rows reference contactId, not brandId.
        await prisma.note.create({
          data: {
            brandId: reassignNote.fromBrandId,
            authorId: user?.id || null,
            noteType: "ACTIVITY",
            content: `Contact ${contactLabel} moved to ${toName} (career change / reassignment) by ${movedBy} on ${stamp}. Outreach history under this brand stays intact for the historical record.`,
          },
        });
        await prisma.note.create({
          data: {
            brandId: reassignNote.toBrandId,
            authorId: user?.id || null,
            noteType: "ACTIVITY",
            content: `Contact ${contactLabel} moved here from ${fromName} (career change / reassignment) by ${movedBy} on ${stamp}. Prior outreach history is preserved under the contact for continuity.`,
          },
        });
      } catch (e) {
        console.error("[contact.reassign] note log failed:", e);
      }
    }

    return NextResponse.json({ ok: true, contact });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── DELETE /api/contacts/[id] ── delete a contact ────────── */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
