"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  activeFabrics: number;
  pendingSubmissions: number;
  completedTests: number;
  sampleTrials: number;
}

export default function FactoryPortalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ activeFabrics: 0, pendingSubmissions: 0, completedTests: 0, sampleTrials: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }

    // Load stats
    const loadStats = async () => {
      try {
        const res = await fetch("/api/factory-portal/stats");
        const data = await res.json();
        if (data.ok) {
          setStats(data.stats);
        }
      } catch (e) {
        console.error("Failed to load stats:", e);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span>Factory Portal</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-1">Welcome Back</h1>
        <p className="text-slate-600">Manage your FUZE fabric submissions and track treatment progress</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Active Fabrics</p>
              <p className="text-3xl font-black text-slate-900">{stats.activeFabrics}</p>
            </div>
            <span className="text-3xl">🧵</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Pending Submissions</p>
              <p className="text-3xl font-black text-slate-900">{stats.pendingSubmissions}</p>
            </div>
            <span className="text-3xl">⏳</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Completed Tests</p>
              <p className="text-3xl font-black text-slate-900">{stats.completedTests}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Sample Trials</p>
              <p className="text-3xl font-black text-slate-900">{stats.sampleTrials}</p>
            </div>
            <span className="text-3xl">🧪</span>
          </div>
        </div>
      </div>

      {/* Learn FUZE — quick link to the technology basics page */}
      <Link
        href="/education"
        className="block mb-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">Learn FUZE</div>
            <h3 className="text-base font-bold text-slate-900">FUZE Basics — dosage, mechanism, testing</h3>
            <p className="text-xs text-slate-600 mt-1">Why FUZE applies at lower dose, requires no binder or curing oven, and tests on ASTM E2149.</p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">Read →</span>
        </div>
      </Link>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/factory-portal/intake"
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Submit Fabric</h3>
              <p className="text-sm text-[#00b4c3]/90">Add new fabric for FUZE treatment</p>
            </div>
            <span className="text-3xl">📥</span>
          </div>
          <div className="text-sm text-white/80">Click to start a new submission →</div>
        </Link>
        <Link href="/factory-portal/fabrics"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">My Fabrics</h3>
              <p className="text-sm text-slate-600">View all your fabrics</p>
            </div>
            <span className="text-3xl">🧵</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">View library →</div>
        </Link>
        <Link href="/factory-portal/submissions"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Submissions</h3>
              <p className="text-sm text-slate-600">Track treatment progress</p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">View submissions →</div>
        </Link>
        <Link href="/factory-portal/sample-trial"
          className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Request FUZE Sample</h3>
              <p className="text-sm text-purple-200">Request product samples for fabric treatment trials</p>
            </div>
            <span className="text-3xl">🧪</span>
          </div>
          <div className="text-sm text-white/80">Start a trial request →</div>
        </Link>
        <Link href="/pricing"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Pricing & Details</h3>
              <p className="text-sm text-slate-600">FUZE pricing and specifications</p>
            </div>
            <span className="text-3xl">💰</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">Learn more →</div>
        </Link>
      </div>
    </div>
  );
}
