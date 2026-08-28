/**
 * Operating Calendar — shared types, owner gate, and the runway engine.
 *
 * The runway engine is the point of the board: it takes every event that
 * holds time, marks those days occupied, and reports each surviving gap
 * three ways — calendar days, business days, and business days
 * simultaneously clear across all five Asia target countries. Column three
 * is what decides where remaining Asia travel can land.
 */

export const HORIZON_START = "2026-08-01";
export const HORIZON_END = "2027-01-31";

/** Only this account may read or write the board. Not role-based on purpose. */
export const OWNER_EMAIL = "andrew@801inc.com";

export function isOwner(email?: string | null): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL;
}

/**
 * The three copies. Masking is applied SERVER-SIDE in the API before the
 * response is serialised — a masked view never ships the real title or
 * detail to the browser. Switching tabs refetches; it does not unhide
 * something the client already holds. That is the whole point.
 */
export type View = "all" | "fuze" | "ledge";

export const MASK_PERSONAL = "Unavailable";
export const MASK_BIZ = "Business commitment";

export const VIEWS: { key: View; label: string; note: string }[] = [
  { key: "all", label: "Combined", note: "Everything named. Yours only — do not hand this out." },
  { key: "fuze", label: "FUZE", note: "FUZE named. Ledge/Pulse and personal both masked." },
  {
    key: "ledge",
    label: "Ledge / Pulse",
    note: "Ledge/Pulse named. FUZE and personal both masked.",
  },
];

/** Dates and durations always survive; only the name and detail are withheld. */
export function project<T extends BoardEvent>(ev: T, view: View): T {
  if (view === "all") return ev;
  if (ev.isPrivate) {
    return { ...ev, title: MASK_PERSONAL, detail: null, lane: "mask", isShow: false };
  }
  const mine = view === "fuze" ? "fuze" : "ledge";
  if (ev.account !== mine) {
    return { ...ev, title: MASK_BIZ, detail: null, lane: "mask", isShow: false };
  }
  return ev;
}

export interface BoardEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  lane: string;
  account: string | null;
  status: string;
  isPrivate: boolean;
  isShow: boolean;
  holds: boolean;
  detail: string | null;
}

/** Hard public-holiday closures across the five Asia target countries. */
export const BLACKOUTS: { country: string; name: string; s: string; e: string }[] = [
  { country: "Japan", name: "Silver Week", s: "2026-09-19", e: "2026-09-23" },
  { country: "Japan", name: "Sports Day", s: "2026-10-12", e: "2026-10-12" },
  { country: "Japan", name: "Culture Day", s: "2026-11-03", e: "2026-11-03" },
  { country: "Japan", name: "Labor Thanksgiving", s: "2026-11-23", e: "2026-11-23" },
  { country: "Japan", name: "New Year shutdown", s: "2026-12-29", e: "2027-01-04" },
  { country: "Japan", name: "Coming of Age Day", s: "2027-01-11", e: "2027-01-11" },
  { country: "Korea", name: "Chuseok", s: "2026-09-24", e: "2026-09-26" },
  { country: "Korea", name: "New Year", s: "2027-01-01", e: "2027-01-01" },
  { country: "Taiwan", name: "Mid-Autumn", s: "2026-09-25", e: "2026-09-25" },
  { country: "Taiwan", name: "Double Ten (obs.)", s: "2026-10-09", e: "2026-10-09" },
  { country: "Taiwan", name: "Retrocession (obs.)", s: "2026-10-26", e: "2026-10-26" },
  { country: "Taiwan", name: "Constitution Day", s: "2026-12-25", e: "2026-12-25" },
  { country: "Taiwan", name: "New Year", s: "2027-01-01", e: "2027-01-01" },
  { country: "China", name: "Mid-Autumn", s: "2026-09-25", e: "2026-09-27" },
  { country: "China", name: "Golden Week", s: "2026-10-01", e: "2026-10-07" },
  { country: "China", name: "New Year", s: "2027-01-01", e: "2027-01-03" },
  { country: "Vietnam", name: "National Day", s: "2026-09-01", e: "2026-09-02" },
  { country: "Vietnam", name: "New Year", s: "2027-01-01", e: "2027-01-01" },
];

const DAY = 86_400_000;
const toUTC = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");

export interface Window {
  start: string;
  end: string;
  calendarDays: number;
  businessDays: number;
  asiaClearDays: number;
  verdict: string;
}

export function computeRunway(events: BoardEvent[], minDays = 3): Window[] {
  const start = toUTC(HORIZON_START);
  const total = Math.round((toUTC(HORIZON_END) - start) / DAY) + 1;
  const idx = (iso: string) => Math.round((toUTC(iso) - start) / DAY);

  const occupied = new Array<boolean>(total).fill(false);
  for (const ev of events) {
    if (!ev.holds) continue;
    for (let i = Math.max(0, idx(ev.startDate)); i <= Math.min(total - 1, idx(ev.endDate)); i++) {
      occupied[i] = true;
    }
  }

  const closed = new Array<boolean>(total).fill(false);
  for (const b of BLACKOUTS) {
    for (let i = Math.max(0, idx(b.s)); i <= Math.min(total - 1, idx(b.e)); i++) closed[i] = true;
  }

  const out: Window[] = [];
  let i = 0;
  while (i < total) {
    if (occupied[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < total && !occupied[j + 1]) j++;
    let business = 0;
    let asiaClear = 0;
    for (let k = i; k <= j; k++) {
      const dow = new Date(start + k * DAY).getUTCDay();
      if (dow !== 0 && dow !== 6) {
        business++;
        if (!closed[k]) asiaClear++;
      }
    }
    const calendarDays = j - i + 1;
    if (calendarDays >= minDays) {
      out.push({
        start: new Date(start + i * DAY).toISOString().slice(0, 10),
        end: new Date(start + j * DAY).toISOString().slice(0, 10),
        calendarDays,
        businessDays: business,
        asiaClearDays: asiaClear,
        verdict:
          asiaClear >= 10
            ? "Asia-capable"
            : asiaClear >= 5
              ? "Partial Asia"
              : business >= 3
                ? "Domestic only"
                : "Short block",
      });
    }
    i = j + 1;
  }
  return out;
}

/** Overlapping pairs where both sides hold time. Same-trip pairs are noise. */
export function findConflicts(events: BoardEvent[]): [BoardEvent, BoardEvent][] {
  const held = events.filter((e) => e.holds);
  const out: [BoardEvent, BoardEvent][] = [];
  for (let a = 0; a < held.length; a++) {
    for (let b = a + 1; b < held.length; b++) {
      const x = held[a];
      const y = held[b];
      if (toUTC(x.startDate) <= toUTC(y.endDate) && toUTC(y.startDate) <= toUTC(x.endDate)) {
        out.push([x, y]);
      }
    }
  }
  return out;
}
