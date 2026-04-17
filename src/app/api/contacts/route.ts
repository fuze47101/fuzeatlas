// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/contacts?brandId=xxx ── list contacts ────────── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");
    const factoryId = searchParams.get("factoryId");

    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (factoryId) where.factoryId = factoryId;

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, contacts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── POST /api/contacts ── create a new contact ──────────
 *
 * Accepts the FULL Contact shape including AI-enrichment fields.
 * Previously only core fields (name/email/phone/address), which meant
 * enrichment data (linkedinUrl, seniority, jobTitle, personalEmail,
 * vertical, decisionMaker, emailStatus, enrichmentSource, apolloId,
 * enrichedAt) was silently dropped on save.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      title,
      email,
      phone,
      address,
      brandId,
      factoryId,
      distributorId,
      // Enrichment
      personalEmail,
      linkedinUrl,
      jobTitle,
      seniority,
      emailStatus,
      enrichmentSource,
      apolloId,
      enrichedAt,
      vertical,
      decisionMaker,
      companyRevenue,
      outreachStatus,
      lastContactedAt,
    } = body;

    if (!firstName?.trim() && !lastName?.trim() && !email?.trim()) {
      return NextResponse.json(
        { ok: false, error: "At least a name or email is required" },
        { status: 400 },
      );
    }

    const contact = await prisma.contact.create({
      data: {
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        name: [firstName, lastName].filter(Boolean).join(" ") || null,
        title: title?.trim() || null,
        email: email?.trim()?.toLowerCase() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        // Enrichment — only set when provided, so callers that don't know
        // about these fields don't accidentally null-out existing data on
        // subsequent upserts.
        ...(personalEmail !== undefined && { personalEmail: personalEmail?.trim()?.toLowerCase() || null }),
        ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl?.trim() || null }),
        ...(jobTitle !== undefined && { jobTitle: jobTitle?.trim() || null }),
        ...(seniority !== undefined && { seniority: seniority || null }),
        ...(emailStatus !== undefined && { emailStatus: emailStatus || null }),
        ...(enrichmentSource !== undefined && { enrichmentSource: enrichmentSource || null }),
        ...(apolloId !== undefined && { apolloId: apolloId || null }),
        ...(enrichedAt !== undefined && { enrichedAt: enrichedAt ? new Date(enrichedAt) : null }),
        ...(vertical !== undefined && { vertical: vertical || null }),
        ...(decisionMaker !== undefined && { decisionMaker: !!decisionMaker }),
        ...(companyRevenue !== undefined && { companyRevenue: companyRevenue || null }),
        ...(outreachStatus !== undefined && { outreachStatus: outreachStatus || "not_contacted" }),
        ...(lastContactedAt !== undefined && { lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null }),
        brandId: brandId || null,
        factoryId: factoryId || null,
        distributorId: distributorId || null,
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
