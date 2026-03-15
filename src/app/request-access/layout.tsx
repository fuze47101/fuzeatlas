import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Request Access",
  description: "Request access to FUZE Atlas — submit your brand or factory details to get started with FUZE Biotech's antimicrobial textile platform.",
};
export default function RequestAccessLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
