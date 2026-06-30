// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { runVerifyEmail } from "@/lib/verify-email-core";

const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me || !ALLOWED_ROLES.includes(me.role)) {
      return NextResponse.json({ ok: false, error: "You don't have permission to verify contacts" }, { status: 403 });
    }
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id }, select: { id: true, email: true, emailStatus: true, raw: true },
    });
    if (!contact) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    if (!contact.email) return NextResponse.json({ ok: false, error: "Contact has no email to verify" }, { status: 400 });
    return await runVerifyEmail(contact.id, contact.email, contact.emailStatus, contact.raw);
  } catch (e: any) {
    console.error("[verify-email] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
