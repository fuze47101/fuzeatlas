"use client";

/**
 * /settings/notifications — Phase 5D.
 *
 * Per-user notification preferences. Checkboxes grouped by purpose.
 * Critical categories warn before toggling off so users can't
 * accidentally mute compliance signals.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

interface CategoryDef {
  key: string;
  label: string;
  desc: string;
  critical?: boolean;
}

const CRITICAL = new Set(["test_result_brand_visible", "icp_cadence_overdue", "approval_pending"]);

export default function NotificationPreferencesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.settings.notifications;

  const isAdmin = user?.role === "ADMIN" || user?.role === "EMPLOYEE";

  const groups: Array<{ title: string; categories: CategoryDef[] }> = [
    {
      title: tx.groupOps,
      categories: [
        { key: "fabric_submission_received", label: tx.catFabricSubmission, desc: tx.catFabricSubmissionDesc },
        { key: "recipe_graduated", label: tx.catRecipeGraduated, desc: tx.catRecipeGraduatedDesc },
        { key: "crm_activity", label: tx.catCrmActivity, desc: tx.catCrmActivityDesc },
      ],
    },
    {
      title: tx.groupTesting,
      categories: [
        { key: "test_request_status_change", label: tx.catTestRequest, desc: tx.catTestRequestDesc },
        {
          key: "test_result_brand_visible",
          label: tx.catTestResultBrandVisible,
          desc: tx.catTestResultBrandVisibleDesc,
          critical: true,
        },
        { key: "icp_validated", label: tx.catIcpValidated, desc: tx.catIcpValidatedDesc },
        {
          key: "icp_cadence_overdue",
          label: tx.catIcpOverdue,
          desc: tx.catIcpOverdueDesc,
          critical: true,
        },
      ],
    },
    {
      title: tx.groupOrders,
      categories: [
        { key: "order_placed", label: tx.catOrderPlaced, desc: tx.catOrderPlacedDesc },
        { key: "order_status_change", label: tx.catOrderStatus, desc: tx.catOrderStatusDesc },
        { key: "order_application_flag", label: tx.catOrderFlag, desc: tx.catOrderFlagDesc },
      ],
    },
    {
      title: tx.groupApprovals,
      categories: [
        {
          key: "approval_pending",
          label: tx.catApprovalPending,
          desc: tx.catApprovalPendingDesc,
          critical: true,
        },
        { key: "approval_overdue", label: tx.catApprovalOverdue, desc: tx.catApprovalOverdueDesc },
      ],
    },
    {
      title: tx.groupDigest,
      categories: [
        { key: "weekly_digest", label: tx.catWeeklyDigest, desc: tx.catWeeklyDigestDesc },
        { key: "monthly_digest", label: tx.catMonthlyDigest, desc: tx.catMonthlyDigestDesc },
      ],
    },
  ];

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPrefs(j.preferences || {});
      })
      .finally(() => setLoading(false));
  }, []);

  function isOn(key: string) {
    // Default-on: missing key counts as subscribed.
    return prefs[key] !== false;
  }

  async function toggle(key: string, critical: boolean) {
    const currentlyOn = isOn(key);
    const target = !currentlyOn;
    if (currentlyOn && critical) {
      if (!confirm(tx.criticalWarning)) return;
    }
    setSaving(true);
    setError(null);
    try {
      const j = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [key]: target } }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.saveFailed);
      setPrefs(j.preferences || {});
      setFlash(tx.saved);
      setTimeout(() => setFlash(null), 2000);
    } catch (e: any) {
      setError(e.message || tx.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {isAdmin ? (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          {tx.adminInfo}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {flash ? (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          {flash}
        </div>
      ) : null}

      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h2 className="font-bold text-slate-900 text-sm">{g.title}</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {g.categories.map((c) => {
                const on = isOn(c.key);
                return (
                  <li
                    key={c.key}
                    className="px-5 py-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {c.label}
                        {c.critical ? (
                          <span className="ml-2 text-[10px] font-bold uppercase text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                            critical
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
                    </div>
                    <label className="inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={saving}
                        onChange={() => toggle(c.key, !!c.critical)}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-[#00b4c3] peer-disabled:opacity-50">
                        <div
                          className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
                            on ? "translate-x-5" : ""
                          }`}
                        />
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
