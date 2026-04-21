// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/send
 *
 * Ship an outbound drafted in the BD Wizard. This endpoint is the atomic
 * "commit" step — everything that must happen when a rep hits "Send":
 *
 *   1. Validate the draft (not empty, humanize pass re-run defensively)
 *   2. Dispatch via Resend (or LinkedIn stub) using the rep's outbound From:
 *   3. Auto-assign the brand to the rep (salesRepId) if still unassigned
 *      — Andrew's requirement: "auto-assign brand to BD rep on completion"
 *   4. Log an OUTBOUND email Note on the brand + contact
 *   5. Log an OutreachMessage row for channel-level analytics
 *   6. Upsert a ContactOutreach row (the per-rep check mark)
 *   7. Update Contact.outreachStatus + lastContactedAt + outreachCount
 *   8. Bump Brand.lastActivityAt + clear inactivityWarnedAt
 *   9. Fire a separate "what went out" BCC summary to the rep if they set
 *      outboundFromEmail (Andrew's requirement). We do this as a second
 *      email (not a real BCC header) because Resend's BCC puts the rep's
 *      address in the recipient's header in some clients, which we don't
 *      want — the rep should see a clean "here's what went out" note.
 *
 *   body = {
 *     brandId: string,
 *     contactId: string,
 *     channel: "email" | "linkedin",
 *     subject?: string,  // required for email
 *     body: string,
 *   }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { humanize } from "@/lib/humanize";
import { createSequenceForFirstSend, markStepSent } from "@/lib/bd-sequence";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain-text body → HTML, preserving line breaks but nothing else. */
function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function fromHeader(
  fromEmail: string | null,
  fromName: string | null,
  userName: string,
  userEmail: string,
): string | null {
  if (!fromEmail) return null;
  const display = (fromName || userName || userEmail.split("@")[0] || "").trim();
  return display ? `${display} <${fromEmail}>` : fromEmail;
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isBDEligible =
      sessionUser.role === "ADMIN" ||
      sessionUser.role === "EMPLOYEE" ||
      sessionUser.role === "SALES_MANAGER" ||
      sessionUser.role === "SALES_REP";
    if (!isBDEligible) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      brandId,
      contactId,
      channel = "email",
      subject: rawSubject,
      body: rawBody,
      // Phase 3: when sending against an existing sequence step (e.g. Email D9
      // follow-up) the wizard passes the stepId so we mark the step sent
      // instead of creating a brand new sequence. Optional — omit for the
      // first-touch send and we'll create the sequence ourselves.
      stepId: rawStepId,
    } = body || {};
    const stepId: string | null = rawStepId ? String(rawStepId) : null;

    if (!brandId || !contactId || !rawBody) {
      return NextResponse.json(
        { ok: false, error: "brandId, contactId, and body are required" },
        { status: 400 },
      );
    }
    if (channel !== "email" && channel !== "linkedin") {
      return NextResponse.json(
        { ok: false, error: "channel must be 'email' or 'linkedin'" },
        { status: 400 },
      );
    }
    if (channel === "email" && (!rawSubject || !String(rawSubject).trim())) {
      return NextResponse.json(
        { ok: false, error: "subject is required for email sends" },
        { status: 400 },
      );
    }

    // Fetch the full user so we have outboundFrom* (session doesn't carry them)
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        outboundFromEmail: true,
        outboundFromName: true,
        outboundSignature: true,
      },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 401 });
    }

    const [brand, contact] = await Promise.all([
      prisma.brand.findUnique({ where: { id: brandId } }),
      prisma.contact.findUnique({ where: { id: contactId } }),
    ]);
    if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    if (!contact || contact.brandId !== brandId) {
      return NextResponse.json(
        { ok: false, error: "Contact not found on this brand" },
        { status: 404 },
      );
    }
    if (channel === "email" && !contact.email) {
      return NextResponse.json(
        { ok: false, error: "Contact has no email — can't send email channel" },
        { status: 400 },
      );
    }

    // Defensive: re-humanize both subject and body right before send.
    // The rep may have pasted something new into the textarea.
    const subject = humanize(String(rawSubject || ""))
      .replace(/\n/g, " ")
      .trim();
    let bodyOut = humanize(String(rawBody));

    // Append the rep's signature if they set one and it isn't already in the body.
    if (user.outboundSignature && !bodyOut.includes(user.outboundSignature.trim().slice(0, 40))) {
      bodyOut = `${bodyOut}\n\n${user.outboundSignature.trim()}`;
    }

    const from = fromHeader(user.outboundFromEmail, user.outboundFromName, user.name, user.email);

    let sendResult: any = { ok: true, stub: true };
    let externalId: string | undefined;

    if (channel === "email") {
      const html = textToHtml(bodyOut);
      sendResult = await sendEmail({
        to: contact.email!,
        subject,
        html,
        from: from || undefined,
        replyTo: user.outboundFromEmail || user.email,
      });
      if (!sendResult.ok) {
        return NextResponse.json(
          { ok: false, error: `Email send failed: ${sendResult.error || "unknown"}` },
          { status: 502 },
        );
      }
      externalId = sendResult.id;
    } else {
      // LinkedIn: no programmatic API. We log the intent and mark it as
      // "drafted" — the rep copies the text into LinkedIn's UI manually.
      // The long-funnel (Phase 3) will add the LI Unipile integration.
      sendResult = { ok: true, stub: "linkedin-manual" };
    }

    // ─── Persist everything atomically ────────────────────────
    const sentAt = new Date();
    let createdSequenceId: string | null = null;
    let advancedStepId: string | null = null;

    await prisma.$transaction(async (tx) => {
      // 1. Log the OUTBOUND email Note (timeline entry)
      await tx.note.create({
        data: {
          content:
            channel === "email"
              ? `[Email sent via BD Wizard]\nSubject: ${subject}\n\n${bodyOut}`
              : `[LinkedIn DM drafted via BD Wizard — copy/paste to LinkedIn]\n\n${bodyOut}`,
          noteType: channel === "email" ? "EMAIL" : "LINKEDIN",
          date: sentAt,
          brandId,
          contactId,
          userId: user.id,
          contactName:
            contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          emailDirection: channel === "email" ? "OUTBOUND" : null,
          emailSubject: channel === "email" ? subject : null,
          emailFrom: channel === "email" ? from || user.email : null,
          emailTo: channel === "email" ? contact.email : null,
          emailMessageId: externalId || null,
        },
      });

      // 2. OutreachMessage (channel-level analytics)
      await tx.outreachMessage.create({
        data: {
          contactId,
          channel: channel === "email" ? "email" : "linkedin",
          template: "bd_wizard",
          subject: channel === "email" ? subject : null,
          body: bodyOut,
          toAddress:
            channel === "email" ? contact.email! : contact.linkedinUrl || contact.name || "",
          status: channel === "email" ? "sent" : "drafted",
          sentAt,
          externalId: externalId || null,
          sentBy: user.id,
        },
      });

      // 3. Per-rep check mark (unique on contact+user+type)
      await tx.contactOutreach.upsert({
        where: {
          contactId_userId_type: {
            contactId,
            userId: user.id,
            type: channel === "email" ? "EMAIL" : "LINKEDIN",
          },
        },
        create: {
          contactId,
          userId: user.id,
          type: channel === "email" ? "EMAIL" : "LINKEDIN",
          sentAt,
        },
        update: { sentAt },
      });

      // 4. Contact outreach counters
      await tx.contact.update({
        where: { id: contactId },
        data: {
          outreachStatus: "contacted",
          lastContactedAt: sentAt,
          outreachCount: { increment: 1 },
        },
      });

      // 5. Brand auto-assign + activity bump
      const brandPatch: any = {
        lastActivityAt: sentAt,
        inactivityWarnedAt: null,
      };
      if (!brand.salesRepId) {
        brandPatch.salesRepId = user.id;
      }
      await tx.brand.update({ where: { id: brandId }, data: brandPatch });

      // 6. Phase 3 sequence orchestration. Two flows:
      //
      //   a) stepId passed → rep is sending a sequence step (email D9 follow-up,
      //      LI DM, etc.). Mark that step sent and let the counters recompute.
      //
      //   b) no stepId    → first-touch send. If no active sequence exists yet
      //      for (brand, contact, rep) we create one. Step 0 (LI connect) gets
      //      skipped, step 1 (email) gets marked sent, and steps 2+ wait for
      //      the cron to tick them ready.
      //
      // We fetch the OutreachMessage id we just wrote so we can link the step
      // back to it for timeline joins.
      const om = await tx.outreachMessage.findFirst({
        where: { contactId, sentBy: user.id, sentAt },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const outreachMessageId = om?.id || null;

      if (stepId) {
        // Explicit step send — fired from /acm/tasks or the sequence dashboard.
        await markStepSent({
          tx,
          stepId,
          outreachMessageId,
          draftSubject: channel === "email" ? subject : null,
          draftBody: bodyOut,
        });
        advancedStepId = stepId;
      } else if (channel === "email") {
        // First-touch email — spin up the long-funnel sequence if one isn't already active.
        const seq = await createSequenceForFirstSend({
          tx,
          brandId,
          contactId,
          repId: user.id,
          startedAt: sentAt,
          outreachMessageId,
          firstEmailSubject: subject,
          firstEmailBody: bodyOut,
        });
        createdSequenceId = seq?.id || null;
      }
    });

    // ─── Fire-and-forget: BCC summary to the rep ──────────────
    // Andrew's requirement: "the rep gets a bcc on the outbound email so
    // they know exactly what went out and how it looked". We send a
    // separate summary (not a Resend BCC header) so the rep sees a clean
    // "this is what the prospect received" view without their address
    // appearing on the real outbound.
    if (user.outboundFromEmail && channel === "email" && sendResult.ok && !sendResult.stub) {
      const summaryHtml = `
        <div style="font-family:system-ui,sans-serif;color:#1a1a2e;max-width:640px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">BD Wizard — Sent</div>
            <div style="font-size:14px;color:#334155;margin-top:4px;">
              <div><strong>Brand:</strong> ${escapeHtml(brand.name)}</div>
              <div><strong>To:</strong> ${escapeHtml(contact.name || contact.email || "")} &lt;${escapeHtml(contact.email || "")}&gt;</div>
              <div><strong>From:</strong> ${escapeHtml(from || user.email)}</div>
              <div><strong>Subject:</strong> ${escapeHtml(subject)}</div>
              <div><strong>Sent:</strong> ${sentAt.toISOString()}</div>
            </div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:white;">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Message body (exactly what was sent)</div>
            <div style="font-size:14px;line-height:1.5;color:#1a1a2e;white-space:pre-wrap;">${textToHtml(bodyOut)}</div>
          </div>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px;">This summary was sent to you because you are the rep on record for this outbound. The recipient did not see it. Replies go to your inbox normally.</p>
        </div>
      `;
      sendEmail({
        to: user.outboundFromEmail,
        subject: `[BD Wizard] Sent: ${subject}`,
        html: summaryHtml,
        from: from || undefined,
      }).catch((e) => console.error("[bd/wizard/send] BCC summary failed:", e));
    }

    return NextResponse.json({
      ok: true,
      channel,
      sentAt: sentAt.toISOString(),
      autoAssignedToRep: !brand.salesRepId,
      externalId,
      stub: sendResult.stub || null,
      sequenceId: createdSequenceId,
      stepId: advancedStepId,
    });
  } catch (err: any) {
    console.error("[bd/wizard/send] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send" },
      { status: 500 },
    );
  }
}
