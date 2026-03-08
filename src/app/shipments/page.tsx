"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

const STATUS_COLORS: Record<string, string> = {
  PREPARING: "bg-slate-100 text-slate-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  AT_LAB: "bg-purple-100 text-purple-800",
  RETURNED: "bg-red-100 text-red-800",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const toast = useToast();
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

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
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
        fetchShipments();
      }
    } catch (error) {
      console.error("Error creating shipment:", error);
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
        toast.success(`Shipment status updated to ${newStatus.replace(/_/g, " ")}`);
        fetchShipments();
      }
    } catch (error) {
      console.error("Error updating shipment:", error);
      toast.error("Failed to update shipment status");
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
        toast.success("Shipment updated");
        setEditingShipment(null);
        fetchShipments();
      } else {
        toast.error(data.error || "Failed to update shipment");
      }
    } catch {
      toast.error("Failed to update shipment");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sample Shipments</h1>
            <p className="text-slate-600 mt-1">
              Track fabric samples and test shipments
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
          >
            {showForm ? "Cancel" : "Create Shipment"}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Shipment</h3>
            <form onSubmit={handleCreateShipment} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fabric
                </label>
                <input
                  type="text"
                  placeholder="Fabric ID or code"
                  value={formData.fabricId}
                  onChange={(e) => setFormData({ ...formData, fabricId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lab
                </label>
                <input
                  type="text"
                  placeholder="Lab ID or name"
                  value={formData.labId}
                  onChange={(e) => setFormData({ ...formData, labId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carrier
                </label>
                <select
                  value={formData.carrier}
                  onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">Select carrier</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="SF Express">SF Express</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  placeholder="Tracking #"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sample Count
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
                  Sample Type
                </label>
                <select
                  value={formData.sampleType}
                  onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">Select type</option>
                  <option value="Fabric swatch">Fabric swatch</option>
                  <option value="Treated sample">Treated sample</option>
                  <option value="Washed sample">Washed sample</option>
                </select>
              </div>

              <button
                type="submit"
                className="col-span-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2 rounded-lg font-medium text-sm hover:shadow-lg transition-all"
              >
                Create Shipment
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
              All
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
          <div className="text-center py-12 text-slate-600">Loading...</div>
        ) : shipments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-600">No shipments found</p>
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
                          {shipment.fabric?.fuzeNumber || shipment.trackingNumber || "Shipment"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {shipment.lab?.name} • {shipment.sampleCount} samples
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
                        <p className="text-xs text-slate-600 font-medium">Carrier</p>
                        <p className="text-sm text-slate-900">{shipment.carrier || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Sample Type</p>
                        <p className="text-sm text-slate-900">{shipment.sampleType || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Condition</p>
                        <p className="text-sm text-slate-900">{shipment.sampleCondition || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Weight</p>
                        <p className="text-sm text-slate-900">{shipment.weight ? `${shipment.weight} kg` : "-"}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    {shipment.eventCount > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-600 font-medium mb-2">
                          Events ({shipment.eventCount})
                        </p>
                        <div className="text-xs text-slate-600">Chain of custody tracked with {shipment.eventCount} events</div>
                      </div>
                    )}

                    {/* Status Transition Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => startEditShipment(shipment)}
                        className="px-3 py-1.5 bg-white text-[#00b4c3] border border-[#00b4c3]/30 rounded-lg text-xs font-medium hover:bg-[#00b4c3]/5"
                      >
                        Edit Details
                      </button>
                      {shipment.status === "PREPARING" && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "SHIPPED")}
                          className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium hover:bg-blue-200"
                        >
                          Mark Shipped
                        </button>
                      )}
                      {["SHIPPED", "IN_TRANSIT"].includes(shipment.status) && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "IN_TRANSIT")}
                          className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200"
                        >
                          In Transit
                        </button>
                      )}
                      {["IN_TRANSIT", "DELIVERED"].includes(shipment.status) && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "DELIVERED")}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium hover:bg-emerald-200"
                        >
                          Mark Delivered
                        </button>
                      )}
                      {["DELIVERED", "AT_LAB"].includes(shipment.status) && (
                        <button
                          onClick={() => handleStatusUpdate(shipment.id, "AT_LAB")}
                          className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-medium hover:bg-purple-200"
                        >
                          At Lab
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingShipment(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit Shipment</h2>
              <button onClick={() => setEditingShipment(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Carrier</label>
                <select value={editForm.carrier} onChange={(e) => setEditForm({ ...editForm, carrier: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none">
                  <option value="">Select carrier</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="SF Express">SF Express</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tracking Number</label>
                <input type="text" value={editForm.trackingNumber} onChange={(e) => setEditForm({ ...editForm, trackingNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sample Count</label>
                  <input type="number" min="1" value={editForm.sampleCount} onChange={(e) => setEditForm({ ...editForm, sampleCount: parseInt(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sample Type</label>
                  <select value={editForm.sampleType} onChange={(e) => setEditForm({ ...editForm, sampleType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none">
                    <option value="">Select type</option>
                    <option value="Fabric swatch">Fabric swatch</option>
                    <option value="Treated sample">Treated sample</option>
                    <option value="Washed sample">Washed sample</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sample Condition</label>
                <input type="text" value={editForm.sampleCondition} onChange={(e) => setEditForm({ ...editForm, sampleCondition: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
                  placeholder="Good, Damaged, etc." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => setEditingShipment(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={saveEditShipment} className="px-5 py-2 text-sm font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa]">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Status Change (F-026) */}
      <ConfirmDialog
        open={!!confirmStatus}
        title={`Advance to ${confirmStatus?.status?.replace(/_/g, " ") || ""}?`}
        message="This will update the shipment status and log a chain-of-custody event. This action can be reversed by an admin."
        confirmLabel={`Update to ${confirmStatus?.status?.replace(/_/g, " ") || ""}`}
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
