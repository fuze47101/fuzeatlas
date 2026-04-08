"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Sidebar from "./Sidebar";
import GlobalSearch from "./GlobalSearch";
import FuzeChat from "./FuzeChat";
import ImpersonationBanner from "./ImpersonationBanner";

const NO_SIDEBAR_ROUTES = ["/login"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, impersonation } = useAuth();

  // Login page — no sidebar, no loading gate
  if (NO_SIDEBAR_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const bannerActive = impersonation?.active;

  // Authenticated — show sidebar + content
  return (
    <>
      <ImpersonationBanner />
      <div className={`flex min-h-screen ${bannerActive ? "pt-10" : ""}`}>
        <Sidebar />
        <main className={`flex-1 min-w-0 ${bannerActive ? "pt-14 lg:pt-0" : "pt-14 lg:pt-0"}`}>{children}</main>
        <GlobalSearch />
        <FuzeChat />
      </div>
    </>
  );
}
