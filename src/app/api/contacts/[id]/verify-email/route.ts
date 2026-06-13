// @ts-nocheck
/**
 * POST /api/contacts/[id]/verify-email — "Confirm Email / bounce"
 *
 * Runs verifyDeliverable() against the contact's email (DNS MX lookup +
 * format/role/disposable filter), then merges with any pre-existing
 * Apollo email_status signal so we don't overwrite a stronger upstream
 * verdict with a softer one. Persists the result to Contact.emailValidity
 * + Contact.emailStatus and stamps Contact.raw.emailVerifiedAt so the UI
 * can show "last checked X ago" beside the address.
 *
 * Same ACL as the other rep-facing endpoints (Atlas provisioning, etc.):
 * ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP / BD_REP. BD reps
 * verifying their own outreach addresses unblocks Barth's workflow.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  verifyDeliverable,
  mergeApolloStatus,
} from "@/lib/email-verify";

const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me || !ALLOWED_ROLES.includes(me.role)) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to verify contacts" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, email: true, emailStatus: true, raw: true },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    if (!contact.email) {
      return NextResponse.json(
        { ok: false, error: "Contact has no email to verify" },
        { status: 400 },
      );
    }

    return await runVerifyEmail(contact.id, contact.email, contact.emailStatus, contact.raw);
  } catch (e: any) {
    console.error("[verify-email] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

/**
 * Shared core — also called by /research after a fresh Apollo address
 * lands so the new email comes back already bounce-checked.
 */
export async function runVerifyEmail(
  contactId: string,
  email: string,
  apolloStatusHint: string | null | undefined,
  rawIn: any,
) {
  const verdict = await verifyDeliverable(email);
  // If Apollo has previously stamped a hard signal (verified / bounced /
  // unavailable) on this contact, keep it dominant. MX lookup can't
  // negate Apollo's SMTP-level verdict.
  const merged = mergeApolloStatus(apolloStatusHint, verdict);

  const raw = (rawIn && typeof rawIn === "object" && !Array.isArray(rawIn)) ? rawIn : {};
  raw.emailVerifiedAt = new Date().toISOString();
  raw.emailVerifiedReason = merged.reason;

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      emailValidity: merged.validity,
      emailStatus: merged.status,
      raw,
    },
  });

  const detail =
    merged.validity === "invalid"
      ? "This address will bounce — don't send to it."
      : merged.validity === "risky"
      ? "Role address or suspect — proceed with care."
      : merged.validity === "valid"
      ? `Deliverable (${merged.reason}).`
      : `Could not verify (${merged.reason}).`;

  return NextResponse.json({
    ok: true,
    emailValidity: merged.validity,
    emailStatus: merged.status,
    verdict: merged,
    detail,
    verifiedAt: raw.emailVerifiedAt,
  });
}
