"use client";

/**
 * /admin/press-kit — Phase 12E admin manager.
 */
import { useEffect, useState } from "react";

interface Item {
  id: string;
  type: "LOGO" | "IMAGE" | "RELEASE" | "NEWS_LINK";
  url: string;
  caption: string | null;
  releaseDate: string | null;
  active: boolean;
  createdAt: string;
}

const TYPES = ["", "LOGO", "IMAGE", "RELEASE", "NEWS_LINK"];

export default function PressKitAdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({ type: "LOGO", url: "", caption: "", releaseDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/press-kit-items");
    const j = await res.json();
    if (j.ok) setItems(j.items);
    else setError(j.error);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!draft.url.trim()) {
      setError("URL required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/press-kit-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error || "Add failed");
      else {
        setDraft({ type: "LOGO", url: "", caption: "", releaseDate: "" });
        setError(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Item) {
    await fetch("/api/admin/press-kit-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    load();
  }

  async function remove(item: Item) {
    if (!confirm(`Delete press kit item "${item.caption || item.url}"?`)) return;
    await fetch(`/api/admin/press-kit-items?id=${item.id}`, { method: "DELETE" });
    load();
  }

  const filtered = filter ? items.filter((i) => i.type === filter) : items;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Press kit</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage what appears on the public /press page. Toggling active hides
          a row without deleting it.
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Add item</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          >
            <option value="LOGO">LOGO</option>
            <option value="IMAGE">IMAGE</option>
            <option value="RELEASE">RELEASE</option>
            <option value="NEWS_LINK">NEWS_LINK</option>
          </select>
          <input
            type="url"
            placeholder="URL"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="caption"
            value={draft.caption}
            onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <input
            type="date"
            value={draft.releaseDate}
            onChange={(e) => setDraft({ ...draft, releaseDate: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
        </div>
        <button
          onClick={add}
          disabled={saving}
          className="mt-3 px-4 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add item"}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {TYPES.map((t) => (
          <button
            key={t || "all"}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              filter === t
                ? "bg-[#00b4c3] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t || "all"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
            <tr>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-3 py-2">Caption</th>
              <th className="text-left px-3 py-2">URL</th>
              <th className="text-left px-3 py-2">Released</th>
              <th className="text-center px-3 py-2">Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 font-bold text-slate-900">{i.type}</td>
                <td className="px-3 py-2 text-slate-700">{i.caption || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00b4c3] hover:underline truncate inline-block max-w-[280px]"
                  >
                    {i.url}
                  </a>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {i.releaseDate ? new Date(i.releaseDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => toggleActive(i)}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      i.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {i.active ? "Active" : "Hidden"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(i)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  No press kit items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
