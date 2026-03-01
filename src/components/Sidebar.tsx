"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/brands", label: "Brand Pipeline", icon: "🎯" },
  { href: "/fabrics", label: "Fabrics", icon: "🧵" },
  { href: "/factories", label: "Factories", icon: "🏭" },
  { href: "/tests", label: "Test Results", icon: "🧪" },
  { href: "/sow", label: "SOW Governance", icon: "📋" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-52 bg-slate-900 text-white flex flex-col z-50">
      <div className="px-4 py-5 border-b border-slate-800">
        <h1 className="text-lg font-black tracking-tight">FUZE Atlas</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Textile Intelligence Platform</p>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-500">FUZE Biotech Inc.</p>
        <p className="text-[10px] text-slate-500">v2.1</p>
      </div>
    </aside>
  );
}
