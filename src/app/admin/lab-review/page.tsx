"use client";

/**
 * /admin/lab-review — Phase 10J Monday-night review queue.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

interface Item {
  kind: "AI_REVIEW" | "REJECTION";
  id: string;
  at: string;
  title: string;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  lab: { id: string; name: string } | null;
  flags?: any;
  reason?: string | null;
  action: string;
  notes?: string | null;
  link: string;
}

const ACTION_COLOR: Record<string, string> = {
  RETEST: "bg-red-100 text-red-800 border-red-200",
  REJECT: "bg-red-100 text-red-800 border-red-200",
  REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW_REJECTION: "bg-violet-100 text-violet-800 border-violet-200",
};

export default function LabReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/lab-review")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setItems(j.items);
        else setError(j.error);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-700">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[
          { label: "Quality & Labs" },
          { label: "Lab review queue" },
        ]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">
        Monday review queue
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        AI-flagged test runs + brand rejections from the last 7 days. Walk
        through the queue at Monday's meeting; each item links to the
        underlying detail page where you can schedule retest / approve /
        notify factory + brand.
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-lg font-bold text-emerald-900">✓ Inbox zero</p>
          <p className="text-sm text-emerald-800 mt-1">
            No flagged test runs or rejections this week.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${ACTION_COLOR[it.action] || "bg-slate-100 text-slate-700"}`}
                    >
                      {it.action.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(it.at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900">{it.title}</h3>
                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3">
                    {it.brand && (
                      <span>
                        Brand:{" "}
                        <Link
                          href={`/brands/${it.brand.id}`}
                          className="text-[#00b4c3] hover:underline"
                        >
                          {it.brand.name}
                        </Link>
                      </span>
                    )}
                    {it.factory && <span>Factory: {it.factory.name}</span>}
                    {it.lab && <span>Lab: {it.lab.name}</span>}
                  </div>
                  {Array.isArray(it.flags) && it.flags.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {it.flags.slice(0, 5).map((f: any, i: number) => (
                        <li
                          key={i}
                          className={`text-xs ${
                            f.severity === "error"
                              ? "text-red-700"
                              : f.severity === "warn"
                                ? "text-amber-700"
                                : "text-slate-600"
                          }`}
                        >
                          <span className="font-bold uppercase mr-1">{f.severity}</span>
                          {f.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.reason && (
                    <p className="text-xs text-red-700 mt-2 italic">
                      Rejection: {it.reason}
                    </p>
                  )}
                  {it.notes && (
                    <p className="text-xs text-slate-600 mt-2 italic">{it.notes}</p>
                  )}
                </div>
                <Link
                  href={it.link}
                  className="shrink-0 px-3 py-1.5 rounded bg-[#00b4c3] text-white text-xs font-bold hover:bg-[#009aa8]"
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
