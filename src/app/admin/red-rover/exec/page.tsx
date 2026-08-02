"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";
import { KpiStrip, type RedRoverKpis } from "@/components/RedRoverKpiStrip";
import { MarkdownBrief } from "@/components/RedRoverBrief";
import { STAGE_COLORS, TIER_COLORS } from "@/lib/red-rover-ui";

interface ExecTarget {
  id: string;
  rank: number | null;
  tier: string;
  stage: string;
  name: string;
  geo: string | null;
  companyClass: string | null;
  tripLeg: string;
  ownerName: string | null;
  nextStep: string | null;
  currentStatus: string | null;
  currentAgreements: string | null;
  primaryContact: { name: string; title: string | null } | null;
  attachments: { id: string; filename: string | null; url: string | null }[];
}
interface ExecResp {
  ok: boolean;
  brief: { name: string; goalMd: string | null };
  kpis: RedRoverKpis;
  targets: ExecTarget[];
}

export default function RedRoverExecOuter() {
  return (
    <HydrationFrame name="/admin/red-rover/exec">
      <RedRoverExec />
    </HydrationFrame>
  );
}

function RedRoverExec() {
  useMountLog("red-rover-exec");
  const { user, loading } = useAuth();
  const [data, setData] = useState<ExecResp | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [briefOpen, setBriefOpen] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStatus("forbidden");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/admin/red-rover/exec", { cache: "no-store" });
        if (res.status === 403 || res.status === 401) {
          setStatus("forbidden");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setData(await res.json());
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    })();
  }, [loading, user]);

  if (loading || status === "loading") {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Loading exec view…</div>;
  }
  if (status === "forbidden") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Red Rover — Executive View</h1>
        <p className="mt-2 text-sm text-slate-500">
          You don't have access to this view. Ask an admin to enable Red Rover access on your account.
        </p>
      </div>
    );
  }
  if (status === "error" || !data) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-rose-600">Failed to load the exec view.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚀 Red Rover — Executive View</h1>
          <p className="text-sm text-slate-500">Read-only rollup of the industry-negotiation book.</p>
        </div>
        <Link href="/admin/red-rover" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          ← Dashboard
        </Link>
      </div>

      {/* KPI strip */}
      <KpiStrip kpis={data.kpis} />

      {/* Engagement Brief */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-white">
        <button onClick={() => setBriefOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-semibold text-slate-800">📋 Engagement Brief — {data.brief.name}</span>
          <span className="text-slate-400">{briefOpen ? "▲" : "▼"}</span>
        </button>
        {briefOpen && (
          <div className="border-t border-slate-100 px-5 py-4">
            {data.brief.goalMd ? <MarkdownBrief md={data.brief.goalMd} /> : <p className="text-sm text-slate-500">No brief text.</p>}
          </div>
        )}
      </div>

      {/* Ranked table (read-only) */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Key contact</th>
              <th className="px-3 py-2">Next step</th>
              <th className="px-3 py-2">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.targets.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${TIER_COLORS[t.tier] || "bg-slate-300"}`}>{t.rank ?? "—"}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500">
                    {t.companyClass}
                    {t.companyClass && t.geo ? " · " : ""}
                    {t.geo}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[t.stage] || "bg-slate-100"}`}>{t.stage}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">{t.ownerName || "—"}</td>
                <td className="px-3 py-2">
                  {t.primaryContact ? (
                    <div>
                      <div className="text-slate-800">{t.primaryContact.name}</div>
                      {t.primaryContact.title && <div className="text-xs text-slate-500">{t.primaryContact.title}</div>}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  <div className="max-w-xs">{t.nextStep || "—"}</div>
                </td>
                <td className="px-3 py-2">
                  {t.attachments.length === 0 ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {t.attachments.map((a) => (
                        <a key={a.id} href={a.url || "#"} target="_blank" rel="noopener noreferrer" className="block text-xs text-rose-700 hover:underline">
                          📎 {a.filename || "file"}
                        </a>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
