// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Module Home — the "where do I want to go today" landing page for
 * admin / employee / sales users. Six big cards, each representing a
 * functional area. Clicking a card drops you into the module's
 * landing page, and the left sidebar shows all the tools for that
 * module.
 */

const MODULES = [
  {
    key: "business-development",
    label: "Business Development",
    icon: "🎯",
    accent: "from-rose-500 to-rose-700",
    blurb: "Leads, accounts, outreach, revenue",
    landing: "/admin/brand-pipeline",
    items: [
      { label: "Brand Pipeline (Leads)", href: "/admin/brand-pipeline" },
      { label: "Accounts", href: "/admin/accounts" },
      { label: "Brand Intelligence", href: "/admin/brand-discovery" },
      { label: "Sample → Production", href: "/admin/conversion-tracking" },
      { label: "Deals & Revenue", href: "/pipeline" },
      { label: "Invoices", href: "/invoices" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: "📦",
    accent: "from-[#00b4c3] to-[#009ba8]",
    blurb: "Orders, inventory, shipments, consumption",
    landing: "/admin/orders-dashboard",
    items: [
      { label: "Orders Dashboard", href: "/admin/orders-dashboard" },
      { label: "Order Management", href: "/admin/orders" },
      { label: "Distributor Restocks", href: "/admin/distributor-restock" },
      { label: "Worldwide Inventory", href: "/admin/worldwide-inventory" },
      { label: "Consumption & Reorder", href: "/admin/consumption" },
      { label: "Shipping Docs", href: "/shipping-docs" },
    ],
  },
  {
    key: "quality-labs",
    label: "Quality & Labs",
    icon: "🧪",
    accent: "from-violet-500 to-violet-700",
    blurb: "Fabrics, recipes, testing, certification",
    landing: "/tests",
    items: [
      { label: "Fabrics", href: "/fabrics" },
      { label: "Fabric Intake", href: "/fabrics/intake" },
      { label: "Recipe Library", href: "/recipes" },
      { label: "Test Requests", href: "/test-requests" },
      { label: "Test Results", href: "/tests" },
      { label: "Ongoing Tests", href: "/admin/ongoing-tests" },
      { label: "Sample Trials", href: "/admin/sample-trials" },
      { label: "Lab Directory", href: "/labs" },
    ],
  },
  {
    key: "partners",
    label: "Partners",
    icon: "🤝",
    accent: "from-amber-500 to-amber-700",
    blurb: "Brands, factories, distributors",
    landing: "/brands",
    items: [
      { label: "Brands", href: "/brands" },
      { label: "Factories", href: "/factories" },
      { label: "Distributor Network", href: "/admin/distributors" },
      { label: "Distributor Docs", href: "/admin/distributor-docs" },
    ],
  },
  {
    key: "resources",
    label: "Resources & Docs",
    icon: "📚",
    accent: "from-emerald-500 to-emerald-700",
    blurb: "Document library, SDS/TDS/COA, SOWs, pricing",
    landing: "/compliance-library",
    items: [
      { label: "Document Center", href: "/compliance-library" },
      { label: "SOWs", href: "/sow" },
      { label: "Meetings", href: "/meetings" },
      { label: "Weekly Summary", href: "/reports" },
      { label: "Market Landscape", href: "/admin/competitor-pricing" },
      { label: "Pricing & Environment", href: "/pricing" },
      { label: "Application Calculator", href: "/pricing/calculator" },
      { label: "Sustainability", href: "/sustainability" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: "⚙️",
    accent: "from-slate-700 to-slate-900",
    blurb: "Users, settings, audit log, access",
    landing: "/settings/users",
    adminOnly: true,
    items: [
      { label: "Notifications", href: "/notifications" },
      { label: "User Management", href: "/settings/users" },
      { label: "Access Requests", href: "/settings/access-requests" },
      { label: "Availability Settings", href: "/settings/availability" },
      { label: "Exchange Rates", href: "/settings/exchange-rates" },
      { label: "Audit Log", href: "/settings/audit-log" },
    ],
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const isInternal = user?.role && ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  useEffect(() => {
    // Non-internal users get bounced to their role-specific dashboard
    if (user && !isInternal) {
      if (user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER") router.push("/factory-portal");
      else if (user.role === "BRAND_USER") router.push("/brand-portal");
      else if (user.role === "DISTRIBUTOR_USER") router.push("/distributor-portal");
      else if (user.role === "LAB_USER") router.push("/lab-portal");
    }
  }, [user]);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] || "";

  const modules = MODULES.filter((m) => !m.adminOnly || isAdmin);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-sm text-slate-500">
          {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-slate-600 mt-1">Pick a module to get going. The left nav will scope to it.</p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((m) => (
          <ModuleCard key={m.key} module={m} />
        ))}
      </div>

      {/* Shortcut bar */}
      <div className="mt-10 pt-6 border-t border-slate-200">
        <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-3">Quick Jump</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]">📊 KPI Dashboard</Link>
          <Link href="/admin/orders-dashboard" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]">📦 Orders</Link>
          <Link href="/admin/brand-pipeline" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]">🔥 Pipeline</Link>
          <Link href="/notifications" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]">🔔 Notifications</Link>
          <Link href="/compliance-library" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]">📋 Documents</Link>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module: m }: { module: typeof MODULES[number] }) {
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
        {m.items.slice(0, 6).map((item) => (
          <span key={item.href} className="text-xs text-slate-600 truncate">
            · {item.label}
          </span>
        ))}
        {m.items.length > 6 && (
          <span className="text-xs text-slate-400">+ {m.items.length - 6} more</span>
        )}
      </div>
    </Link>
  );
}
