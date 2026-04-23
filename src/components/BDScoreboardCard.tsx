"use client";
/**
 * BDScoreboardCard — Phase 5 home-page widget for BD-eligible roles.
 *
 * Behavior:
 *   - SALES_REP / BD_REP: shows their own row only (single-rep card with
 *     metrics + a deep-link to /admin/bd/sequences for action).
 *   - SALES_MANAGER / ADMIN / EMPLOYEE: shows the top-3 reps over the
 *     last 30 days plus a link out to the full scoreboard at
 *     /admin/bd/scoreboard.
 *   - All other roles: render nothing (returns null).
 *
 * Pulls from /api/admin/bd/scoreboard?days=30 (with all=1 for managers).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface RepRow {
  rep: { id: string; name: string | null; email: string; role: string };
  emailsSent: number;
  linkedinSent: number;
  contactsWorked: number;
  sequencesStarted: number;
  stepsSent: number;
  stepsReady: number;
  replies: number;
  meetingsBooked: number;
  brandsConverted: number;
  replyRate: number;
}

interface Scoreboard {
  ok: boolean;
  windowDays: number;
  since: string;
  rows: RepRow[];
  totals: {
    emailsSent: number;
    linkedinSent: number;
    contactsWorked: number;
    sequencesStarted: number;
    stepsSent: number;
    stepsReady: number;
    replies: number;
    meetingsBooked: number;
    brandsConverted: number;
    replyRate: number;
  };
}

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export default function BDScoreboardCard() {
  const { user } = useAuth();
  const [data, setData] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);

  const isManager =
    user?.role === "ADMIN" ||
    user?.role === "EMPLOYEE" ||
    user?.role === "SALES_MANAGER";
  const isVisible = !!user && BD_ROLES.includes(user.role);

  useEffect(() => {
    if (!isVisible) {
      setLoading(false);
      return;
    }
    const url = `/api/admin/bd/scoreboard?days=30${isManager ? "&all=1" : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      })
      .catch((e) => console.error("BDScoreboardCard load failed:", e))
      .finally(() => setLoading(false));
  }, [isVisible, isManager]);

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl">📊</span>
            <h3 className="text-xl font-black mt-3">
              {isManager ? "Team BD Scoreboard" : "Your BD Activity"}
            </h3>
            <p className="text-sm text-white/80 mt-1">
              {isManager
                ? "Top reps over the last 30 days."
                : "Your outreach &amp; conversion in the last 30 days."}
            </p>
          </div>
          <Link
            href={isManager ? "/admin/bd/scoreboard" : "/admin/bd/sequences"}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap"
          >
            {isManager ? "Full board →" : "My sequences →"}
          </Link>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No BD activity in the last 30 days.{" "}
            <Link href="/admin/bd/wizard" className="text-violet-700 font-semibold hover:underline">
              Start a sequence →
            </Link>
          </div>
        ) : isManager ? (
          <ManagerView rows={data.rows.slice(0, 3)} totals={data.totals} />
        ) : (
          <RepView row={data.rows[0]} />
        )}
      </div>
    </div>
  );
}

function ManagerView({
  rows,
  totals,
}: {
  rows: RepRow[];
  totals: Scoreboard["totals"];
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2 mb-4 pb-3 border-b border-slate-100">
        <Stat label="Emails" value={totals.emailsSent} />
        <Stat label="Contacts" value={totals.contactsWorked} />
        <Stat label="Replies" value={totals.replies} />
        <Stat label="Converted" value={totals.brandsConverted} />
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left pb-2">Rep</th>
            <th className="text-right pb-2">Emails</th>
            <th className="text-right pb-2">Contacts</th>
            <th className="text-right pb-2">Replies</th>
            <th className="text-right pb-2">Won</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.rep.id} className="border-t border-slate-100">
              <td className="py-2">
                <span className="text-slate-400 mr-1">{idx + 1}.</span>
                <span className="font-medium text-slate-900">
                  {r.rep.name || r.rep.email}
                </span>
              </td>
              <td className="text-right tabular-nums py-2">{r.emailsSent}</td>
              <td className="text-right tabular-nums py-2">{r.contactsWorked}</td>
              <td className="text-right tabular-nums py-2 font-semibold">{r.replies}</td>
              <td className="text-right tabular-nums py-2 font-semibold text-emerald-700">
                {r.brandsConverted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function RepView({ row }: { row: RepRow }) {
  const replyPct = (row.replyRate * 100).toFixed(1);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Emails Sent" value={row.emailsSent} />
        <Stat label="Contacts" value={row.contactsWorked} />
        <Stat label="Replies" value={row.replies} highlight />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="LinkedIn" value={row.linkedinSent} />
        <Stat label="Reply %" value={`${replyPct}%`} />
        <Stat label="Meetings" value={row.meetingsBooked} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Sequences" value={row.sequencesStarted} />
        <Stat label="Won" value={row.brandsConverted} highlight />
      </div>
      {row.stepsReady > 0 && (
        <Link
          href="/admin/bd/sequences"
          className="mt-4 block text-center px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-bold"
        >
          ⚡ {row.stepsReady} step{row.stepsReady === 1 ? "" : "s"} ready to send
        </Link>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-lg font-black tabular-nums ${
          highlight ? "text-violet-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
