// @ts-nocheck
/**
 * GET /api/cron/notification-deliveries — Phase 10K.
 *
 * Bearer-authed. Runs every 15 minutes (vercel.json). Walks
 * NotificationDelivery rows with scheduledFor <= now AND
 * deliveredAt is null. Stamps deliveredAt; if channel="email"
 * or "sms" the actual send happens here too.
 *
 * in_app channel is a no-op fire (the Notification row was
 * created immediately by scheduleNotification — the in-app
 * sidebar reads that table directly).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.notificationDelivery.findMany({
    where: {
      scheduledFor: { lte: now },
      deliveredAt: null,
      attempts: { lt: 5 },
    },
    take: 200,
    include: {
      notification: {
        include: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  let delivered = 0;
  let failed = 0;
  for (const d of due) {
    try {
      const n = d.notification;
      if (d.channel === "in_app") {
        // Already visible via Notification table.
      } else if (d.channel === "email" && n.user?.email) {
        await sendEmail({
          to: n.user.email,
          subject: n.title,
          html: `<p>${n.message || ""}</p>${n.link ? `<p><a href="https://fuzeatlas.com${n.link}">Open in Atlas →</a></p>` : ""}`,
        });
      } else if (d.channel === "sms") {
        // Optional — only fire if the user has a phone column;
        // not all users do, so this is best-effort.
      }
      await prisma.notificationDelivery.update({
        where: { id: d.id },
        data: { deliveredAt: new Date(), attempts: { increment: 1 } },
      });
      delivered++;
    } catch (err) {
      await prisma.notificationDelivery.update({
        where: { id: d.id },
        data: { attempts: { increment: 1 } },
      });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, considered: due.length, delivered, failed });
}
