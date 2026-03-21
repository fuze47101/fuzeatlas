// @ts-nocheck
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy route — redirects to the unified Fabric Intake page.
 * Kept so old bookmarks and links still work.
 */
export default function NewFabricRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/fabrics/intake"); }, [router]);
  return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
      Redirecting to Fabric Intake…
    </div>
  );
}
