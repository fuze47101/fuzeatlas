// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/cron/admin-resolve
 *
 * Bearer-authed admin action endpoint. Pattern: when you want to run a
 * one-off DB tweak (resolve a ticket, backfill a claim, fix a bad row)
 * but you don't have/can't get a working local Prisma connection, do it
 * here instead. Vercel runtime has the right DB credentials baked in.
 *
 * Curl from anywhere with:
 *   curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"feedbackId":"...","claimBrandId":"...","claimUserEmail":"...","notify":true}' \
 *     https://fuzeatlas.com/api/cron/admin-resolve
 *
 * Body shape (all optional except feedbackId — partial actions are fine):
 *   feedbackId        : string  required  — the FeedbackReport.id to resolve
 *   resolution        : string?           — text shown on the ticket; defaults to a stock note
 *   resolutionUrl     : string?           — link to PR or commit
 *   newStatus         : "FIXED"|"REJECTED"|"DUPLICATE"|"CLOSED"  default FIXED
 *   claimBrandId      : string?           — if set, set Brand.salesRepId = claim user
 *   claimUserEmail    : string?           — required when claimBrandId is set
 *   notify            : boolean default false — email the original reporter on success
 *
 * Auth: standard CRON_SECRET bearer. Same as every other /api/cron route.
 *
 * Built May 2026 to resolve Scott Smith's "account not claimed" ticket
 * (cmot3i3pk) when the local resolution script couldn't reach prod DB.
 * Reusable for any future single-record admin tweak.
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const {
    feedbackId,
    resolution,
    resolutionUrl,
    newStatus = "FIXED",
    claimBrandId,
    claimUserEmail,
    notify = false,
  } = body || {};

  if (!feedbackId || typeof feedbackId !== "string") {
    return NextResponse.json(
      { ok: false, error: "feedbackId is required" },
      { status: 400 },
    );
  }
  const allowedStatuses = ["FIXED", "REJECTED", "DUPLICATE", "CLOSED"];
  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json(
      { ok: false, error: `newStatus must be one of ${allowedStatuses.join(", ")}` },
      { status: 400 },
    );
  }
  if (claimBrandId && !claimUserEmail) {
    return NextResponse.json(
      { ok: false, error: "claimUserEmail is required when claimBrandId is set" },
      { status: 400 },
    );
  }

  const result: any = {
    ok: true,
    feedbackId,
    actions: [] as string[],
  };

  try {
    // Resolve a system admin user to attribute the ticket resolution to.
    // We could accept this in the body too, but for a CRON_SECRET caller
    // there is no concept of "the calling user" — system attribution is
    // the right semantic.
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true, email: true, name: true },
    });
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "No active ADMIN user found in DB — cannot attribute resolution" },
        { status: 500 },
      );
    }
    result.attributedTo = { id: admin.id, email: admin.email };

    // ── 1. Backfill brand claim if requested ──────────────────────
    let claimUser: { id: string; name: string | null; email: string } | null = null;
    if (claimBrandId) {
      claimUser = await prisma.user.findUnique({
        where: { email: claimUserEmail },
        select: { id: true, name: true, email: true },
      });
      if (!claimUser) {
        return NextResponse.json(
          { ok: false, error: `No user found with email ${claimUserEmail}` },
          { status: 400 },
        );
      }

      const brand = await prisma.brand.findUnique({
        where: { id: claimBrandId },
        select: { id: true, name: true, salesRepId: true, lastActivityAt: true },
      });
      if (!brand) {
        return NextResponse.json(
          { ok: false, error: `Brand ${claimBrandId} not found` },
          { status: 404 },
        );
      }

      if (brand.salesRepId === claimUser.id) {
        result.actions.push(`brand-claim-skip (already owned by ${claimUser.email})`);
      } else {
        await prisma.brand.update({
          where: { id: claimBrandId },
          data: {
            salesRepId: claimUser.id,
            lastActivityAt: brand.lastActivityAt || new Date(),
          },
        });
        result.actions.push(`brand-claimed (${brand.name} → ${claimUser.email})`);
      }
      result.brand = { id: brand.id, name: brand.name };
      result.claimUser = claimUser;
    }

    // ── 2. Update the feedback ticket ─────────────────────────────
    const ticket = await prisma.feedbackReport.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        status: true,
        title: true,
        userEmail: true,
        userName: true,
      },
    });
    if (!ticket) {
      return NextResponse.json(
        { ok: false, error: `Feedback ${feedbackId} not found` },
        { status: 404 },
      );
    }
    result.ticketTitle = ticket.title;
    result.previousStatus = ticket.status;

    const defaultRes = `Resolved via /api/cron/admin-resolve at ${new Date().toISOString()}.`;
    if (ticket.status === newStatus) {
      result.actions.push(`ticket-status-skip (already ${newStatus})`);
    } else {
      await prisma.feedbackReport.update({
        where: { id: feedbackId },
        data: {
          status: newStatus,
          resolvedById: admin.id,
          resolvedAt: new Date(),
          resolution: resolution || defaultRes,
          resolutionUrl: resolutionUrl || null,
        },
      });
      result.actions.push(`ticket-status-updated (${ticket.status} → ${newStatus})`);
    }

    // ── 3. Notify the reporter if requested ───────────────────────
    if (notify && ticket.userEmail) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fuzeatlas.com");
      const reporterFirst =
        (ticket.userName || "").split(" ")[0] || "there";
      const subj = `Re: ${ticket.title} — ${newStatus.toLowerCase()}`;
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;color:#0f172a;">
          <div style="background:linear-gradient(135deg,#059669,#047857);padding:18px 24px;border-radius:12px 12px 0 0;color:white;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">FUZE Atlas — Support Ticket Resolved</div>
            <h2 style="margin:4px 0 0;font-size:20px;font-weight:800;">${escape(ticket.title)}</h2>
          </div>
          <div style="padding:20px 24px;background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 14px;line-height:1.5;">Hey ${escape(reporterFirst)},</p>
            <p style="margin:0 0 14px;line-height:1.5;">
              Your ticket has been marked <strong>${escape(newStatus.toLowerCase())}</strong>.
            </p>
            ${
              resolution
                ? `<div style="margin:0 0 14px;padding:12px 14px;background:#f1f5f9;border-radius:8px;border-left:3px solid #00b4c3;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escape(resolution)}</div>`
                : ""
            }
            ${
              claimBrandId && claimUser
                ? `<p style="margin:0 0 14px;line-height:1.5;">Affected brand:
                    <a href="${appUrl}/brands/${claimBrandId}" style="color:#0369a1;">open it</a></p>`
                : ""
            }
            <p style="margin:0 0 14px;line-height:1.5;">
              Spot another wrinkle? Hit the 🐞 button on any page.
            </p>
            <p style="margin:0;line-height:1.5;color:#475569;">— Andrew (via Atlas)</p>
            <p style="margin-top:18px;font-size:11px;color:#94a3b8;">
              Ticket #${feedbackId.slice(0, 8)} · ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </div>
      `;
      const sendRes = await sendEmail({
        to: ticket.userEmail,
        subject: subj,
        html,
        replyTo: "andrew@fuze47.com",
      });
      if (sendRes.ok) {
        result.actions.push(`notified ${ticket.userEmail}`);
        await prisma.feedbackReport.update({
          where: { id: feedbackId },
          data: { notifiedAt: new Date() },
        });
      } else {
        result.actions.push(`notify-failed (${sendRes.error || "unknown"})`);
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[admin-resolve] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        partial: result,
      },
      { status: 500 },
    );
  }
}

function escape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
