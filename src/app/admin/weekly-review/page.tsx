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
  const weekOf = mondayOf(new Date());
  const snapshot = await buildSnapshot(weekOf, 14);
  const created = await prisma.weeklyExecReport.upsert({
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

  redirect(`/admin/weekly-review/${created.id}`);
}
