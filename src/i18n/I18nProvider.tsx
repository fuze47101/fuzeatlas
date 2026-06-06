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

  // Resolve locale on mount in priority order:
  //   1. ?locale=xx URL param (transient — for share/print links that
  //      should render in the recipient's language regardless of the
  //      viewer's saved preference; deliberately NOT persisted to
  //      cookie/localStorage so it doesn't clobber the user's pref).
  //   2. fuze-atlas-locale cookie (server can read it too).
  //   3. localStorage (fallback for users upgrading from the
  //      cookie-less era; backfilled to cookie so the next request
  //      gets server-side i18n too).
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("locale");
      if (fromUrl && isValidLocale(fromUrl)) {
        setLocaleState(fromUrl as Locale);
        return;
      }
    }
    const fromCookie = readCookie(COOKIE_NAME);
    if (fromCookie && isValidLocale(fromCookie)) {
      setLocaleState(fromCookie);
      return;
    }
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage && isValidLocale(fromStorage)) {
      setLocaleState(fromStorage);
      writeCookie(COOKIE_NAME, fromStorage);
    }
  }, []);

  // Update HTML attributes when locale changes.
  // BUG 3 (Tina cmplvllhg0001lb04ysg3sj9u 2026-06-05): switching locale
  // used to flip dir=rtl for Urdu. Atlas isn't RTL-ready (only a few
  // .sidebar-nav rules in globals.css) so the rest of the layout
  // inverted/broke for any user who hit `ur`. Gating to dir=ltr until
  // a real RTL pass ships — text-only changes for all 17 locales,
  // no layout mirroring. See globals.css html[dir="rtl"] rules — they
  // are dormant now but kept so the future RTL project can reactivate.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
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
