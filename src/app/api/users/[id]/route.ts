// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth";

const prisma = new PrismaClient();

// Helper: Generate random password
function generateRandomPassword(length: number = 12): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const userRole = req.headers.get("x-user-role");

    // Authorization check
    if (userRole !== "ADMIN" && userRole !== "EMPLOYEE") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Admin or Employee role required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, status, role, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true, status: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "suspend":
        if (user.status === "SUSPENDED") {
          return NextResponse.json({
            ok: true,
            message: "User is already suspended",
            user,
          });
        }
        const suspendedUser = await prisma.user.update({
          where: { id: params.id },
          data: { status: "SUSPENDED" },
          select: { id: true, name: true, email: true, role: true, status: true },
        });
        return NextResponse.json({
          ok: true,
          message: "User suspended successfully",
          user: suspendedUser,
        });

      case "activate":
        if (user.status === "ACTIVE") {
          return NextResponse.json({
            ok: true,
            message: "User is already active",
            user,
          });
        }
        const activatedUser = await prisma.user.update({
          where: { id: params.id },
          data: { status: "ACTIVE" },
          select: { id: true, name: true, email: true, role: true, status: true },
        });
        return NextResponse.json({
          ok: true,
          message: "User activated successfully",
          user: activatedUser,
        });

      case "deactivate":
        if (user.status === "INACTIVE") {
          return NextResponse.json({
            ok: true,
            message: "User is already inactive",
            user,
          });
        }
        const deactivatedUser = await prisma.user.update({
          where: { id: params.id },
          data: { status: "INACTIVE" },
          select: { id: true, name: true, email: true, role: true, status: true },
        });
        return NextResponse.json({
          ok: true,
          message: "User deactivated successfully",
          user: deactivatedUser,
        });

      case "reset-password":
        const newPw = generateRandomPassword(12);
        const hashedPassword = await hashPassword(newPw);
        const updatedUser = await prisma.user.update({
          where: { id: params.id },
          data: { password: hashedPassword },
          select: { id: true, name: true, email: true, role: true },
        });
        return NextResponse.json({
          ok: true,
          message: "Password reset successfully",
          user: updatedUser,
          generatedPassword: newPw, // Return to admin for sharing
        });

      case "change-role":
        if (!role) {
          return NextResponse.json(
            { ok: false, error: "Missing role in request body" },
            { status: 400 }
          );
        }
        const roleChangedUser = await prisma.user.update({
          where: { id: params.id },
          data: { role },
          select: { id: true, name: true, email: true, role: true, status: true },
        });
        return NextResponse.json({
          ok: true,
          message: `User role changed to ${role}`,
          user: roleChangedUser,
        });

      case "remove":
        // Soft delete approach: set status to INACTIVE
        const removedUser = await prisma.user.update({
          where: { id: params.id },
          data: { status: "INACTIVE" },
          select: { id: true, name: true, email: true, role: true, status: true },
        });
        return NextResponse.json({
          ok: true,
          message: "User removed (deactivated) successfully",
          user: removedUser,
        });

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e: any) {
    console.error("User action error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { role, status, password } = body;

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (password !== undefined) {
      updateData.password = await hashPassword(password);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
