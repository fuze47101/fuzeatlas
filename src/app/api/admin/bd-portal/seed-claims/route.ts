// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/bd-portal/seed-claims
 *
 * One-shot BD Portal bootstrap (#36 Phase 2). Idempotent — safe to re-run.
 *
 *   • Clears salesRepId on every brand in LEAD or PRESENTATION (Andrew's call:
 *     "clear out old claims like Steve Savage / Jenny Ploeger, clear ALL").
 *   • Sets User.canClaim = true for the named BD-capable folks. Everyone else
 *     stays at the default `false`.
 *
 * Body:
 *   {
 *     dryRun?: boolean,            // true → report changes without writing
 *     canClaimEmails?: string[]    // override the default allow-list
 *   }
 *
 * Auth: ADMIN only.
 */

// Default BD-capable roster — Andrew's list (4/17 BD walkthrough requirements).
// Anyone not on this list keeps canClaim = false and can't grab unclaimed brands.
// Hi-Goal distributor users are added by matching their distributorId at runtime.
const DEFAULT_CLAIM_EMAILS = [
  "andrew@801inc.com", // Andrew Long (CEO — always can claim)
  "scott@fuzebiotech.com", // Scott Pace (admin)
  "scott.smith@fuzebiotech.com",
  "viktor@fuzebiotech.com", // Viktor — independent rep
  "barth@fuzebiotech.com", // Barth — rep
  "tina@fuzebiotech.com", // Tina (admin)
  "jeremy.massey@fuzebiotech.com",
];

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = !!body.dryRun;
  const canClaimEmails: string[] = Array.isArray(body.canClaimEmails)
    ? body.canClaimEmails.map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_CLAIM_EMAILS.map((s) => s.toLowerCase());

  // ─── 1. Identify brands to unclaim (LEAD + PRESENTATION only) ───
  const preStage2 = await prisma.brand.findMany({
    where: {
      pipelineStage: { in: ["LEAD", "PRESENTATION"] as any },
      NOT: { salesRepId: null },
    },
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      salesRep: { select: { id: true, name: true, email: true } },
    },
    orderBy: { name: "asc" },
  });

  // ─── 2. Identify users to flip canClaim=true ───
  const usersToEnable = await prisma.user.findMany({
    where: { email: { in: canClaimEmails, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, canClaim: true },
  });

  // Missing emails → nice diagnostic so Andrew sees typos immediately.
  const foundEmails = new Set(usersToEnable.map((u: any) => u.email.toLowerCase()));
  const missingEmails = canClaimEmails.filter((e) => !foundEmails.has(e));

  // Hi-Goal: any active user attached to a distributor named Hi-Goal gets canClaim too.
  const hiGoalUsers = await prisma.user.findMany({
    where: {
      distributor: {
        is: { name: { contains: "Hi-Goal", mode: "insensitive" } },
      },
    },
    select: { id: true, email: true, name: true, canClaim: true },
  });

  const allEnableIds = Array.from(
    new Set([...usersToEnable.map((u: any) => u.id), ...hiGoalUsers.map((u: any) => u.id)]),
  );

  // ─── 3. Also EXPLICITLY set canClaim=false on everyone else, in case this is a re-bootstrap ───
  // We do NOT touch admins — admins can always claim, but the flag is informational.
  const allUsers = await prisma.user.findMany({
    select: { id: true, canClaim: true, role: true },
  });
  const toDisableIds = allUsers
    .filter((u: any) => !allEnableIds.includes(u.id) && u.role !== "ADMIN" && u.canClaim)
    .map((u: any) => u.id);

  const report = {
    dryRun,
    brandsToUnclaim: preStage2.length,
    brandsToUnclaimSample: preStage2.slice(0, 20).map((b: any) => ({
      id: b.id,
      name: b.name,
      stage: b.pipelineStage,
      currentRep: b.salesRep?.name || null,
    })),
    usersEnabled: allEnableIds.length,
    usersEnabledDetail: [
      ...usersToEnable.map((u: any) => ({ email: u.email, name: u.name, role: u.role })),
      ...hiGoalUsers.map((u: any) => ({ email: u.email, name: u.name, role: "HI_GOAL" })),
    ],
    usersDisabled: toDisableIds.length,
    missingEmails, // emails that were requested but don't exist in the User table
  };

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, report });
  }

  // ─── 4. Execute in a single transaction ───
  const preStage2Ids = preStage2.map((b: any) => b.id);
  await prisma.$transaction([
    prisma.brand.updateMany({
      where: { id: { in: preStage2Ids } },
      data: { salesRepId: null },
    }),
    prisma.user.updateMany({
      where: { id: { in: allEnableIds } },
      data: { canClaim: true },
    }),
    prisma.user.updateMany({
      where: { id: { in: toDisableIds } },
      data: { canClaim: false },
    }),
  ]);

  return NextResponse.json({ ok: true, report });
}
