/**
 * Phase 11D — competitor watch targets.
 *
 * Manually curated list of public product / SDS pages we monitor for
 * material content changes. Each entry must be a page the competitor
 * publishes openly to prospects (i.e. the URL is intended for casual
 * read). We do NOT bypass paywalls, login walls, or robots.txt
 * disallows. We hit each URL at most once per day from one IP, with
 * a clearly identifying User-Agent — same posture as any sales
 * researcher manually checking competitor sites.
 *
 * Add a new target by appending here; the watcher cron picks it up
 * on the next run. Keep `key` stable — it's how snapshots are joined
 * to a competitor in the UI.
 */

export interface CompetitorTarget {
  competitor: string; // display name
  key: string; // stable identifier — used as CompetitorSnapshot.competitor
  url: string;
  kind: "product" | "sds" | "tech-spec" | "press" | "claims";
  notes?: string;
}

export const COMPETITOR_TARGETS: CompetitorTarget[] = [
  // Silvadur (Dow / DuPont) — the leading silver-ion incumbent.
  {
    competitor: "Silvadur (Dow)",
    key: "silvadur",
    url: "https://www.dow.com/en-us/market/mkt-textile/sub-met-textile-antimicrobial.html",
    kind: "product",
    notes:
      "Competitor attribution: Silvadur product landing. Watch for repositioning copy or new tier claims.",
  },
  // Polygiene (Sweden) — heavy retail brand penetration.
  {
    competitor: "Polygiene",
    key: "polygiene",
    url: "https://polygiene.com/stayfresh-technology/",
    kind: "tech-spec",
    notes:
      "Competitor attribution: StayFresh tech page. Watch wash-count language and AATCC 100 method claims.",
  },
  // Sciessent (Agion successor; copper-zinc systems).
  {
    competitor: "Sciessent",
    key: "sciessent",
    url: "https://www.sciessent.com/agion-antimicrobials",
    kind: "product",
    notes: "Competitor attribution: Agion antimicrobial page.",
  },
  // Microban International — broad textile + hard-surface portfolio.
  {
    competitor: "Microban",
    key: "microban",
    url: "https://www.microban.com/antimicrobial-solutions/textile-and-apparel",
    kind: "product",
    notes:
      "Competitor attribution: textile antimicrobial landing. Watch for vertical-specific positioning.",
  },
  // Sanitized AG — Swiss antimicrobial finisher.
  {
    competitor: "Sanitized AG",
    key: "sanitized-ag",
    url: "https://www.sanitized.com/en/technologies",
    kind: "tech-spec",
    notes: "Competitor attribution: technology landing page.",
  },
  // Aegis (Microbe Shield) — quat-based, formerly Dow Corning 5700.
  {
    competitor: "Aegis Microbe Shield",
    key: "aegis",
    url: "https://www.aegisasia.com/products",
    kind: "product",
    notes: "Competitor attribution: products list page.",
  },
];
