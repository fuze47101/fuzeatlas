// @ts-nocheck
import { NextResponse } from "next/server";
import { sendActionItemDigest } from "@/lib/meeting-emails";
import { sendEmail } from "@/lib/email";

/**
 * GET/POST /api/cron/action-item-digest
 *
 * Phase 53 T7 — daily 7am UTC cron. Pulls every user with at least
 * one OPEN MeetingActionItem and sends a per-user digest email
 * grouped by meeting + priority desc + due asc. Silent for users with
 * zero open items.
 *
 * Errors get an error-fallback email to andrew@fuze47.com matching the
 * existing CRM digest cron pattern.
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendActionItemDigest();
    return NextResponse.json({
      ok: true,
      verdict: `Sent ${result.sent} digest email(s); ${result.errors} error(s).`,
      ...result,
    });
  } catch (e: any) {
    console.error("[action-item-digest] fatal:", e);
    try {
      await sendEmail({
        to: "andrew@fuze47.com",
        subject: "🚨 FUZE Atlas action-item-digest cron failed",
        html: `<p>Action-item digest cron threw:</p><pre>${String(e?.stack || e?.message || e).slice(0, 4000)}</pre>`,
      });
    } catch {}
    return NextResponse.json(
      { ok: false, error: e?.message || "digest failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;
