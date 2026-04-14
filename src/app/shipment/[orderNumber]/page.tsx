// @ts-nocheck
import Link from "next/link";

/**
 * Public shipment verification page — QR destination.
 * No auth required. Factories scan QR codes on shipments and land here.
 */

async function getShipment(orderNumber: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  try {
    const res = await fetch(`${baseUrl}/api/public/shipment/${orderNumber}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  QUOTED: "bg-blue-100 text-blue-800",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-indigo-100 text-indigo-800",
  PROCESSING: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-cyan-100 text-cyan-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function PublicShipmentPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const data = await getShipment(orderNumber);

  if (!data || !data.ok) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Shipment Not Found</h1>
          <p className="text-slate-600">We couldn't find order {orderNumber}.</p>
          <p className="text-sm text-slate-500 mt-4">If you received this QR code on a FUZE shipment, contact andrew@fuze47.com.</p>
        </div>
      </div>
    );
  }

  const { order, events } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e3a5f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#00b4c3] flex items-center justify-center text-xl font-black">F</div>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">FUZE Biotech · Salt Lake City</p>
              <p className="text-sm text-white/80">Shipment Verification</p>
            </div>
          </div>
          <h1 className="text-3xl font-black mt-4">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[order.status] || "bg-white/20"}`}>
              {order.status.replace(/_/g, " ")}
            </span>
            <span className="text-white/70 text-sm">
              {order.orderType} · {order.fuzeTier || ""}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Shipment Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-lg text-slate-900 mb-4">Shipment Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {order.volumeLiters && (
              <div>
                <p className="text-slate-500">FUZE Volume</p>
                <p className="font-bold text-slate-900">{order.volumeLiters}L ({order.bottles || Math.ceil(order.volumeLiters / 19)} bottles)</p>
                {order.baseFuzeLiters && (
                  <p className="text-xs text-slate-400">base {Number(order.baseFuzeLiters).toFixed(1)}L + {order.wastageFactorPct || 0}% wastage</p>
                )}
              </div>
            )}
            {order.fuzeTier && (
              <div>
                <p className="text-slate-500">Tier</p>
                <p className="font-bold text-slate-900">{order.fuzeTier}</p>
              </div>
            )}
            {order.treatmentMethod && (
              <div>
                <p className="text-slate-500">Treatment Method</p>
                <p className="font-bold text-slate-900">{order.treatmentMethod.replace(/_/g, "-")}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">Factory</p>
              <p className="font-bold text-slate-900">{order.factory?.name || "—"}</p>
              {order.factory?.country && (
                <p className="text-xs text-slate-400">{order.factory.city ? `${order.factory.city}, ` : ""}{order.factory.country}</p>
              )}
            </div>
            {order.brand?.name && (
              <div>
                <p className="text-slate-500">For Brand</p>
                <p className="font-bold text-slate-900">{order.brand.name}</p>
              </div>
            )}
            {order.fabric?.fuzeNumber && (
              <div>
                <p className="text-slate-500">Fabric</p>
                <p className="font-bold text-slate-900">{order.fabric.fuzeNumber}</p>
              </div>
            )}
            {order.fulfillmentSource && (
              <div>
                <p className="text-slate-500">Fulfillment</p>
                <p className="font-bold text-slate-900">
                  {order.fulfillmentSource === "DIRECT_USA" ? "Direct from USA" : order.distributor?.name || "Distributor"}
                </p>
              </div>
            )}
            {order.trackingNumber && (
              <div className="col-span-2">
                <p className="text-slate-500">Tracking</p>
                <p className="font-bold text-slate-900">{order.trackingNumber}{order.carrier ? ` · ${order.carrier}` : ""}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-lg text-slate-900 mb-4">Product Documents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/compliance-library"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-[#00b4c3] hover:bg-cyan-50/30 transition-colors"
            >
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Safety Data Sheet (SDS)</p>
                <p className="text-xs text-slate-500">Chemical safety information</p>
              </div>
            </Link>
            <Link
              href="/compliance-library"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-[#00b4c3] hover:bg-cyan-50/30 transition-colors"
            >
              <span className="text-2xl">📜</span>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Certificate of Analysis (COA)</p>
                <p className="text-xs text-slate-500">This batch's spec verification</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-lg text-slate-900 mb-4">Lifecycle Timeline</h2>
          {events && events.length > 0 ? (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-6">
                {events.map((e: any) => (
                  <div key={e.id} className="relative flex gap-4">
                    <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-[#00b4c3] flex items-center justify-center text-lg">
                      {EVENT_ICONS[e.eventType] || "•"}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="font-semibold text-slate-900">{e.title}</p>
                      {e.description && <p className="text-sm text-slate-600 mt-0.5">{e.description}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(e.createdAt).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "numeric", minute: "2-digit",
                        })}
                        {e.location && ` · ${e.location}`}
                      </p>
                      {e.documentUrl && (
                        <a
                          href={e.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 text-xs text-[#00b4c3] font-semibold hover:underline"
                        >
                          View document →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No lifecycle events logged yet. Timeline will populate as the shipment moves.</p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>FUZE Biotech · 1895 West 2100 South, Salt Lake City, Utah 84119 USA</p>
          <p className="mt-1">Questions? <a href="mailto:andrew@fuze47.com" className="text-[#00b4c3]">andrew@fuze47.com</a></p>
        </div>
      </div>
    </div>
  );
}
