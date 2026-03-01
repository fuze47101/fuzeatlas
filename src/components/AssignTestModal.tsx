"use client";
import { useState, useEffect } from "react";
import SearchableSelect, { type SelectOption } from "./SearchableSelect";
import CreateInlineForm from "./CreateInlineForm";

interface AssignTestModalProps {
  testId: string;
  testType: string;
  currentBrand?: string | null;
  currentFactory?: string | null;
  currentProject?: string | null;
  onClose: () => void;
  onAssigned: () => void;  // refresh parent
}

export default function AssignTestModal({
  testId,
  testType,
  currentBrand,
  currentFactory,
  currentProject,
  onClose,
  onAssigned,
}: AssignTestModalProps) {
  const [brands, setBrands] = useState<SelectOption[]>([]);
  const [factories, setFactories] = useState<SelectOption[]>([]);
  const [fabrics, setFabrics] = useState<SelectOption[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<string | null>(null);
  const [factoryName, setFactoryName] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [fabricName, setFabricName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const [creating, setCreating] = useState<"brand" | "factory" | "fabric" | null>(null);
  const [createPrefill, setCreatePrefill] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load entities
  useEffect(() => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/factories").then((r) => r.json()),
      fetch("/api/fabrics").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([bData, fData, faData, pData]) => {
      // Brands come grouped by stage — flatten
      if (bData.ok && bData.grouped) {
        const all: SelectOption[] = [];
        for (const stage of Object.values(bData.grouped) as any[]) {
          for (const b of stage) {
            all.push({ id: b.id, name: b.name, detail: b.pipelineStage });
          }
        }
        all.sort((a, b) => a.name.localeCompare(b.name));
        setBrands(all);
      }

      if (fData.ok && fData.factories) {
        setFactories(
          fData.factories.map((f: any) => ({
            id: f.id,
            name: f.name,
            detail: f.country || undefined,
          }))
        );
      }

      if (faData.ok && faData.fabrics) {
        setFabrics(
          faData.fabrics.map((f: any) => {
            const parts: string[] = [];
            if (f.fuzeNumber) parts.push(`FUZE-${f.fuzeNumber}`);
            if (f.customerCode) parts.push(f.customerCode);
            if (f.factoryCode && !f.customerCode) parts.push(f.factoryCode);
            const name = parts.length > 0 ? parts.join(" / ") : f.id.slice(0, 8);
            const details: string[] = [];
            if (f.construction) details.push(f.construction);
            if (f.color) details.push(f.color);
            if (f.brand) details.push(f.brand);
            return {
              id: f.id,
              name,
              detail: details.join(" · ") || undefined,
            };
          })
        );
      }

      if (pData.ok && pData.projects) {
        setProjects(
          pData.projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            detail: p.brandName ? `Brand: ${p.brandName}` : undefined,
          }))
        );
      }
    });
  }, []);

  const handleSave = async () => {
    if (!brandId && !factoryId && !fabricId && !projectId) {
      setError("Select at least one of project, brand, factory, or fabric");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, factoryId, fabricId, projectId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Assignment failed");
        return;
      }
      onAssigned();
      onClose();
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setProjectSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), brandId: brandId || null }),
      });
      const data = await res.json();
      if (data.ok && data.project) {
        const p = data.project;
        setProjectId(p.id);
        setProjectName(p.name);
        setProjects((prev) => [...prev, { id: p.id, name: p.name }]);
        setCreatingProject(false);
        setNewProjectName("");
      }
    } catch {
      // silent
    } finally {
      setProjectSaving(false);
    }
  };

  const handleEntityCreated = (type: "brand" | "factory" | "fabric", entity: { id: string; name: string }) => {
    if (type === "brand") {
      setBrandId(entity.id);
      setBrandName(entity.name);
      setBrands((prev) => [...prev, { id: entity.id, name: entity.name }]);
    } else if (type === "factory") {
      setFactoryId(entity.id);
      setFactoryName(entity.name);
      setFactories((prev) => [...prev, { id: entity.id, name: entity.name }]);
    } else {
      setFabricId(entity.id);
      setFabricName(entity.name);
      setFabrics((prev) => [...prev, { id: entity.id, name: entity.name }]);
    }
    setCreating(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Assign Test
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {testType} test{currentBrand ? ` — ${currentBrand}` : ""}
                {currentFactory ? ` / ${currentFactory}` : ""}
                {currentProject ? ` · Project: ${currentProject}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Project — highlighted section */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <SearchableSelect
              label="Project"
              options={projects}
              value={projectId}
              displayValue={projectName}
              onChange={(id, name) => { setProjectId(id); setProjectName(name); }}
              onCreateNew={(text) => { setCreatingProject(true); setNewProjectName(text); }}
              placeholder="Search projects..."
              createLabel="Project"
            />
            {creatingProject && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. Nike Dri-FIT 2026"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleCreateProject}
                  disabled={projectSaving || !newProjectName.trim()}
                  className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {projectSaving ? "..." : "Create"}
                </button>
                <button
                  onClick={() => { setCreatingProject(false); setNewProjectName(""); }}
                  className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Brand */}
          <SearchableSelect
            label="Brand"
            options={brands}
            value={brandId}
            displayValue={brandName}
            onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
            onCreateNew={(text) => { setCreating("brand"); setCreatePrefill(text); }}
            placeholder="Search brands..."
            createLabel="Brand"
          />
          {creating === "brand" && (
            <CreateInlineForm
              entityType="brand"
              prefillName={createPrefill}
              onCreated={(e) => handleEntityCreated("brand", e)}
              onCancel={() => setCreating(null)}
            />
          )}

          {/* Factory */}
          <SearchableSelect
            label="Factory"
            options={factories}
            value={factoryId}
            displayValue={factoryName}
            onChange={(id, name) => { setFactoryId(id); setFactoryName(name); }}
            onCreateNew={(text) => { setCreating("factory"); setCreatePrefill(text); }}
            placeholder="Search factories..."
            createLabel="Factory"
          />
          {creating === "factory" && (
            <CreateInlineForm
              entityType="factory"
              prefillName={createPrefill}
              onCreated={(e) => handleEntityCreated("factory", e)}
              onCancel={() => setCreating(null)}
            />
          )}

          {/* Fabric */}
          <SearchableSelect
            label="Fabric"
            options={fabrics}
            value={fabricId}
            displayValue={fabricName}
            onChange={(id, name) => { setFabricId(id); setFabricName(name); }}
            onCreateNew={(text) => { setCreating("fabric"); setCreatePrefill(text); }}
            placeholder="Search fabrics..."
            createLabel="Fabric"
          />
          {creating === "fabric" && (
            <CreateInlineForm
              entityType="fabric"
              prefillName={createPrefill}
              onCreated={(e) => handleEntityCreated("fabric", e)}
              onCancel={() => setCreating(null)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!brandId && !factoryId && !fabricId && !projectId)}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
