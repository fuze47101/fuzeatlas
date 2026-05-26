/**
 * Phase 19 — Claude API translation helper.
 *
 * Translates a batch of (key, enValue) pairs to a target locale,
 * with brand-voice grep + retry. Returns the translated values
 * paired back to their keys. Pure function — no DB / git writes.
 *
 * Brand voice is non-negotiable: every translated value runs
 * through the per-locale ban list before being accepted. If a
 * banned term appears, the key is retried (up to 3 times) with
 * explicit "do not use {term}" guidance. After 3 retries the key
 * is dropped from the result and surfaced in `flagged`.
 */

import type { Locale } from "../i18n/core";

const TRANSLATION_MODEL = process.env.ANTHROPIC_TRANSLATION_MODEL || "claude-haiku-4-5-20251001";

export interface TranslationInput {
  key: string;
  enValue: string;
}

export interface TranslationOutput {
  key: string;
  translatedValue: string;
}

export interface TranslateResult {
  translations: TranslationOutput[];
  flagged: Array<{ key: string; reason: string; lastAttempt: string }>;
  brandVoiceRetries: number;
  apiCalls: number;
  /** Best-effort USD cost estimate based on token counts in API response. */
  estimatedCostUsd: number;
}

/**
 * Per-locale guidance handed to Claude as part of the system prompt.
 * Locks register, script, and the canonical metamaterial term.
 */
const LOCALE_GUIDANCE: Record<Locale, string> = {
  "en": "English. (Source locale — translator is not invoked here.)",
  "zh-CN": "Simplified Chinese, mainland conventions. Use 超材料 for metamaterial.",
  "zh-TW": "Traditional Chinese, Taiwan conventions (软體 not 软件, 滑鼠 not 鼠标). Use 超材料 for metamaterial.",
  "ja": "Japanese in 敬語 (formal). Use メタマテリアル for metamaterial.",
  "ko": "Korean in 존댓말 (formal). Use 메타물질 for metamaterial.",
  "vi": "Vietnamese with full diacritics. Use 'vật liệu siêu cấp' or 'metamaterial' verbatim.",
  "bn": "Bengali (Bangladesh conventions), Bengali script. Use মেটাম্যাটেরিয়াল for metamaterial.",
  "hi": "Hindi in Devanagari, technical register. Use मेटामटीरियल for metamaterial.",
  "ta": "Tamil in professional register. Use மெட்டாமெட்டீரியல் for metamaterial.",
  "th": "Thai in formal register. Use เมตาวัสดุ or metamaterial verbatim.",
  "id": "Indonesian, accepts loanwords. Use 'metamaterial' verbatim.",
  "ms": "Malaysian Malay (distinct from Indonesian). Use 'metamaterial' or 'bahan meta' verbatim.",
  "ur": "Urdu, formal, RTL-aware. Use میٹامیٹیریل for metamaterial.",
  "es": "Spanish, neutral register. Use 'metamaterial' verbatim.",
  "it": "Italian, standard formal. Use 'metamateriale'.",
  "tr": "Turkish, modern. Use 'metamateryal'.",
  "km": "Khmer in industrial register. Use មេតាមេតារៀល for metamaterial.",
};

/**
 * Per-locale banned-word list. ANY hit (case-insensitive) on a
 * translated value triggers a retry. These are the brand-voice
 * leak signatures we've seen historically — see the May 22-24
 * grind in CLAUDE.md for the full per-locale ban-list rationale.
 */
const BANNED_WORDS: Record<Locale, string[]> = {
  "en": ["silver-ion", "silver ion", "silver nanoparticle", "nano-silver", "silver-impregnated"],
  "zh-CN": ["银离子", "纳米银", "纯银", "银纳米", "silver", "nano"],
  "zh-TW": ["銀離子", "奈米銀", "純銀", "銀奈米", "silver", "nano"],
  "ja": ["シルバー", "ナノシルバー", "銀イオン", "銀ナノ", "silver", "nano"],
  "ko": ["은이온", "은나노", "나노실버", "실버나노", "silver", "nano", "나노"],
  "vi": ["bạc nano", "nano-bạc", "ion bạc", "silver", "nano"],
  "bn": ["রূপা", "রুপা", "ন্যানো-রূপা", "ন্যানো রূপা", "silver", "nano"],
  "hi": ["चांदी", "चाँदी", "नैनो", "नैनो-चांदी", "silver", "nano"],
  "ta": ["வெள்ளி நானோ", "நானோ வெள்ளி", "silver", "nano"],
  "th": ["ซิลเวอร์", "นาโน", "นาโนซิลเวอร์", "silver", "nano"],
  "id": ["perak nano", "nano-perak", "perak ion", "silver", "nano"],
  "ms": ["perak nano", "nano-perak", "ion perak", "silver", "nano"],
  "ur": ["چاندی", "نینو", "نانو-چاندی", "نانو چاندی", "silver", "nano"],
  "es": ["plata", "nanoplata", "ion-plata", "nano-plata", "silver", "nano"],
  "it": ["argento", "nano-argento", "nanoparticella d'argento", "ione argento", "silver", "nano"],
  "tr": ["gümüş", "nano-gümüş", "gümüş-iyon", "gümüş iyonu", "silver", "nano"],
  "km": ["ប្រាក់ nano", "nano ប្រាក់", "silver", "nano"],
};

/** Terms that MUST pass through verbatim — never translated. */
const VERBATIM_TERMS = [
  "FUZE",
  "F1",
  "F2",
  "F3",
  "F4",
  "AATCC 100",
  "AATCC 30",
  "ASTM E2149",
  "ISO 20743",
  "ISO 18184",
  "JIS L 1902",
  "OEKO-TEX",
  "bluesign",
  "bluesign®",
  "EPA",
  "PFAS-free",
  "PFAS",
  "Resend",
  "S3",
];

function brandVoiceCheck(
  locale: Locale,
  value: string,
): { ok: true } | { ok: false; hit: string } {
  const banned = BANNED_WORDS[locale] || [];
  const lower = value.toLowerCase();
  for (const term of banned) {
    if (lower.includes(term.toLowerCase())) {
      return { ok: false, hit: term };
    }
  }
  return { ok: true };
}

function buildSystemPrompt(locale: Locale, namespace: string): string {
  const guidance = LOCALE_GUIDANCE[locale] || "translate faithfully";
  const banned = BANNED_WORDS[locale] || [];
  return `You are translating FUZE Atlas UI strings from English to ${locale}.

LOCALE GUIDANCE: ${guidance}

BRAND VOICE — NON-NEGOTIABLE:
- FUZE is an antimicrobial textile treatment. The active ingredient is called "metamaterial" (NEVER silver, NEVER nanoparticle, NEVER Ag, NEVER any transliteration).
- NEVER use any of these terms in ${locale}: ${banned.join(", ")}
- Tier names F1 / F2 / F3 / F4 pass through verbatim.
- Test method names (AATCC 100, ASTM E2149, ISO 20743, JIS L 1902, OEKO-TEX Standard 100, bluesign®, EPA, PFAS-free) pass through verbatim.
- Product brand names (FUZE, Nike, Lululemon, Penfabric, etc.) pass through verbatim.
- Placeholder markers like {n}, {count}, {filename}, {locale} pass through unchanged.

NAMESPACE CONTEXT: ${namespace}

OUTPUT FORMAT — STRICT:
- Return ONLY valid JSON of shape: {"k1": "translated value", "k2": "translated value"}.
- No prose. No code fences. No commentary. Just the JSON object.
- Keys in the response MUST exactly match the keys in the input.
- Each translated value is a single string. No nested objects.`;
}

function buildUserPrompt(
  batch: TranslationInput[],
  retryHints: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push("Translate every value below. Return JSON with the same keys.");
  if (Object.keys(retryHints).length > 0) {
    lines.push("");
    lines.push("RETRY NOTES — these keys leaked banned terms on a previous attempt:");
    for (const [k, hint] of Object.entries(retryHints)) {
      lines.push(`  ${k}: ${hint}`);
    }
  }
  lines.push("");
  lines.push("INPUT:");
  const obj: Record<string, string> = {};
  for (const item of batch) obj[item.key] = item.enValue;
  lines.push(JSON.stringify(obj, null, 2));
  return lines.join("\n");
}

function shouldPassVerbatim(enValue: string): boolean {
  const trimmed = enValue.trim();
  if (!trimmed) return true;
  // If the value is JUST a verbatim term or a placeholder like "{n}", skip translation.
  if (VERBATIM_TERMS.some((t) => trimmed === t)) return true;
  if (/^\{[a-zA-Z0-9_]+\}$/.test(trimmed)) return true;
  // Pure-symbol values (emojis, arrows) and numeric strings — pass.
  if (!/[A-Za-z]/.test(trimmed)) return true;
  return false;
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: TRANSLATION_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content?.[0]?.text || "").trim();
  const usage = data.usage || {};
  return {
    text,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
  };
}

function tryParseJson(text: string): Record<string, string> | null {
  // Strip code fences if Claude wrapped output despite instructions.
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "").replace(/\n?```$/, "").trim();
  }
  // Locate the first `{` and last `}` if there's leading/trailing prose.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0) return null;
  const json = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Estimate USD cost from token counts. Haiku 4.5 pricing as of
 * 2026-05 spec: ~$0.80 / 1M input + $4.00 / 1M output tokens.
 */
function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 0.8 + outputTokens * 4.0) / 1_000_000;
}

export interface TranslateBatchOptions {
  locale: Locale;
  namespace: string;
  keys: TranslationInput[];
  /** Max retries per failed key (brand-voice or shape). Default 3. */
  maxRetriesPerKey?: number;
}

export async function translateBatch(opts: TranslateBatchOptions): Promise<TranslateResult> {
  const { locale, namespace, keys } = opts;
  const maxRetries = opts.maxRetriesPerKey ?? 3;
  const flagged: TranslateResult["flagged"] = [];
  const translations: TranslationOutput[] = [];
  let apiCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let brandVoiceRetries = 0;

  // Pass-through pre-filter.
  const needsTranslation: TranslationInput[] = [];
  for (const k of keys) {
    if (shouldPassVerbatim(k.enValue)) {
      translations.push({ key: k.key, translatedValue: k.enValue });
    } else {
      needsTranslation.push(k);
    }
  }

  if (needsTranslation.length === 0) {
    return {
      translations,
      flagged,
      brandVoiceRetries,
      apiCalls,
      estimatedCostUsd: 0,
    };
  }

  const systemPrompt = buildSystemPrompt(locale, namespace);

  // Initial batched call.
  let pending: TranslationInput[] = [...needsTranslation];
  const retryHints: Record<string, string> = {};
  let attempt = 0;

  while (pending.length > 0 && attempt <= maxRetries) {
    const userPrompt = buildUserPrompt(pending, retryHints);
    let text: string;
    try {
      apiCalls++;
      const call = await callClaude(systemPrompt, userPrompt);
      text = call.text;
      totalInputTokens += call.inputTokens;
      totalOutputTokens += call.outputTokens;
    } catch (e: any) {
      // Network / API error — flag all pending and bail.
      for (const p of pending) {
        flagged.push({ key: p.key, reason: `api-error: ${e?.message}`, lastAttempt: "" });
      }
      break;
    }
    const parsed = tryParseJson(text);
    if (!parsed) {
      // Bad shape — single retry with "format reminder", else flag.
      if (attempt < maxRetries) {
        attempt++;
        retryHints["__format__"] = "Your previous response was not valid JSON. Return ONLY {key:value} JSON.";
        continue;
      }
      for (const p of pending) {
        flagged.push({ key: p.key, reason: "claude-bad-shape", lastAttempt: text.slice(0, 200) });
      }
      break;
    }

    const nextPending: TranslationInput[] = [];
    for (const p of pending) {
      const v = parsed[p.key];
      if (typeof v !== "string" || !v.trim()) {
        // Missing from response — retry this one.
        if (attempt < maxRetries) {
          nextPending.push(p);
          retryHints[p.key] = "You did not return a value for this key. Translate it now.";
        } else {
          flagged.push({ key: p.key, reason: "missing-from-response", lastAttempt: "" });
        }
        continue;
      }
      const brand = brandVoiceCheck(locale, v);
      if (!brand.ok) {
        brandVoiceRetries++;
        if (attempt < maxRetries) {
          nextPending.push(p);
          retryHints[p.key] = `Previous attempt used "${brand.hit}". Do NOT use that word. Use the FUZE / metamaterial brand voice instead.`;
        } else {
          flagged.push({
            key: p.key,
            reason: `brand-voice-leak: ${brand.hit}`,
            lastAttempt: v,
          });
        }
        continue;
      }
      translations.push({ key: p.key, translatedValue: v });
      // Clear any retry hint we had for this key
      delete retryHints[p.key];
    }
    pending = nextPending;
    attempt++;
  }

  return {
    translations,
    flagged,
    brandVoiceRetries,
    apiCalls,
    estimatedCostUsd: estimateCost(totalInputTokens, totalOutputTokens),
  };
}
