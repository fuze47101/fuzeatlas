"use client";

import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { ONBOARDING_CHECKLISTS } from "@/lib/onboarding-checklists";
import PortalActivityFeed from "@/components/PortalActivityFeed";
import ErrorPanel from "@/components/ErrorPanel";
import SpecAckBanner from "@/components/SpecAckBanner";
import { SkeletonPortalLanding } from "@/components/Skeleton";

interface Stats {
  activeFabrics: number;
  pendingSubmissions: number;
  completedTests: number;
  sampleTrials: number;
}

export default function FactoryPortalPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  // Phase 15 silent-zero sweep — surface API failures instead of
  // rendering zeros that customers misread as "you have no data."
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/factory-portal/stats");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok === false || !data.stats) {
        setError(
          (data && (data.error || data.message)) ||
            `Couldn't load stats (HTTP ${res.status}).`,
        );
        return;
      }
      setStats(data.stats);
    } catch (e: any) {
      setError(e?.message || "Network error while loading stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }
    loadStats();
  }, [user, router, loadStats]);

  if (loading) {
    return <SkeletonPortalLanding />;
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <OnboardingChecklist
        surface="factory-portal"
        items={ONBOARDING_CHECKLISTS["factory-portal"]}
      />
      {/* NEED-6 — surfaces brands with newer specs than this factory's
          last ack. Renders nothing when the queue is empty. */}
      <SpecAckBanner />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <span>{t.factoryPortal.crumb}</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-1">{t.factoryPortal.welcomeBack}</h1>
        <p className="text-slate-600">{t.factoryPortal.welcomeSubtitle}</p>
      </div>

      {/* Quick Stats — silent-zero sweep: render an explicit error
          banner instead of zeros when the API call failed. */}
      {error ? (
        <div className="mb-8">
          <ErrorPanel context="Load factory stats" error={error} onRetry={loadStats} />
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">{t.factoryPortal.statActiveFabrics}</p>
              <p className="text-3xl font-black text-slate-900">{stats?.activeFabrics ?? 0}</p>
            </div>
            <span className="text-3xl">🧵</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">{t.factoryPortal.statPendingSubmissions}</p>
              <p className="text-3xl font-black text-slate-900">{stats?.pendingSubmissions ?? 0}</p>
            </div>
            <span className="text-3xl">⏳</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">{t.factoryPortal.statCompletedTests}</p>
              <p className="text-3xl font-black text-slate-900">{stats?.completedTests ?? 0}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">{t.factoryPortal.statSampleTrials}</p>
              <p className="text-3xl font-black text-slate-900">{stats?.sampleTrials ?? 0}</p>
            </div>
            <span className="text-3xl">🧪</span>
          </div>
        </div>
      </div>
      )}

      {/* Learn FUZE — quick link to the technology basics page */}
      <Link
        href="/education"
        className="block mb-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
              {t.factoryPortal.learnLabel}
            </div>
            <h3 className="text-base font-bold text-slate-900">{t.factoryPortal.learnTitle}</h3>
            <p className="text-xs text-slate-600 mt-1">{t.factoryPortal.learnSubtitle}</p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">
            {t.factoryPortal.learnAction} →
          </span>
        </div>
      </Link>

      {/* Phase 8A — universal activity feed between Learn FUZE banner and quick links. */}
      <PortalActivityFeed />

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/factory-portal/intake"
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">{t.factoryPortal.submitFabricTitle}</h3>
              <p className="text-sm text-[#00b4c3]/90">{t.factoryPortal.submitFabricSubtitle}</p>
            </div>
            <span className="text-3xl">📥</span>
          </div>
          <div className="text-sm text-white/80">{t.factoryPortal.submitFabricAction} →</div>
        </Link>
        <Link
          href="/factory-portal/fabrics"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{t.factoryPortal.myFabricsTitle}</h3>
              <p className="text-sm text-slate-600">{t.factoryPortal.myFabricsSubtitle}</p>
            </div>
            <span className="text-3xl">🧵</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{t.factoryPortal.myFabricsAction} →</div>
        </Link>
        <Link
          href="/factory-portal/submissions"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{t.factoryPortal.submissionsTitle}</h3>
              <p className="text-sm text-slate-600">{t.factoryPortal.submissionsSubtitle}</p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{t.factoryPortal.submissionsAction} →</div>
        </Link>
        {/* Tina ticket May 2026 — factories had no upload UI; this is the
            entry point so they stop emailing PDFs to admin@. */}
        <Link
          href="/factory-portal/upload-report"
          className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">{t.factoryPortal.uploadReportTitle}</h3>
              <p className="text-sm text-amber-100">{t.factoryPortal.uploadReportSubtitle}</p>
            </div>
            <span className="text-3xl">📤</span>
          </div>
          <div className="text-sm text-white/80">{t.factoryPortal.uploadReportAction} →</div>
        </Link>
        <Link
          href="/factory-portal/sample-trial"
          className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">{t.factoryPortal.requestSampleTitle}</h3>
              <p className="text-sm text-purple-200">{t.factoryPortal.requestSampleSubtitle}</p>
            </div>
            <span className="text-3xl">🧪</span>
          </div>
          <div className="text-sm text-white/80">{t.factoryPortal.requestSampleAction} →</div>
        </Link>
        <Link
          href="/pricing"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{t.factoryPortal.pricingTitle}</h3>
              <p className="text-sm text-slate-600">{t.factoryPortal.pricingSubtitle}</p>
            </div>
            <span className="text-3xl">💰</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{t.factoryPortal.pricingAction} →</div>
        </Link>
      </div>
    </div>
  );
}
