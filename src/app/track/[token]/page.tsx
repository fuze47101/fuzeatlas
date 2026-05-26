// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { projectNextEta, TRACKING_STATES } from "@/lib/test-tracking-eta";
import { getServerTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import SubscribeForm from "./SubscribeForm";

export const dynamic = "force-dynamic";

const STATE_LABELS_FALLBACK: Record<string, string> = {
  REQUEST_SUBMITTED: "Test request submitted",
  REQUEST_APPROVED: "Approved — preparing shipping label",
  SAMPLE_SHIPPED: "Sample shipped from factory",
  SAMPLE_IN_TRANSIT: "Sample in transit",
  SAMPLE_RECEIVED: "Received at lab — in queue",
  LAB_IN_QUEUE: "In queue — awaiting lab start",
  LAB_TESTING: "Testing in progress",
  RESULTS_AVAILABLE: "Results ready — under review",
  BRAND_VISIBLE: "Report sent to brand",
  COMPLETE: "Closed",
  CANCELLED: "Cancelled",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ locale?: string; lang?: string }>;
}) {
  const { token } = await params;
  const sp = (await searchParams) || {};
  const locale = sp.locale || sp.lang || "en";
  const t = await getServerTranslations(locale).catch(() => null);

  if (!token) notFound();

  const tt = await (prisma as any).testTrackingToken.findUnique({
    where: { token },
    select: {
      id: true,
      testRequestId: true,
      expiresAt: true,
      testRequest: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          trackingState: true,
          trackingUpdatedAt: true,
          fuzeFabricNumber: true,
          customerFabricCode: true,
          createdAt: true,
          brand: { select: { name: true } },
          fabric: { select: { fuzeNumber: true, customerCode: true } },
        },
      },
    },
  });

  if (!tt || !tt.testRequest) notFound();
  const expired = tt.expiresAt && new Date(tt.expiresAt) < new Date();

  // Bump view counter, non-blocking.
  void (prisma as any).testTrackingToken
    .update({
      where: { id: tt.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
    .catch(() => null);

  const events = await (prisma as any).testTrackingEvent.findMany({
    where: { testRequestId: tt.testRequestId, isPublic: true },
    orderBy: { occurredAt: "asc" },
    select: { id: true, state: true, label: true, occurredAt: true, metadata: true },
  });

  const currentState = tt.testRequest.trackingState || events.at(-1)?.state || null;
  const latestAt =
    events.at(-1)?.occurredAt || tt.testRequest.trackingUpdatedAt || tt.testRequest.createdAt;
  const eta = currentState && latestAt ? await projectNextEta(currentState, new Date(latestAt)) : null;

  const pageStrings = (t as any)?.publicTrack || {};
  const labels = {
    title: pageStrings.title || "Test tracking",
    poNumber: pageStrings.poNumber || "Test #",
    brand: pageStrings.brand || "Brand",
    fabric: pageStrings.fabric || "Fabric",
    currentStatus: pageStrings.currentStatus || "Current status",
    eta: pageStrings.eta || "Expected next step",
    timeline: pageStrings.timeline || "Timeline",
    behindSchedule: pageStrings.behindSchedule || "Behind schedule",
    subscribeTitle: pageStrings.subscribeTitle || "Get updates by email",
    subscribeDescription:
      pageStrings.subscribeDescription ||
      "We'll send you a one-line email every time this test moves to a new state.",
    expired: pageStrings.expired || "This tracking link has expired.",
    completed: pageStrings.completed || "This test is complete.",
    poweredBy: pageStrings.poweredBy || "Powered by FUZE Atlas",
  };

  const seenStates = new Set(events.map((e: any) => e.state));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-indigo-600">FUZE</span>
            <span className="text-sm text-slate-500">Atlas</span>
          </div>
          <div className="text-xs text-slate-400">{labels.title}</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {expired && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {labels.expired}
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {labels.poNumber}
              </div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {tt.testRequest.poNumber || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{labels.brand}</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {tt.testRequest.brand?.name || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{labels.fabric}</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {tt.testRequest.fuzeFabricNumber || tt.testRequest.fabric?.fuzeNumber || "—"}
              </div>
              <div className="text-xs text-slate-500">
                {tt.testRequest.customerFabricCode || tt.testRequest.fabric?.customerCode || ""}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {labels.currentStatus}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900">
            {STATE_LABELS_FALLBACK[currentState || ""] || currentState || "—"}
          </div>
          {eta && (
            <div className="mt-3 flex items-start gap-3 rounded-md border border-indigo-100 bg-indigo-50 p-3">
              <div className="text-sm text-indigo-700">
                <div className="font-medium">{labels.eta}</div>
                <div className="mt-0.5 text-xs">
                  {STATE_LABELS_FALLBACK[eta.nextState] || eta.nextState} — {fmtDate(eta.etaAt)}
                </div>
              </div>
              {eta.behindSchedule && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {labels.behindSchedule}
                </span>
              )}
            </div>
          )}
          {currentState === "COMPLETE" && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {labels.completed}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="mb-3 text-sm font-medium text-slate-700">{labels.timeline}</h2>
          <ol className="relative ml-3 border-l border-slate-200">
            {TRACKING_STATES.map((state) => {
              const ev = events.find((e: any) => e.state === state);
              const passed = ev != null;
              const isCurrent = state === currentState;
              return (
                <li key={state} className="mb-4 ml-4">
                  <div
                    className={[
                      "absolute -ml-[27px] mt-1 h-3 w-3 rounded-full border-2",
                      passed
                        ? "border-emerald-500 bg-emerald-500"
                        : isCurrent
                        ? "border-indigo-500 bg-white"
                        : "border-slate-300 bg-white",
                    ].join(" ")}
                  />
                  <div
                    className={[
                      "text-sm",
                      passed ? "text-slate-900" : "text-slate-400",
                      isCurrent ? "font-semibold text-indigo-700" : "",
                    ].join(" ")}
                  >
                    {STATE_LABELS_FALLBACK[state] || state}
                  </div>
                  {ev && (
                    <div className="mt-0.5 text-xs text-slate-500">{fmtDate(ev.occurredAt)}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {!expired && currentState !== "COMPLETE" && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">{labels.subscribeTitle}</h2>
            <p className="mt-1 text-xs text-slate-500">{labels.subscribeDescription}</p>
            <div className="mt-3">
              <SubscribeForm token={token} />
            </div>
          </section>
        )}

        <footer className="pt-4 pb-8 text-center text-xs text-slate-400">{labels.poweredBy}</footer>
      </main>
    </div>
  );
}
