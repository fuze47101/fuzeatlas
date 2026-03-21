// @ts-nocheck
import { NextResponse } from "next/server";
import { PIPELINE_MEETING_TEMPLATES } from "@/lib/meeting-templates";

/* ── GET /api/meetings/templates ── List meeting templates ──── */
export async function GET() {
  const templates = Object.entries(PIPELINE_MEETING_TEMPLATES).map(
    ([stage, t]) => ({
      pipelineStage: stage,
      meetingType: t.meetingType,
      title: t.title,
      description: t.description,
      durationMinutes: t.durationMinutes,
      suggestedAttendees: t.suggestedAttendees,
      agenda: t.agenda,
    })
  );
  return NextResponse.json({ ok: true, templates });
}
