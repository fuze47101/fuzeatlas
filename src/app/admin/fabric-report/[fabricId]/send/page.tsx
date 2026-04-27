// @ts-nocheck
"use client";

/**
 * /admin/fabric-report/[fabricId]/send
 *
 * Internal-facing form for emailing the Full Application Report to a
 * customer. Linked from the print page header. Posts to
 * /api/admin/fabric-report/[fabricId]/send which creates a
 * FabricReportShare row and dispatches the email via Resend.
 *
 * Shows a recent-shares panel so the rep can see what's already been
 * sent (and whether it's been opened).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function SendReportPage() {
  const params = useParams();
  const router = useRouter();
  const fabricId = params.fabricId as string;

  const [fabric, setFabric] = useState<any>(null);
  const [recentShares, setRecentShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState<{ url: string; email: string } | null>(
    null,
  );

  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [cc, setCc] = useState("");
  const [ttlDays, setTtlDays] = useState(90);

  useEffect(() => {
    if (!fabricId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/fabric-report/${encodeURIComponent(fabricId)}`,
        );
        const json = await res.json();
        if (json.ok) {
          setFabric(json.fabric);
          setRecentShares(json.reportShares || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fabricId]);

  async function handleSend() {
    if (!recipientEmail) return setSendErr("Recipient email required.");
    setSending(true);
    setSendErr(null);
    try {
      const res = await fetch(
        `/api/admin/fabric-report/${encodeURIComponent(fabricId)}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail,
            recipientName: recipientName || undefined,
            personalNote: personalNote || undefined,
            cc: cc || undefined,
            ttlDays,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSendErr(json.error || "Send failed");
      } else {
        setSentOk({
          url: json.share.downloadUrl,
          email: json.share.recipientEmail,
        });
        // Refresh recent-shares list
        const refreshed = await fetch(
          `/api/admin/fabric-report/${encodeURIComponent(fabricId)}`,
        );
        const refreshedJson = await refreshed.json();
        if (refreshedJson.ok) setRecentShares(refreshedJson.reportShares || []);
      }
    } catch (e: any) {
      setSendErr(e.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!fabric) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-red-600">Fabric not found.</p>
      </div>
    );
  }

  const ref =
    fabric.customerReference ||
    fabric.customerCode ||
    `FUZE-${fabric.fuzeNumber}`;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/admin/fabric-report/${fabricId}/print`}
          className="text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          ← Back to Report
        </Link>
        <h1 className="text-2xl font-black text-slate-900 mt-2">
          Email Report to Customer
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Sending the FUZE Application & Validation Report for{" "}
          <strong>{ref}</strong>
          {fabric.brand?.name && <> · {fabric.brand.name}</>}.
        </p>
      </div>

      {sentOk && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm font-bold text-emerald-800 mb-1">
            ✓ Report sent to {sentOk.email}
          </p>
          <p className="text-xs text-emerald-700 break-all">
            Direct download URL:{" "}
            <a
              href={sentOk.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {sentOk.url}
            </a>
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            Customer can also access this under <em>My Reports</em> after
            signing in to FUZE Atlas.
          </p>
        </div>
      )}
      {sendErr && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-bold text-red-700">{sendErr}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Recipient email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="raihana@penfabric.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Recipient name <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Raihana Yaacob"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Personal note <span className="text-slate-400 font-normal">(optional, shown above the report card)</span>
          </label>
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            rows={3}
            placeholder="Hi Raihana — here's the validation report we discussed for Penfabric Test #2503. ICP came back at 0.94 ppm against the 1.0 target. Let me know if your QA team needs anything else."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CC <span className="text-slate-400 font-normal">(optional, comma-separated)</span>
            </label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="andrew@fuze47.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Direct link valid for
            </label>
            <select
              value={ttlDays}
              onChange={(e) => setTtlDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days (default)</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !recipientEmail}
          className="px-6 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009ba8] disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Report"}
        </button>
      </div>

      {/* Recent shares for this fabric */}
      {recentShares.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
            Previously sent
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {recentShares.slice(0, 8).map((s: any) => (
              <div
                key={s.id}
                className="p-3 flex flex-wrap items-center gap-3 text-sm"
              >
                <span className="font-semibold text-slate-900">
                  {s.recipientEmail}
                </span>
                <span className="text-xs text-slate-500">
                  Sent{" "}
                  {new Date(s.sentAt).toLocaleString()}
                </span>
                {s.viewedCount > 0 ? (
                  <span className="text-xs text-emerald-700 font-semibold">
                    ✓ viewed {s.viewedCount}×
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">not yet opened</span>
                )}
                <a
                  href={`/report/${s.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#00b4c3] underline ml-auto"
                >
                  Open the same link →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
