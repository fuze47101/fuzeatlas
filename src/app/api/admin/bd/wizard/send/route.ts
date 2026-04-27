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

/**
 * Plain-text body → HTML. Preserves line breaks AND auto-hyperlinks any
 * bare http(s) URL the rep typed into the draft so "watch this video:
 * https://youtu.be/abc" renders as a blue clickable link in Gmail/Outlook
 * instead of dead text.
 *
 * Order matters here — we HTML-escape first, then match URLs against the
 * escaped string. URLs can't contain `<`, `>`, `"`, or `'` so the escape
 * step won't corrupt them. We also strip common trailing punctuation
 * (period, comma, semicolon, close paren/bracket, etc.) off the matched
 * URL so "see https://example.com." doesn't link the period. The stripped
 * char is emitted after the closing </a> so the sentence still reads right.
 */
function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (match) => {
      // Strip trailing punctuation that's almost certainly sentence grammar,
      // not part of the URL. Leave it OUTSIDE the anchor.
      const trailingMatch = match.match(/^(.*?)([.,;:!?)\]}>'"]+)$/);
      const url = trailingMatch ? trailingMatch[1] : match;
      const tail = trailingMatch ? trailingMatch[2] : "";
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;text-decoration:underline;">${url}</a>${tail}`;
    },
  );
  return linked.replace(/\n/g, "<br/>");
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
      sessionUser.role === "SALES_REP" ||
      sessionUser.role === "BD_REP" ||
      sessionUser.role === "DISTRIBUTOR_USER";
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
      // Concurrency guard override (#101). When the duplicate-contact
      // check fires, the wizard shows a confirm dialog and re-posts with
      // force: true. We do NOT default this to true — the rep has to
      // consciously acknowledge "yes, Ryan emailed Viktor 12 min ago
      // and I still want to send".
      force: forceFlag,
    } = body || {};
    const stepId: string | null = rawStepId ? String(rawStepId) : null;
    const force = forceFlag === true;

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

    // ── Duplicate-contact guard (#101) ────────────────────────────
    // Even with the pick-time reservation, a narrow race still exists:
    // the reservation holds the *brand* but two reps could independently
    // send to the same *contact* via different entry points (wizard +
    // /brands/[id] 📧 button, or a stale tab that bypassed the
    // reservation lookup). Belt-and-suspenders: before we dispatch,
    // check whether a different rep already emailed this contact in
    // the last 24 hours. If so, bail with a 409 and let the rep
    // consciously override via `force: true`.
    //
    // We scope to sentBy != me so a rep can still re-send to a contact
    // they themselves already contacted (e.g. sequence follow-up).
    if (channel === "email" && !force) {
      const recent = await prisma.outreachMessage.findFirst({
        where: {
          contactId,
          channel: "email",
          status: { in: ["sent", "delivered"] },
          sentAt: { gt: new Date(Date.now() - 24 * 60 * 60_000) },
          sentBy: { not: sessionUser.id },
        },
        orderBy: { sentAt: "desc" },
        select: { id: true, sentAt: true, sentBy: true, subject: true },
      });
      if (recent) {
        const otherRep = recent.sentBy
          ? await prisma.user.findUnique({
              where: { id: recent.sentBy },
              select: { id: true, name: true, email: true },
            })
          : null;
        const hoursAgo = Math.max(
          1,
          Math.round((Date.now() - new Date(recent.sentAt).getTime()) / (60 * 60_000)),
        );
        return NextResponse.json(
          {
            ok: false,
            code: "already_contacted",
            error: `${otherRep?.name || "Another rep"} emailed ${contact.name || contact.email} about ${hoursAgo}h ago. Sending again this soon risks flagging ${contact.email} and our sending domain.`,
            otherRep: otherRep
              ? { id: otherRep.id, name: otherRep.name, email: otherRep.email }
              : null,
            previousSubject: recent.subject || null,
            previousSentAt: recent.sentAt.toISOString(),
            hoursAgo,
            allowForce: true,
          },
          { status: 409 },
        );
      }
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
      // ── Hard preflight: refuse to pretend-send. ──
      // Historically, missing RESEND_API_KEY made sendEmail return
      // { ok: true, stub: true }, which looked like a success to the rep
      // but never actually delivered anything. We now reject at the send
      // route so the UI can surface a setup modal instead of a phantom
      // "Sent" state.
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Email delivery is not configured on this server (RESEND_API_KEY missing). Nothing was sent.",
            code: "no_resend_key",
            setupPath: "/settings/email",
          },
          { status: 503 },
        );
      }
      if (!user.outboundFromEmail) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Your outbound 'From' address isn't set. Open Settings → Profile and configure your sending identity before sending.",
            code: "no_outbound_from",
            setupPath: "/settings/profile",
          },
          { status: 400 },
        );
      }

      const html = textToHtml(bodyOut);
      sendResult = await sendEmail({
        to: contact.email!,
        subject,
        html,
        from: from || undefined,
        replyTo: user.outboundFromEmail || user.email,
      });
      if (!sendResult.ok) {
        // Resend's error messages are developer-flavored. We preserve the
        // raw text in `details` but lead with a plain-language summary
        // that maps known failure modes to actionable fixes.
        const raw = String(sendResult.error || "unknown error");
        const lc = raw.toLowerCase();
        let friendly = `Email send failed: ${raw}`;
        let code = "resend_error";
        let setupPath: string | null = null;
        if (lc.includes("domain") && (lc.includes("verify") || lc.includes("not verified"))) {
          friendly = `The sending domain for ${from || user.outboundFromEmail} isn't verified in Resend yet. An admin needs to add and verify the DNS records before you can send from this address.`;
          code = "domain_unverified";
          setupPath = "/settings/email";
        } else if (lc.includes("api key") || lc.includes("unauthorized") || lc.includes("401")) {
          friendly =
            "Resend rejected our API key. Ask an admin to rotate RESEND_API_KEY — the current key is invalid or revoked.";
          code = "bad_api_key";
          setupPath = "/settings/email";
        } else if (lc.includes("invalid") && lc.includes("email")) {
          friendly = `Resend says the recipient address "${contact.email}" is invalid. Double-check the email on the contact record.`;
          code = "invalid_recipient";
        } else if (lc.includes("bounce") || lc.includes("suppressed")) {
          friendly = `That recipient address is on Resend's suppression list (bounced or complained previously). Find a different email before retrying.`;
          code = "suppressed";
        }
        return NextResponse.json(
          { ok: false, error: friendly, code, setupPath, details: raw },
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

      // 5. Brand auto-assign + activity bump + clear reservation.
      // The permanent claim (salesRepId) supersedes the soft
      // reservation — once this rep has actually emailed someone on
      // the brand, they own it. We clear reservedBy/reservedUntil so
      // the index doesn't carry a stale hold forever.
      const brandPatch: any = {
        lastActivityAt: sentAt,
        inactivityWarnedAt: null,
        reservedBy: null,
        reservedUntil: null,
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
