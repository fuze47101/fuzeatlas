// @ts-nocheck
/**
 * GET /api/admin/bd/sequences/{id}/analytics — Phase 9C.
 *
 * Per-step funnel metrics for one BDSequence cadence. The id can be
 * either a specific BDSequence row OR a cadenceKey (e.g. "default")
 * — when a cadenceKey is passed, we aggregate across every sequence
 * using that template. The page surfaces both views.
 *
 * Returns per-step:
 *   step, channel, draftSubject (most common), sentCount, openCount,
 *   openRate, clickCount, clickRate, replyCount, replyRate,
 *   meetingsBooked, meetingsBookedRate, averageDaysToReply,
 *   averageDaysToMeeting, subjectVariants[]
 *
 * Meetings are matched against Meeting rows that mention either the
 * sequence's contactId OR brandId and that were created within 7
 * days of an OutreachMessage send.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

function daysBetween(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / 86400_000);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  // Accept either a specific BDSequence id or a cadenceKey. We probe
  // for a sequence row first; if none, treat as cadenceKey.
  const single = await prisma.bDSequence.findUnique({
    where: { id },
    select: { id: true, cadenceKey: true, brandId: true, contactId: true },
  });
  const cadenceKey = single?.cadenceKey || id;

  const sequences = await prisma.bDSequence.findMany({
    where: single ? { id } : { cadenceKey },
    select: { id: true, brandId: true, contactId: true, startedAt: true },
  });
  const sequenceIds = sequences.map((s) => s.id);

  if (sequenceIds.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: single ? "sequence" : "cadence",
      cadenceKey,
      totalSequences: 0,
      steps: [],
    });
  }

  const steps = await prisma.bDSequenceStep.findMany({
    where: { sequenceId: { in: sequenceIds } },
    select: {
      id: true,
      sequenceId: true,
      stepIndex: true,
      channel: true,
      status: true,
      sentAt: true,
      draftSubject: true,
      outreachMessageId: true,
    },
  });

  const outreachIds = steps
    .map((s) => s.outreachMessageId)
    .filter((v): v is string => !!v);

  const outreach = outreachIds.length
    ? await prisma.outreachMessage.findMany({
        where: { id: { in: outreachIds } },
        select: {
          id: true,
          sentAt: true,
          openedAt: true,
          openCount: true,
          clickedAt: true,
          clickCount: true,
          repliedAt: true,
          subject: true,
          contactId: true,
        },
      })
    : [];

  const outreachById = new Map(outreach.map((o) => [o.id, o]));

  // Meetings within 7d of any send for any of the sequence's contacts.
  const contactIds = Array.from(new Set(sequences.map((s) => s.contactId)));
  const brandIds = Array.from(new Set(sequences.map((s) => s.brandId)));

  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [
        contactIds.length ? { contactId: { in: contactIds } } : undefined,
        brandIds.length ? { brandId: { in: brandIds } } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true, scheduledAt: true, createdAt: true, brandId: true, contactId: true },
  });

  // Bucket per stepIndex.
  const stepBuckets = new Map<
    number,
    {
      sentCount: number;
      openCount: number;
      clickCount: number;
      replyCount: number;
      meetingCount: number;
      subjects: Map<string, { sent: number; opens: number }>;
      daysToReplySum: number;
      daysToReplyN: number;
      daysToMeetingSum: number;
      daysToMeetingN: number;
      channel: string;
    }
  >();

  function bucketFor(idx: number, channel: string) {
    let b = stepBuckets.get(idx);
    if (!b) {
      b = {
        sentCount: 0,
        openCount: 0,
        clickCount: 0,
        replyCount: 0,
        meetingCount: 0,
        subjects: new Map(),
        daysToReplySum: 0,
        daysToReplyN: 0,
        daysToMeetingSum: 0,
        daysToMeetingN: 0,
        channel,
      };
      stepBuckets.set(idx, b);
    }
    return b;
  }

  for (const step of steps) {
    if (step.status !== "sent") continue;
    const b = bucketFor(step.stepIndex, step.channel);
    b.sentCount++;
    const om = step.outreachMessageId ? outreachById.get(step.outreachMessageId) : null;
    if (om) {
      if (om.openedAt) b.openCount++;
      if (om.clickedAt) b.clickCount++;
      if (om.repliedAt) {
        b.replyCount++;
        if (om.sentAt) {
          b.daysToReplySum += daysBetween(om.sentAt, om.repliedAt);
          b.daysToReplyN++;
        }
      }
      if (step.draftSubject || om.subject) {
        const subj = (step.draftSubject || om.subject || "").trim() || "(no subject)";
        const sv = b.subjects.get(subj) || { sent: 0, opens: 0 };
        sv.sent++;
        if (om.openedAt) sv.opens++;
        b.subjects.set(subj, sv);
      }
      // Was a meeting created within 7d of this send tied to the same contact?
      const meetingMatch = meetings.find((m) => {
        if (m.contactId !== om.contactId) return false;
        if (!om.sentAt) return false;
        const d = (m.createdAt.getTime() - om.sentAt.getTime()) / 86400_000;
        return d >= 0 && d <= 7;
      });
      if (meetingMatch) {
        b.meetingCount++;
        if (om.sentAt) {
          b.daysToMeetingSum += daysBetween(om.sentAt, meetingMatch.createdAt);
          b.daysToMeetingN++;
        }
      }
    }
  }

  const result = Array.from(stepBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([idx, b]) => ({
      step: idx,
      channel: b.channel,
      sentCount: b.sentCount,
      openCount: b.openCount,
      openRate: b.sentCount ? b.openCount / b.sentCount : 0,
      clickCount: b.clickCount,
      clickRate: b.sentCount ? b.clickCount / b.sentCount : 0,
      replyCount: b.replyCount,
      replyRate: b.sentCount ? b.replyCount / b.sentCount : 0,
      meetingsBooked: b.meetingCount,
      meetingsBookedRate: b.sentCount ? b.meetingCount / b.sentCount : 0,
      averageDaysToReply: b.daysToReplyN ? b.daysToReplySum / b.daysToReplyN : null,
      averageDaysToMeeting: b.daysToMeetingN ? b.daysToMeetingSum / b.daysToMeetingN : null,
      subjectVariants: Array.from(b.subjects.entries())
        .sort((a, z) => z[1].sent - a[1].sent)
        .slice(0, 8)
        .map(([subject, v]) => ({
          subject,
          sent: v.sent,
          opens: v.opens,
          openRate: v.sent ? v.opens / v.sent : 0,
        })),
    }));

  return NextResponse.json({
    ok: true,
    mode: single ? "sequence" : "cadence",
    cadenceKey,
    totalSequences: sequenceIds.length,
    steps: result,
  });
}
