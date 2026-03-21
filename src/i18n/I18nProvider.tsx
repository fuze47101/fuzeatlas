"use client";
import { useState, useEffect, useMemo } from "react";
import { I18nContext, getTranslations, isValidLocale } from "./index";
import type { Locale } from "./index";

const STORAGE_KEY = "fuze-atlas-locale";

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Load saved locale on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isValidLocale(saved)) {
      setLocaleState(saved);
    }
  }, []);

  // Update HTML attributes when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  const t = useMemo(() => getTranslations(locale), [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
