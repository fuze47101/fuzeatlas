"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import FuzeLogo from "./FuzeLogo";
import { useI18n, LOCALES } from "@/i18n";
import type { Locale } from "@/i18n";

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();

  const NAV = [
    { href: "/dashboard", label: t.nav.dashboard, icon: "📊" },
    { href: "/brands", label: t.nav.brandPipeline, icon: "🔥" },
    { href: "/fabrics", label: t.nav.fabrics, icon: "🧵" },
    { href: "/factories", label: t.nav.factories, icon: "🏭" },
    { href: "/tests", label: t.nav.testResults, icon: "🧪" },
    { href: "/labs", label: t.nav.labDirectory || "Lab Directory", icon: "🔬" },
    { href: "/sow", label: t.nav.sowGovernance, icon: "📋" },
  ];

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setLangOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const currentLocale = LOCALES.find(l => l.code === locale) || LOCALES[0];

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white flex items-center justify-between px-4 h-14 shadow-lg">
        <button
          onClick={() => setOpen(!open)}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <FuzeLogo size="sm" layout="horizontal" theme="light" />
        <div className="w-10" /> {/* spacer for centering */}
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-white flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <FuzeLogo size="md" layout="horizontal" theme="light" />
          <p className="text-[10px] text-slate-500 mt-1.5">{t.nav.subtitle}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-[#00b4c3] text-white shadow-lg shadow-[#00b4c3]/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span className="text-base">{currentLocale.flag}</span>
            <span>{currentLocale.label}</span>
            <svg className={`w-3 h-3 ml-auto transition-transform ${langOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          {langOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLocale(l.code as Locale); setLangOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    l.code === locale
                      ? "bg-[#00b4c3] text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {l.code === locale && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">{t.nav.company}</p>
          <p className="text-xs text-slate-600">{t.nav.version}</p>
        </div>
      </aside>
    </>
  );
}
