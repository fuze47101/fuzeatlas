// @ts-nocheck
"use client";

/**
 * /distributor-portal/incoming-orders
 *
 * Master distributors only. Lists every restock order their
 * sub-distributors have placed against them, with quick-action
 * buttons to advance the status (APPROVE / SHIP / DELIVER).
 *
 * Sub-distributors who land on this page see a "no incoming orders"
 * empty state — by definition they don't fulfill anything.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface Order {
  id: string;
  orderNumber: string;
  unitType: string;
  unitQuantity: number;
  totalLiters: number;
  pricePerLiter: number;
  currency: string;
  totalPrice: number;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedDate: string | null;
  deliveredDate: string | null;
  notes: string | null;
  createdAt: string;
  distributor: { id: string; name: string; country: string | null; localCurrency: string | null };
}

interface Sub {
  id: string;
  name: string;
  country: string | null;
  localCurrency: string | null;
  inventory: { fuzeStockLiters: number } | null;
}

export default function IncomingOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shipForms, setShipForms] = useState<Record<string, any>>({});

  async function load() {
    setErr(null);
    try {
      const res = await fetch("/api/distributor-portal/incoming-orders");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "load failed");
      setOrders(json.orders);
      setSubs(json.subDistributors);
      setSummary(json.summary);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line
  }, [user]);

  async function patch(orderId: string, fields: any) {
    setUpdating(orderId);
    try {
      const res = await fetch("/api/distributor-portal/incoming-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...fields }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "update failed");
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            Distributor Portal
          </Link>
          <span>/</span>
          <span>Incoming Orders</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">
          Incoming Restocks (from your sub-distributors)
        </h1>
        <p className="text-slate-600 mt-1">
          You're acting as a master — these are restock orders your
          sub-distributors have placed against your warehouse. Approve,
          ship, and deliver to burn down your stock and post receipts to
          their accounts.
        </p>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {err}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Tile label="Total" value={summary.totalOrders} />
          <Tile
            label="Pending approval"
            value={summary.pendingApproval}
            warn={summary.pendingApproval > 0}
          />
          <Tile label="In transit" value={summary.shipped} />
          <Tile
            label="Open volume"
            value={`${summary.totalLitersOpen.toLocaleString()}L`}
          />
        </div>
      )}

      {subs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            Your sub-distributors ({subs.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {subs.map((s) => (
              <div
                key={s.id}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs"
              >
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-slate-500">
                  {s.country || "—"}
                  {s.inventory && (
                    <> · {s.inventory.fuzeStockLiters.toLocaleString()}L stock</>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <span className="text-4xl mb-3 block">📭</span>
          <p className="text-slate-600 font-semibold mb-1">
            No incoming orders.
          </p>
          <p className="text-slate-500 text-sm">
            {subs.length === 0
              ? "You aren't set up as a master distributor yet — no sub-distributors have you as their parent. Ask FUZE Admin to configure the hierarchy."
              : "When your sub-distributors place a restock against your warehouse, it'll appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-mono font-bold text-slate-900">
                    {o.orderNumber}
                  </p>
                  <p className="text-sm text-slate-700 mt-0.5">
                    {o.distributor.name}{" "}
                    <span className="text-slate-400">
                      · {o.distributor.country || "—"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {o.unitQuantity} × {o.unitType.replace("_", " ")} ·{" "}
                    {o.totalLiters.toLocaleString()}L · {o.currency}{" "}
                    {o.totalPrice.toLocaleString()} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                  {o.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">
                      "{o.notes}"
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(o.status)}`}
                >
                  {o.status}
                </span>
              </div>

              {/* Action buttons by status */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {o.status === "PENDING_APPROVAL" && (
                  <button
                    onClick={() => patch(o.id, { status: "APPROVED" })}
                    disabled={updating === o.id}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updating === o.id ? "..." : "Approve"}
                  </button>
                )}
                {o.status === "APPROVED" && (
                  <button
                    onClick={() => patch(o.id, { status: "PROCESSING" })}
                    disabled={updating === o.id}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {updating === o.id ? "..." : "Start Processing"}
                  </button>
                )}
                {(o.status === "PROCESSING" || o.status === "APPROVED") && (
                  <>
                    <input
                      type="text"
                      placeholder="Tracking #"
                      value={shipForms[o.id]?.trackingNumber || ""}
                      onChange={(e) =>
                        setShipForms((s) => ({
                          ...s,
                          [o.id]: {
                            ...(s[o.id] || {}),
                            trackingNumber: e.target.value,
                          },
                        }))
                      }
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Carrier"
                      value={shipForms[o.id]?.carrier || ""}
                      onChange={(e) =>
                        setShipForms((s) => ({
                          ...s,
                          [o.id]: {
                            ...(s[o.id] || {}),
                            carrier: e.target.value,
                          },
                        }))
                      }
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                    <button
                      onClick={() =>
                        patch(o.id, {
                          status: "SHIPPED",
                          ...(shipForms[o.id] || {}),
                        })
                      }
                      disabled={updating === o.id}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updating === o.id ? "..." : "Mark Shipped"}
                    </button>
                  </>
                )}
                {o.status === "SHIPPED" && (
                  <button
                    onClick={() => patch(o.id, { status: "DELIVERED" })}
                    disabled={updating === o.id}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {updating === o.id ? "..." : "Mark Delivered"}
                  </button>
                )}
                {o.trackingNumber && (
                  <span className="text-xs text-slate-500">
                    Tracking: {o.trackingNumber}
                    {o.carrier ? ` · ${o.carrier}` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case "PENDING_APPROVAL":
      return "bg-amber-100 text-amber-700";
    case "APPROVED":
      return "bg-blue-100 text-blue-700";
    case "PROCESSING":
      return "bg-purple-100 text-purple-700";
    case "SHIPPED":
      return "bg-indigo-100 text-indigo-700";
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-700";
    case "RECEIVED":
      return "bg-emerald-100 text-emerald-700";
    case "CANCELLED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function Tile({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        warn ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"
      }`}
    >
      <p className="text-xs text-slate-600 uppercase tracking-wide">{label}</p>
      <p
        className={`text-2xl font-black ${
          warn ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
