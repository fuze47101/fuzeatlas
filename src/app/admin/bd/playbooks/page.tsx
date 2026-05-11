"use client";

/**
 * /admin/bd/playbooks — Phase 9H.
 *
 * BD playbook library. Each playbook is a category-tagged piece of
 * outreach guidance — markdown body + optional recommended sequence
 * + optional recommended email templates. Reps favorite the ones
 * they actually use (UserPlaybookFavorite).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface Playbook {
  id: string;
  name: string;
  textileCategory: string;
  description: string;
  recommendedSequenceId: string | null;
  recommendedEmailTemplateIds: string[];
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
}

const CATEGORIES = [
  "all",
  "hospitality",
  "activewear",
  "intimates",
  "kids",
  "workwear",
  "medical",
  "industrial",
  "other",
];

const CATEGORY_COLORS: Record<string, string> = {
  hospitality: "bg-amber-100 text-amber-800",
  activewear: "bg-emerald-100 text-emerald-800",
  intimates: "bg-rose-100 text-rose-800",
  kids: "bg-yellow-100 text-yellow-800",
  workwear: "bg-slate-100 text-slate-800",
  medical: "bg-blue-100 text-blue-800",
  industrial: "bg-zinc-100 text-zinc-800",
  other: "bg-purple-100 text-purple-800",
};

export default function PlaybooksPage() {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const isEditor =
    user?.role === "ADMIN" ||
    user?.role === "EMPLOYEE" ||
    user?.role === "SALES_MANAGER";

  async function load() {
    try {
      const res = await fetch("/api/admin/bd/playbooks");
      const j = await res.json();
      if (j.ok) setPlaybooks(j.playbooks);
      else setError(j.error || "Failed");
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleFavorite(p: Playbook) {
    const method = p.isFavorite ? "DELETE" : "POST";
    await fetch(`/api/admin/bd/playbooks/${p.id}/favorite`, { method });
    load();
  }

  const filtered = playbooks.filter(
    (p) => filter === "all" || p.textileCategory === filter,
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
            <Link href="/admin/bd" className="hover:text-[#00b4c3]">BD</Link>
            <span>·</span>
            <span className="text-slate-800 font-medium">Playbooks</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">BD playbooks</h1>
          <p className="text-sm text-slate-600 mt-1">
            Category-tagged outreach guidance. Favorite the ones you use; brands
            show a suggested playbook based on Brand.textileCategory.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
              filter === c
                ? "bg-[#00b4c3] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">
          No playbooks yet for this category.
          {isEditor && (
            <p className="text-xs mt-2">
              Trigger <code className="font-mono bg-slate-100 px-1 rounded">/api/cron/seed-playbooks</code> via fzcron to drop in the three starter playbooks.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${CATEGORY_COLORS[p.textileCategory] || "bg-slate-100 text-slate-800"}`}
                    >
                      {p.textileCategory}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900">{p.name}</h3>
                </div>
                <button
                  onClick={() => toggleFavorite(p)}
                  title={p.isFavorite ? "Remove favorite" : "Add favorite"}
                  className="text-2xl leading-none"
                >
                  {p.isFavorite ? "★" : "☆"}
                </button>
              </div>
              <p className="text-sm text-slate-700 mt-3 whitespace-pre-line">
                {p.description.slice(0, 320)}
                {p.description.length > 320 && "…"}
              </p>
              {p.notes && (
                <p className="text-xs text-slate-600 mt-3 italic">{p.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
