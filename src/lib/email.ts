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
    subject: `Confirmed: ${meetingTitle} — ${date}`,
    html,
  });
}

// ─── Password Reset Email (F-015) ───

export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  resetToken: string;
}) {
  const { email, name, resetToken } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Password Reset Request</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, we received a request to reset your FUZE Atlas password.
    </p>
    <div style="margin: 24px 0; text-align: center;">
      <a href="${resetUrl}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Reset Password
      </a>
    </div>
    <p style="color: #4b5563; line-height: 1.6; font-size: 14px;">
      This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
      If the button doesn't work, copy this link into your browser:<br/>
      <a href="${resetUrl}" style="color: ${FUZE_COLOR}; word-break: break-all;">${resetUrl}</a>
    </p>
  `);

  return sendEmail({
    to: email,
    subject: "FUZE Atlas — Password Reset",
    html,
  });
}

// ─── Access Request Approved (F-016) ───

export async function sendAccessApprovedEmail(params: {
  email: string;
  name: string;
  tempPassword: string;
  companyName: string;
  accountType: "brand" | "factory";
}) {
  const { email, name, tempPassword, companyName, accountType } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Access Approved</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, your ${accountType} access request for <strong>${companyName}</strong> has been approved.
    </p>
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">Your Login Credentials</p>
      <p style="margin: 0 0 4px; color: #4b5563;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 0 0 4px; color: #4b5563;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${tempPassword}</code></p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/login" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Log In to FUZE Atlas
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      Please change your password after your first login. If you have questions, contact your FUZE representative.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `FUZE Atlas — Your ${accountType} access has been approved`,
    html,
  });
}

// ─── Access Request Denied (F-016) ───

export async function sendAccessDeniedEmail(params: {
  email: string;
  name: string;
  companyName: string;
  reason?: string;
}) {
  const { email, name, companyName, reason } = params;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Access Request Update</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, we reviewed your access request for <strong>${companyName}</strong>.
    </p>
    <p style="color: #4b5563; line-height: 1.6;">
      Unfortunately, we are unable to approve your request at this time.
    </p>
    ${reason ? `
    <div style="background: #f9fafb; border-left: 4px solid #9ca3af; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #4b5563; font-style: italic;">${reason}</p>
    </div>
    ` : ""}
    <p style="color: #9ca3af; font-size: 13px;">
      If you believe this was in error or have questions, please contact your FUZE representative directly.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: "FUZE Atlas — Access request update",
    html,
  });
}

// ─── SOW Status Change Email (F-017) ───

export async function sendSOWStatusEmail(params: {
  email: string;
  name: string;
  sowTitle: string;
  brandName: string;
  newStatus: string;
  sowId: string;
}) {
  const { email, name, sowTitle, brandName, newStatus, sowId } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const statusLabels: Record<string, string> = {
    DRAFT: "Draft",
    SENT: "Sent for Signature",
    SIGNED: "Signed",
    ACTIVE: "Active",
    COMPLETE: "Complete",
    CANCELLED: "Cancelled",
  };

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">SOW Status Updated</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, the Statement of Work for <strong>${brandName}</strong> has been updated.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">${sowTitle}</p>
      <p style="margin: 0; color: #4b5563;">New status: <strong>${statusLabels[newStatus] || newStatus}</strong></p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/sow/${sowId}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View SOW
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `SOW Update: ${sowTitle} — ${statusLabels[newStatus] || newStatus}`,
    html,
  });
}

// ─── Test Request Status Email (F-018) ───

export async function sendTestRequestStatusEmail(params: {
  email: string;
  name: string;
  testRequestId: string;
  status: string;
  brandName?: string;
  note?: string;
}) {
  const { email, name, testRequestId, status, brandName, note } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const statusLabels: Record<string, string> = {
    APPROVED: "Approved",
    SUBMITTED: "Submitted to Lab",
    IN_PROGRESS: "In Progress",
    RESULTS_RECEIVED: "Results Received",
    COMPLETE: "Complete",
    CANCELLED: "Cancelled",
  };

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Test Request Update</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, your test request${brandName ? ` for <strong>${brandName}</strong>` : ""} has been updated.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 4px; color: #4b5563;">Status: <strong>${statusLabels[status] || status}</strong></p>
      ${note ? `<p style="margin: 8px 0 0; color: #6b7280; font-style: italic;">${note}</p>` : ""}
    </div>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/test-requests" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Test Requests
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Test Request — ${statusLabels[status] || status}`,
    html,
  });
}

// ─── Test Results Available (F-019) ───

export async function sendTestResultsEmail(params: {
  email: string;
  name: string;
  testName: string;
  result: "PASSED" | "FAILED" | "RETEST";
  brandName?: string;
  testId: string;
}) {
  const { email, name, testName, result, brandName, testId } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const resultStyles: Record<string, { label: string; color: string }> = {
    PASSED: { label: "PASSED", color: "#059669" },
    FAILED: { label: "FAILED", color: "#dc2626" },
    RETEST: { label: "RETEST REQUIRED", color: "#d97706" },
  };

  const r = resultStyles[result] || { label: result, color: "#6b7280" };

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Test Results Available</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, test results are now available${brandName ? ` for <strong>${brandName}</strong>` : ""}.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${r.color}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">${testName}</p>
      <p style="margin: 0; color: ${r.color}; font-weight: 700; font-size: 18px;">${r.label}</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/tests/${testId}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Results
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Test Results: ${testName} — ${r.label}`,
    html,
  });
}

// ─── New Submission Notification (F-020) ───

export async function sendNewSubmissionEmail(params: {
  adminEmails: string[];
  factoryName: string;
  fabricName: string;
  submittedBy: string;
}) {
  const { adminEmails, factoryName, fabricName, submittedBy } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">New Fabric Submission</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      A new fabric has been submitted through the factory portal.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 4px; color: #4b5563;"><strong>Factory:</strong> ${factoryName}</p>
      <p style="margin: 0 0 4px; color: #4b5563;"><strong>Fabric:</strong> ${fabricName}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Submitted by:</strong> ${submittedBy}</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/fabrics" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Review Submissions
      </a>
    </div>
  `);

  return sendEmail({
    to: adminEmails,
    subject: `New Fabric Submission: ${fabricName} from ${factoryName}`,
    html,
  });
}

// ─── Invoice Payment Reminder (F-021) ───

export async function sendPaymentReminderEmail(params: {
  email: string;
  name: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  daysOverdue: number;
}) {
  const { email, name, invoiceNumber, amount, currency, dueDate, daysOverdue } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Payment Reminder</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, this is a reminder about an outstanding invoice.
    </p>
    <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 4px; color: #92400e;"><strong>Invoice:</strong> ${invoiceNumber}</p>
      <p style="margin: 0 0 4px; color: #92400e;"><strong>Amount:</strong> ${currency} ${amount}</p>
      <p style="margin: 0 0 4px; color: #92400e;"><strong>Due Date:</strong> ${dueDate}</p>
      ${daysOverdue > 0 ? `<p style="margin: 0; color: #dc2626; font-weight: 600;">${daysOverdue} days overdue</p>` : ""}
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      If you have already made payment, please disregard this message. For questions, contact your FUZE representative.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Payment Reminder: Invoice ${invoiceNumber} — ${currency} ${amount}`,
    html,
  });
}

// ─── Meeting Reminder (F-022) ───

export async function sendMeetingReminderEmail(params: {
  email: string;
  name: string;
  meetingTitle: string;
  date: string;
  startTime: string;
  teamsLink?: string;
}) {
  const { email, name, meetingTitle, date, startTime, teamsLink } = params;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Meeting Reminder</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, you have an upcoming meeting.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">${meetingTitle}</p>
      <p style="margin: 0 0 4px; color: #4b5563;">${date} at ${startTime}</p>
      ${teamsLink ? `<p style="margin: 8px 0 0;"><a href="${teamsLink}" style="color: ${FUZE_COLOR}; text-decoration: none; font-weight: 500;">Join in Microsoft Teams</a></p>` : ""}
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Reminder: ${meetingTitle} — ${date} at ${startTime}`,
    html,
  });
}
