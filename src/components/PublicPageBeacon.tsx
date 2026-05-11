"use client";

/**
 * <PublicPageBeacon path={...} /> — Phase 12G.
 *
 * Fires one navigator.sendBeacon to /api/public/page-view per
 * page render. No-op on bots (heuristic UA check) and on dev-mode
 * double-mounts (guarded by a sessionStorage key per session).
 * Drop into every public page server component.
 */
import { useEffect } from "react";

const BOT_UA = /\b(googlebot|bingbot|slurp|yandex|baiduspider|duckduckbot|sogou|exabot|facebot|ia_archiver|twitterbot|linkedinbot|whatsapp|crawl|spider|bot)\b/i;

export default function PublicPageBeacon({ path }: { path: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined") return;
    if (BOT_UA.test(navigator.userAgent)) return;

    const key = `fz-pv:${path}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // ignore — Safari private mode etc.
    }

    const payload = JSON.stringify({
      path,
      referer: document.referrer || null,
    });
    const blob = new Blob([payload], { type: "application/json" });
    const ok = navigator.sendBeacon?.("/api/public/page-view", blob);
    if (!ok) {
      // Fallback to fetch if sendBeacon is missing.
      fetch("/api/public/page-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, [path]);
  return null;
}
