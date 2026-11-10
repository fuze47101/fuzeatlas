"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import AccountCard, { AttentionDot } from "@/components/book/AccountCard";
import AddAccount from "@/components/book/AddAccount";
import { BookAccount, HelpItem, TeamUser, ago, stageLabel } from "@/components/book/types";

const MANAGER_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

export default function MyBookPage() {
  return (
    <Suspense fallback={null}>
      <MyBookInner />
    </Suspense>
  );
}

function MyBookInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const b = (t as any).book || {};

  const [owners, setOwners] = useState<TeamUser[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [accounts, setAccounts] = useState<BookAccount[]>([]);
  const [help, setHelp] = useState<HelpItem[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "todo" | "help" | "red" | "next" | "support">("all");
  const [open, setOpen] = useState<BookAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  // Move mode: tick accounts, pick a person, write one note, hand them all over.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [moveTo, setMoveTo] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [moveKeep, setMoveKeep] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveMsg, setMoveMsg] = useState("");

  async function moveAccounts() {
    setMoveBusy(true);
    setMoveMsg("");
    try {
      const r = await fetch("/api/book/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: picked.map((k) => ({
            entityType: k.split(":")[0],
            entityId: k.slice(k.indexOf(":") + 1),
          })),
          fromUserId: ownerId,
          toUserId: moveTo,
          note: moveNote,
          keepSupport: moveKeep,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setMoveMsg(`✓ ${d.moved} → ${d.to}`);
      setPicked([]);
      setMoveNote("");
      await load(ownerId);
    } catch (e: any) {
      setMoveMsg(e.message);
    } finally {
      setMoveBusy(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/book");
  }, [user, loading, router]);

  const load = useCallback(async (uid?: string) => {
    setBusy(true);
    const r = await fetch(`/api/book${uid ? `?userId=${uid}` : ""}`)
      .then((r) => r.json())
      .catch(() => null);
    if (r?.accounts) {
      setAccounts(r.accounts);
      setHelp(r.help || []);
      setOwnerId(r.userId);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    load(params.get("userId") || undefined);
    fetch("/api/book/team")
      .then((r) => r.json())
      .then((d) => setTeam(d.users || []))
      .catch(() => null);
    fetch("/api/book?owners=1")
      .then((r) => r.json())
      .then((d) => setOwners(d.owners || []))
      .catch(() => null);
  }, [user, load, params]);

  const counts = useMemo(() => {
    const mine = accounts.filter((a) => a.isPrimary);
    return {
      total: accounts.length,
      mine: mine.length,
      support: accounts.length - mine.length,
      todo: mine.filter((a) => !a.checkedInThisWeek).length,
      red: mine.filter((a) => a.attention === "red").length,
      amber: mine.filter((a) => a.attention === "amber").length,
      helpForMe: help.filter((h) => h.assignee.id === ownerId && h.status !== "DONE").length,
      next: accounts.filter(
        (a) => a.nextStepAt && new Date(a.nextStepAt) <= new Date(Date.now() + 7 * 86400000),
      ).length,
    };
  }, [accounts, help, ownerId]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (
        s &&
        !`${a.name} ${a.country || ""} ${a.primaryContact || ""} ${a.lastNote || ""}`
          .toLowerCase()
          .includes(s)
      )
        return false;
      if (filter === "todo") return a.isPrimary && !a.checkedInThisWeek;
      if (filter === "support") return !a.isPrimary;
      if (filter === "help") return a.openHelp > 0;
      if (filter === "red") return a.isPrimary && a.attention !== "ok";
      if (filter === "next")
        return !!a.nextStepAt && new Date(a.nextStepAt) <= new Date(Date.now() + 7 * 86400000);
      return true;
    });
  }, [accounts, q, filter]);

  const isManager = !!user && MANAGER_ROLES.includes(user.role);
  const viewingOther = !!user && ownerId && ownerId !== user.id;

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{b.title || "My Book"}</h1>
          <div className="text-xs text-slate-500">
            {counts.mine} {b.accounts || "accounts"}
            {counts.support ? ` + ${counts.support} ${b.supporting || "supporting"}` : ""} ·{" "}
            {counts.todo} {b.toTouch || "to touch this week"}
            {counts.red ? ` · ${counts.red} ${b.cold || "cold"}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {owners.length > 1 && (
            <select
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value);
                load(e.target.value);
              }}
              className="max-w-[140px] rounded-lg border border-slate-300 px-2 py-2 text-xs"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id === user.id ? b.me || "Me" : o.name}
                </option>
              ))}
            </select>
          )}
          {isManager && (
            <Link
              href="/book/team"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {b.teamBoard || "Team"}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-sky-600 px-3 py-2 font-bold text-white"
        >
          + {b.addAccountBtn || "Add account"}
        </button>
        <a
          href={`/api/book/export?userId=${ownerId}`}
          className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
        >
          ⬇ {b.exportCsv || "Export CSV"}
        </a>
        <Link
          href={`/book/print?userId=${ownerId}`}
          className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
        >
          🖨 {b.printReport || "Print report"}
        </Link>
        <button
          onClick={() => {
            setSelecting((v) => !v);
            setPicked([]);
            setMoveMsg("");
          }}
          className={`rounded-lg border px-3 py-2 font-semibold ${selecting ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300 text-slate-700"}`}
        >
          ⇄ {selecting ? b.moveCancel || "Cancel move" : b.moveAccounts || "Move accounts"}
        </button>
      </div>

      {!viewingOther && counts.todo > 0 && (
        <Link
          href="/book/checkin"
          className="mt-3 block rounded-2xl bg-slate-900 px-4 py-4 text-white shadow"
        >
          <div className="text-base font-bold">▶ {b.startCheckin || "Start check-in"}</div>
          <div className="text-xs text-slate-300">
            {counts.todo} {b.accountsLeft || "accounts left this week"}
            {counts.helpForMe
              ? ` · ${counts.helpForMe} ${b.helpWaiting || "help requests waiting on you"}`
              : ""}
          </div>
        </Link>
      )}
      {!viewingOther && counts.todo === 0 && counts.mine > 0 && (
        <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {b.allDone || "Every account touched this week."}
        </div>
      )}

      {help.filter((h) => h.status !== "DONE").length > 0 && (
        <div className="mt-3 space-y-2">
          {help
            .filter((h) => h.status !== "DONE")
            .map((h) => {
              const acct = accounts.find(
                (a) => a.entityType === h.entityType && a.entityId === h.entityId,
              );
              const mine = h.assignee.id === ownerId;
              return (
                <div
                  key={h.id}
                  className={`rounded-xl border p-3 text-sm ${h.status === "ESCALATED" ? "border-rose-400 bg-rose-50" : mine ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-white"}`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    🙋{" "}
                    {mine
                      ? `${h.requester.name} ${b.needsYou || "needs you"}`
                      : `${b.youAsked || "You asked"} ${h.assignee.name}`}{" "}
                    · {acct?.name || ""} · {h.status}
                    {new Date(h.dueAt) < new Date() ? ` · ${b.overdue || "overdue"}` : ""}
                  </div>
                  <div className="text-slate-800">{h.ask}</div>
                  <div className="mt-2 flex gap-2 text-xs">
                    {mine && h.status === "OPEN" && (
                      <button
                        onClick={() =>
                          fetch(`/api/book/help/${h.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "ack" }),
                          }).then(() => load(ownerId))
                        }
                        className="rounded bg-white border border-slate-300 px-2 py-1"
                      >
                        {b.ack || "On it"}
                      </button>
                    )}
                    {(mine || h.requester.id === ownerId) && (
                      <button
                        onClick={() =>
                          fetch(`/api/book/help/${h.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "done" }),
                          }).then(() => load(ownerId))
                        }
                        className="rounded bg-white border border-slate-300 px-2 py-1"
                      >
                        {b.doneBtn || "Done"}
                      </button>
                    )}
                    {!mine &&
                      h.requester.id === ownerId &&
                      new Date(h.dueAt) < new Date() &&
                      h.status !== "ESCALATED" && (
                        <button
                          onClick={() =>
                            fetch(`/api/book/help/${h.id}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "escalate" }),
                            }).then(() => load(ownerId))
                          }
                          className="rounded bg-rose-600 px-2 py-1 text-white"
                        >
                          {b.escalate || "Escalate"}
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-3 mt-3 bg-white/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={b.searchPh || "Search accounts, contacts, notes"}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
        />
        <div className="mt-2 flex gap-1 overflow-x-auto text-xs">
          {(
            [
              ["all", b.fAll || "All", counts.total],
              ["todo", b.fTodo || "To touch", counts.todo],
              ["next", b.fNext || "Due soon", counts.next],
              ["help", b.fHelp || "Help", accounts.filter((a) => a.openHelp > 0).length],
              ["support", b.fSupport || "Supporting", counts.support],
              ["red", b.fCold || "Going cold", counts.red + counts.amber],
            ] as const
          ).map(([k, l, n]) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 ${filter === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {l} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {busy && !accounts.length && <div className="p-4 text-sm text-slate-400">…</div>}
        {!busy && !accounts.length && (
          <div className="p-6 text-center text-sm text-slate-500">
            {b.empty || "No accounts in this book yet."}{" "}
            <button onClick={() => setAdding(true)} className="text-sky-700 underline">
              {b.addFirst || "Add your first account"}
            </button>
          </div>
        )}
        {list.map((a) => (
          <button
            key={`${a.entityType}:${a.entityId}`}
            onClick={() => {
              if (!selecting) return setOpen(a);
              if (!a.isPrimary) return;
              const k = `${a.entityType}:${a.entityId}`;
              setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
            }}
            className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
          >
            <div className="pt-1.5">
              {selecting ? (
                <input
                  type="checkbox"
                  readOnly
                  disabled={!a.isPrimary}
                  checked={picked.includes(`${a.entityType}:${a.entityId}`)}
                  className="h-4 w-4"
                />
              ) : (
                <AttentionDot a={a} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="truncate font-semibold text-slate-900">
                  {a.name}
                  {!a.isPrimary && (
                    <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-normal text-slate-500">
                      {b.support || "Support"}
                    </span>
                  )}
                  {a.openHelp > 0 && <span className="ml-1 text-rose-600">🙋</span>}
                  {a.galaLead && (
                    <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">
                      Gala
                    </span>
                  )}
                </div>
                <div
                  className={`shrink-0 text-[11px] ${a.checkedInThisWeek ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {a.checkedInThisWeek ? "✓" : ago(a.lastRealTouchAt)}
                </div>
              </div>
              <div className="truncate text-xs text-slate-500">
                {[
                  a.country,
                  stageLabel(a.stage),
                  a.forecastQuarter,
                  a.primaryContact,
                  withWho(a, ownerId, b.withWord || "with"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {(a.nextStep || a.lastNote) && (
                <div className="mt-0.5 truncate text-xs text-slate-600">
                  {a.nextStep ? `→ ${a.nextStep}` : a.lastNote}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <AccountCard
          account={open}
          team={team}
          onClose={() => setOpen(null)}
          onCheckedIn={() => load(ownerId)}
          meId={user.id}
          bookOwnerId={ownerId || user.id}
        />
      )}
      {selecting && (
        <div className="sticky bottom-2 z-20 mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span>
              ⇄ {picked.length} {b.selected || "selected"}
            </span>
            <button
              className="font-normal underline"
              onClick={() =>
                setPicked(
                  picked.length
                    ? []
                    : list.filter((a) => a.isPrimary).map((a) => `${a.entityType}:${a.entityId}`),
                )
              }
            >
              {picked.length ? b.clearSel || "Clear" : b.selectShown || "Select all shown"}
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-48"
            >
              <option value="">{b.handToPh || "Hand over to…"}</option>
              {viewingOther && <option value={user.id}>{b.me || "Me"}</option>}
              {team
                .filter((u) => u.id !== ownerId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <input
              value={moveNote}
              onChange={(e) => setMoveNote(e.target.value)}
              placeholder={
                b.moveNotePh || "Handover note (goes to them and into each account's history)"
              }
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              disabled={!picked.length || !moveTo || moveBusy}
              onClick={moveAccounts}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {moveBusy ? "…" : b.handOverBtn || "Hand over"}
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={moveKeep}
              onChange={(e) => setMoveKeep(e.target.checked)}
            />
            {b.keepSupport || "Keep the current owner on it as support"}
          </label>
          {moveMsg && <div className="mt-1 text-xs text-slate-800">{moveMsg}</div>}
        </div>
      )}
      {adding && (
        <AddAccount
          forUserId={ownerId || user.id}
          book={accounts}
          onClose={() => setAdding(false)}
          onChanged={() => load(ownerId)}
        />
      )}
    </div>
  );
}

/** "with Viktor" / "with Barth (lead)" — everyone else on the account. */
function withWho(a: BookAccount, ownerId: string, word: string) {
  const others = (a.team || []).filter((p) => p.id !== ownerId);
  if (!others.length) return "";
  const names = others.map((p) => {
    const first = p.name.split(" ")[0];
    return !a.isPrimary && p.isPrimary ? `${first} (lead)` : first;
  });
  return `${word} ${names.join(", ")}`;
}
