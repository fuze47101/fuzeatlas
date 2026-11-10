"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import CheckinForm from "@/components/book/CheckinForm";
import { AttentionDot } from "@/components/book/AccountCard";
import {
  BookAccount,
  CheckinKind,
  HelpItem,
  TeamUser,
  ago,
  stageLabel,
} from "@/components/book/types";

/**
 * The Friday wizard. Help requests waiting on me come first, then every
 * account not yet touched this week, most-silent first. One screen each.
 */
export default function CheckinWizard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const b = (t as any).book || {};

  const [accounts, setAccounts] = useState<BookAccount[]>([]);
  const [help, setHelp] = useState<HelpItem[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [queue, setQueue] = useState<BookAccount[]>([]);
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<Record<CheckinKind, number>>({
    NONE: 0,
    UPDATE: 0,
    SUPER: 0,
    HELP: 0,
  });
  const [helpDone, setHelpDone] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/book/checkin");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    const [r, tm] = await Promise.all([
      fetch("/api/book")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/book/team")
        .then((r) => r.json())
        .catch(() => ({ users: [] })),
    ]);
    if (r?.accounts) {
      setAccounts(r.accounts);
      setHelp(r.help || []);
      setQueue(r.accounts.filter((a: BookAccount) => a.isPrimary && !a.checkedInThisWeek));
    }
    setTeam(tm.users || []);
    setReady(true);
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const current = queue[i] || null;
  useEffect(() => {
    setHistory(null);
    if (!current) return;
    fetch(`/api/book/account?type=${current.entityType}&id=${current.entityId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.checkins?.slice(0, 3) || []))
      .catch(() => setHistory([]));
  }, [current?.entityType, current?.entityId]);

  const helpForMe = useMemo(
    () =>
      help.filter(
        (h) => h.assignee.id === user?.id && h.status !== "DONE" && !helpDone.includes(h.id),
      ),
    [help, user, helpDone],
  );

  async function helpAction(id: string, action: string) {
    await fetch(`/api/book/help/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (action === "done") setHelpDone((d) => [...d, id]);
    else setHelp((hs) => hs.map((h) => (h.id === id ? { ...h, status: "ACKED" } : h)));
  }

  if (loading || !user || !ready) return <div className="p-6 text-sm text-slate-400">…</div>;

  const total = queue.length;
  const finished = i >= total;

  return (
    <div className="mx-auto max-w-xl px-3 pb-24 pt-3 sm:px-4">
      <div className="flex items-center justify-between">
        <Link href="/book" className="text-xs text-slate-500">
          ← {b.title || "My Book"}
        </Link>
        <div className="text-xs text-slate-500">
          {finished ? total : i + 1} / {total}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-slate-900 transition-all"
          style={{ width: `${total ? Math.min(100, (Math.min(i, total) / total) * 100) : 100}%` }}
        />
      </div>

      {helpForMe.length > 0 && i === 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide text-rose-600">
            {b.helpFirst || "Teammates are waiting on you"}
          </div>
          {helpForMe.map((h) => {
            const acct = accounts.find(
              (a) => a.entityType === h.entityType && a.entityId === h.entityId,
            );
            return (
              <div key={h.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
                <div className="text-[10px] uppercase tracking-wide text-rose-500">
                  🙋 {h.requester.name} · {acct?.name || ""}
                  {new Date(h.dueAt) < new Date() ? ` · ${b.overdue || "overdue"}` : ""}
                </div>
                <div className="text-rose-900">{h.ask}</div>
                <div className="mt-2 flex gap-2 text-xs">
                  {h.status === "OPEN" && (
                    <button
                      onClick={() => helpAction(h.id, "ack")}
                      className="rounded bg-white border border-rose-200 px-3 py-1.5"
                    >
                      {b.ack || "On it"}
                    </button>
                  )}
                  <button
                    onClick={() => helpAction(h.id, "done")}
                    className="rounded bg-rose-600 px-3 py-1.5 text-white"
                  >
                    {b.doneBtn || "Done"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!finished && current && (
        <div className="mt-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <AttentionDot a={current} />
              <h1 className="text-xl font-bold text-slate-900">{current.name}</h1>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {[
                current.entityType === "FACTORY"
                  ? "Mill"
                  : current.entityType === "BRAND"
                    ? "Brand"
                    : "Distributor",
                current.country,
                stageLabel(current.stage),
                current.forecastQuarter,
                current.primaryContact,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {b.lastTouch || "Last touch"}: {ago(current.lastRealTouchAt)}
              {current.silentWeeks >= 2
                ? ` · ${current.silentWeeks} ${b.silentWeeks || "silent weeks"}`
                : ""}
            </div>
            {history === null ? null : history.length ? (
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                {history.map((c: any) => (
                  <div key={c.id} className="text-xs text-slate-600">
                    <span className="text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString()} · {c.user?.name?.split(" ")[0]}:
                    </span>{" "}
                    {c.kind === "NONE" ? (
                      <i>{b.noUpdate || "No update"}</i>
                    ) : (
                      c.headline || c.note || c.nextStep
                    )}
                  </div>
                ))}
              </div>
            ) : current.lastNote ? (
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                {current.lastNote}
              </div>
            ) : null}
            {current.nextStep && (
              <div className="mt-2 text-sm text-sky-800">
                → {current.nextStep}
                {current.nextStepAt
                  ? ` · ${new Date(current.nextStepAt).toLocaleDateString()}`
                  : ""}
              </div>
            )}
            <div className="mt-4">
              <CheckinForm
                account={current}
                team={team}
                onDone={({ kind }) => {
                  setTally((t) => ({ ...t, [kind]: t[kind] + 1 }));
                  setI((x) => x + 1);
                  window.scrollTo({ top: 0 });
                }}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-400">
            <button
              onClick={() => setI((x) => Math.max(0, x - 1))}
              disabled={i === 0}
              className="disabled:opacity-30"
            >
              ← {b.prev || "Previous"}
            </button>
            <button onClick={() => setI((x) => x + 1)}>{b.skip || "Skip for now"} →</button>
          </div>
        </div>
      )}

      {finished && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl">✓</div>
          <div className="mt-1 text-lg font-bold text-emerald-900">
            {total
              ? b.weekDone || "Week done."
              : b.nothingDue || "Nothing due. Every account is touched this week."}
          </div>
          {total > 0 && (
            <div className="mt-1 text-sm text-emerald-800">
              {tally.UPDATE + tally.SUPER + tally.HELP} {b.updates || "updates"} · {tally.SUPER} ⭐
              · {tally.HELP} 🙋 · {tally.NONE} {b.noChange || "no change"}
            </div>
          )}
          <Link
            href="/book"
            className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            {b.backToBook || "Back to My Book"}
          </Link>
        </div>
      )}
    </div>
  );
}
