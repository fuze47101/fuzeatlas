"use client";
import { createContext, useContext } from "react";
import en from "./en";
import zhTW from "./zh-TW";
import zhCN from "./zh-CN";
import type { Translations } from "./en";

export type Locale = "en" | "zh-TW" | "zh-CN";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
  { code: "zh-CN", label: "简体中文", flag: "🇨🇳" },
];

const translations: Record<Locale, Translations> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
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
