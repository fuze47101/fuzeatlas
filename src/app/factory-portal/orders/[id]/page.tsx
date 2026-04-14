// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const EVENT_ICONS: Record<string, string> = {
  ORDER_PLACED: "📝",
  QUOTE_ACCEPTED: "📋",
  APPROVED: "✅",
  SHIPPED_FROM_FUZE: "🚛",
  SHIPPED_FROM_DISTRIBUTOR: "🚛",
  IN_TRANSIT: "✈️",
  CUSTOMS: "🛃",
  RECEIVED_AT_FACTORY: "📦",
  TREATMENT_APPLIED: "💧",
  ICP_SAMPLE_SUBMITTED: "🧪",
  ICP_CERTIFIED: "🎖️",
  BRAND_NOTIFIED: "📨",
  CANCELLED: "❌",
  NOTE: "📝",
};

export default function FactoryOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isFactory = ["FACTORY_USER", "FACTORY_MANAGER"].includes(user?.role || "");
  const isInternal = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [ordersRes, eventsRes] = await Promise.all([
        fetch(`/api/orders?id=${id}`),
        fetch(`/api/orders/${id}/events`),
      ]);
      const oData = await ordersRes.json();
      const eData = await eventsRes.json();
      // Fallback: find in orders list
      if (oData.ok) {
        const found = (oData.orders || []).find((o: any) => o.id === id) || oData.order;
        setOrder(found);
      }
      if (eData.ok) setEvents(eData.events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function logEvent(eventType: string, title: string, data: any = {}, description?: string) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, title, description, data }),
      });
      const d = await res.json();
      if (d.ok) {
        setAction(null);
        setForm({});
        loadAll();
      } else {
        setError(d.error || "Failed to log event");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-slate-600">Order not found.</p>
        <Link href="/factory-portal/orders" className="text-[#00b4c3] font-semibold">← Back to orders</Link>
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://fuzeatlas.com";
  const shipmentUrl = `${baseUrl}/shipment/${order.orderNumber}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(shipmentUrl)}`;

  const canReceive = ["SHIPPED", "APPROVED", "PROCESSING", "DELIVERED"].includes(order.status) && !events.some((e: any) => e.eventType === "RECEIVED_AT_FACTORY");
  const canTreat = events.some((e: any) => e.eventType === "RECEIVED_AT_FACTORY");
  const canSubmitIcp = events.some((e: any) => e.eventType === "TREATMENT_APPLIED");
  const canShip = isInternal && ["APPROVED", "PROCESSING"].includes(order.status) && !events.some((e: any) => e.eventType.startsWith("SHIPPED"));

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <Link href="/factory-portal/orders" className="text-sm text-slate-500 hover:text-[#00b4c3]">
            ← Back to orders
          </Link>
          <h1 className="text-3xl font-black text-slate-900 mt-2">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{order.status.replace(/_/g, " ")}</span>
            <span className="text-sm text-slate-500">{order.orderType}</span>
          </div>
        </div>
        <Link
          href={shipmentUrl}
          target="_blank"
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
        >
          Public shipment page ↗
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Details + Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-bold text-slate-900 mb-4">Order Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {order.volumeLiters && (
                <div>
                  <p className="text-slate-500">Volume</p>
                  <p className="font-bold text-slate-900">{order.volumeLiters}L ({order.bottles || Math.ceil(order.volumeLiters / 19)} bottles)</p>
                  {order.baseFuzeLiters && (
                    <p className="text-xs text-slate-400">base {Number(order.baseFuzeLiters).toFixed(1)}L + {order.wastageFactorPct || 0}% wastage</p>
                  )}
                </div>
              )}
              {order.fuzeTier && (
                <div><p className="text-slate-500">Tier</p><p className="font-bold text-slate-900">{order.fuzeTier}</p></div>
              )}
              {order.treatmentMethod && (
                <div><p className="text-slate-500">Method</p><p className="font-bold text-slate-900">{order.treatmentMethod.replace(/_/g, "-")}</p></div>
              )}
              {order.fabricMassKg && (
                <div><p className="text-slate-500">Fabric Mass</p><p className="font-bold text-slate-900">{Number(order.fabricMassKg).toFixed(1)} kg</p></div>
              )}
              {order.brand?.name && (
                <div><p className="text-slate-500">Brand</p><p className="font-bold text-slate-900">{order.brand.name}</p></div>
              )}
              {order.fabric?.fuzeNumber && (
                <div><p className="text-slate-500">Fabric</p><p className="font-bold text-slate-900">{order.fabric.fuzeNumber}</p></div>
              )}
              {order.trackingNumber && (
                <div className="col-span-2">
                  <p className="text-slate-500">Tracking</p>
                  <p className="font-bold text-slate-900">{order.trackingNumber}{order.carrier ? ` · ${order.carrier}` : ""}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-bold text-slate-900 mb-4">Log Lifecycle Event</h2>
            <div className="flex flex-wrap gap-2">
              {canShip && (
                <button
                  onClick={() => setAction("ship")}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700"
                >
                  🚛 Mark Shipped
                </button>
              )}
              {canReceive && isFactory && (
                <button
                  onClick={() => setAction("receive")}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
                >
                  📦 Confirm Receipt
                </button>
              )}
              {canTreat && isFactory && (
                <button
                  onClick={() => setAction("treat")}
                  className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg hover:bg-[#009aa8]"
                >
                  💧 Log Treatment Applied
                </button>
              )}
              {canSubmitIcp && isFactory && (
                <button
                  onClick={() => setAction("icp")}
                  className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700"
                >
                  🧪 Submit ICP Sample
                </button>
              )}
              <button
                onClick={() => setAction("note")}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200"
              >
                + Add Note
              </button>
            </div>

            {/* SHIP form */}
            {action === "ship" && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg space-y-2">
                <input placeholder="Tracking number" value={form.trackingNumber || ""} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input placeholder="Carrier (FedEx, DHL...)" value={form.carrier || ""} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <button disabled={submitting} onClick={() => logEvent(order.fulfillmentSource === "DIRECT_USA" ? "SHIPPED_FROM_FUZE" : "SHIPPED_FROM_DISTRIBUTOR", `Shipped via ${form.carrier || "carrier"}`, { trackingNumber: form.trackingNumber, carrier: form.carrier }, form.notes)} className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg">Mark Shipped</button>
                  <button onClick={() => { setAction(null); setForm({}); }} className="px-4 py-2 bg-slate-100 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {/* RECEIVE form */}
            {action === "receive" && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg space-y-2">
                <p className="text-sm text-slate-700">Confirm this shipment arrived in good condition at your facility.</p>
                <textarea placeholder="Intake notes (condition, seal integrity, temp, any damage...)" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <button disabled={submitting} onClick={() => logEvent("RECEIVED_AT_FACTORY", "Received at factory", {}, form.notes)} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg">Confirm Receipt</button>
                  <button onClick={() => { setAction(null); setForm({}); }} className="px-4 py-2 bg-slate-100 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {/* TREATMENT form */}
            {action === "treat" && (
              <div className="mt-4 p-4 bg-cyan-50 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">Liters Used</label>
                    <input type="number" value={form.litersUsed || ""} onChange={(e) => setForm({ ...form, litersUsed: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Meters Processed</label>
                    <input type="number" value={form.metersProcessed || ""} onChange={(e) => setForm({ ...form, metersProcessed: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.method || order.treatmentMethod || "EXHAUST"} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="EXHAUST">Exhaust</option>
                    <option value="PAD_DRY_CURE">Pad-Dry-Cure</option>
                    <option value="SPRAY">Spray</option>
                  </select>
                  <input placeholder="Production run ID (optional)" value={form.productionRunId || ""} onChange={(e) => setForm({ ...form, productionRunId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <textarea placeholder="Treatment notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <button disabled={submitting} onClick={() => logEvent("TREATMENT_APPLIED", `Treated ${form.metersProcessed || "?"}m using ${form.litersUsed || "?"}L`, { litersUsed: form.litersUsed, metersProcessed: form.metersProcessed, method: form.method, productionRunId: form.productionRunId, fuzeTier: order.fuzeTier }, form.notes)} className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg">Log Treatment</button>
                  <button onClick={() => { setAction(null); setForm({}); }} className="px-4 py-2 bg-slate-100 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {/* ICP form */}
            {action === "icp" && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg space-y-2">
                <p className="text-sm text-slate-700">Log that you've sent an ICP sample for certification.</p>
                <input placeholder="Lab name (ITS / VL / FPC...)" value={form.labName || ""} onChange={(e) => setForm({ ...form, labName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input placeholder="Lab tracking / sample ID" value={form.labSampleId || ""} onChange={(e) => setForm({ ...form, labSampleId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <button disabled={submitting} onClick={() => logEvent("ICP_SAMPLE_SUBMITTED", `ICP sample sent to ${form.labName || "lab"}`, { labName: form.labName, labSampleId: form.labSampleId }, form.notes)} className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg">Log ICP Submission</button>
                  <button onClick={() => { setAction(null); setForm({}); }} className="px-4 py-2 bg-slate-100 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {/* NOTE form */}
            {action === "note" && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-2">
                <input placeholder="Short title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <textarea placeholder="Details" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <button disabled={submitting || !form.title} onClick={() => logEvent("NOTE", form.title, {}, form.notes)} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg">Add Note</button>
                  <button onClick={() => { setAction(null); setForm({}); }} className="px-4 py-2 bg-slate-100 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-bold text-slate-900 mb-4">Lifecycle Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No events yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
                <div className="space-y-5">
                  {events.map((e: any) => (
                    <div key={e.id} className="relative flex gap-4">
                      <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-[#00b4c3] flex items-center justify-center text-lg">
                        {EVENT_ICONS[e.eventType] || "•"}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{e.title}</p>
                        {e.description && <p className="text-sm text-slate-600">{e.description}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(e.createdAt).toLocaleString()}
                          {e.actorName && ` · ${e.actorName}`}
                          {e.location && ` · ${e.location}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — QR Code */}
        <div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-4 text-center">
            <h3 className="font-bold text-slate-900 mb-1">Shipment QR Code</h3>
            <p className="text-xs text-slate-500 mb-4">Print on the shipment label. Scans → SDS, COA, live timeline.</p>
            <img src={qrUrl} alt="Shipment QR" className="mx-auto border-2 border-slate-200 rounded-lg p-2" />
            <div className="mt-3 text-xs text-slate-500 break-all bg-slate-50 p-2 rounded">
              {shipmentUrl}
            </div>
            <a
              href={qrUrl}
              download={`qr-${order.orderNumber}.png`}
              className="mt-3 inline-block w-full px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
            >
              Download QR
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
