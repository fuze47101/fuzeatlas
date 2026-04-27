// @ts-nocheck
import { NextResponse } from "next/server";

/**
 * GET /api/cron/brand-discovery
 *
 * Vercel Cron Job — runs daily at 6am UTC.
 * Replaces the Cowork scheduled task that was blocked by sandbox egress proxy.
 *
 * Calls the existing /api/brands/discover endpoint internally (server-side),
 * rotating through categories and regions on a 7-day cycle.
 */

const CRON_SECRET = process.env.CRON_SECRET;

const CATEGORIES = [
  ["Activewear & Athleisure", "Outdoor & Performance"],
  ["Workwear & Uniforms", "Military & Defense", "Medical Textiles"],
  ["Hospitality (Hotels/Restaurants)", "Home Textiles & Bedding"],
  ["Intimate Apparel & Socks", "Denim & Casualwear"],
  ["Luxury & Fashion", "Childrenswear", "Artificial Turf"],
  ["Automotive Textiles", "Industrial & Technical Textiles"],
  ["Activewear & Athleisure", "Workwear & Uniforms", "Medical Textiles"],
];

const REGIONS = [
  "Global",
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East & Africa",
];

export async function GET(req: Request) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const categoryIndex = dayOfYear % CATEGORIES.length;
  const regionIndex = dayOfYear % REGIONS.length;

  const categories = CATEGORIES[categoryIndex];
  const region = REGIONS[regionIndex];

  console.log(
    `[Cron] Brand discovery — Day ${dayOfYear}, Categories: ${categories.join(", ")}, Region: ${region}`
  );

  const results: any[] = [];

  // Resolve the base URL ONCE per cron invocation. The previous expression
  //   const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  //     ? `https://${process.env.VERCEL_URL}` : ...
  // was operator-precedence broken: `||` binds before `?:`, so when
  // NEXT_PUBLIC_APP_URL was set (typical in prod) it forced the truthy
  // branch which then tried to template the *undefined* VERCEL_URL,
  // producing `https://undefined/api/brands/discover` and silently
  // failing every fetch. THAT'S why Ryan's pipeline drained — the
  // discovery cron has been running but writing zero brands. Using a
  // proper precedence-explicit fallback chain instead.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  for (const category of categories) {
    try {

      const res = await fetch(`${baseUrl}/api/brands/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass cron auth so the endpoint knows this is an automated call
          "x-cron-secret": CRON_SECRET || "",
        },
        body: JSON.stringify({
          category,
          region,
          count: 20,
          excludeExisting: true,
        }),
      });

      const data = await res.json();
      results.push({
        category,
        region,
        status: res.ok ? "success" : "error",
        ...data,
      });

      console.log(
        `[Cron] ${category} (${region}): ${data.summary?.created || 0} created, ${data.summary?.skipped || 0} skipped`
      );
    } catch (err: any) {
      console.error(`[Cron] ${category} failed:`, err.message);
      results.push({
        category,
        region,
        status: "error",
        error: err.message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    dayOfYear,
    categoryIndex,
    regionIndex,
    results,
  });
}
