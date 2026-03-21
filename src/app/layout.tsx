import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import I18nProvider from "@/i18n/I18nProvider";
import AuthLayout from "@/components/AuthLayout";
import { ToastProvider } from "@/components/Toast";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthLayout>{children}</AuthLayout>
            </ToastProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
