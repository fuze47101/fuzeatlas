// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/fixup-monday-projects
 *
 * One-shot cleanup for the seed-monday-2026-05-27-projects run that
 * landed three small misses:
 *
 *  - MMI Project resolved its brandId to "Yummie" via contains match.
 *    Re-resolve to a brand whose name starts with "MMI" (e.g. "MMI
 *    Textiles") — exact-insensitive first, then prefix.
 *
 *  - Several projects (Hurricane, Nike, Allied, WooJoo, Seissence)
 *    landed on andrew@801inc.com as owner. Canonical Andrew is
 *    andrew@fuze47.com. Flip ownerId to fuze47 wherever the current
 *    owner is @801inc.com.
 *
 *  - Nike Project.priority should be URGENT (Priority 1 in Andrew's
 *    Monday notes). Stamp it now that the column exists.
 *
 * Idempotent — running twice is a no-op.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const log: any[] = [];

  // 1. MMI brand re-resolution.
  const mmiProject = await prisma.project.findFirst({
    where: { name: "MMI" },
    select: { id: true, brandId: true, brand: { select: { name: true } } },
  });
  if (mmiProject) {
    const target = await (prisma as any).brand.findFirst({
      where: {
        OR: [
          { name: { equals: "MMI", mode: "insensitive" } },
          { name: { startsWith: "MMI ", mode: "insensitive" } },
          { name: { startsWith: "MMI-", mode: "insensitive" } },
          { name: { equals: "MMI Textiles", mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (target && target.id !== mmiProject.brandId) {
      await prisma.project.update({
        where: { id: mmiProject.id },
        data: { brandId: target.id },
      });
      log.push({ fix: "mmi-brand", from: mmiProject.brand?.name, to: target.name });
    } else {
      log.push({ skip: "mmi-brand", reason: target ? "already correct" : "no MMI* brand found" });
    }
  }

  // 2. Andrew owner canonicalization.
  const andrewFuze = await prisma.user.findUnique({
    where: { email: "andrew@fuze47.com" },
    select: { id: true },
  });
  const andrew801 = await prisma.user.findUnique({
    where: { email: "andrew@801inc.com" },
    select: { id: true },
  });
  if (andrewFuze && andrew801) {
    const flipped = await prisma.project.updateMany({
      where: { ownerId: andrew801.id },
      data: { ownerId: andrewFuze.id },
    });
    log.push({ fix: "andrew-owner-canon", projectsReassigned: flipped.count });
  } else {
    log.push({ skip: "andrew-owner-canon", reason: "missing fuze47 or 801 Andrew" });
  }

  // 3. Nike Project.priority = URGENT.
  const nike = await prisma.project.findFirst({
    where: { name: "Nike" },
    select: { id: true, priority: true } as any,
  });
  if (nike) {
    if ((nike as any).priority !== "URGENT") {
      await prisma.project.update({
        where: { id: nike.id },
        data: { priority: "URGENT" } as any,
      });
      log.push({ fix: "nike-priority", newPriority: "URGENT" });
    } else {
      log.push({ skip: "nike-priority", reason: "already URGENT" });
    }
  } else {
    log.push({ skip: "nike-priority", reason: "Nike project not found" });
  }

  return NextResponse.json({ ok: true, log });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
