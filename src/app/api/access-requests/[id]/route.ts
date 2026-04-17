// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole, hashPassword } from "@/lib/auth";
import { sendAccessApprovedEmail, sendAccessDeniedEmail } from "@/lib/email";
import { pushAccessRequest } from "@/lib/notify-realtime";

/* ── PUT /api/access-requests/[id] ── ADMIN: approve or deny ── */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reviewNote, deniedReason, brandId, sowId, overrideType } = body;
    // Admin may edit the company name at approval time — e.g. requester
    // submitted "BV" but admin wants to save as "BV Xiaoxing" (city added),
    // or "Buerau Veritas" → "Bureau Veritas" (typo fix). Falls back to the
    // original request.company when omitted.
    const editedCompanyName: string | undefined =
      typeof body.companyName === "string" && body.companyName.trim()
        ? body.companyName.trim()
        : undefined;

    const request = await prisma.accessRequest.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "This request has already been processed" },
        { status: 400 },
      );
    }

    // Resolve the canonical company name used throughout the flow (creating
    // the new entity, writing the contact record, email subject line).
    const canonicalCompanyName = editedCompanyName || request.company;

    // Persist the admin's edited company name back to the AccessRequest row
    // so the audit trail reflects what was actually created.
    if (editedCompanyName && editedCompanyName !== request.company) {
      try {
        await prisma.accessRequest.update({
          where: { id },
          data: { company: editedCompanyName },
        });
      } catch {}
    }

    // Admin may override the entity type if the signer picked the wrong one
    // on the public form (e.g. a brand accidentally submitted as a lab).
    // Persist the correction back to the AccessRequest row for the audit trail.
    const effectiveType = overrideType || request.requestType;
    if (overrideType && overrideType !== request.requestType) {
      try {
        await prisma.accessRequest.update({
          where: { id },
          data: { requestType: overrideType },
        });
      } catch {}
    }

    if (action === "approve") {
      // Generate a temporary password
      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);

      // Admin may override the user role — e.g. if a new sales rep submitted
      // the brand signup form by mistake, admin can flag them as SALES_REP
      // and we'll create them as internal without creating a bogus brand.
      const assignedRole: string =
        body.role ||
        (effectiveType === "FACTORY"
          ? "FACTORY_USER"
          : effectiveType === "LAB"
            ? "LAB_USER"
            : effectiveType === "DISTRIBUTOR"
              ? "DISTRIBUTOR_USER"
              : "BRAND_USER");
      const INTERNAL_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"];
      const isInternal = INTERNAL_ROLES.includes(assignedRole);

      // ──── INTERNAL ROLE APPROVAL (no company linking) ────
      // If admin flagged them as internal, create a user with that role
      // and no brand/factory/lab/distributor assignment. This prevents
      // a new sales rep's brand-form mistake from creating a junk Brand row.
      if (isInternal) {
        const newUser = await prisma.user.create({
          data: {
            name: `${request.firstName} ${request.lastName}`,
            email: request.email,
            password: hashedPassword,
            role: assignedRole as any,
            status: "ACTIVE",
            mustChangePassword: true,
          },
        });
        await prisma.accessRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNote: reviewNote || null,
            userId: newUser.id,
          },
        });
        await sendAccessApprovedEmail({
          email: request.email,
          name: `${request.firstName} ${request.lastName}`,
          tempPassword,
          companyName: request.company,
          accountType: "internal",
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
          message: `Internal account created for ${request.firstName} ${request.lastName} as ${assignedRole}. Temp password: ${tempPassword}`,
        });
      }

      // Gate creating a new entity behind an explicit admin flag — prevents
      // junk companies landing in the DB when a sales rep or anyone else
      // signs up but doesn't match an existing brand/factory/lab/distributor.
      const allowCreateNewEntity = body.createNewEntity === true;

      if (effectiveType === "FACTORY") {
        // ──── FACTORY REQUEST APPROVAL ────
        let targetFactoryId = body.factoryId;
        if (!targetFactoryId) {
          // Try to find existing factory by name (match on canonical edited
          // name if admin changed it, otherwise the raw submitted name)
          const existingFactory = await prisma.factory.findFirst({
            where: { name: canonicalCompanyName },
          });
          if (existingFactory) {
            targetFactoryId = existingFactory.id;
          } else if (!allowCreateNewEntity) {
            return NextResponse.json(
              {
                ok: false,
                error: `No factory named "${canonicalCompanyName}" found. Either link an existing factory or explicitly confirm creating a new factory.`,
              },
              { status: 400 },
            );
          } else {
            // Create new factory using admin-edited canonical name
            const newFactory = await prisma.factory.create({
              data: {
                name: canonicalCompanyName,
                website: request.website,
                country: request.factoryLocation?.split("/")[0]?.trim() || null,
                city: request.factoryLocation?.split("/")[1]?.trim() || null,
                capabilities: request.capabilities,
                certifications: request.certifications,
                productTypes: request.productTypes,
                fuzeApplications: request.fuzeApplicationMethod,
                description: request.notes,
              },
            });
            targetFactoryId = newFactory.id;
          }
        }

        // Create the factory user account
        const newUser = await prisma.user.create({
          data: {
            name: `${request.firstName} ${request.lastName}`,
            email: request.email,
            password: hashedPassword,
            role: "FACTORY_USER",
            status: "ACTIVE",
            factoryId: targetFactoryId,
            mustChangePassword: true,
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
            factoryId: targetFactoryId,
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
            factoryId: targetFactoryId,
            sowId: sowId || null,
          },
        });

        // Send approval email with credentials
        await sendAccessApprovedEmail({
          email: request.email,
          name: `${request.firstName} ${request.lastName}`,
          tempPassword,
          companyName: canonicalCompanyName,
          accountType: "factory",
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
          factory: { id: targetFactoryId, name: canonicalCompanyName },
          message: `Factory account created for ${request.firstName} ${request.lastName}. Temporary password: ${tempPassword}`,
        });
      } else if (effectiveType === "LAB") {
        // ──── LAB REQUEST APPROVAL ────
        let targetLabId = body.labId;
        if (!targetLabId && !allowCreateNewEntity) {
          const existingLab = await prisma.lab.findFirst({
            where: { name: canonicalCompanyName },
          });
          if (existingLab) {
            targetLabId = existingLab.id;
          } else {
            return NextResponse.json(
              {
                ok: false,
                error: `No lab named "${canonicalCompanyName}" found. Either link an existing lab or explicitly confirm creating a new one.`,
              },
              { status: 400 },
            );
          }
        }
        if (!targetLabId) {
          // Try to find existing lab by canonical company name
          const existingLab = await prisma.lab.findFirst({
            where: { name: { equals: canonicalCompanyName, mode: "insensitive" } },
          });
          if (existingLab) {
            targetLabId = existingLab.id;
          } else {
            // Create new lab using admin-edited canonical name
            const newLab = await prisma.lab.create({
              data: {
                name: canonicalCompanyName,
                website: request.website,
                email: request.email,
                notes: request.notes,
                active: true,
              },
            });
            targetLabId = newLab.id;
          }
        }

        // Create the lab user account
        const newUser = await prisma.user.create({
          data: {
            name: `${request.firstName} ${request.lastName}`,
            email: request.email,
            password: hashedPassword,
            role: "LAB_USER",
            status: "ACTIVE",
            labId: targetLabId,
            mustChangePassword: true,
          },
        });

        // Create a contact record
        await prisma.contact.create({
          data: {
            firstName: request.firstName,
            lastName: request.lastName,
            name: `${request.firstName} ${request.lastName}`,
            email: request.email,
            phone: request.phone,
            title: request.jobTitle,
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
          },
        });

        // Send approval email
        await sendAccessApprovedEmail({
          email: request.email,
          name: `${request.firstName} ${request.lastName}`,
          tempPassword,
          companyName: canonicalCompanyName,
          accountType: "lab",
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
          lab: { id: targetLabId, name: canonicalCompanyName },
          message: `Lab account created for ${request.firstName} ${request.lastName}. Temporary password: ${tempPassword}`,
        });
      } else if (effectiveType === "DISTRIBUTOR") {
        // ──── DISTRIBUTOR REQUEST APPROVAL ────
        let targetDistributorId = body.distributorId;
        if (!targetDistributorId) {
          const existingDistributor = await prisma.distributor.findFirst({
            where: { name: canonicalCompanyName, active: true },
          });
          if (existingDistributor) {
            targetDistributorId = existingDistributor.id;
          } else {
            return NextResponse.json(
              {
                ok: false,
                error: `No distributor named "${canonicalCompanyName}" found. Distributors must be set up first in Admin → Distributor Network before approving a distributor user.`,
              },
              { status: 400 },
            );
          }
        }
        const newUser = await prisma.user.create({
          data: {
            name: `${request.firstName} ${request.lastName}`,
            email: request.email,
            password: hashedPassword,
            role: "DISTRIBUTOR_USER",
            status: "ACTIVE",
            distributorId: targetDistributorId,
            mustChangePassword: true,
          },
        });
        await prisma.accessRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNote: reviewNote || null,
            userId: newUser.id,
          },
        });
        await sendAccessApprovedEmail({
          email: request.email,
          name: `${request.firstName} ${request.lastName}`,
          tempPassword,
          companyName: canonicalCompanyName,
          accountType: "distributor",
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
          distributor: { id: targetDistributorId, name: canonicalCompanyName },
          message: `Distributor account created for ${request.firstName} ${request.lastName}. Temp password: ${tempPassword}`,
        });
      } else {
        // ──── BRAND REQUEST APPROVAL ────
        let targetBrandId = brandId;
        if (!targetBrandId) {
          // Try to find existing brand by canonical company name
          const existingBrand = await prisma.brand.findFirst({
            where: { name: canonicalCompanyName },
          });
          if (existingBrand) {
            targetBrandId = existingBrand.id;
          } else if (!allowCreateNewEntity) {
            return NextResponse.json(
              {
                ok: false,
                error: `No brand named "${canonicalCompanyName}" found. Either link an existing brand or explicitly confirm creating a new brand. (If this person is a sales rep or employee, change their role to SALES_REP/EMPLOYEE instead — that won't create a brand.)`,
              },
              { status: 400 },
            );
          } else {
            // Create new brand using admin-edited canonical name
            const newBrand = await prisma.brand.create({
              data: {
                name: canonicalCompanyName,
                website: request.website,
                customerType: request.annualVolume || "Unknown",
                backgroundInfo: [
                  request.fabricTypes ? `Fabric interests: ${request.fabricTypes}` : null,
                  request.currentAntimicrobial
                    ? `Current antimicrobial: ${request.currentAntimicrobial}`
                    : null,
                  request.notes || null,
                ]
                  .filter(Boolean)
                  .join(". "),
                dateOfInitialContact: request.createdAt,
              },
            });
            targetBrandId = newBrand.id;
          }
        }

        // Create the brand user account
        const newUser = await prisma.user.create({
          data: {
            name: `${request.firstName} ${request.lastName}`,
            email: request.email,
            password: hashedPassword,
            role: "BRAND_USER",
            status: "ACTIVE",
            brandId: targetBrandId,
            mustChangePassword: true,
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

        // Send approval email with credentials
        await sendAccessApprovedEmail({
          email: request.email,
          name: `${request.firstName} ${request.lastName}`,
          tempPassword,
          companyName: canonicalCompanyName,
          accountType: "brand",
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
          brand: { id: targetBrandId, name: canonicalCompanyName },
          message: `Account created for ${request.firstName} ${request.lastName}. Temporary password: ${tempPassword}`,
        });
      }
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

      // Send denial email
      await sendAccessDeniedEmail({
        email: request.email,
        name: `${request.firstName} ${request.lastName}`,
        companyName: request.company,
        reason: deniedReason,
      });

      return NextResponse.json({
        ok: true,
        action: "denied",
        message: `Access request from ${request.firstName} ${request.lastName} has been denied.`,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid action. Use 'approve' or 'deny'." },
        { status: 400 },
      );
    }
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "A user with this email already exists" },
        { status: 409 },
      );
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
