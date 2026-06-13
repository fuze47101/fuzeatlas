// @ts-nocheck
/**
 * POST /api/contacts/[id]/research — "Fresh Research"
 *
 * Re-pulls a contact via Apollo People Match keyed on the contact's
 * name + the entity's domain (brand/factory/distributor website), then
 * gates every write through shouldWriteEmail/shouldWriteLinkedIn so we
 * never blank out a curated value. Apollo email_status === "verified"
 * is treated as a "verified" agreement verdict (matches the promotion
 * in buildCandidates), so a verified Apollo address can overwrite a
 * stale stored address; everything else only fills empty fields.
 *
 * After persisting, immediately runs the verify-email logic against
 * the resulting address so a freshly pulled email comes back already
 * bounce-checked (no two-button dance for reps).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apolloPeopleMatch } from "@/lib/apollo-match";
import {
  shouldWriteEmail,
  shouldWriteLinkedIn,
  emailStatusFromVerdict,
  normaliseEmail,
  normaliseLinkedIn,
} from "@/lib/enrich-cross-validate";
import { runVerifyEmail } from "../verify-email/route";

const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

function singleApolloAgreement(value: string | null, apolloVerified: boolean) {
  if (!value) return { value: null, sources: [], verdict: "none" as const, alternatives: [] };
  const verdict = apolloVerified ? ("verified" as const) : ("single" as const);
  return {
    value,
    sources: ["apollo" as const],
    verdict,
    alternatives: [{ value, sources: ["apollo" as const] }],
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me || !ALLOWED_ROLES.includes(me.role)) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to research contacts" },
        { status: 403 },
      );
    }
    if (!process.env.APOLLO_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Apollo API key not configured. Set APOLLO_API_KEY in Vercel env vars." },
        { status: 500 },
      );
    }

    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, website: true } },
        factory: { select: { id: true, name: true, website: true } },
        distributor: { select: { id: true, name: true } },
      },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    // Pick the best entity hint for Apollo's organization_name + domain.
    // Brand wins over factory wins over distributor (most enrichment data
    // is keyed on consumer-brand identity).
    const entityName =
      contact.brand?.name || contact.factory?.name || contact.distributor?.name || null;
    const entityWebsite =
      contact.brand?.website || contact.factory?.website || null;

    const apollo = await apolloPeopleMatch({
      firstName: contact.firstName,
      lastName: contact.lastName,
      name: contact.name,
      email: contact.email,
      linkedinUrl: contact.linkedinUrl,
      apolloId: contact.apolloId,
      brandName: entityName,
      brandWebsite: entityWebsite,
    });

    if (!apollo.matched) {
      return NextResponse.json(
        {
          ok: false,
          error: "Apollo did not find a match",
          detail: apollo.error || "No person record returned",
        },
        { status: 404 },
      );
    }

    // Cross-validate: never blank out good data, only overwrite on verified.
    const apolloEmailVerified =
      (apollo.emailStatus || "").toLowerCase() === "verified" && !!apollo.email;
    const emailDecision = shouldWriteEmail(
      contact.email,
      singleApolloAgreement(normaliseEmail(apollo.email), apolloEmailVerified),
    );
    const linkedinDecision = shouldWriteLinkedIn(
      contact.linkedinUrl,
      singleApolloAgreement(normaliseLinkedIn(apollo.linkedin), false), // LI is never "verified" via Apollo email_status
    );

    const update: any = {
      enrichedAt: new Date(),
      enrichmentSource: "apollo",
    };
    if (apollo.apolloId) update.apolloId = apollo.apolloId;

    // Name-completion writes — only fill blanks, never overwrite curated.
    if (apollo.firstName && !contact.firstName) update.firstName = apollo.firstName;
    if (apollo.lastName && !contact.lastName) update.lastName = apollo.lastName;
    if (apollo.name && !contact.name) update.name = apollo.name;
    if (apollo.title && !contact.jobTitle) update.jobTitle = apollo.title;
    if (apollo.seniority && !contact.seniority) update.seniority = apollo.seniority;
    if (apollo.phone && !contact.phone) update.phone = apollo.phone;
    if (
      apollo.companyRevenue &&
      !contact.companyRevenue
    ) update.companyRevenue = apollo.companyRevenue;
    if (
      Array.isArray(apollo.personalEmails) &&
      apollo.personalEmails.length > 0 &&
      !contact.personalEmail
    ) {
      update.personalEmail = apollo.personalEmails.join(";");
    }
    if (
      ["vp", "c_suite", "director"].includes(apollo.seniority || "") &&
      !contact.decisionMaker
    ) {
      update.decisionMaker = true;
    }

    // Cross-validated overwrites — only when the policy says so.
    if (emailDecision.write && apollo.email) {
      update.email = apollo.email;
      // Stamp the Apollo-side emailStatus mapped to our vocabulary so a
      // subsequent verify-email pass sees the right hint.
      update.emailStatus = apolloEmailVerified
        ? "verified"
        : emailStatusFromVerdict("single");
    }
    if (linkedinDecision.write && apollo.linkedin) {
      update.linkedinUrl = apollo.linkedin;
    }

    const raw =
      contact.raw && typeof contact.raw === "object" && !Array.isArray(contact.raw)
        ? { ...contact.raw }
        : {};
    raw.lastResearchAt = new Date().toISOString();
    raw.lastResearchSummary = {
      source: "apollo",
      apolloId: apollo.apolloId || null,
      emailWritten: !!update.email,
      emailReason: emailDecision.reason,
      linkedinWritten: !!update.linkedinUrl,
      linkedinReason: linkedinDecision.reason,
      apolloEmailStatus: apollo.emailStatus || null,
    };
    update.raw = raw;

    const updated = await prisma.contact.update({
      where: { id },
      data: update,
      select: { id: true, email: true, emailStatus: true, raw: true },
    });

    // Re-verify whatever email is on the row now (whether new or kept).
    // Bypasses the auth gate by calling runVerifyEmail() directly — we
    // already proved the caller is allowed above.
    let emailVerifyResult: any = null;
    if (updated.email) {
      try {
        const r = await runVerifyEmail(
          updated.id,
          updated.email,
          updated.emailStatus,
          updated.raw,
        );
        emailVerifyResult = await r.json();
      } catch (e: any) {
        emailVerifyResult = { ok: false, error: e?.message || "verify-email post-hook failed" };
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        emailWritten: !!update.email,
        emailReason: emailDecision.reason,
        linkedinWritten: !!update.linkedinUrl,
        linkedinReason: linkedinDecision.reason,
        fieldsFilled: Object.keys(update).filter(
          (k) => !["enrichedAt", "enrichmentSource", "raw"].includes(k),
        ),
        apolloEmailStatus: apollo.emailStatus || null,
      },
      emailVerify: emailVerifyResult,
      researchedAt: raw.lastResearchAt,
    });
  } catch (e: any) {
    console.error("[research] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
