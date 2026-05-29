/**
 * Phase 53 T3 — inline @mention parser + action-item extractor.
 *
 * Pure function. No DB writes. Called by the meeting-entry save
 * endpoint to surface first-class MeetingActionItem rows from
 * meeting-note markdown.
 *
 * Supported patterns:
 *   @Tina to send Silvadur SDS by Friday        → assignee=Tina, due=Friday
 *   @Tina URGENT: send Silvadur SDS by EOD      → priority=URGENT
 *   @andrew review KUIU response (high priority) by 2026-06-01
 *   [ ] @barth follow up on NY hospitality contracts
 *
 * Name matching: case-insensitive first-name OR email-prefix OR full name.
 * Multiple matches → most-recently-updated user wins. Ambiguous (two
 * Tinas with same first name) → assignee=null + "(@Tina ambiguous —
 * please assign)" appended to description.
 *
 * Priority keywords (case-insensitive, anywhere in the paragraph):
 *   URGENT / "HIGH PRIORITY" / "HIGH" / "LOW PRIORITY" / "LOW".
 *
 * Date parsing: absolute (YYYY-MM-DD, MM/DD/YYYY) + relative (today,
 * tomorrow, EOD, EOW, Monday, "next Friday", "by Friday"). No chrono-
 * node dep — inline regex parser keeps the lib zero-dep.
 */

export type ActionPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface MentionUser {
  id: string;
  name: string | null;
  email: string | null;
  updatedAt?: Date | string | null;
}

export interface ExtractedAction {
  description: string;
  assigneeId: string | null;
  assigneeLabel: string | null;
  priority: ActionPriority;
  dueDate: Date | null;
  /** The raw @handle that triggered the extraction (without the @). */
  rawHandle: string;
  /** Reason the assignee is null, when applicable. */
  ambiguous?: string;
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function normalize(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
}

function emailLocal(email: string | null): string {
  if (!email) return "";
  const idx = email.indexOf("@");
  return idx > 0 ? email.slice(0, idx).toLowerCase() : email.toLowerCase();
}

function matchUserByHandle(
  handle: string,
  users: MentionUser[],
): { user: MentionUser | null; ambiguous: boolean } {
  const h = normalize(handle);
  if (!h) return { user: null, ambiguous: false };

  const candidates: MentionUser[] = [];
  for (const u of users) {
    const name = normalize(u.name);
    const firstName = name.split(/\s+/)[0];
    const local = emailLocal(u.email);
    if (name === h || firstName === h || local === h) {
      candidates.push(u);
    }
  }
  if (candidates.length === 0) return { user: null, ambiguous: false };
  if (candidates.length === 1) return { user: candidates[0], ambiguous: false };
  // Multiple — pick most-recently-updated.
  candidates.sort((a, b) => {
    const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bt - at;
  });
  // Still ambiguous if the top two share the same first name AND
  // updatedAt — flag for manual review.
  const sameName =
    normalize(candidates[0]?.name).split(/\s+/)[0] ===
    normalize(candidates[1]?.name).split(/\s+/)[0];
  return { user: candidates[0], ambiguous: sameName };
}

function detectPriority(text: string): ActionPriority {
  const lower = text.toLowerCase();
  if (/\burgent\b/.test(lower)) return "URGENT";
  if (/\bhigh\s+priority\b/.test(lower) || /\(high\)/.test(lower) || /\bhigh\b/.test(lower)) return "HIGH";
  if (/\blow\s+priority\b/.test(lower) || /\(low\)/.test(lower) || /\blow\b/.test(lower)) return "LOW";
  return "NORMAL";
}

function endOfWeek(now: Date): Date {
  // Friday 23:59 local — interpret as UTC for simplicity.
  const day = now.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday));
  friday.setUTCHours(23, 59, 0, 0);
  return friday;
}

function nextWeekday(now: Date, targetDay: number, allowSameDay = false): Date {
  const today = now.getUTCDay();
  let delta = (targetDay - today + 7) % 7;
  if (delta === 0 && !allowSameDay) delta = 7;
  const d = new Date(now);
  d.setUTCDate(now.getUTCDate() + delta);
  d.setUTCHours(17, 0, 0, 0);
  return d;
}

function detectDueDate(text: string, now: Date = new Date()): Date | null {
  const lower = text.toLowerCase();

  // Absolute YYYY-MM-DD
  const iso = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T17:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Absolute MM/DD/YYYY
  const us = lower.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (us) {
    const d = new Date(`${us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}T17:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Relative
  if (/\beod\b/.test(lower) || /\bend\s+of\s+day\b/.test(lower)) {
    const d = new Date(now);
    d.setUTCHours(23, 59, 0, 0);
    return d;
  }
  if (/\beow\b/.test(lower) || /\bend\s+of\s+week\b/.test(lower)) {
    return endOfWeek(now);
  }
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() + 1);
    d.setUTCHours(17, 0, 0, 0);
    return d;
  }
  if (/\btoday\b/.test(lower)) {
    const d = new Date(now);
    d.setUTCHours(17, 0, 0, 0);
    return d;
  }
  // "by friday" / "next friday" / "this friday" / "monday"
  const dayMatch = lower.match(/\b(?:by\s+|next\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (dayMatch) {
    const target = DAY_NAMES.indexOf(dayMatch[1]);
    if (target >= 0) {
      const isNext = /\bnext\s+/.test(lower);
      return nextWeekday(now, target, !isNext);
    }
  }
  return null;
}

/**
 * Strip the @mention itself from the description so the action-item
 * text reads cleanly (the assignee is captured separately on the row).
 */
function cleanDescription(raw: string, handle: string): string {
  return raw
    .replace(new RegExp(`@${handle}\\b`, "gi"), "")
    .replace(/^\s*[-*]\s*\[\s*\]\s*/, "") // strip "- [ ]" / "* [ ]"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect a section-header line. Section headers carry priority hints
 * that propagate to every @mention bullet below them until the next
 * header. Andrew's Monday Global format uses `**Brand — Priority 1
 * URGENT**` markdown bold-only lines as section delimiters.
 *
 * A line counts as a header when:
 *   - It's `**...**` with the bold markers wrapping the WHOLE trimmed
 *     line (no list bullet, no per-bullet body text), OR
 *   - It's a markdown heading (`#`, `##`, `###`...), OR
 *   - It looks like a label line (single short clause, ends with `:`).
 *
 * Returns the inner header text when a match lands so the priority
 * detector can scan it; null otherwise.
 */
function sectionHeaderText(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Bullet line — skip even if it's all bold-wrapped, since bullets
  // aren't section delimiters in the Monday format.
  if (/^[-*]\s/.test(trimmed)) return null;
  // ## Heading
  const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
  if (headingMatch) return headingMatch[1];
  // **Bold Header** — bold markers must wrap the entire trimmed line.
  const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
  if (boldMatch && !/@/.test(boldMatch[1])) return boldMatch[1];
  return null;
}

/**
 * Split the body into action-item-candidate clauses. Each line OR
 * sentence with an @mention spawns one ExtractedAction.
 *
 * Section-header priority is inherited: when a `**Header**` or `## Header`
 * line carries a priority keyword (URGENT / HIGH PRIORITY / LOW PRIORITY /
 * etc.) every bullet beneath it picks up that priority unless its own
 * sentence overrides with a different keyword. Sentence-level priority
 * always wins over section default; section default beats NORMAL fallback.
 */
export function extractActionItems(
  bodyMd: string,
  users: MentionUser[],
  now: Date = new Date(),
): ExtractedAction[] {
  const out: ExtractedAction[] = [];
  if (!bodyMd) return out;

  let sectionPriority: ActionPriority = "NORMAL";

  // Split on line boundaries first; within each line split on period+space
  // to catch multiple @mentions on the same line.
  const lines = bodyMd.split(/\r?\n/);
  for (const line of lines) {
    // Track section-header priority hints first — a header line never
    // also carries an @mention (the test inside sectionHeaderText() bails
    // out when the header contains '@').
    const headerText = sectionHeaderText(line);
    if (headerText) {
      const p = detectPriority(headerText);
      sectionPriority = p; // reset (including NORMAL — new section without a hint clears prior)
      continue;
    }

    if (!/@/.test(line)) continue;
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z@])/);
    for (const sentence of sentences) {
      const mentionMatches = [...sentence.matchAll(/@([A-Za-z][A-Za-z0-9._-]{1,40})\b/g)];
      if (mentionMatches.length === 0) continue;
      for (const m of mentionMatches) {
        const handle = m[1];
        const { user, ambiguous } = matchUserByHandle(handle, users);
        // Sentence-level priority wins; fall back to the current
        // section's default when the sentence doesn't override.
        const sentencePriority = detectPriority(sentence);
        const priority = sentencePriority === "NORMAL" ? sectionPriority : sentencePriority;
        const dueDate = detectDueDate(sentence, now);
        const cleaned = cleanDescription(sentence, handle);
        if (!cleaned) continue;
        const description = ambiguous
          ? `${cleaned} (@${handle} ambiguous — please assign)`
          : cleaned;
        out.push({
          description,
          assigneeId: ambiguous ? null : user?.id ?? null,
          assigneeLabel: user?.name || user?.email || handle,
          priority,
          dueDate,
          rawHandle: handle,
          ambiguous: ambiguous ? "duplicate-first-name" : (user ? undefined : "no-match"),
        });
      }
    }
  }
  return out;
}
