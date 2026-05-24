// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import PrintButton from "./PrintButton";
import { getServerTranslations } from "@/i18n/server";

/**
 * TRACK 3 — Print-friendly QR label for a FUZE shipment.
 *
 * Single-page Letter-size label intended to be printed and physically
 * applied to a gaylord / carboy / container. Renders the QR pointing
 * at /shipment/[orderNumber], the order number, factory, brand, tier,
 * volume, and shipping carrier line so anyone holding the shipment
 * has a same-glance summary even before they scan.
 *
 * Auth: ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP — the people who
 * actually print labels at the SLC HQ or at a distributor warehouse.
 */
const ALLOWED_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"]);

export default async function QRLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED_ROLES.has(user.role)) redirect("/home");

  const { id } = await params;
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).orderQrLabel;

  const order = await prisma.fuzeOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
      volumeLiters: true,
      bottles: true,
      fuzeTier: true,
      treatmentMethod: true,
      trackingNumber: true,
      carrier: true,
      shippingCity: true,
      shippingCountry: true,
      createdAt: true,
      shippedDate: true,
      factory: { select: { name: true, country: true, city: true } },
      brand: { select: { name: true } },
      distributor: { select: { name: true } },
      fabric: { select: { fuzeNumber: true, customerCode: true } },
    },
  });

  if (!order) {
    return (
      <div className="p-8">
        <p className="text-slate-500">{T.orderNotFound}</p>
      </div>
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const shipmentUrl = `${baseUrl}/shipment/${order.orderNumber}`;
  // Use the qrserver pattern already in use elsewhere in the app
  // (admin/batches/page.tsx, factory-portal/orders/[id]). No new dep,
  // stays consistent with prior QR rendering.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=10&data=${encodeURIComponent(shipmentUrl)}`;

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: letter; margin: 0.4in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print bg-slate-100 px-6 py-3 flex items-center justify-between border-b border-slate-200">
        <div className="text-sm text-slate-600">
          {T.headerKicker} · {order.orderNumber} ·{" "}
          <a href={shipmentUrl} target="_blank" rel="noopener noreferrer" className="text-[#00b4c3] hover:underline">
            {T.previewPublicLink}
          </a>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-3xl mx-auto p-8">
        <div className="border-4 border-slate-900 rounded-2xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#00b4c3] flex items-center justify-center text-white text-2xl font-black">F</div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">{T.brandLine}</p>
                  <p className="text-sm font-bold text-slate-700">{T.brandLocation}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-500">{T.orderLabel}</p>
              <p className="text-xl font-black text-slate-900">{order.orderNumber}</p>
            </div>
          </div>

          {/* QR + summary */}
          <div className="flex gap-8 items-start">
            <div className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={`QR for ${order.orderNumber}`} width={420} height={420} className="block" />
              <p className="text-center text-xs text-slate-500 mt-2 font-mono">{shipmentUrl}</p>
            </div>
            <div className="flex-1 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">{T.scanToVerifyTitle}</p>
                <p className="text-slate-700 mt-1">
                  {T.scanToVerifyBody}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-slate-200">
                {order.fuzeTier && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.tierLabel}</p>
                    <p className="font-bold text-slate-900">{order.fuzeTier}</p>
                  </div>
                )}
                {order.volumeLiters != null && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.volumeLabel}</p>
                    <p className="font-bold text-slate-900">
                      {order.volumeLiters}L
                      {order.bottles ? ` · ${order.bottles} ${T.bottlesSuffix}` : ""}
                    </p>
                  </div>
                )}
                {order.treatmentMethod && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.methodLabel}</p>
                    <p className="font-bold text-slate-900">{order.treatmentMethod.replace(/_/g, "-")}</p>
                  </div>
                )}
                {order.orderType && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.typeLabel}</p>
                    <p className="font-bold text-slate-900">{order.orderType}</p>
                  </div>
                )}
                {order.factory?.name && (
                  <div className="col-span-2">
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.shipToLabel}</p>
                    <p className="font-bold text-slate-900">{order.factory.name}</p>
                    {(order.factory.city || order.factory.country) && (
                      <p className="text-xs text-slate-500">
                        {[order.factory.city, order.factory.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                )}
                {order.brand?.name && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.forBrandLabel}</p>
                    <p className="font-bold text-slate-900">{order.brand.name}</p>
                  </div>
                )}
                {order.distributor?.name && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.viaDistributorLabel}</p>
                    <p className="font-bold text-slate-900">{order.distributor.name}</p>
                  </div>
                )}
                {order.fabric?.fuzeNumber != null && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.fabricLabel}</p>
                    <p className="font-bold text-slate-900">FUZE-{order.fabric.fuzeNumber}</p>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className="col-span-2">
                    <p className="text-xs uppercase tracking-widest text-slate-500">{T.trackingLabel}</p>
                    <p className="font-bold text-slate-900">
                      {order.trackingNumber}
                      {order.carrier ? ` · ${order.carrier}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t-2 border-slate-900 flex items-center justify-between text-xs text-slate-600">
            <p className="font-semibold">{T.footerTagline}</p>
            <p>{T.printedPrefix} {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
