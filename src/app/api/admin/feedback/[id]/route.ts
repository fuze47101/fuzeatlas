// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

/**
 * PATCH /api/admin/feedback/[id]
 *
 * Update triage state. Accepts partial:
 *   { status?, triageNotes?, resolution?, resolutionUrl?, priority?, notify? }
 *
 * Side effects:
 *   — When transitioning to FIXED with notify=true (default), sends
 *     an email to the requester (once). Pass notify=false to suppress.
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const existing = await prisma.feedbackReport.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const data: any = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.triageNotes === "string") data.triageNotes = body.triageNotes;
  if (typeof body.resolution === "string") data.resolution = body.resolution;
  if (typeof body.resolutionUrl === "string") data.resolutionUrl = body.resolutionUrl;
  if (typeof body.priority === "number") data.priority = body.priority;

  // Lifecycle timestamps
  if (data.status && data.status !== existing.status) {
    if (["TRIAGED", "ACCEPTED", "IN_PROGRESS"].includes(data.status)) {
      data.triagedById = user.id;
      if (!existing.triagedAt) data.triagedAt = new Date();
    }
    if (data.status === "FIXED") {
      data.resolvedById = user.id;
      data.resolvedAt = new Date();
    }
  }

  const updated = await prisma.feedbackReport.update({
    where: { id },
    data,
  });

  // Send "we fixed it" notification on transition into FIXED (only once).
  // Caller can pass notify=false to suppress (internal-only resolution).
  const wantNotify = body.notify !== false;
  let notified = false;
  if (
    wantNotify &&
    data.status === "FIXED" &&
    existing.status !== "FIXED" &&
    !existing.notifiedAt &&
    updated.userEmail
  ) {
    const subject = `We fixed what you reported: ${truncate(updated.title, 80)}`;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const pageLink = updated.url
      ? `<p style="margin:16px 0 8px">You can pick up where you left off here:</p>
         <p><a href="${escapeHtml(updated.url)}" style="color:#00b4c3;font-weight:bold">${escapeHtml(updated.url)}</a></p>`
      : "";
    const resolutionBlock = updated.resolution
      ? `<div style="background:#f0f9ff;border-left:4px solid #00b4c3;padding:12px;margin:16px 0;border-radius:6px">
           <p style="margin:0;font-size:13px;color:#0f172a"><strong>What we did:</strong></p>
           <p style="margin:6px 0 0;font-size:14px;color:#334155">${escapeHtml(updated.resolution)}</p>
         </div>`
      : "";
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:auto;padding:20px;color:#0f172a">
        <h1 style="color:#00b4c3;font-size:22px;margin:0 0 12px">Fixed ✅</h1>
        <p style="font-size:15px;line-height:1.5;color:#334155">
          Hey ${escapeHtml(updated.userName || "there")}, the issue you reported is now resolved.
        </p>
        <p style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:14px;color:#0f172a">
          <strong>Your report:</strong> ${escapeHtml(updated.title)}
        </p>
        ${resolutionBlock}
        ${pageLink}
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">
          Thanks for taking the time to flag this — it genuinely helps us make Atlas better.
          If it&#39;s still not working right, reply to this email or hit the 🐛 button again.
          ${baseUrl ? `<br>— <a href="${baseUrl}" style="color:#94a3b8">FUZE Atlas</a>` : "— FUZE Atlas"}
        </p>
      </div>
    `;
    try {
      await sendEmail({ to: updated.userEmail, subject, html });
      await prisma.feedbackReport.update({
        where: { id: updated.id },
        data: { notifiedAt: new Date() },
      });
      notified = true;
    } catch (err) {
      console.error("Failed to send feedback-fixed email:", err);
    }
  }

  return NextResponse.json({ ok: true, report: updated, notified });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
