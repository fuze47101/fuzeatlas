// @ts-nocheck
/**
 * POST /api/brand-portal/request-workspace — Phase 15 IMP-1.
 *
 * Body: { suggestedBrandName, suggestedDomain? }
 * Creates a BrandWorkspaceRequest + fans notifyNewAccessRequest to
 * admins so they can resolve from /settings/access-requests.
 *
 * If the caller already has a pending workspace request, this is a
 * no-op (returns the existing row).
 *
 * Also: claim-existing-brand path — POST { existingBrandId } sets
 * User.brandId directly when the caller picks an inferred or
 * searched brand. Admin doesn't need to approve that case; the
 * email-domain match is the trust signal.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyNewAccessRequest } from "@/lib/notify";
import { emailDomainOf, inferBrandFromEmail } from "@/lib/brand-inference";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad body" }, { status: 400 });

  // ── Claim path: user picked an existing brand we already know about.
  //    Allowed only when the email domain matches the brand's website.
  if (body.existingBrandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: String(body.existingBrandId) },
      select: { id: true, name: true, website: true },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }
    // Verify domain match — never trust client-side claims.
    const inferred = await inferBrandFromEmail(user.email || "");
    const isInferred = inferred?.brand?.id === brand.id;
    if (!isInferred) {
      // No domain match. Don't auto-claim; open a workspace request
      // referencing this brand so admin can confirm.
      const existingReq = await prisma.brandWorkspaceRequest.findFirst({
        where: { requestedByUserId: user.id, status: "PENDING" },
      });
      if (existingReq) {
        return NextResponse.json({ ok: true, mode: "request", request: existingReq });
      }
      const row = await prisma.brandWorkspaceRequest.create({
        data: {
          requestedByUserId: user.id,
          suggestedBrandName: brand.name,
          suggestedDomain: emailDomainOf(user.email || ""),
        },
      });
      await notifyNewAccessRequest({
        requestId: row.id,
        name: user.name || user.email || "Unknown",
        company: brand.name,
        type: "BRAND",
      });
      return NextResponse.json({ ok: true, mode: "request", request: row });
    }
    // Domain matched — auto-claim.
    await prisma.user.update({
      where: { id: user.id },
      data: { brandId: brand.id },
    });
    return NextResponse.json({ ok: true, mode: "claimed", brandId: brand.id });
  }

  // ── Workspace-request path: user types a new brand name.
  const suggestedBrandName = String(body.suggestedBrandName || "").trim();
  if (!suggestedBrandName) {
    return NextResponse.json(
      { ok: false, error: "suggestedBrandName required" },
      { status: 400 },
    );
  }
  // Dedupe — one open request per user.
  const existing = await prisma.brandWorkspaceRequest.findFirst({
    where: { requestedByUserId: user.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ ok: true, mode: "request", request: existing });
  }
  const row = await prisma.brandWorkspaceRequest.create({
    data: {
      requestedByUserId: user.id,
      suggestedBrandName,
      suggestedDomain: body.suggestedDomain || emailDomainOf(user.email || ""),
    },
  });
  await notifyNewAccessRequest({
    requestId: row.id,
    name: user.name || user.email || "Unknown",
    company: suggestedBrandName,
    type: "BRAND",
  });
  return NextResponse.json({ ok: true, mode: "request", request: row });
}
