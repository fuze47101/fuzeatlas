"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { STAGE_ORDER, STAGE_COLORS, STAGE_COLUMN_ACCENT, TIER_COLORS, staleness } from "@/lib/red-rover-ui";

export interface BoardTarget {
  id: string;
  name: string;
  rank: number | null;
  tier: string;
  stage: string;
  ownerName: string | null;
  nextStep: string | null;
  daysSinceActivity: number | null;
}

/**
 * Kanban board — columns = RedRoverStage, cards = targets. Drag a card to a
 * new column → optimistic move + PATCH /api/admin/red-rover/[id] (which
 * writes a STATUS_CHANGE activity and bumps lastActivityAt). On failure the
 * card snaps back.
 */
export function RedRoverBoard({
  targets,
  onReload,
}: {
  targets: BoardTarget[];
  onReload: () => void;
}) {
  const [cards, setCards] = useState<BoardTarget[]>(targets);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Keep local cards in sync when the parent reloads.
  useEffect(() => setCards(targets), [targets]);

  function onDragStart(e: DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  async function onDrop(e: DragEvent, stage: string) {
    e.preventDefault();
    setOverStage(null);
    const id = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;

    const prevStage = card.stage;
    // Optimistic move.
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)));
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/red-rover/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error(`PATCH ${res.status}`);
      onReload();
    } catch (err: any) {
      // Revert on failure.
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: prevStage } : c)));
      alert(`Could not move ${card.name}: ${err?.message || "failed"}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex gap-3" style={{ minWidth: "max-content" }}>
        {STAGE_ORDER.map((stage) => {
          const col = cards
            .filter((c) => c.stage === stage)
            .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => onDrop(e, stage)}
              className={`w-64 flex-shrink-0 rounded-lg border-t-4 bg-slate-50 p-2 ${STAGE_COLUMN_ACCENT[stage] || "border-slate-300"} ${
                overStage === stage ? "ring-2 ring-rose-400" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_COLORS[stage]}`}>
                  {stage}
                </span>
                <span className="text-xs text-slate-400">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((c) => {
                  const la = staleness(c.daysSinceActivity);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, c.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      className={`cursor-grab rounded-md border border-slate-200 bg-white p-2 shadow-sm active:cursor-grabbing ${
                        saving === c.id ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/admin/red-rover/${c.id}`}
                          className="text-sm font-semibold text-rose-700 hover:underline"
                          draggable={false}
                        >
                          {c.name}
                        </Link>
                        <span className={`rounded px-1 text-[10px] font-bold ${TIER_COLORS[c.tier] || "bg-slate-300"}`}>
                          {c.rank ?? "—"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{c.ownerName || "Unassigned"}</div>
                      <div className={`text-[11px] ${la.cls}`}>{la.text}</div>
                      {c.nextStep && (
                        <div className="mt-1 line-clamp-2 text-[11px] text-slate-600" title={c.nextStep}>
                          → {c.nextStep}
                        </div>
                      )}
                    </div>
                  );
                })}
                {col.length === 0 && (
                  <div className="rounded border border-dashed border-slate-200 py-4 text-center text-[11px] text-slate-300">
                    drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
