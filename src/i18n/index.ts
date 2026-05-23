"use client";
/**
 * Client-side i18n entry point. Re-exports everything from ./core
 * (which is server-compatible) and adds the React Context + useI18n hook.
 *
 * If you're rendering from a server component (e.g., a printable PDF
 * route), import from "./core" directly or use getServerTranslations
 * from "./server".
 */
import { createContext, useContext } from "react";
import en from "./en";
import type { Translations } from "./core";

// Re-export everything pure from core
export {
  LOCALES,
  isValidLocale,
  getTranslations,
} from "./core";
export type { Locale, Translations } from "./core";
import type { Locale } from "./core";

// React Context
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
