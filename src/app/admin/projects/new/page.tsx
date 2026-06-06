"use client";

import { useEffect, useState, useMemo, Component, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/**
 * Wrap the page in Suspense (Next.js 15 routinely warns on
 * useSearchParams in a client component without one) + an error
 * boundary that surfaces the actual render failure instead of a
 * blank page so the "Add Project button doesn't navigate"
 * symptom can be diagnosed in a single screenshot.
 */
class WizardErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error("[/admin/projects/new] render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-900">Project wizard failed to render</h1>
            <p className="mt-2 text-sm text-rose-800">{this.state.error.message}</p>
            <pre className="mt-3 whitespace-pre-wrap text-[10px] text-rose-700 bg-white border border-rose-200 rounded p-2 max-h-[40vh] overflow-auto">{this.state.error.stack}</pre>
            <p className="mt-3 text-xs text-rose-700">
              This error replaces the previous blank-page failure mode. Screenshot this and
              share so the cause can be fixed.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type ProjectType = "BRAND" | "FACTORY" | "DISTRIBUTOR" | "INTERNAL";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface Lookup {
  id: string;
  name: string;
}
interface UserLite {
  id: string;
  name: string | null;
  email: string | null;
  role?: string;
}
interface TaskRow {
  description: string;
  assigneeId: string;
  priority: Priority;
  dueDate: string;
}

// Phase 60 (Tina cmpvydmti0007jt04m68cloe4 — "access to add task to
// projects"). TESTING_MANAGER + FABRIC_MANAGER added so Tina + the
// lab manager pool can use the project wizard.
const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "TESTING_MANAGER", "FABRIC_MANAGER"]);
const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function offsetDateISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextFridayISO(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const delta = (5 - day + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function endOfWeekISO(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const delta = (5 - day + 7) % 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const EMPTY_TASK: TaskRow = { description: "", assigneeId: "", priority: "NORMAL", dueDate: "" };

export default function ProjectStartWizardPageOuter() {
  return (
    <WizardErrorBoundary>
      <ProjectStartWizardPage />
    </WizardErrorBoundary>
  );
}

function ProjectStartWizardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [brandId, setBrandId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [goalMd, setGoalMd] = useState("");
  const [tasks, setTasks] = useState<TaskRow[]>([{ ...EMPTY_TASK }, { ...EMPTY_TASK }, { ...EMPTY_TASK }]);
  const [brands, setBrands] = useState<Lookup[]>([]);
  const [factories, setFactories] = useState<Lookup[]>([]);
  const [distributors, setDistributors] = useState<Lookup[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    projectId: string;
    kickoffMeetingNoteId: string;
    actionItemCount: number;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !ALLOWED.has(user.role)) router.replace("/home");
  }, [user, loading, router]);

  // Load lookups
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => setBrands((d.brands || []).map((b: any) => ({ id: b.id, name: b.name }))))
      .catch(() => {});
    fetch("/api/factories")
      .then((r) => r.json())
      .then((d) => setFactories((d.factories || []).map((f: any) => ({ id: f.id, name: f.name }))))
      .catch(() => {});
    fetch("/api/distributors")
      .then((r) => r.json())
      .then((d) => setDistributors((d.distributors || []).map((x: any) => ({ id: x.id, name: x.name }))))
      .catch(() => {});
    fetch("/api/settings/users")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.users || []).filter((u: any) =>
          ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "TESTING_MANAGER", "FABRIC_MANAGER"].includes(u.role),
        );
        setUsers(list);
      })
      .catch(() => {});
  }, []);

  // Pre-fill via query params (e.g. opened from /admin/brand-pipeline?brandId=...).
  // Read straight from window.location.search to avoid useSearchParams,
  // which triggers Next.js 15's "Suspense required" warning and
  // sometimes blanks the page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qBrand = params.get("brandId");
    const qFactory = params.get("factoryId");
    const qType = (params.get("type") || "").toUpperCase() as ProjectType | "";
    if (qBrand) { setProjectType("BRAND"); setBrandId(qBrand); setStep(3); }
    else if (qFactory) { setProjectType("FACTORY"); setFactoryId(qFactory); setStep(3); }
    else if (qType === "BRAND" || qType === "FACTORY" || qType === "INTERNAL") {
      setProjectType(qType);
      setStep(qType === "INTERNAL" ? 3 : 2);
    }
  }, []);

  // Auto-suggest project name + default owner once enough context is set
  useEffect(() => {
    if (name) return;
    let suggestion = "";
    if (projectType === "BRAND" && brandId) {
      const b = brands.find((x) => x.id === brandId);
      if (b) suggestion = `${b.name} — ${new Date().toLocaleString("default", { month: "short", year: "numeric" })}`;
    } else if (projectType === "FACTORY" && factoryId) {
      const f = factories.find((x) => x.id === factoryId);
      if (f) suggestion = `${f.name} — ${new Date().toLocaleString("default", { month: "short", year: "numeric" })}`;
    }
    if (suggestion) setName(suggestion);
  }, [projectType, brandId, factoryId, brands, factories]); // eslint-disable-line

  useEffect(() => {
    if (ownerId) return;
    if (user) setOwnerId(user.id);
  }, [user, ownerId]);

  const stepValid = useMemo(() => {
    if (step === 1) return !!projectType;
    if (step === 2)
      return (
        projectType === "INTERNAL" ||
        (projectType === "BRAND" && !!brandId) ||
        (projectType === "FACTORY" && !!factoryId) ||
        (projectType === "DISTRIBUTOR" && !!distributorId)
      );
    if (step === 3) return !!name.trim() && !!ownerId;
    return true;
  }, [step, projectType, brandId, factoryId, distributorId, name, ownerId]);

  const nonEmptyTasks = tasks.filter((t) => t.description.trim().length > 0);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: any = {
        name: name.trim(),
        projectType,
        ownerId,
        goalMd: goalMd || undefined,
        initialTasks: nonEmptyTasks.map((t) => ({
          description: t.description.trim(),
          assigneeId: t.assigneeId || ownerId,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        })),
      };
      if (projectType === "BRAND") body.brandId = brandId;
      if (projectType === "FACTORY") body.factoryId = factoryId;
      if (projectType === "DISTRIBUTOR") body.distributorId = distributorId;
      const r = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "Create failed"); return; }
      setResult({ projectId: d.projectId, kickoffMeetingNoteId: d.kickoffMeetingNoteId, actionItemCount: d.actionItemCount });
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  function updateTask(i: number, patch: Partial<TaskRow>) {
    setTasks((arr) => arr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function removeTask(i: number) {
    setTasks((arr) => arr.filter((_, idx) => idx !== i));
  }
  function addTask() {
    setTasks((arr) => [...arr, { ...EMPTY_TASK }]);
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-xl font-semibold text-emerald-900">Project created</h1>
          <p className="mt-2 text-sm text-emerald-800">
            <strong>{name}</strong> — {result.actionItemCount} initial task(s) created. Kickoff
            meeting note seeded with the goal narrative.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href={`/admin/projects/${result.projectId}`}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              Open project
            </Link>
            <Link
              href={`/meeting-notes/${result.kickoffMeetingNoteId}`}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm rounded-md hover:bg-slate-50"
            >
              Open kickoff note
            </Link>
            <Link
              href="/admin/projects/new"
              onClick={() => router.refresh()}
              className="px-3 py-1.5 text-slate-700 text-sm hover:underline"
            >
              Start another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Step {step} of 5 — {step === 1 ? "Customer type" : step === 2 ? "Pick entity" : step === 3 ? "Name + owner + goal" : step === 4 ? "Initial tasks" : "Review"}
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { type: "BRAND" as const, icon: "🏷", label: "Brand", desc: "Brand customer that sells finished consumer products. e.g., Nike, North Face, Lululemon. (OEM/middlemen like MMI also go here — tag the brand record with subtype=OEM.)" },
            { type: "FACTORY" as const, icon: "🏭", label: "Factory", desc: "Manufacturing partner that produces fabric or treated products. e.g., Penfabric, Hurricane, Welspun." },
            { type: "DISTRIBUTOR" as const, icon: "🤝", label: "Distributor", desc: "Sales channel partner reselling FUZE chemistry. e.g., Harris & Menuk, SRS, Texwell." },
            ...(user?.role === "ADMIN"
              ? [{ type: "INTERNAL" as const, icon: "🔬", label: "Internal (admin)", desc: "FUZE-internal initiative without an external customer. e.g., Project Red Rover, Patriots, R&D, Lab Build. Admin-only — not surfaced to brand/factory/distributor users." }]
              : []),
          ].map((c) => (
            <button
              key={c.type}
              onClick={() => setProjectType(c.type)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                projectType === c.type
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="font-semibold text-slate-900 mb-1">{c.label}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{c.desc}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && projectType === "BRAND" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Brand</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">— Pick a brand —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {brandId && (
            <div className="text-xs text-slate-500">
              Selected: <strong className="text-slate-900">{brands.find((b) => b.id === brandId)?.name}</strong>
            </div>
          )}
        </div>
      )}

      {step === 2 && projectType === "FACTORY" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Factory</label>
          <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">— Pick a factory —</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {factoryId && (
            <div className="text-xs text-slate-500">
              Selected: <strong className="text-slate-900">{factories.find((f) => f.id === factoryId)?.name}</strong>
            </div>
          )}
        </div>
      )}

      {step === 2 && projectType === "DISTRIBUTOR" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Distributor</label>
          <select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">— Pick a distributor —</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {distributorId && (
            <div className="text-xs text-slate-500">
              Selected: <strong className="text-slate-900">{distributors.find((d) => d.id === distributorId)?.name}</strong>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project name <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KUIU Performance Fabric F1 Trial" required className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Owner <span className="text-red-500">*</span></label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} {u.role ? `(${u.role})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Goal — internal hit list (optional)</label>
            <textarea
              value={goalMd}
              onChange={(e) => setGoalMd(e.target.value)}
              rows={12}
              placeholder="Internal-only narrative. Why we're doing this, what success looks like, who needs to be involved, what we're not committing to. Different from the customer-facing SOW. Markdown supported."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Initial tasks</h2>
          <p className="text-xs text-slate-500">Empty rows on submit are ignored. No @mention parsing here — pure form data.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left w-1/3">Description</th>
                  <th className="px-2 py-1.5 text-left">Assignee</th>
                  <th className="px-2 py-1.5 text-left">Priority</th>
                  <th className="px-2 py-1.5 text-left">Due date</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">
                      <input value={t.description} onChange={(e) => updateTask(i, { description: e.target.value })} placeholder="Task description" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
                    </td>
                    <td className="px-2 py-1">
                      <select value={t.assigneeId} onChange={(e) => updateTask(i, { assigneeId: e.target.value })} className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs">
                        <option value="">— Defaults to owner —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select value={t.priority} onChange={(e) => updateTask(i, { priority: e.target.value as Priority })} className="px-1.5 py-1 border border-slate-200 rounded text-xs">
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input type="date" value={t.dueDate} onChange={(e) => updateTask(i, { dueDate: e.target.value })} className="px-1.5 py-1 border border-slate-200 rounded text-xs" />
                      <div className="mt-1 flex gap-1 text-[10px]">
                        <button type="button" onClick={() => updateTask(i, { dueDate: todayISO() })} className="text-indigo-600 hover:underline">today</button>
                        <button type="button" onClick={() => updateTask(i, { dueDate: endOfWeekISO() })} className="text-indigo-600 hover:underline">EOW</button>
                        <button type="button" onClick={() => updateTask(i, { dueDate: nextFridayISO() })} className="text-indigo-600 hover:underline">next Fri</button>
                        <button type="button" onClick={() => updateTask(i, { dueDate: offsetDateISO(7) })} className="text-indigo-600 hover:underline">+1w</button>
                        <button type="button" onClick={() => updateTask(i, { dueDate: offsetDateISO(14) })} className="text-indigo-600 hover:underline">+2w</button>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button type="button" onClick={() => removeTask(i)} className="text-rose-600 text-xs hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addTask} className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50">+ Add task</button>
        </div>
      )}

      {step === 5 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Review</h2>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Type</dt><dd className="text-slate-900">{projectType}</dd></div>
            {projectType === "BRAND" && <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Brand</dt><dd className="text-slate-900">{brands.find((b) => b.id === brandId)?.name || "—"}</dd></div>}
            {projectType === "FACTORY" && <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Factory</dt><dd className="text-slate-900">{factories.find((f) => f.id === factoryId)?.name || "—"}</dd></div>}
            {projectType === "DISTRIBUTOR" && <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Distributor</dt><dd className="text-slate-900">{distributors.find((d) => d.id === distributorId)?.name || "—"}</dd></div>}
            <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Name</dt><dd className="text-slate-900">{name}</dd></div>
            <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Owner</dt><dd className="text-slate-900">{users.find((u) => u.id === ownerId)?.name || ownerId}</dd></div>
            <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Goal</dt><dd className="text-slate-900 whitespace-pre-wrap">{goalMd || <span className="text-slate-400">(none)</span>}</dd></div>
            <div className="py-1.5 grid grid-cols-[180px_1fr]"><dt className="text-slate-600">Initial tasks</dt><dd className="text-slate-900">{nonEmptyTasks.length}</dd></div>
          </dl>
          {nonEmptyTasks.length > 0 && (
            <ul className="text-xs text-slate-700 space-y-1">
              {nonEmptyTasks.map((t, i) => (
                <li key={i}>• {t.description} — <span className="text-slate-500">{t.priority}</span>{t.dueDate ? `, due ${t.dueDate}` : ""}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin/projects" className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50">Cancel</Link>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - (s === 3 && projectType === "INTERNAL" ? 2 : 1)))}
              className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Back
            </button>
          )}
        </div>
        {step < 5 ? (
          <button
            type="button"
            disabled={!stepValid}
            onClick={() => {
              if (step === 1 && projectType === "INTERNAL") setStep(3);
              else setStep((s) => s + 1);
            }}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Project"}
          </button>
        )}
      </div>
    </div>
  );
}
