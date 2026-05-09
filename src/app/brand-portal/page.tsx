"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function BrandPortalDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brand-portal")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading your portal...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">Unable to load portal data</div>;

  const { brand, fabrics, submissions, stats } = data;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{brand.name} — FUZE Brand Portal</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-[#00b4c3]">{stats.totalFabrics}</div>
          <div className="text-xs text-slate-500 mt-1">Fabrics</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-slate-700">{stats.totalSubmissions}</div>
          <div className="text-xs text-slate-500 mt-1">Submissions</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-emerald-600">{stats.testsPassed}</div>
          <div className="text-xs text-slate-500 mt-1">Tests Passed</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-amber-500">{stats.testsPending}</div>
          <div className="text-xs text-slate-500 mt-1">Tests Pending</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => router.push("/brand-portal/fabrics")}
          className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">🧵</div>
          <div className="font-bold text-slate-900">Fabrics</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.totalFabrics} fabric{stats.totalFabrics !== 1 ? "s" : ""} registered — add new fabrics or request testing
          </div>
        </button>
        <button
          onClick={() => router.push("/brand-portal/submissions")}
          className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-bold text-slate-900">Submissions & Workflow</div>
          <div className="text-xs text-slate-500 mt-1">
            Track your fabrics through the FUZE treatment pipeline
          </div>
        </button>
        {/* KUIU promise May 2026 — brand-side oversight of every factory
            in their supply chain. Aggregate fabrics, submissions, tests,
            and FUZE consumption per factory. */}
        <button
          onClick={() => router.push("/brand-portal/supply-chain")}
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl border border-[#00b4c3] hover:shadow-lg transition-all p-6 text-left text-white"
        >
          <div className="text-2xl mb-2">🏭</div>
          <div className="font-bold">Supply Chain</div>
          <div className="text-xs text-white/85 mt-1">
            Every factory producing FUZE-treated fabrics for your account — submissions, tests, and consumption.
          </div>
        </button>
        <button
          onClick={() => router.push("/brand-portal/pricing")}
          className="bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">📊</div>
          <div className="font-bold text-slate-900">Pricing & Volume</div>
          <div className="text-xs text-slate-500 mt-1">
            Cumulative FUZE consumption across your supply chain — and your current discount tier.
          </div>
        </button>
        <button
          onClick={() => router.push("/brand-portal/chat")}
          className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">💬</div>
          <div className="font-bold text-slate-900">FUZE FAQ</div>
          <div className="text-xs text-slate-500 mt-1">
            Ask questions about FUZE treatments, testing, and more
          </div>
        </button>
      </div>

      {/* Learn FUZE — links to the education page so brand users can ramp
          up on the technology basics, mechanism, dosage scale, and tests. */}
      <a
        href="/education"
        className="block mb-8 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">Learn FUZE</div>
            <h3 className="text-base font-bold text-slate-900">FUZE Basics — dosage, mechanism, testing</h3>
            <p className="text-xs text-slate-600 mt-1">How FUZE compares to silver-ion, AgCl, zinc, and QAC chemistries. The five tests, and which one matches the FUZE mechanism.</p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">Read →</span>
        </div>
      </a>

      {/* Getting Started Guide */}
      {stats.totalFabrics === 0 && (
        <div className="bg-gradient-to-r from-[#00b4c3]/5 to-emerald-50 rounded-xl border border-[#00b4c3]/20 p-6 mb-8">
          <h2 className="font-bold text-slate-900 mb-3">Getting Started</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div><span className="font-semibold">Add your fabrics</span> — Go to Fabrics and click "+ Add Fabric" to register your fabrics with composition, weight, and construction details.</div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div><span className="font-semibold">Request testing</span> — Click "Request Testing" on any fabric to select tests and submit a test request to FUZE or a partner lab.</div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div><span className="font-semibold">Track progress</span> — Monitor your submissions through the pipeline in the Submissions page.</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Fabrics */}
      {fabrics.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Your Fabrics</h2>
            <button
              onClick={() => router.push("/brand-portal/fabrics")}
              className="text-xs text-[#00b4c3] font-semibold hover:underline"
            >
              View All →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b">
                <th className="px-5 py-3">FUZE #</th>
                <th className="px-5 py-3">Your Code</th>
                <th className="px-5 py-3">Construction</th>
                <th className="px-5 py-3">Composition</th>
              </tr>
            </thead>
            <tbody>
              {fabrics.slice(0, 5).map((f: any) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-bold text-[#00b4c3]">FUZE {f.fuzeNumber || "—"}</td>
                  <td className="px-5 py-3 text-slate-700">{f.customerCode || "—"}</td>
                  <td className="px-5 py-3 text-slate-700">{f.construction || "—"}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {f.contents && f.contents.length > 0
                      ? f.contents.map((c: any) => `${c.material}${c.percent ? ` ${c.percent}%` : ""}`).join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
