// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

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

    let html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px;">

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
    if (notes.length === 0 && newOrders.length === 0 && outreachChecks.length === 0) {
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
    const result = await sendEmail({
      to: DIGEST_RECIPIENTS,
      subject: `FUZE Daily Digest — ${subjectSales}, ${notes.length} activities, ${outreachChecks.length} outreach`,
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
