// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════
 * Domain reachability check
 *
 * Lightweight probe used by the BD Wizard (and anywhere else we surface
 * a brand website) to flag dead / parked / unreachable domains BEFORE
 * the rep tries to enrich or email based on them. Active Line Corp
 * regression: activelinecorp.com shipped as a valid link on the brand
 * header but was actually dead, so every downstream action failed.
 *
 * This does NOT validate that the site is "their site" — only that the
 * hostname resolves, responds with a 2xx/3xx/401/403, and isn't an
 * obvious parking page. It's a first-pass filter, not a security check.
 *
 * Called from:
 *   - GET /api/util/domain-check?url=...      (on-demand from the wizard)
 *   - src/app/admin/bd/wizard/page.tsx        (auto-probes current brand)
 *
 * Results are intentionally coarse:
 *   - "reachable" — HEAD or GET returned a usable response
 *   - "parked"    — reachable but content looks like a parking / for-sale page
 *   - "unreachable" — DNS failure, connection refused, SSL error, timeout
 *   - "blocked"   — 4xx/5xx >= 500 or bot protection
 * ═══════════════════════════════════════════════════════════════════════
 */

export type DomainStatus = "reachable" | "parked" | "unreachable" | "blocked" | "unknown";

export interface DomainCheckResult {
  input: string;
  normalizedUrl: string | null;
  hostname: string | null;
  status: DomainStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  /** Soft reason shown to the rep — 1 line. */
  message: string;
  /** Heuristics that fired, for debugging. */
  signals: string[];
  checkedAt: string;
}

// Lowercase hostname fragments we treat as parking / for-sale indicators.
// If the final URL or response body contains any of these, status becomes "parked".
const PARK_DOMAINS = [
  "sedoparking.com",
  "parkingcrew.net",
  "parklogic.com",
  "bodis.com",
  "afternic.com",
  "dan.com",
  "hugedomains.com",
  "namecheap.com/domains/registered",
  "godaddy.com/domainsearch",
  "uniregistry.com",
];

const PARK_BODY_MARKERS = [
  "this domain is for sale",
  "domain for sale",
  "buy this domain",
  "is available for purchase",
  "may be for sale",
  "parked free courtesy of",
  "domain parking",
  "inquire about this domain",
];

function normalizeUrl(input: string): { url: string; host: string } | null {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  // Strip mailto:, tel:, etc.
  if (/^(mailto|tel|javascript):/i.test(raw)) return null;
  // Prepend scheme if missing
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (!host || !host.includes(".") || host === "localhost") return null;
    return { url: u.toString(), host };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...(init || {}),
      signal: ctrl.signal,
      // Don't auto-follow to landing pages of registrars if they 30x us there
      redirect: "follow",
      headers: {
        // Pretend to be a real browser — some hosts 403 generic bot UAs
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) FUZE-Atlas-DomainCheck/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe a URL/hostname. Uses HEAD first (cheap), falls back to GET when
 * the server rejects HEAD (surprisingly common). Returns a structured
 * verdict — never throws.
 */
export async function checkDomain(input: string, timeoutMs = 6000): Promise<DomainCheckResult> {
  const at = new Date().toISOString();
  const normalized = normalizeUrl(input);
  if (!normalized) {
    return {
      input,
      normalizedUrl: null,
      hostname: null,
      status: "unknown",
      httpStatus: null,
      finalUrl: null,
      message: "Not a valid URL or hostname.",
      signals: ["invalid-input"],
      checkedAt: at,
    };
  }

  const signals: string[] = [];
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let bodyForParkCheck: string | null = null;

  // ── Try HEAD ──
  try {
    const head = await fetchWithTimeout(normalized.url, timeoutMs, { method: "HEAD" });
    httpStatus = head.status;
    finalUrl = head.url;
    signals.push(`head:${head.status}`);
  } catch (err: any) {
    signals.push(`head-error:${err?.name || "unknown"}`);
  }

  // ── Try GET if HEAD failed or returned a 4xx/5xx — many parking / CDN
  //    setups only answer GET, and we need the body anyway to sniff parking. ──
  const needsGet =
    httpStatus === null || httpStatus >= 400 || (httpStatus >= 300 && httpStatus < 400);

  if (needsGet) {
    try {
      const get = await fetchWithTimeout(normalized.url, timeoutMs, { method: "GET" });
      httpStatus = get.status;
      finalUrl = get.url;
      signals.push(`get:${get.status}`);
      // Only read first 16kb — enough to see parking markers, cheap on memory
      try {
        const reader = get.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let total = "";
          while (total.length < 16384) {
            const { done, value } = await reader.read();
            if (done) break;
            total += decoder.decode(value, { stream: true });
          }
          bodyForParkCheck = total.toLowerCase();
          try {
            await reader.cancel();
          } catch {
            // best-effort
          }
        }
      } catch (e: any) {
        signals.push(`body-read-error:${e?.name || "unknown"}`);
      }
    } catch (err: any) {
      signals.push(`get-error:${err?.name || "unknown"}`);
    }
  }

  // ── Verdict ──
  if (httpStatus === null) {
    return {
      input,
      normalizedUrl: normalized.url,
      hostname: normalized.host,
      status: "unreachable",
      httpStatus: null,
      finalUrl: null,
      message:
        "Domain did not respond. DNS, SSL, connection refused, or timed out — treat as dead.",
      signals,
      checkedAt: at,
    };
  }

  // Redirected to a park/registrar domain?
  let parkedByFinalUrl = false;
  try {
    if (finalUrl) {
      const fu = new URL(finalUrl);
      const fhost = fu.hostname.toLowerCase();
      if (PARK_DOMAINS.some((p) => fhost.includes(p.split("/")[0]))) {
        parkedByFinalUrl = true;
        signals.push(`final-park-host:${fhost}`);
      }
    }
  } catch {
    // Ignore malformed final-url
  }

  // Parking markers in body?
  let parkedByBody = false;
  if (bodyForParkCheck) {
    for (const marker of PARK_BODY_MARKERS) {
      if (bodyForParkCheck.includes(marker)) {
        parkedByBody = true;
        signals.push(`park-marker:${marker.slice(0, 30)}`);
        break;
      }
    }
  }

  if (parkedByFinalUrl || parkedByBody) {
    return {
      input,
      normalizedUrl: normalized.url,
      hostname: normalized.host,
      status: "parked",
      httpStatus,
      finalUrl,
      message:
        "Domain resolves but looks like a parking / for-sale page. Treat as dead for outreach.",
      signals,
      checkedAt: at,
    };
  }

  if (httpStatus >= 500) {
    return {
      input,
      normalizedUrl: normalized.url,
      hostname: normalized.host,
      status: "blocked",
      httpStatus,
      finalUrl,
      message: `Server returned ${httpStatus}. Likely transient — worth a manual re-check later.`,
      signals,
      checkedAt: at,
    };
  }

  if (httpStatus === 404 || httpStatus === 410) {
    return {
      input,
      normalizedUrl: normalized.url,
      hostname: normalized.host,
      status: "unreachable",
      httpStatus,
      finalUrl,
      message: `Host resolves but root URL returned ${httpStatus}. Site may be down or moved.`,
      signals,
      checkedAt: at,
    };
  }

  if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 401 && httpStatus !== 403) {
    return {
      input,
      normalizedUrl: normalized.url,
      hostname: normalized.host,
      status: "blocked",
      httpStatus,
      finalUrl,
      message: `Unexpected ${httpStatus}. Review manually before trusting this domain.`,
      signals,
      checkedAt: at,
    };
  }

  return {
    input,
    normalizedUrl: normalized.url,
    hostname: normalized.host,
    status: "reachable",
    httpStatus,
    finalUrl,
    message: "Reachable.",
    signals,
    checkedAt: at,
  };
}
