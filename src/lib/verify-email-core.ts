// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDeliverable, mergeApolloStatus } from "@/lib/email-verify";

/** Shared core — called by POST /api/contacts/[id]/verify-email and by
 *  /research. Lives in lib (not the route file) because Next.js route
 *  modules may only export GET/POST/etc. — exporting this from the route
 *  broke the production build. */
export async function runVerifyEmail(contactId, email, apolloStatusHint, rawIn) {
  const verdict = await verifyDeliverable(email);
  const merged = mergeApolloStatus(apolloStatusHint, verdict);
  const raw = (rawIn && typeof rawIn === "object" && !Array.isArray(rawIn)) ? rawIn : {};
  raw.emailVerifiedAt = new Date().toISOString();
  raw.emailVerifiedReason = merged.reason;
  await prisma.contact.update({
    where: { id: contactId },
    data: { emailValidity: merged.validity, emailStatus: merged.status, raw },
  });
  const detail =
    merged.validity === "invalid" ? "This address will bounce — don't send to it."
    : merged.validity === "risky" ? "Role address or suspect — proceed with care."
    : merged.validity === "valid" ? `Deliverable (${merged.reason}).`
    : `Could not verify (${merged.reason}).`;
  return NextResponse.json({
    ok: true, emailValidity: merged.validity, emailStatus: merged.status,
    verdict: merged, detail, verifiedAt: raw.emailVerifiedAt,
  });
}
