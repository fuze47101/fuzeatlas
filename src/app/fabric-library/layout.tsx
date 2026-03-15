import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Fabric Library",
  description: "Browse FUZE's antimicrobial fabric library — search by material, treatment tier, and test results.",
};
export default function FabricLibraryLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
