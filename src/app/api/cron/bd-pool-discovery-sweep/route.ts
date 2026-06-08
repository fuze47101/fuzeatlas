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
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  const results: any[] = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const category of TARGET_CATEGORIES) {
    try {
      const r = await fetch(`${baseUrl}/api/brands/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET,
        },
        body: JSON.stringify({ category, region, count, excludeExisting: true }),
      });
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
