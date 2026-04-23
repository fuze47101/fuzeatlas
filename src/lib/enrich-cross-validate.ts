// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════
 * Enrich cross-validation — take per-source contact signals from Apollo +
 * up to 4 AI models, group them by person, and score per-field agreement.
 *
 * The point: stop writing unverified emails and LinkedIn URLs to contacts
 * when 2+ independent sources agree. "They should all validate" — Andrew.
 *
 * Definitions:
 *   - A "candidate" is one person mentioned by ≥1 source. Keyed by a fuzzy
 *     name slug (lowercase, whitespace-collapsed, punctuation stripped).
 *   - Each source's claim about a candidate is a `ContactClaim`.
 *   - Cross-validation bundles claims by candidate + scores each field.
 *
 * Email agreement:
 *   - Normalise to lowercase, trim. Group by normalised string.
 *   - `emailAgreement` = count of sources claiming the same email
 *   - `emailVerdict`:
 *       "verified"    → Apollo email_status="verified" OR 3+ AI sources agree
 *       "cross_agreed"→ 2+ AI sources agree (no Apollo verify)
 *       "single"      → only 1 source has it
 *       "disputed"    → multiple sources disagree (different values)
 *       "none"        → nobody returned an email
 *
 * LinkedIn agreement (similar):
 *   - Normalise URL (strip trailing slash, lowercase host, drop protocol,
 *     strip www., drop query/hash).
 *   - Verdict scale same as email.
 *
 * Title agreement:
 *   - Loose — pick the most common source, but don't veto. Titles mutate
 *     ("VP Product" vs "Vice President, Product"); we don't gate writes on
 *     title agreement.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type SourceName = "apollo" | "anthropic" | "openai" | "grok" | "perplexity";

export type ContactClaim = {
  source: SourceName;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  /** Apollo-only — "verified", "extrapolated", "likely_to_engage", etc. */
  emailStatus?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  seniority?: string | null;
  apolloId?: string | null;
  priority?: number | null;
  relevance?: string | null;
  /** AI-only — the model's own "verified|likely|estimated" self-assessment. */
  emailConfidence?: string | null;
};

export type FieldAgreement<T> = {
  value: T | null;
  /** How many sources claim this value. */
  sources: SourceName[];
  /** "verified" | "cross_agreed" | "single" | "disputed" | "none". */
  verdict: "verified" | "cross_agreed" | "single" | "disputed" | "none";
  /** Every distinct candidate value + who claimed it. */
  alternatives: Array<{ value: T; sources: SourceName[] }>;
};

export type CandidateRecord = {
  /** Slug used to match across sources — `firstlast` lowercase, punctuation stripped. */
  key: string;
  /** Display name — picked from the longest claim. */
  displayName: string;
  /** Fast source lookup — [source] → the claim that source made. */
  perSource: Partial<Record<SourceName, ContactClaim>>;
  email: FieldAgreement<string>;
  linkedin: FieldAgreement<string>;
  title: FieldAgreement<string>;
  phone: FieldAgreement<string>;
  /** Apollo person-id if present. Used by the V1 enrich endpoint for 0-credit re-reveals. */
  apolloId: string | null;
  /** Best per-source priority (lower = higher priority per research prompt). */
  priority: number | null;
  /** Combined "why they matter" text — picks the longest available relevance string. */
  relevance: string | null;
  /** Combined seniority — first non-null across sources, Apollo wins. */
  seniority: string | null;
  /** All sources that mentioned this person at all. */
  mentionedBy: SourceName[];
};

// ─── Normalisers ────────────────────────────────────────────────────────

export function slugName(name: string | null | undefined): string {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliseEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const t = String(email).trim().toLowerCase();
  if (!t) return null;
  return t;
}

export function normaliseLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = String(url).trim();
  if (!t) return null;
  try {
    const withProto = t.startsWith("http") ? t : `https://${t}`;
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    // Drop trailing slashes, query, fragment.
    let path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    // Collapse /mwlite/in/x → /in/x for agreement scoring.
    path = path.replace(/^\/mwlite\/in\//, "/in/");
    return `${host}${path}`;
  } catch {
    return t.toLowerCase().replace(/\/+$/, "");
  }
}

// ─── Core grouper ───────────────────────────────────────────────────────

/**
 * Group all source claims by candidate slug. `pushFrom(source, contacts)` is
 * the shape each caller uses — e.g. pushFrom("anthropic", anthropicResult?.contacts).
 */
export function buildCandidates(
  claimsBySource: Partial<Record<SourceName, ContactClaim[]>>,
): CandidateRecord[] {
  const byKey = new Map<string, CandidateRecord>();

  for (const source of Object.keys(claimsBySource) as SourceName[]) {
    const claims = claimsBySource[source] || [];
    for (const claim of claims) {
      const key = slugName(claim.name);
      if (!key) continue;
      let rec = byKey.get(key);
      if (!rec) {
        rec = {
          key,
          displayName: claim.name || "",
          perSource: {},
          email: emptyAgreement(),
          linkedin: emptyAgreement(),
          title: emptyAgreement(),
          phone: emptyAgreement(),
          apolloId: null,
          priority: null,
          relevance: null,
          seniority: null,
          mentionedBy: [],
        };
        byKey.set(key, rec);
      }
      rec.perSource[source] = { ...claim, source };
      rec.mentionedBy.push(source);
      if ((claim.name?.length || 0) > rec.displayName.length) {
        rec.displayName = claim.name || rec.displayName;
      }
      if (claim.apolloId) rec.apolloId = claim.apolloId;
      if (
        typeof claim.priority === "number" &&
        (rec.priority === null || claim.priority < rec.priority)
      ) {
        rec.priority = claim.priority;
      }
      if (claim.relevance && (!rec.relevance || claim.relevance.length > rec.relevance.length)) {
        rec.relevance = claim.relevance;
      }
      if (claim.seniority && !rec.seniority) rec.seniority = claim.seniority;
    }
  }

  // Now score each field for every candidate.
  for (const rec of byKey.values()) {
    rec.email = scoreField(rec, (c) => normaliseEmail(c.email));
    rec.linkedin = scoreField(rec, (c) => normaliseLinkedIn(c.linkedin));
    rec.title = scoreField(rec, (c) => (c.title ? String(c.title).trim() : null));
    rec.phone = scoreField(rec, (c) => (c.phone ? String(c.phone).trim() : null));

    // Promote email to "verified" if Apollo explicitly confirms, regardless
    // of AI agreement count. Apollo's email_status is the gold signal.
    const apolloClaim = rec.perSource.apollo;
    if (apolloClaim?.emailStatus === "verified" && apolloClaim.email) {
      const apolloEmailNorm = normaliseEmail(apolloClaim.email);
      if (apolloEmailNorm && rec.email.value === apolloEmailNorm) {
        rec.email.verdict = "verified";
      }
    }
  }

  // Sort: higher priority (lower number) first, Apollo-verified first, then AI-agreed.
  return Array.from(byKey.values()).sort((a, b) => {
    const aVerified = a.email.verdict === "verified" ? 0 : 1;
    const bVerified = b.email.verdict === "verified" ? 0 : 1;
    if (aVerified !== bVerified) return aVerified - bVerified;
    const aPri = a.priority ?? 99;
    const bPri = b.priority ?? 99;
    if (aPri !== bPri) return aPri - bPri;
    return b.mentionedBy.length - a.mentionedBy.length;
  });
}

function emptyAgreement<T>(): FieldAgreement<T> {
  return { value: null, sources: [], verdict: "none", alternatives: [] };
}

function scoreField<T>(
  rec: CandidateRecord,
  extract: (c: ContactClaim) => T | null,
): FieldAgreement<T> {
  const groups = new Map<string, { value: T; sources: SourceName[] }>();
  for (const source of Object.keys(rec.perSource) as SourceName[]) {
    const claim = rec.perSource[source]!;
    const v = extract(claim);
    if (v === null || v === undefined || v === "") continue;
    const k = typeof v === "string" ? v : JSON.stringify(v);
    const entry = groups.get(k);
    if (entry) entry.sources.push(source);
    else groups.set(k, { value: v, sources: [source] });
  }
  const alternatives = Array.from(groups.values()).sort(
    (a, b) => b.sources.length - a.sources.length,
  );
  if (alternatives.length === 0) {
    return { value: null, sources: [], verdict: "none", alternatives: [] };
  }
  // Pick the most-supported alternative.
  const top = alternatives[0];
  const distinctValues = alternatives.length;
  const supportCount = top.sources.length;

  let verdict: FieldAgreement<T>["verdict"];
  const hasApollo = top.sources.includes("apollo");
  if (hasApollo && supportCount >= 2) verdict = "verified";
  else if (supportCount >= 3) verdict = "verified";
  else if (supportCount >= 2) verdict = "cross_agreed";
  else if (distinctValues > 1) verdict = "disputed";
  else verdict = "single";

  return { value: top.value, sources: top.sources, verdict, alternatives };
}

// ─── Contact write policy ───────────────────────────────────────────────

export type WriteDecision = {
  /** Should we actually write this value to the Contact row? */
  write: boolean;
  /** Human-readable reason — goes into the audit Note. */
  reason: string;
};

/**
 * Decide whether to overwrite Contact.email.
 *
 * Rules (conservative — never overwrite a curated value unless verified):
 *  1. If `current` is null/empty → write on verdict >= cross_agreed OR Apollo single claim
 *  2. If `current` exists and matches the proposed value → no-op (confirm only)
 *  3. If `current` exists and DIFFERS → only overwrite on verdict === "verified"
 */
export function shouldWriteEmail(
  current: string | null | undefined,
  proposal: FieldAgreement<string>,
): WriteDecision {
  if (!proposal.value) return { write: false, reason: "no proposal" };
  const currentNorm = normaliseEmail(current);
  if (!currentNorm) {
    if (proposal.verdict === "verified" || proposal.verdict === "cross_agreed") {
      return { write: true, reason: `filling empty field (${proposal.verdict}, ${proposal.sources.length} sources)` };
    }
    if (proposal.verdict === "single" && proposal.sources[0] === "apollo") {
      return { write: true, reason: "filling empty field (Apollo single source)" };
    }
    return { write: false, reason: `single AI source only (${proposal.sources.join(",")})` };
  }
  if (currentNorm === proposal.value) {
    return { write: false, reason: `confirmed existing value (${proposal.sources.length} sources)` };
  }
  if (proposal.verdict === "verified") {
    return { write: true, reason: `overwriting different value — verified by ${proposal.sources.join(",")}` };
  }
  return { write: false, reason: `existing value differs — proposal only ${proposal.verdict}` };
}

export function shouldWriteLinkedIn(
  current: string | null | undefined,
  proposal: FieldAgreement<string>,
): WriteDecision {
  if (!proposal.value) return { write: false, reason: "no proposal" };
  const currentNorm = normaliseLinkedIn(current);
  if (!currentNorm) {
    if (proposal.verdict === "verified" || proposal.verdict === "cross_agreed") {
      return { write: true, reason: `filling empty field (${proposal.verdict}, ${proposal.sources.length} sources)` };
    }
    if (proposal.verdict === "single" && proposal.sources[0] === "apollo") {
      return { write: true, reason: "filling empty field (Apollo single source)" };
    }
    return { write: false, reason: `single AI source only (${proposal.sources.join(",")})` };
  }
  if (currentNorm === proposal.value) {
    return { write: false, reason: `confirmed existing value (${proposal.sources.length} sources)` };
  }
  if (proposal.verdict === "verified") {
    return { write: true, reason: `overwriting different value — verified by ${proposal.sources.join(",")}` };
  }
  return { write: false, reason: `existing value differs — proposal only ${proposal.verdict}` };
}

/** Map agreement verdict → Contact.emailStatus vocabulary. */
export function emailStatusFromVerdict(v: FieldAgreement<string>["verdict"]): string {
  switch (v) {
    case "verified":
      return "verified";
    case "cross_agreed":
      return "cross_validated";
    case "single":
      return "extrapolated";
    case "disputed":
      return "disputed";
    case "none":
    default:
      return "unknown";
  }
}
