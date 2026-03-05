// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole, hashPassword } from "@/lib/auth";

/* ── PUT /api/access-requests/[id] ── ADMIN: approve or deny ── */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reviewNote, deniedReason, brandId, sowId } = body;

    const request = await prisma.accessRequest.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: "This request has already been processed" }, { status: 400 });
    }

    if (action === "approve") {
      // Generate a temporary password
      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);

      // Find or create the brand
      let targetBrandId = brandId;
      if (!targetBrandId) {
        // Try to find existing brand by company name
        const existingBrand = await prisma.brand.findUnique({
          where: { name: request.company },
        });
        if (existingBrand) {
          targetBrandId = existingBrand.id;
        } else {
          // Create new brand
          const newBrand = await prisma.brand.create({
            data: {
              name: request.company,
              website: request.website,
              customerType: request.annualVolume || "Unknown",
              backgroundInfo: [
                request.fabricTypes ? `Fabric interests: ${request.fabricTypes}` : null,
                request.currentAntimicrobial ? `Current antimicrobial: ${request.currentAntimicrobial}` : null,
                request.notes || null,
              ].filter(Boolean).join(". "),
              dateOfInitialContact: request.createdAt,
            },
          });
          targetBrandId = newBrand.id;
        }
      }

      // Create the user account
      const newUser = await prisma.user.create({
        data: {
          name: `${request.firstName} ${request.lastName}`,
          email: request.email,
          password: hashedPassword,
          role: "BRAND_USER",
          status: "ACTIVE",
          brandId: targetBrandId,
        },
      });

      // Create a contact record for this person
      await prisma.contact.create({
        data: {
          firstName: request.firstName,
          lastName: request.lastName,
          name: `${request.firstName} ${request.lastName}`,
          email: request.email,
          phone: request.phone,
          title: request.jobTitle,
          brandId: targetBrandId,
        },
      });

      // Update the access request
      await prisma.accessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
          userId: newUser.id,
          sowId: sowId || null,
        },
      });

      return NextResponse.json({
        ok: true,
        action: "approved",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          tempPassword,
        },
        brand: { id: targetBrandId, name: request.company },
        message: `Account created for ${request.firstName} ${request.lastName}. Temporary password: ${tempPassword}`,
      });

    } else if (action === "deny") {
      await prisma.accessRequest.update({
        where: { id },
        data: {
          status: "DENIED",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
          deniedReason: deniedReason || "Request not approved at this time.",
        },
      });

      return NextResponse.json({
        ok: true,
        action: "denied",
        message: `Access request from ${request.firstName} ${request.lastName} has been denied.`,
      });
    } else {
      return NextResponse.json({ ok: false, error: "Invalid action. Use 'approve' or 'deny'." }, { status: 400 });
    }
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A user with this email already exists" }, { status: 409 });
    }
    console.error("Access request review error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const specials = "!@#$&";
  let pw = "";
  for (let i = 0; i < 10; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  // Insert a special char and a number at random positions
  const pos = Math.floor(Math.random() * pw.length);
  pw = pw.slice(0, pos) + specials[Math.floor(Math.random() * specials.length)] + pw.slice(pos);
  return pw;
}
