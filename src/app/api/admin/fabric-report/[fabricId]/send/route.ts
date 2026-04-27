// @ts-nocheck
/**
 * POST /api/admin/fabric-report/[fabricId]/send
 *
 * Creates a FabricReportShare row (90-day TTL by default) and emails
 * the recipient a download link plus a portal sign-in link. Andrew #102:
 * "they need the email notification that it was done. they need a link
 * to download it from the email directly and back to the site to get it."
 *
 * Body:
 *   {
 *     recipientEmail: string  (required)
 *     recipientName?: string
 *     subjectLine?: string    // overrides default subject
 *     personalNote?: string   // shown in email body before the report card
 *     ttlDays?: number        // default 90
 *     contactId?: string      // links to a CRM contact for portal scoping
 *     cc?: string | string[]  // optional CC (e.g. internal AM)
 *   }
 *
 * Returns: { ok, share: { id, token, expiresAt, recipientEmail, ... } }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";

const FUZE_CYAN = "#00b4c3";

function randomToken(): string {
  // URL-safe, 32-char random — collision-free in any reasonable horizon.
  return randomBytes(24).toString("base64url");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fabricId: string }> },
) {
  try {
    const { fabricId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const allowed = [
      "ADMIN",
      "EMPLOYEE",
      "SALES_MANAGER",
      "SALES_REP",
      "BD_REP",
      "LAB_USER",
      "LAB_MANAGER",
    ];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const recipientEmail = (body.recipientEmail || "").trim().toLowerCase();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Valid recipientEmail required" },
        { status: 400 },
      );
    }
    const recipientName = body.recipientName?.trim() || null;
    const personalNote = body.personalNote?.trim() || null;
    const cc = body.cc || null;

    const ttlDays = Number(body.ttlDays || 90);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    // Pull the fabric for the email body — must include brand/customerRef
    // so the recipient recognizes the submission.
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        customerReference: true,
        construction: true,
        fabricCategory: true,
        color: true,
        weightGsm: true,
        targetFuzeTier: true,
        brandId: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
      },
    });
    if (!fabric) {
      return NextResponse.json(
        { ok: false, error: "Fabric not found" },
        { status: 404 },
      );
    }

    const tier = fabric.targetFuzeTier || "F1";
    const subjectLine =
      body.subjectLine?.trim() ||
      `FUZE Application Report · ${
        fabric.customerReference ||
        fabric.customerCode ||
        `FUZE-${fabric.fuzeNumber}`
      }`;

    const share = await prisma.fabricReportShare.create({
      data: {
        fabricId,
        token: randomToken(),
        recipientEmail,
        recipientName,
        brandId: fabric.brandId || null,
        contactId: body.contactId || null,
        subjectLine,
        sentByUserId: user.id,
        expiresAt,
        tier,
      },
    });

    const portalUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
    const downloadUrl = `${portalUrl}/report/${share.token}`;
    const portalLogin = `${portalUrl}/login?next=${encodeURIComponent(
      "/portal/my-reports",
    )}`;

    const html = renderReportEmailHtml({
      recipientName,
      personalNote,
      fabric,
      tier,
      downloadUrl,
      portalLogin,
      portalUrl,
      expiresAt,
      senderName: user.name || "FUZE Biotech",
      senderEmail: user.email || "andrew@fuze47.com",
    });

    // Snapshot the rendered HTML so the share row preserves what we
    // actually sent (useful for support + audit).
    await prisma.fabricReportShare.update({
      where: { id: share.id },
      data: { emailBody: html },
    });

    const emailRes = await sendEmail({
      to: recipientEmail,
      cc: cc || undefined,
      subject: subjectLine,
      html,
      replyTo: user.email || "andrew@fuze47.com",
    });

    if (!emailRes.ok) {
      // Don't roll back the share row — admin can resend by issuing a
      // new share, and the existing token is still valid. Surface the
      // transport error to the UI.
      return NextResponse.json(
        {
          ok: false,
          error: `Email send failed: ${emailRes.error || "unknown"}`,
          share,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      share: {
        id: share.id,
        token: share.token,
        expiresAt: share.expiresAt,
        recipientEmail: share.recipientEmail,
        downloadUrl,
      },
    });
  } catch (e: any) {
    console.error("[fabric-report.send] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * Renders the customer-facing email body. Pulls language from
 * src/lib/fuze-knowledge.ts conventions per CLAUDE.md hard rule —
 * FUZE / metamaterial only, never silver / nano / silver-ion.
 */
function renderReportEmailHtml(args: {
  recipientName: string | null;
  personalNote: string | null;
  fabric: any;
  tier: string;
  downloadUrl: string;
  portalLogin: string;
  portalUrl: string;
  expiresAt: Date;
  senderName: string;
  senderEmail: string;
}): string {
  const {
    recipientName,
    personalNote,
    fabric,
    tier,
    downloadUrl,
    portalLogin,
    portalUrl,
    expiresAt,
    senderName,
    senderEmail,
  } = args;
  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  const ref =
    fabric.customerReference ||
    fabric.customerCode ||
    `FUZE-${fabric.fuzeNumber}`;
  const expires = expiresAt.toLocaleDateString();

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:${FUZE_CYAN};padding:18px 24px;color:white;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;opacity:0.9;">FUZE Biotech</p>
          <h1 style="margin:4px 0 0 0;font-size:22px;font-weight:800;">FUZE Application & Validation Report</h1>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 14px 0;font-size:16px;">${greet}</p>
          <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;">
            Your FUZE Application & Validation Report for <strong>${escapeHtml(ref)}</strong> is ready.
            This document includes the recommended bath recipe, in-house pad/dry validation, and the
            independent lab ICP verification — formatted for your QA team.
          </p>
          ${
            personalNote
              ? `<div style="margin:0 0 14px 0;padding:12px 14px;background:#f0fdfa;border-left:3px solid ${FUZE_CYAN};font-size:14px;line-height:1.5;">${escapeHtml(personalNote).replace(/\n/g, "<br/>")}</div>`
              : ""
          }
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8fafc;border-radius:6px;">
            <tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;">
              <strong>Brand:</strong> ${escapeHtml(fabric.brand?.name || "—")}<br/>
              <strong>Factory:</strong> ${escapeHtml(fabric.factory?.name || "—")}<br/>
              <strong>Customer reference:</strong> <span style="font-family:Menlo,monospace;">${escapeHtml(ref)}</span><br/>
              <strong>FUZE reference:</strong> FUZE-${fabric.fuzeNumber || "—"}<br/>
              <strong>Recommended tier:</strong> ${tier}
              ${fabric.fabricCategory || fabric.construction ? `<br/><strong>Construction:</strong> ${escapeHtml(fabric.fabricCategory || fabric.construction)}` : ""}
              ${fabric.weightGsm ? `<br/><strong>Weight:</strong> ${fabric.weightGsm} g/m²` : ""}
            </td></tr>
          </table>

          <p style="margin:24px 0 12px 0;font-size:14px;line-height:1.6;">
            <strong>Two ways to access the report:</strong>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:6px 0;">
              <a href="${downloadUrl}" style="display:inline-block;padding:14px 28px;background:${FUZE_CYAN};color:white;text-decoration:none;font-weight:700;font-size:14px;border-radius:6px;">
                Open Report (no sign-in needed)
              </a>
            </td></tr>
            <tr><td align="center" style="padding:6px 0 0 0;">
              <a href="${portalLogin}" style="display:inline-block;padding:10px 22px;background:#1f2937;color:white;text-decoration:none;font-weight:600;font-size:13px;border-radius:6px;">
                Sign in to FUZE Atlas → My Reports
              </a>
            </td></tr>
          </table>

          <p style="margin:22px 0 6px 0;font-size:12px;color:#6b7280;line-height:1.5;">
            The direct link above stays live until <strong>${expires}</strong>.
            For long-term access, sign in at ${portalUrl} and find this report
            under <em>My Reports</em> — searchable by your reference, item number, or FUZE number.
          </p>
          <p style="margin:6px 0 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
            If you don't have a password yet, use "Forgot password / Set password"
            with the email this was sent to and we'll email you a one-time link.
          </p>
        </td></tr>
        <tr><td style="background:#f3f4f6;padding:16px 24px;font-size:11px;color:#6b7280;">
          Sent by ${escapeHtml(senderName)} · ${escapeHtml(senderEmail)}<br/>
          FUZE Biotech · 1895 West 2100 South, Salt Lake City, UT 84119 USA<br/>
          Reply to this email and it will route to your FUZE account manager.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
