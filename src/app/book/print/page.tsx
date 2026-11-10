"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookAccount, stageLabel } from "@/components/book/types";

/** Print-friendly book report. Opens from My Book → Print. No sidebar. */
export default function BookPrintPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const userId = params.get("userId") || "";
  const [accounts, setAccounts] = useState<BookAccount[] | null>(null);
  const [owner, setOwner] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/book${userId ? `?userId=${userId}` : ""}`);
      if (r.status === 401) {
        window.location.href = "/login?next=/book/print";
        return;
      }
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "Could not load the book");
        return;
      }
      setAccounts(d.accounts || []);
      const o = await fetch("/api/book?owners=1")
        .then((x) => x.json())
        .catch(() => ({ owners: [] }));
      setOwner((o.owners || []).find((u: any) => u.id === d.userId)?.name || "");
    })();
  }, [userId]);

  if (err) return <div className="p-8 text-sm text-rose-700">{err}</div>;
  if (!accounts) return <div className="p-8 text-sm text-slate-400">…</div>;

  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");
  const primary = accounts.filter((a) => a.isPrimary);
  const support = accounts.filter((a) => !a.isPrimary);

  const table = (list: BookAccount[]) => (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b-2 border-slate-800 text-left text-[9px] uppercase tracking-wide text-slate-500">
          <th className="py-1 pr-2">Account</th>
          <th className="py-1 pr-2">Stage</th>
          <th className="py-1 pr-2">Forecast</th>
          <th className="py-1 pr-2">Team</th>
          <th className="py-1 pr-2">Last touch</th>
          <th className="py-1 pr-2">Last note</th>
          <th className="py-1">Next step</th>
        </tr>
      </thead>
      <tbody>
        {list.map((a) => (
          <tr
            key={`${a.entityType}:${a.entityId}`}
            className="break-inside-avoid border-b border-slate-200 align-top"
          >
            <td className="py-1.5 pr-2">
              <div className="font-semibold text-slate-900">{a.name}</div>
              <div className="text-[9px] text-slate-500">
                {[
                  a.entityType === "FACTORY"
                    ? "Mill"
                    : a.entityType === "BRAND"
                      ? "Brand"
                      : "Distributor",
                  a.country,
                  a.primaryContact,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </td>
            <td className="py-1.5 pr-2">{stageLabel(a.stage)}</td>
            <td className="py-1.5 pr-2 whitespace-nowrap">{a.forecastQuarter}</td>
            <td className="py-1.5 pr-2">
              {a.team.map((t) => t.name.split(" ")[0] + (t.isPrimary ? "" : "*")).join(", ")}
            </td>
            <td className="py-1.5 pr-2 whitespace-nowrap">
              {d(a.lastRealTouchAt)}
              {a.silentWeeks >= 2 && a.silentWeeks < 99 ? (
                <div className="text-[9px] text-rose-700">{a.silentWeeks}w quiet</div>
              ) : null}
            </td>
            <td className="py-1.5 pr-2">{a.lastNote}</td>
            <td className="py-1.5">
              {a.nextStep}
              {a.nextStepAt ? (
                <div className="text-[9px] text-slate-500">{d(a.nextStepAt)}</div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-slate-900">
      <style>{`@media print { .no-print, .fixed { display: none !important; } @page { size: landscape; margin: 12mm; } body { background: #fff !important; } }`}</style>
      <div className="no-print mb-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          Print / Save as PDF
        </button>
        <a
          href={`/api/book/export${userId ? `?userId=${userId}` : ""}`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Download CSV
        </a>
        <a
          href={`/book${userId ? `?userId=${userId}` : ""}`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
        >
          Back
        </a>
      </div>
      <div className="mb-3 flex items-end justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            FUZE Atlas · My Book
          </div>
          <h1 className="text-xl font-bold">{owner || "Book"}</h1>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          {new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          <div>
            {primary.length} accounts · {primary.filter((a) => a.checkedInThisWeek).length} touched
            this week · {primary.filter((a) => a.attention === "red").length} cold
          </div>
        </div>
      </div>
      {table(primary)}
      {support.length > 0 && (
        <>
          <h2 className="mb-1 mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Supporting ({support.length})
          </h2>
          {table(support)}
        </>
      )}
      <div className="mt-3 text-[9px] text-slate-400">
        * support on the account · Confidential — internal
      </div>
    </div>
  );
}
