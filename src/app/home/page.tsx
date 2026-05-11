// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MODULES, type ModuleDef } from "@/lib/modules";
import BDScoreboardCard from "@/components/BDScoreboardCard";

/**
 * Module Home — the "where do I want to go today" landing page for
 * admin / employee / sales users. Six big cards, each representing a
 * functional area. Clicking a card drops you into the module's
 * landing page, and the left sidebar scopes itself to that module.
 *
 * Card data is imported from `@/lib/modules` (shared with Sidebar).
 * Add a new page in ONE place (modules.ts) and it appears in both
 * the card and the scoped sidebar — no drift.
 */

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const isInternal =
    user?.role && ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  useEffect(() => {
    // Non-internal users get bounced to their role-specific dashboard
    if (user && !isInternal) {
      if (user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER")
        router.push("/factory-portal");
      else if (user.role === "BRAND_USER") router.push("/brand-portal");
      else if (user.role === "DISTRIBUTOR_USER") router.push("/distributor-portal");
      else if (user.role === "LAB_USER") router.push("/lab-portal");
    }
  }, [user]);

  const hour = time.getHours();
  const greeting =
    hour < 12 ? t.home.goodMorning : hour < 18 ? t.home.goodAfternoon : t.home.goodEvening;
  const firstName = user?.name?.split(" ")[0] || "";

  // Translate module labels/blurbs where we have strings; fall back to the
  // English ones baked into modules.ts.
  const translatedModules = MODULES.map((m) => {
    const tMap: Record<string, { label: string; blurb: string }> = {
      // Phase 13E — sales-pipeline replaces the old business-development
      // key. Fall back to bizDev translation if the new salesPipeline key
      // isn't in en.ts yet.
      "sales-pipeline": {
        label: (t.home as any).salesPipeline || t.home.bizDev,
        blurb: (t.home as any).salesPipelineBlurb || t.home.bizDevBlurb,
      },
      operations: { label: t.home.operations, blurb: t.home.operationsBlurb },
      "quality-labs": { label: t.home.qualityLabs, blurb: t.home.qualityLabsBlurb },
      partners: { label: t.home.partners, blurb: t.home.partnersBlurb },
      resources: { label: t.home.resources, blurb: t.home.resourcesBlurb },
      admin: { label: t.home.admin, blurb: t.home.adminBlurb },
    };
    const translated = tMap[m.key];
    return translated ? { ...m, label: translated.label, blurb: translated.blurb } : m;
  });

  const modules = translatedModules.filter((m) => !m.adminOnly || isAdmin);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-sm text-slate-500">
          {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-slate-600 mt-1">{t.home.subtitle}</p>
      </div>

      {/* BD Scoreboard (visible only to BD-eligible roles) */}
      <div className="mb-6">
        <BDScoreboardCard />
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((m) => (
          <ModuleCard key={m.key} module={m} />
        ))}
      </div>

      {/* Shortcut bar */}
      <div className="mt-10 pt-6 border-t border-slate-200">
        <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-3">
          {t.home.quickJump}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/bd/wizard"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            🪄 BD Wizard
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            📊 KPI Dashboard
          </Link>
          <Link
            href="/admin/orders-dashboard"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            📦 Orders
          </Link>
          <Link
            href="/admin/brand-pipeline"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            🔥 Pipeline
          </Link>
          <Link
            href="/admin/icp-sample-prep"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            ⚖️ ICP Sample Prep
          </Link>
          <Link
            href="/notifications"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            🔔 Notifications
          </Link>
          <Link
            href="/compliance-library"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            📋 Documents
          </Link>
          <Link
            href="/settings/profile"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            👤 My Profile
          </Link>
          <Link
            href="/settings/email-templates"
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
          >
            ✉️ Email Templates
          </Link>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module: m }: { module: ModuleDef }) {
  const visibleItems = m.items.filter((it) => !it.hideInCard);
  return (
    <Link
      href={m.landing}
      className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 hover:border-transparent hover:shadow-xl transition-all"
    >
      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${m.accent} p-5 text-white`}>
        <div className="flex items-center justify-between">
          <span className="text-4xl">{m.icon}</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xl">→</span>
        </div>
        <h3 className="text-xl font-black mt-3">{m.label}</h3>
        <p className="text-sm text-white/80 mt-1">{m.blurb}</p>
      </div>
      {/* Items */}
      <div className="p-4 grid grid-cols-1 gap-1">
        {visibleItems.slice(0, 7).map((item) => (
          <span key={item.href} className="text-xs text-slate-600 truncate">
            {item.icon ? `${item.icon} ` : "· "}
            {item.label}
          </span>
        ))}
        {visibleItems.length > 7 && (
          <span className="text-xs text-slate-400">+ {visibleItems.length - 7} more</span>
        )}
      </div>
    </Link>
  );
}
