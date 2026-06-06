// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/outreach/enrich
 * Enrich a contact using Apollo People Match API.
 *
 * Body: { contactId } — enriches using existing name/email/company data
 *   OR  { contactId, apolloId } — enriches by Apollo person ID (0 credits if already revealed)
 *
 * Requires env: APOLLO_API_KEY
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin or manager only" }, { status: 403 });
    }

    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Apollo API key not configured. Set APOLLO_API_KEY in Vercel env vars." }, { status: 500 });
    }

    const { contactId, apolloId } = await req.json();
    if (!contactId) {
      return NextResponse.json({ ok: false, error: "contactId is required" }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { brand: { select: { name: true, website: true } } },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    // Build Apollo request
    const apolloBody: any = { reveal_personal_emails: true };

    if (apolloId || contact.apolloId) {
      apolloBody.id = apolloId || contact.apolloId;
    } else {
      // Match by name + company
      if (contact.firstName) apolloBody.first_name = contact.firstName;
      if (contact.lastName) apolloBody.last_name = contact.lastName;
      if (contact.name && !contact.firstName) apolloBody.name = contact.name;
      if (contact.email) apolloBody.email = contact.email;
      if (contact.brand?.name) apolloBody.organization_name = contact.brand.name;
      if (contact.brand?.website) {
        try {
          const domain = new URL(contact.brand.website.startsWith("http") ? contact.brand.website : `https://${contact.brand.website}`).hostname.replace("www.", "");
          apolloBody.domain = domain;
        } catch {}
      }
      if (contact.linkedinUrl) apolloBody.linkedin_url = contact.linkedinUrl;
    }

    // Call Apollo People Match
    const apolloRes = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(apolloBody),
    });

    const apolloData = await apolloRes.json();

    if (!apolloRes.ok || !apolloData.person) {
      return NextResponse.json({
        ok: false,
        error: "Apollo match failed",
        details: apolloData.error || apolloData.message || "No person found",
      }, { status: 404 });
    }

    const person = apolloData.person;

    // Update contact with enriched data
    const updateData: any = {
      enrichedAt: new Date(),
      enrichmentSource: "apollo",
      apolloId: person.id,
    };

    if (person.email && person.email_status !== "unavailable") {
      updateData.email = person.email;
      // BUG 2 (Barth 2026-06-05) — run our own deliverability gate
      // alongside Apollo's signal. mergeApolloStatus prefers Apollo's
      // verdict when present; falls back to MX lookup otherwise.
      const { classifyForImport } = await import("@/lib/email-verify");
      const cls = await classifyForImport({
        email: person.email,
        apolloStatus: person.email_status,
      });
      updateData.emailStatus = cls.status;
      updateData.emailValidity = cls.validity;
    }
    if (person.personal_emails?.length > 0) {
      updateData.personalEmail = person.personal_emails.join(";");
    }
    if (person.linkedin_url) updateData.linkedinUrl = person.linkedin_url;
    if (person.title) updateData.jobTitle = person.title;
    if (person.seniority) updateData.seniority = person.seniority;
    if (person.first_name && !contact.firstName) updateData.firstName = person.first_name;
    if (person.last_name && !contact.lastName) updateData.lastName = person.last_name;

    // Phone from organization or direct
    if (person.phone_numbers?.length > 0) {
      updateData.phone = person.phone_numbers[0].sanitized_number;
    } else if (person.organization?.primary_phone?.sanitized_number) {
      updateData.phone = person.organization.primary_phone.sanitized_number;
    }

    // Company revenue
    if (person.organization?.organization_revenue_printed) {
      updateData.companyRevenue = person.organization.organization_revenue_printed;
    }

    // Mark as decision maker based on seniority
    if (["vp", "c_suite", "director"].includes(person.seniority)) {
      updateData.decisionMaker = true;
    }

    // Update name field
    if (person.name && !contact.name) {
      updateData.name = person.name;
    }

    // City/state/country on brand if missing
    if (person.city || person.state || person.country) {
      updateData.address = [person.city, person.state, person.country].filter(Boolean).join(", ");
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      contact: updated,
      apolloPerson: {
        id: person.id,
        name: person.name,
        title: person.title,
        email: person.email,
        emailStatus: person.email_status,
        seniority: person.seniority,
        linkedin: person.linkedin_url,
        org: person.organization?.name,
        revenue: person.organization?.organization_revenue_printed,
      },
    });
  } catch (error: any) {
    console.error("Enrichment error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/outreach/enrich?action=bulk
 * Bulk enrich multiple contacts. Body: { contactIds: string[] }
 */
