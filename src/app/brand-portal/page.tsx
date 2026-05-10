"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

export default function BrandPortalDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.brandPortal.landing;
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch portal data + brand profile in parallel. Profile is optional —
    // if there's no row yet the landing falls back to the bare Brand.name
    // greeting and an empty header.
    Promise.all([
      fetch("/api/brand-portal").then((r) => r.json()).catch(() => null),
      fetch("/api/brand-portal/profile").then((r) => r.json()).catch(() => null),
    ])
      .then(([d, p]) => {
        if (d?.ok) setData(d);
        if (p?.ok) setProfile(p.profile || null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">{tx.unableToLoad}</div>;

  const { brand, fabrics, stats } = data;
  const firstName = user?.name?.split(" ")[0];
  const accentStyle = profile?.primaryColor
    ? { backgroundColor: profile.primaryColor }
    : undefined;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Welcome Header — augmented with BrandProfile when present.
          When no profile row exists the bare brand.name greeting from
          the prior version still renders, no layout shift. */}
      <div className="mb-8 flex items-start gap-4">
        {profile?.logoUrl ? (
          <img
            src={profile.logoUrl}
            alt={`${brand.name} logo`}
            className="h-14 w-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          {profile?.heroHeadline ? (
            <>
              <h1 className="text-2xl font-black text-slate-900">{profile.heroHeadline}</h1>
              {profile.heroSubhead ? (
                <p className="text-sm text-slate-500 mt-1">{profile.heroSubhead}</p>
              ) : (
                <p className="text-sm text-slate-500 mt-1">
                  {firstName ? tx.welcomeNamed.replace("{firstName}", firstName) : tx.welcome}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-slate-900">
                {firstName ? tx.welcomeNamed.replace("{firstName}", firstName) : tx.welcome}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {tx.brandSubtitle.replace("{brand}", brand.name)}
              </p>
            </>
          )}
        </div>
        {accentStyle ? (
          <div
            className="h-14 w-1.5 rounded-full shrink-0"
            style={accentStyle}
            aria-hidden="true"
          />
        ) : null}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-[#00b4c3]">{stats.totalFabrics}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statFabrics}</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-slate-700">{stats.totalSubmissions}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statSubmissions}</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-emerald-600">{stats.testsPassed}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statTestsPassed}</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
          <div className="text-3xl font-black text-amber-500">{stats.testsPending}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statTestsPending}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => router.push("/brand-portal/fabrics")}
          className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">🧵</div>
          <div className="font-bold text-slate-900">{tx.quickFabricsTitle}</div>
          <div className="text-xs text-slate-500 mt-1">
            {(stats.totalFabrics === 1 ? tx.quickFabricsSingular : tx.quickFabricsPlural).replace(
              "{count}",
              String(stats.totalFabrics),
            )}
          </div>
        </button>
        <button
          onClick={() => router.push("/brand-portal/submissions")}
          className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-bold text-slate-900">{tx.quickSubmissionsTitle}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.quickSubmissionsBlurb}</div>
        </button>
        {/* KUIU promise May 2026 — brand-side oversight of every factory
            in their supply chain. */}
        <button
          onClick={() => router.push("/brand-portal/supply-chain")}
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl border border-[#00b4c3] hover:shadow-lg transition-all p-6 text-left text-white"
        >
          <div className="text-2xl mb-2">🏭</div>
          <div className="font-bold">{tx.quickSupplyChainTitle}</div>
          <div className="text-xs text-white/85 mt-1">{tx.quickSupplyChainBlurb}</div>
        </button>
        <button
          onClick={() => router.push("/brand-portal/pricing")}
          className="bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">📊</div>
          <div className="font-bold text-slate-900">{tx.quickPricingTitle}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.quickPricingBlurb}</div>
        </button>
        <button
          onClick={() => router.push("/brand-portal/chat")}
          className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-6 text-left"
        >
          <div className="text-2xl mb-2">💬</div>
          <div className="font-bold text-slate-900">{tx.quickFaqTitle}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.quickFaqBlurb}</div>
        </button>
      </div>

      {/* Learn FUZE — links to /education */}
      <a
        href="/education"
        className="block mb-8 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
              {tx.learnLabel}
            </div>
            <h3 className="text-base font-bold text-slate-900">{tx.learnTitle}</h3>
            <p className="text-xs text-slate-600 mt-1">{tx.learnBlurb}</p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">
            {tx.learnAction} →
          </span>
        </div>
      </a>

      {/* Getting Started Guide */}
      {stats.totalFabrics === 0 && (
        <div className="bg-gradient-to-r from-[#00b4c3]/5 to-emerald-50 rounded-xl border border-[#00b4c3]/20 p-6 mb-8">
          <h2 className="font-bold text-slate-900 mb-3">{tx.gettingStartedTitle}</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <span className="font-semibold">{tx.gettingStarted1Title}</span> — {tx.gettingStarted1Body}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <span className="font-semibold">{tx.gettingStarted2Title}</span> — {tx.gettingStarted2Body}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>
                <span className="font-semibold">{tx.gettingStarted3Title}</span> — {tx.gettingStarted3Body}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Fabrics */}
      {fabrics.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">{tx.yourFabricsHeader}</h2>
            <button
              onClick={() => router.push("/brand-portal/fabrics")}
              className="text-xs text-[#00b4c3] font-semibold hover:underline"
            >
              {tx.viewAll}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b">
                <th className="px-5 py-3">{tx.colFuzeNumber}</th>
                <th className="px-5 py-3">{tx.colYourCode}</th>
                <th className="px-5 py-3">{tx.colConstruction}</th>
                <th className="px-5 py-3">{tx.colComposition}</th>
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
