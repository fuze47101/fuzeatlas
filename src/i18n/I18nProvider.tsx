"use client";
import { useState, useEffect, useMemo } from "react";
import { I18nContext, getTranslations, isValidLocale } from "./index";
import type { Locale } from "./index";

const STORAGE_KEY = "fuze-atlas-locale";
const COOKIE_NAME = "fuze-atlas-locale";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // 1-year expiry, SameSite=Lax so it survives navigation, root path so
  // every route (including server-rendered print pages) can read it.
  const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Load saved locale on mount — cookie wins (server can read it too),
  // localStorage is a fallback for users upgrading from the cookie-less era.
  useEffect(() => {
    const fromCookie = readCookie(COOKIE_NAME);
    if (fromCookie && isValidLocale(fromCookie)) {
      setLocaleState(fromCookie);
      return;
    }
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage && isValidLocale(fromStorage)) {
      setLocaleState(fromStorage);
      // Backfill the cookie so server-rendered pages start picking it up.
      writeCookie(COOKIE_NAME, fromStorage);
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
    writeCookie(COOKIE_NAME, l);
  };

  const t = useMemo(() => getTranslations(locale), [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
