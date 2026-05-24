"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/i18n";

const STATUS_COLORS: Record<string, string> = {
  PREPARING: "bg-slate-100 text-slate-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  AT_LAB: "bg-purple-100 text-purple-800",
  RETURNED: "bg-red-100 text-red-800",
};

export default function ShipmentsPage() {
  const { t } = useI18n();
  const T = t.shipmentsPage;
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  // Phase 15 — Kaylee shipment-button fix (cmp2roui8). Fabric picker
  // is now a typeahead against /api/fabrics so the FK is always a
  // real cuid, never free text. Lab picker is a real dropdown.
  const [fabricSearch, setFabricSearch] = useState("");
  const [fabricResults, setFabricResults] = useState<any[]>([]);
  const [fabricLoading, setFabricLoading] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<any>(null);
  const [labs, setLabs] = useState<any[]>([]);
  const [confirmStatus, setConfirmStatus] = useState<{ id: string; status: string } | null>(null);
  const [editingShipment, setEditingShipment] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    carrier: "", trackingNumber: "", sampleCount: 1, sampleType: "", sampleCondition: "",
  });
  const [formData, setFormData] = useState({
    fabricId: "",
    labId: "",
    testRequestId: "",
    carrier: "",
    trackingNumber: "",
    sampleCount: 1,
    sampleType: "",
    sampleCondition: "",
  });

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/shipments${params}`);
      const data = await res.json();
      if (data.ok) {
        setShipments(data.shipments);
      }
    } catch (error) {
      console.error("Error fetching shipments:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShipments();
  }, [filterStatus]);

  // Load lab list once when the form opens (small set, no need to debounce).
  useEffect(() => {
    if (!showForm || labs.length > 0) return;
    fetch("/api/labs")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.labs)) setLabs(j.labs);
      })
      .catch(() => {});
  }, [showForm, labs.length]);

  // Debounced fabric typeahead. Hits /api/fabrics?q=... and surfaces
  // FUZE number + customer code so Kaylee can search by either.
  useEffect(() => {
    if (!showForm) return;
    const q = fabricSearch.trim();
    if (!q) {
      setFabricResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setFabricLoading(true);
      try {
        const r = await fetch(`/api/fabrics?q=${encodeURIComponent(q)}&pageSize=15`);
        const j = await r.json();
        if (j?.ok || j?.fabrics) {
          setFabricResults(j.fabrics || j.items || []);
        } else {
          setFabricResults([]);
        }
      } catch {
        setFabricResults([]);
      } finally {
        setFabricLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [fabricSearch, showForm]);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fabricId) {
      toast.error(T.fabricRequired);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || T.failedCreate.replace("{code}", String(res.status)));
        return;
      }
      toast.success(T.shipmentCreated);
      setShowForm(false);
      setFormData({
        fabricId: "",
        labId: "",
        testRequestId: "",
        carrier: "",
        trackingNumber: "",
        sampleCount: 1,
        sampleType: "",
        sampleCondition: "",
      });
      setSelectedFabric(null);
      setFabricSearch("");
      setFabricResults([]);
      fetchShipments();
    } catch (error: any) {
      console.error("Error creating shipment:", error);
      toast.error(error?.message || T.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = (shipmentId: string, newStatus: string) => {
    setConfirmStatus({ id: shipmentId, status: newStatus });
  };

  const doStatusUpdate = async (shipmentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          eventType: newStatus,
          eventNotes: `Status updated to ${newStatus}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(T.statusUpdated.replace("{status}", newStatus.replace(/_/g, " ")));
        fetchShipments();
      }
    } catch (error) {
      console.error("Error updating shipment:", error);
      toast.error(T.failedUpdateStatus);
    }
  };

  const startEditShipment = (s: any) => {
    setEditForm({
      carrier: s.carrier || "",
      trackingNumber: s.trackingNumber || "",
      sampleCount: s.sampleCount || 1,
      sampleType: s.sampleType || "",
      sampleCondition: s.sampleCondition || "",
    });
    setEditingShipment(s);
  };

  const saveEditShipment = async () => {
    if (!editingShipment) return;
    try {
      const res = await fetch(`/api/shipments/${editingShipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(T.shipmentUpdated);
        setEditingShipment(null);
        fetchShipments();
      } else {
        toast.error(data.error || T.failedUpdate);
      }
    } catch {
      toast.error(T.failedUpdate);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{T.pageTitle}</h1>
            <p className="text-slate-600 mt-1">
              {T.pageSubtitle}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
          >
            {showForm ? T.cancel : T.createShipment}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{T.newShipment}</h3>
            <form onSubmit={handleCreateShipment} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2 lg:col-span-3 relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {T.fabricLabel} <span className="text-red-500">*</span>
                </label>
                {selectedFabric ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-2 border-[#00b4c3] bg-[#00b4c3]/5 rounded-lg">
                    <div className="text-sm">
                      <span className="font-bold text-slate-900">
                        FUZE-{selectedFabric.fuzeNumber ?? "?"}
                      </span>
                      {selectedFabric.customerCode && (
                        <span className="text-slate-600 ml-2">
                          · {selectedFabric.customerCode}
                        </span>
                      )}
                      {selectedFabric.brand && (
                        <span className="text-slate-500 ml-2">
                          · {selectedFabric.brand}
                        </span>
                      )}
                      {selectedFabric.factory && (
                        <span className="text-slate-500 ml-2">
                          · {selectedFabric.factory}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFabric(null);
                        setFormData({ ...formData, fabricId: "" });
                        setFabricSearch("");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      {T.change}
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder={T.fabricSearchPlaceholder}
                      value={fabricSearch}
                      onChange={(e) => setFabricSearch(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                    />
                    {fabricSearch.trim() && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-md max-h-64 overflow-y-auto">
                        {fabricLoading ? (
                          <div className="px-3 py-2 text-xs text-slate-400">{T.searching}</div>
                        ) : fabricResults.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">
                            {T.noFabricsMatch}
                          </div>
                        ) : (
                          fabricResults.map((f: any) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setSelectedFabric(f);
                                setFormData({ ...formData, fabricId: f.id });
                                setFabricResults([]);
                                setFabricSearch("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#00b4c3]/5 border-b border-slate-100 last:border-b-0"
                            >
                              <div className="text-sm font-semibold text-slate-900">
                                FUZE-{f.fuzeNumber ?? "?"}
                                {f.customerCode && (
                                  <span className="text-slate-500 font-normal">
                                    {" "}
                                    · {f.customerCode}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {f.brand ? `🏷 ${f.brand}` : ""}
                                {f.brand && f.factory ? " · " : ""}
                                {f.factory ? `🏭 ${f.factory}` : ""}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.labLabel}</label>
                <select
                  value={formData.labId}
                  onChange={(e) => setFormData({ ...formData, labId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">{T.chooseLab}</option>
                  {labs.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.country ? ` · ${l.country}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {T.carrierLabel}
                </label>
                <select
                  value={formData.carrier}
                  onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">{T.selectCarrier}</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="SF Express">SF Express</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {T.trackingNumberLabel}
                </label>
                <input
                  type="text"
                  placeholder={T.trackingNumberPlaceholder}
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {T.sampleCountLabel}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.sampleCount}
                  onChange={(e) => setFormData({ ...formData, sampleCount: parseInt(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {T.sampleTypeLabel}
                </label>
                <select
                  value={formData.sampleType}
                  onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">{T.selectType}</option>
                  <option value="Fabric swatch">{T.fabricSwatch}</option>
                  <option value="Treated sample">{T.treatedSample}</option>
                  <option value="Washed sample">{T.washedSample}</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || !formData.fabricId}
                className="col-span-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2 rounded-lg font-medium text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? T.creating : T.createShipment}
              </button>
            </form>
          </div>
        )}

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterStatus("")}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                filterStatus === ""
                  ? "bg-[#00b4c3] text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {T.statusAll}
            </button>
            {["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "AT_LAB", "RETURNED"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  filterStatus === status
                    ? "bg-[#00b4c3] text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Shipments List */}
        {loading ? (
          <div className="text-center py-12 text-slate-600">{T.loading}</div>
        ) : shipments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-600">{T.noShipments}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <div key={shipment.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Summary Row */}
                <button
                  onClick={() =>
                    setExpandedId(expandedId === shipment.id ? null : shipment.id)
                  }
                  className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[shipment.status] || "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {shipment.status}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">
                          {shipment.fabric?.fuzeNumber || shipment.trackingNumber || T.shipmentDefault}
                        </p>
                        <p className="text-sm text-slate-600">
                          {shipment.lab?.name} • {shipment.sampleCount} {T.samples}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">
                      {new Date(shipment.createdAt).toLocaleDateString()}
                    </p>
                    {shipment.trackingNumber && (
                      <p className="text-sm font-mono text-slate-500">
                        {shipment.trackingNumber}
                      </p>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ml-4 ${
                      expandedId === shipment.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>

                {/* Expanded Details */}
                {expandedId === shipment.id && (
                  <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-600 font-medium">{T.carrierField}</p>
                        <p className="text-sm text-slate-900">{shipment.carrier || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">{T.sampleType}</p>
                        <p className="text-sm text-slate-900">{shipment.sampleType || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">{T.condition}</p>
                        <p className="text-sm text-slate-900">{shipment.sampleCondition || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">{T.weight}</p>
                        <p className="text-sm text-slate-900">{shipment.weight ? `${shipment.weight} kg` : "-"}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    {shipment.eventCount > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-600 font-medium mb-2">
                          {T.events} ({shipment.eventCount})
                        </p>
                        <div className="text-xs text-slate-600">{T.chainOfCustody.replace("{n}", String(shipment.eventCount))}</div>
                      </div>
                    )}

                    {/* Status Transition Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => startEditShipment(shipment)}
                        className="px-3 py-1.5 bg-white text-[#00b4c3] border border-[#00b4c3]/30 rounded-lg text-xs font-medium hover:bg-[#00b4c3]/5"
                      >
                        {T.editDetails}
                      </button>
                      {shipment.status === "PREPARING" && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "SHIPPED")}
                          className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium hover:bg-blue-200"
                        >
                          {T.markShipped}
                        </button>
                      )}
                      {["SHIPPED", "IN_TRANSIT"].includes(shipment.status) && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "IN_TRANSIT")}
                          className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200"
                        >
                          {T.inTransit}
                        </button>
                      )}
                      {["IN_TRANSIT", "DELIVERED"].includes(shipment.status) && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "DELIVERED")}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium hover:bg-emerald-200"
                        >
                          {T.markDelivered}
                        </button>
                      )}
                      {["DELIVERED", "AT_LAB"].includes(shipment.status) && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "AT_LAB")}
                          className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-medium hover:bg-purple-200"
                        >
                          {T.atLab}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Shipment Modal (F-004) */}
      {editingShipment && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingShipment(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{T.editShipmentTitle}</h2>
              <button onClick={() => setEditingShipment(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.carrierLabel}</label>
                <select value={editForm.carrier} onChange={(e) => setEditForm({ ...editForm, carrier: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none">
                  <option value="">{T.selectCarrier}</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="SF Express">SF Express</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.trackingNumberLabel}</label>
                <input type="text" value={editForm.trackingNumber} onChange={(e) => setEditForm({ ...editForm, trackingNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.sampleCountLabel}</label>
                  <input type="number" min="1" value={editForm.sampleCount} onChange={(e) => setEditForm({ ...editForm, sampleCount: parseInt(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{T.sampleTypeLabel}</label>
                  <select value={editForm.sampleType} onChange={(e) => setEditForm({ ...editForm, sampleType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none">
                    <option value="">{T.selectType}</option>
                    <option value="Fabric swatch">{T.fabricSwatch}</option>
                    <option value="Treated sample">{T.treatedSample}</option>
                    <option value="Washed sample">{T.washedSample}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{T.sampleConditionLabel}</label>
                <input type="text" value={editForm.sampleCondition} onChange={(e) => setEditForm({ ...editForm, sampleCondition: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                  placeholder={T.sampleConditionPlaceholder} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => setEditingShipment(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                {T.cancel}
              </button>
              <button onClick={saveEditShipment} className="px-5 py-2 text-sm font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa]">
                {T.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Status Change (F-026) */}
      <ConfirmDialog
        open={!!confirmStatus}
        title={T.advanceTo.replace("{status}", confirmStatus?.status?.replace(/_/g, " ") || "")}
        message={T.advanceMessage}
        confirmLabel={T.updateTo.replace("{status}", confirmStatus?.status?.replace(/_/g, " ") || "")}
        variant="warning"
        onConfirm={() => {
          if (confirmStatus) doStatusUpdate(confirmStatus.id, confirmStatus.status);
          setConfirmStatus(null);
        }}
        onCancel={() => setConfirmStatus(null)}
      />
    </div>
  );
}
