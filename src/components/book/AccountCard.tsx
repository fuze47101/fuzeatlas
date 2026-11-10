"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import CheckinForm from "./CheckinForm";
import { BookAccount, TeamUser, ago, stageLabel } from "./types";

function href(a: BookAccount) {
  return a.entityType === "BRAND"
    ? `/brands/${a.entityId}`
    : a.entityType === "FACTORY"
      ? `/factories/${a.entityId}`
      : "/admin/distributors";
}

/** One row per person: owner wins over support when someone holds both. */
function dedupePeople(owners: { id: string; name: string; isPrimary: boolean }[]) {
  const m = new Map<string, { id: string; name: string; isPrimary: boolean }>();
  for (const o of owners) {
    const prev = m.get(o.id);
    m.set(o.id, { id: o.id, name: o.name, isPrimary: o.isPrimary || !!prev?.isPrimary });
  }
  return [...m.values()].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name),
  );
}

export function AttentionDot({ a }: { a: BookAccount }) {
  const c =
    a.attention === "red"
      ? "bg-rose-500"
      : a.attention === "amber"
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${c}`}
      title={`${a.silentWeeks} silent week(s)`}
    />
  );
}

/** Slide-over card for one account: history, contacts, and the four buttons. */
export default function AccountCard({
  account,
  team,
  onClose,
  onCheckedIn,
  meId,
}: {
  account: BookAccount;
  team: TeamUser[];
  onClose: () => void;
  onCheckedIn: () => void;
  meId?: string;
}) {
  const { t } = useI18n();
  const b = (t as any).book || {};
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState<"touch" | "history" | "contacts" | "people">("touch");
  const [done, setDone] = useState(false);
  const [addWho, setAddWho] = useState("");
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [peopleErr, setPeopleErr] = useState("");

  const reload = () =>
    fetch(`/api/book/account?type=${account.entityType}&id=${account.entityId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => null);

  async function setPerson(userId: string, opts: { support?: boolean; remove?: boolean }) {
    setPeopleBusy(true);
    setPeopleErr("");
    try {
      const r = await fetch("/api/book/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          entityType: account.entityType,
          entityId: account.entityId,
          ...opts,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setAddWho("");
      await reload();
      onCheckedIn();
    } catch (e: any) {
      setPeopleErr(e.message);
    } finally {
      setPeopleBusy(false);
    }
  }

  useEffect(() => {
    setDetail(null);
    setDone(false);
    setTab("touch");
    fetch(`/api/book/account?type=${account.entityType}&id=${account.entityId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => null);
  }, [account.entityType, account.entityId]);

  async function helpAction(id: string, action: string) {
    await fetch(`/api/book/help/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetch(`/api/book/account?type=${account.entityType}&id=${account.entityId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => null);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <AttentionDot a={account} />
                <h2 className="text-lg font-bold text-slate-900">{account.name}</h2>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {[
                  account.entityType === "FACTORY"
                    ? "Mill"
                    : account.entityType === "BRAND"
                      ? "Brand"
                      : "Distributor",
                  account.country,
                  stageLabel(account.stage),
                  account.forecastQuarter,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex gap-1 text-xs">
            {(["touch", "history", "contacts", "people"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-full px-3 py-1 ${tab === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {k === "touch"
                  ? b.touch || "Check in"
                  : k === "history"
                    ? b.history || "History"
                    : k === "contacts"
                      ? b.contacts || "Contacts"
                      : b.people || "People"}
              </button>
            ))}
            <Link
              href={href(account)}
              className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-slate-600"
            >
              {b.openFull || "Open full record"} →
            </Link>
          </div>
        </div>

        <div className="p-4">
          {tab === "touch" &&
            (done ? (
              <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
                ✓ {b.saved || "Saved."}{" "}
                <button className="ml-2 underline" onClick={() => setDone(false)}>
                  {b.another || "Add another"}
                </button>
              </div>
            ) : (
              <>
                {account.lastNote && (
                  <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      {b.lastNote || "Last note"} · {ago(account.lastRealTouchAt)}
                    </div>
                    {account.lastNote}
                  </div>
                )}
                {account.nextStep && (
                  <div className="mb-3 text-sm text-sky-800">
                    → {account.nextStep}
                    {account.nextStepAt
                      ? ` · ${new Date(account.nextStepAt).toLocaleDateString()}`
                      : ""}
                  </div>
                )}
                {detail?.help?.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {detail.help.map((h: any) => (
                      <div
                        key={h.id}
                        className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm"
                      >
                        <div className="text-[10px] uppercase tracking-wide text-rose-500">
                          🙋 {h.requester.name} → {h.assignee.name} · {h.status}
                        </div>
                        <div className="text-rose-900">{h.ask}</div>
                        <div className="mt-2 flex gap-2 text-xs">
                          <button
                            onClick={() => helpAction(h.id, "ack")}
                            className="rounded bg-white px-2 py-1 border border-rose-200"
                          >
                            {b.ack || "On it"}
                          </button>
                          <button
                            onClick={() => helpAction(h.id, "done")}
                            className="rounded bg-white px-2 py-1 border border-rose-200"
                          >
                            {b.doneBtn || "Done"}
                          </button>
                          {new Date(h.dueAt) < new Date() && h.status !== "ESCALATED" && (
                            <button
                              onClick={() => helpAction(h.id, "escalate")}
                              className="rounded bg-rose-600 px-2 py-1 text-white"
                            >
                              {b.escalate || "Escalate"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <CheckinForm
                  account={account}
                  team={team}
                  compact
                  onDone={() => {
                    setDone(true);
                    onCheckedIn();
                  }}
                />
              </>
            ))}

          {tab === "history" && (
            <div className="space-y-3">
              {!detail && <div className="text-sm text-slate-400">…</div>}
              {detail?.checkins?.map((c: any) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
                    <span>
                      {c.kind === "SUPER"
                        ? "⭐ Super"
                        : c.kind === "HELP"
                          ? "🙋 Help"
                          : c.kind === "NONE"
                            ? "No update"
                            : "Update"}{" "}
                      · {c.user?.name}
                    </span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  {c.headline && <div className="font-semibold text-slate-800">{c.headline}</div>}
                  {c.note && <div className="whitespace-pre-wrap text-slate-700">{c.note}</div>}
                  {c.nextStep && <div className="mt-1 text-sky-800">→ {c.nextStep}</div>}
                  {(c.stageAfter || c.forecastAfter) && (
                    <div className="mt-1 text-xs text-slate-500">
                      {c.stageAfter ? `Stage → ${stageLabel(c.stageAfter)}` : ""}{" "}
                      {c.forecastAfter ? `Forecast → ${c.forecastAfter}` : ""}
                    </div>
                  )}
                  {c.orderKg && (
                    <div className="mt-1 text-xs text-slate-500">
                      Order {c.orderKg} kg {c.orderProduct} ({c.orderMonth})
                    </div>
                  )}
                </div>
              ))}
              {detail?.notes?.map((n: any) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-600"
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    {n.noteType || "Note"} · {n.user?.name || ""} ·{" "}
                    {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                  <div className="whitespace-pre-wrap">{n.content}</div>
                </div>
              ))}
              {detail && !detail.checkins?.length && !detail.notes?.length && (
                <div className="text-sm text-slate-400">{b.noHistory || "No history yet."}</div>
              )}
            </div>
          )}

          {tab === "people" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {b.peopleHint ||
                  "Owners are asked about this account every Friday. Support is on the account and sees it in their book, but is not asked."}
              </p>
              {(detail?.owners || []).length === 0 && (
                <div className="text-sm text-slate-400">
                  {b.noPeople || "Nobody is assigned yet."}
                </div>
              )}
              {dedupePeople(detail?.owners || []).map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-800">
                      {o.name}
                      {o.id === meId ? (
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          ({b.me || "Me"})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {o.isPrimary ? b.owner || "Owner" : b.support || "Support"}
                    </div>
                  </div>
                  <div className="flex gap-1 text-xs">
                    <button
                      disabled={peopleBusy}
                      onClick={() => setPerson(o.id, { support: o.isPrimary })}
                      className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                    >
                      {o.isPrimary ? b.makeSupport || "Make support" : b.makeOwner || "Make owner"}
                    </button>
                    <button
                      disabled={peopleBusy}
                      onClick={() => setPerson(o.id, { remove: true })}
                      className="rounded border border-rose-200 px-2 py-1 text-rose-700 disabled:opacity-50"
                    >
                      {b.remove || "Remove"}
                    </button>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-700">
                  {b.addTeammate || "Add a teammate to this account"}
                </div>
                <select
                  value={addWho}
                  onChange={(e) => setAddWho(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{b.whoPh || "Who?"}</option>
                  {meId && !(detail?.owners || []).some((o: any) => o.id === meId) && (
                    <option value={meId}>{b.me || "Me"}</option>
                  )}
                  {team
                    .filter((u) => !(detail?.owners || []).some((o: any) => o.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={!addWho || peopleBusy}
                    onClick={() => setPerson(addWho, {})}
                    className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {b.addAsOwner || "Add as owner"}
                  </button>
                  <button
                    disabled={!addWho || peopleBusy}
                    onClick={() => setPerson(addWho, { support: true })}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    {b.addAsSupport || "Add as support"}
                  </button>
                </div>
                {peopleErr && <div className="mt-2 text-xs text-rose-700">{peopleErr}</div>}
              </div>
            </div>
          )}

          {tab === "contacts" && (
            <div className="space-y-2">
              {detail?.contacts?.map((c: any) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="font-semibold text-slate-800">
                    {c.name}{" "}
                    {c.isPrimary && (
                      <span className="ml-1 rounded bg-slate-100 px-1 text-[10px]">primary</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{c.title}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {c.email && (
                      <a className="text-sky-700 underline" href={`mailto:${c.email}`}>
                        {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a className="text-sky-700 underline" href={`tel:${c.phone}`}>
                        {c.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {detail && !detail.contacts?.length && (
                <div className="text-sm text-slate-400">
                  {b.noContacts || "No contacts on file."}
                </div>
              )}
              {detail?.owners?.length > 0 && (
                <div className="pt-2 text-xs text-slate-500">
                  {b.owners || "Owners"}: {detail.owners.map((o: any) => o.name).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
