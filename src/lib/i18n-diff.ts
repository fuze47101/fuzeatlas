/**
 * Phase 19 — i18n coverage diff helper.
 *
 * Walks every leaf string in en.ts vs a target locale and reports
 * which keys are missing (key path doesn't exist) and which are
 * empty (string === "" OR string === English copy on a phrase >3
 * words — heuristic catches "didn't translate, just pasted").
 *
 * Pure read-only. No mutation. The translate-missing-keys cron
 * consumes this output to figure out what to send to Claude.
 */

import en from "../i18n/en";
import { getTranslations, type Locale, LOCALES } from "../i18n/core";

export interface LeafKey {
  /** Dot-path from root (e.g. "factoryPortal.intake.fieldLabel"). */
  path: string;
  enValue: string;
}

export interface LocaleDiff {
  locale: string;
  missingKeys: string[];
  emptyKeys: string[];
  totalEnKeys: number;
  totalLocaleKeys: number;
  coverage: number; // 0.0 to 1.0
}

/**
 * Walks an object tree, calling cb(path, value) for every leaf string.
 * Objects nested arbitrarily deep are traversed; non-string leaves
 * (numbers, booleans, arrays) are ignored — we only translate text.
 */
export function walkLeaves(obj: any, cb: (path: string, value: string) => void, prefix = "") {
  if (obj == null) return;
  if (typeof obj === "string") {
    cb(prefix, obj);
    return;
  }
  if (Array.isArray(obj)) {
    // Skip arrays — i18n leaves are always strings in our schema.
    return;
  }
  if (typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    walkLeaves(v, cb, path);
  }
}

/** Read a dot-path against an object. Returns undefined if any segment missing. */
function readPath(obj: any, path: string): any {
  const segments = path.split(".");
  let cur: any = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[seg];
  }
  return cur;
}

export function collectEnLeaves(): LeafKey[] {
  const leaves: LeafKey[] = [];
  walkLeaves(en, (path, value) => {
    leaves.push({ path, enValue: value });
  });
  return leaves;
}

export async function diffLocale(locale: Locale): Promise<LocaleDiff> {
  const target: any = getTranslations(locale);
  const enLeaves = collectEnLeaves();
  const missingKeys: string[] = [];
  const emptyKeys: string[] = [];
  let totalLocaleKeys = 0;

  for (const leaf of enLeaves) {
    const localeValue = readPath(target, leaf.path);
    if (localeValue === undefined) {
      missingKeys.push(leaf.path);
      continue;
    }
    if (typeof localeValue !== "string") {
      // Shape mismatch — locale has an object where en has a string.
      missingKeys.push(leaf.path);
      continue;
    }
    totalLocaleKeys++;
    const trimmed = localeValue.trim();
    if (trimmed === "") {
      emptyKeys.push(leaf.path);
      continue;
    }
    // English-copy detection — only flag when the English is more
    // than 3 words; short labels like "Save", "OK" are legitimately
    // identical across many languages and shouldn't be flagged.
    const enWordCount = leaf.enValue.trim().split(/\s+/).filter(Boolean).length;
    if (enWordCount > 3 && trimmed === leaf.enValue.trim()) {
      emptyKeys.push(leaf.path);
    }
  }

  const totalEnKeys = enLeaves.length;
  const covered = totalEnKeys - missingKeys.length - emptyKeys.length;
  return {
    locale,
    missingKeys,
    emptyKeys,
    totalEnKeys,
    totalLocaleKeys,
    coverage: totalEnKeys === 0 ? 1 : covered / totalEnKeys,
  };
}

export async function diffAllLocales(): Promise<LocaleDiff[]> {
  const targets = LOCALES.map((l) => l.code).filter((c) => c !== "en") as Locale[];
  const results: LocaleDiff[] = [];
  for (const loc of targets) {
    results.push(await diffLocale(loc));
  }
  return results;
}

/**
 * Group a list of dot-path keys by their top-level namespace.
 * "factoryPortal.intake.foo" + "factoryPortal.intake.bar" → both
 * land under "factoryPortal". Used by the cron to batch Claude
 * calls per namespace for context.
 */
export function groupByNamespace(keys: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of keys) {
    const ns = k.split(".")[0];
    (out[ns] ||= []).push(k);
  }
  return out;
}
