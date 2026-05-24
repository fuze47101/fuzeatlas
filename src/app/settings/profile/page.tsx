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
import { useI18n } from "@/i18n";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  outboundFromEmail: string | null;
  timezone?: string | null;
  outboundFromName: string | null;
  outboundSignature: string | null;
}

export default function ProfileSettingsPage() {
  const { t } = useI18n();
  const T = t.settingsProfile;
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
  const [timezone, setTimezone] = useState("");

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
          if (!cancelled) setError(data.error || T.failedLoadProfile);
          return;
        }
        if (cancelled) return;
        setMe(data.user);
        setAllowed(data.allowedFromDomains || []);
        setName(data.user.name || "");
        setFromEmail(data.user.outboundFromEmail || "");
        setFromName(data.user.outboundFromName || data.user.name || "");
        setSignature(data.user.outboundSignature || "");
        setTimezone(data.user.timezone || "");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || T.failedLoadProfile);
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
          timezone: timezone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || T.failedSave);
      } else {
        setMe(data.user);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e: any) {
      setError(e?.message || T.failedSave);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 max-w-3xl mx-auto text-slate-500">{T.loadingProfile}</div>;
  }

  if (!me) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error || T.couldNotLoad}
        </div>
      </div>
    );
  }

  const previewFrom = fromEmail
    ? `${fromName || me.name} <${fromEmail.trim().toLowerCase()}>`
    : T.defaultPreview;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/home" className="text-sm text-slate-500 hover:text-slate-700">
          {T.backHome}
        </Link>
        <h1 className="text-2xl font-bold mt-2 text-slate-900">{T.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {T.pageBlurb}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href="/settings/email-templates"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:border-sky-300 hover:text-sky-700"
          >
            {T.quickEmailTemplates}
          </Link>
          <Link
            href="/settings/availability"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:border-sky-300 hover:text-sky-700"
          >
            {T.quickAvailability}
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identity */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            {T.identityHeader}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.nameLabel}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder={T.namePlaceholder}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.emailLoginLabel}</label>
              <input
                type="email"
                value={me.email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {T.emailLoginHint}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.roleLabel}</label>
              <input
                type="text"
                value={me.role}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.statusLabel}</label>
              <input
                type="text"
                value={me.status}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {T.timezoneLabel}
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder={T.timezonePlaceholder}
                list="iana-tz-suggestions"
              />
              <datalist id="iana-tz-suggestions">
                <option value="America/Denver" />
                <option value="America/New_York" />
                <option value="America/Los_Angeles" />
                <option value="America/Chicago" />
                <option value="Europe/London" />
                <option value="Europe/Paris" />
                <option value="Asia/Taipei" />
                <option value="Asia/Shanghai" />
                <option value="Asia/Hong_Kong" />
                <option value="Asia/Tokyo" />
                <option value="Asia/Seoul" />
                <option value="Asia/Singapore" />
                <option value="Asia/Bangkok" />
                <option value="Asia/Istanbul" />
                <option value="Australia/Sydney" />
              </datalist>
              <p className="text-[11px] text-slate-400 mt-1">
                {T.timezoneHint}
              </p>
            </div>
          </div>
        </section>

        {/* Outbound From */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {T.outboundHeader}
            </h2>
            <span className="text-[11px] text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5">
              {T.bdWizardBadge}
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            {T.outboundBlurb}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.fromEmailLabel}</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder={`andrew@${allowed[0] || "801inc.com"}`}
              />
              {allowed.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {T.allowedDomainsLabel}{allowed.join(", ")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {T.fromDisplayNameLabel}
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder={T.fromDisplayPlaceholder}
              />
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{T.previewLabel}</div>
            <div className="text-sm font-mono text-slate-700">{previewFrom}</div>
          </div>
        </section>

        {/* Signature */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
            {T.signatureHeader}
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            {T.signatureBlurb}
          </p>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
            placeholder={T.signaturePlaceholder}
          />
          <div className="text-[11px] text-slate-400 mt-1">
            {T.charCountTemplate.replace("{count}", String(signature.length))}
          </div>
        </section>

        {/* Calendar Subscription */}
        <section className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {T.calendarHeader}
            </h2>
            <span className="text-[11px] text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
              {T.calendarBadge}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {T.calendarBlurb}
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
                  {copiedUrl ? T.copiedCheck : T.copyUrl}
                </button>
                <a
                  href={calendarFeed.webcalUrl}
                  className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 whitespace-nowrap"
                >
                  {T.subscribeBtn}
                </a>
              </div>
              <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer hover:text-slate-900">
                  {T.calendarHelpSummary}
                </summary>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-slate-500">
                  <li>
                    <b>{T.calendarOutlook}</b>{T.calendarOutlookSteps}
                  </li>
                  <li>
                    <b>{T.calendarGoogle}</b>{T.calendarGoogleSteps}
                  </li>
                  <li>
                    <b>{T.calendarApple}</b>{T.calendarAppleSteps}
                  </li>
                </ul>
              </details>
            </>
          ) : (
            <div className="text-xs text-slate-400">{T.loadingSubscriptionUrl}</div>
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
            {T.savedFlag}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/home"
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            {T.cancelBtn}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? T.saving : T.saveChanges}
          </button>
        </div>
      </form>
    </div>
  );
}
