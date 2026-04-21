/**
 * Anti-AI-detection scrubber for outbound copy.
 *
 * The BD Wizard generates email + LinkedIn copy through Claude, GPT-4o,
 * Grok, and Perplexity. Every one of those models has telltale habits
 * (em-dashes, three-item parallel lists, certain hedging phrases) that
 * make the copy read as machine-written even when the message is good.
 *
 * `humanize()` runs over every outbound BEFORE Resend dispatch. It is
 * non-optional — the rep doesn't get to bypass it. Reps see the
 * already-humanized draft in the wizard preview, so what they edit is
 * what ships, but if they leave the AI defaults intact the scrubber has
 * already cleaned them.
 *
 * This is intentionally simple and rule-based. We are not trying to
 * "outsmart" detection software — we are trying to make the copy read
 * like a human wrote it, which is the only thing that actually matters.
 *
 * Usage:
 *   import { humanize } from "@/lib/humanize";
 *   const cleaned = humanize(rawDraft);
 *
 * Reference: docs/BD_WIZARD_OVERHAUL.md → "Anti-AI-detection checklist".
 */

/* eslint-disable no-irregular-whitespace */

const BANNED_PHRASES: Array<[RegExp, string]> = [
  // Hedging / throat-clearing tells. AI models default to these openings.
  [/\bEssentially,?\s+/gi, ""],
  [/\bFundamentally,?\s+/gi, ""],
  [/\bIn essence,?\s+/gi, ""],
  [/\bAt its core,?\s+/gi, ""],
  [/\bIt['']s worth noting that\s+/gi, ""],
  [/\bIt should be noted that\s+/gi, ""],
  [/\bPlease note that\s+/gi, ""],
  [/\bThat being said,?\s+/g, "But "],
  [/\bWith that said,?\s+/g, "Still, "],
  [/\bFurthermore,?\s+/g, "Also "],
  [/\bMoreover,?\s+/g, "Plus "],
  [/\bAdditionally,?\s+/g, "Also, "],
  [/\bIn conclusion,?\s+/g, ""],
  [/\bTo summarize,?\s+/g, ""],
  [/\bIn summary,?\s+/g, ""],

  // Sales-AI tells.
  [/\bI hope this email finds you well\b\.?\s*/gi, ""],
  [/\bI hope you['']re doing well\b\.?\s*/gi, ""],
  [/\bI hope this message finds you well\b\.?\s*/gi, ""],
  [/\bI hope all is well\b\.?\s*/gi, ""],
  [/\bI wanted to reach out\b\.?\s*/gi, "Reaching out "],
  [/\bI['']m reaching out to\s+/gi, "Wanted to "],
  [/\bI['']d love to chat\b\.?/gi, "Worth a quick call?"],
  [/\bquick chat\b/gi, "15 minutes"],
  [/\bcircle back\b/gi, "follow up"],
  [/\btouch base\b/gi, "check in"],
  [/\bsynerg(y|ies|istic)\b/gi, "fit"],
  [/\bleverage\b/gi, "use"],
  [/\bunlock\b/gi, "open up"],
  [/\bgame[- ]chang(er|ing|e)\b/gi, "different"],
  [/\bunpack\b/gi, "go through"],
  [/\bdive deeper\b/gi, "get into"],
  [/\bbest practices\b/gi, "what works"],
  [/\bcutting[- ]edge\b/gi, "new"],
  [/\bstate[- ]of[- ]the[- ]art\b/gi, "modern"],
];

/** Em-dash (—) and en-dash (–) → period or comma based on context. */
function killDashes(input: string): string {
  let out = input;
  // Em-dash with surrounding spaces — replace with ". " (sentence break).
  out = out.replace(/\s+—\s+/g, ". ");
  out = out.replace(/\s+–\s+/g, ". ");
  // Em-dash hugging a word (no spaces) — treat as a comma.
  out = out.replace(/—/g, ", ");
  out = out.replace(/–/g, ", ");
  // Smart quotes → straight quotes (also a tell).
  out = out.replace(/[""]/g, '"').replace(/['']/g, "'");
  // Triple-dot ellipsis → single period.
  out = out.replace(/\u2026/g, ".");
  out = out.replace(/\.\.\.+/g, ".");
  return out;
}

/** Apply the banned-phrase list. */
function killBannedPhrases(input: string): string {
  let out = input;
  for (const [pattern, replacement] of BANNED_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Bullet lists scream "AI". For cold emails we strip leading "- " or "* "
 * bullets and collapse them into prose. We DO NOT strip bullets from
 * already-rich HTML — only plain-text drafts.
 */
function killBullets(input: string): string {
  // Lines starting with "- " or "* " or "• " in the first non-space position.
  const lines = input.split(/\r?\n/);
  const stripped = lines.map((line) => line.replace(/^\s*[-*•]\s+/, ""));
  return stripped.join("\n");
}

/**
 * Three-item parallel structures ("fast, reliable, and scalable") are a
 * classic LLM tell. We can't catch every variant, but we can soften
 * the most flagrant ones by collapsing serial-comma triples to pairs.
 *
 * Heuristic: "X, Y, and Z" where X/Y/Z are short single words or
 * very short phrases. Convert to "X and Y" — drop the third.
 *
 * This is destructive on purpose. The third element is almost always
 * filler that the model added for rhythm.
 */
function killParallelTriples(input: string): string {
  return input.replace(
    /\b(\w{2,15}),\s+(\w{2,15}),\s+and\s+(\w{2,15})\b/gi,
    "$1 and $2",
  );
}

/**
 * Collapse double spaces left behind by phrase deletions. Run last.
 */
function tidyWhitespace(input: string): string {
  return input
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:!?])/g, "$1") // no space before punctuation
    .replace(/\n{3,}/g, "\n\n")     // no triple newlines
    .replace(/^\s+|\s+$/g, "");
}

/**
 * Single-pass sentence-case fixup for the rare cases where banned-phrase
 * deletion left a sentence starting with a lowercase letter.
 */
function fixSentenceCase(input: string): string {
  return input.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead, ch) => lead + ch.toUpperCase());
}

export function humanize(input: string): string {
  if (!input) return input;
  let out = input;
  out = killDashes(out);
  out = killBannedPhrases(out);
  out = killBullets(out);
  out = killParallelTriples(out);
  out = tidyWhitespace(out);
  out = fixSentenceCase(out);
  return out;
}

/**
 * Returns a list of warnings for AI tells the scrubber found and removed.
 * Useful for the wizard's "what we cleaned up" callout so reps trust it.
 */
export function diagnose(input: string): string[] {
  const found: string[] = [];
  if (/—|–/.test(input)) found.push("em-dashes");
  if (/\b(Essentially|Fundamentally|In essence|At its core)\b/i.test(input))
    found.push("AI throat-clearing phrases");
  if (/I hope (this|you|all)/i.test(input)) found.push("'I hope this finds you well' opener");
  if (/\b(synerg|leverage|unlock|game.changer)\b/i.test(input))
    found.push("sales-jargon clichés");
  if (/^\s*[-*•]\s+/m.test(input)) found.push("bullet list (don't use in cold emails)");
  if (/[""'']/.test(input)) found.push("smart quotes");
  return found;
}
