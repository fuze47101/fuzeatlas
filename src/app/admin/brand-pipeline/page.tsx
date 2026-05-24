"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BulkEnrichButton from "@/components/BulkEnrichButton";
import { useI18n } from "@/i18n";

// ── Types ──
interface OutreachCheck {
  type: string;
  userId: string;
  sentAt: string;
  user: { name: string };
}

interface Contact {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  outreachStatus: string | null;
  lastContactedAt: string | null;
  outreachCount: number | null;
  decisionMaker: boolean | null;
  emailStatus: string | null;
  outreachChecks: OutreachCheck[];
}

interface BrandEntry {
  id: string;
  name: string;
  stage: string;
  customerType: string | null;
  website: string | null;
  linkedIn: string | null;
  validationStatus: string | null;
  fuzeRelevance: string | null;
  textileCategory: string | null;
  salesRep: string | null;
  engagementScore: number | null;
  engagementTrend: string | null;
  primaryContact: Contact | null;
  contacts: Contact[];
  contactCount: number;
  hasEnrichedContacts: boolean;
  lastNote: { content: string; noteType: string; date: string; contactName: string | null } | null;
  daysSinceActivity: number | null;
  counts: Record<string, number>;
  predictedValueUSD: number | null;
  predictedValueComputedAt: string | null;
  predictedValueFactors: any;
  createdAt: string;
  dateOfInitialContact: string | null;
}

// ── Constants ──
// Re-Connect (BRAND_EXPANSION) sits right after Presentation in the
// workflow: a brand stalls post-presentation and goes here for
// re-engagement before being pulled back into BRAND_TESTING. Andrew
// 2026-05-18.
const STAGES_BASE = [
  { key: "LEAD", labelKey: "stageLead", color: "bg-indigo-500" },
  { key: "PRESENTATION", labelKey: "stagePresentation", color: "bg-purple-500" },
  { key: "BRAND_EXPANSION", labelKey: "stageReConnect", color: "bg-emerald-500" },
  { key: "BRAND_TESTING", labelKey: "stageBrandTesting", color: "bg-sky-500" },
  { key: "FACTORY_ONBOARDING", labelKey: "stageFactoryOnboard", color: "bg-amber-500" },
  { key: "FACTORY_TESTING", labelKey: "stageFactoryTesting", color: "bg-orange-500" },
  { key: "PRODUCTION", labelKey: "stageProduction", color: "bg-green-500" },
  { key: "CUSTOMER_WON", labelKey: "stageWon", color: "bg-teal-600" },
];

const STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-indigo-100 text-indigo-700",
  PRESENTATION: "bg-purple-100 text-purple-700",
  BRAND_TESTING: "bg-sky-100 text-sky-700",
  FACTORY_ONBOARDING: "bg-amber-100 text-amber-700",
  FACTORY_TESTING: "bg-orange-100 text-orange-700",
  PRODUCTION: "bg-green-100 text-green-700",
  BRAND_EXPANSION: "bg-emerald-100 text-emerald-700",
  CUSTOMER_WON: "bg-teal-100 text-teal-700",
  ARCHIVE: "bg-slate-100 text-slate-500",
};

// MB-4 — chip color scales with stage-probability so the eye can
// scan high-confidence dollar values quickly. Thresholds match the
// STAGE_PROBABILITY lookup in src/lib/pipeline-prediction.ts.
function potentialChipClass(stageProbability: number | undefined | null): string {
  const p = typeof stageProbability === "number" ? stageProbability : 0;
  if (p >= 0.65) return "bg-emerald-100 text-emerald-700"; // FACTORY_TESTING+
  if (p >= 0.30) return "bg-amber-100 text-amber-700"; // BRAND_TESTING / FACTORY_ONBOARDING
  return "bg-slate-100 text-slate-600"; // LEAD / PRESENTATION
}

function potentialTooltip(b: BrandEntry): string {
  const f = (b.predictedValueFactors || {}) as any;
  const parts = [
    `$${Math.round((b.predictedValueUSD || 0)).toLocaleString()} predicted (12mo)`,
    `Stage: ${f.pipelineStage || b.stage} (${Math.round((f.stageProbability || 0) * 100)}%)`,
    f.matchedVertical ? `Vertical: ${f.matchedVertical}` : "Vertical: default",
    `Base annual: ${Math.round(f.verticalBaseAnnualL || 0).toLocaleString()} L`,
    `Engagement ×${(f.engagementMultiplier || 1).toFixed(2)}`,
    `Relevance ×${(f.relevanceMultiplier || 1).toFixed(2)}`,
    f.actualsAnchor ? "(anchored to actuals)" : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

const RELEVANCE_BADGE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-cyan-100 text-cyan-700",
  low: "bg-amber-100 text-amber-700",
  none: "bg-red-100 text-red-700",
};

const OUTREACH_BADGE: Record<string, string> = {
  not_contacted: "bg-slate-100 text-slate-500",
  contacted: "bg-blue-100 text-blue-700",
  responded: "bg-green-100 text-green-700",
  meeting_booked: "bg-emerald-100 text-emerald-700",
  not_interested: "bg-red-100 text-red-600",
};

// Helper: check if current user has a specific outreach type on a contact
function myCheck(checks: OutreachCheck[], type: string, userId: string): OutreachCheck | undefined {
  return checks?.find((c) => c.type === type && c.userId === userId);
}
function othersChecked(checks: OutreachCheck[], type: string, userId: string): OutreachCheck[] {
  return checks?.filter((c) => c.type === type && c.userId !== userId) || [];
}

export default function BrandPipelinePage() {
  const { t } = useI18n();
  const T = t.brandPipelineAdmin;
  const STAGES = STAGES_BASE.map(s => ({ key: s.key, label: (T as any)[s.labelKey], color: s.color }));
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<BrandEntry[]>([]);
  const [stageSummary, setStageSummary] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [search, setSearch] = useState("");
  // This page is hard-scoped to LEAD stage only. Once a brand moves to
  // PRESENTATION it's a Partner and lives on /admin/accounts (or /brands).
  // Keep as state so existing loadData references don't break, but we never
  // let the user change it and we never render a stage-filter bar here.
  const [stageFilter] = useState("LEAD");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState("actionable");
  const [sortBy, setSortBy] = useState<"relevance" | "stage" | "name" | "activity" | "contacts" | "potential">(
    "relevance",
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Quick note form
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({ content: "", noteType: "NOTE" });
  const [noteSaving, setNoteSaving] = useState(false);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stageFilter !== "all") params.set("stage", stageFilter);
    if (relevanceFilter !== "all") params.set("relevance", relevanceFilter);
    params.set("view", viewFilter);
    // Hard-scope this page to LEAD-only brands; Accounts page lives separately.
    params.set("mode", "pipeline");

    try {
      const res = await fetch(`/api/admin/brand-pipeline?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setPipeline(data.pipeline || []);
        setStageSummary(data.stageSummary || {});
        setStats(data.stats || null);
        if (data.currentUserId) setCurrentUserId(data.currentUserId);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, relevanceFilter, viewFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stage change
  const handleStageChange = async (brandId: string, newStage: string) => {
    try {
      await fetch(`/api/brands/${brandId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage }),
      });
      loadData();
    } catch {}
  };

  // Quick note
  const handleQuickNote = async (brandId: string) => {
    if (!noteForm.content.trim()) return;
    setNoteSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, content: noteForm.content, noteType: noteForm.noteType }),
      });
      setNoteTarget(null);
      setNoteForm({ content: "", noteType: "NOTE" });
      loadData();
    } catch {
    } finally {
      setNoteSaving(false);
    }
  };

  // Per-user outreach toggle (LinkedIn or Email)
  const handleOutreachToggle = async (contactId: string, type: "LINKEDIN" | "EMAIL") => {
    try {
      await fetch("/api/admin/contact-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, type }),
      });
      loadData();
    } catch {}
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Sort
  const RELEVANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
  const sorted = [...pipeline].sort((a, b) => {
    if (sortBy === "relevance") {
      const relA = RELEVANCE_ORDER[a.fuzeRelevance || "none"] ?? 3;
      const relB = RELEVANCE_ORDER[b.fuzeRelevance || "none"] ?? 3;
      if (relA !== relB) return relA - relB;
      if (a.hasEnrichedContacts && !b.hasEnrichedContacts) return -1;
      if (!a.hasEnrichedContacts && b.hasEnrichedContacts) return 1;
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "activity") return (a.daysSinceActivity ?? 999) - (b.daysSinceActivity ?? 999);
    if (sortBy === "contacts") return b.contactCount - a.contactCount;
    if (sortBy === "potential") {
      // MB-4 — sort by predicted $ value, descending. Brands without
      // a prediction (cron hasn't stamped yet, or stage is ARCHIVE)
      // fall to the bottom rather than disappearing.
      const va = a.predictedValueUSD ?? -1;
      const vb = b.predictedValueUSD ?? -1;
      if (vb !== va) return vb - va;
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            {T.pageTitle}{" "}
            <span className="text-slate-400 font-semibold text-lg">({stageSummary.LEAD || 0})</span>
          </h1>
          <p className="text-sm text-slate-500">
            {T.pageDescriptionPart1}{" "}
            <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">
              {T.pageDescriptionStage}
            </span>{" "}
            {T.pageDescriptionPart2}{" "}
            <span className="text-slate-700 font-semibold">{T.pageDescriptionPresentation}</span> {T.pageDescriptionPart3}{" "}
            <Link href="/admin/accounts" className="text-cyan-700 hover:underline font-semibold">
              {T.pageDescriptionAccounts}
            </Link>{" "}
            {T.pageDescriptionEnd}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <BulkEnrichButton variant="compact" />
          <Link
            href="/admin/brand-discovery"
            className="px-3 py-2 text-xs font-bold rounded-lg bg-cyan-100 text-cyan-700 hover:bg-cyan-200 transition"
          >
            {T.btnDiscoverBrands}
          </Link>
          <Link
            href="/admin/brand-audit"
            className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            {T.btnAudit}
          </Link>
        </div>
      </div>

      {/* Pipeline Stage Bar removed — this page is LEAD-only by design. */}

      {/* Stats Strip */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          <div className="bg-white border rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-slate-700">{stats.totalBrands}</p>
            <p className="text-[9px] font-semibold text-slate-500 uppercase">{T.statTotal}</p>
          </div>
          <div
            className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 text-center cursor-pointer hover:shadow-md"
            onClick={() => setViewFilter("enriched")}
          >
            <p className="text-lg font-black text-cyan-700">{stats.enriched}</p>
            <p className="text-[9px] font-semibold text-cyan-600 uppercase">{T.statEnriched}</p>
          </div>
          <div
            className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center cursor-pointer hover:shadow-md"
            onClick={() => setViewFilter("verified")}
          >
            <p className="text-lg font-black text-emerald-700">{stats.verified}</p>
            <p className="text-[9px] font-semibold text-emerald-600 uppercase">{T.statVerified}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-blue-700">{stats.contacted}</p>
            <p className="text-[9px] font-semibold text-blue-500 uppercase">{T.statContacted}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-amber-600">{stats.stale}</p>
            <p className="text-[9px] font-semibold text-amber-500 uppercase">{T.statStale}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-red-600">{stats.noActivity}</p>
            <p className="text-[9px] font-semibold text-red-500 uppercase">{T.statNoActivity}</p>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder={T.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
        />
        <select
          value={relevanceFilter}
          onChange={(e) => setRelevanceFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="all">{T.filterAllRelevance}</option>
          <option value="high">{T.relevanceHigh}</option>
          <option value="medium">{T.relevanceMedium}</option>
          <option value="low">{T.relevanceLow}</option>
        </select>
        <select
          value={viewFilter}
          onChange={(e) => setViewFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="actionable">{T.viewActionable}</option>
          <option value="enriched">{T.viewEnriched}</option>
          <option value="verified">{T.viewVerified}</option>
          <option value="all">{T.viewAll}</option>
          <option value="everything">{T.viewEverything}</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="relevance">{T.sortRelevance}</option>
          <option value="potential">{T.sortPotential}</option>
          <option value="stage">{T.sortStage}</option>
          <option value="name">{T.sortName}</option>
          <option value="activity">{T.sortActivity}</option>
          <option value="contacts">{T.sortContacts}</option>
        </select>
      </div>

      {/* Brand List */}
      <div className="space-y-1">
        {sorted.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-xl">
            <p className="text-slate-400">{T.emptyBrands}</p>
          </div>
        ) : (
          sorted.map((b) => {
            const isExpanded = expanded.has(b.id);
            const isNoting = noteTarget === b.id;
            const activityColor =
              b.daysSinceActivity === null
                ? "text-red-500"
                : b.daysSinceActivity > 30
                  ? "text-amber-600"
                  : b.daysSinceActivity > 7
                    ? "text-slate-500"
                    : "text-emerald-600";

            // Check if primary contact has been reached by me
            const pcLI = b.primaryContact
              ? myCheck(b.primaryContact.outreachChecks || [], "LINKEDIN", currentUserId)
              : undefined;
            const pcEM = b.primaryContact
              ? myCheck(b.primaryContact.outreachChecks || [], "EMAIL", currentUserId)
              : undefined;
            const pcLIOthers = b.primaryContact
              ? othersChecked(b.primaryContact.outreachChecks || [], "LINKEDIN", currentUserId)
              : [];
            const pcEMOthers = b.primaryContact
              ? othersChecked(b.primaryContact.outreachChecks || [], "EMAIL", currentUserId)
              : [];

            return (
              <div
                key={b.id}
                className="bg-white border rounded-xl overflow-hidden hover:shadow-sm transition"
              >
                {/* Main Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => toggle(b.id)}
                >
                  {/* Expand arrow */}
                  <span className="text-xs text-slate-400 w-4">{isExpanded ? "▼" : "▶"}</span>

                  {/* Brand name + stage */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/brands/${b.id}`}
                        className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {b.name}
                      </Link>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${STAGE_COLORS[b.stage] || STAGE_COLORS.LEAD}`}
                      >
                        {STAGES.find((s) => s.key === b.stage)?.label || b.stage}
                      </span>
                      {b.fuzeRelevance && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${RELEVANCE_BADGE[b.fuzeRelevance] || ""}`}
                        >
                          {b.fuzeRelevance}
                        </span>
                      )}
                      {b.textileCategory && (
                        <span className="text-[10px] text-slate-400 truncate hidden lg:inline">
                          {b.textileCategory.replace(/_/g, " ")}
                        </span>
                      )}
                      {/* MB-4 — predicted 12-month $ value. Color
                          scales with stage probability (green = late
                          stage / high confidence, yellow = mid,
                          slate = early lead). Tooltip surfaces the
                          factor breakdown. */}
                      {b.predictedValueUSD != null && b.predictedValueUSD > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${potentialChipClass(b.predictedValueFactors?.stageProbability)}`}
                          title={potentialTooltip(b)}
                        >
                          ${Math.round(b.predictedValueUSD / 1000)}{T.potentialChipSuffix}
                        </span>
                      )}
                    </div>
                    {b.salesRep && (
                      <span className="text-[10px] text-slate-400">{T.repPrefix} {b.salesRep}</span>
                    )}
                  </div>

                  {/* Primary Contact + Outreach Checkmarks */}
                  <div className="hidden md:flex items-center gap-3 w-[340px] shrink-0">
                    {b.primaryContact ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {b.primaryContact.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {b.primaryContact.jobTitle || "—"}
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* LinkedIn link + check */}
                          {b.primaryContact.linkedinUrl && (
                            <a
                              href={b.primaryContact.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              in
                            </a>
                          )}
                          <button
                            onClick={() => handleOutreachToggle(b.primaryContact!.id, "LINKEDIN")}
                            className={`w-6 h-6 flex items-center justify-center rounded border-2 text-[9px] font-black transition ${
                              pcLI
                                ? "bg-blue-600 border-blue-600 text-white"
                                : pcLIOthers.length > 0
                                  ? "bg-blue-100 border-blue-300 text-blue-600"
                                  : "bg-white border-slate-300 text-slate-400 hover:border-blue-400"
                            }`}
                            title={
                              pcLI
                                ? `You sent LI ${new Date(pcLI.sentAt).toLocaleDateString()}`
                                : pcLIOthers.length > 0
                                  ? `${pcLIOthers[0].user.name} sent LI`
                                  : T.titleMarkLinkedInSent
                            }
                          >
                            {pcLI ? "✓" : pcLIOthers.length > 0 ? "·" : "LI"}
                          </button>

                          {/* Email link + check */}
                          {b.primaryContact.email && (
                            <a
                              href={`mailto:${b.primaryContact.email}`}
                              className="px-1.5 py-0.5 text-[9px] font-bold bg-violet-100 text-violet-700 rounded hover:bg-violet-200"
                            >
                              @
                            </a>
                          )}
                          <button
                            onClick={() => handleOutreachToggle(b.primaryContact!.id, "EMAIL")}
                            className={`w-6 h-6 flex items-center justify-center rounded border-2 text-[9px] font-black transition ${
                              pcEM
                                ? "bg-violet-600 border-violet-600 text-white"
                                : pcEMOthers.length > 0
                                  ? "bg-violet-100 border-violet-300 text-violet-600"
                                  : "bg-white border-slate-300 text-slate-400 hover:border-violet-400"
                            }`}
                            title={
                              pcEM
                                ? `You emailed ${new Date(pcEM.sentAt).toLocaleDateString()}`
                                : pcEMOthers.length > 0
                                  ? `${pcEMOthers[0].user.name} emailed`
                                  : T.titleMarkEmailSent
                            }
                          >
                            {pcEM ? "✓" : pcEMOthers.length > 0 ? "·" : "Em"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">{T.noContacts}</span>
                    )}
                  </div>

                  {/* Last Activity */}
                  <div className="w-[80px] text-right shrink-0 hidden sm:block">
                    <p className={`text-xs font-bold ${activityColor}`}>
                      {b.daysSinceActivity === null
                        ? T.activityNever
                        : b.daysSinceActivity === 0
                          ? T.activityToday
                          : T.activityDaysAgo.replace("{n}", String(b.daysSinceActivity))}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {b.contactCount} {b.contactCount !== 1 ? T.contactsSuffix : T.contactSuffix}
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setNoteTarget(isNoting ? null : b.id);
                        setNoteForm({ content: "", noteType: "NOTE" });
                      }}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                      title={T.titleLogActivity}
                    >
                      {T.btnNote}
                    </button>
                    <select
                      value={b.stage}
                      onChange={(e) => handleStageChange(b.id, e.target.value)}
                      className="px-1 py-1 text-[10px] border border-slate-200 rounded bg-white"
                      title={T.titleChangeStage}
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                      <option value="ARCHIVE">{T.btnArchive}</option>
                    </select>
                  </div>
                </div>

                {/* Quick Note Form */}
                {isNoting && (
                  <div className="border-t bg-blue-50 px-4 py-3">
                    <div className="flex gap-2 items-start">
                      <select
                        value={noteForm.noteType}
                        onChange={(e) => setNoteForm({ ...noteForm, noteType: e.target.value })}
                        className="px-2 py-1.5 border border-slate-300 rounded text-xs shrink-0"
                      >
                        <option value="NOTE">{T.noteTypeNote}</option>
                        <option value="CALL">{T.noteTypeCall}</option>
                        <option value="EMAIL">{T.noteTypeEmail}</option>
                        <option value="MEETING">{T.noteTypeMeeting}</option>
                        <option value="FOLLOW_UP">{T.noteTypeFollowUp}</option>
                      </select>
                      <input
                        type="text"
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && noteForm.content.trim()) handleQuickNote(b.id);
                        }}
                        placeholder={T.quickNotePlaceholder}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleQuickNote(b.id)}
                        disabled={noteSaving || !noteForm.content.trim()}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {noteSaving ? "..." : T.noteSave}
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t bg-slate-50 px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Contacts with outreach checkmarks */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                          {T.contactsLabel} ({b.contactCount})
                        </p>
                        {b.contacts.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            {T.noContactsRun}{" "}
                            <Link
                              href={`/brands/${b.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {T.runResearch}
                            </Link>
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {b.contacts.map((c) => {
                              const liMe = myCheck(
                                c.outreachChecks || [],
                                "LINKEDIN",
                                currentUserId,
                              );
                              const emMe = myCheck(c.outreachChecks || [], "EMAIL", currentUserId);
                              const liOthers = othersChecked(
                                c.outreachChecks || [],
                                "LINKEDIN",
                                currentUserId,
                              );
                              const emOthers = othersChecked(
                                c.outreachChecks || [],
                                "EMAIL",
                                currentUserId,
                              );

                              return (
                                <div key={c.id} className="p-2 bg-white rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-[10px] shrink-0">
                                      {(c.name || "?")[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-700 truncate">
                                        {c.name}
                                        {c.decisionMaker && (
                                          <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-1 rounded">
                                            {T.badgeDM}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {c.jobTitle || ""}
                                      </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      {c.linkedinUrl && (
                                        <a
                                          href={c.linkedinUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white rounded text-[8px] font-bold hover:bg-blue-700"
                                        >
                                          in
                                        </a>
                                      )}
                                      {c.email && (
                                        <a
                                          href={`mailto:${c.email}`}
                                          className="w-5 h-5 flex items-center justify-center bg-violet-100 text-violet-700 rounded text-[8px] hover:bg-violet-200"
                                          title={c.email}
                                        >
                                          @
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Outreach checkmarks row */}
                                  <div className="flex items-center gap-2 mt-2 ml-8">
                                    <button
                                      onClick={() => handleOutreachToggle(c.id, "LINKEDIN")}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${
                                        liMe
                                          ? "bg-blue-600 text-white"
                                          : liOthers.length > 0
                                            ? "bg-blue-50 text-blue-600 border border-blue-200"
                                            : "bg-slate-50 text-slate-400 border border-slate-200 hover:border-blue-300 hover:text-blue-500"
                                      }`}
                                    >
                                      {liMe ? "✓ " : ""}{T.linkedInSentLabel}
                                      {liOthers.length > 0 && !liMe && (
                                        <span className="text-[8px] ml-1">
                                          ({liOthers[0].user.name})
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleOutreachToggle(c.id, "EMAIL")}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${
                                        emMe
                                          ? "bg-violet-600 text-white"
                                          : emOthers.length > 0
                                            ? "bg-violet-50 text-violet-600 border border-violet-200"
                                            : "bg-slate-50 text-slate-400 border border-slate-200 hover:border-violet-300 hover:text-violet-500"
                                      }`}
                                    >
                                      {emMe ? "✓ " : ""}{T.emailSentLabel}
                                      {emOthers.length > 0 && !emMe && (
                                        <span className="text-[8px] ml-1">
                                          ({emOthers[0].user.name})
                                        </span>
                                      )}
                                    </button>
                                    {(liMe || emMe) && (
                                      <span className="text-[9px] text-slate-400">
                                        {liMe &&
                                          `LI: ${new Date(liMe.sentAt).toLocaleDateString()}`}
                                        {liMe && emMe && " · "}
                                        {emMe &&
                                          `Em: ${new Date(emMe.sentAt).toLocaleDateString()}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Last Activity */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                          {T.sectionLastActivity}
                        </p>
                        {b.lastNote ? (
                          <div className="p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  b.lastNote.noteType === "CALL"
                                    ? "bg-blue-100 text-blue-700"
                                    : b.lastNote.noteType === "EMAIL"
                                      ? "bg-violet-100 text-violet-700"
                                      : b.lastNote.noteType === "MEETING"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {(b.lastNote.noteType || "NOTE").replace("_", " ")}
                              </span>
                              {b.lastNote.contactName && (
                                <span className="text-[10px] text-slate-500">
                                  {b.lastNote.contactName}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 ml-auto">
                                {new Date(b.lastNote.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 line-clamp-3">
                              {b.lastNote.content}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic p-2">
                            {T.noActivityLogged}
                          </p>
                        )}
                      </div>

                      {/* Quick Stats & Links */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                          {T.sectionDetails}
                        </p>
                        <div className="space-y-1 text-xs">
                          {b.website && (
                            <a
                              href={
                                b.website.startsWith("http") ? b.website : `https://${b.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline block truncate"
                            >
                              {b.website}
                            </a>
                          )}
                          {b.textileCategory && (
                            <p className="text-slate-600">
                              {T.categoryLabel} {b.textileCategory.replace(/_/g, " ")}
                            </p>
                          )}
                          {b.validationStatus && (
                            <p className="text-slate-600">{T.validationLabel} {b.validationStatus}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {b.counts.fabrics > 0 && (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-600">
                                {b.counts.fabrics} {T.fabricsSuffix}
                              </span>
                            )}
                            {b.counts.submissions > 0 && (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-600">
                                {b.counts.submissions} {T.submissionsSuffix}
                              </span>
                            )}
                            {b.counts.factories > 0 && (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-600">
                                {b.counts.factories} {T.factoriesSuffix}
                              </span>
                            )}
                            {b.counts.sows > 0 && (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-600">
                                {b.counts.sows} {T.sowsSuffix}
                              </span>
                            )}
                            {b.counts.fuzeOrders > 0 && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 rounded text-[9px] text-emerald-700">
                                {b.counts.fuzeOrders} {T.ordersSuffix}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Link
                              href={`/brands/${b.id}`}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
                            >
                              {T.btnOpenBrand}
                            </Link>
                            <Link
                              href={`/brands/${b.id}#activity`}
                              className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-200"
                            >
                              {T.btnFullCRM}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {sorted.length > 0 && (
        <p className="text-xs text-slate-400 text-center mt-4">
          {T.showingFooterPrefix} {sorted.length} {T.showingFooterSuffix}
        </p>
      )}
    </div>
  );
}
