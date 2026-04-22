// @ts-nocheck
/**
 * POST /api/inbound/calendar-reply
 *
 * Phase 6 of ticket #23 calendar sync — accept/decline tracking via iMIP REPLY.
 *
 * Wire your inbound email provider to route messages with Content-Type
 * `text/calendar; method=REPLY` (or addressed to meeting-*@fuzeatlas.com)
 * to this endpoint. CloudMailin, Postmark Inbound, and SendGrid Parse all
 * support content-type or address-based routing rules.
 *
 * Auth: X-Webhook-Secret header must match env INBOUND_EMAIL_SECRET (we
 * intentionally reuse the same secret as /api/inbound/email so there's
 * one webhook credential to rotate).
 *
 * Payload — flexibly accepts:
 *   1. Provider JSON with attachments[].content_type=text/calendar — pulls
 *      the base64-decoded body from the attachment.
 *   2. Provider JSON with a top-level `text/calendar` field (rare, but
 *      Postmark "InboundParsed" can be configured to deliver it).
 *   3. Raw text body that's already iCalendar (Content-Type override on
 *      the request).
 *
 * What it does:
 *   1. Extract VCALENDAR text → find the VEVENT
 *   2. Parse UID → derive meetingId (matches `fuze-atlas-meeting-{id}@fuzeatlas.com`
 *      pattern from src/lib/meeting-templates.ts)
 *   3. Parse ATTENDEE line → email + PARTSTAT (ACCEPTED|DECLINED|TENTATIVE)
 *   4. Update Meeting.attendees JSON in-place: add/update partstat field
 *      on the matching attendee row
 *   5. Drop a Note on the brand timeline (if Meeting has brandId) so the
 *      rep sees "John at Acme accepted/declined"
 *   6. Fire a Notification on the meeting organizer
 *
 * Response: { ok: true, meetingId, attendeeEmail, partstat }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // ─── Auth ─────────────────────────────────────────────
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Inbound calendar replies not configured" },
      { status: 503 },
    );
  }
  const provided =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("x-atlas-secret") ||
    new URL(req.url).searchParams.get("secret");
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ─── Pull iCalendar text from one of the supported payload shapes ───
  const ctype = req.headers.get("content-type") || "";
  let icsText = "";
  let payloadHint: any = null;

  if (ctype.includes("text/calendar")) {
    icsText = await req.text();
  } else if (ctype.includes("application/json")) {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    payloadHint = payload;
    icsText = extractIcsFromPayload(payload);
  } else {
    // Try text fallback (some providers POST as text/plain)
    icsText = await req.text();
  }

  if (!icsText || !/BEGIN:VCALENDAR/i.test(icsText)) {
    return NextResponse.json(
      { ok: false, error: "No iCalendar payload found in request" },
      { status: 400 },
    );
  }

  // ─── Parse VEVENT ─────────────────────────────────────────────
  const parsed = parseIcsReply(icsText);
  if (!parsed.uid) {
    return NextResponse.json(
      { ok: false, error: "Missing UID in iCalendar payload" },
      { status: 400 },
    );
  }

  // Method should be REPLY for iMIP responses. We don't hard-fail if
  // missing (some providers strip METHOD on forwarding) but we log it.
  if (parsed.method && parsed.method.toUpperCase() !== "REPLY") {
    console.warn(
      "[inbound/calendar-reply] Non-REPLY method:",
      parsed.method,
      "for UID:",
      parsed.uid,
    );
  }

  // UID format: fuze-atlas-meeting-{cuid}@fuzeatlas.com
  const meetingIdMatch = parsed.uid.match(/^fuze-atlas-meeting-([^@]+)@/i);
  if (!meetingIdMatch) {
    return NextResponse.json(
      {
        ok: false,
        error: `UID "${parsed.uid}" doesn't match Atlas meeting pattern`,
      },
      { status: 400 },
    );
  }
  const meetingId = meetingIdMatch[1];

  if (!parsed.attendeeEmail || !parsed.partstat) {
    return NextResponse.json(
      { ok: false, error: "Missing ATTENDEE email or PARTSTAT" },
      { status: 400 },
    );
  }

  // ─── Apply the partstat update ───────────────────────────────
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { brand: { select: { id: true, name: true } } },
  });
  if (!meeting) {
    return NextResponse.json(
      { ok: false, error: `Meeting ${meetingId} not found` },
      { status: 404 },
    );
  }

  const attendees: any[] = Array.isArray(meeting.attendees)
    ? [...(meeting.attendees as any[])]
    : [];

  const targetEmailLower = parsed.attendeeEmail.toLowerCase();
  let matchIndex = attendees.findIndex(
    (a) =>
      a?.email && String(a.email).toLowerCase() === targetEmailLower,
  );

  const partstatNormalized = parsed.partstat.toUpperCase();
  const respondedAt = new Date().toISOString();

  if (matchIndex >= 0) {
    attendees[matchIndex] = {
      ...attendees[matchIndex],
      partstat: partstatNormalized,
      respondedAt,
    };
  } else {
    // Reply from someone not on the original list — append them. Outlook
    // allows replying-on-behalf which can produce this, and we'd rather
    // capture the data than drop it.
    attendees.push({
      email: parsed.attendeeEmail,
      name: parsed.attendeeName || parsed.attendeeEmail,
      partstat: partstatNormalized,
      respondedAt,
      addedFromReply: true,
    });
    matchIndex = attendees.length - 1;
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { attendees },
  });

  // ─── Side effects: brand-timeline note + organizer notification ──
  const verb =
    partstatNormalized === "ACCEPTED"
      ? "accepted"
      : partstatNormalized === "DECLINED"
        ? "declined"
        : partstatNormalized === "TENTATIVE"
          ? "tentatively accepted"
          : `responded ${partstatNormalized.toLowerCase()} to`;
  const attendeeLabel = parsed.attendeeName || parsed.attendeeEmail;

  // Note on brand timeline (if the meeting has a brand)
  if (meeting.brandId) {
    try {
      await prisma.note.create({
        data: {
          brandId: meeting.brandId,
          authorId: meeting.organizerId, // attribute to organizer; calendar replies aren't from a User
          content: `${attendeeLabel} ${verb} the meeting "${meeting.title}".`,
          noteType: "MEETING_REPLY",
        },
      });
    } catch (err) {
      console.warn(
        "[inbound/calendar-reply] note write failed (non-fatal):",
        err,
      );
    }
  }

  // Bell notification on organizer
  if (meeting.organizerId) {
    try {
      await prisma.notification.create({
        data: {
          userId: meeting.organizerId,
          type: "MEETING_RSVP",
          title: `${attendeeLabel} ${verb}`,
          message: `${attendeeLabel} ${verb} "${meeting.title}".`,
          link: `/meetings/${meeting.id}`,
          metadata: {
            meetingId: meeting.id,
            attendeeEmail: parsed.attendeeEmail,
            partstat: partstatNormalized,
          },
        },
      });
    } catch (err) {
      console.warn(
        "[inbound/calendar-reply] notification write failed (non-fatal):",
        err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    attendeeEmail: parsed.attendeeEmail,
    partstat: partstatNormalized,
  });
}

// ─── ICS extraction helpers ───────────────────────────────────────

function extractIcsFromPayload(payload: any): string {
  // CloudMailin shape: { attachments: [{ content_type, content (base64) }] }
  if (Array.isArray(payload?.attachments)) {
    for (const att of payload.attachments) {
      const ct = (att?.content_type || att?.contentType || att?.ContentType || "").toLowerCase();
      if (ct.includes("text/calendar") || ct.includes("application/ics")) {
        const raw = att.content || att.Content;
        if (raw) {
          try {
            return Buffer.from(raw, "base64").toString("utf8");
          } catch {
            return String(raw);
          }
        }
      }
    }
  }

  // Postmark shape
  if (Array.isArray(payload?.Attachments)) {
    for (const att of payload.Attachments) {
      const ct = String(att?.ContentType || "").toLowerCase();
      if (ct.includes("text/calendar")) {
        try {
          return Buffer.from(att.Content || "", "base64").toString("utf8");
        } catch {
          return String(att.Content || "");
        }
      }
    }
  }

  // Direct ICS field (some providers configurable)
  if (payload?.calendar) return String(payload.calendar);
  if (payload?.ics) return String(payload.ics);
  if (payload?.icalendar) return String(payload.icalendar);

  // Inline body fallback — rare but possible
  const candidates = [payload?.plain, payload?.text, payload?.TextBody, payload?.body];
  for (const c of candidates) {
    if (typeof c === "string" && /BEGIN:VCALENDAR/i.test(c)) return c;
  }

  return "";
}

interface ParsedReply {
  method: string | null;
  uid: string | null;
  attendeeEmail: string | null;
  attendeeName: string | null;
  partstat: string | null;
  sequence: number | null;
}

function parseIcsReply(text: string): ParsedReply {
  // Unfold continuation lines (RFC 5545 — CRLF + space/tab is a continuation)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const out: ParsedReply = {
    method: null,
    uid: null,
    attendeeEmail: null,
    attendeeName: null,
    partstat: null,
    sequence: null,
  };

  let inEvent = false;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) inEvent = true;
    if (/^END:VEVENT/i.test(line)) inEvent = false;

    if (/^METHOD:/i.test(line)) {
      out.method = line.split(":")[1]?.trim() || null;
    }

    if (inEvent && /^UID:/i.test(line)) {
      out.uid = line.slice(line.indexOf(":") + 1).trim();
    }

    if (inEvent && /^SEQUENCE:/i.test(line)) {
      const n = parseInt(line.split(":")[1] || "", 10);
      if (!isNaN(n)) out.sequence = n;
    }

    if (inEvent && /^ATTENDEE/i.test(line)) {
      // ATTENDEE;CN="John Doe";PARTSTAT=ACCEPTED:mailto:john@example.com
      const colonAt = line.lastIndexOf(":");
      if (colonAt < 0) continue;
      const params = line.slice(0, colonAt);
      const value = line.slice(colonAt + 1).trim();

      const mailto = value.match(/^mailto:(.+)$/i);
      if (mailto) {
        out.attendeeEmail = mailto[1].trim();
      } else {
        out.attendeeEmail = value;
      }

      const cnMatch = params.match(/CN=("([^"]+)"|([^;:]+))/i);
      if (cnMatch) out.attendeeName = (cnMatch[2] || cnMatch[3] || "").trim();

      const psMatch = params.match(/PARTSTAT=([A-Z-]+)/i);
      if (psMatch) out.partstat = psMatch[1].trim();
    }
  }

  return out;
}
