"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { BookAccount, CheckinKind, STAGES, TeamUser, quarters, stageLabel } from "./types";

/**
 * The four big buttons. Used by the Friday wizard and by the account card,
 * so a daily touch and a Friday touch are the same thing.
 */
export default function CheckinForm({
  account,
  team,
  onDone,
  compact,
}: {
  account: BookAccount;
  team: TeamUser[];
  onDone: (result: { kind: CheckinKind }) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const b = (t as any).book || {};
  const [kind, setKind] = useState<CheckinKind | null>(null);
  const [note, setNote] = useState("");
  const [headline, setHeadline] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepAt, setNextStepAt] = useState("");
  const [stage, setStage] = useState(account.stage || "");
  const [forecast, setForecast] = useState(account.forecastQuarter || "");
  const [more, setMore] = useState(false);
  const [orderKg, setOrderKg] = useState("");
  const [orderProduct, setOrderProduct] = useState("F1");
  const [assignee, setAssignee] = useState("");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setKind(null);
    setNote("");
    setHeadline("");
    setNextStep("");
    setNextStepAt("");
    setStage(account.stage || "");
    setForecast(account.forecastQuarter || "");
    setMore(false);
    setOrderKg("");
    setAssignee("");
    setAsk("");
    setErr(null);
  }, [account.entityType, account.entityId]);

  useEffect(() => {
    if (kind && kind !== "NONE") setTimeout(() => noteRef.current?.focus(), 50);
  }, [kind]);

  const speechOk = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
    [],
  );
  function toggleDictation(target: "note" | "ask") {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";
    r.onresult = (e: any) => {
      let s = "";
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      if (target === "note") setNote((v) => (v ? v + " " : "") + s.trim());
      else setAsk((v) => (v ? v + " " : "") + s.trim());
    };
    r.onend = () => setListening(false);
    recRef.current = r;
    r.start();
    setListening(true);
  }

  async function submit(k: CheckinKind) {
    setBusy(true);
    setErr(null);
    try {
      const payload: any = { entityType: account.entityType, entityId: account.entityId, kind: k };
      if (k !== "NONE") {
        payload.note = note;
        payload.headline = headline;
        payload.nextStep = nextStep;
        payload.nextStepAt = nextStepAt || null;
        payload.noteLang = typeof navigator !== "undefined" ? navigator.language : null;
        if (stage && stage !== account.stage) payload.stage = stage;
        if (forecast !== (account.forecastQuarter || "")) payload.forecastQuarter = forecast;
        if (Number(orderKg) > 0) payload.order = { product: orderProduct, kg: Number(orderKg) };
        if (k === "HELP") payload.help = { assigneeId: assignee, ask };
      }
      const r = await fetch("/api/book/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      onDone({ kind: k });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const big =
    "flex-1 min-w-[140px] rounded-xl px-3 py-4 text-base font-bold shadow-sm active:scale-[0.98] transition disabled:opacity-50";
  const label = (en: string, key: string) => b[key] || en;

  if (!kind) {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={busy}
            onClick={() => submit("NONE")}
            className={`${big} bg-slate-100 text-slate-700 border border-slate-200`}
          >
            {label("No Update", "noUpdate")}
            <div className="text-[11px] font-normal text-slate-500 mt-1">
              {label("Nothing changed this week", "noUpdateHint")}
            </div>
          </button>
          <button
            disabled={busy}
            onClick={() => setKind("UPDATE")}
            className={`${big} bg-sky-600 text-white`}
          >
            {label("Update", "update")}
            <div className="text-[11px] font-normal text-sky-100 mt-1">
              {label("Add a note or next step", "updateHint")}
            </div>
          </button>
          <button
            disabled={busy}
            onClick={() => setKind("SUPER")}
            className={`${big} bg-amber-500 text-white`}
          >
            ⭐ {label("Super Update", "superUpdate")}
            <div className="text-[11px] font-normal text-amber-50 mt-1">
              {label("Team sees it; on the exec review", "superHint")}
            </div>
          </button>
          <button
            disabled={busy}
            onClick={() => setKind("HELP")}
            className={`${big} bg-rose-600 text-white`}
          >
            🙋 {label("Help", "help")}
            <div className="text-[11px] font-normal text-rose-100 mt-1">
              {label("Ask a teammate for something", "helpHint")}
            </div>
          </button>
        </div>
        {err && <div className="mt-2 text-xs text-rose-700">{err}</div>}
      </div>
    );
  }

  const canSend =
    kind === "HELP"
      ? !!assignee && ask.trim().length > 2
      : kind === "SUPER"
        ? headline.trim().length > 2
        : note.trim() ||
          nextStep.trim() ||
          (stage && stage !== account.stage) ||
          forecast !== (account.forecastQuarter || "") ||
          Number(orderKg) > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-800">
          {kind === "UPDATE"
            ? label("Update", "update")
            : kind === "SUPER"
              ? `⭐ ${label("Super Update", "superUpdate")}`
              : `🙋 ${label("Help", "help")}`}
        </div>
        <button onClick={() => setKind(null)} className="text-xs text-slate-500 underline">
          {label("Back", "back")}
        </button>
      </div>

      {kind === "SUPER" && (
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={140}
          placeholder={label("One-line headline for the team", "headlinePh")}
          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-base font-semibold"
        />
      )}

      {kind === "HELP" && (
        <>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
          >
            <option value="">{label("Who do you need?", "whoPh")}</option>
            {team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <textarea
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              rows={3}
              placeholder={label("What do you need from them?", "askPh")}
              className="w-full rounded-lg border border-rose-300 px-3 py-3 text-base"
            />
            {speechOk && (
              <button
                type="button"
                onClick={() => toggleDictation("ask")}
                className={`absolute right-2 bottom-2 rounded-full px-2 py-1 text-xs ${listening ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                🎤
              </button>
            )}
          </div>
        </>
      )}

      <div className="relative">
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder={
            kind === "HELP"
              ? label("Anything else on the account (optional)", "notePhOpt")
              : label("What happened this week?", "notePh")
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
        />
        {speechOk && (
          <button
            type="button"
            onClick={() => toggleDictation("note")}
            className={`absolute right-2 bottom-2 rounded-full px-2 py-1 text-xs ${listening ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            🎤
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          maxLength={200}
          placeholder={label("Next step (optional)", "nextPh")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={nextStepAt}
          onChange={(e) => setNextStepAt(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => setMore(!more)}
        className="text-xs text-sky-700 underline"
      >
        {more
          ? label("Hide stage, forecast, order", "less")
          : label("Stage, forecast, order…", "more")}
      </button>
      {more && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {account.entityType !== "DISTRIBUTOR" && (
            <>
              <label className="text-xs text-slate-600">
                {label("Stage", "stage")}
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm bg-white"
                >
                  <option value="">—</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {stageLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                {label("Forecast quarter", "forecast")}
                <select
                  value={forecast}
                  onChange={(e) => setForecast(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm bg-white"
                >
                  <option value="">—</option>
                  {quarters().map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  {forecast && !quarters().includes(forecast) && (
                    <option value={forecast}>{forecast}</option>
                  )}
                </select>
              </label>
            </>
          )}
          <label className="text-xs text-slate-600">
            {label("Order / usage (kg)", "orderKg")}
            <input
              inputMode="decimal"
              value={orderKg}
              onChange={(e) => setOrderKg(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm bg-white"
            />
          </label>
          <label className="text-xs text-slate-600">
            {label("Product", "product")}
            <select
              value={orderProduct}
              onChange={(e) => setOrderProduct(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm bg-white"
            >
              {["F1", "F4", "ExpeDRY", "Gold", "Helios"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {err && <div className="text-xs text-rose-700">{err}</div>}
      <button
        disabled={busy || !canSend}
        onClick={() => submit(kind)}
        className={`w-full rounded-xl py-4 text-base font-bold text-white disabled:opacity-40 ${kind === "SUPER" ? "bg-amber-500" : kind === "HELP" ? "bg-rose-600" : "bg-sky-600"}`}
      >
        {busy
          ? "…"
          : kind === "HELP"
            ? label("Send request", "sendHelp")
            : label("Save & next", "saveNext")}
      </button>
    </div>
  );
}
