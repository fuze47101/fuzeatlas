"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { BookAccount } from "./types";

/**
 * "+ Add account" — search every brand, mill and distributor in Atlas and put
 * one in a book, as owner (asked every Friday) or support (on the account,
 * not asked). If it is not in Atlas yet, create it here.
 */
export default function AddAccount({
  forUserId,
  book,
  onClose,
  onChanged,
}: {
  forUserId: string;
  book: BookAccount[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const b = (t as any).book || {};
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [country, setCountry] = useState("");
  const [added, setAdded] = useState<string[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const h = setTimeout(() => {
      fetch(`/api/book/assign?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results || []))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  async function post(payload: any, key: string) {
    setBusy(key);
    setErr("");
    try {
      const r = await fetch("/api/book/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: forUserId, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setAdded((a) => [...a, `${d.entityType}:${d.entityId}`]);
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  const inBook = (r: any) =>
    book.some((a) => a.entityType === r.entityType && a.entityId === r.entityId) ||
    added.includes(`${r.entityType}:${r.entityId}`);
  const exact = results.some((r) => r.name.trim().toLowerCase() === q.trim().toLowerCase());

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-3 pt-10"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{b.addAccount || "Add an account"}</h2>
          <button
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {b.addHint ||
            "Owner: it is yours and you are asked about it every Friday. Support: you are on the account but not asked."}
        </p>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={b.addSearchPh || "Search a brand, mill or distributor"}
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
        />
        {err && <div className="mt-2 text-xs text-rose-700">{err}</div>}

        <div className="mt-2 divide-y divide-slate-100">
          {searching && <div className="py-3 text-sm text-slate-400">…</div>}
          {results.map((r) => {
            const key = `${r.entityType}:${r.entityId}`;
            return (
              <div key={key} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{r.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {r.entityType === "FACTORY"
                      ? "Mill"
                      : r.entityType === "BRAND"
                        ? "Brand"
                        : "Distributor"}
                    {r.meta ? ` · ${String(r.meta).replace(/_/g, " ").toLowerCase()}` : ""}
                  </div>
                </div>
                {inBook(r) ? (
                  <span className="shrink-0 text-xs text-emerald-600">
                    ✓ {b.inBook || "in book"}
                  </span>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <button
                      disabled={!!busy}
                      onClick={() => post({ entityType: r.entityType, entityId: r.entityId }, key)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {b.asOwner || "Owner"}
                    </button>
                    <button
                      disabled={!!busy}
                      onClick={() =>
                        post({ entityType: r.entityType, entityId: r.entityId, support: true }, key)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      {b.asSupport || "Support"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {q.trim().length >= 2 && !searching && !exact && (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-700">
              {b.notInAtlas || "Not in Atlas yet?"} “{q.trim()}”
            </div>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={b.countryPh || "Country (optional)"}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                disabled={!!busy}
                onClick={() =>
                  post({ create: { type: "BRAND", name: q.trim(), country } }, "new-b")
                }
                className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                + {b.createBrand || "Create as brand"}
              </button>
              <button
                disabled={!!busy}
                onClick={() =>
                  post({ create: { type: "FACTORY", name: q.trim(), country } }, "new-f")
                }
                className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                + {b.createMill || "Create as mill"}
              </button>
            </div>
          </div>
        )}
        {added.length > 0 && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
            ✓ {added.length} {b.addedN || "added"}
          </div>
        )}
      </div>
    </div>
  );
}
