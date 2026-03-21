// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole, hashPassword } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || !hasMinRole(currentUser.role, "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Only admins can modify users" }, { status: 403 });
    }

    const body = await req.json();
    const update: any = {};

    if (body.role) update.role = body.role;
    if (body.status) update.status = body.status;
    if (body.name) update.name = body.name;
    if (body.email) update.email = body.email.toLowerCase().trim();

    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ ok: false, error: "Password must be at least 6 characters" }, { status: 400 });
      }
      update.password = await hashPassword(body.password);
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
