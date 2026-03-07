"use client";
import { createContext, useContext } from "react";
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

export function getTranslations(locale: Locale): Translations {
  return translations[locale] || en;
}

// Context
export const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function useI18n() {
  return useContext(I18nContext);
}
