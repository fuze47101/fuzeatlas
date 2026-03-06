// @ts-nocheck
/**
 * Email utility for FUZE Atlas notifications
 * Uses Resend (https://resend.com) — set RESEND_API_KEY in .env
 * Free tier: 100 emails/day, 3000/month
 *
 * If RESEND_API_KEY is not set, emails are logged to console instead.
 */

const FUZE_FROM = "FUZE Atlas <notifications@fuzeatlas.com>";
const FUZE_COLOR = "#00b4c3";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("[EMAIL-STUB] No RESEND_API_KEY set. Would send:");
    console.log(`  To: ${Array.isArray(to) ? to.join(", ") : to}`);
    console.log(`  Subject: ${subject}`);
    console.log("  (Set RESEND_API_KEY to enable real email delivery)");
    return { ok: true, stub: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || FUZE_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[EMAIL] Resend error:", err);
      return { ok: false, error: err };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e: any) {
    console.error("[EMAIL] Send failed:", e.message);
    return { ok: false, error: e.message };
  }
}

// ─── Email Templates ───

function emailWrapper(content: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 3px solid ${FUZE_COLOR};">
        <h1 style="margin: 0; color: ${FUZE_COLOR}; font-size: 24px;">FUZE Atlas</h1>
      </div>
      <div style="padding: 24px 0;">
        ${content}
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px 0; text-align: center; color: #9ca3af; font-size: 12px;">
        FUZE Biotech &mdash; Antimicrobial Textile Solutions
      </div>
    </div>
  `;
}

export async function sendBookingNotification(params: {
  adminEmail: string;
  bookerName: string;
  bookerEmail: string;
  brandName?: string;
  meetingTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  teamsLink?: string;
  meetingId: string;
}) {
  const {
    adminEmail,
    bookerName,
    bookerEmail,
    brandName,
    meetingTitle,
    date,
    startTime,
    endTime,
    teamsLink,
    meetingId,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const meetingUrl = `${baseUrl}/meetings`;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">New Meeting Booking</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      <strong>${bookerName}</strong> (${bookerEmail})${brandName ? ` from <strong>${brandName}</strong>` : ""}
      has booked a meeting with you.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">${meetingTitle}</p>
      <p style="margin: 0 0 4px; color: #4b5563;">📅 ${date}</p>
      <p style="margin: 0 0 4px; color: #4b5563;">🕐 ${startTime} – ${endTime}</p>
      ${teamsLink ? `<p style="margin: 8px 0 0;"><a href="${teamsLink}" style="color: ${FUZE_COLOR}; text-decoration: none; font-weight: 500;">Join in Microsoft Teams →</a></p>` : ""}
    </div>
    <div style="margin: 24px 0;">
      <a href="${meetingUrl}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View in FUZE Atlas
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      This meeting was booked through the FUZE Atlas scheduling system.
      You can manage it from your <a href="${meetingUrl}" style="color: ${FUZE_COLOR};">meetings dashboard</a>.
    </p>
  `);

  return sendEmail({
    to: adminEmail,
    subject: `📅 New booking: ${meetingTitle} — ${date}`,
    html,
  });
}

export async function sendBookingConfirmation(params: {
  bookerEmail: string;
  bookerName: string;
  meetingTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  teamsLink?: string;
}) {
  const { bookerEmail, bookerName, meetingTitle, date, startTime, endTime, teamsLink } = params;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Meeting Confirmed</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${bookerName}, your meeting has been booked successfully.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">${meetingTitle}</p>
      <p style="margin: 0 0 4px; color: #4b5563;">📅 ${date}</p>
      <p style="margin: 0 0 4px; color: #4b5563;">🕐 ${startTime} – ${endTime}</p>
      ${teamsLink ? `<p style="margin: 8px 0 0;"><a href="${teamsLink}" style="color: ${FUZE_COLOR}; text-decoration: none; font-weight: 500;">Join in Microsoft Teams →</a></p>` : ""}
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      A FUZE team member will be available at the scheduled time.
      If you need to reschedule, please contact us directly.
    </p>
  `);

  return sendEmail({
    to: bookerEmail,
    subject: `✅ Confirmed: ${meetingTitle} — ${date}`,
    html,
  });
}
