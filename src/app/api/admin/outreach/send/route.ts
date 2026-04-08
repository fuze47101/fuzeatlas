// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/outreach/send
 * Send an SMS or email to a contact. Records the outreach in OutreachMessage.
 *
 * Body: { contactId, channel: "sms"|"email", template?, subject?, body, toAddress? }
 *
 * SMS: Uses Twilio REST API (env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 * Email: Uses Resend (env: RESEND_API_KEY) — already in the stack for transactional emails
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin or manager only" }, { status: 403 });
    }

    const { contactId, channel, template, subject, body, toAddress } = await req.json();

    if (!contactId || !channel || !body) {
      return NextResponse.json({ ok: false, error: "contactId, channel, and body are required" }, { status: 400 });
    }

    // Get the contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { brand: { select: { name: true } } },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    // Determine destination
    const destination = toAddress || (channel === "sms" ? contact.phone : contact.email);
    if (!destination) {
      return NextResponse.json({ ok: false, error: `No ${channel === "sms" ? "phone" : "email"} for this contact` }, { status: 400 });
    }

    let externalId: string | null = null;
    let status = "sent";
    let failReason: string | null = null;

    if (channel === "sms") {
      // Send via Twilio REST API
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;

      if (!sid || !token || !from) {
        return NextResponse.json({ ok: false, error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in Vercel env vars." }, { status: 500 });
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const twilioAuth = Buffer.from(`${sid}:${token}`).toString("base64");

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: destination,
          From: from,
          Body: body,
        }),
      });

      const twilioData = await twilioRes.json();

      if (twilioRes.ok && twilioData.sid) {
        externalId = twilioData.sid;
        status = "sent";
      } else {
        status = "failed";
        failReason = twilioData.message || "Twilio send failed";
      }
    } else if (channel === "email") {
      // Send via Resend
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        return NextResponse.json({ ok: false, error: "Resend not configured. Set RESEND_API_KEY in Vercel env vars." }, { status: 500 });
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FUZE Biotech <outreach@fuzebiotech.com>",
          to: [destination],
          subject: subject || "FUZE Antimicrobial Treatment",
          html: body.replace(/\n/g, "<br>"),
        }),
      });

      const resendData = await resendRes.json();

      if (resendRes.ok && resendData.id) {
        externalId = resendData.id;
        status = "sent";
      } else {
        status = "failed";
        failReason = resendData.message || "Resend send failed";
      }
    } else {
      return NextResponse.json({ ok: false, error: "channel must be 'sms' or 'email'" }, { status: 400 });
    }

    // Record the outreach message
    const message = await prisma.outreachMessage.create({
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
      },
    });

    // Update contact outreach tracking
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        outreachStatus: contact.outreachStatus === "not_contacted" ? "contacted" : contact.outreachStatus,
        lastContactedAt: new Date(),
        outreachCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      ok: true,
      message,
      status,
      ...(failReason ? { failReason } : {}),
    });
  } catch (error: any) {
    console.error("Outreach send error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
