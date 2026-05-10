// @ts-nocheck
import { NextResponse } from "next/server";

/**
 * One-off bearer-authed endpoint that reports the host portion of
 * the DATABASE_URL the Vercel runtime is using. No credentials in
 * the response — just host:port and database name. Lets us confirm
 * whether `.env.local`'s DSN matches Vercel's, so we can stop
 * routing every schema change through the runtime endpoint pattern.
 *
 * Usage:
 *   fzcron inspect-db-host
 *
 * DELETE this file once the .env.local DSN is reconciled.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.CRON_SECRET) return unauthorized();

  const dsn = process.env.DATABASE_URL || "";
  const directDsn = process.env.DIRECT_DATABASE_URL || process.env.DIRECT_URL || "";

  function dissect(url: string) {
    if (!url) return null;
    try {
      // Normalize jdbc-style and prisma-quirky DSNs into URL-parseable shape.
      const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
      return {
        scheme: url.split(":")[0],
        host: u.hostname || null,
        port: u.port || null,
        database: u.pathname?.replace(/^\//, "") || null,
        searchParams: Array.from(u.searchParams.keys()),
      };
    } catch {
      // Last-ditch host extraction via regex if URL parsing throws.
      const m = url.match(/@([^/:]+)(?::(\d+))?\/([^?]+)/);
      return m
        ? {
            scheme: url.split(":")[0],
            host: m[1] || null,
            port: m[2] || null,
            database: m[3] || null,
            searchParams: [],
            note: "regex-fallback",
          }
        : { error: "unparseable" };
    }
  }

  return NextResponse.json({
    ok: true,
    DATABASE_URL: dissect(dsn),
    DIRECT_URL: dissect(directDsn),
    note:
      "Compare the host shown here against the host in your local .env.local DATABASE_URL. " +
      "If they differ, .env.local is pointing at a different database than the Vercel runtime.",
  });
}
