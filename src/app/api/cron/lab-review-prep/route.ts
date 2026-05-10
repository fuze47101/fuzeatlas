// @ts-nocheck
/**
 * GET /api/cron/lab-review-prep — Phase 10J.
 *
 * Bearer-authed cron. Runs Sunday 22:00 UTC (registered in
 * vercel.json). Walks the same data the Monday review queue
 * page surfaces and emails an agenda preview to the participants
 * (Andrew, Tina, Kaylee, plus any ACMs / lab managers tied to
 * the flagged items).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function escape(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const since7 = new Date(Date.now() - 7 * 86400_000);

  const [reviews, rejected] = await Promise.all([
    prisma.aiTestReview.findMany({
      where: {
        recommendedAction: { in: ["RETEST", "REJECT", "REVIEW"] },
        reviewedAt: { gte: since7 },
      },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
    prisma.fabricSubmission.findMany({
      where: {
        brandApprovalStatus: "REJECTED",
        updatedAt: { gte: since7 },
      },
      take: 25,
      select: {
        id: true,
        fuzeFabricNumber: true,
        brandRejectionReason: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
    }),
  ]);

  // Recipients: every admin + every active testing manager + every
  // lab manager. Andrew, Tina, Kaylee will all land in here by
  // virtue of their roles.
  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "LAB_MANAGER"] },
    },
    select: { email: true, name: true },
  });

  const total = reviews.length + rejected.length;
  const subject =
    total === 0
      ? `🎉 Monday review queue — inbox zero`
      : `Monday review queue — ${total} item${total === 1 ? "" : "s"}`;

  const rows = [
    ...reviews.map(
      (r) => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${escape(r.recommendedAction || "REVIEW")}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">AI review · TestRun ${escape(r.testRunId)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${Array.isArray(r.flags) ? r.flags.length + " flag(s)" : ""}</td>
      </tr>`,
    ),
    ...rejected.map(
      (s) => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#b91c1c;">REJECTED</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">FUZE-${s.fuzeFabricNumber} · ${escape(s.brand?.name || "")} · ${escape(s.factory?.name || "")}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${escape(s.brandRejectionReason || "")}</td>
      </tr>`,
    ),
  ].join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;max-width:720px;">
      <h2 style="margin:0 0 8px 0;">Monday review queue preview</h2>
      <p style="font-size:14px;color:#475569;margin:0 0 16px 0;">
        ${total === 0
          ? "Nothing flagged in the last 7 days — Monday's meeting can be short."
          : `Heads-up before Monday's meeting: <strong>${total}</strong> item${total === 1 ? "" : "s"} in the review queue.`}
      </p>
      ${
        total === 0
          ? ""
          : `<table style="border-collapse:collapse;width:100%;font-size:13px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th align="left" style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;font-size:11px;color:#64748b;">Action</th>
                  <th align="left" style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;font-size:11px;color:#64748b;">Item</th>
                  <th align="left" style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;font-size:11px;color:#64748b;">Detail</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
             </table>`
      }
      <p style="margin:20px 0 0 0;font-size:13px;">
        <a href="https://fuzeatlas.com/admin/lab-review" style="color:#00b4c3;font-weight:bold;">Open the review queue →</a>
      </p>
    </div>
  `;

  const results: any[] = [];
  for (const r of recipients) {
    if (!r.email) continue;
    try {
      const res = await sendEmail({
        to: r.email,
        subject,
        html,
      });
      results.push({ to: r.email, ok: !!res?.ok });
    } catch (err: any) {
      results.push({ to: r.email, ok: false, error: err?.message });
    }
  }

  return NextResponse.json({
    ok: true,
    total,
    recipients: results.length,
    sent: results.filter((r) => r.ok).length,
  });
}
