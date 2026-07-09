// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getAdminAlerts } from "@/lib/admin-alerts";

/**
 * GET /api/cron/daily-digest
 *
 * Vercel Cron Job — runs daily at 7am MST (14:00 UTC).
 * Sends Andrew a comprehensive CRM digest email covering the last 24 hours.
 *
 * Includes: CRM notes/calls/meetings, new orders, pipeline changes,
 * new contacts, outreach activity, test status changes, and key stats.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const DIGEST_RECIPIENTS = ["andrew@801inc.com", "andrew@fuze47.com"];

export async function GET(req: Request) {
  // Auth: Vercel cron or manual trigger with secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours

    // ── Gather all activity ──

    // 1. CRM Notes (all types: NOTE, CALL, EMAIL, MEETING, TASK, FOLLOW_UP)
    //    Match on either date (user-picked) or createdAt (system) so notes
    //    imported via API/bulk without an explicit date still show up.
    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { date: { gte: since } },
          { createdAt: { gte: since } },
        ],
      },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. New orders
    const newOrders = await prisma.fuzeOrder.findMany({
      where: { createdAt: { gte: since } },
      include: {
        factory: { select: { name: true } },
        brand: { select: { name: true } },
        distributor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Order status changes (orders updated in last 24h but created before)
    const updatedOrders = await prisma.fuzeOrder.findMany({
      where: {
        updatedAt: { gte: since },
        createdAt: { lt: since },
      },
      include: {
        factory: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3b. Orders shipped in last 24h (separate from booked)
    const shippedOrders = await prisma.fuzeOrder.findMany({
      where: { shippedDate: { gte: since } },
      include: {
        factory: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { shippedDate: "desc" },
    });

    // ── Sales totals ──
    // Liquid FUZE is measured in liters; treated fabric is measured in kg.
    // Exclude HANGTAG orders from liquid/kg sums.
    const sumOrders = (rows: any[]) =>
      rows.reduce(
        (acc, o) => {
          const isLiquid = o.orderType === "PRODUCTION" || o.orderType === "SAMPLE";
          return {
            liters: acc.liters + (isLiquid ? (o.volumeLiters || 0) : 0),
            kg: acc.kg + (o.fabricMassKg || 0),
            dollars: acc.dollars + (o.totalPrice || 0),
            prodLiters: acc.prodLiters + (o.orderType === "PRODUCTION" ? (o.volumeLiters || 0) : 0),
            sampleLiters: acc.sampleLiters + (o.orderType === "SAMPLE" ? (o.volumeLiters || 0) : 0),
            hangtagQty: acc.hangtagQty + (o.orderType === "HANGTAG" ? (o.hangtagQty || 0) : 0),
          };
        },
        { liters: 0, kg: 0, dollars: 0, prodLiters: 0, sampleLiters: 0, hangtagQty: 0 }
      );

    const bookedTotals = sumOrders(newOrders);
    const shippedTotals = sumOrders(shippedOrders);

    const fmtNum = (n: number) =>
      n >= 1000 ? (n / 1000).toFixed(1) + "k" : n % 1 === 0 ? String(n) : n.toFixed(1);
    const fmtUSD = (n: number) =>
      n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + n.toFixed(0);

    // 4. New contacts added
    const newContacts = await prisma.contact.findMany({
      where: { createdAt: { gte: since } },
      include: {
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 5. Outreach activity (ContactOutreach checks)
    const outreachChecks = await prisma.contactOutreach.findMany({
      where: { createdAt: { gte: since } },
      include: {
        contact: { select: { name: true, email: true, brand: { select: { name: true } } } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 6. Test status changes
    const testUpdates = await prisma.testRun?.findMany?.({
      where: { updatedAt: { gte: since } },
      include: {
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }).catch(() => []) || [];

    // 6a. Overdue orders — rolling backlog, NOT a delta.
    //     Same philosophy as tickets: Andrew sees these every morning until
    //     they're shipped or cancelled. Five stall buckets, hottest first.
    const now24 = new Date();
    const dayAgo = (n: number) => new Date(now24.getTime() - n * 86400 * 1000);
    const [
      overdueSamples,
      stuckQuoted,
      stuckPendingApproval,
      stuckApproved,
      stuckProcessing,
    ] = await Promise.all([
      // SAMPLE orders created >=7 days ago, not shipped, not cancelled.
      // This is the Andrew-flagged case: factory orders sample, nothing moves.
      prisma.fuzeOrder.findMany({
        where: {
          orderType: "SAMPLE",
          shippedDate: null,
          status: { notIn: ["SHIPPED", "DELIVERED", "CANCELLED"] },
          createdAt: { lte: dayAgo(7) },
        },
        include: {
          factory: { select: { name: true } },
          brand: { select: { name: true } },
          orderedBy: { select: { name: true, email: true } },
          accountManager: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }).catch(() => []),
      // QUOTED > 3 days — factory placed it, quote sitting there, nobody accepted
      prisma.fuzeOrder.findMany({
        where: { status: "QUOTED", createdAt: { lte: dayAgo(3) } },
        include: {
          factory: { select: { name: true } },
          brand: { select: { name: true } },
          orderedBy: { select: { name: true } },
          accountManager: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }).catch(() => []),
      // PENDING_APPROVAL > 2 days — factory accepted quote, nobody approved it
      prisma.fuzeOrder.findMany({
        where: {
          status: "PENDING_APPROVAL",
          OR: [
            { quoteAcceptedAt: { lte: dayAgo(2) } },
            { quoteAcceptedAt: null, createdAt: { lte: dayAgo(2) } },
          ],
        },
        include: {
          factory: { select: { name: true } },
          brand: { select: { name: true } },
          accountManager: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }).catch(() => []),
      // APPROVED > 10 days without shipment — fulfillment stalled
      prisma.fuzeOrder.findMany({
        where: {
          status: "APPROVED",
          shippedDate: null,
          approvedAt: { lte: dayAgo(10) },
        },
        include: {
          factory: { select: { name: true } },
          brand: { select: { name: true } },
          distributor: { select: { name: true } },
          accountManager: { select: { name: true } },
        },
        orderBy: { approvedAt: "asc" },
      }).catch(() => []),
      // PROCESSING > 14 days without shipment — production stall
      prisma.fuzeOrder.findMany({
        where: {
          status: "PROCESSING",
          shippedDate: null,
          updatedAt: { lte: dayAgo(14) },
        },
        include: {
          factory: { select: { name: true } },
          brand: { select: { name: true } },
          distributor: { select: { name: true } },
        },
        orderBy: { updatedAt: "asc" },
      }).catch(() => []),
    ]);
    const overdueTotal =
      overdueSamples.length + stuckQuoted.length + stuckPendingApproval.length +
      stuckApproved.length + stuckProcessing.length;

    // 6b. Support tickets — rolling 24h feed PLUS running backlog counts.
    //     Andrew wants to see this block EVERY morning, not "since I checked."
    //     Source of truth: FeedbackReport table, written by /api/feedback from
    //     the in-app widget (lab, brand, distributor, factory, admin portals).
    const newFeedback = await prisma.feedbackReport.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    // Running backlog — "open" = anything still owed a response.
    // Exclude FIXED / REJECTED / DUPLICATE / CLOSED.
    const feedbackBacklog = await prisma.feedbackReport.groupBy({
      by: ["status"],
      where: { status: { in: ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"] } },
      _count: { _all: true },
    }).catch(() => []);
    const backlogByStatus: Record<string, number> = {};
    for (const row of feedbackBacklog) {
      backlogByStatus[row.status] = row._count._all;
    }
    const openFeedbackTotal =
      (backlogByStatus.NEW || 0) +
      (backlogByStatus.TRIAGED || 0) +
      (backlogByStatus.ACCEPTED || 0) +
      (backlogByStatus.IN_PROGRESS || 0);

    // 7. Key stats
    const totalBrands = await prisma.brand.count({ where: { pipelineStage: { not: "ARCHIVE" } } });
    const enrichedBrands = await prisma.brand.count({
      where: {
        pipelineStage: { not: "ARCHIVE" },
        contacts: { some: { OR: [{ email: { not: null } }, { linkedinUrl: { not: null } }] } },
      },
    });
    const activeOrders = await prisma.fuzeOrder.count({
      where: { status: { in: ["PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED"] } },
    });

    // ── Build email HTML ──
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    // Fetch action-required alerts from the shared rollup so the digest
    // subject + top-of-email section stay in sync with the /admin banner.
    // .catch guards a partial-failure so a lib crash can't kill the whole
    // digest.
    const alerts = await getAdminAlerts().catch(
      () => ({ items: [], total: 0 } as Awaited<ReturnType<typeof getAdminAlerts>>),
    );

    const alertRowsHtml = alerts.items
      .map(
        (i) => `
      <div style="display:flex;align-items:center;padding:10px 0;border-top:1px solid #fecaca;">
        <div style="min-width:36px;text-align:center;font-weight:900;color:#ffffff;background:#dc2626;border-radius:6px;padding:4px 8px;font-size:13px;">${i.count}</div>
        <div style="flex:1;padding-left:12px;font-weight:600;color:#7f1d1d;font-size:13px;">${i.label}</div>
        <a href="${baseUrl}${i.link}" style="color:#b91c1c;font-weight:700;text-decoration:none;font-size:13px;white-space:nowrap;">Open →</a>
      </div>`,
      )
      .join("");

    const alertsSectionHtml =
      alerts.total > 0
        ? `
<!-- Action Required — shared getAdminAlerts() -->
<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:12px;padding:20px;margin-bottom:24px;">
  <div style="font-size:16px;font-weight:900;color:#b91c1c;margin-bottom:8px;">🔴 Action Required · ${alerts.total}</div>
  ${alertRowsHtml}
</div>`
        : `
<!-- Action Required — clear -->
<div style="font-size:12px;color:#059669;margin-bottom:16px;font-weight:600;">✓ All operational queues clear.</div>`;

    let html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px;">

${alertsSectionHtml}

<!-- Header -->
<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:16px;padding:32px;margin-bottom:24px;color:white;">
  <h1 style="margin:0 0 4px;font-size:24px;font-weight:900;">FUZE Atlas Daily Digest</h1>
  <p style="margin:0;opacity:0.7;font-size:14px;">${dateStr}</p>
</div>

<!-- Quick Stats -->
<div style="display:flex;gap:12px;margin-bottom:24px;">
  <div style="flex:1;background:white;border-radius:12px;padding:16px;text-align:center;border:2px solid #e2e8f0;">
    <div style="font-size:28px;font-weight:900;color:#0f172a;">${notes.length}</div>
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">CRM Activities</div>
  </div>
  <div style="flex:1;background:white;border-radius:12px;padding:16px;text-align:center;border:2px solid #e2e8f0;">
    <div style="font-size:28px;font-weight:900;color:#0f172a;">${newOrders.length}</div>
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">New Orders</div>
  </div>
  <div style="flex:1;background:white;border-radius:12px;padding:16px;text-align:center;border:2px solid #e2e8f0;">
    <div style="font-size:28px;font-weight:900;color:#0f172a;">${outreachChecks.length}</div>
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Outreach Sent</div>
  </div>
  <div style="flex:1;background:white;border-radius:12px;padding:16px;text-align:center;border:2px solid #e2e8f0;">
    <div style="font-size:28px;font-weight:900;color:#0f172a;">${newContacts.length}</div>
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">New Contacts</div>
  </div>
  <div style="flex:1;background:white;border-radius:12px;padding:16px;text-align:center;border:2px solid ${openFeedbackTotal > 0 ? "#fca5a5" : "#e2e8f0"};">
    <div style="font-size:28px;font-weight:900;color:${openFeedbackTotal > 0 ? "#b91c1c" : "#0f172a"};">${openFeedbackTotal}</div>
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Open Tickets${newFeedback.length > 0 ? ` · +${newFeedback.length}` : ""}</div>
  </div>
</div>

<!-- Daily Sales (booked + shipped) -->
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid #00b4c3;">
  <div style="font-size:11px;font-weight:700;color:#0891a2;text-transform:uppercase;margin-bottom:12px;">💰 Daily Sales · last 24h</div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">
        <th style="padding:4px 0;"></th>
        <th style="padding:4px 0;text-align:right;">FUZE Liquid</th>
        <th style="padding:4px 0;text-align:right;">Fabric Treated</th>
        <th style="padding:4px 0;text-align:right;">Revenue</th>
        <th style="padding:4px 0;text-align:right;">Orders</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-top:1px solid #f1f5f9;">
        <td style="padding:8px 0;font-weight:700;color:#0f172a;">Booked</td>
        <td style="padding:8px 0;text-align:right;"><strong>${fmtNum(bookedTotals.liters)}</strong> L</td>
        <td style="padding:8px 0;text-align:right;"><strong>${fmtNum(bookedTotals.kg)}</strong> kg</td>
        <td style="padding:8px 0;text-align:right;"><strong>${fmtUSD(bookedTotals.dollars)}</strong></td>
        <td style="padding:8px 0;text-align:right;color:#64748b;">${newOrders.length}</td>
      </tr>
      <tr style="border-top:1px solid #f1f5f9;">
        <td style="padding:8px 0;font-weight:700;color:#0f172a;">Shipped</td>
        <td style="padding:8px 0;text-align:right;"><strong>${fmtNum(shippedTotals.liters)}</strong> L</td>
        <td style="padding:8px 0;text-align:right;"><strong>${fmtNum(shippedTotals.kg)}</strong> kg</td>
        <td style="padding:8px 0;text-align:right;"><strong>${fmtUSD(shippedTotals.dollars)}</strong></td>
        <td style="padding:8px 0;text-align:right;color:#64748b;">${shippedOrders.length}</td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0;font-size:11px;color:#64748b;">
    Booked breakdown: <strong>${fmtNum(bookedTotals.prodLiters)}L</strong> production · <strong>${fmtNum(bookedTotals.sampleLiters)}L</strong> sample${bookedTotals.hangtagQty > 0 ? ` · <strong>${bookedTotals.hangtagQty}</strong> hangtags` : ""}
  </div>
</div>

<!-- Platform Health -->
<div style="background:white;border-radius:12px;padding:16px;margin-bottom:24px;border:2px solid #e2e8f0;">
  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Platform Health</div>
  <div style="display:flex;gap:24px;font-size:13px;">
    <span><strong>${totalBrands}</strong> active brands</span>
    <span><strong>${enrichedBrands}</strong> enriched</span>
    <span><strong>${activeOrders}</strong> active orders</span>
  </div>
</div>`;

    // ── Overdue Orders ──
    // Always renders counts; only renders detail blocks for non-empty buckets.
    // Hot-spot block — put it before Support Tickets since orders = $ and
    // Andrew explicitly flagged sample orders rotting for 2 weeks.
    {
      const hasOverdue = overdueTotal > 0;
      const accent = hasOverdue ? "#b91c1c" : "#94a3b8";
      const accentSoft = hasOverdue ? "#fca5a5" : "#e2e8f0";
      const ageDays = (d: Date | null) =>
        d ? Math.floor((now24.getTime() - new Date(d).getTime()) / 86400000) : 0;
      const orderRow = (o: any, ageFrom: Date | null, ageLabel: string) => {
        const age = ageDays(ageFrom);
        const ageBadge = age >= 21 ? "#991b1b" : age >= 14 ? "#b91c1c" : age >= 7 ? "#c2410c" : "#92400e";
        const detail = o.volumeLiters ? `${o.volumeLiters}L`
          : o.hangtagQty ? `${o.hangtagQty} hangtags`
          : "—";
        const am = o.accountManager?.name || "<span style='color:#b91c1c;'>no AM</span>";
        return `
    <div style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
        <strong style="color:#0f172a;">${o.orderNumber}</strong>
        <span style="font-size:10px;font-weight:800;color:white;background:${ageBadge};padding:2px 6px;border-radius:4px;">${age}d ${ageLabel}</span>
        <span style="font-size:10px;color:#64748b;margin-left:auto;">${o.orderType} · ${detail}</span>
      </div>
      <div style="font-size:12px;color:#64748b;">
        ${o.factory?.name || "?"}${o.brand?.name ? ` · for ${o.brand.name}` : ""} · AM: ${am}
        ${o.orderedBy?.name ? ` · placed by ${o.orderedBy.name}` : ""}
      </div>
      <a href="${baseUrl}/admin/orders?q=${encodeURIComponent(o.orderNumber)}" style="font-size:11px;color:#2563eb;text-decoration:none;">Open order →</a>
    </div>`;
      };

      html += `
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid ${accentSoft};">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <h2 style="margin:0;font-size:16px;font-weight:900;color:${accent};">⏰ Overdue Orders · ${overdueTotal}</h2>
    <a href="${baseUrl}/admin/orders" style="font-size:12px;color:#2563eb;text-decoration:none;font-weight:700;">Orders board →</a>
  </div>

  <!-- Stall buckets -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
    <div style="flex:1;min-width:100px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#991b1b;">${overdueSamples.length}</div>
      <div style="font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">Samples &gt;7d</div>
    </div>
    <div style="flex:1;min-width:100px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#9a3412;">${stuckQuoted.length}</div>
      <div style="font-size:10px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;">Quoted &gt;3d</div>
    </div>
    <div style="flex:1;min-width:100px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#92400e;">${stuckPendingApproval.length}</div>
      <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Pending &gt;2d</div>
    </div>
    <div style="flex:1;min-width:100px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#1e40af;">${stuckApproved.length}</div>
      <div style="font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">Approved &gt;10d</div>
    </div>
    <div style="flex:1;min-width:100px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#065f46;">${stuckProcessing.length}</div>
      <div style="font-size:10px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Processing &gt;14d</div>
    </div>
  </div>`;

      if (overdueSamples.length > 0) {
        html += `<div style="font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 6px;">🚨 Sample orders not shipped (${overdueSamples.length})</div>`;
        for (const o of overdueSamples) html += orderRow(o, o.createdAt, "since placed");
      }
      if (stuckQuoted.length > 0) {
        html += `<div style="font-size:11px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 6px;">Quotes not accepted (${stuckQuoted.length})</div>`;
        for (const o of stuckQuoted) html += orderRow(o, o.createdAt, "since quoted");
      }
      if (stuckPendingApproval.length > 0) {
        html += `<div style="font-size:11px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 6px;">Awaiting your approval (${stuckPendingApproval.length})</div>`;
        for (const o of stuckPendingApproval) html += orderRow(o, o.quoteAcceptedAt || o.createdAt, "awaiting");
      }
      if (stuckApproved.length > 0) {
        html += `<div style="font-size:11px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 6px;">Approved but not shipped (${stuckApproved.length})</div>`;
        for (const o of stuckApproved) html += orderRow(o, o.approvedAt, "since approved");
      }
      if (stuckProcessing.length > 0) {
        html += `<div style="font-size:11px;font-weight:800;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 6px;">Stuck in production (${stuckProcessing.length})</div>`;
        for (const o of stuckProcessing) html += orderRow(o, o.updatedAt, "since last update");
      }
      if (overdueTotal === 0) {
        html += `<div style="padding:14px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;text-align:center;">No overdue orders. Ship speed is healthy.</div>`;
      }

      html += `</div>`;
    }

    // ── Support Tickets ──
    // ALWAYS renders — Andrew wants a daily read of backlog + new, not a delta.
    // Red accent only when there's an open backlog or a new ticket overnight.
    {
      const hasActivity = newFeedback.length > 0 || openFeedbackTotal > 0;
      const accent = hasActivity ? "#dc2626" : "#94a3b8";
      const accentSoft = hasActivity ? "#fecaca" : "#e2e8f0";
      const categoryIcons: Record<string, string> = {
        PROBLEM: "⚠️", CONFUSING: "❓", MISSING: "➕", SUGGESTION: "💡",
        BROKEN_LINK: "🔗", ERROR: "🛑", OTHER: "📝",
      };

      html += `
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid ${accentSoft};">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <h2 style="margin:0;font-size:16px;font-weight:900;color:${accent};">🎫 Support Tickets</h2>
    <a href="${baseUrl}/admin/feedback" style="font-size:12px;color:#2563eb;text-decoration:none;font-weight:700;">Triage queue →</a>
  </div>

  <!-- Backlog pills -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
    <div style="flex:1;min-width:110px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#991b1b;">${backlogByStatus.NEW || 0}</div>
      <div style="font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">New</div>
    </div>
    <div style="flex:1;min-width:110px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#92400e;">${backlogByStatus.TRIAGED || 0}</div>
      <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Triaged</div>
    </div>
    <div style="flex:1;min-width:110px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#1e40af;">${backlogByStatus.ACCEPTED || 0}</div>
      <div style="font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">Accepted</div>
    </div>
    <div style="flex:1;min-width:110px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#065f46;">${backlogByStatus.IN_PROGRESS || 0}</div>
      <div style="font-size:10px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">In Progress</div>
    </div>
  </div>

  <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
    Submitted last 24h · ${newFeedback.length}
  </div>`;

      if (newFeedback.length === 0) {
        html += `
  <div style="padding:14px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;text-align:center;">
    No new tickets in the last 24 hours.
  </div>`;
      } else {
        for (const fb of newFeedback) {
          const icon = categoryIcons[fb.category] || "📝";
          const submitter = fb.user?.name || fb.userName || fb.userEmail || "Anonymous";
          const role = fb.user?.role || fb.userRole || "";
          const portal = fb.portal || "—";
          const createdStr = new Date(fb.createdAt).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          });
          const title = (fb.title || "").slice(0, 120);
          const desc = fb.description || "";
          const descPreview = desc.length > 220 ? desc.slice(0, 220) + "…" : desc;

          html += `
  <div style="padding:14px;margin-bottom:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
      <span style="font-size:16px;">${icon}</span>
      <strong style="font-size:13px;color:#0f172a;flex:1;">${title}</strong>
      <span style="font-size:10px;font-weight:700;color:#92400e;background:#fde68a;padding:2px 8px;border-radius:4px;text-transform:uppercase;">${fb.category}</span>
    </div>
    <div style="font-size:12px;color:#64748b;margin-bottom:8px;">
      <strong>${submitter}</strong>${role ? ` <span style="font-size:10px;color:#94a3b8;">(${role})</span>` : ""} · <span style="color:#0891a2;">${portal}</span> · ${createdStr}
    </div>
    <div style="font-size:13px;color:#334155;line-height:1.5;margin-bottom:8px;white-space:pre-wrap;">${descPreview}</div>
    <div style="display:flex;gap:12px;font-size:11px;">
      ${fb.url ? `<span style="color:#94a3b8;">📍 ${fb.url.replace(/^https?:\/\//, "").slice(0, 60)}</span>` : ""}
      ${fb.screenshotUrl ? `<a href="${fb.screenshotUrl}" style="color:#2563eb;text-decoration:none;font-weight:700;">📷 Screenshot</a>` : ""}
      <a href="${baseUrl}/admin/feedback?ticket=${fb.id}" style="color:#2563eb;text-decoration:none;font-weight:700;margin-left:auto;">Open ticket →</a>
    </div>
  </div>`;
        }
      }

      html += `</div>`;
    }

    // ── CRM Activity Section ──
    if (notes.length > 0) {
      const typeIcons: Record<string, string> = {
        NOTE: "📝", CALL: "📞", EMAIL: "✉️", MEETING: "🤝", TASK: "✅", FOLLOW_UP: "🔄",
      };

      html += `
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid #bfdbfe;">
  <h2 style="margin:0 0 16px;font-size:16px;font-weight:900;color:#1e40af;">📋 CRM Activity (${notes.length})</h2>`;

      for (const note of notes.slice(0, 15)) {
        const entity = note.brand?.name || note.factory?.name || "—";
        const entityType = note.brand ? "brand" : "factory";
        const entityId = note.brand?.id || note.factory?.id;
        const noteType = note.noteType || "NOTE";
        const icon = typeIcons[noteType] || "📝";
        const noteDate = note.date || note.createdAt;
        const time = noteDate
          ? new Date(noteDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "—";
        const by = note.user?.name || "System";
        const content = note.content || "";
        const preview = content.length > 150 ? content.slice(0, 150) + "..." : content;

        html += `
  <div style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span>${icon}</span>
      <strong style="font-size:13px;color:#0f172a;">${entity}</strong>
      <span style="font-size:11px;color:#94a3b8;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${noteType.replace("_", " ")}</span>
      <span style="font-size:11px;color:#94a3b8;margin-left:auto;">${time} · ${by}</span>
    </div>
    ${note.contactName ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px;">with ${note.contactName}</div>` : ""}
    <div style="font-size:13px;color:#334155;line-height:1.5;">${preview}</div>
    ${entityId ? `<a href="${baseUrl}/${entityType === "brand" ? "brands" : "factories"}/${entityId}" style="font-size:11px;color:#2563eb;text-decoration:none;">View ${entityType} →</a>` : ""}
  </div>`;
      }

      if (notes.length > 15) {
        html += `<p style="font-size:12px;color:#94a3b8;margin:12px 0 0;">+ ${notes.length - 15} more activities. <a href="${baseUrl}/admin/brand-pipeline" style="color:#2563eb;">View in Atlas →</a></p>`;
      }
      html += `</div>`;
    }

    // ── New Orders Section ──
    if (newOrders.length > 0) {
      html += `
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid #bbf7d0;">
  <h2 style="margin:0 0 16px;font-size:16px;font-weight:900;color:#166534;">🛒 New Orders (${newOrders.length})</h2>`;

      for (const order of newOrders) {
        html += `
  <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
    <div style="font-size:13px;"><strong>${order.orderNumber}</strong> — ${order.factory?.name || "?"}</div>
    <div style="font-size:12px;color:#64748b;">${order.orderType} · ${order.volumeLiters || 0}L · ${order.status} ${order.brand?.name ? `· for ${order.brand.name}` : ""}</div>
    ${order.distributor?.name ? `<div style="font-size:11px;color:#94a3b8;">via ${order.distributor.name}</div>` : ""}
  </div>`;
      }
      html += `</div>`;
    }

    // ── Outreach Activity ──
    if (outreachChecks.length > 0) {
      html += `
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid #c4b5fd;">
  <h2 style="margin:0 0 16px;font-size:16px;font-weight:900;color:#5b21b6;">📤 Outreach Sent (${outreachChecks.length})</h2>`;

      for (const check of outreachChecks.slice(0, 10)) {
        const brandName = check.contact?.brand?.name || "—";
        html += `
  <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
    <strong>${check.user?.name || "?"}</strong> sent <span style="background:${check.type === "LINKEDIN" ? "#dbeafe" : "#ede9fe"};padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;">${check.type}</span> to ${check.contact?.name || "?"} (${brandName})
  </div>`;
      }
      html += `</div>`;
    }

    // ── New Contacts ──
    if (newContacts.length > 0) {
      html += `
<div style="background:white;border-radius:12px;padding:20px;margin-bottom:24px;border:2px solid #fde68a;">
  <h2 style="margin:0 0 16px;font-size:16px;font-weight:900;color:#92400e;">👤 New Contacts (${newContacts.length})</h2>`;

      for (const c of newContacts.slice(0, 10)) {
        const entity = c.brand?.name || c.factory?.name || "—";
        html += `
  <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
    <strong>${c.name || "?"}</strong> ${c.jobTitle ? `— ${c.jobTitle}` : ""} (${entity})
    ${c.email ? `<span style="font-size:11px;color:#2563eb;"> · ${c.email}</span>` : ""}
  </div>`;
      }
      html += `</div>`;
    }

    // ── Zero Activity Alert ──
    // Don't suppress the "quiet yesterday" banner just because a ticket came
    // in — tickets get their own panel. But also don't show this banner if
    // there's an open backlog worth Andrew's attention.
    if (
      notes.length === 0 &&
      newOrders.length === 0 &&
      outreachChecks.length === 0 &&
      newFeedback.length === 0 &&
      openFeedbackTotal === 0
    ) {
      html += `
<div style="background:#fef2f2;border-radius:12px;padding:24px;margin-bottom:24px;border:2px solid #fecaca;text-align:center;">
  <div style="font-size:32px;margin-bottom:8px;">🔇</div>
  <h3 style="margin:0 0 4px;color:#991b1b;font-size:16px;">No Activity in the Last 24 Hours</h3>
  <p style="margin:0;color:#b91c1c;font-size:13px;">No CRM notes, orders, or outreach were logged yesterday.</p>
</div>`;
    }

    // ── Footer ──
    html += `
<div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
  <a href="${baseUrl}/dashboard" style="color:#2563eb;text-decoration:none;font-weight:700;">Open FUZE Atlas →</a>
  <br><br>
  FUZE Biotech · 1895 West 2100 South, SLC, UT 84119
</div>

</div>
</body>
</html>`;

    // ── Send ──
    const subjectSales = shippedTotals.liters > 0
      ? `${fmtNum(shippedTotals.liters)}L shipped`
      : bookedTotals.liters > 0
        ? `${fmtNum(bookedTotals.liters)}L booked`
        : `${newOrders.length} orders`;
    const ticketTag = newFeedback.length > 0
      ? `, ${newFeedback.length} new ticket${newFeedback.length === 1 ? "" : "s"}`
      : openFeedbackTotal > 0
        ? `, ${openFeedbackTotal} open ticket${openFeedbackTotal === 1 ? "" : "s"}`
        : "";
    const result = await sendEmail({
      to: DIGEST_RECIPIENTS,
      subject: `${alerts.total > 0 ? `🔴 ${alerts.total} to action · ` : ""}FUZE Daily Digest — ${subjectSales}, ${notes.length} activities, ${outreachChecks.length} outreach${ticketTag}`,
      html,
    });

    return NextResponse.json({
      ok: true,
      sent: result,
      summary: {
        notes: notes.length,
        newOrders: newOrders.length,
        updatedOrders: updatedOrders.length,
        shippedOrders: shippedOrders.length,
        newContacts: newContacts.length,
        outreachChecks: outreachChecks.length,
        bookedLiters: bookedTotals.liters,
        bookedKg: bookedTotals.kg,
        shippedLiters: shippedTotals.liters,
        shippedKg: shippedTotals.kg,
        newFeedback: newFeedback.length,
        openFeedback: openFeedbackTotal,
        feedbackBacklog: backlogByStatus,
      },
    });
  } catch (e: any) {
    console.error("Daily digest error:", e);

    // Fallback: at least tell Andrew the digest crashed so it isn't
    // silently swallowed by Vercel logs. We deliberately keep this
    // outside the main try so a second failure here won't mask the
    // original error in the response.
    try {
      await sendEmail({
        to: DIGEST_RECIPIENTS,
        subject: `⚠️ FUZE Daily Digest FAILED — ${new Date().toISOString()}`,
        html: `<p>The daily digest cron threw an error:</p>
<pre style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;">${
          String(e?.message || e)
        }</pre>
<pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:11px;white-space:pre-wrap;">${
          String(e?.stack || "").slice(0, 4000)
        }</pre>`,
      });
    } catch (emailErr) {
      console.error("Failed to send digest error notification:", emailErr);
    }

    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
