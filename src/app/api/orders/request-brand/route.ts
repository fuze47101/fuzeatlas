// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/orders/request-brand
 * Factory requests a new brand be added to the system.
 * Creates the brand in LEAD stage and notifies admins/AMs.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { brandName, website, contactName } = body;

    if (!brandName?.trim()) {
      return NextResponse.json({ ok: false, error: "Brand name is required" }, { status: 400 });
    }

    // Check if brand already exists (case-insensitive)
    const existing = await prisma.brand.findFirst({
      where: { name: { equals: brandName.trim(), mode: "insensitive" } },
    });

    if (existing) {
      return NextResponse.json({
        ok: false,
        error: `Brand "${existing.name}" already exists in the system. Please select it from the dropdown.`,
        existingBrandId: existing.id,
      }, { status: 409 });
    }

    // Create new brand in LEAD stage
    const brand = await prisma.brand.create({
      data: {
        name: brandName.trim(),
        pipelineStage: "LEAD",
        website: website || null,
        leadReferralSource: `Factory request from ${user.name || user.email} (${user.factory?.name || user.factoryId || "Unknown factory"})`,
        backgroundInfo: [
          `Requested by factory user: ${user.name || user.email}`,
          contactName ? `Factory contact at brand: ${contactName}` : null,
          website ? `Website: ${website}` : null,
          `Requested during order placement on ${new Date().toISOString().slice(0, 10)}`,
        ].filter(Boolean).join("\n"),
        dateOfInitialContact: new Date(),
      },
    });

    // Link factory to brand if factory exists
    if (user.factoryId) {
      try {
        await prisma.brandFactory.create({
          data: {
            brandId: brand.id,
            factoryId: user.factoryId,
          },
        });
      } catch {
        // Relation might already exist, ignore
      }
    }

    // Notify admins about new brand request
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SALES_MANAGER"] }, active: true },
        select: { id: true },
      });

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: "BRAND_REQUEST",
            title: `New Brand Request: ${brand.name}`,
            message: `Factory ${user.name || user.email} requested brand "${brand.name}" be added to the system during order placement.${contactName ? ` Contact: ${contactName}` : ""}`,
            link: `/pipeline?brand=${brand.id}`,
          },
        });
      }
    } catch (notifyErr) {
      console.error("[BRAND-REQUEST] Notification error:", notifyErr);
    }

    return NextResponse.json({
      ok: true,
      brand: { id: brand.id, name: brand.name },
      message: `Brand "${brand.name}" has been created and FUZE team has been notified. It will appear in your brand dropdown once reviewed.`,
    });
  } catch (e: any) {
    console.error("Request-brand error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to create brand request" }, { status: 500 });
  }
}
