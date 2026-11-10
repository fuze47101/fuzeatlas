"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookAccount, stageLabel } from "@/components/book/types";

/**
 * Print-friendly reports. No sidebar.
 *   /book/print            → my book
 *   /book/print?userId=X   → one person's book
 *   /book/print?all=1      → master list: every owner, then the unassigned accounts
 */
export default function BookPrintPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

type Unassigned = {
  entityType: string;
  entityId: string;
  name: string;
  country: string | null;
  stage: string | null;
  team: string[];
  former: string | null;
  lastActivityAt: string | null;
};
type Master = {
  owners: { id: string; name: string; accounts: BookAccount[] }[];
  unassigned: { accounts: Unassigned[]; hiddenLeads: number; hiddenMills: number };
};

const d = (iso: string | Date | null) => (iso ? new Date(iso).toLocaleDateString() : "");
const typeLabel = (t: string) =>
  t === "FACTORY" ? "Mill" : t === "BRAND" ? "Brand" : "Distributor";
const PRINT_CSS = `@media print { .no-print, .fixed { display: none !important; } @page { size: landscape; margin: 12mm; } body { background: #fff !important; } .page-break { break-before: page; } }`;

function BookTable({ list }: { list: BookAccount[] }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b-2 border-slate-800 text-left text-[9px] uppercase tracking-wide text-slate-500">
          <th className="w-[20%] py-1 pr-2">Account</th>
          <th className="w-[10%] py-1 pr-2">Stage</th>
          <th className="w-[7%] py-1 pr-2">Forecast</th>
          <th className="w-[10%] py-1 pr-2">Team</th>
          <th className="w-[8%] py-1 pr-2">Last touch</th>
          <th className="py-1 pr-2">Last note</th>
          <th className="w-[18%] py-1">Next step</th>
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
                {[typeLabel(a.entityType), a.country, a.primaryContact].filter(Boolean).join(" · ")}
              </div>
            </td>
            <td className="py-1.5 pr-2">{stageLabel(a.stage)}</td>
            <td className="whitespace-nowrap py-1.5 pr-2">{a.forecastQuarter}</td>
            <td className="py-1.5 pr-2">
              {a.team.map((t) => t.name.split(" ")[0] + (t.isPrimary ? "" : "*")).join(", ")}
            </td>
            <td className="whitespace-nowrap py-1.5 pr-2">
              {d(a.lastRealTouchAt as any)}
              {a.silentWeeks >= 2 && a.silentWeeks < 99 ? (
                <div className="text-[9px] text-rose-700">{a.silentWeeks}w quiet</div>
              ) : null}
              {a.silentWeeks >= 99 ? <div className="text-[9px] text-rose-700">never</div> : null}
            </td>
            <td className="py-1.5 pr-2">{a.lastNote}</td>
            <td className="py-1.5">
              {a.nextStep}
              {a.nextStepAt ? (
                <div className="text-[9px] text-slate-500">{d(a.nextStepAt as any)}</div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Toolbar({
  csv,
  back,
  children,
}: {
  csv: string;
  back: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
      >
        Print / Save as PDF
      </button>
      <a
        href={csv}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
      >
        Download CSV
      </a>
      <a
        href={back}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
      >
        Back
      </a>
      {children}
    </div>
  );
}

function Inner() {
  const params = useSearchParams();
  return params.get("all") ? <MasterReport /> : <OneBook userId={params.get("userId") || ""} />;
}

/* ── One person's book ─────────────────────────────────────────────── */
function OneBook({ userId }: { userId: string }) {
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
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Could not load the book");
        return;
      }
      setAccounts(j.accounts || []);
      const o = await fetch("/api/book?owners=1")
        .then((x) => x.json())
        .catch(() => ({ owners: [] }));
      setOwner((o.owners || []).find((u: any) => u.id === j.userId)?.name || "");
    })();
  }, [userId]);

  if (err) return <div className="p-8 text-sm text-rose-700">{err}</div>;
  if (!accounts) return <div className="p-8 text-sm text-slate-400">…</div>;

  const primary = accounts.filter((a) => a.isPrimary);
  const support = accounts.filter((a) => !a.isPrimary);

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-slate-900">
      <style>{PRINT_CSS}</style>
      <Toolbar
        csv={`/api/book/export${userId ? `?userId=${userId}` : ""}`}
        back={`/book${userId ? `?userId=${userId}` : ""}`}
      />
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
      <BookTable list={primary} />
      {support.length > 0 && (
        <>
          <h2 className="mb-1 mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Supporting ({support.length})
          </h2>
          <BookTable list={support} />
        </>
      )}
      <div className="mt-3 text-[9px] text-slate-400">
        * support on the account · Confidential — internal
      </div>
    </div>
  );
}

/* ── Master list: every owner, then unassigned ─────────────────────── */
function MasterReport() {
  const [data, setData] = useState<Master | null>(null);
  const [err, setErr] = useState("");
  const [pagePerPerson, setPagePerPerson] = useState(true);
  const [showUnassigned, setShowUnassigned] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/book/master");
      if (r.status === 401) {
        window.location.href = "/login?next=/book/print%3Fall%3D1";
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Could not load the master list");
        return;
      }
      setData(j);
    })();
  }, []);

  if (err) return <div className="p-8 text-sm text-rose-700">{err}</div>;
  if (!data) return <div className="p-8 text-sm text-slate-400">Building the master list…</div>;

  const un = data.unassigned;
  const total = data.owners.reduce((n, o) => n + o.accounts.length, 0);
  const groups: [string, Unassigned[]][] = [
    ["Brands", un.accounts.filter((a) => a.entityType === "BRAND")],
    ["Mills", un.accounts.filter((a) => a.entityType === "FACTORY")],
    ["Distributors", un.accounts.filter((a) => a.entityType === "DISTRIBUTOR")],
  ];

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-slate-900">
      <style>{PRINT_CSS}</style>
      <Toolbar csv="/api/book/export?all=1" back="/book/team">
        <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={pagePerPerson}
            onChange={(e) => setPagePerPerson(e.target.checked)}
          />
          New page for each person
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showUnassigned}
            onChange={(e) => setShowUnassigned(e.target.checked)}
          />
          Include unassigned
        </label>
      </Toolbar>

      <div className="mb-3 flex items-end justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">FUZE Atlas</div>
          <h1 className="text-xl font-bold">Master account list</h1>
        </div>
        <div className="text-right text-[11px] text-slate-600">
          {new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          <div>
            {total} assigned across {data.owners.length} people · {un.accounts.length} unassigned
          </div>
        </div>
      </div>

      {/* Summary */}
      <table className="mb-2 w-full max-w-xl border-collapse text-[11px]">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left text-[9px] uppercase tracking-wide text-slate-500">
            <th className="py-1 pr-2">Owner</th>
            <th className="py-1 pr-2 text-right">Accounts</th>
            <th className="py-1 pr-2 text-right">Touched this week</th>
            <th className="py-1 text-right">Cold (4+ weeks)</th>
          </tr>
        </thead>
        <tbody>
          {data.owners.map((o) => (
            <tr key={o.id} className="border-b border-slate-200">
              <td className="py-1 pr-2 font-semibold">{o.name}</td>
              <td className="py-1 pr-2 text-right">{o.accounts.length}</td>
              <td className="py-1 pr-2 text-right">
                {o.accounts.filter((a) => a.checkedInThisWeek).length}
              </td>
              <td className="py-1 text-right">
                {o.accounts.filter((a) => a.attention === "red").length}
              </td>
            </tr>
          ))}
          <tr className="border-b border-slate-200 text-rose-800">
            <td className="py-1 pr-2 font-semibold">Unassigned</td>
            <td className="py-1 pr-2 text-right">{un.accounts.length}</td>
            <td className="py-1 pr-2 text-right">—</td>
            <td className="py-1 text-right">—</td>
          </tr>
        </tbody>
      </table>

      {data.owners.map((o) => (
        <section key={o.id} className={pagePerPerson ? "page-break pt-1" : "pt-1"}>
          <h2 className="mb-1 mt-5 flex items-baseline justify-between border-b border-slate-400 pb-1">
            <span className="text-base font-bold">{o.name}</span>
            <span className="text-[10px] text-slate-500">
              {o.accounts.length} accounts · {o.accounts.filter((a) => a.checkedInThisWeek).length}{" "}
              touched this week · {o.accounts.filter((a) => a.attention === "red").length} cold
            </span>
          </h2>
          <BookTable list={[...o.accounts].sort((a, b) => a.name.localeCompare(b.name))} />
        </section>
      ))}

      {showUnassigned && (
        <section className="page-break pt-1">
          <h2 className="mb-1 mt-5 flex items-baseline justify-between border-b border-rose-400 pb-1">
            <span className="text-base font-bold text-rose-800">Unassigned</span>
            <span className="text-[10px] text-slate-500">
              {un.accounts.length} accounts with no owner
            </span>
          </h2>
          {groups.map(([label, list]) =>
            list.length ? (
              <div key={label}>
                <h3 className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {label} ({list.length})
                </h3>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-left text-[9px] uppercase tracking-wide text-slate-500">
                      <th className="w-[34%] py-1 pr-2">Account</th>
                      <th className="w-[14%] py-1 pr-2">Country</th>
                      <th className="w-[14%] py-1 pr-2">Stage</th>
                      <th className="w-[20%] py-1 pr-2">On it, not owner</th>
                      <th className="w-[10%] py-1 pr-2">Last activity</th>
                      <th className="py-1">Assign to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr
                        key={a.entityId}
                        className="break-inside-avoid border-b border-slate-200 align-top"
                      >
                        <td className="py-1 pr-2 font-semibold">{a.name}</td>
                        <td className="py-1 pr-2">{a.country}</td>
                        <td className="py-1 pr-2">{stageLabel(a.stage)}</td>
                        <td className="py-1 pr-2">
                          {[
                            ...a.team.map((t) => `${t.split(" ")[0]}*`),
                            ...(a.former ? [`${a.former} (left)`] : []),
                          ].join(", ")}
                        </td>
                        <td className="whitespace-nowrap py-1 pr-2">{d(a.lastActivityAt)}</td>
                        <td className="py-1" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
          <div className="mt-3 text-[10px] text-slate-500">
            Not listed: {un.hiddenLeads.toLocaleString()} lead-stage brands and{" "}
            {un.hiddenMills.toLocaleString()} mills with no test history.
          </div>
        </section>
      )}
      <div className="mt-3 text-[9px] text-slate-400">
        * support on the account · Confidential — internal
      </div>
    </div>
  );
}
