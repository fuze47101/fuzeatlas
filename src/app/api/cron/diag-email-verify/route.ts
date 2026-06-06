// @ts-nocheck
import { NextResponse } from "next/server";
import { classify, verifyDeliverable, mergeApolloStatus, isSendForbidden } from "@/lib/email-verify";

/**
 * GET /api/cron/diag-email-verify
 *
 * BUG 2 (Barth 2026-06-05) — verifies the email-deliverability gate
 * against known-good / known-bad addresses.
 *
 *   andrew@fuze47.com           → MX present → status:verified
 *   noreply@fuze47.com          → role-address → status:risky
 *   not-an-email                → format → status:invalid
 *   xyz@asdf-no-such-domain.zz  → DNS no-MX → status:invalid
 *   info@example.com            → role-address → status:risky
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

const FIXTURES = [
  { email: "andrew@fuze47.com", expectStatus: "verified", expectFamily: "good" },
  { email: "noreply@fuze47.com", expectStatus: "risky", expectFamily: "role" },
  { email: "not-an-email", expectStatus: "invalid", expectFamily: "format" },
  { email: "xyz@asdf-no-such-domain-12345xyz.zz", expectStatus: "invalid", expectFamily: "no-mx" },
  { email: "info@example.com", expectStatus: "risky", expectFamily: "role" },
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const out: any[] = [];
  for (const f of FIXTURES) {
    const sync = classify(f.email);
    let async_: any = sync;
    if (sync.status !== "invalid") {
      try {
        async_ = await verifyDeliverable(f.email);
      } catch (e: any) {
        async_ = { status: "unverified", validity: "unknown", reason: `err-${e?.code || "?"}` };
      }
    }
    out.push({
      email: f.email,
      expectStatus: f.expectStatus,
      sync,
      verified: async_,
      pass: async_.status === f.expectStatus,
    });
  }
  const apolloChecks = [
    { input: "verified", apolloEmail: "x@y.com", expected: "verified" },
    { input: "unavailable", apolloEmail: "x@y.com", expected: "invalid" },
    { input: "extrapolated", apolloEmail: "x@y.com", expected: "risky" },
  ].map((c) => ({
    ...c,
    actual: mergeApolloStatus(c.input, { status: "unverified", validity: "unknown", reason: "n/a" }).status,
    pass: mergeApolloStatus(c.input, { status: "unverified", validity: "unknown", reason: "n/a" }).status === c.expected,
  }));
  const sendGuards = [
    { input: "invalid", expectBlock: true },
    { input: "bounced", expectBlock: true },
    { input: "verified", expectBlock: false },
    { input: null, expectBlock: false },
  ].map((c) => ({ ...c, actualBlock: isSendForbidden(c.input as any), pass: isSendForbidden(c.input as any) === c.expectBlock }));

  const allPass =
    out.every((r) => r.pass) &&
    apolloChecks.every((r) => r.pass) &&
    sendGuards.every((r) => r.pass);

  return NextResponse.json({
    ok: true,
    server_path_healthy: allPass,
    fixtures: out,
    apolloChecks,
    sendGuards,
    verdict: allPass
      ? "All fixtures classified as expected; verifier + apollo merge + send-guard all pass."
      : "One or more fixtures misclassified — see fixtures[].pass.",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
