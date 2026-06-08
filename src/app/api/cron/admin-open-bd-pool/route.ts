// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/admin-open-bd-pool
 *
 * BD pool opener — clears Ryan Prince's permanent claim on dead
 * prospects so the rest of the team can work them.
 *
 * Filter:
 *   - Brand owned by Ryan (salesRepId OR reservedBy)
 *   - pipelineStage in {LEAD, PRESENTATION}
 *   - no inbound reply: no OutreachMessage with repliedAt or
 *     status='replied' for any contact at this brand, AND no Note
 *     with emailDirection='INBOUND'
 *
 * Action per brand:
 *   - salesRepId=null, reservedBy=null, reservedUntil=null,
 *     inactivityWarnedAt=null
 *   - drop a Note ("Released to BD pool — no response under prior
 *     owner; reopened for the team")
 *
 * Idempotent — re-runs skip brands already unclaimed.
 *
 * Bearer-authed.
 *
 * Query overrides for dry-run / scoping:
 *   ?dryRun=1      → no writes; returns the candidate list.
 *   ?email=<addr>  → override owner email (defaults ryan.prince@fuze47.com).
 *   ?limit=<N>     → cap brands touched per run (default 5000).
 */
const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_OWNER_EMAIL = "ryan.prince@fuze47.com";
const TARGET_STAGES = ["LEAD", "PRESENTATION"];
const NOTE_TEXT = "Released to BD pool — no response under prior owner; reopened for the team";

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const ownerEmail = (url.searchParams.get("email") || DEFAULT_OWNER_EMAIL).toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") || 5000) | 0, 10000);

  const owner = await prisma.user.findFirst({
    where: { email: { equals: ownerEmail, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!owner) {
    return NextResponse.json({ ok: false, error: `Owner not found: ${ownerEmail}` }, { status: 404 });
  }

  // Pull all brands Ryan owns by either lever, in the LEAD/PRESENTATION
  // stages. We then walk each candidate's contacts to confirm "no
  // inbound reply" so the truly responsive accounts stay with Ryan.
  const candidates = await (prisma as any).brand.findMany({
    where: {
      AND: [
        { pipelineStage: { in: TARGET_STAGES } },
        {
          OR: [
            { salesRepId: owner.id },
            { reservedBy: owner.id },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      salesRepId: true,
      reservedBy: true,
      reservedUntil: true,
      inactivityWarnedAt: true,
      contacts: {
        select: {
          id: true,
          outreachMessages: {
            where: {
              OR: [
                { repliedAt: { not: null } },
                { status: "replied" },
              ],
            },
            select: { id: true },
            take: 1,
          },
          notes: {
            where: {
              OR: [
                { emailDirection: "INBOUND" },
                { noteType: "CALL" }, // inbound call counts as response
              ],
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    take: limit,
  });

  const noResponse = candidates.filter((b: any) =>
    b.contacts.every(
      (c: any) => c.outreachMessages.length === 0 && c.notes.length === 0,
    ),
  );
  const responsive = candidates.filter(
    (b: any) => !noResponse.some((nr: any) => nr.id === b.id),
  );

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      ownerEmail: owner.email,
      candidates: candidates.length,
      noResponse: noResponse.length,
      responsive: responsive.length,
      sample: noResponse.slice(0, 20).map((b: any) => ({
        id: b.id,
        name: b.name,
        stage: b.pipelineStage,
      })),
    });
  }

  let unclaimed = 0;
  const failures: any[] = [];
  for (const b of noResponse) {
    try {
      await prisma.$transaction([
        (prisma as any).brand.update({
          where: { id: b.id },
          data: {
            salesRepId: null,
            reservedBy: null,
            reservedUntil: null,
            inactivityWarnedAt: null,
          },
        }),
        prisma.note.create({
          data: {
            brandId: b.id,
            userId: owner.id, // attribute audit to the prior owner
            noteType: "NOTE",
            content: NOTE_TEXT,
            date: new Date(),
          },
        }),
      ]);
      unclaimed++;
    } catch (e: any) {
      failures.push({ id: b.id, name: b.name, error: e?.message || String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    ownerEmail: owner.email,
    ownerId: owner.id,
    candidates: candidates.length,
    unclaimed,
    skippedResponsive: responsive.length,
    failures,
    sampleUnclaimed: noResponse.slice(0, 20).map((b: any) => ({
      id: b.id,
      name: b.name,
      stage: b.pipelineStage,
    })),
    verdict:
      `Opened ${unclaimed} brand(s) to the BD pool. ${responsive.length} stayed with ${owner.name || owner.email} because they had real inbound traffic.`,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
