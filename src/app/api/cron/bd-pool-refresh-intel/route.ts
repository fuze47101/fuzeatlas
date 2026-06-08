// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyForImport, classify, verifyDeliverable } from "@/lib/email-verify";

/**
 * POST /api/cron/bd-pool-refresh-intel
 *
 * Re-validates existing pipeline intelligence without spending
 * Apollo credits unless explicitly requested.
 *
 * Two passes, both bounded:
 *
 *   1. EMAIL DELIVERABILITY (always-on, no credits).
 *      For every Contact at an active LEAD / PRESENTATION /
 *      BRAND_TESTING brand with a non-null email and an
 *      emailStatus of "unverified" / null / "extrapolated", run
 *      the local verifier (MX + format + role/disposable
 *      heuristics from src/lib/email-verify) and persist
 *      emailStatus + emailValidity. Bounces + invalids get
 *      flagged so outreach send refuses them.
 *
 *   2. APOLLO RE-ENRICH (opt-in via ?apollo=1, credit-bounded).
 *      For Contacts with apolloId set, re-runs the existing
 *      /api/admin/outreach/enrich path (which is now wired to
 *      email-verify per the Barth pass). Default cap: 50
 *      contacts per run. Override via ?apolloLimit=N.
 *
 *   ?limit=N           hard cap on contacts touched per pass (default 500)
 *   ?apollo=1          run the Apollo re-enrich pass
 *   ?apolloLimit=N     cap Apollo-paid lookups (default 50)
 *   ?dryRun=1          report counts without writing
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const ACTIVE_STAGES = ["LEAD", "PRESENTATION", "BRAND_TESTING"];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 500) | 0, 2000);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const runApollo = url.searchParams.get("apollo") === "1";
  const apolloLimit = Math.min(Number(url.searchParams.get("apolloLimit") || 50) | 0, 200);

  // ── Pass 1: deliverability re-validation ────────────────────────
  const targets = await (prisma as any).contact.findMany({
    where: {
      email: { not: null },
      brand: { is: { pipelineStage: { in: ACTIVE_STAGES } } },
      OR: [
        { emailStatus: null },
        { emailStatus: "unverified" },
        { emailStatus: "extrapolated" },
        { emailStatus: "guessed" },
        { emailValidity: null },
        { emailValidity: "unknown" },
      ],
    },
    select: {
      id: true,
      email: true,
      emailStatus: true,
      emailValidity: true,
      brand: { select: { id: true, name: true, pipelineStage: true } },
    },
    take: limit,
  });

  let validated = 0;
  let flaggedInvalid = 0;
  let flaggedRisky = 0;
  let verifiedGood = 0;
  const sample: any[] = [];

  for (const c of targets) {
    let cls: any;
    try {
      cls = await classifyForImport({ email: c.email });
    } catch {
      cls = classify(c.email);
    }
    if (cls.status === "invalid") flaggedInvalid++;
    else if (cls.status === "risky") flaggedRisky++;
    else if (cls.status === "verified") verifiedGood++;
    if (!dryRun) {
      try {
        await (prisma as any).contact.update({
          where: { id: c.id },
          data: { emailStatus: cls.status, emailValidity: cls.validity },
        });
        validated++;
      } catch {}
    } else {
      validated++;
    }
    if (sample.length < 10) {
      sample.push({ id: c.id, email: c.email, before: c.emailStatus, after: cls.status, reason: cls.reason });
    }
  }

  // ── Pass 2: Apollo re-enrich (opt-in, credit-bounded) ───────────
  const apolloResults: any[] = [];
  let apolloRefreshed = 0;
  let apolloErrors = 0;
  if (runApollo) {
    const apolloTargets = await (prisma as any).contact.findMany({
      where: {
        apolloId: { not: null },
        brand: { is: { pipelineStage: { in: ACTIVE_STAGES } } },
      },
      select: { id: true, apolloId: true, email: true },
      orderBy: { enrichedAt: "asc" }, // oldest enrichment first
      take: apolloLimit,
    });
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    for (const c of apolloTargets) {
      try {
        const r = await fetch(`${baseUrl}/api/admin/outreach/enrich`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": CRON_SECRET,
          },
          body: JSON.stringify({ contactId: c.id, apolloId: c.apolloId }),
        });
        const d = await r.json().catch(() => ({ ok: false }));
        if (r.ok && d?.ok) {
          apolloRefreshed++;
          apolloResults.push({ contactId: c.id, ok: true });
        } else {
          apolloErrors++;
          apolloResults.push({ contactId: c.id, ok: false, error: d?.error || `HTTP ${r.status}` });
        }
      } catch (e: any) {
        apolloErrors++;
        apolloResults.push({ contactId: c.id, ok: false, error: e?.message || String(e) });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    deliverability: {
      candidates: targets.length,
      written: dryRun ? 0 : validated,
      verifiedGood,
      flaggedRisky,
      flaggedInvalid,
      sample,
    },
    apollo: {
      ranApolloPass: runApollo,
      apolloRefreshed,
      apolloErrors,
      apolloLimitApplied: apolloLimit,
      sample: apolloResults.slice(0, 10),
    },
    verdict:
      `Email deliverability: ${verifiedGood} verified, ${flaggedRisky} risky, ${flaggedInvalid} invalid` +
      (runApollo ? `. Apollo re-enrich: ${apolloRefreshed} OK / ${apolloErrors} errors.` : "."),
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 600;
