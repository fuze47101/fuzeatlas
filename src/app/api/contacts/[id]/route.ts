// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── PATCH /api/contacts/[id] ── update a contact ──────────
 *
 * Mirrors POST /api/contacts: accepts core + enrichment + categorization
 * fields. Only updates fields that are explicitly present in the body.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

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

    const contact = await prisma.contact.update({ where: { id }, data });
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
