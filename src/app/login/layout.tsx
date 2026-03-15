import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to FUZE Atlas — the textile intelligence platform for antimicrobial testing, compliance, and supply chain management.",
};
export default function LoginLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
