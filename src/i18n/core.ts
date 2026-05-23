/**
 * Pure, server-compatible i18n core. No "use client" — safe to import from
 * server components (e.g., printable PDFs rendered server-side).
 *
 * Client-side React Context bits live in `./index.ts` (which re-exports
 * from here). Server components should import from `./core` or use
 * `./server` (which reads the locale from a cookie).
 */
import en from "./en";
import zhTW from "./zh-TW";
import zhCN from "./zh-CN";
import vi from "./vi";
import bn from "./bn";
import hi from "./hi";
import ta from "./ta";
import ko from "./ko";
import th from "./th";
import tr from "./tr";
import ja from "./ja";
import id from "./id";
import ms from "./ms";
import ur from "./ur";
import es from "./es";
import it from "./it";
import km from "./km";
import type { Translations } from "./en";

export type Locale =
  | "en" | "zh-TW" | "zh-CN"
  | "vi" | "bn" | "hi" | "ta"
  | "ko" | "th" | "tr" | "ja"
  | "id" | "ms" | "ur"
  | "es" | "it" | "km";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  { code: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "th", label: "ภาษาไทย", flag: "🇹🇭" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "km", label: "ខ្មែរ", flag: "🇰🇭" },
];

const ALL_LOCALE_CODES = LOCALES.map((l) => l.code);

export function isValidLocale(code: string): code is Locale {
  return ALL_LOCALE_CODES.includes(code as Locale);
}

const translations: Record<Locale, Translations> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  vi, bn, hi, ta, ko, th, tr, ja, id, ms, ur, es, it, km,
};

/**
 * Deep fallback merge — walks the English source and fills in any
 * missing keys in the requested locale with the English value.
 * Ensures no screen ever renders an undefined/empty string even
 * when a translation file is incomplete.
 */
function deepFallback<T extends Record<string, any>>(target: Partial<T>, source: T): T {
  if (typeof source !== "object" || source === null) return (target as T) ?? source;
  const out: any = Array.isArray(source) ? [] : {};
  for (const key of Object.keys(source)) {
    const src = (source as any)[key];
    const tgt = (target as any)?.[key];
    if (typeof src === "object" && src !== null && !Array.isArray(src)) {
      out[key] = deepFallback(tgt ?? {}, src);
    } else {
      out[key] = tgt !== undefined && tgt !== null && tgt !== "" ? tgt : src;
    }
  }
  return out;
}

export function getTranslations(locale: Locale): Translations {
  const t = translations[locale];
  if (!t || locale === "en") return en;
  return deepFallback(t, en);
}

export type { Translations };
