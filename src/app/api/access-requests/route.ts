// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

/* ── POST /api/access-requests ── PUBLIC: submit a new access request ── */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, phone, jobTitle,
      company, website, fabricTypes, annualVolume,
      timeline, currentAntimicrobial, notes,
    } = body;

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json(
        { ok: false, error: "First name, last name, email, and company are required" },
        { status: 400 }
      );
    }

    // Check for duplicate pending request
    const existing = await prisma.accessRequest.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existing) {
      if (existing.status === "APPROVED") {
        return NextResponse.json(
          { ok: false, error: "An account with this email has already been approved. Please check your email for login credentials." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "A request with this email is already pending review. We'll be in touch soon." },
        { status: 409 }
        );
    }

    // Check if user already exists in the system
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists. Please sign in at the login page." },
        { status: 409 }
      );
    }

    const request = await prisma.accessRequest.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        jobTitle: jobTitle?.trim() || null,
        company: company.trim(),
        website: website?.trim() || null,
        fabricTypes: fabricTypes?.trim() || null,
        annualVolume: annualVolume || null,
        timeline: timeline || null,
        currentAntimicrobial: currentAntimicrobial?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Your access request has been submitted. Our team will review it and reach out shortly.",
      requestId: request.id,
    });
  } catch (e: any) {
    console.error("Access request error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── GET /api/access-requests ── ADMIN: list all access requests ── */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status"); // PENDING, APPROVED, DENIED
    const where: any = {};
    if (status) where.status = status;

    const requests = await prisma.accessRequest.findMany({
      where,
      include: {
        sow: { select: { id: true, title: true, status: true } },
        user: { select: { id: true, name: true, email: true, role: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      pending: await prisma.accessRequest.count({ where: { status: "PENDING" } }),
      approved: await prisma.accessRequest.count({ where: { status: "APPROVED" } }),
      denied: await prisma.accessRequest.count({ where: { status: "DENIED" } }),
    };

    return NextResponse.json({ ok: true, requests, stats });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
