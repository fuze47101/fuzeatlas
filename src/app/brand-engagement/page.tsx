"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const TREND_COLORS: Record<string, string> = {
  RISING: "bg-emerald-100 text-emerald-800",
  STABLE: "bg-slate-100 text-slate-800",
  DECLINING: "bg-amber-100 text-amber-800",
  AT_RISK: "bg-red-100 text-red-800",
};

const TREND_ICONS: Record<string, string> = {
  RISING: "↑",
  STABLE: "—",
  DECLINING: "↓",
  AT_RISK: "⚠",
};

export default function BrandEngagementPage() {
  const [engagements, setEngagements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTrend, setFilterTrend] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEngagements = async () => {
    setLoading(true);
    try {
      const params = filterTrend ? `?trend=${filterTrend}` : "";
      const res = await fetch(`/api/brand-engagement${params}`);
      const data = await res.json();
      if (data.ok) {
        setEngagements(data.engagements);
      }
    } catch (error) {
      console.error("Error fetching engagements:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEngagements();
  }, [filterTrend]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/brand-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate" }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchEngagements();
      }
    } catch (error) {
      console.error("Error recalculating:", error);
    }
    setRecalculating(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-emerald-50";
    if (score >= 60) return "bg-blue-50";
    if (score >= 40) return "bg-amber-50";
    return "bg-red-50";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Brand Health</h1>
            <p className="text-slate-600 mt-1">
              Monitor engagement and health metrics for all brands
            </p>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {recalculating ? "Recalculating..." : "Recalculate All"}
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterTrend("")}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                filterTrend === ""
                  ? "bg-[#00b4c3] text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            {["RISING", "STABLE", "DECLINING", "AT_RISK"].map((trend) => (
              <button
                key={trend}
                onClick={() => setFilterTrend(trend)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  filterTrend === trend
                    ? "bg-[#00b4c3] text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {trend}
              </button>
            ))}
          </div>
        </div>

        {/* Engagements List */}
        {loading ? (
          <div className="text-center py-12 text-slate-600">Loading...</div>
        ) : engagements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-600">No brands found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {engagements.map((engagement) => (
              <div
                key={engagement.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                {/* Summary Row */}
                <button
                  onClick={() =>
                    setExpandedId(
                      expandedId === engagement.id ? null : engagement.id
                    )
                  }
                  className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-4">
                      {/* Overall Score Circle */}
                      <div
                        className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg ${getScoreBgColor(
                          engagement.overallScore
                        )} ${getScoreColor(engagement.overallScore)}`}
                      >
                        {engagement.overallScore}
                      </div>

                      <div className="flex-1">
                        <Link
                          href={`/brands/${engagement.brand.id}`}
                          className="font-bold text-slate-900 hover:text-[#00b4c3]"
                        >
                          {engagement.brand.name}
                        </Link>
                        <p className="text-sm text-slate-600">
                          {engagement.brand.pipelineStage}
                        </p>
                      </div>

                      {/* Trend Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          TREND_COLORS[engagement.engagementTrend]
                        }`}
                      >
                        {TREND_ICONS[engagement.engagementTrend]}{" "}
                        {engagement.engagementTrend}
                      </span>
                    </div>
                  </div>

                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ml-4 ${
                      expandedId === engagement.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>

                {/* Expanded Details */}
                {expandedId === engagement.id && (
                  <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
                    {/* Score Breakdown */}
                    <div className="mb-6">
                      <h4 className="font-medium text-slate-900 mb-4">
                        Score Breakdown
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-slate-600 font-medium mb-1">
                            Communication
                          </p>
                          <p className="text-lg font-bold text-slate-900">
                            {engagement.communicationScore}
                          </p>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{
                                width: `${engagement.communicationScore}%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-slate-600 font-medium mb-1">
                            Testing Velocity
                          </p>
                          <p className="text-lg font-bold text-slate-900">
                            {engagement.testingVelocity}
                          </p>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-purple-500 h-1.5 rounded-full"
                              style={{
                                width: `${engagement.testingVelocity}%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-slate-600 font-medium mb-1">
                            Pipeline Velocity
                          </p>
                          <p className="text-lg font-bold text-slate-900">
                            {engagement.pipelineVelocity}
                          </p>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-amber-500 h-1.5 rounded-full"
                              style={{
                                width: `${engagement.pipelineVelocity}%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-slate-600 font-medium mb-1">
                            Payment Score
                          </p>
                          <p className="text-lg font-bold text-slate-900">
                            {engagement.paymentScore}
                          </p>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{
                                width: `${engagement.paymentScore}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Raw Metrics */}
                    <div className="mb-6">
                      <h4 className="font-medium text-slate-900 mb-3">
                        Raw Metrics
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {engagement.daysSinceLastContact !== null && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-slate-600">
                              Days Since Contact
                            </p>
                            <p className="font-bold text-slate-900">
                              {engagement.daysSinceLastContact}
                            </p>
                          </div>
                        )}
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-slate-600">
                            Tests (Last 30d)
                          </p>
                          <p className="font-bold text-slate-900">
                            {engagement.testsLast30Days}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-slate-600">
                            Tests (Last 90d)
                          </p>
                          <p className="font-bold text-slate-900">
                            {engagement.testsLast90Days}
                          </p>
                        </div>
                        {engagement.avgInvoicePayDays && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-slate-600">
                              Avg Invoice Pay Days
                            </p>
                            <p className="font-bold text-slate-900">
                              {engagement.avgInvoicePayDays.toFixed(1)}
                            </p>
                          </div>
                        )}
                        {engagement.overdueInvoices > 0 && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-slate-600">
                              Overdue Invoices
                            </p>
                            <p className="font-bold text-red-600">
                              {engagement.overdueInvoices}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Last Calculated */}
                    <p className="text-xs text-slate-500">
                      Last calculated:{" "}
                      {new Date(engagement.lastCalculated).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
