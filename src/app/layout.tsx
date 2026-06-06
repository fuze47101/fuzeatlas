import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import I18nProvider from "@/i18n/I18nProvider";
import { getServerLocale } from "@/i18n/server";
import AuthLayout from "@/components/AuthLayout";
import { ToastProvider } from "@/components/Toast";
import FeedbackButton from "@/components/FeedbackButton";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import CommandPalette from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: {
    default: "FUZE Atlas — Textile Intelligence Platform",
    template: "%s | FUZE Atlas",
  },
  description:
    "FUZE Atlas is the textile intelligence platform by FUZE Biotech. Manage antimicrobial testing, compliance documentation, brand partnerships, and factory operations in one place.",
  metadataBase: new URL("https://fuzeatlas.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "FUZE Atlas",
    title: "FUZE Atlas — Textile Intelligence Platform",
    description:
      "Manage antimicrobial testing, compliance, brand partnerships, and factory operations. Powered by FUZE Biotech.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "FUZE Atlas — Textile Intelligence Platform",
    description:
      "Manage antimicrobial testing, compliance, brand partnerships, and factory operations.",
  },
  robots: {
    index: false, // internal app — keep out of search until ready
    follow: false,
  },
  icons: {
    icon: "/fuze-icon.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read locale from cookie so server-rendered HTML carries the right
  // lang attribute. Falls back to "en" for first visits.
  // BUG 3 (Tina cmplvllhg0001lb04ysg3sj9u 2026-06-05): dir is locked
  // to "ltr" for every locale until Atlas ships a real RTL pass.
  // Switching to ur previously flipped the page upside down for the
  // user — the layout, sidebar, and inputs aren't mirrored, so dir=rtl
  // produced visual chaos. Text-only locale changes for all 17.
  const locale = await getServerLocale();
  const dir = "ltr";
  return (
    <html lang={locale} dir={dir}>
      <head>
        {/* `maximum-scale=1` was blocking pinch-zoom and trapping the
            iPhone in a zoomed-in state after focusing an input
            (Mobile Fix May 2026). Removed; the 16px input rule in
            globals.css prevents the auto-zoom-on-focus that was
            the underlying complaint. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased overflow-x-hidden">
        <AuthProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthLayout>{children}</AuthLayout>
              <FeedbackButton />
              {/* NICE-4 — admin keyboard shortcuts. Self-gates by role,
                  no-op for non-internal users. */}
              <KeyboardShortcuts />
              {/* NICE-5 — ⌘K global search palette. Same role gate. */}
              <CommandPalette />
            </ToastProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
