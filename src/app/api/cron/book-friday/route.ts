import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  INTERNAL_ROLES,
  appUrl,
  createBookLinkToken,
  getBook,
  isLocalHour,
  mondayOf,
} from "@/lib/book";

/**
 * GET /api/cron/book-friday — runs hourly on Fridays (vercel.json: "0 * * * 5").
 * Each person with accounts in their book gets ONE email at 8am in their own
 * time zone (User.timezone, default America/Denver) with a signed one-click
 * link into the wizard. A Notification row marks the send so the hourly
 * sweep never double-sends.
 *
 * Test: /api/cron/book-friday?force=1&userId=<id>  (bearer CRON_SECRET)
 */
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const onlyUser = url.searchParams.get("userId");
  const now = new Date();
  const weekOf = mondayOf(now);

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: [...INTERNAL_ROLES, "DISTRIBUTOR_USER"] as any },
      ...(onlyUser ? { id: onlyUser } : {}),
    },
    select: { id: true, name: true, email: true, timezone: true },
  });

  const sent: string[] = [],
    skipped: string[] = [];
  for (const u of users) {
    if (!force && !isLocalHour(now, u.timezone, 8)) {
      skipped.push(`${u.email}:hour`);
      continue;
    }
    const already = await prisma.notification.findFirst({
      where: {
        userId: u.id,
        type: "SYSTEM",
        title: { startsWith: "Friday check-in" },
        createdAt: { gte: weekOf },
      },
      select: { id: true },
    });
    if (already && !force) {
      skipped.push(`${u.email}:sent`);
      continue;
    }
    const book = await getBook(u.id, now);
    if (!book.length) {
      skipped.push(`${u.email}:empty`);
      continue;
    }
    const todo = book.filter((a) => !a.checkedInThisWeek);
    const cold = book.filter((a) => a.attention === "red");
    const helpForMe = await prisma.helpRequest.count({
      where: { assigneeId: u.id, status: { in: ["OPEN", "ACKED", "ESCALATED"] } },
    });
    const token = await createBookLinkToken(u.id);
    const link = `${appUrl()}/book/go/${token}`;
    const first = u.name?.split(" ")[0] || "there";

    const rows = todo
      .slice(0, 12)
      .map(
        (a) =>
          `<tr><td style="padding:4px 8px;border-bottom:1px solid #EEF1F3">${esc(a.name)}</td><td style="padding:4px 8px;border-bottom:1px solid #EEF1F3;color:#6B7378;font-size:12px">${esc([a.country, a.stage?.replace(/_/g, " ").toLowerCase()].filter(Boolean).join(" · "))}</td><td style="padding:4px 8px;border-bottom:1px solid #EEF1F3;text-align:right;font-size:12px;color:${a.attention === "red" ? "#B91C1C" : a.attention === "amber" ? "#B45309" : "#6B7378"}">${a.silentWeeks >= 99 ? "never touched" : a.silentWeeks ? `${a.silentWeeks}w quiet` : "fresh"}</td></tr>`,
      )
      .join("");

    const html = `<!doctype html><html><body style="margin:0;background:#F4F7F8;font-family:Helvetica,Arial,sans-serif;color:#12181B">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
 <div style="background:#003B4A;color:#fff;padding:12px 18px;border-radius:8px 8px 0 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase">FUZE Atlas · Friday check-in</div>
 <div style="background:#fff;padding:20px 18px;border:1px solid #DDE2E4;border-top:0;border-radius:0 0 8px 8px">
  <h1 style="font-size:18px;margin:0 0 8px;color:#003B4A">${esc(first)}, ${todo.length} account${todo.length === 1 ? "" : "s"} to touch this week</h1>
  <p style="font-size:14px;line-height:1.5;margin:0 0 14px">${helpForMe ? `<b style="color:#B91C1C">${helpForMe} teammate${helpForMe === 1 ? " is" : "s are"} waiting on you.</b> ` : ""}${cold.length ? `${cold.length} account${cold.length === 1 ? " is" : "s are"} going cold. ` : ""}Four buttons per account, about ten minutes.</p>
  <p style="margin:0 0 18px"><a href="${link}" style="display:inline-block;background:#0DA8D2;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700;font-size:15px">Start check-in →</a></p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
  ${todo.length > 12 ? `<p style="font-size:12px;color:#6B7378;margin:8px 0 0">…and ${todo.length - 12} more.</p>` : ""}
  <p style="font-size:12px;color:#6B7378;margin:16px 0 0">The link signs you in automatically and works on your phone. It is yours alone and expires in 10 days.</p>
 </div>
</div></body></html>`;

    await sendEmail({
      to: u.email,
      subject: `Friday check-in: ${todo.length} account${todo.length === 1 ? "" : "s"}${helpForMe ? ` · ${helpForMe} waiting on you` : ""}`,
      html,
    });
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: "SYSTEM",
        title: `Friday check-in: ${todo.length} accounts`,
        message: "Your weekly check-in is ready.",
        link: "/book/checkin",
        metadata: { weekOf },
      },
    });
    sent.push(u.email);
  }
  return NextResponse.json({ ok: true, weekOf, sent, skipped: skipped.length });
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
