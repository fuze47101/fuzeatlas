"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { BookAccount, TeamUser, stageLabel } from "@/components/book/types";

/**
 * Team board — who has checked in this week, super updates, help queue,
 * escalations, stage/forecast/order changes — and the assignment panel.
 */
export default function TeamBoardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const b = (t as any).book || {};
  const [data, setData] = useState<any>(null);
  const [weeks, setWeeks] = useState(1);
  const [assignFor, setAssignFor] = useState<string>("");
  const [assignBook, setAssignBook] = useState<BookAccount[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [owners, setOwners] = useState<TeamUser[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/book/team");
  }, [user, loading, router]);

  const load = useCallback(
    () =>
      fetch(`/api/book/team-board?weeks=${weeks}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => null),
    [weeks],
  );
  useEffect(() => {
    if (user) {
      load();
      fetch("/api/book?owners=1")
        .then((r) => r.json())
        .then((d) => setOwners(d.owners || []));
    }
  }, [user, load]);

  const loadAssign = useCallback((uid: string) => {
    if (!uid) return;
    fetch(`/api/book?userId=${uid}`)
      .then((r) => r.json())
      .then((d) => setAssignBook(d.accounts || []));
  }, []);
  useEffect(() => {
    loadAssign(assignFor);
  }, [assignFor, loadAssign]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(
      () =>
        fetch(`/api/book/assign?q=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then((d) => setResults(d.results || [])),
      250,
    );
    return () => clearTimeout(h);
  }, [q]);

  async function assign(entityType: string, entityId: string, remove = false) {
    await fetch("/api/book/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignFor, entityType, entityId, remove }),
    });
    loadAssign(assignFor);
    load();
  }
  async function helpAction(id: string, action: string) {
    await fetch(`/api/book/help/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-5xl px-3 pb-24 pt-3 sm:px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{b.teamBoardTitle || "Team board"}</h1>
          <div className="text-xs text-slate-500">
            {b.weekOf || "Week of"} {data ? new Date(data.weekOf).toLocaleDateString() : "…"}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1.5"
          >
            {[1, 2, 4, 8].map((w) => (
              <option key={w} value={w}>
                {w === 1 ? b.thisWeek || "This week" : `${w} ${b.weeks || "weeks"}`}
              </option>
            ))}
          </select>
          <Link
            href="/book/print?all=1"
            className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
          >
            🖨 {b.masterList || "Master list"}
          </Link>
          <a
            href="/api/book/export?all=1"
            className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
          >
            ⬇ {b.exportAll || "Export all books"}
          </a>
          <Link
            href="/book"
            className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
          >
            {b.title || "My Book"}
          </Link>
        </div>
      </div>

      {/* People */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">{b.person || "Person"}</th>
              <th className="px-3 py-2 text-right">{b.accounts || "Accounts"}</th>
              <th className="px-3 py-2 text-right">{b.touched || "Touched"}</th>
              <th className="px-3 py-2 text-right">{b.cold || "Cold"}</th>
              <th className="px-3 py-2 text-right">🙋</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.people
              ?.filter((p: any) => p.total > 0)
              .map((p: any) => (
                <tr key={p.user.id}>
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {p.user.name}
                    {p.user.distributorId && (
                      <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">
                        dist
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{p.total}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${p.touched === p.total ? "text-emerald-600" : p.touched === 0 ? "text-rose-600" : "text-amber-600"}`}
                  >
                    {p.touched}/{p.total}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {p.cold}
                    {p.amber ? <span className="text-slate-400"> +{p.amber}</span> : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{p.openHelp || ""}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/book?userId=${p.user.id}`}
                      className="text-xs text-sky-700 underline"
                    >
                      {b.openBook || "book"}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Super updates */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-600">
            ⭐ {b.superUpdates || "Super updates"}
          </h2>
          <div className="mt-2 space-y-2">
            {data?.supers?.length === 0 && (
              <div className="text-sm text-slate-400">{b.none || "None yet."}</div>
            )}
            {data?.supers?.map((s: any) => (
              <div
                key={s.id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
              >
                <div className="text-[10px] uppercase tracking-wide text-amber-700">
                  {s.entityName} · {s.user.name} · {new Date(s.createdAt).toLocaleDateString()}
                </div>
                <div className="font-semibold text-slate-900">{s.headline}</div>
                {s.note && <div className="mt-1 whitespace-pre-wrap text-slate-700">{s.note}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Help queue */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-rose-600">
            🙋 {b.helpQueue || "Help queue"}
          </h2>
          <div className="mt-2 space-y-2">
            {data?.help?.length === 0 && (
              <div className="text-sm text-slate-400">{b.none || "None open."}</div>
            )}
            {data?.help?.map((h: any) => (
              <div
                key={h.id}
                className={`rounded-xl border p-3 text-sm ${h.status === "ESCALATED" ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"}`}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {h.status === "ESCALATED" ? "🔺 " : ""}
                  {h.requester.name} → {h.assignee.name} · {h.entityName} ·{" "}
                  {new Date(h.dueAt) < new Date()
                    ? b.overdue || "overdue"
                    : `${b.due || "due"} ${new Date(h.dueAt).toLocaleDateString()}`}
                </div>
                <div className="text-slate-800">{h.ask}</div>
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    onClick={() => helpAction(h.id, "done")}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    {b.doneBtn || "Done"}
                  </button>
                  {h.status !== "ESCALATED" && (
                    <button
                      onClick={() => helpAction(h.id, "escalate")}
                      className="rounded border border-rose-300 bg-white px-2 py-1 text-rose-700"
                    >
                      {b.escalate || "Escalate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Changes */}
      <section className="mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
          {b.changes || "Stage, forecast and order changes"}
        </h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
          {data?.changes?.length === 0 && (
            <div className="p-3 text-slate-400">{b.none || "None."}</div>
          )}
          {data?.changes?.map((c: any) => (
            <div
              key={c.id}
              className="flex flex-wrap gap-x-3 border-b border-slate-100 px-3 py-2 last:border-0"
            >
              <span className="font-semibold text-slate-800">{c.entityName}</span>
              {c.stageAfter && (
                <span className="text-slate-600">
                  {stageLabel(c.stageBefore)} → <b>{stageLabel(c.stageAfter)}</b>
                </span>
              )}
              {c.forecastAfter && (
                <span className="text-slate-600">
                  {c.forecastBefore || "—"} → <b>{c.forecastAfter}</b>
                </span>
              )}
              {c.orderKg && (
                <span className="text-slate-600">
                  {c.orderKg} kg {c.orderProduct} ({c.orderMonth})
                </span>
              )}
              <span className="ml-auto text-xs text-slate-400">
                {c.user.name} · {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Assignment */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
          {b.assign || "Assign accounts"}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={assignFor}
            onChange={(e) => setAssignFor(e.target.value)}
            className="rounded border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">{b.pickPerson || "Pick a person"}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={!assignFor}
            placeholder={b.searchAdd || "Search a brand or mill to add"}
            className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>
        {results.length > 0 && (
          <div className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
            {results.map((r) => {
              const has = assignBook.some(
                (a) => a.entityType === r.entityType && a.entityId === r.entityId,
              );
              return (
                <div
                  key={`${r.entityType}:${r.entityId}`}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <span>
                    {r.name}{" "}
                    <span className="text-xs text-slate-400">
                      {r.entityType.toLowerCase()} · {r.meta || ""}
                    </span>
                  </span>
                  {has ? (
                    <span className="text-xs text-emerald-600">✓ in book</span>
                  ) : (
                    <button
                      onClick={() => assign(r.entityType, r.entityId)}
                      className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                    >
                      + {b.add || "Add"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {assignFor && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {assignBook.map((a) => (
              <span
                key={`${a.entityType}:${a.entityId}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                {a.name}
                <button
                  onClick={() => assign(a.entityType, a.entityId, true)}
                  className="text-slate-400 hover:text-rose-600"
                  title="Remove"
                >
                  ✕
                </button>
              </span>
            ))}
            {!assignBook.length && (
              <span className="text-xs text-slate-400">{b.emptyBook || "Empty book."}</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
