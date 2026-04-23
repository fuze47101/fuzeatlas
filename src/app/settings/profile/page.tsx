"use client";
/**
 * /settings/profile — self-service profile settings.
 *
 * Today this is narrowly scoped to the BD Wizard's per-rep outbound
 * configuration: From: email, display name, and email signature. We'll
 * layer in more profile fields (avatar, time zone, notification prefs)
 * as the wizard and other self-service flows need them.
 *
 * Linked from the home page + sidebar via a "Profile" affordance.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  outboundFromEmail: string | null;
  outboundFromName: string | null;
  outboundSignature: string | null;
}

export default function ProfileSettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [signature, setSignature] = useState("");

  // Calendar subscription URL (loaded async — see effect below)
  const [calendarFeed, setCalendarFeed] = useState<{
    httpsUrl: string;
    webcalUrl: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (!cancelled) setError(data.error || "Failed to load profile");
          return;
        }
        if (cancelled) return;
        setMe(data.user);
        setAllowed(data.allowedFromDomains || []);
        setName(data.user.name || "");
        setFromEmail(data.user.outboundFromEmail || "");
        setFromName(data.user.outboundFromName || data.user.name || "");
        setSignature(data.user.outboundSignature || "");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Calendar feed URL — loaded once, separately from profile (different endpoint).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/calendar-feed")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.ok) return;
        setCalendarFeed({ httpsUrl: j.httpsUrl, webcalUrl: j.webcalUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyCalendarUrl() {
    if (!calendarFeed) return;
    try {
      await navigator.clipboard.writeText(calendarFeed.httpsUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          outboundFromEmail: fromEmail.trim() || null,
          outboundFromName: fromName.trim() || null,
          outboundSignature: signature,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to save");
      } else {
        setMe(data.user);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 max-w-3xl mx-auto text-slate-500">Loading profile…</div>;
  }

  if (!me) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error || "Could not load profile"}
        </div>
      </div>
    );
  }

  const previewFrom = fromEmail
    ? `${fromName || me.name} <${fromEmail.trim().toLowerCase()}>`
    : "FUZE Atlas <notifications@fuzeatlas.com> (default)";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/home" className="text-sm text-slate-500 hover:text-slate-700">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold mt-2 text-slate-900">Profile Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your account and how your outbound emails appear to prospects.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href="/settings/email-templates"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:border-sky-300 hover:text-sky-700"
          >
            ✉️ Email Templates
          </Link>
          <Link
            href="/settings/availability"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:border-sky-300 hover:text-sky-700"
          >
            📅 Availability
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identity */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Identity
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email (login)</label>
              <input
                type="email"
                value={me.email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Contact an admin to change your login email.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <input
                type="text"
                value={me.role}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <input
                type="text"
                value={me.status}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>
          </div>
        </section>

        {/* Outbound From */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Outbound Email Identity
            </h2>
            <span className="text-[11px] text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5">
              BD Wizard
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            When you send outbound through the BD Wizard, the email will appear to come from this
            address. Replies route back to your inbox normally. You'll also receive a BCC summary of
            every send so you know exactly what went out.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From: Email</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder={`andrew@${allowed[0] || "801inc.com"}`}
              />
              {allowed.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Allowed domains: {allowed.join(", ")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                From: Display Name
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Andrew Moger"
              />
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Preview</div>
            <div className="text-sm font-mono text-slate-700">{previewFrom}</div>
          </div>
        </section>

        {/* Signature */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
            Email Signature
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Appended to outbound emails sent through the BD Wizard. Plain text is fine — keep it
            short. If you leave this blank, no signature is added.
          </p>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
            placeholder={`Andrew Moger\nFUZE Industries\n801-555-0123`}
          />
          <div className="text-[11px] text-slate-400 mt-1">
            {signature.length} / 4000 characters
          </div>
        </section>

        {/* Calendar Subscription */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Calendar Subscription
            </h2>
            <span className="text-[11px] text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
              Outlook · Google · Apple
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Subscribe your calendar app to a read-only overlay of your Atlas meetings and open CRM
            tasks. Updates flow automatically — no IT permission required. The URL contains a
            private token, so don't share it.
          </p>
          {calendarFeed ? (
            <>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={calendarFeed.httpsUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700"
                />
                <button
                  type="button"
                  onClick={copyCalendarUrl}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
                >
                  {copiedUrl ? "Copied ✓" : "Copy URL"}
                </button>
                <a
                  href={calendarFeed.webcalUrl}
                  className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 whitespace-nowrap"
                >
                  Subscribe →
                </a>
              </div>
              <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer hover:text-slate-900">
                  How to add this to Outlook / Google / Apple
                </summary>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-slate-500">
                  <li>
                    <b>Outlook (web):</b> Calendar → Add calendar → Subscribe from web → paste URL.
                  </li>
                  <li>
                    <b>Google Calendar:</b> Other calendars + → From URL → paste URL.
                  </li>
                  <li>
                    <b>Apple Calendar:</b> File → New Calendar Subscription → paste URL → set
                    auto-refresh to 1 hour.
                  </li>
                </ul>
              </details>
            </>
          ) : (
            <div className="text-xs text-slate-400">Loading subscription URL…</div>
          )}
        </section>

        {/* Actions */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
            Saved.
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/home"
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
