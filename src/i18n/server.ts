/**
 * Server-side i18n helper. Reads the user's locale from a cookie
 * (set by the client-side I18nProvider) and returns the matching
 * Translations dictionary with English fallback for any missing keys.
 *
 * Usage in a server component:
 *   import { getServerTranslations } from "@/i18n/server";
 *   const t = await getServerTranslations();
 *   return <h1>{t.recipeReport.recipeReport}</h1>;
 *
 * Optional ?lang=xx query param override (for "print in customer's language"
 * use case): pass the value from the searchParams into getServerTranslations.
 */
import { cookies } from "next/headers";
import { getTranslations, isValidLocale } from "./core";
import type { Locale, Translations } from "./core";

const COOKIE_NAME = "fuze-atlas-locale";

export async function getServerLocale(override?: string): Promise<Locale> {
  // Caller-supplied override (e.g., from ?lang= query param) wins.
  if (override && isValidLocale(override)) return override;
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (raw && isValidLocale(raw)) return raw;
  return "en";
}

export async function getServerTranslations(
  override?: string,
): Promise<Translations> {
  const locale = await getServerLocale(override);
  return getTranslations(locale);
}
