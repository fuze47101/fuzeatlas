// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

/**
 * /admin/i18n/review — native-speaker review routing (T13 phase 16).
 *
 * Lists all 17 locales with reviewer assignment + last-reviewed
 * timestamp. Tina covers zh-CN/zh-TW/ja/ko today; the other 13
 * need reviewers identified by region. Pure tracking surface —
 * does not gate deploys.
 */
interface LocaleRow {
  locale: string;
  label: string;
  flag: string;
  reviewerId: string | null;
  reviewerEmail: string | null;
  reviewerName: string | null;
  lastTranslatedAt: string | null;
  lastReviewedAt: string | null;
  notes: string | null;
  coverage?: number;
  missingKeys?: number;
  emptyKeys?: number;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LocaleReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<LocaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [translatingLocale, setTranslatingLocale] = useState<string | null>(null);
  const [translateBanner, setTranslateBanner] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
      router.push("/home");
      return;
    }
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/i18n/review");
      const d = await r.json();
      if (d.ok) setRows(d.locales || []);
      else setError(d.error || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function save(locale: string, extra: any = {}) {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/i18n/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          reviewerEmail: emailDraft || null,
          notes: notesDraft || null,
          ...extra,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Save failed");
        return;
      }
      setEditing(null);
      setEmailDraft("");
      setNotesDraft("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function runAutoTranslate(locale: string) {
    // The /api/cron/translate-missing-keys endpoint was retired — Vercel
    // serverless can't write files or push git, so the workflow runs on
    // Andrew's Mac via `npx tsx scripts/translate-i18n.ts`. The button
    // surfaces the local CLI command instead of firing the dead route.
    setTranslatingLocale(locale);
    setTranslateBanner(
      `${locale}: run on Andrew's Mac to translate locally:\n` +
        `npx tsx scripts/translate-i18n.ts --locales ${locale}\n\n` +
        `Dry-run first to see scope + estimated cost:\n` +
        `npx tsx scripts/translate-i18n.ts --dry-run --locales ${locale}`,
    );
    setTranslatingLocale(null);
  }

  function startEdit(row: LocaleRow) {
    setEditing(row.locale);
    setEmailDraft(row.reviewerEmail || "");
    setNotesDraft(row.notes || "");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Admin · i18n</p>
        <h1 className="text-3xl font-black text-slate-900">Locale Review Status</h1>
        <p className="text-slate-600 max-w-2xl mt-1 text-sm">
          Track who reviews each locale&apos;s translations. Claude generates
          the initial bundle; native speakers should sweep before high-stakes
          customer-facing launches. Tracking only — no deploy gate.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          {error}
        </div>
      )}

      {translateBanner && (
        <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg text-violet-900 text-xs whitespace-pre-wrap font-mono">
          {translateBanner}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Locale</th>
              <th className="px-4 py-3 text-right">Coverage</th>
              <th className="px-4 py-3 text-left">Reviewer</th>
              <th className="px-4 py-3 text-left">Last translated</th>
              <th className="px-4 py-3 text-left">Last reviewed</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isEdit = editing === row.locale;
              return (
                <tr key={row.locale} className="align-top">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <span className="mr-2">{row.flag}</span>
                    {row.label}
                    <div className="text-[10px] text-slate-400 font-mono uppercase">{row.locale}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    {row.coverage !== undefined ? (
                      <div>
                        <div
                          className={`font-bold ${
                            row.coverage >= 0.99
                              ? "text-emerald-700"
                              : row.coverage >= 0.95
                                ? "text-slate-700"
                                : "text-amber-700"
                          }`}
                        >
                          {(row.coverage * 100).toFixed(1)}%
                        </div>
                        {((row.missingKeys || 0) + (row.emptyKeys || 0)) > 0 && (
                          <div className="text-[10px] text-slate-500">
                            {row.missingKeys || 0} miss · {row.emptyKeys || 0} empty
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {isEdit ? (
                      <input
                        type="email"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        placeholder="reviewer@example.com"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    ) : row.reviewerEmail ? (
                      <div>
                        <div className="font-semibold">{row.reviewerName || row.reviewerEmail}</div>
                        {row.reviewerName && (
                          <div className="text-[11px] text-slate-500 truncate">{row.reviewerEmail}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-amber-600 text-xs font-semibold">No reviewer</span>
                    )}
                    {isEdit && (
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Notes (region, dialect, sign-off scope)"
                        rows={2}
                        className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-xs resize-none"
                      />
                    )}
                    {!isEdit && row.notes && (
                      <div className="text-[11px] text-slate-500 italic mt-1">{row.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(row.lastTranslatedAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(row.lastReviewedAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isEdit ? (
                      <div className="flex flex-col gap-1 items-end">
                        <button
                          onClick={() => save(row.locale)}
                          disabled={saving}
                          className="text-xs px-3 py-1 bg-[#00b4c3] text-white rounded font-bold disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => save(row.locale, { markReviewed: true })}
                          disabled={saving}
                          className="text-xs px-3 py-1 bg-emerald-600 text-white rounded font-bold disabled:opacity-50"
                          title="Stamp lastReviewedAt = now"
                        >
                          Save + mark reviewed
                        </button>
                        <button
                          onClick={() => {
                            setEditing(null);
                            setEmailDraft("");
                            setNotesDraft("");
                          }}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => startEdit(row)}
                          className="text-xs text-[#00b4c3] hover:underline font-semibold"
                        >
                          Assign / Mark reviewed
                        </button>
                        {row.locale !== "en" &&
                          ((row.missingKeys || 0) + (row.emptyKeys || 0)) > 0 && (
                            <button
                              onClick={() => runAutoTranslate(row.locale)}
                              disabled={translatingLocale === row.locale}
                              className="text-[11px] text-violet-700 hover:underline font-semibold disabled:opacity-50"
                              title="Dry-run the auto-translator and surface the fzcron command"
                            >
                              {translatingLocale === row.locale ? "Checking…" : "Run auto-translate"}
                            </button>
                          )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
