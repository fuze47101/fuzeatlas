import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import I18nProvider from "@/i18n/I18nProvider";
import AuthLayout from "@/components/AuthLayout";

export const metadata: Metadata = {
  title: "FUZE Atlas",
  description: "Textile Intelligence Platform — FUZE Biotech Inc.",
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
            <AuthLayout>{children}</AuthLayout>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
