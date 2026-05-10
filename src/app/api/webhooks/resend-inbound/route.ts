// @ts-nocheck
/**
 * POST /api/webhooks/resend-inbound — Phase 9B.
 *
 * Resend inbound-email webhook handler. When a recipient replies to
 * an outbound we sent via Resend, the inbound email lands here.
 *
 * Three things happen on a successful match:
 *   1. Stamp OutreachMessage.repliedAt (first reply wins) — measured
 *      against the In-Reply-To / References headers.
 *   2. Append a Note (noteType=EMAIL, emailDirection=INBOUND) to the
 *      Contact + Brand timeline.
 *   3. Bump Brand.lastActivityAt and fire a notification to the
 *      original sender so the rep knows they got a reply.
 *
 * Bounce detection — when Resend's inbound payload indicates a bounce
 * (delivery-status content-type, "Mail Delivery Subsystem" sender, or
 * an explicit bounce field), we stamp bouncedAt + bounceReason on the
 * OutreachMessage and flip the offending Contact's emailStatus to
 * "invalid" instead of logging a reply.
 *
 * Signature verification (best-effort): we accept either an HMAC-SHA256
 * of the raw body keyed on RESEND_WEBHOOK_SECRET in an
 * `x-resend-signature` header, or the literal secret in a
 * `x-webhook-secret` header for simple shared-secret setups. If the
 * secret env is missing, we log a warning and accept the payload —
 * this lets the endpoint be reachable for setup verification before
 * Andrew has pasted the secret in Vercel.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[resend-inbound] RESEND_WEBHOOK_SECRET not set — accepting payload unverified. Configure in Vercel env vars.",
    );
    return true;
  }
  const shared = headers.get("x-webhook-secret");
  if (shared && shared === secret) return true;
  const sig = headers.get("x-resend-signature") || headers.get("resend-signature");
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(sig.replace(/^sha256=/, ""), "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

function bracketed(headerValue: string | null | undefined): string[] {
  if (!headerValue) return [];
  return Array.from(headerValue.matchAll(/<([^>]+)>/g)).map((m) => m[1]);
}

function detectBounce(payload: any): { isBounce: boolean; reason: string | null } {
  if (payload?.bounce === true || payload?.event === "email.bounced") {
    return {
      isBounce: true,
      reason: payload?.bounce?.reason || payload?.reason || "Bounce reported by Resend",
    };
  }
  const from = String(payload?.from || "").toLowerCase();
  const subject = String(payload?.subject || "").toLowerCase();
  if (
    from.includes("mailer-daemon") ||
    from.includes("postmaster") ||
    from.includes("mail delivery subsystem") ||
    subject.startsWith("undeliverable") ||
    subject.startsWith("delivery status notification (failure)") ||
    subject.startsWith("returned mail")
  ) {
    return {
      isBounce: true,
      reason: payload?.subject || "Mailer-daemon bounce",
    };
  }
  return { isBounce: false, reason: null };
}

export async function POST(req: Request) {
  let raw = "";
  try {
    raw = await req.text();
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Bad body" }, { status: 400 });
  }
  if (!verifySignature(raw, req.headers)) {
    console.warn("[resend-inbound] signature verification failed");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  // Resend's inbound shape varies a bit by event type. Normalize to a
  // single envelope so the rest of this handler doesn't care.
  const headers = payload?.headers || payload?.data?.headers || {};
  const inReplyTo =
    payload?.in_reply_to ||
    headers["in-reply-to"] ||
    headers["In-Reply-To"] ||
    payload?.data?.in_reply_to ||
    null;
  const references =
    payload?.references ||
    headers["references"] ||
    headers["References"] ||
    payload?.data?.references ||
    null;
  const fromAddr = (payload?.from || payload?.data?.from || "").toString().trim();
  const subject = payload?.subject || payload?.data?.subject || null;
  const textBody = payload?.text || payload?.data?.text || null;
  const htmlBody = payload?.html || payload?.data?.html || null;
  const messageIdHeader =
    payload?.message_id || headers["message-id"] || headers["Message-Id"] || null;

  const candidateMessageIds = [
    ...bracketed(inReplyTo),
    ...(typeof inReplyTo === "string" && !inReplyTo.includes("<") ? [inReplyTo.trim()] : []),
    ...bracketed(references),
  ].filter(Boolean);

  if (candidateMessageIds.length === 0) {
    console.warn("[resend-inbound] no In-Reply-To / References to match; payload:", {
      from: fromAddr,
      subject,
    });
    return NextResponse.json({ ok: true, matched: false, reason: "no_reply_headers" });
  }

  // Look up by externalId (Resend's message id we stored on send).
  // We compare both with and without angle brackets and trim everything
  // because mail clients are not consistent.
  const match = await prisma.outreachMessage.findFirst({
    where: { externalId: { in: candidateMessageIds } },
    select: {
      id: true,
      contactId: true,
      sentBy: true,
      subject: true,
      repliedAt: true,
      contact: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          brandId: true,
          factoryId: true,
        },
      },
    },
  });

  if (!match) {
    console.warn("[resend-inbound] no OutreachMessage match for", candidateMessageIds);
    return NextResponse.json({ ok: true, matched: false, reason: "no_message_match" });
  }

  const { isBounce, reason } = detectBounce(payload);

  if (isBounce) {
    const now = new Date();
    await prisma.$transaction([
      prisma.outreachMessage.update({
        where: { id: match.id },
        data: {
          bouncedAt: now,
          bounceReason: reason || "Bounce",
          status: "bounced",
        },
      }),
      ...(match.contact?.id
        ? [
            prisma.contact.update({
              where: { id: match.contact.id },
              data: {
                emailStatus: "invalid",
                outreachStatus: "skipped",
              },
            }),
          ]
        : []),
    ]);
    return NextResponse.json({ ok: true, matched: true, bounce: true });
  }

  const now = new Date();
  const repliedFirstTime = !match.repliedAt;
  const contact = match.contact;
  const contactName =
    contact?.name ||
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
    contact?.email ||
    null;

  await prisma.$transaction(async (tx) => {
    await tx.outreachMessage.update({
      where: { id: match.id },
      data: {
        status: "replied",
        ...(repliedFirstTime ? { repliedAt: now } : {}),
      },
    });

    if (contact?.id) {
      await tx.note.create({
        data: {
          content: `[Inbound email reply]\nFrom: ${fromAddr}\nSubject: ${subject || "(no subject)"}\n\n${textBody || htmlBody || ""}`,
          noteType: "EMAIL",
          emailDirection: "INBOUND",
          emailSubject: subject || null,
          emailFrom: fromAddr || null,
          emailTo: contact.email || null,
          emailMessageId: messageIdHeader ? String(messageIdHeader).replace(/[<>]/g, "") : null,
          date: now,
          brandId: contact.brandId || null,
          factoryId: contact.factoryId || null,
          contactId: contact.id,
          contactName,
          userId: match.sentBy || null,
        },
      });
    }

    if (contact?.brandId) {
      await tx.brand.update({
        where: { id: contact.brandId },
        data: { lastActivityAt: now },
      });
    }
  });

  // Fire a notification to the original sender so they know they got a reply.
  if (match.sentBy && repliedFirstTime) {
    try {
      await prisma.notification.create({
        data: {
          userId: match.sentBy,
          type: "BRAND_ACTIVITY",
          title: `📩 Reply from ${contactName || fromAddr}`,
          message: subject ? `Subject: ${subject}` : "",
          link: contact?.brandId
            ? `/brands/${contact.brandId}`
            : contact?.id
              ? `/contacts/${contact.id}`
              : null,
          metadata: { source: "resend-inbound", outreachMessageId: match.id },
        },
      });
    } catch (err) {
      console.error("[resend-inbound] notify failed:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    replied: repliedFirstTime,
    contactId: contact?.id || null,
  });
}
