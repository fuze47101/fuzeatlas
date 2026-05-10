/**
 * Phase 9A — outbound email open + click tracking.
 *
 * Each outbound OutreachMessage gets a unique `trackingToken`. We
 * inject a 1×1 pixel pointing at /api/tracking/open/{token} and
 * rewrite every <a href="..."> in the body through
 * /api/tracking/click/{token}?to=<encoded original URL>.
 *
 * The endpoints record opens/clicks and (for clicks) 302-redirect to
 * the original destination. The pixel approach is the same one
 * HubSpot / Mailchimp / Salesloft use — limitations apply (proxies,
 * image-blocking, plain-text-only clients), but the directional
 * signal is the point.
 */

import { randomBytes } from "node:crypto";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

export function newTrackingToken(): string {
  // 16 random bytes → 22-char base64url (no padding) — short, URL-safe,
  // 128 bits of entropy. Collision risk is negligible for our volume.
  return randomBytes(16).toString("base64url");
}

export function trackingPixelHtml(token: string): string {
  return `<img src="${APP_URL}/api/tracking/open/${token}" width="1" height="1" style="display:none;border:0;outline:none;" alt="" />`;
}

/**
 * Rewrite every <a href="..."> in an HTML body so it routes through
 * /api/tracking/click/{token}?to=<encoded original>. Skip anchors
 * that are mailto:, tel:, or already point at the tracking endpoint
 * (idempotent on re-runs).
 *
 * Best-effort regex — Resend's HTML emails are predictable enough
 * that this beats pulling in a full parser. Only rewrites href
 * attributes; ignores form actions, javascript:, and data: URLs.
 */
export function rewriteLinksForTracking(html: string, token: string): string {
  if (!html || !token) return html;
  const base = `${APP_URL}/api/tracking/click/${token}?to=`;
  return html.replace(
    /<a\b([^>]*?)\shref=(["'])([^"']+)\2([^>]*)>/gi,
    (match, pre, quote, url, post) => {
      const lc = url.toLowerCase();
      if (
        lc.startsWith("mailto:") ||
        lc.startsWith("tel:") ||
        lc.startsWith("javascript:") ||
        lc.startsWith("data:") ||
        lc.startsWith(`${APP_URL}/api/tracking/`)
      ) {
        return match;
      }
      const encoded = encodeURIComponent(url);
      return `<a${pre} href=${quote}${base}${encoded}${quote}${post}>`;
    },
  );
}

/**
 * One-stop wrapper used by send routes: rewrite links, append the
 * pixel, return the final HTML. If `token` is empty, returns the
 * input untouched so we never break a fallback path.
 */
export function instrumentHtml(html: string, token: string | null | undefined): string {
  if (!token) return html;
  const rewritten = rewriteLinksForTracking(html, token);
  return `${rewritten}\n${trackingPixelHtml(token)}`;
}

/**
 * 1×1 transparent GIF — what the open-tracking endpoint returns.
 * Inlined here so the endpoint doesn't have to read a file.
 */
export const TRANSPARENT_GIF_BUFFER: Buffer = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
