// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

/* ── POST /api/access-requests ── PUBLIC: submit a new access request ── */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, phone, jobTitle,
      company, website, fabricTypes, annualVolume,
      timeline, currentAntimicrobial, notes,
      requestType, factoryLocation, capabilities, certifications,
      productTypes, monthlyCapacity, fuzeApplicationMethod,
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
        requestType: requestType || "BRAND",
        // Brand fields
        fabricTypes: fabricTypes?.trim() || null,
        annualVolume: annualVolume || null,
        timeline: timeline || null,
        currentAntimicrobial: currentAntimicrobial?.trim() || null,
        // Factory fields
        factoryLocation: factoryLocation?.trim() || null,
        capabilities: capabilities || null,
        certifications: certifications || null,
        productTypes: productTypes?.trim() || null,
        monthlyCapacity: monthlyCapacity || null,
        fuzeApplicationMethod: fuzeApplicationMethod || null,
        notes: notes?.trim() || null,
      },
    });

    // ── Notify admin(s) via email ──
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true },
    });
    const adminEmails = admins.map((a) => a.email).filter(Boolean);
    const isFactory = (requestType || "BRAND") === "FACTORY";
    const typeLabel = isFactory ? "Factory" : "Brand";
    const typeBadge = isFactory ? "🏭" : "🏢";

    if (adminEmails.length > 0) {
      sendEmail({
        to: adminEmails,
        subject: `${typeBadge} New ${typeLabel} Access Request — ${company.trim()}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1A1A2E;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#00b4c3;margin:0">New ${typeLabel} Access Request</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:8px 0;color:#888;width:130px">Type</td><td style="padding:8px 0;font-weight:600">${typeBadge} ${typeLabel}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Name</td><td style="padding:8px 0">${firstName.trim()} ${lastName.trim()}</td></tr>
                <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0"><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
                <tr><td style="padding:8px 0;color:#888">Company</td><td style="padding:8px 0;font-weight:600">${company.trim()}</td></tr>
                ${phone ? `<tr><td style="padding:8px 0;color:#888">Phone</td><td style="padding:8px 0">${phone.trim()}</td></tr>` : ""}
                ${jobTitle ? `<tr><td style="padding:8px 0;color:#888">Title</td><td style="padding:8px 0">${jobTitle.trim()}</td></tr>` : ""}
                ${isFactory && factoryLocation ? `<tr><td style="padding:8px 0;color:#888">Location</td><td style="padding:8px 0">${factoryLocation.trim()}</td></tr>` : ""}
                ${notes ? `<tr><td style="padding:8px 0;color:#888">Notes</td><td style="padding:8px 0">${notes.trim()}</td></tr>` : ""}
              </table>
              <div style="margin-top:20px;text-align:center">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://atlas.fuzebiotech.com"}/settings/access-requests"
                   style="display:inline-block;background:#00b4c3;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                  Review Request
                </a>
              </div>
            </div>
          </div>
        `,
      }).catch((err) => console.error("Failed to send access-request notification:", err));
    }

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
    const type = url.searchParams.get("type"); // BRAND, FACTORY, or null for all
    const where: any = {};
    if (status) where.status = status;
    if (type) where.requestType = type;

    const requests = await prisma.accessRequest.findMany({
      where,
      include: {
        sow: { select: { id: true, title: true, status: true } },
        user: { select: { id: true, name: true, email: true, role: true, status: true } },
        factory: { select: { id: true, name: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Single groupBy query replaces 3 separate count queries
    const statsData = await prisma.accessRequest.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const stats = {
      pending: statsData.find((s: any) => s.status === "PENDING")?._count.id || 0,
      approved: statsData.find((s: any) => s.status === "APPROVED")?._count.id || 0,
      denied: statsData.find((s: any) => s.status === "DENIED")?._count.id || 0,
    };

    return NextResponse.json({ ok: true, requests, stats });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
