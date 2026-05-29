// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser, hasMinRole, hashPassword } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Admin permission gate — use the REAL session user, not the
    // impersonated one, so View-As doesn't lock admins out of writes.
    const currentUser = await getRealUser();

    if (!currentUser || !hasMinRole(currentUser.role, "ADMIN")) {
      return NextResponse.json(
        { ok: false, error: "Only admins can modify users" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const update: any = {};

    if (body.role) update.role = body.role;
    if (body.status) update.status = body.status;
    if (body.name) update.name = body.name;
    if (body.email) {
      const normalized = body.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return NextResponse.json(
          { ok: false, error: `Invalid email format: "${normalized}"` },
          { status: 400 },
        );
      }
      // Collision check — block if another user already has this email.
      // Allow same-user no-op so saving an edit row without changing the
      // email field doesn't error.
      const collision = await prisma.user.findUnique({
        where: { email: normalized },
        select: { id: true, email: true, name: true },
      });
      if (collision && collision.id !== id) {
        return NextResponse.json(
          {
            ok: false,
            error: `Email "${normalized}" is already used by ${collision.name || "another user"} (id ${collision.id}). Resolve the duplicate first.`,
            code: "EMAIL_COLLISION",
          },
          { status: 409 },
        );
      }
      update.email = normalized;
    }
    if (typeof body.canClaim === "boolean") update.canClaim = body.canClaim;

    // Entity assignment — partially addresses task #73 (role-change flow).
    // Pass `null` to explicitly clear an assignment.
    if ("factoryId" in body) update.factoryId = body.factoryId || null;
    if ("brandId" in body) update.brandId = body.brandId || null;
    if ("distributorId" in body) update.distributorId = body.distributorId || null;
    if ("labId" in body) update.labId = body.labId || null;

    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { ok: false, error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      update.password = await hashPassword(body.password);
    }

    // ── Role/entity coherence guard (task #73) ─────────────────
    // Stop "Shauna situation": user gets switched to FACTORY_MANAGER but
    // never linked to a factory, then can't place orders / sees nothing.
    // We compute the POST-UPDATE state by overlaying the patch on the
    // existing record, then enforce that role-required FK is present.
    const REQUIRED_FK: Record<string, "factoryId" | "brandId" | "distributorId" | "labId"> = {
      FACTORY_USER: "factoryId",
      FACTORY_MANAGER: "factoryId",
      BRAND_USER: "brandId",
      BRAND_MANAGER: "brandId",
      DISTRIBUTOR_USER: "distributorId",
      DISTRIBUTOR_MANAGER: "distributorId",
      LAB_USER: "labId",
      LAB_ADMIN: "labId",
    };
    const requiredFk = update.role ? REQUIRED_FK[update.role] : undefined;
    if (requiredFk) {
      // Read existing only if we need to (avoids extra round-trip when not changing role)
      const existing = await prisma.user.findUnique({
        where: { id },
        select: { factoryId: true, brandId: true, distributorId: true, labId: true, role: true },
      });
      if (!existing) {
        return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }
      const finalFkValue =
        requiredFk in update ? update[requiredFk] : (existing as any)[requiredFk];
      if (!finalFkValue) {
        const friendly = {
          factoryId: "factory",
          brandId: "brand",
          distributorId: "distributor",
          labId: "lab",
        }[requiredFk];
        return NextResponse.json(
          {
            ok: false,
            error: `Role ${update.role} requires a ${friendly} assignment. Pick a ${friendly} before saving.`,
            code: "MISSING_ENTITY_ASSIGNMENT",
            requiredField: requiredFk,
          },
          { status: 400 },
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: update,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
