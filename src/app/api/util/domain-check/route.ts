// @ts-nocheck
/**
 * GET /api/util/domain-check?url=<url-or-hostname>
 *
 * Probes a single URL / hostname and returns a DomainCheckResult. Thin
 * wrapper around lib/domain-check.ts so the BD Wizard (and anywhere else
 * we display a brand website) can flag dead/parked domains inline.
 *
 * Auth: requires a signed-in user. This calls out to the public
 * internet and we don't want it to become a public DNS probe.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkDomain } from "@/lib/domain-check";

// Cheap in-memory cache (keyed by hostname) so the wizard hammering the
// header on every re-render doesn't fire a fresh probe every time.
// 5-minute TTL — plenty fresh for a UI hint; dev reloads reset it anyway.
const CACHE = new Map<string, { at: number; result: any }>();
const TTL_MS = 5 * 60_000;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("url") || searchParams.get("domain") || "";
    const bypassCache = searchParams.get("fresh") === "1";

    if (!raw.trim()) {
      return NextResponse.json({ ok: false, error: "?url= is required" }, { status: 400 });
    }

    const key = raw.trim().toLowerCase();
    const now = Date.now();
    if (!bypassCache) {
      const cached = CACHE.get(key);
      if (cached && now - cached.at < TTL_MS) {
        return NextResponse.json({ ok: true, cached: true, result: cached.result });
      }
    }

    const result = await checkDomain(raw);
    CACHE.set(key, { at: now, result });

    return NextResponse.json({ ok: true, cached: false, result });
  } catch (err: any) {
    console.error("[api/util/domain-check] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to probe domain" },
      { status: 500 },
    );
  }
}
