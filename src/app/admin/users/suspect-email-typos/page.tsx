"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Suspect {
  contactId: string;
  contactEmail: string;
  contactName: string | null;
  source: "brand" | "factory" | "distributor" | "orphan";
  sourceName: string | null;
  distance: number;
}
interface SuspectRow {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    emailVerified: boolean;
  };
  suspects: Suspect[];
}

export default function SuspectEmailTyposPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useI18n();
  const [rows, setRows] = useState<SuspectRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/suspect-email-typos");
      const d = await r.json();
      if (!d.ok) {
        setErr(d.error || "Load failed");
      } else {
        setRows(d.results || []);
      }
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const action = async (body: Record<string, any>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/suspect-email-typos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) setErr(d.error || "Action failed");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Action failed");
    } finally {
      setBusy(false);
      setEditingUserId(null);
      setDraftEmail("");
    }
  };

  const title = (t as any)?.admin?.suspectEmailTypos?.title || "Suspect email typos";
  const subtitle =
    (t as any)?.admin?.suspectEmailTypos?.subtitle ||
    "User accounts whose email is within Levenshtein distance 2 of a known Brand or Factory contact.";
  const emptyMsg =
    (t as any)?.admin?.suspectEmailTypos?.empty ||
    "No suspect typo emails detected. ✅";
  const labels = {
    user: (t as any)?.admin?.suspectEmailTypos?.user || "User",
    possibleMatch: (t as any)?.admin?.suspectEmailTypos?.possibleMatch || "Possible match",
    distance: (t as any)?.admin?.suspectEmailTypos?.distance || "Distance",
    actions: (t as any)?.admin?.suspectEmailTypos?.actions || "Actions",
    fixEmail: (t as any)?.admin?.suspectEmailTypos?.fixEmail || "Fix email",
    ignore: (t as any)?.admin?.suspectEmailTypos?.ignore || "Ignore",
    confirmMatch: (t as any)?.admin?.suspectEmailTypos?.confirmMatch || "Confirm match",
    save: (t as any)?.admin?.suspectEmailTypos?.save || "Save",
    cancel: (t as any)?.admin?.suspectEmailTypos?.cancel || "Cancel",
    refresh: (t as any)?.admin?.suspectEmailTypos?.refresh || "Refresh",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {labels.refresh}
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      {rows.length === 0 && !busy && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {emptyMsg}
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">{labels.user}</th>
                <th className="px-3 py-2 text-left">{labels.possibleMatch}</th>
                <th className="px-3 py-2 text-left">{labels.distance}</th>
                <th className="px-3 py-2 text-left">{labels.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) =>
                row.suspects.map((s, i) => (
                  <tr key={`${row.user.id}-${s.contactId}`} className="align-top">
                    {i === 0 ? (
                      <td className="px-3 py-2" rowSpan={row.suspects.length}>
                        <div className="font-medium text-slate-900">{row.user.name || "—"}</div>
                        <div className="text-xs text-slate-500">{row.user.email}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.user.role}</div>
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <div className="text-slate-900">{s.contactName || "—"}</div>
                      <div className="text-xs text-slate-600">{s.contactEmail}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {s.source}
                        {s.sourceName ? ` — ${s.sourceName}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {s.distance}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {editingUserId === row.user.id && i === 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={draftEmail}
                            onChange={(e) => setDraftEmail(e.target.value)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            placeholder="new email"
                          />
                          <button
                            onClick={() =>
                              action({ action: "fix-email", userId: row.user.id, newEmail: draftEmail })
                            }
                            disabled={busy || !draftEmail}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {labels.save}
                          </button>
                          <button
                            onClick={() => {
                              setEditingUserId(null);
                              setDraftEmail("");
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {labels.cancel}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {i === 0 && (
                            <button
                              onClick={() => {
                                setEditingUserId(row.user.id);
                                setDraftEmail(s.contactEmail);
                              }}
                              className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              {labels.fixEmail}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              action({
                                action: "confirm-match",
                                userId: row.user.id,
                                contactId: s.contactId,
                              })
                            }
                            disabled={busy}
                            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {labels.confirmMatch}
                          </button>
                          <button
                            onClick={() =>
                              action({
                                action: "ignore",
                                userId: row.user.id,
                                contactEmail: s.contactEmail,
                              })
                            }
                            disabled={busy}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {labels.ignore}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        <Link href="/settings/users" className="text-indigo-600 hover:underline">
          ← All users
        </Link>
      </p>
    </div>
  );
}
