// @ts-nocheck
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | FUZE Atlas",
  description: "Advanced analytics dashboard for FUZE Atlas antimicrobial textile testing",
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
