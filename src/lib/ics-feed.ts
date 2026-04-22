/**
 * Per-user ICS subscription feed tokens (Phase 5 of ticket #23 calendar sync).
 *
 * We don't have a per-user `icsToken` column on User (would need a migration),
 * so the token is derived: `base64url(userId + "." + hmac(userId, secret))`.
 *
 * - Deterministic: same user always gets the same token (no DB write needed).
 * - Reversible: route at /calendar/[token].ics decodes the userId and verifies
 *   the HMAC without scanning all users.
 * - Revocable: bumping `ICS_FEED_VERSION` invalidates every existing feed URL,
 *   forcing reps to re-subscribe. Use sparingly — calendar apps cache
 *   subscriptions and re-prompting users is annoying.
 *
 * Security note: ICS feed URLs leak via calendar app caches and (if shared)
 * bookmark sync. The feed exposes meeting titles + task notes for ONE user —
 * leakage is bounded to that user's own data, but reps should treat the URL
 * like a password.
 */
import { createHmac } from "crypto";

const ICS_FEED_VERSION = "v1";

function feedSecret(): string {
  return (
    process.env.ICS_FEED_SECRET ||
    process.env.JWT_SECRET ||
    "fuze-atlas-dev-secret-change-in-production"
  );
}

function sign(userId: string): string {
  return createHmac("sha256", feedSecret())
    .update(`${userId}:ics-feed:${ICS_FEED_VERSION}`)
    .digest("hex")
    .slice(0, 32);
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64").toString("utf8");
}

/**
 * Mint a subscription token for `userId`. Same user always gets the same
 * token until ICS_FEED_VERSION (or the secret) changes.
 */
export function issueIcsToken(userId: string): string {
  if (!userId) throw new Error("userId required");
  return b64urlEncode(`${userId}.${sign(userId)}`);
}

/**
 * Decode + verify a token. Returns the userId if valid, null otherwise.
 * Constant-time compare to prevent timing oracle attacks.
 */
export function verifyIcsToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  let raw: string;
  try {
    raw = b64urlDecode(token);
  } catch {
    return null;
  }
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  const userId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(userId);
  if (!constantTimeEqual(sig, expected)) return null;
  return userId;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

/**
 * Build the absolute subscription URL for a user, ready to paste into
 * Outlook / Google / Apple calendar's "Add subscribed calendar" field.
 *
 * Use the `webcal://` scheme variant for one-click subscribe in most
 * calendar apps; the `https://` variant is the actual fetch URL.
 */
export function icsFeedUrls(userId: string, baseUrl?: string) {
  const base = (
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://fuzeatlas.com"
  ).replace(/\/$/, "");
  const token = issueIcsToken(userId);
  const httpsUrl = `${base}/calendar/${token}.ics`;
  // webcal:// strips the scheme and substitutes — calendar apps recognize
  // it as "subscribe to this URL" rather than "open in browser".
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");
  return { httpsUrl, webcalUrl, token };
}
