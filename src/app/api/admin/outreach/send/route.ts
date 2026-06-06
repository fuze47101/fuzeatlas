// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/outreach/send  (Task #20)
 *
 * Send an SMS or email to a contact and log the event across every surface
 * that cares about contact activity:
 *
 *   1. Dispatch via Twilio (SMS) or Resend (email)
 *   2. Write an OutreachMessage row  (legacy CRM widget still reads this)
 *   3. Write a Note with noteType=EMAIL and full email metadata so the
 *      contact's /contacts/[id]/activity timeline renders a proper email
 *      card instead of a blob of body text. This is the single source of
 *      truth the Weekly Exec Review leaderboard also reads from.
 *   4. Bump contact.lastContactedAt + outreachStatus
 *   5. Stamp Brand.lastActivityAt so the 90-day BD inactivity cron (#44)
 *      resets the countdown after a real outbound touch.
 *
 * Email body accepts plain text with newlines OR an HTML body. Plain text
 * is newline→<br> wrapped. A replyTo defaults to the sending user's email
 * so responses land in their inbox (Outlook BCC plumbing from #32 then
 * picks them back up as INBOUND Notes and the thread re-unifies).
 *
 * Body: {
 *   contactId: string,
 *   channel: "sms" | "email",
 *   template?: string,
 *   subject?: string,
 *   body: string,
 *   toAddress?: string,      // defaults to contact.email or contact.phone
 *   cc?: string | string[],
 *   bcc?: string | string[],
 *   replyTo?: string,        // defaults to sending user's email
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "BD_REP"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 403 });
    }

    // ── Accept either application/json (legacy) OR multipart/form-data
    // (when the EmailModal includes attachments). Multipart is the only
    // way to ship binary file content to a Next route handler without
    // re-encoding to base64 in the browser.
    //
    // Barth ticket May 2026: attachments were never wired through the
    // EmailModal → outreach/send path. Both shapes now work.
    const contentType = req.headers.get("content-type") || "";
    let payload: any;
    const attachments: { filename: string; contentType?: string; base64: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const jsonStr = form.get("payload");
      if (typeof jsonStr !== "string") {
        return NextResponse.json(
          { ok: false, error: "multipart upload must include a 'payload' JSON field" },
          { status: 400 }
        );
      }
      try {
        payload = JSON.parse(jsonStr);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Invalid JSON in 'payload' field" },
          { status: 400 }
        );
      }
      // Collect every File entry under the form key "attachments"
      const fileEntries = form.getAll("attachments");
      const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // Resend's hard cap
      let runningBytes = 0;
      for (const entry of fileEntries) {
        if (typeof entry === "string") continue;
        const file = entry as File;
        if (!file || !file.name) continue;
        runningBytes += file.size;
        if (runningBytes > MAX_TOTAL_BYTES) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Attachments exceed 25 MB total — Resend won't accept them. Drop one or compress.",
            },
            { status: 400 }
          );
        }
        const buf = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          base64: buf.toString("base64"),
        });
      }
    } else {
      payload = await req.json();
    }

    const { contactId, channel, template, subject, body, toAddress } = payload;
    const cc = normaliseAddrs(payload.cc);
    const bcc = normaliseAddrs(payload.bcc);
    const replyTo = payload.replyTo || user.email;

    if (!contactId || !channel || !body) {
      return NextResponse.json(
        { ok: false, error: "contactId, channel, and body are required" },
        { status: 400 }
      );
    }
    if (channel === "sms" && attachments.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Attachments not supported on SMS channel" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { brand: { select: { id: true, name: true } } },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    const destination = toAddress || (channel === "sms" ? contact.phone : contact.email);
    if (!destination) {
      return NextResponse.json(
        { ok: false, error: `No ${channel === "sms" ? "phone" : "email"} on this contact` },
        { status: 400 }
      );
    }

    // BUG 2 (Barth 2026-06-05) — refuse to send to known-invalid
    // email addresses. The contact's emailStatus is stamped at import
    // time + by Apollo enrichment; if it's already "invalid" /
    // "bounced" the user has been warned in the UI and the row has a
    // visual line-through. Catch the case where they hit Send anyway.
    if (channel === "email" && (contact as any).emailStatus) {
      const { isSendForbidden } = await import("@/lib/email-verify");
      if (isSendForbidden((contact as any).emailStatus)) {
        return NextResponse.json(
          {
            ok: false,
            error: `This contact's email is marked ${(contact as any).emailStatus} — send blocked to protect your sender reputation. Update the contact with a verified address first.`,
            emailStatus: (contact as any).emailStatus,
          },
          { status: 422 }
        );
      }
    }

    let externalId: string | null = null;
    let status = "sent";
    let failReason: string | null = null;
    let trackingToken: string | null = null;

    // ── 1. DISPATCH ──────────────────────────────────────────────────
    if (channel === "sms") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !token || !from) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in Vercel env vars.",
          },
          { status: 500 }
        );
      }

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: destination, From: from, Body: body }),
        }
      );
      const twilioData = await twilioRes.json();
      if (twilioRes.ok && twilioData.sid) {
        externalId = twilioData.sid;
      } else {
        status = "failed";
        failReason = twilioData.message || "Twilio send failed";
      }
    } else if (channel === "email") {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        return NextResponse.json(
          { ok: false, error: "Resend not configured. Set RESEND_API_KEY in Vercel env vars." },
          { status: 500 }
        );
      }

      // Phase 9A — instrument with a tracking pixel + click rewriter.
      const { newTrackingToken, instrumentHtml } = await import("@/lib/email-tracking");
      trackingToken = newTrackingToken();
      const rawHtml = /<\w+[^>]*>/.test(body) ? body : body.replace(/\n/g, "<br>");
      const html = instrumentHtml(rawHtml, trackingToken);
      const fromEmail = process.env.RESEND_OUTREACH_FROM || "outreach@fuzebiotech.com";
      const senderName = user.name ? `${user.name} (FUZE Biotech)` : "FUZE Biotech";

      const resendPayload: any = {
        from: `${senderName} <${fromEmail}>`,
        to: [destination],
        subject: subject || "FUZE Biotech — intro",
        html,
        reply_to: replyTo,
      };
      if (cc.length) resendPayload.cc = cc;
      if (bcc.length) resendPayload.bcc = bcc;
      // Attach files Barth (or any rep) dropped into the EmailModal.
      // Resend expects { filename, content (base64), content_type }.
      if (attachments.length) {
        resendPayload.attachments = attachments.map((a) => ({
          filename: a.filename,
          content: a.base64,
          content_type: a.contentType || "application/octet-stream",
        }));
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendPayload),
      });
      const resendData = await resendRes.json();
      if (resendRes.ok && resendData.id) {
        externalId = resendData.id;
      } else {
        status = "failed";
        failReason = resendData.message || resendData.error || "Resend send failed";
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "channel must be 'sms' or 'email'" },
        { status: 400 }
      );
    }

    // ── 2. PERSIST: OutreachMessage + Note + contact/brand activity ──
    // Writing inside a transaction so a partial failure never leaves the
    // timeline out of sync with the outreach log.
    const persisted = await prisma.$transaction(async (tx) => {
      const msg = await tx.outreachMessage.create({
        data: {
          contactId,
          channel,
          template: template || null,
          subject: subject || null,
          body,
          toAddress: destination,
          status,
          failReason,
          externalId,
          sentBy: user.id,
          // Phase 9A — only the email channel actually carries the
          // pixel + tracked links.
          trackingToken: channel === "email" ? trackingToken : null,
        },
      });

      // Only write the Note for successful email sends — a failed send
      // shouldn't polute the timeline. SMS also skipped; OutreachMessage
      // captures it with its own kind on the timeline.
      let note: any = null;
      if (channel === "email" && status === "sent") {
        note = await tx.note.create({
          data: {
            content: `${subject || "(no subject)"}\n\n${body}`,
            noteType: "EMAIL",
            date: new Date(),
            contactId,
            contactName: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
            userId: user.id,
            brandId: contact.brandId || null,
            factoryId: contact.factoryId || null,
            emailDirection: "OUTBOUND",
            emailSubject: subject || null,
            emailFrom: user.email || null,
            emailTo: destination,
            emailCc: cc.length ? cc.join(", ") : null,
            emailMessageId: externalId || null,
          },
        });
      }

      await tx.contact.update({
        where: { id: contactId },
        data: {
          outreachStatus:
            contact.outreachStatus === "not_contacted" ? "contacted" : contact.outreachStatus,
          lastContactedAt: new Date(),
          outreachCount: { increment: 1 },
        },
      });

      // Only stamp brand activity on successful send — failures don't
      // reset the inactivity clock.
      if (status === "sent" && contact.brandId) {
        await tx.brand.update({
          where: { id: contact.brandId },
          data: { lastActivityAt: new Date() },
        });
      }

      return { msg, note };
    });

    return NextResponse.json({
      ok: status === "sent",
      message: persisted.msg,
      note: persisted.note,
      status,
      ...(failReason ? { failReason } : {}),
    });
  } catch (error: any) {
    console.error("[outreach/send] error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

function normaliseAddrs(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
