"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  PROJECT_STAGES,
  FUZE_TIERS_COMMERCIAL,
  formatMoney,
} from "@/lib/revenue-calc";

type Project = {
  id: string;
  name: string;
  brand: string | null;
  brandId: string | null;
  factory: string | null;
  factoryCountry: string | null;
  distributor: string | null;
  projectedValue: number | null;
  actualValue: number | null;
  probability: number;
  fuzeTier: string | null;
  annualVolumeMeters: number | null;
  annualFuzeLiters: number | null;
  expectedProductionDate: string | null;
  actualProductionDate: string | null;
  currency: string;
};

type PipelineStage = {
  stage: string;
  count: number;
  totalValue: number;
  weightedForecast: number;
  avgProbability: number;
  projects: Project[];
};

/* ── Stage column colors ────────────────────────── */
const STAGE_COLORS: Record<string, string> = {
  DEVELOPMENT: "border-slate-300 bg-slate-50",
  SAMPLING: "border-blue-300 bg-blue-50",
  TESTING: "border-violet-300 bg-violet-50",
  APPROVED: "border-amber-300 bg-amber-50",
  COMMERCIALIZATION: "border-orange-300 bg-orange-50",
  PRODUCTION: "border-emerald-300 bg-emerald-50",
  COMPLETE: "border-green-300 bg-green-50",
};

const PROB_COLORS = (p: number) =>
  p >= 70 ? "bg-emerald-500" : p >= 40 ? "bg-amber-400" : "bg-red-400";

/* ── Deal Card ────────────────────────── */
function DealCard({ project, onEdit }: { project: Project; onEdit: (p: Project) => void }) {
  return (
    <div
      onClick={() => onEdit(project)}
      className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md cursor-pointer transition-all"
    >
      <div className="flex justify-between items-start mb-1.5">
        <h4 className="text-sm font-semibold text-slate-900 truncate flex-1">{project.name}</h4>
        {project.fuzeTier && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-teal-100 text-teal-700">
            {project.fuzeTier}
          </span>
        )}
      </div>

      {project.brand && (
        <p className="text-xs text-slate-500 mb-1.5">{project.brand}</p>
      )}

      {project.projectedValue != null && (
        <div className="text-base font-bold text-slate-900 mb-1">
          {formatMoney(project.projectedValue)}
          <span className="text-xs font-normal text-slate-400 ml-1">{project.currency}</span>
        </div>
      )}

      {/* Probability bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${PROB_COLORS(project.probability)}`}
            style={{ width: `${project.probability}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-slate-500">{project.probability}%</span>
      </div>

      <div className="flex flex-wrap gap-1 text-[10px]">
        {project.factory && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {project.factory}{project.factoryCountry ? ` (${project.factoryCountry})` : ""}
          </span>
        )}
        {project.distributor && (
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
            {project.distributor}
          </span>
        )}
      </div>

      {project.expectedProductionDate && (
        <p className="text-[10px] text-slate-400 mt-1">
          Prod: {new Date(project.expectedProductionDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

/* ── Edit Modal ────────────────────────── */
function EditModal({
  project,
  brands,
  factories,
  distributors,
  onClose,
  onSave,
}: {
  project: Project;
  brands: { id: string; name: string }[];
  factories: { id: string; name: string }[];
  distributors: { id: string; name: string }[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    stage: "",
    brandId: project.brandId || "",
    projectedValue: project.projectedValue?.toString() || "",
    probability: project.probability.toString(),
    fuzeTier: project.fuzeTier || "",
    annualVolumeMeters: project.annualVolumeMeters?.toString() || "",
    factoryId: "",
    distributorId: "",
    expectedProductionDate: project.expectedProductionDate?.slice(0, 10) || "",
    actualProductionDate: project.actualProductionDate?.slice(0, 10) || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        onSave();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Project: {project.name}</h3>

        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500">Project Name</label>
            <input className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Stage</label>
            <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
              <option value="">Keep current</option>
              {PROJECT_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Brand</label>
            <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
              <option value="">None</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Projected Value ($)</label>
            <input type="number" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.projectedValue} onChange={(e) => set("projectedValue", e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Probability (%)</label>
            <input type="number" min="0" max="100" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.probability} onChange={(e) => set("probability", e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">FUZE Tier</label>
            <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.fuzeTier} onChange={(e) => set("fuzeTier", e.target.value)}>
              <option value="">None</option>
              {Object.values(FUZE_TIERS_COMMERCIAL).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Annual Volume (m)</label>
            <input type="number" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.annualVolumeMeters} onChange={(e) => set("annualVolumeMeters", e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Factory</label>
            <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.factoryId} onChange={(e) => set("factoryId", e.target.value)}>
              <option value="">None</option>
              {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Distributor</label>
            <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.distributorId} onChange={(e) => set("distributorId", e.target.value)}>
              <option value="">Auto from factory</option>
              {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Expected Production</label>
            <input type="date" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.expectedProductionDate} onChange={(e) => set("expectedProductionDate", e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Actual Production</label>
            <input type="date" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.actualProductionDate} onChange={(e) => set("actualProductionDate", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Pipeline Page ────────────────────────── */
export default function PipelinePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/pipeline").then((r) => r.json()),
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/factories").then((r) => r.json()),
      fetch("/api/distributors").then((r) => r.json()),
    ])
      .then(([pj, bj, fj, dj]) => {
        if (pj.ok) {
          setPipeline(pj.pipeline);
          setSummary(pj.summary);
        }
        if (bj.ok) setBrands(bj.brands || []);
        if (fj.ok) setFactories(fj.factories || []);
        if (dj.ok) setDistributors(dj.distributors || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const j = await res.json();
      if (j.ok) {
        setNewName("");
        setShowCreate(false);
        load();
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading pipeline...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track deals from development to production</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          + New Deal
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Total Pipeline</p>
            <p className="text-2xl font-bold text-slate-900">{formatMoney(summary.totalPipeline)}</p>
            <p className="text-xs text-slate-400">{summary.totalProjects} deals</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Weighted Forecast</p>
            <p className="text-2xl font-bold text-emerald-600">{formatMoney(summary.weightedForecast)}</p>
            <p className="text-xs text-slate-400">Probability-adjusted</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Actual Revenue</p>
            <p className="text-2xl font-bold text-blue-600">{formatMoney(summary.actualRevenue)}</p>
            <p className="text-xs text-slate-400">Invoiced & paid</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Conversion</p>
            <p className="text-2xl font-bold text-amber-600">
              {summary.totalPipeline > 0
                ? `${Math.round((summary.actualRevenue / summary.totalPipeline) * 100)}%`
                : "—"}
            </p>
            <p className="text-xs text-slate-400">Actual / Pipeline</p>
          </div>
        </div>
      )}

      {/* Pipeline Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {pipeline.map((stage) => {
            const stageInfo = PROJECT_STAGES.find((s) => s.id === stage.stage);
            return (
              <div
                key={stage.stage}
                className={`flex-shrink-0 w-64 rounded-xl border-2 ${STAGE_COLORS[stage.stage] || "border-slate-200 bg-white"}`}
              >
                {/* Column header */}
                <div className="px-3 pt-3 pb-2 border-b border-slate-200/50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">{stageInfo?.label || stage.stage}</h3>
                    <span className="text-xs font-medium text-slate-500 bg-white rounded-full px-2 py-0.5">
                      {stage.count}
                    </span>
                  </div>
                  {stage.totalValue > 0 && (
                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold">{formatMoney(stage.totalValue)}</span>
                      <span className="text-slate-400"> · wt: {formatMoney(stage.weightedForecast)}</span>
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {stage.projects.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No deals</p>
                  )}
                  {stage.projects.map((p) => (
                    <DealCard key={p.id} project={p} onEdit={setEditProject} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {editProject && (
        <EditModal
          project={editProject}
          brands={brands}
          factories={factories}
          distributors={distributors}
          onClose={() => setEditProject(null)}
          onSave={load}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-3">New Deal</h3>
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
              placeholder="Project / Deal name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
