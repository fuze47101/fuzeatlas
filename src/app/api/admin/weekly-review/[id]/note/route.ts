// @ts-nocheck
/**
 * POST /api/admin/weekly-review/:id/note
 *
 * Author a note while reviewing the weekly report. The note is written
 * to the normal Note table (so it flows into the daily digest and the
 * brand's CRM timeline) AND back-linked to this weekly report via
 * Note.weeklyReportId so the appendix shows the review's paper trail.
 *
 * Writing a note also stamps Brand.lastActivityAt — same as a regular
 * CRM note — so at-risk customers get cleared out of the risk bucket
 * the moment you actually work them.
 *
 * Body:
 *   { brandId?: string, factoryId?: string, content: string, noteType?: string }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { gateReport } from "@/lib/weekly-review/access";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser().catch(() => null);
  const gate = await gateReport(id, user);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json({ ok: false, error: "content is required" }, { status: 400 });
  }
  if (!body.brandId && !body.factoryId) {
    return NextResponse.json({ ok: false, error: "brandId or factoryId is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      content,
      noteType: body.noteType || "WEEKLY_REVIEW",
      date: new Date(),
      brandId: body.brandId || null,
      factoryId: body.factoryId || null,
      userId: user.id,
      weeklyReportId: id,
    },
    select: {
      id: true, content: true, noteType: true, createdAt: true,
      brand: { select: { id: true, name: true } },
    },
  });

  // Stamp lastActivityAt on the brand/factory so the risk bucket updates.
  if (body.brandId) {
    await prisma.brand.update({
      where: { id: body.brandId },
      data: { lastActivityAt: new Date() },
    }).catch(() => { /* no-op if brand missing */ });
  }
  if (body.factoryId) {
    // Factories don't currently carry lastActivityAt — skip.
  }

  return NextResponse.json({ ok: true, note });
}
