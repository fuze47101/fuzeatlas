// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/rename-true-classic
 *
 * Scott Smith ticket cmpo6gtpc0001l104dqdg528h — "True Classic Tees"
 * dropped the "Tees" suffix; the parent company is now just "True
 * Classic." Idempotent: searches by case-insensitive partial match
 * on "True Classic" so re-runs find the already-renamed row and
 * skip.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // Look for any "True Classic*" brand that still has Tees / T-shirts /
  // similar suffix. Don't grab a brand that's already named just "True
  // Classic".
  const candidates = await prisma.brand.findMany({
    where: {
      AND: [
        { name: { contains: "True Classic", mode: "insensitive" } },
        { name: { not: { equals: "True Classic", mode: "insensitive" } } },
      ],
    } as any,
    select: { id: true, name: true } as any,
    take: 5,
  });
  const renamed: any[] = [];
  for (const b of candidates) {
    await prisma.brand.update({ where: { id: b.id }, data: { name: "True Classic" } as any });
    renamed.push({ id: b.id, from: b.name, to: "True Classic" });
  }
  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    renamed,
    verdict: renamed.length > 0
      ? `Renamed ${renamed.length} brand row(s) to "True Classic".`
      : "No rename needed — every match is already 'True Classic'.",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
