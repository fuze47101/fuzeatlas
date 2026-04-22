// @ts-nocheck
/**
 * GET /api/me/calendar-feed
 *
 * Returns the current user's personal ICS subscription feed URLs (https + webcal).
 * Used by /settings/profile to surface the "Subscribe in Outlook/Google/Apple"
 * affordance. Token derivation lives in src/lib/ics-feed.ts and is keyed off
 * userId + a server secret — no DB write happens here, the same user always
 * gets the same URL.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { icsFeedUrls } from "@/lib/ics-feed";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // Use the actual request origin so dev / preview URLs work too.
  const origin = new URL(req.url).origin;
  const { httpsUrl, webcalUrl } = icsFeedUrls(user.id, origin);
  return NextResponse.json({ ok: true, httpsUrl, webcalUrl });
}
