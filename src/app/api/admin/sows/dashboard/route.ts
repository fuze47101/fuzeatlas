// @ts-nocheck
/**
 * GET /api/admin/sows/dashboard
 *
 * Ryan's SOW oversight surface. Returns every SOW across every brand
 * with the data Ryan needs to keep the customer engagement portfolio
 * moving:
 *
 *   - status (DRAFT / SENT / SIGNED / ACTIVE / COMPLETE / CANCELLED)
 *   - last activity (max of SOW.updatedAt, latest milestone completedAt,
 *     latest test request createdAt — whichever is most recent)
 *   - milestone progress (completed / total + next due milestone)
 *   - stale flag (no activity in 14 days while status is in-flight)
 *   - signed-but-no-progress flag (SIGNED/ACTIVE for 30+ days with
 *     zero milestones completed)
 *   - brand info, primary AM (Brand.salesRep)
 *
 * Filters: ?status=… ?staleOnly=1 ?ownerId=…
 *
 * Sort: stale first (worst-aged at top), then by last activity desc.
 *
 * Auth: ADMIN, EMPLOYEE, SALES_MANAGER, BD_REP — anyone managing or
 * triaging SOWs. Reps see their own SOWs only unless ?all=1 is passed
 * by an admin.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const STALE_DAYS = 14;
const NO_PROGRESS_DAYS = 30;
const ACTIVE_STATUSES = ["DRAFT", "SENT", "SIGNED", "ACTIVE"];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");
    const staleOnly = url.searchParams.get("staleOnly") === "1";
    const isManager = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role);
    const wantAll = url.searchParams.get("all") === "1" && isManager;
    const ownerId = url.searchParams.get("ownerId") || (wantAll ? null : user.id);

    const where: any = {};
    if (statusFilter) where.status = statusFilter;
    if (ownerId && !wantAll) {
      where.brand = { salesRepId: ownerId };
    }

    const sows = await prisma.sOW.findMany({
      where,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            pipelineStage: true,
            salesRepId: true,
            lastActivityAt: true,
            salesRep: { select: { id: true, name: true, email: true } },
          },
        },
        milestones: {
          orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
        },
        _count: {
          select: {
            testRequests: true,
            documents: true,
            accessRequests: true,
          },
        },
        testRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const now = Date.now();
    const enriched = sows.map((s: any) => {
      // Compute lastActivityAt — max of SOW.updatedAt, latest
      // milestone.completedAt, latest testRequest.createdAt.
      const candidates: number[] = [
        new Date(s.updatedAt).getTime(),
      ];
      for (const m of s.milestones || []) {
        if (m.completedAt) candidates.push(new Date(m.completedAt).getTime());
      }
      if (s.testRequests?.[0]?.createdAt) {
        candidates.push(new Date(s.testRequests[0].createdAt).getTime());
      }
      const lastActivityMs = Math.max(...candidates);
      const daysSinceActivity = Math.floor(
        (now - lastActivityMs) / (24 * 60 * 60 * 1000),
      );

      const milestonesTotal = s.milestones.length;
      const milestonesDone = s.milestones.filter(
        (m: any) => m.completedAt,
      ).length;
      const nextMilestone =
        s.milestones.find((m: any) => !m.completedAt) || null;
      const overdueMilestones = s.milestones.filter(
        (m: any) =>
          !m.completedAt &&
          m.dueDate &&
          new Date(m.dueDate).getTime() < now,
      ).length;

      const isStale =
        ACTIVE_STATUSES.includes(s.status) &&
        daysSinceActivity >= STALE_DAYS;

      const ageMs =
        now - new Date(s.createdAt).getTime();
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      const signedNoProgress =
        ["SIGNED", "ACTIVE"].includes(s.status) &&
        milestonesTotal > 0 &&
        milestonesDone === 0 &&
        ageDays >= NO_PROGRESS_DAYS;

      return {
        id: s.id,
        title: s.title,
        status: s.status,
        signatory: s.signatory,
        signatoryTitle: s.signatoryTitle,
        signatoryEmail: s.signatoryEmail,
        brand: s.brand,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastActivityAt: new Date(lastActivityMs).toISOString(),
        daysSinceActivity,
        milestonesTotal,
        milestonesDone,
        milestonesPct:
          milestonesTotal > 0
            ? Math.round((milestonesDone / milestonesTotal) * 100)
            : null,
        nextMilestone: nextMilestone
          ? {
              id: nextMilestone.id,
              title: nextMilestone.title,
              dueDate: nextMilestone.dueDate,
            }
          : null,
        overdueMilestones,
        testRequestCount: s._count.testRequests,
        documentCount: s._count.documents,
        accessRequestCount: s._count.accessRequests,
        latestTestRequest: s.testRequests?.[0] || null,
        isStale,
        signedNoProgress,
        ageDays,
      };
    });

    const filtered = staleOnly
      ? enriched.filter((s: any) => s.isStale || s.signedNoProgress)
      : enriched;

    // Sort: stale + signed-no-progress at the top, then by daysSinceActivity desc
    filtered.sort((a: any, b: any) => {
      const ar = a.isStale || a.signedNoProgress ? 0 : 1;
      const br = b.isStale || b.signedNoProgress ? 0 : 1;
      if (ar !== br) return ar - br;
      return b.daysSinceActivity - a.daysSinceActivity;
    });

    const summary = {
      total: enriched.length,
      byStatus: enriched.reduce((acc: any, s: any) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {}),
      stale: enriched.filter((s: any) => s.isStale).length,
      signedNoProgress: enriched.filter((s: any) => s.signedNoProgress)
        .length,
      overdueMilestones: enriched.reduce(
        (s: number, x: any) => s + x.overdueMilestones,
        0,
      ),
    };

    return NextResponse.json({
      ok: true,
      sows: filtered,
      summary,
      scope: { wantAll, ownerId, isManager },
    });
  } catch (e: any) {
    console.error("[sows.dashboard] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
