// @ts-nocheck
"use client";

/**
 * Small "+ Task" button that opens a tiny inline form. Drop onto any brand
 * detail page (or anywhere that has a brandId). Creates an OPEN CrmTask with
 * the logged-in user as owner. The cron will fire week/day reminders.
 *
 * Usage:
 *   <AddTaskButton brandId={brand.id} brandName={brand.name} onCreated={() => mutate()} />
 */

import { useState } from "react";

export default function AddTaskButton({
  brandId,
  brandName,
  onCreated,
  compact,
}: {
  brandId?: string;
  brandName?: string;
  onCreated?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState<string>(() => {
    // default: 3 days from now, 9am local
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(9, 0, 0, 0);
    return toDatetimeLocalString(d);
  });
  const [priority, setPriority] = useState("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Give it a title");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || null,
          dueAt: new Date(dueAt).toISOString(),
          brandId: brandId || null,
          priority,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Failed to create task");
      setTitle("");
      setNotes("");
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${
          compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
        } bg-[#00b4c3] hover:bg-[#009ba8] text-white rounded-md font-bold inline-flex items-center gap-1.5`}
      >
        <span>➕</span>
        <span>Task</span>
      </button>
    );
  }

  return (
    <div className="p-3 border border-[#00b4c3] bg-cyan-50/60 rounded-lg space-y-2 min-w-[260px]">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700 uppercase">
          New Task{brandName ? ` — ${brandName}` : ""}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-900 text-sm"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        maxLength={200}
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-[#00b4c3] outline-none"
        autoFocus
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-[#00b4c3] outline-none resize-y"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 uppercase font-bold mb-0.5">Due</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase font-bold mb-0.5">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </div>
      </div>

      {error && <div className="text-xs text-red-600">❌ {error}</div>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={submit}
          disabled={submitting}
          className="px-3 py-1.5 bg-[#00b4c3] hover:bg-[#009ba8] text-white rounded-md text-xs font-bold disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add task"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-2 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>

      <p className="text-[10px] text-slate-400 leading-snug">
        We&apos;ll remind you 1 week out + 1 day out via bell + email.
      </p>
    </div>
  );
}

function toDatetimeLocalString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
