"use client";
import { useAuth } from "@/lib/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Rep",
  FABRIC_MANAGER: "Fabric Manager",
  TESTING_MANAGER: "Testing Manager",
  FACTORY_MANAGER: "Factory Manager",
  FACTORY_USER: "Factory",
  BRAND_USER: "Brand",
  DISTRIBUTOR_USER: "Distributor",
  LAB_USER: "Lab",
  PUBLIC: "Public",
};

const ROLE_COLORS: Record<string, string> = {
  BRAND_USER: "from-purple-600 to-purple-500",
  FACTORY_USER: "from-orange-600 to-orange-500",
  FACTORY_MANAGER: "from-orange-600 to-orange-500",
  DISTRIBUTOR_USER: "from-green-600 to-green-500",
  LAB_USER: "from-blue-600 to-blue-500",
  EMPLOYEE: "from-slate-600 to-slate-500",
  SALES_MANAGER: "from-yellow-600 to-yellow-500",
  SALES_REP: "from-yellow-600 to-yellow-500",
};

export default function ImpersonationBanner() {
  const { impersonation, stopImpersonating } = useAuth();

  if (!impersonation?.active) return null;

  const roleLabel = ROLE_LABELS[impersonation.targetRole] || impersonation.targetRole;
  const colorClass = ROLE_COLORS[impersonation.targetRole] || "from-red-600 to-red-500";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r ${colorClass} text-white shadow-lg`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 text-white/90">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-sm font-semibold">Viewing as:</span>
          </span>
          <span className="text-sm font-bold truncate">
            {impersonation.targetName}
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm">
            {roleLabel}
          </span>
          {impersonation.entityName && (
            <span className="hidden md:inline text-sm text-white/80 truncate">
              — {impersonation.entityName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden lg:inline text-xs text-white/70">
            Logged in as {impersonation.realAdmin.name}
          </span>
          <button
            onClick={stopImpersonating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit View
          </button>
        </div>
      </div>
    </div>
  );
}
