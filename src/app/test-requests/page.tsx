"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Lab { id: string; name: string; customerNumber?: string; }
interface Brand { id: string; name: string; }
interface FabricOption { id: string; fuzeNumber?: number; customerCode?: string; construction?: string; weightGsm?: number; }
interface ProjectOption { id: string; name: string; }
interface SOWOption { id: string; title?: string; brand?: { name: string }; }
interface LabService { id: string; testType: string; testMethod?: string; description?: string; priceUSD?: number; listPriceUSD?: number; turnaroundDays?: number; rushPriceUSD?: number; rushDays?: number; }

interface LineItem {
  testType: string;
  testMethod: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  rush: boolean;
  rushPrice: number | null;
  estimatedDays: number | null;
  notes: string;
}

interface TestRequestLine {
  id: string;
  testType: string;
  testMethod?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  rush: boolean;
  rushPrice?: number;
  estimatedDays?: number;
  status: string;
  testRunId?: string;
  testRun?: { id: string; testReportNumber?: string; testDate?: string };
  notes?: string;
}

interface TestRequest {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  priority: string;
  brandId?: string;
  brand?: { id: string; name: string };
  fabricId?: string;
  fabric?: { id: string; fuzeNumber?: number; customerCode?: string; construction?: string; weightGsm?: number };
  labId: string;
  lab?: { id: string; name: string; customerNumber?: string };
  projectId?: string;
  project?: { id: string; name: string };
  sowId?: string;
  sow?: { id: string; title?: string };
  fuzeFabricNumber?: string;
  customerFabricCode?: string;
  labCustomerNumber?: string;
  estimatedCost?: number;
  actualCost?: number;
  currency: string;
  requestedBy?: { id: string; name: string };
  requestedAt?: string;
  approvedBy?: { id: string; name: string };
  approvedAt?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  requestedCompletionDate?: string;
  specialInstructions?: string;
  internalNotes?: string;
  lines: TestRequestLine[];
  createdAt: string;
}

const TEST_TYPES = ["ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER"];
const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"];

const STATUS_FLOW = [
  { key: "DRAFT", label: "Draft", color: "bg-slate-100 text-slate-700" },
  { key: "PENDING_APPROVAL", label: "Pending Approval", color: "bg-amber-100 text-amber-800" },
  { key: "APPROVED", label: "Approved", color: "bg-emerald-100 text-emerald-800" },
  { key: "SUBMITTED", label: "Submitted to Lab", color: "bg-blue-100 text-blue-800" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-indigo-100 text-indigo-800" },
  { key: "RESULTS_RECEIVED", label: "Results Received", color: "bg-purple-100 text-purple-800" },
  { key: "COMPLETE", label: "Complete", color: "bg-green-100 text-green-800" },
  { key: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-800 border-red-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  NORMAL: "bg-slate-100 text-slate-700 border-slate-300",
  LOW: "bg-slate-50 text-slate-500 border-slate-200",
};

function statusColor(status: string) {
  return STATUS_FLOW.find((s) => s.key === status)?.color || "bg-slate-100 text-slate-700";
}
function statusLabel(status: string) {
  return STATUS_FLOW.find((s) => s.key === status)?.label || status;
}

export default function TestRequestsPage() {
  const [requests, setRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Record<string, { count: number; totalCost: number }>>({});

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [fabrics, setFabrics] = useState<FabricOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sows, setSOWs] = useState<SOWOption[]>([]);
  const [labServices, setLabServices] = useState<LabService[]>([]);

  // Create form fields
  const [createLabId, setCreateLabId] = useState("");
  const [createBrandId, setCreateBrandId] = useState("");
  const [createFabricId, setCreateFabricId] = useState("");
  const [createProjectId, setCreateProjectId] = useState("");
  const [createSowId, setCreateSowId] = useState("");
  const [createPriority, setCreatePriority] = useState("NORMAL");
  const [createCompletionDate, setCreateCompletionDate] = useState("");
  const [createInstructions, setCreateInstructions] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createLines, setCreateLines] = useState<LineItem[]>([
    { testType: "ANTIBACTERIAL", testMethod: "", description: "", quantity: 1, unitPrice: null, rush: false, rushPrice: null, estimatedDays: null, notes: "" },
  ]);
  const [creating, setCreating] = useState(false);

  // Load requests
  const loadRequests = async () => {
    try {
      const params = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/test-requests${params}`);
      const d = await res.json();
      if (d.ok) {
        setRequests(d.requests);
        setStats(d.stats);
      }
    } catch {
      setError("Failed to load test requests");
    } finally {
      setLoading(false);
    }
  };

  // Load reference data for create form
  const loadReferenceData = async () => {
    try {
      const [labsRes, brandsRes, fabricsRes, projectsRes, sowsRes] = await Promise.all([
        fetch("/api/labs").then((r) => r.json()),
        fetch("/api/brands").then((r) => r.json()),
        fetch("/api/fabrics").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/sow").then((r) => r.json()),
      ]);
      setLabs(labsRes.labs || labsRes || []);
      setBrands(brandsRes.brands || brandsRes || []);
      setFabrics(fabricsRes.fabrics || fabricsRes || []);
      setProjects(projectsRes.projects || projectsRes || []);
      setSOWs(sowsRes.sows || sowsRes || []);
    } catch {
      // Silently fail — dropdowns will be empty
    }
  };

  // Load lab services when lab changes
  useEffect(() => {
    if (createLabId) {
      fetch(`/api/labs/${createLabId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.lab?.services) {
            setLabServices(d.lab.services);
            // Auto-fill pricing on existing lines
            setCreateLines((prev) =>
              prev.map((line) => {
                const svc = d.lab.services.find(
                  (s: LabService) => s.testType === line.testType && (!line.testMethod || s.testMethod === line.testMethod)
                );
                if (svc) {
                  return {
                    ...line,
                    unitPrice: svc.priceUSD ?? line.unitPrice,
                    estimatedDays: svc.turnaroundDays ?? line.estimatedDays,
                    testMethod: line.testMethod || svc.testMethod || "",
                  };
                }
                return line;
              })
            );
          }
        })
        .catch(() => {});
    } else {
      setLabServices([]);
    }
  }, [createLabId]);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  // Handle workflow actions
  const handleAction = async (id: string, action: string, extra?: Record<string, any>) => {
    setProcessing(id);
    setError("");
    try {
      const res = await fetch(`/api/test-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (d.ok) {
        setSuccess(d.message || "Action completed");
        setTimeout(() => setSuccess(""), 5000);
        loadRequests();
      } else {
        setError(d.error);
      }
    } catch {
      setError("Failed to process action");
    } finally {
      setProcessing(null);
    }
  };

  // Handle create
  const handleCreate = async () => {
    if (!createLabId) { setError("Select a lab"); return; }
    if (createLines.length === 0) { setError("Add at least one test"); return; }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/test-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: createLabId,
          brandId: createBrandId || null,
          fabricId: createFabricId || null,
          projectId: createProjectId || null,
          sowId: createSowId || null,
          priority: createPriority,
          requestedCompletionDate: createCompletionDate || null,
          specialInstructions: createInstructions || null,
          internalNotes: createNotes || null,
          lines: createLines,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setSuccess(`Test request created: ${d.poNumber}`);
        setTimeout(() => setSuccess(""), 8000);
        setShowCreate(false);
        resetCreateForm();
        loadRequests();
      } else {
        setError(d.error);
      }
    } catch {
      setError("Network error creating test request");
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateLabId("");
    setCreateBrandId("");
    setCreateFabricId("");
    setCreateProjectId("");
    setCreateSowId("");
    setCreatePriority("NORMAL");
    setCreateCompletionDate("");
    setCreateInstructions("");
    setCreateNotes("");
    setCreateLines([{ testType: "ANTIBACTERIAL", testMethod: "", description: "", quantity: 1, unitPrice: null, rush: false, rushPrice: null, estimatedDays: null, notes: "" }]);
  };

  const addLine = () => {
    setCreateLines([...createLines, { testType: "ICP", testMethod: "", description: "", quantity: 1, unitPrice: null, rush: false, rushPrice: null, estimatedDays: null, notes: "" }]);
  };

  const updateLine = (idx: number, field: string, value: any) => {
    setCreateLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };

      // Auto-fill pricing when test type changes
      if (field === "testType" && createLabId) {
        const svc = labServices.find((s) => s.testType === value);
        if (svc) {
          updated.unitPrice = svc.priceUSD ?? null;
          updated.estimatedDays = svc.turnaroundDays ?? null;
          updated.testMethod = svc.testMethod || "";
        }
      }
      return updated;
    }));
  };

  const removeLine = (idx: number) => {
    setCreateLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalEstimate = createLines.reduce((sum, l) => {
    const base = (l.unitPrice || 0) * l.quantity;
    const rush = l.rush ? (l.rushPrice || 0) : 0;
    return sum + base + rush;
  }, 0);

  // Stats summary
  const totalPending = stats["PENDING_APPROVAL"]?.count || 0;
  const totalApproved = stats["APPROVED"]?.count || 0;
  const totalInProgress = (stats["SUBMITTED"]?.count || 0) + (stats["IN_PROGRESS"]?.count || 0);
  const totalComplete = stats["COMPLETE"]?.count || 0;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-[#00b4c3]">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Test Requests</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Test Request & Approval Workflow</h1>
          <p className="text-sm text-slate-500 mt-1">Create POs, submit for approval, track testing progress</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); if (!showCreate) loadReferenceData(); }}
          className="px-5 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Test Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button onClick={() => setFilter("PENDING_APPROVAL")}
          className={`p-4 rounded-xl border-2 transition-all text-left ${filter === "PENDING_APPROVAL" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-amber-600">{totalPending}</div>
          <div className="text-xs font-medium text-slate-500">Awaiting Approval</div>
        </button>
        <button onClick={() => setFilter("APPROVED")}
          className={`p-4 rounded-xl border-2 transition-all text-left ${filter === "APPROVED" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-emerald-600">{totalApproved}</div>
          <div className="text-xs font-medium text-slate-500">Approved</div>
        </button>
        <button onClick={() => setFilter(filter === "SUBMITTED" ? "" : "SUBMITTED")}
          className={`p-4 rounded-xl border-2 transition-all text-left ${["SUBMITTED", "IN_PROGRESS"].includes(filter) ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-blue-600">{totalInProgress}</div>
          <div className="text-xs font-medium text-slate-500">In Testing</div>
        </button>
        <button onClick={() => setFilter("COMPLETE")}
          className={`p-4 rounded-xl border-2 transition-all text-left ${filter === "COMPLETE" ? "border-green-400 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-green-600">{totalComplete}</div>
          <div className="text-xs font-medium text-slate-500">Complete</div>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${!filter ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          All
        </button>
        {STATUS_FLOW.map((s) => (
          <button key={s.key} onClick={() => setFilter(filter === s.key ? "" : s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === s.key ? "bg-slate-800 text-white" : `${s.color} hover:opacity-80`}`}>
            {s.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* ─── Create Form ─────────────────────────────── */}
      {showCreate && (
        <div className="mb-6 bg-white border-2 border-[#00b4c3] rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#00b4c3] to-[#009ba8] px-6 py-4">
            <h2 className="text-lg font-bold text-white">New Test Request</h2>
            <p className="text-sm text-white/80">Create a PO for lab testing — auto-generates PO number</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Row 1: Lab + Brand + Fabric */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lab <span className="text-red-500">*</span></label>
                <select value={createLabId} onChange={(e) => setCreateLabId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                  <option value="">Select lab...</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}{l.customerNumber ? ` (${l.customerNumber})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Brand</label>
                <select value={createBrandId} onChange={(e) => setCreateBrandId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                  <option value="">Select brand...</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fabric</label>
                <select value={createFabricId} onChange={(e) => setCreateFabricId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                  <option value="">Select fabric...</option>
                  {fabrics.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fuzeNumber ? `FUZE-${f.fuzeNumber}` : f.customerCode || f.id.slice(0, 8)} — {f.construction || "Unknown"} {f.weightGsm ? `(${f.weightGsm} GSM)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Project + SOW + Priority + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Project</label>
                <select value={createProjectId} onChange={(e) => setCreateProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                  <option value="">Select project...</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">SOW</label>
                <select value={createSowId} onChange={(e) => setCreateSowId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                  <option value="">Select SOW...</option>
                  {sows.map((s) => <option key={s.id} value={s.id}>{s.title || `SOW ${s.id.slice(0, 8)}`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                <select value={createPriority} onChange={(e) => setCreatePriority(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Requested Completion</label>
                <input type="date" value={createCompletionDate} onChange={(e) => setCreateCompletionDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none" />
              </div>
            </div>

            {/* Test Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">T</span>
                  Test Line Items
                </h3>
                <button onClick={addLine} className="text-xs text-[#00b4c3] font-semibold hover:underline">+ Add Test</button>
              </div>
              <div className="space-y-3">
                {createLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="col-span-3 sm:col-span-2">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Test Type</label>
                      <select value={line.testType} onChange={(e) => updateLine(idx, "testType", e.target.value)}
                        className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#00b4c3] outline-none">
                        {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Method</label>
                      <input type="text" value={line.testMethod} onChange={(e) => updateLine(idx, "testMethod", e.target.value)}
                        placeholder="AATCC 100" className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#00b4c3] outline-none" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Qty</label>
                      <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#00b4c3] outline-none" />
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Price (USD)</label>
                      <input type="number" step="0.01" value={line.unitPrice ?? ""} onChange={(e) => updateLine(idx, "unitPrice", e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Auto" className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#00b4c3] outline-none" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Days</label>
                      <input type="number" value={line.estimatedDays ?? ""} onChange={(e) => updateLine(idx, "estimatedDays", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="TAT" className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#00b4c3] outline-none" />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-slate-500">
                        <input type="checkbox" checked={line.rush} onChange={(e) => updateLine(idx, "rush", e.target.checked)}
                          className="rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]" />
                        Rush
                      </label>
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Notes</label>
                      <input type="text" value={line.notes} onChange={(e) => updateLine(idx, "notes", e.target.value)}
                        placeholder="e.g. wash specs" className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#00b4c3] outline-none" />
                    </div>
                    <div className="col-span-1">
                      {createLines.length > 1 && (
                        <button onClick={() => removeLine(idx)} className="p-2 text-red-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions + Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Special Instructions (for lab)</label>
                <textarea value={createInstructions} onChange={(e) => setCreateInstructions(e.target.value)}
                  rows={2} placeholder="Any special instructions for the lab..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Internal Notes</label>
                <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)}
                  rows={2} placeholder="Internal notes (not sent to lab)..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none" />
              </div>
            </div>

            {/* Cost summary + Submit */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div>
                <span className="text-sm text-slate-500">Estimated Total: </span>
                <span className="text-xl font-black text-slate-900">${totalEstimate.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg text-sm font-semibold hover:shadow-lg disabled:opacity-50 flex items-center gap-2">
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Create PO & Save Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Request List ─────────────────────────────── */}
      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-400 mb-2">No test requests {filter ? `with status "${statusLabel(filter)}"` : "yet"}</p>
          <button onClick={() => { setShowCreate(true); loadReferenceData(); }}
            className="text-sm text-[#00b4c3] font-semibold hover:underline">Create your first test request</button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isExpanded = expandedId === req.id;
            const isPending = req.status === "PENDING_APPROVAL";
            const isApproved = req.status === "APPROVED";
            const isDraft = req.status === "DRAFT";

            return (
              <div key={req.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Row Header */}
                <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 text-sm">{req.poNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(req.status)}`}>
                        {statusLabel(req.status)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${PRIORITY_COLORS[req.priority] || ""}`}>
                        {req.priority}
                      </span>
                      {req.rejectedAt && !req.approvedAt && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">Returned for revision</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                      <span className="font-medium text-slate-700">{req.lab?.name || "Unknown Lab"}</span>
                      {req.brand && <><span>·</span><span>{req.brand.name}</span></>}
                      {req.fuzeFabricNumber && <><span>·</span><span className="font-mono text-xs">{req.fuzeFabricNumber}</span></>}
                      {req.estimatedCost != null && (
                        <><span>·</span><span className="font-semibold text-slate-700">${req.estimatedCost.toFixed(2)}</span></>
                      )}
                      <span>·</span>
                      <span>{req.lines?.length || 0} test{(req.lines?.length || 0) !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    {/* PO Header Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">PO Number</p>
                        <p className="text-sm font-mono font-bold text-slate-900">{req.poNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">PO Date</p>
                        <p className="text-sm text-slate-800">{new Date(req.poDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Lab Account #</p>
                        <p className="text-sm font-mono text-slate-800">{req.labCustomerNumber || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Fabric</p>
                        <p className="text-sm text-slate-800">{req.fuzeFabricNumber || req.customerFabricCode || "—"}</p>
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">Testing Info</h4>
                        <div><span className="text-xs text-slate-500">Lab:</span> <span className="text-sm font-medium text-slate-800">{req.lab?.name}</span></div>
                        {req.brand && <div><span className="text-xs text-slate-500">Brand:</span> <span className="text-sm text-slate-800">{req.brand.name}</span></div>}
                        {req.project && <div><span className="text-xs text-slate-500">Project:</span> <span className="text-sm text-slate-800">{req.project.name}</span></div>}
                        {req.fabric && (
                          <div><span className="text-xs text-slate-500">Fabric:</span> <span className="text-sm text-slate-800">
                            {req.fabric.fuzeNumber ? `FUZE-${req.fabric.fuzeNumber}` : req.fabric.customerCode || "—"} — {req.fabric.construction} {req.fabric.weightGsm ? `(${req.fabric.weightGsm} GSM)` : ""}
                          </span></div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">Workflow</h4>
                        {req.requestedBy && <div><span className="text-xs text-slate-500">Requested by:</span> <span className="text-sm text-slate-800">{req.requestedBy.name}</span></div>}
                        {req.requestedAt && <div><span className="text-xs text-slate-500">Requested:</span> <span className="text-sm text-slate-800">{new Date(req.requestedAt).toLocaleString()}</span></div>}
                        {req.approvedBy && <div><span className="text-xs text-slate-500">Approved by:</span> <span className="text-sm font-semibold text-emerald-700">{req.approvedBy.name}</span></div>}
                        {req.approvedAt && <div><span className="text-xs text-slate-500">Approved:</span> <span className="text-sm text-slate-800">{new Date(req.approvedAt).toLocaleString()}</span></div>}
                        {req.rejectedReason && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            <span className="font-bold">Returned:</span> {req.rejectedReason}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">Cost & Timeline</h4>
                        <div><span className="text-xs text-slate-500">Estimated:</span> <span className="text-sm font-bold text-slate-900">${(req.estimatedCost || 0).toFixed(2)}</span></div>
                        {req.actualCost != null && <div><span className="text-xs text-slate-500">Actual:</span> <span className="text-sm font-bold text-emerald-700">${req.actualCost.toFixed(2)}</span></div>}
                        {req.requestedCompletionDate && (
                          <div><span className="text-xs text-slate-500">Due:</span> <span className="text-sm text-slate-800">{new Date(req.requestedCompletionDate).toLocaleDateString()}</span></div>
                        )}
                      </div>
                    </div>

                    {/* Instructions */}
                    {req.specialInstructions && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-bold text-blue-700 mb-1">Lab Instructions</p>
                        <p className="text-sm text-slate-700">{req.specialInstructions}</p>
                      </div>
                    )}
                    {req.internalNotes && (
                      <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-xs font-bold text-slate-500 mb-1">Internal Notes</p>
                        <p className="text-sm text-slate-700">{req.internalNotes}</p>
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Test Line Items</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left">
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Type</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Method</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Qty</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Unit Price</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Total</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Rush</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">TAT</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Status</th>
                              <th className="px-3 py-2 text-xs font-bold text-slate-500">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {req.lines.map((line) => (
                              <tr key={line.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium">{line.testType}</td>
                                <td className="px-3 py-2 text-slate-600">{line.testMethod || "—"}</td>
                                <td className="px-3 py-2">{line.quantity}</td>
                                <td className="px-3 py-2">{line.unitPrice != null ? `$${line.unitPrice.toFixed(2)}` : "—"}</td>
                                <td className="px-3 py-2 font-semibold">{line.totalPrice != null ? `$${line.totalPrice.toFixed(2)}` : "—"}</td>
                                <td className="px-3 py-2">{line.rush ? <span className="text-red-600 font-bold text-xs">RUSH</span> : "—"}</td>
                                <td className="px-3 py-2">{line.estimatedDays ? `${line.estimatedDays}d` : "—"}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${line.status === "COMPLETE" ? "bg-green-100 text-green-700" : line.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                                    {line.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {line.testRun ? (
                                    <Link href={`/tests/${line.testRun.id}`} className="text-[#00b4c3] hover:underline text-xs font-medium">
                                      {line.testRun.testReportNumber || "View"}
                                    </Link>
                                  ) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100 flex-wrap">
                      {isDraft && (
                        <>
                          <button onClick={() => handleAction(req.id, "submit")} disabled={processing === req.id}
                            className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Submit for Approval
                          </button>
                          <button onClick={() => {
                            if (confirm("Delete this draft?")) {
                              fetch(`/api/test-requests/${req.id}`, { method: "DELETE" })
                                .then((r) => r.json())
                                .then((d) => { if (d.ok) loadRequests(); else setError(d.error); });
                            }
                          }} className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                            Delete Draft
                          </button>
                        </>
                      )}
                      {isPending && (
                        <>
                          <button onClick={() => handleAction(req.id, "approve")} disabled={processing === req.id}
                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                            {processing === req.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            Approve
                          </button>
                          <button onClick={() => {
                            const reason = prompt("Reason for returning to draft (optional):");
                            handleAction(req.id, "reject", { rejectedReason: reason || undefined });
                          }} disabled={processing === req.id}
                            className="px-5 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50">
                            Return for Revision
                          </button>
                        </>
                      )}
                      {isApproved && (
                        <button onClick={() => handleAction(req.id, "submit_to_lab")} disabled={processing === req.id}
                          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Mark Submitted to Lab
                        </button>
                      )}
                      {req.status === "SUBMITTED" && (
                        <button onClick={() => handleAction(req.id, "in_progress")} disabled={processing === req.id}
                          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                          Mark In Progress
                        </button>
                      )}
                      {req.status === "IN_PROGRESS" && (
                        <button onClick={() => handleAction(req.id, "results_received")} disabled={processing === req.id}
                          className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                          Results Received
                        </button>
                      )}
                      {req.status === "RESULTS_RECEIVED" && (
                        <button onClick={() => handleAction(req.id, "complete")} disabled={processing === req.id}
                          className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                          Mark Complete
                        </button>
                      )}
                      {!["COMPLETE", "CANCELLED"].includes(req.status) && (
                        <button onClick={() => {
                          const reason = prompt("Reason for cancellation:");
                          if (reason !== null) handleAction(req.id, "cancel", { reason });
                        }} disabled={processing === req.id}
                          className="px-4 py-2.5 border border-slate-300 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 ml-auto">
                          Cancel Request
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
