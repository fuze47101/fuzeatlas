// @ts-nocheck
import { NextResponse } from "next/server";

/**
 * POST /api/cron/bd-pool-discovery-sweep
 *
 * One-shot driver — invokes /api/brands/discover across the BD
 * target categories (apparel / activewear / home textile /
 * hospitality) in a sensible region/count rotation. Mirrors the
 * existing daily brand-discovery cron but sweeps multiple
 * categories in one invocation so a manual pool-refresh fires
 * everything in one call.
 *
 * Apollo credit guard: per-category count default 12 (small),
 * configurable via ?count=N — keeps a full sweep under
 * ~80 enrichment calls.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

const TARGET_CATEGORIES = [
  "Activewear & Athleisure",
  "Outdoor & Performance",
  "Workwear & Uniforms",
  "Hospitality (Hotels/Restaurants)",
  "Home Textiles & Bedding",
  "Intimate Apparel & Socks",
  "Denim & Casualwear",
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const region = url.searchParams.get("region") || "Global";
  const count = Math.max(1, Math.min(Number(url.searchParams.get("count") || 12) | 0, 25));
  // Invoke the discover handler in-process. An HTTP fetch to
  // /api/brands/discover would be intercepted by src/middleware.ts
  // (which exempts /api/cron but not /api/brands/discover) and
  // bounced as "Authentication required" before the route's own
  // x-cron-secret check could run.
  const { POST: discoverPOST } = await import("@/app/api/brands/discover/route");

  const results: any[] = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const category of TARGET_CATEGORIES) {
    try {
      const synthetic = new Request("http://internal/api/brands/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET,
        },
        body: JSON.stringify({ category, region, count, excludeExisting: true }),
      });
      const r = await discoverPOST(synthetic as any);
      const d = await r.json();
      const created = d?.summary?.created || 0;
      const skipped = d?.summary?.skipped || 0;
      totalCreated += created;
      totalSkipped += skipped;
      results.push({ category, region, status: r.ok ? "ok" : "error", created, skipped, error: d?.error || null });
    } catch (e: any) {
      results.push({ category, region, status: "exception", error: e?.message || String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    region,
    countPerCategory: count,
    totalCreated,
    totalSkipped,
    results,
    verdict: `Discovery sweep: ${totalCreated} new brand(s), ${totalSkipped} skipped (dedup), across ${TARGET_CATEGORIES.length} categories in ${region}.`,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 600;
