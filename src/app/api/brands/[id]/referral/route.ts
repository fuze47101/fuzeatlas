// @ts-nocheck
/**
 * GET /api/brands/[id]/referral — Phase 9I.
 *
 * Returns the referral source for a brand: either the upstream brand
 * (referredByBrandId) or contact (referredByContactId) that introduced
 * this customer, plus the optional note and dollar-value attribution.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: {
      referredByBrandId: true,
      referredByContactId: true,
      referralNote: true,
      referralValue: true,
    },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let source: { kind: "BRAND" | "CONTACT"; id: string; name: string } | null = null;

  if (brand.referredByBrandId) {
    const src = await prisma.brand.findUnique({
      where: { id: brand.referredByBrandId },
      select: { id: true, name: true },
    });
    if (src) source = { kind: "BRAND", id: src.id, name: src.name };
  } else if (brand.referredByContactId) {
    const src = await prisma.contact.findUnique({
      where: { id: brand.referredByContactId },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    if (src) {
      const display =
        src.name ||
        [src.firstName, src.lastName].filter(Boolean).join(" ") ||
        "Unknown contact";
      source = { kind: "CONTACT", id: src.id, name: display };
    }
  }

  return NextResponse.json({
    ok: true,
    source,
    note: brand.referralNote || null,
    value: brand.referralValue ?? null,
  });
}
