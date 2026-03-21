"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface SummaryData {
  brandsAdded: number;
  brandsUpdated: number;
  contactsAdded: number;
  contactsUpdated: number;
  testsCompleted: number;
  fabricsAdded: number;
  fabricsUpdated: number;
  submissionsNew: number;
  submissionsUpdated: number;
  sowsNew: number;
  sowsUpdated: number;
  notesAdded: number;
  factoriesAdded: number;
}

export default function WeeklyReportPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.

  const getWeekRange = (offset: number) => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
      label: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    };
  };

  const loadReport = (offset: number) => {
    setLoading(true);
    const { start, end } = getWeekRange(offset);
    fetch(`/api/reports/weekly?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(weekOffset); }, [weekOffset]);

  const range = getWeekRange(weekOffset);
  const s: SummaryData = data?.summary || {} as SummaryData;
  const totalActivity = Object.values(s).reduce((a: number, b: any) => a + (b || 0), 0);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Weekly Summary</h1>
          <p className="text-sm text-slate-500 mt-1">Activity report for team meetings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(weekOffset - 1)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            &larr; Prev
          </button>
          <button onClick={() => setWeekOffset(0)}
            className={`px-3 py-2 border rounded-lg text-sm ${weekOffset === 0 ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
            This Week
          </button>
          <button onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-30">
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Week Label */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 text-center">
        <p className="text-lg font-bold text-slate-900">{range.label}</p>
        {!loading && <p className="text-sm text-slate-500 mt-1">{totalActivity} total activities</p>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Brands Added", value: s.brandsAdded, icon: "🔥", color: "text-orange-600" },
              { label: "Brands Updated", value: s.brandsUpdated, icon: "✏️", color: "text-blue-600" },
              { label: "Tests Done", value: s.testsCompleted, icon: "🧪", color: "text-purple-600" },
              { label: "Fabrics Added", value: s.fabricsAdded, icon: "🧵", color: "text-emerald-600" },
              { label: "Contacts Added", value: s.contactsAdded, icon: "👤", color: "text-cyan-600" },
              { label: "Submissions", value: s.submissionsNew, icon: "📋", color: "text-amber-600" },
              { label: "SOWs", value: s.sowsNew, icon: "📄", color: "text-indigo-600" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                <div className="text-lg">{icon}</div>
                <div className={`text-xl font-black ${color}`}>{value || 0}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Test Results Breakdown */}
          {data.tests?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Testing Completed</h2>

              {/* Type breakdown badges */}
              {data.testBreakdown && Object.keys(data.testBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(data.testBreakdown).map(([type, stats]: [string, any]) => (
                    <div key={type} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-sm text-slate-900">{type}</span>
                      <span className="text-xs text-slate-500">{stats.total} total</span>
                      {stats.passed > 0 && <span className="text-xs text-green-600">{stats.passed} pass</span>}
                      {stats.failed > 0 && <span className="text-xs text-red-600">{stats.failed} fail</span>}
                    </div>
                  ))}
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Report #</th>
                    <th className="pb-2">Brand</th>
                    <th className="pb-2">Fabric</th>
                    <th className="pb-2">Lab</th>
                    <th className="pb-2">Result</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tests.map((tr: any) => {
                    const pass = tr.icpResult?.agValue > 50 || tr.abResult?.methodPass || tr.abResult?.pass || tr.fungalResult?.pass || tr.odorResult?.pass;
                    const fail = (tr.icpResult?.agValue !== undefined && tr.icpResult.agValue <= 50) || tr.abResult?.methodPass === false || tr.abResult?.pass === false || tr.fungalResult?.pass === false || tr.odorResult?.pass === false;
                    return (
                      <tr key={tr.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/tests/${tr.id}`}>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{tr.testType}</span>
                        </td>
                        <td className="py-2 font-medium text-slate-900">{tr.testReportNumber || "—"}</td>
                        <td className="py-2 text-slate-600">{tr.submission?.brand?.name || "—"}</td>
                        <td className="py-2 text-slate-600">{tr.submission?.fuzeFabricNumber ? `FUZE ${tr.submission.fuzeFabricNumber}` : "—"}</td>
                        <td className="py-2 text-slate-500">{tr.lab?.name || "—"}</td>
                        <td className="py-2">
                          {pass && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Pass</span>}
                          {fail && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Fail</span>}
                          {!pass && !fail && <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2 text-slate-500">{tr.testDate ? new Date(tr.testDate).toLocaleDateString() : new Date(tr.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Brands Activity */}
          {(data.brands?.added?.length > 0 || data.brands?.updated?.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Brand Activity</h2>
              {data.brands.added.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">New Brands ({data.brands.added.length})</h3>
                  <div className="space-y-1">
                    {data.brands.added.map((b: any) => (
                      <div key={b.id} className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                        <Link href={`/brands/${b.id}`} className="font-medium text-sm text-blue-600 hover:underline">{b.name}</Link>
                        <span className="text-xs text-slate-500">{b.pipelineStage}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.brands.updated.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Updated Brands ({data.brands.updated.length})</h3>
                  <div className="space-y-1">
                    {data.brands.updated.map((b: any) => (
                      <div key={b.id} className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                        <Link href={`/brands/${b.id}`} className="font-medium text-sm text-blue-600 hover:underline">{b.name}</Link>
                        <span className="text-xs text-slate-500">{b.pipelineStage}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contacts Activity */}
          {(data.contacts?.added?.length > 0 || data.contacts?.updated?.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Contact Changes</h2>
              {data.contacts.added.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">New Contacts ({data.contacts.added.length})</h3>
                  <div className="space-y-1">
                    {data.contacts.added.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                        <span className="font-medium text-sm text-slate-900">{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-slate-500">{c.brand?.name || c.factory?.name || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.contacts.updated.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Updated Contacts ({data.contacts.updated.length})</h3>
                  <div className="space-y-1">
                    {data.contacts.updated.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm text-slate-900">{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-slate-500">{c.brand?.name || c.factory?.name || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fabrics Activity */}
          {(data.fabrics?.added?.length > 0 || data.fabrics?.updated?.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Fabric Updates</h2>
              {data.fabrics.added.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">New Fabrics ({data.fabrics.added.length})</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {data.fabrics.added.map((f: any) => (
                        <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/fabrics/${f.id}`}>
                          <td className="py-2 font-bold text-blue-600">FUZE {f.fuzeNumber}</td>
                          <td className="py-2 text-slate-600">{f.construction || "—"}</td>
                          <td className="py-2 text-slate-500">{f.brand?.name || "—"}</td>
                          <td className="py-2 text-slate-500">{f.factory?.name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.fabrics.updated.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Updated Fabrics ({data.fabrics.updated.length})</h3>
                  <div className="space-y-1">
                    {data.fabrics.updated.map((f: any) => (
                      <div key={f.id} className="flex justify-between items-center p-2 bg-blue-50 rounded-lg cursor-pointer" onClick={() => window.location.href = `/fabrics/${f.id}`}>
                        <span className="font-medium text-sm text-blue-600">FUZE {f.fuzeNumber}</span>
                        <span className="text-xs text-slate-500">{f.brand?.name || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submissions & SOWs */}
          {(data.submissions?.new?.length > 0 || data.sows?.new?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.submissions?.new?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="font-bold text-slate-900 mb-3">New Submissions ({data.submissions.new.length})</h2>
                  <div className="space-y-2">
                    {data.submissions.new.map((sub: any) => (
                      <div key={sub.id} className="p-2 bg-slate-50 rounded-lg">
                        <div className="font-medium text-sm">FUZE {sub.fuzeFabricNumber}</div>
                        <div className="text-xs text-slate-500">{sub.brand?.name} · {sub.status || "—"} · {sub.testStatus || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.sows?.new?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="font-bold text-slate-900 mb-3">New SOWs ({data.sows.new.length})</h2>
                  <div className="space-y-2">
                    {data.sows.new.map((sow: any) => (
                      <div key={sow.id} className="p-2 bg-slate-50 rounded-lg cursor-pointer" onClick={() => window.location.href = `/sow/${sow.id}`}>
                        <div className="font-medium text-sm">{sow.title || "Untitled"}</div>
                        <div className="text-xs text-slate-500">{sow.brand?.name} · {sow.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes / Activity Log */}
          {data.notes?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Notes & Activity ({data.notes.length})</h2>
              <div className="space-y-2">
                {data.notes.map((n: any) => (
                  <div key={n.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        {n.brand && <Link href={`/brands/${n.brand.id}`} className="text-xs text-blue-600 font-medium hover:underline">{n.brand.name}</Link>}
                        {n.noteType && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{n.noteType}</span>}
                        {n.contactName && <span className="text-xs text-slate-500">with {n.contactName}</span>}
                      </div>
                      <span className="text-xs text-slate-400">{n.date ? new Date(n.date).toLocaleDateString() : ""}</span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {totalActivity === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-lg text-slate-400">No activity recorded for this week</p>
              <p className="text-sm text-slate-300 mt-1">Try selecting a different week</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
