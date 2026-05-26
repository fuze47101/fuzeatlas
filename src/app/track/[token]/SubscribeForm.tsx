"use client";

import { useState } from "react";

export default function SubscribeForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/public/track/${token}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (d.ok) {
        setStatus("ok");
        setEmail("");
      } else {
        setStatus("error");
        setError(d.error || "Subscription failed");
      }
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Subscription failed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        Subscribed. You'll receive an email at each state transition.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={busy || !email}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? "…" : "Subscribe"}
      </button>
      {status === "error" && (
        <div className="text-xs text-rose-600 sm:ml-2 sm:self-center">{error}</div>
      )}
    </form>
  );
}
