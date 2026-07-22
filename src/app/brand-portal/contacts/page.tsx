"use client";

/**
 * Your FUZE Team (brand-portal item 8).
 *
 * Replaces the brand's own-contacts view with the brand's FUZE-side people:
 * Account Manager, Region Manager, Lab Manager, and the Exec Team. Data comes
 * from GET /api/brand-portal/fuze-team (resolver in src/lib/fuze-team.ts).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface TeamMember {
  name: string;
  email: string;
  role: string;
  note?: string;
}
interface TeamData {
  accountManager: TeamMember | null;
  regionManager: TeamMember | null;
  labManager: TeamMember | null;
  execTeam: TeamMember[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function ContactCard({ member, tx }: { member: TeamMember; tx: any }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className="w-12 h-12 rounded-full bg-[#00b4c3]/10 text-[#00b4c3] font-black flex items-center justify-center text-sm shrink-0">
        {initials(member.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          {member.role}
        </div>
        <div className="font-bold text-slate-900 truncate">{member.name}</div>
        {member.note ? <div className="text-xs text-slate-500 mt-0.5">{member.note}</div> : null}
        <a
          href={`mailto:${member.email}`}
          className="inline-flex items-center gap-1.5 mt-2 text-sm text-[#00b4c3] hover:text-[#009ba8] font-medium break-all"
        >
          <span aria-hidden>✉️</span>
          {member.email}
        </a>
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

      {/* Primary roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {data.accountManager && <ContactCard member={data.accountManager} tx={tx} />}
        {data.regionManager && <ContactCard member={data.regionManager} tx={tx} />}
        {data.labManager && <ContactCard member={data.labManager} tx={tx} />}
      </div>

      {/* Exec Team */}
      {data.execTeam && data.execTeam.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-3">{tx.execHeader}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.execTeam.map((m, i) => (
              <ContactCard key={`${m.email}-${i}`} member={m} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
