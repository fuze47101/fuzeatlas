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

// ─── Email Verification (F-023) ───

export async function sendEmailVerification(params: {
  email: string;
  name: string;
  verifyToken: string;
}) {
  const { email, name, verifyToken } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Verify Your Email</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, please verify your email address to complete your FUZE Atlas account setup.
    </p>
    <div style="margin: 24px 0; text-align: center;">
      <a href="${verifyUrl}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Verify Email Address
      </a>
    </div>
    <p style="color: #4b5563; line-height: 1.6; font-size: 14px;">
      This link will expire in 24 hours. If you did not create a FUZE Atlas account, you can safely ignore this email.
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
      If the button doesn't work, copy this link into your browser:<br/>
      <a href="${verifyUrl}" style="color: ${FUZE_COLOR}; word-break: break-all;">${verifyUrl}</a>
    </p>
  `);

  return sendEmail({
    to: email,
    subject: "FUZE Atlas — Verify Your Email",
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
  status?: string;
  newStatus?: string;
  poNumber?: string;
  brandName?: string;
  note?: string;
}) {
  const { email, name, testRequestId, brandName, note, poNumber } = params;
  const status = params.status || params.newStatus || "Unknown";
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

// ─── Sample Trial Status Notifications (F-025) ───

export async function sendTrialStatusEmail(params: {
  email: string;
  name: string;
  trialId: string;
  factoryName: string;
  fabricInfo: string;
  newStatus: string;
  trackingNumber?: string;
  rejectedReason?: string;
  adminNotes?: string;
  icpLabName?: string;
}) {
  const {
    email, name, trialId, factoryName, fabricInfo,
    newStatus, trackingNumber, rejectedReason, adminNotes, icpLabName,
  } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const trialUrl = `${baseUrl}/factory-portal/sample-trial/${trialId}`;

  const statusConfig: Record<string, { label: string; color: string; message: string }> = {
    UNDER_REVIEW: {
      label: "Under Review",
      color: "#d97706",
      message: "Your FUZE sample trial request is being reviewed by the FUZE team.",
    },
    APPROVED: {
      label: "Approved",
      color: "#059669",
      message: "Your FUZE sample trial request has been approved. The FUZE sample will be prepared for shipment.",
    },
    REJECTED: {
      label: "Not Approved",
      color: "#dc2626",
      message: rejectedReason
        ? `Your FUZE sample trial request was not approved. Reason: ${rejectedReason}`
        : "Your FUZE sample trial request was not approved at this time. Please contact your FUZE representative for details.",
    },
    SAMPLE_SHIPPED: {
      label: "Sample Shipped",
      color: "#059669",
      message: trackingNumber
        ? `Your FUZE sample has been shipped! Tracking number: ${trackingNumber}`
        : "Your FUZE sample has been shipped! You will receive it shortly.",
    },
    ICP_PENDING: {
      label: "ICP Testing Required",
      color: "#d97706",
      message: icpLabName
        ? `Please send your treated fabric sample to ${icpLabName} for ICP validation testing. Submit the results through the portal once available.`
        : "Please send your treated fabric sample to your designated ICP lab for validation testing.",
    },
    ICP_SUBMITTED: {
      label: "ICP Results Received",
      color: "#2563eb",
      message: "ICP test results have been submitted and are being reviewed by the FUZE team.",
    },
    COMPLETE: {
      label: "Complete",
      color: "#059669",
      message: "Your FUZE sample trial has been completed successfully. Thank you for your partnership.",
    },
  };

  const config = statusConfig[newStatus];
  if (!config) return { ok: true, skipped: true };

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Sample Trial Update</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, there's an update on your FUZE sample trial request.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${config.color}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; color: ${config.color}; font-weight: 700; font-size: 16px;">${config.label}</p>
      <p style="margin: 0 0 8px; color: #4b5563;"><strong>Factory:</strong> ${factoryName}</p>
      <p style="margin: 0 0 8px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 8px 0 0; color: #4b5563;">${config.message}</p>
      ${adminNotes ? `<p style="margin: 8px 0 0; color: #6b7280; font-style: italic;">Note: ${adminNotes}</p>` : ""}
    </div>
    <div style="margin: 24px 0;">
      <a href="${trialUrl}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Trial Details
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      If you have questions, contact your FUZE representative.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `FUZE Sample Trial — ${config.label}`,
    html,
  });
}

// Notify admin when a new trial request is submitted or ICP results are submitted
export async function sendTrialAdminNotification(params: {
  adminEmails: string[];
  trialId: string;
  factoryName: string;
  fabricInfo: string;
  requestedByName: string;
  event: "NEW_REQUEST" | "ICP_SUBMITTED";
}) {
  const { adminEmails, trialId, factoryName, fabricInfo, requestedByName, event } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const trialUrl = `${baseUrl}/admin/sample-trials`;

  const isNew = event === "NEW_REQUEST";
  const title = isNew ? "New Sample Trial Request" : "ICP Results Submitted";
  const message = isNew
    ? `<strong>${requestedByName}</strong> from <strong>${factoryName}</strong> has submitted a new FUZE sample trial request.`
    : `<strong>${factoryName}</strong> has submitted ICP test results for review.`;

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">${title}</h2>
    <p style="color: #4b5563; line-height: 1.6;">${message}</p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 4px; color: #4b5563;"><strong>Factory:</strong> ${factoryName}</p>
      <p style="margin: 0 0 4px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Requested by:</strong> ${requestedByName}</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${trialUrl}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Review in Admin
      </a>
    </div>
  `);

  return sendEmail({
    to: adminEmails,
    subject: `${isNew ? "New" : "ICP Results"}: Sample Trial — ${factoryName}`,
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

// ─── Shipping Instructions Email (F-033) ───

export async function sendShippingInstructionsEmail(params: {
  email: string;
  name: string;
  testRequestId: string;
  poNumber: string;
  labName: string;
  labAddress: string;
  labCity: string;
  labState?: string;
  labCountry: string;
  labEmail?: string;
  labPhone?: string;
  testTypes: string[];
  fabricInfo: string;
  samplePrepInstructions: string;
}) {
  const {
    email, name, testRequestId, poNumber,
    labName, labAddress, labCity, labState, labCountry, labEmail, labPhone,
    testTypes, fabricInfo, samplePrepInstructions,
  } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const trUrl = `${baseUrl}/test-requests`;

  const labFullAddress = [labAddress, labCity, labState, labCountry].filter(Boolean).join(", ");

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Shipping Instructions — Test Request Approved</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, your test request <strong>${poNumber}</strong> has been approved.
      Please prepare and ship your fabric samples to the lab below.
    </p>

    <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; color: #059669; font-weight: 700; font-size: 16px;">Ship Samples To:</p>
      <p style="margin: 0 0 4px; color: #1a1a2e; font-weight: 600; font-size: 15px;">${labName}</p>
      <p style="margin: 0 0 4px; color: #4b5563;">${labFullAddress}</p>
      ${labEmail ? `<p style="margin: 0 0 4px; color: #4b5563;">Email: ${labEmail}</p>` : ""}
      ${labPhone ? `<p style="margin: 0; color: #4b5563;">Phone: ${labPhone}</p>` : ""}
    </div>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 12px; color: #1a1a2e; font-weight: 600;">Test Details</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>PO Number:</strong> ${poNumber}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Test Types:</strong> ${testTypes.join(", ")}</p>
    </div>

    <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; color: #d97706; font-weight: 700;">Sample Preparation Instructions</p>
      <div style="color: #4b5563; line-height: 1.8;">${samplePrepInstructions}</div>
    </div>

    <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 16px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 8px; color: #0369a1; font-weight: 600;">General Shipping Guidelines</p>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
        <li>Label each sample with the <strong>PO number (${poNumber})</strong> and fabric code</li>
        <li>Include a copy of this email or a packing list with your shipment</li>
        <li>Ship within <strong>5 business days</strong> of receiving this email</li>
        <li>Use a tracked shipping method and record the tracking number in the portal</li>
        <li>Store samples in a cool, dry place until shipment</li>
      </ul>
    </div>

    <div style="margin: 24px 0;">
      <a href="${trUrl}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View in Portal
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 13px;">
      Questions about shipping? Contact your FUZE representative or reply to this email.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Ship Samples — ${poNumber} — ${labName}`,
    html,
  });
}

// ─── Test Request Confirmation Email (F-034) ───
// Sent to customer when they submit a test request

export async function sendTestRequestConfirmationEmail(params: {
  email: string;
  name: string;
  poNumber: string;
  testTypes: string[];
  fabricInfo: string;
  labName: string;
  estimatedCost?: number;
}) {
  const { email, name, poNumber, testTypes, fabricInfo, labName, estimatedCost } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Test Request Received</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, we've received your test request. Our team will review and approve it shortly.
    </p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 8px; color: #1a1a2e; font-weight: 600;">Request Details</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>PO Number:</strong> ${poNumber}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Tests:</strong> ${testTypes.join(", ")}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Lab:</strong> ${labName}</p>
      ${estimatedCost ? `<p style="margin: 0; color: #4b5563;"><strong>Estimated Cost:</strong> $${estimatedCost.toFixed(2)}</p>` : ""}
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      <strong>What happens next:</strong> Once approved, you'll receive shipping instructions with the lab address and sample requirements.
    </p>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/factory-portal" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View in Portal
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Test Request Received — ${poNumber}`,
    html,
  });
}

// ─── Sample Shipped Notification (F-035) ───
// Sent to admins + lab when customer enters tracking number

export async function sendSampleShippedNotification(params: {
  adminEmails: string[];
  poNumber: string;
  fabricInfo: string;
  carrier: string;
  trackingNumber: string;
  customerName: string;
  shipDate?: string;
}) {
  const { adminEmails, poNumber, fabricInfo, carrier, trackingNumber, customerName, shipDate } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Sample Shipped</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      <strong>${customerName}</strong> has shipped samples for test request <strong>${poNumber}</strong>.
    </p>
    <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; color: #059669; font-weight: 700;">Shipment Details</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>PO:</strong> ${poNumber}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Carrier:</strong> ${carrier}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Tracking:</strong> ${trackingNumber}</p>
      ${shipDate ? `<p style="margin: 0; color: #4b5563;"><strong>Ship Date:</strong> ${shipDate}</p>` : ""}
    </div>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/shipments" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Shipments
      </a>
    </div>
  `);

  return sendEmail({
    to: adminEmails,
    subject: `Sample Shipped — ${poNumber} — ${carrier} ${trackingNumber}`,
    html,
  });
}

// ─── Shipment Confirmed to Customer (F-036) ───
// Sent to customer confirming we recorded their tracking number

export async function sendShipmentConfirmedEmail(params: {
  email: string;
  name: string;
  poNumber: string;
  carrier: string;
  trackingNumber: string;
}) {
  const { email, name, poNumber, carrier, trackingNumber } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Shipment Recorded</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, we've recorded your shipment for <strong>${poNumber}</strong>.
    </p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Carrier:</strong> ${carrier}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Tracking:</strong> ${trackingNumber}</p>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      We'll notify you as soon as your sample arrives at our lab. You can track your request status in the portal at any time.
    </p>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/factory-portal" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Track Your Request
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Shipment Confirmed — ${poNumber}`,
    html,
  });
}

// ─── Sample Received at Lab (F-037) ───
// Auto-reply to customer when lab marks sample received

export async function sendSampleReceivedEmail(params: {
  email: string;
  name: string;
  poNumber: string;
  fabricInfo: string;
  receivedDate: string;
  condition: string;
  testTypes: string[];
}) {
  const { email, name, poNumber, fabricInfo, receivedDate, condition, testTypes } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Sample Received at Lab</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, your sample has been received at our lab.
    </p>
    <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Received:</strong> ${receivedDate}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Condition:</strong> ${condition}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>PO Number:</strong> ${poNumber}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Tests:</strong> ${testTypes.join(", ")}</p>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      Your sample is now in our testing queue. We'll notify you when testing begins with an estimated completion date.
    </p>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/factory-portal" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Track Your Request
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Sample Received — ${poNumber}`,
    html,
  });
}

// ─── Sample Issue Email (F-038) ───
// Sent to customer when received sample has problems

export async function sendSampleIssueEmail(params: {
  email: string;
  name: string;
  poNumber: string;
  fabricInfo: string;
  issueDescription: string;
}) {
  const { email, name, poNumber, fabricInfo, issueDescription } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Sample Issue — ${poNumber}</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, we received your sample but found an issue that needs to be resolved before testing can begin.
    </p>
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; color: #dc2626; font-weight: 700;">Issue Details</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>PO:</strong> ${poNumber}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 8px 0 0; color: #4b5563;">${issueDescription}</p>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      Testing is on hold until this issue is resolved. Please contact us to discuss next steps.
    </p>
    <div style="margin: 24px 0;">
      <a href="mailto:lab@fuzebiotech.com" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Contact Lab
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Sample Issue — ${poNumber}`,
    html,
  });
}

// ─── Testing Started Email (F-039) ───
// Sent to customer when testing begins with estimated completion

export async function sendTestingStartedEmail(params: {
  email: string;
  name: string;
  poNumber: string;
  fabricInfo: string;
  testLines: { testType: string; testMethod?: string; estimatedDays?: number }[];
  estimatedCompletionDate: string;
}) {
  const { email, name, poNumber, fabricInfo, testLines, estimatedCompletionDate } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const testListHtml = testLines.map(l =>
    `<li style="margin: 4px 0; color: #4b5563;">${l.testType}${l.testMethod ? ` (${l.testMethod})` : ""}${l.estimatedDays ? ` — Est. ${l.estimatedDays} days` : ""}</li>`
  ).join("");

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Testing Started</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, testing has begun on your sample.
    </p>
    <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>PO:</strong> ${poNumber}</p>
      <p style="margin: 0 0 6px; color: #4b5563;"><strong>Fabric:</strong> ${fabricInfo}</p>
      <p style="margin: 0 0 8px; color: #4b5563;"><strong>Tests in progress:</strong></p>
      <ul style="margin: 0; padding-left: 20px;">${testListHtml}</ul>
    </div>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 20px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 4px; color: #059669; font-weight: 700; font-size: 14px;">Estimated Completion</p>
      <p style="margin: 0; color: #1a1a2e; font-weight: 700; font-size: 20px;">${estimatedCompletionDate}</p>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      We'll email you as soon as results are ready.
    </p>
    <div style="margin: 24px 0;">
      <a href="${baseUrl}/factory-portal" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Track Your Request
      </a>
    </div>
  `);

  return sendEmail({
    to: email,
    subject: `Testing Started — ${poNumber} — Est. Complete ${estimatedCompletionDate}`,
    html,
  });
}

// ─── Enhanced Results Ready Email (F-040) ───
// Sent to customer with results summary table when admin stamps

export async function sendResultsReadyEmail(params: {
  email: string;
  name: string;
  poNumber: string;
  fabricInfo: string;
  overallResult: "PASSED" | "FAILED" | "MIXED";
  results: { testType: string; testMethod?: string; result: string; passed: boolean; detail?: string }[];
}) {
  const { email, name, poNumber, fabricInfo, overallResult, results } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const overallColor = overallResult === "PASSED" ? "#059669" : overallResult === "FAILED" ? "#dc2626" : "#d97706";
  const overallBg = overallResult === "PASSED" ? "#f0fdf4" : overallResult === "FAILED" ? "#fef2f2" : "#fffbeb";

  const resultsRows = results.map(r => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1a1a2e;">${r.testType}${r.testMethod ? `<br><span style="color: #9ca3af; font-size: 12px;">${r.testMethod}</span>` : ""}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">${r.result}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; background: ${r.passed ? "#059669" : "#dc2626"};">${r.passed ? "PASS" : "FAIL"}</span>
      </td>
    </tr>
  `).join("");

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Test Results Ready</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name}, your test results for <strong>${poNumber}</strong> are ready.
    </p>

    <div style="background: ${overallBg}; border: 2px solid ${overallColor}; padding: 16px; margin: 20px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 4px; color: ${overallColor}; font-size: 14px; font-weight: 600;">Overall Result</p>
      <p style="margin: 0; color: ${overallColor}; font-size: 28px; font-weight: 700;">${overallResult}</p>
      <p style="margin: 6px 0 0; color: #4b5563; font-size: 13px;">${fabricInfo}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 10px 12px; text-align: left; color: #1a1a2e; font-size: 13px; border-bottom: 2px solid #e5e7eb;">Test</th>
          <th style="padding: 10px 12px; text-align: left; color: #1a1a2e; font-size: 13px; border-bottom: 2px solid #e5e7eb;">Result</th>
          <th style="padding: 10px 12px; text-align: center; color: #1a1a2e; font-size: 13px; border-bottom: 2px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>${resultsRows}</tbody>
    </table>

    ${results.some(r => r.detail) ? `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0 0 8px; color: #1a1a2e; font-weight: 600; font-size: 13px;">Details</p>
        ${results.filter(r => r.detail).map(r => `<p style="margin: 0 0 4px; color: #4b5563; font-size: 13px;"><strong>${r.testType}:</strong> ${r.detail}</p>`).join("")}
      </div>
    ` : ""}

    <div style="margin: 24px 0; text-align: center;">
      <a href="${baseUrl}/factory-portal" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 0 8px;">
        View Full Results
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 13px; text-align: center;">
      Thank you for choosing FUZE.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Test Results — ${poNumber} — ${overallResult}`,
    html,
  });
}

// ─── Order Notification Emails ───

/** Notify account manager of new order needing approval */
export async function sendNewOrderEmail(params: {
  email: string;
  managerName: string;
  orderNumber: string;
  orderType: string;
  factoryName: string;
  volumeLiters?: number;
  hangtagQty?: number;
  totalPrice: number;
  currency: string;
  brandName?: string;
}) {
  const { email, managerName, orderNumber, orderType, factoryName, volumeLiters, hangtagQty, totalPrice, currency, brandName } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const detail = volumeLiters ? `${volumeLiters}L (${Math.ceil(volumeLiters / 19)} bottles)` : hangtagQty ? `${hangtagQty.toLocaleString()} hangtags` : "";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">New Order Awaiting Approval</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${managerName}, a new ${orderType.toLowerCase()} order requires your approval.
    </p>

    <div style="background: #fffbeb; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #92400e; font-weight: 600;">Order</td><td style="padding: 6px 0; color: #1a1a2e;">${orderNumber}</td></tr>
        <tr><td style="padding: 6px 0; color: #92400e; font-weight: 600;">Type</td><td style="padding: 6px 0; color: #1a1a2e;">${orderType}</td></tr>
        <tr><td style="padding: 6px 0; color: #92400e; font-weight: 600;">Factory</td><td style="padding: 6px 0; color: #1a1a2e;">${factoryName}</td></tr>
        ${brandName ? `<tr><td style="padding: 6px 0; color: #92400e; font-weight: 600;">Brand</td><td style="padding: 6px 0; color: #1a1a2e;">${brandName}</td></tr>` : ""}
        <tr><td style="padding: 6px 0; color: #92400e; font-weight: 600;">Quantity</td><td style="padding: 6px 0; color: #1a1a2e;">${detail}</td></tr>
        <tr><td style="padding: 6px 0; color: #92400e; font-weight: 600;">Total</td><td style="padding: 6px 0; color: #1a1a2e; font-size: 18px; font-weight: 700;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(totalPrice)}</td></tr>
      </table>
    </div>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${baseUrl}/admin/orders" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Review & Approve
      </a>
    </div>
  `);

  return sendEmail({ to: email, subject: `Action Required: ${orderType} Order ${orderNumber} — ${factoryName}`, html });
}

/** Notify factory when order status changes */
export async function sendOrderStatusEmail(params: {
  email: string;
  contactName: string;
  orderNumber: string;
  newStatus: string;
  factoryName: string;
  trackingNumber?: string;
  carrier?: string;
}) {
  const { email, contactName, orderNumber, newStatus, factoryName, trackingNumber, carrier } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const statusInfo: Record<string, { color: string; bg: string; label: string; message: string }> = {
    APPROVED: { color: "#059669", bg: "#f0fdf4", label: "Approved", message: "Your order has been approved and will be processed shortly." },
    PROCESSING: { color: "#7c3aed", bg: "#f5f3ff", label: "Processing", message: "Your order is being prepared for shipment." },
    SHIPPED: { color: "#4f46e5", bg: "#eef2ff", label: "Shipped", message: trackingNumber ? `Your order has shipped! Tracking: ${trackingNumber}${carrier ? ` (${carrier})` : ""}.` : "Your order has been shipped!" },
    DELIVERED: { color: "#059669", bg: "#f0fdf4", label: "Delivered", message: "Your order has been delivered. Thank you for choosing FUZE." },
    CANCELLED: { color: "#dc2626", bg: "#fef2f2", label: "Cancelled", message: "Your order has been cancelled. Please contact your account manager with any questions." },
  };

  const info = statusInfo[newStatus] || { color: "#6b7280", bg: "#f9fafb", label: newStatus, message: `Your order status has been updated to ${newStatus}.` };

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Order Update</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hi ${contactName},</p>

    <div style="background: ${info.bg}; border: 2px solid ${info.color}; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 4px; color: ${info.color}; font-size: 14px; font-weight: 600;">Order ${orderNumber}</p>
      <p style="margin: 0; color: ${info.color}; font-size: 28px; font-weight: 700;">${info.label}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">${info.message}</p>

    ${trackingNumber && newStatus === "SHIPPED" ? `
    <div style="background: #f9fafb; padding: 16px; margin: 20px 0; border-radius: 8px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 4px; color: #1a1a2e; font-weight: 600;">Tracking Information</p>
      <p style="margin: 0; color: #4b5563;">
        ${carrier ? `<strong>Carrier:</strong> ${carrier}<br>` : ""}
        <strong>Tracking:</strong> ${trackingNumber}
      </p>
    </div>
    ` : ""}

    <div style="margin: 24px 0; text-align: center;">
      <a href="${baseUrl}/factory-portal/orders" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Order Details
      </a>
    </div>
  `);

  return sendEmail({ to: email, subject: `FUZE Order ${orderNumber} — ${info.label}`, html });
}

/** Notify distributor of new order to fulfill */
export async function sendDistributorOrderEmail(params: {
  email: string;
  distributorName: string;
  orderNumber: string;
  factoryName: string;
  volumeLiters?: number;
  hangtagQty?: number;
  shippingAddress?: string;
  shippingCity?: string;
  shippingCountry?: string;
}) {
  const { email, distributorName, orderNumber, factoryName, volumeLiters, hangtagQty, shippingAddress, shippingCity, shippingCountry } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const detail = volumeLiters ? `${volumeLiters}L (${Math.ceil(volumeLiters / 19)} bottles)` : hangtagQty ? `${hangtagQty.toLocaleString()} hangtags` : "";
  const shipTo = [shippingAddress, shippingCity, shippingCountry].filter(Boolean).join(", ");

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">New Order for Fulfillment</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${distributorName}, a new order has been approved and is ready for fulfillment.
    </p>

    <div style="background: #f0fdf4; border: 2px solid #059669; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #065f46; font-weight: 600;">Order</td><td style="padding: 6px 0; color: #1a1a2e;">${orderNumber}</td></tr>
        <tr><td style="padding: 6px 0; color: #065f46; font-weight: 600;">Factory</td><td style="padding: 6px 0; color: #1a1a2e;">${factoryName}</td></tr>
        <tr><td style="padding: 6px 0; color: #065f46; font-weight: 600;">Quantity</td><td style="padding: 6px 0; color: #1a1a2e;">${detail}</td></tr>
        ${shipTo ? `<tr><td style="padding: 6px 0; color: #065f46; font-weight: 600;">Ship To</td><td style="padding: 6px 0; color: #1a1a2e;">${shipTo}</td></tr>` : ""}
      </table>
    </div>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${baseUrl}/distributor-portal/orders" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        View & Fulfill Order
      </a>
    </div>
  `);

  return sendEmail({ to: email, subject: `Fulfillment Required: ${orderNumber} — ${factoryName}`, html });
}

/**
 * Send low inventory alert to distributor + admins
 */
export async function sendLowInventoryEmail(params: {
  distributorEmail: string;
  distributorName: string;
  currentLiters: number;
  thresholdLiters: number;
  bottles: number;
  adminEmails?: string[];
}) {
  const { distributorEmail, distributorName, currentLiters, thresholdLiters, bottles, adminEmails } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #dc2626; margin: 0 0 16px;">⚠️ Low Inventory Alert</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      ${distributorName} FUZE stock has dropped below the reorder threshold.
    </p>

    <div style="background: #fef2f2; border: 2px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Distributor</td><td style="padding: 6px 0; color: #1a1a2e; font-weight: 600;">${distributorName}</td></tr>
        <tr><td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Current Stock</td><td style="padding: 6px 0; color: #dc2626; font-weight: 700; font-size: 18px;">${currentLiters} L (${bottles} bottles)</td></tr>
        <tr><td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Reorder Threshold</td><td style="padding: 6px 0; color: #1a1a2e;">${thresholdLiters} L</td></tr>
        <tr><td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Below By</td><td style="padding: 6px 0; color: #dc2626;">${Math.round(thresholdLiters - currentLiters)} L</td></tr>
      </table>
    </div>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${baseUrl}/admin/worldwide-inventory" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        View Worldwide Inventory
      </a>
    </div>
  `);

  const subject = `⚠️ Low Inventory: ${distributorName} — ${currentLiters}L remaining`;

  // Send to distributor
  const promises = [sendEmail({ to: distributorEmail, subject, html })];

  // Also send to admins
  if (adminEmails && adminEmails.length > 0) {
    promises.push(sendEmail({ to: adminEmails, subject, html }));
  }

  return Promise.all(promises);
}

/**
 * Send login activity notification email to account manager
 */
export async function sendLoginNotificationEmail(params: {
  email: string;
  managerName: string;
  userName: string;
  entityType: string;
  entityName: string;
}) {
  const { email, managerName, userName, entityType, entityName } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  const html = emailWrapper(`
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">${entityType} Activity: ${entityName}</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${managerName}, <strong>${userName}</strong> from <strong>${entityName}</strong> just logged into FUZE Atlas.
    </p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      This is a good time to check if they need support or have any pending orders.
    </p>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${baseUrl}/dashboard" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Open FUZE Atlas
      </a>
    </div>
  `);

  return sendEmail({ to: email, subject: `${entityType} Login: ${userName} from ${entityName}`, html });
}
