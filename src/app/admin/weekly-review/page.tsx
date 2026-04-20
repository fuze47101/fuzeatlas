// @ts-nocheck
/**
 * /admin/weekly-review
 *
 * Landing route: redirects to the most recent report visible to the
 * caller. If none exists, ensures the current-week report is created
 * (server-side) and then redirects to it.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildSnapshot, mondayOf } from "@/lib/weekly-review/snapshot";

export const dynamic = "force-dynamic";

export default async function WeeklyReviewLanding() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?from=/admin/weekly-review");
  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") redirect("/home");

  // Look for a visible report first.
  const where: any = user.role === "ADMIN"
    ? {}
    : { OR: [{ ownedById: user.id }, { shares: { some: { userId: user.id } } }] };

  const existing = await prisma.weeklyExecReport.findFirst({
    where,
    orderBy: { weekOf: "desc" },
    select: { id: true },
  });

  if (existing) redirect(`/admin/weekly-review/${existing.id}`);

  // Admins only can bootstrap a fresh report. Non-admins without a
  // shared report land on an empty-state page.
  if (user.role !== "ADMIN") {
    return (
      <div className="p-10 max-w-2xl mx-auto text-slate-600">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Weekly Exec Review</h1>
        <p className="mt-4">
          No weekly report has been shared with you yet. Once Andrew shares a
          review, it will appear here.
        </p>
      </div>
    );
  }

  // Bootstrap current week's Monday with a 14-day backfill so the first
  // rendered report covers the last two weeks.
  //
  // buildSnapshot() touches ~15 different tables. Any single broken
  // reference (renamed column, missing relation, etc.) shouldn't crash
  // the whole review page — fall back to an empty snapshot and surface
  // the error in the page instead. Also logs the full stack so the Vercel
  // log shows exactly which sub-query blew up.
  const weekOf = mondayOf(new Date());
  let snapshot: any;
  let snapshotError: string | null = null;
  try {
    snapshot = await buildSnapshot(weekOf, 14);
  } catch (e: any) {
    console.error("[weekly-review] buildSnapshot failed:", e?.message, e?.stack, e);
    snapshotError = e?.message || String(e);
    snapshot = {
      version: 0,
      period: { start: weekOf.toISOString(), end: weekOf.toISOString(), days: 14, weekOf: weekOf.toISOString() },
      priorPeriod: { start: weekOf.toISOString(), end: weekOf.toISOString(), days: 14, weekOf: weekOf.toISOString() },
      kpis: [],
      sales: { bookedLiters: 0, shippedLiters: 0, bookedKg: 0, shippedKg: 0, bookedDollars: 0, shippedDollars: 0, newOrders: 0, shippedOrders: 0, deliveredOrders: 0, byOrderType: {} },
      sows: { new: [], signed: [], active: [], complete: [], stale: [], counts: { draft: 0, sent: 0, signed: 0, active: 0, complete: 0, cancelled: 0 } },
      bd: { stageWaterfall: [], leaderboard: [], handoffQueue: [], newBrands: [], atRisk: [] },
      testing: { completed: 0, passed: 0, failed: 0, byType: {}, recent: [] },
      build: { feedbackOpen: 0, feedbackResolved: 0, featuresShipped: [], buildNotes: [] },
      customersAtRisk: [],
      thisWeek: [],
      generatedAt: new Date().toISOString(),
      _error: snapshotError,
    };
  }

  let created;
  try {
    created = await prisma.weeklyExecReport.upsert({
      where: { weekOf },
      create: {
        weekOf,
        lookbackDays: 14,
        snapshot,
        ownedById: user.id,
        status: "DRAFT",
      },
      update: {
        snapshot,
        lookbackDays: 14,
        generatedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (e: any) {
    console.error("[weekly-review] upsert failed:", e?.message, e?.stack, e);
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900 mb-4">Weekly Exec Review — bootstrap error</h1>
        <p className="text-slate-600 mb-4">
          Couldn't create this week's report. This usually means the Prisma client
          and the live database have drifted out of sync.
        </p>
        <pre className="bg-red-50 border border-red-200 text-red-900 text-sm p-4 rounded overflow-auto">
          {e?.message || String(e)}
        </pre>
        {snapshotError ? (
          <>
            <p className="text-slate-600 mt-6 mb-2">buildSnapshot() also failed:</p>
            <pre className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 rounded overflow-auto">
              {snapshotError}
            </pre>
          </>
        ) : null}
      </div>
    );
  }

  redirect(`/admin/weekly-review/${created.id}`);
}
