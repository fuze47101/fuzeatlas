// @ts-nocheck
/**
 * Access control for the Weekly Exec Review.
 *
 * Three gates, evaluated in order:
 *   1. ADMIN — always allowed (audit-logged when used as override).
 *   2. Owner — user.id === report.ownedById.
 *   3. Explicit share — row in WeeklyExecReportShare for (reportId, userId).
 *
 * Everyone else → 403. This is intentionally *not* middleware-enforced
 * because middleware can't cheaply check the share table; the /admin
 * path prefix is gated as an internal-only path by middleware, and this
 * helper layers the per-report gate on top inside route handlers.
 */
import { prisma } from "@/lib/prisma";

export type AccessDecision =
  | { ok: true; via: "owner" | "admin" | "share"; report: any }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function gateReport(reportId: string, user: { id: string; role: string } | null): Promise<AccessDecision> {
  if (!user) return { ok: false, status: 401, error: "Not authenticated" };

  const report = await prisma.weeklyExecReport.findUnique({
    where: { id: reportId },
    include: {
      shares: { select: { userId: true, scope: true } },
      ownedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!report) return { ok: false, status: 404, error: "Report not found" };

  if (user.role === "ADMIN") return { ok: true, via: "admin", report };
  if (report.ownedById === user.id) return { ok: true, via: "owner", report };
  if (report.shares.some((s: any) => s.userId === user.id)) return { ok: true, via: "share", report };

  return { ok: false, status: 403, error: "Forbidden" };
}

/**
 * Who is allowed to *create* weekly reports? For MVP: ADMIN only. When we
 * onboard additional execs later, extend this with a user.canAuthorWeekly
 * flag (analogous to user.canClaim).
 */
export function canCreateReport(user: { role: string } | null) {
  return !!user && user.role === "ADMIN";
}

/** Who is allowed to share a report with another user? Owner or ADMIN. */
export function canShareReport(user: { id: string; role: string } | null, report: { ownedById: string }) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.id === report.ownedById;
}
