"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

type DashData = {
  ok: boolean;
  role: string;
  userId?: string;
  counts: Record<string, number>;
  pipeline: { stage: string; count: number }[];
  testTypes: { type: string; count: number }[];
  testRequests?: { pending: number; approved: number; inTesting: number; complete: number; total: number; estimatedCost: number };
  revenue?: {
    totalPipeline: number;
    weightedForecast: number;
    actualRevenue: number;
    invoicePaid: number;
    invoiceOutstanding: number;
    dealCount: number;
    projectPipeline: { stage: string; count: number; value: number }[];
  };
  // Admin/Employee specific
  recentFabrics?: any[];
  recentTests?: any[];
  upcomingMeetings?: number;
  unreadNotifications?: number;
  pendingAccessRequests?: number;
  recentAuditLogs?: any[];
  // Sales specific
  salesBrands?: any[];
  brandEngagementScores?: any[];
  recentActivity?: any[];
  brandCount?: number;
  // Testing specific
  testTypeBreakdown?: any[];
  // Fabric specific
  fabricCount?: number;
  submissionsAwaitingReview?: number;
  recipeLibraryMatches?: number;
  // Factory specific
  factoryId?: string;
  factoryName?: string;
  factoryFabrics?: any[];
  factoryTestResults?: any[];
  // Brand user specific
  brandId?: string;
  brandName?: string;
  approvedTests?: any[];
  // Distributor specific
  distributorId?: string;
  distributorBrands?: any[];
  factoriesCount?: number;
};

const STAGE_COLORS: Record<string, string> = {
  LEAD: "#94a3b8",
  PRESENTATION: "#60a5fa",
  BRAND_TESTING: "#a78bfa",
  FACTORY_ONBOARDING: "#f59e0b",
  FACTORY_TESTING: "#fb923c",
  PRODUCTION: "#34d399",
  BRAND_EXPANSION: "#2dd4bf",
  ARCHIVE: "#6b7280",
  CUSTOMER_WON: "#22c55e",
};

const getStageLabels = (t: any): Record<string, string> => ({
  LEAD: t.dashboard.stageLead || "Lead",
  PRESENTATION: t.dashboard.stagePresentation || "Presentation",
  BRAND_TESTING: t.dashboard.stageBrandTesting || "Brand Testing",
  FACTORY_ONBOARDING: t.dashboard.stageFactoryOnboarding || "Factory Onboard",
  FACTORY_TESTING: t.dashboard.stageFactoryTesting || "Factory Testing",
  PRODUCTION: t.dashboard.stageProduction || "Production",
  BRAND_EXPANSION: t.dashboard.stageBrandExpansion || "Expansion",
  ARCHIVE: t.dashboard.stageArchive || "Archive",
  CUSTOMER_WON: t.dashboard.stageCustomerWon || "Won",
});

function StatCard({ label, value, icon, color, href }: { label: string; value: number | string; icon: string; color: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{typeof value === "number" ? value.toLocaleString() : value}</p>
        </div>
        <div className="text-3xl" style={{ opacity: 0.15 }}>{icon}</div>
      </div>
      <div className="mt-3 h-1 rounded-full" style={{ background: color, opacity: 0.6 }} />
    </div>
  );
  if (href) return <a href={href} className="block">{inner}</a>;
  return inner;
}

function PipelineBar({ data, brandPipelineLabel, stageLabels }: { data: { stage: string; count: number }[]; brandPipelineLabel: string; stageLabels: Record<string, string> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{brandPipelineLabel}</h3>
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.stage} className="flex items-center gap-3">
            <div className="w-28 text-xs font-semibold text-slate-600 text-right truncate">
              {stageLabels[d.stage] || d.stage}
            </div>
            <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max((d.count / max) * 100, 2)}%`,
                  background: STAGE_COLORS[d.stage] || "#94a3b8",
                }}
              >
                <span className="text-[11px] font-bold text-white drop-shadow">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestTypeChart({ data, testsByTypeLabel }: { data: { type: string; count: number }[]; testsByTypeLabel: string }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899"];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{testsByTypeLabel}</h3>
      <div className="flex gap-1 h-8 rounded-lg overflow-hidden mb-4">
        {data.map((d, i) => (
          <div
            key={d.type}
            className="transition-all duration-500 hover:opacity-80"
            style={{ width: `${(d.count / total) * 100}%`, background: colors[i % colors.length] }}
            title={`${d.type}: ${d.count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.map((d, i) => (
          <div key={d.type} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="font-semibold text-slate-600">{d.type}</span>
            <span className="text-slate-400 ml-auto">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Role-specific dashboard components
// ─────────────────────────────────────────

function QuickActionCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-black" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function MeetingsList({ meetings, label }: { meetings: number; label: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3">{label}</h3>
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="text-3xl font-black text-blue-600 mb-1">{meetings}</div>
          <p className="text-xs text-slate-500">upcoming meetings</p>
        </div>
      </div>
    </div>
  );
}

function BrandEngagementCard({ brand, score, trend }: { brand: any; score: number; trend: string }) {
  const trendColor = trend === "RISING" ? "text-emerald-600" : trend === "DECLINING" ? "text-red-600" : "text-slate-600";
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-bold text-sm text-slate-900">{brand?.name}</h4>
          <p className={`text-xs font-semibold mt-1 ${trendColor}`}>{trend}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-blue-600">{score}</div>
          <p className="text-[10px] text-slate-500">health</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function AuditLogItem({ log }: { log: any }) {
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
            {log.action}
          </span>
          <span className="text-xs font-semibold text-slate-600">{log.entity}</span>
        </div>
        <p className="text-xs text-slate-600 mt-1">{log.description}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">by {log.user?.name || "System"} • {new Date(log.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

// ADMIN/EMPLOYEE full dashboard
function AdminDashboard({ data, t }: { data: DashData; t: any }) {
  const c = data.counts;
  const stageLabels = getStageLabels(t);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{t.dashboard.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.dashboard.subtitle}</p>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <QuickActionCard label="Pending Approvals" value={data.pendingAccessRequests || 0} icon="⏳" color="#f59e0b" />
        <QuickActionCard label="Unread Notifications" value={data.unreadNotifications || 0} icon="🔔" color="#ef4444" />
        <QuickActionCard label="Upcoming Meetings" value={data.upcomingMeetings || 0} icon="📅" color="#3b82f6" />
        <QuickActionCard label="Access Requests" value={data.pendingAccessRequests || 0} icon="🔐" color="#8b5cf6" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={t.dashboard.fabrics} value={c.fabrics} icon="🧵" color="#3b82f6" href="/fabrics" />
        <StatCard label={t.dashboard.brands} value={c.brands} icon="🎯" color="#8b5cf6" href="/brands" />
        <StatCard label={t.dashboard.factories} value={c.factories} icon="🏭" color="#f59e0b" href="/factories" />
        <StatCard label={t.dashboard.testRuns} value={c.testRuns} icon="🧪" color="#10b981" href="/test-reports" />
      </div>

      {/* Revenue Pipeline KPIs */}
      {data.revenue && data.revenue.dealCount > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Revenue Pipeline</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
              <p className="text-[10px] font-medium text-slate-300 uppercase">Total Pipeline</p>
              <p className="text-xl font-black mt-0.5">
                ${data.revenue.totalPipeline >= 1000 ? `${(data.revenue.totalPipeline / 1000).toFixed(0)}K` : data.revenue.totalPipeline.toFixed(0)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{data.revenue.dealCount} deals</p>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 p-4">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Weighted Forecast</p>
              <p className="text-xl font-black text-emerald-600 mt-0.5">
                ${data.revenue.weightedForecast >= 1000 ? `${(data.revenue.weightedForecast / 1000).toFixed(0)}K` : data.revenue.weightedForecast.toFixed(0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-blue-200 p-4">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Invoiced & Paid</p>
              <p className="text-xl font-black text-blue-600 mt-0.5">
                ${data.revenue.invoicePaid >= 1000 ? `${(data.revenue.invoicePaid / 1000).toFixed(0)}K` : data.revenue.invoicePaid.toFixed(0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Outstanding</p>
              <p className="text-xl font-black text-amber-600 mt-0.5">
                ${data.revenue.invoiceOutstanding >= 1000 ? `${(data.revenue.invoiceOutstanding / 1000).toFixed(0)}K` : data.revenue.invoiceOutstanding.toFixed(0)}
              </p>
            </div>
            <a href="/pipeline" className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors group">
              <p className="text-[10px] font-medium text-slate-400 uppercase">View Pipeline</p>
              <p className="text-sm font-bold text-blue-600 mt-1 group-hover:text-blue-700">Open Pipeline Board &rarr;</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Manage deals by stage</p>
            </a>
          </div>
        </div>
      )}

      {/* Second row - more stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-blue-600">{c.icpResults}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.dashboard.icpResults}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-purple-600">{c.antibacterialResults}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.dashboard.antibacterial}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-amber-600">{c.fungalResults}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.dashboard.fungal}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">{c.submissions}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.dashboard.submissions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-slate-600">{c.labs}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.dashboard.labs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-slate-600">{c.distributors}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.dashboard.distributors}</p>
        </div>
      </div>

      {/* Pipeline + Test Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <PipelineBar data={data.pipeline} brandPipelineLabel={t.dashboard.brandPipeline} stageLabels={stageLabels} />
        </div>
        <TestTypeChart data={data.testTypes} testsByTypeLabel={t.dashboard.testsByType} />
      </div>

      {/* Recent Activity + Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Recent Fabrics */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t.dashboard.recentFabrics}</h3>
          <div className="space-y-2">
            {data.recentFabrics?.map((f: any) => (
              <a
                key={f.id}
                href={`/fabrics/${f.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div>
                  <span className="font-bold text-sm text-slate-900">
                    {f.fuzeNumber ? `FUZE ${f.fuzeNumber}` : "—"}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">{f.construction || ""}</span>
                  {f.brand?.name && (
                    <span className="text-xs text-blue-600 ml-2">{f.brand.name}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-blue-500">&rarr;</span>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Tests */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t.dashboard.recentTests}</h3>
          <div className="space-y-2">
            {data.recentTests?.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold mr-2 ${
                    t.testType === "ICP" ? "bg-blue-100 text-blue-700" :
                    t.testType === "ANTIBACTERIAL" ? "bg-purple-100 text-purple-700" :
                    t.testType === "FUNGAL" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {t.testType}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t.submission?.brand?.name || ""}
                    {t.submission?.fuzeFabricNumber ? ` #${t.submission.fuzeFabricNumber}` : ""}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {t.lab?.name || ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Audit Log */}
      {data.recentAuditLogs && data.recentAuditLogs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Activity</h3>
          <div className="space-y-1">
            {data.recentAuditLogs.map((log: any) => (
              <AuditLogItem key={log.id} log={log} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// SALES_MANAGER/SALES_REP dashboard
function SalesDashboard({ data, t }: { data: DashData; t: any }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">My Pipeline</h1>
        <p className="text-sm text-slate-500 mt-1">Track your brands, engagement, and upcoming activities</p>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Brands" value={data.brandCount || 0} icon="🎯" color="#8b5cf6" href="/brands" />
        <StatCard label="Upcoming Meetings" value={data.upcomingMeetings || 0} icon="📅" color="#3b82f6" href="/meetings" />
        <StatCard label="Pipeline Value" value={data.revenue?.totalPipeline || 0} icon="💰" color="#10b981" href="/pipeline" />
        <StatCard label="Weighted Forecast" value={data.revenue?.weightedForecast || 0} icon="📊" color="#f59e0b" href="/revenue" />
      </div>

      {/* Brand Engagement Scores */}
      {data.brandEngagementScores && data.brandEngagementScores.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Brand Health Scores</h2>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {data.brandEngagementScores.map((score: any) => (
              <BrandEngagementCard
                key={score.id}
                brand={score.brand}
                score={score.overallScore}
                trend={score.engagementTrend}
              />
            ))}
          </div>
        </div>
      )}

      {/* My Brands Pipeline */}
      {data.salesBrands && data.salesBrands.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">My Brands</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="space-y-3">
              {data.salesBrands.map((brand: any) => (
                <a
                  key={brand.id}
                  href={`/brands/${brand.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{brand.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Stage: {brand.pipelineStage}</p>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-blue-500">&rarr;</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data.recentActivity && data.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Activity</h3>
          <div className="space-y-3">
            {data.recentActivity.map((activity: any) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-slate-900">{activity.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{activity.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(activity.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// TESTING_MANAGER dashboard
function TestingDashboard({ data, t }: { data: DashData; t: any }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Testing Center</h1>
        <p className="text-sm text-slate-500 mt-1">Track test requests, results, and schedules</p>
      </div>

      {/* Test Request Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Pending Approval" value={data.testRequests?.pending || 0} icon="⏳" color="#f59e0b" />
        <StatCard label="Approved" value={data.testRequests?.approved || 0} icon="✅" color="#10b981" />
        <StatCard label="In Testing" value={data.testRequests?.inTesting || 0} icon="🧪" color="#3b82f6" />
        <StatCard label="Complete" value={data.testRequests?.complete || 0} icon="✨" color="#8b5cf6" />
        <StatCard label="Upcoming Meetings" value={data.upcomingMeetings || 0} icon="📅" color="#ef4444" />
      </div>

      {/* Test Type Breakdown */}
      {data.testTypeBreakdown && data.testTypeBreakdown.length > 0 && (
        <div className="mb-6">
          <TestTypeChart data={data.testTypeBreakdown} testsByTypeLabel="Test Distribution" />
        </div>
      )}

      {/* Recent Test Results */}
      {data.recentTests && data.recentTests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Test Results</h3>
          <div className="space-y-2">
            {data.recentTests.map((test: any) => (
              <div key={test.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold mr-2 ${
                    test.testType === "ICP" ? "bg-blue-100 text-blue-700" :
                    test.testType === "ANTIBACTERIAL" ? "bg-purple-100 text-purple-700" :
                    test.testType === "FUNGAL" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {test.testType}
                  </span>
                  <span className="text-xs text-slate-600">{test.submission?.brand?.name || "Unknown"}</span>
                </div>
                <span className={`text-xs font-bold ${
                  test.testStatus === "PASSED" || test.testStatus === "PASSED_COMPLETE" ? "text-emerald-600" :
                  test.testStatus === "FAILED" ? "text-red-600" :
                  "text-slate-600"
                }`}>
                  {test.testStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// FABRIC_MANAGER dashboard
function FabricDashboard({ data, t }: { data: DashData; t: any }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Fabric Management</h1>
        <p className="text-sm text-slate-500 mt-1">Manage fabrics, submissions, and recipe library</p>
      </div>

      {/* Fabric Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Fabrics" value={data.fabricCount || 0} icon="🧵" color="#3b82f6" href="/fabrics" />
        <StatCard label="Awaiting Review" value={data.submissionsAwaitingReview || 0} icon="📋" color="#f59e0b" href="/fabrics" />
        <StatCard label="Recipe Matches" value={data.recipeLibraryMatches || 0} icon="📚" color="#8b5cf6" href="/recipes" />
        <StatCard label="Test Runs" value={data.counts?.testRuns || 0} icon="🧪" color="#10b981" href="/test-reports" />
      </div>

      {/* Recent Fabrics */}
      {data.recentFabrics && data.recentFabrics.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Fabrics</h3>
          <div className="space-y-2">
            {data.recentFabrics.map((f: any) => (
              <a
                key={f.id}
                href={`/fabrics/${f.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div>
                  <span className="font-bold text-sm text-slate-900">
                    {f.fuzeNumber ? `FUZE ${f.fuzeNumber}` : "—"}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">{f.construction || ""}</span>
                  {f.brand?.name && (
                    <span className="text-xs text-blue-600 ml-2">{f.brand.name}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-blue-500">&rarr;</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// FACTORY_MANAGER/FACTORY_USER dashboard
function FactoryDashboard({ data, t }: { data: DashData; t: any }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">My Factory: {data.factoryName || "Loading..."}</h1>
        <p className="text-sm text-slate-500 mt-1">Track fabrics, test results, and shipments</p>
      </div>

      {/* Factory Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Fabrics in Factory" value={data.factoryFabrics?.length || 0} icon="🧵" color="#3b82f6" href="/factory-portal/fabrics" />
        <StatCard label="Test Results" value={data.factoryTestResults?.length || 0} icon="🧪" color="#10b981" href="/factory-portal/tests" />
        <StatCard label="Upcoming Meetings" value={data.upcomingMeetings || 0} icon="📅" color="#f59e0b" />
        <StatCard label="Factory ID" value={data.factoryId?.substring(0, 8).toUpperCase() || "—"} icon="🏭" color="#8b5cf6" />
      </div>

      {/* Factory Fabrics */}
      {data.factoryFabrics && data.factoryFabrics.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Factory Fabrics</h3>
          <div className="space-y-2">
            {data.factoryFabrics.map((f: any) => (
              <a
                key={f.id}
                href={`/fabrics/${f.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div>
                  <span className="font-bold text-sm text-slate-900">
                    {f.fuzeNumber ? `FUZE ${f.fuzeNumber}` : "—"}
                  </span>
                  {f.brand?.name && (
                    <span className="text-xs text-blue-600 ml-2">{f.brand.name}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-blue-500">&rarr;</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {data.factoryTestResults && data.factoryTestResults.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Test Results</h3>
          <div className="space-y-2">
            {data.factoryTestResults.map((test: any) => (
              <div key={test.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className="text-xs font-bold text-slate-700">{test.testType}</span>
                  <span className="text-xs text-slate-600 ml-2">{test.submission?.fuzeFabricNumber}</span>
                </div>
                <span className="text-xs text-slate-500">{test.testStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// BRAND_USER dashboard
function BrandDashboard({ data, t }: { data: DashData; t: any }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Welcome, {data.brandName}!</h1>
        <p className="text-sm text-slate-500 mt-1">View your approved test results and shipments</p>
      </div>

      {/* Brand Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Approved Tests" value={data.approvedTests?.length || 0} icon="✅" color="#10b981" />
        <StatCard label="Upcoming Meetings" value={data.upcomingMeetings || 0} icon="📅" color="#3b82f6" />
        <StatCard label="Brand Portal" value="Live" icon="🌐" color="#8b5cf6" />
        <StatCard label="Notifications" value={data.unreadNotifications || 0} icon="🔔" color="#f59e0b" />
      </div>

      {/* Approved Test Results */}
      {data.approvedTests && data.approvedTests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Your Approved Test Results</h3>
          <div className="space-y-2">
            {data.approvedTests.map((test: any) => (
              <div key={test.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold mr-2 ${
                    test.testType === "ICP" ? "bg-blue-100 text-blue-700" :
                    test.testType === "ANTIBACTERIAL" ? "bg-purple-100 text-purple-700" :
                    test.testType === "FUNGAL" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {test.testType}
                  </span>
                  <span className="text-xs text-slate-600">{test.submission?.fuzeFabricNumber}</span>
                </div>
                {test.testReportNumber && (
                  <a href={`/tests/${test.id}`} className="text-xs text-blue-600 hover:text-blue-700">
                    Report &rarr;
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// DISTRIBUTOR_USER dashboard
function DistributorDashboard({ data, t }: { data: DashData; t: any }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Distributor Portal</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of brands and factories</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Brands" value={data.distributorBrands?.length || 0} icon="🎯" color="#8b5cf6" href="/brands" />
        <StatCard label="Factories" value={data.factoriesCount || 0} icon="🏭" color="#f59e0b" href="/factories" />
        <StatCard label="Total Tests" value={data.counts?.testRuns || 0} icon="🧪" color="#10b981" href="/test-reports" />
        <StatCard label="Contacts" value={data.counts?.contacts || 0} icon="👥" color="#3b82f6" />
      </div>

      {/* Brands Overview */}
      {data.distributorBrands && data.distributorBrands.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Brands You Distribute</h3>
          <div className="space-y-2">
            {data.distributorBrands.map((brand: any) => (
              <a
                key={brand.id}
                href={`/brands/${brand.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <span className="font-semibold text-sm text-slate-900">{brand.name}</span>
                <span className="text-xs text-slate-400 group-hover:text-blue-500">&rarr;</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-lg">{t.dashboard.loadingDashboard}</div>;
  if (!data) return <div className="text-red-500 p-6">{t.dashboard.loadFailed}</div>;

  // Route to appropriate dashboard based on role
  if (data.role === "ADMIN" || data.role === "EMPLOYEE") {
    return <AdminDashboard data={data} t={t} />;
  } else if (data.role === "SALES_MANAGER" || data.role === "SALES_REP") {
    return <SalesDashboard data={data} t={t} />;
  } else if (data.role === "TESTING_MANAGER") {
    return <TestingDashboard data={data} t={t} />;
  } else if (data.role === "FABRIC_MANAGER") {
    return <FabricDashboard data={data} t={t} />;
  } else if (data.role === "FACTORY_MANAGER" || data.role === "FACTORY_USER") {
    // Redirect factory users to their dedicated portal
    if (typeof window !== "undefined") window.location.href = "/factory-portal";
    return <div className="flex items-center justify-center h-64 text-slate-400 text-lg">Redirecting to Factory Portal...</div>;
  } else if (data.role === "BRAND_USER") {
    return <BrandDashboard data={data} t={t} />;
  } else if (data.role === "DISTRIBUTOR_USER") {
    return <DistributorDashboard data={data} t={t} />;
  }

  // Fallback to admin dashboard for unknown roles
  return <AdminDashboard data={data} t={t} />;
}
