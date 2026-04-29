// @ts-nocheck
/**
 * POST /api/admin/distributors/[id]/test-user
 *
 * Create a test DISTRIBUTOR_USER linked to an existing distributor.
 * Use case: admin made a distributor without a test user and now
 * wants to "View As" it. Without this, they'd have to manually
 * navigate to /admin/users, create a user, set role + distributorId,
 * which is 4-5 clicks more than necessary.
 *
 * Body (all optional):
 *   - email: defaults to qa+<safeName>-<rand>@fuze47.com
 *   - name:  defaults to "<distributor name> (test user)"
 *
 * Response: { ok, user, distributor }
 *
 * Idempotent — if a DISTRIBUTOR_USER already exists for this
 * distributor, return that user instead of creating a duplicate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!distributor) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    // Idempotent — if a DISTRIBUTOR_USER already exists for this
    // distributor, return that one rather than creating another.
    const existingTestUser = await prisma.user.findFirst({
      where: {
        distributorId: id,
        role: "DISTRIBUTOR_USER",
      },
      orderBy: { createdAt: "asc" },
    });
    if (existingTestUser) {
      return NextResponse.json({
        ok: true,
        user: existingTestUser,
        distributor,
        existed: true,
        message: `Distributor already has a test user: ${existingTestUser.email}`,
      });
    }

    const safeName = distributor.name
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 20);
    const email =
      (body.email && body.email.trim()) ||
      `qa+${safeName}-${Date.now().toString().slice(-6)}@fuze47.com`;
    const userName = (body.name && body.name.trim()) || `${distributor.name} (test user)`;

    // Conflict check on the email
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      // Repurpose if it's already wired to this distributor
      if (existingByEmail.distributorId === id) {
        return NextResponse.json({
          ok: true,
          user: existingByEmail,
          distributor,
          existed: true,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error: `Email "${email}" is already used by a different user (${existingByEmail.name || existingByEmail.id}). Pick a different email.`,
        },
        { status: 409 },
      );
    }

    const created = await prisma.user.create({
      data: {
        email,
        name: userName,
        role: "DISTRIBUTOR_USER",
        distributorId: id,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ ok: true, user: created, distributor });
  } catch (e: any) {
    console.error("Create distributor test user error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to create test user" },
      { status: 500 },
    );
  }
}
