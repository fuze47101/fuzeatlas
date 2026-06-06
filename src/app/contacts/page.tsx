"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * /contacts — list view that the contact-detail breadcrumb has linked
 * at since day one. Used to 404 (BUG 4 — Barth 2026-06-05) because
 * there was no page.tsx. Now a real searchable list with
 * brand/factory/company filter via ?brandId=…, ?factoryId=…,
 * ?distributorId=… so the contact-detail back link can return Barth
 * to the originating company's contact list.
 */
type Contact = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  emailStatus: string | null;
  outreachStatus: string | null;
  outreachCount: number | null;
  lastContactedAt: string | null;
  brandId: string | null;
  factoryId: string | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  isPrimary?: boolean | null;
  // FEATURE 6 (Barth 2026-06-05) — last activity inline.
  notes?: Array<{ id: string; content: string; noteType: string | null; createdAt: string }>;
};

function ContactsListPage() {
  const search = useSearchParams();
  const brandId = search?.get("brandId") || "";
  const factoryId = search?.get("factoryId") || "";
  const distributorId = search?.get("distributorId") || "";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [parentLabel, setParentLabel] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (brandId) params.set("brandId", brandId);
    if (factoryId) params.set("factoryId", factoryId);
    if (distributorId) params.set("distributorId", distributorId);
    setLoading(true);
    fetch(`/api/contacts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setContacts(d.contacts || []);
          setParentLabel(d.parentLabel || null);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [brandId, factoryId, distributorId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return contacts;
    const needle = q.trim().toLowerCase();
    return contacts.filter((c) => {
      const hay = [
        c.name, c.firstName, c.lastName, c.email, c.title, c.jobTitle,
        c.brand?.name, c.factory?.name,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [contacts, q]);

  // Sort: isPrimary first, then most recently contacted, then a-z.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if ((a.isPrimary || false) !== (b.isPrimary || false)) {
        return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
      }
      const ax = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : 0;
      const bx = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : 0;
      if (ax !== bx) return bx - ax;
      const an = (a.name || a.email || "").toLowerCase();
      const bn = (b.name || b.email || "").toLowerCase();
      return an.localeCompare(bn);
    });
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
          <p className="mt-1 text-sm text-slate-600">
            {parentLabel ? <>Filtered to <strong>{parentLabel}</strong>.</> : "Every contact across every brand, factory, and distributor."}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, title, company…"
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md w-[320px]"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-1.5 text-left w-[28px]"></th>
              <th className="px-3 py-1.5 text-left">Name</th>
              <th className="px-3 py-1.5 text-left">Title</th>
              <th className="px-3 py-1.5 text-left">Company</th>
              <th className="px-3 py-1.5 text-left">Email</th>
              <th className="px-3 py-1.5 text-center">Outreach</th>
              <th className="px-3 py-1.5 text-right">Last contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((c) => {
              const display = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "(unnamed)";
              const parentName = c.brand?.name || c.factory?.name || "—";
              const parentHref = c.brand ? `/brands/${c.brand.id}` : c.factory ? `/factories/${c.factory.id}` : null;
              const bad = c.emailStatus === "invalid" || c.emailStatus === "bounced";
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 text-center">
                    {c.isPrimary ? <span title="Primary contact for this company">⭐</span> : null}
                  </td>
                  <td className="px-3 py-1.5">
                    <Link href={`/contacts/${c.id}`} className="text-indigo-700 font-medium hover:underline">
                      {display}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 text-xs">{c.title || c.jobTitle || "—"}</td>
                  <td className="px-3 py-1.5">
                    {parentHref ? (
                      <Link href={parentHref} className="text-slate-700 hover:underline text-xs">{parentName}</Link>
                    ) : <span className="text-slate-400 text-xs">{parentName}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {c.email ? (
                      <span className={bad ? "line-through text-rose-600" : "text-slate-700"} title={c.emailStatus || ""}>
                        {c.email}
                        {bad && <span className="ml-1 inline-flex rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">{c.emailStatus?.toUpperCase()}</span>}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-center text-[10px] text-slate-600">
                    {c.outreachStatus || "not_contacted"} · {c.outreachCount || 0}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-slate-500 whitespace-nowrap">
                    {c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleDateString() : "—"}
                    {c.notes?.[0] && (
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[260px] text-right" title={c.notes[0].content}>
                        {c.notes[0].noteType ? `${c.notes[0].noteType.toLowerCase()}: ` : ""}
                        {String(c.notes[0].content || "").slice(0, 60)}
                        {String(c.notes[0].content || "").length > 60 ? "…" : ""}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  No contacts {parentLabel ? `for ${parentLabel}` : "match"}.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ContactsListPageOuter() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">Loading contacts…</div>}>
      <ContactsListPage />
    </Suspense>
  );
}
