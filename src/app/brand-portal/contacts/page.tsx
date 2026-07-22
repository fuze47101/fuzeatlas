"use client";

/**
 * Your FUZE Team — who to contact (brand-portal item 8).
 *
 * A region-aware directory of the FUZE-side people a brand can reach for
 * answers: their Account Manager, the Corporate Office, Regional Manager(s),
 * and country-level Technical Contact(s). Data from GET
 * /api/brand-portal/fuze-team (resolver in src/lib/fuze-team.ts).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Contact {
  name: string;
  title: string;
  email: string;
  scope: string;
}
interface TeamData {
  accountManager: Contact | null;
  corporate: Contact[];
  regionalManagers: Contact[];
  technicalContacts: Contact[];
  hasRegion: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function ContactCard({ c }: { c: Contact }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className="w-12 h-12 rounded-full bg-[#00b4c3]/10 text-[#00b4c3] font-black flex items-center justify-center text-sm shrink-0">
        {initials(c.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900 truncate">{c.name}</div>
        <div className="text-sm text-slate-600">{c.title}</div>
        {c.scope ? (
          <div className="text-xs text-slate-400 mt-0.5">
            <span aria-hidden>📍</span> {c.scope}
          </div>
        ) : null}
        <a
          href={`mailto:${c.email}`}
          className="inline-flex items-center gap-1.5 mt-2 text-sm text-[#00b4c3] hover:text-[#009ba8] font-medium break-all"
        >
          <span aria-hidden>✉️</span>
          {c.email}
        </a>
      </div>
    </div>
  );
}

function Section({ title, contacts }: { title: string; contacts: Contact[] }) {
  if (!contacts || contacts.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((c, i) => (
          <ContactCard key={`${c.email}-${i}`} c={c} />
        ))}
      </div>
    </div>
  );
}

export default function BrandPortalFuzeTeamPage() {
  const { t } = useI18n();
  const tx = (t.brandPortal as any).fuzeTeam;
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brand-portal/fuze-team")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || tx.loadFailed);
        setData(j);
      })
      .catch((e) => setError(e?.message || tx.loadFailed))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>;
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || tx.loadFailed}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {/* Your Account Manager */}
      {data.accountManager ? (
        <Section title={tx.accountManagerHeader} contacts={[data.accountManager]} />
      ) : (
        <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          {tx.noAccountManager}
        </div>
      )}

      {/* Corporate Office (always) */}
      <Section title={tx.corporateHeader} contacts={data.corporate} />

      {/* Regional Managers */}
      <Section title={tx.regionalHeader} contacts={data.regionalManagers} />

      {/* Technical Contacts */}
      <Section title={tx.technicalHeader} contacts={data.technicalContacts} />

      {/* No region resolved yet */}
      {!data.hasRegion && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          {tx.noRegionNote}
        </div>
      )}
    </div>
  );
}
