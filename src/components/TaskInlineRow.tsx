"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Phase 54.5 — shared inline-editable task row.
 *
 * Used on /my-tasks, /admin/all-tasks, the project detail Tasks tab,
 * and the inline expandable rows on /admin/projects + /admin/projects/weekly.
 *
 * Features:
 *  - Checkbox to toggle DONE / OPEN
 *  - Click description → textarea, save on blur or Cmd/Ctrl+Enter
 *  - Click due date → date picker, save on change
 *  - Click assignee → user dropdown, save on selection
 *  - Priority dropdown stays inline
 *  - Diagnostic instrumentation on every onChange (console.error +
 *    window.__lastClick / __lastClickResult)
 */

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-200 text-slate-700",
  LOW: "bg-slate-100 text-slate-500",
};

export type UserLite = { id: string; name: string | null; email: string | null };

export type TaskInlineRowItem = {
  id: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assignee: UserLite | null;
  meetingNote?: { id: string; title: string } | null;
};

type Props = {
  item: TaskInlineRowItem;
  users: UserLite[];
  onPatched: (patched: TaskInlineRowItem) => void;
  onError: (msg: string) => void;
  showMeeting?: boolean;
  surfaceTag: string; // for diagnostic logs
};

export function TaskInlineRow({ item, users, onPatched, onError, showMeeting, surfaceTag }: Props) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [descDraft, setDescDraft] = useState(item.description);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDescDraft(item.description), [item.description]);

  async function patch(patchBody: any, handlerName: string) {
    const ts = new Date().toISOString();
    // DIAGNOSTIC: surface every click + every result for the
    // "checkboxes don't fire" investigation.
    // eslint-disable-next-line no-console
    console.error("[CLICK]", ts, `handler=${surfaceTag}.${handlerName}`, `id=${item.id}`, patchBody);
    if (typeof window !== "undefined") {
      (window as any).__lastClick = {
        handler: `${surfaceTag}.${handlerName}`,
        id: item.id,
        patch: patchBody,
        ts: Date.now(),
      };
    }
    try {
      const r = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      // eslint-disable-next-line no-console
      console.error("[CLICK-RESULT]", new Date().toISOString(), `ok=${r.ok}`, `status=${r.status}`);
      if (typeof window !== "undefined") {
        (window as any).__lastClickResult = { ok: r.ok, status: r.status, ts: Date.now() };
      }
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!r.ok || !d.ok) {
        const msg = d.error || `Update failed (HTTP ${r.status})`;
        onError(msg);
        // eslint-disable-next-line no-console
        console.error(`[${surfaceTag}] PATCH /api/action-items failed:`, msg, d);
        return;
      }
      onPatched({ ...item, ...patchBody, ...(d.item || {}) });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[CLICK-RESULT]", new Date().toISOString(), "threw:", e?.message);
      if (typeof window !== "undefined") {
        (window as any).__lastClickResult = { ok: false, error: e?.message, ts: Date.now() };
      }
      onError(e?.message || "Network error");
    }
  }

  async function commitDesc() {
    setEditingDesc(false);
    const trimmed = descDraft.trim();
    if (!trimmed || trimmed === item.description) return;
    await patch({ description: trimmed }, "editDescription");
  }

  return (
    <tr className="group hover:bg-slate-50">
      <td className="px-2 py-1.5 w-[36px] align-top">
        <input
          type="checkbox"
          checked={item.status === "DONE"}
          onChange={() => patch({ status: item.status === "DONE" ? "OPEN" : "DONE" }, "toggleDone")}
        />
      </td>
      <td className="px-2 py-1.5 align-top">
        {editingDesc ? (
          <textarea
            ref={descRef}
            autoFocus
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                commitDesc();
              }
              if (e.key === "Escape") {
                setDescDraft(item.description);
                setEditingDesc(false);
              }
            }}
            rows={Math.min(6, Math.max(2, Math.ceil(descDraft.length / 60)))}
            className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-md font-mono"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingDesc(true)}
            className={`text-left text-xs ${item.status === "DONE" ? "line-through text-slate-400" : "text-slate-800"} hover:bg-slate-100 rounded px-1 -mx-1 cursor-text`}
            title="Click to edit"
          >
            {item.description}
            <span className="opacity-0 group-hover:opacity-50 ml-1 text-[10px]">✏</span>
          </button>
        )}
        {showMeeting && item.meetingNote && (
          <div className="mt-0.5">
            <Link href={`/meeting-notes/${item.meetingNote.id}`} className="text-[10px] text-indigo-600 hover:underline">
              {item.meetingNote.title}
            </Link>
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 align-top w-[110px]">
        <select
          value={item.priority}
          onChange={(e) => patch({ priority: e.target.value }, "setPriority")}
          className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border-0 ${PRIORITY_STYLE[item.priority] || ""}`}
        >
          <option value="URGENT">URGENT</option>
          <option value="HIGH">HIGH</option>
          <option value="NORMAL">NORMAL</option>
          <option value="LOW">LOW</option>
        </select>
      </td>
      <td className="px-2 py-1.5 align-top w-[160px]">
        {editingAssignee ? (
          <select
            autoFocus
            value={item.assignee?.id || ""}
            onChange={async (e) => {
              setEditingAssignee(false);
              await patch({ assigneeId: e.target.value || null }, "setAssignee");
            }}
            onBlur={() => setEditingAssignee(false)}
            className="px-1 py-0.5 text-[11px] border border-indigo-300 rounded"
          >
            <option value="">— Unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setEditingAssignee(true)}
            className="text-[11px] text-slate-700 hover:bg-slate-100 rounded px-1 -mx-1"
            title="Click to reassign"
          >
            {item.assignee?.name || item.assignee?.email || <span className="text-slate-400 italic">unassigned</span>}
            <span className="opacity-0 group-hover:opacity-50 ml-1 text-[10px]">✏</span>
          </button>
        )}
      </td>
      <td className="px-2 py-1.5 align-top w-[130px]">
        {editingDue ? (
          <input
            type="date"
            autoFocus
            defaultValue={item.dueDate ? item.dueDate.slice(0, 10) : ""}
            onBlur={() => setEditingDue(false)}
            onChange={async (e) => {
              setEditingDue(false);
              await patch({ dueDate: e.target.value || null }, "setDueDate");
            }}
            className="px-1 py-0.5 text-[11px] border border-indigo-300 rounded"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingDue(true)}
            className="text-[11px] text-slate-600 hover:bg-slate-100 rounded px-1 -mx-1"
            title="Click to edit due date"
          >
            {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : <span className="text-slate-400 italic">none</span>}
            <span className="opacity-0 group-hover:opacity-50 ml-1 text-[10px]">✏</span>
          </button>
        )}
      </td>
      <td className="px-2 py-1.5 align-top w-[80px] text-[10px] text-slate-500">{item.status}</td>
    </tr>
  );
}
