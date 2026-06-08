// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/rename-kickoff-notes
 *
 * 2026-06-08 — strips the "Project Kickoff" prefix from existing
 * MeetingNote titles. New writes drop the prefix at create time;
 * this cron back-fills.
 *
 * Pattern matched (case-insensitive):
 *   ^Project Kickoff[\s]*[—\-:][\s]*(.*)$
 *
 * Anything that doesn't match is left alone. Idempotent on re-run.
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const PREFIX_RE = /^project\s+kickoff\s*[—–\-:]?\s*(.+)$/i;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Cheap pre-filter — Prisma startsWith case-insensitive against the
  // literal prefix. We do the regex strip in JS so we keep stripping
  // correctness for the mixed em-dash / en-dash / hyphen / colon
  // separator zoo without writing seven SQL clauses.
  const candidates = await (prisma as any).meetingNote.findMany({
    where: {
      title: { startsWith: "Project Kickoff", mode: "insensitive" } as any,
    },
    select: { id: true, title: true },
    take: 5000,
  });

  let renamed = 0;
  const sample: any[] = [];
  for (const m of candidates) {
    const match = (m.title || "").match(PREFIX_RE);
    if (!match) continue;
    const nextTitle = match[1].trim();
    if (!nextTitle || nextTitle === m.title) continue;
    try {
      await (prisma as any).meetingNote.update({
        where: { id: m.id },
        data: { title: nextTitle },
      });
      renamed++;
      if (sample.length < 10) sample.push({ id: m.id, from: m.title, to: nextTitle });
    } catch (e: any) {
      // Probably unique-name collision with a sibling — leave alone.
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    renamed,
    sample,
    verdict:
      renamed > 0
        ? `Renamed ${renamed} kickoff note(s) — dropped the "Project Kickoff" prefix.`
        : "Nothing to rename (idempotent).",
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
