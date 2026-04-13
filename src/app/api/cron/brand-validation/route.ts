import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Vercel Cron: Brand Validation
 * Runs every 6 hours, processes 25 unvalidated brands per run.
 * At 25 brands per run × 4 runs/day = 100 brands/day
 * → 1,644 brands validated in ~17 days
 *
 * Alternatively, manually trigger larger batches from the admin UI.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const res = await fetch(`${baseUrl}/api/admin/brand-validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET,
      },
      body: JSON.stringify({ mode: "batch", batchSize: 25 }),
    });

    const data = await res.json();

    console.log(
      `[CRON brand-validation] Processed ${data.processed || 0} brands, ` +
      `${data.updated || 0} updated. Progress: ${data.stats?.percentComplete || 0}%`
    );

    return NextResponse.json({
      ok: true,
      ...data,
    });
  } catch (e: any) {
    console.error("[CRON brand-validation] Error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
