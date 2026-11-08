import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { INTERNAL_ROLES, appUrl, getBook, mondayOf } from "@/lib/book";

/**
 * GET /api/cron/book-monday — Monday 13:00 UTC (6am Denver), before the
 * weekly-review cron at 14:00. The manager digest: who checked in, super
 * updates, help queue and escalations, stage / forecast / order changes,
 * accounts going cold. Goes to Andrew; Tandy is copied when any
 * distributor-side book exists (Hi-Goal).
 */
const CRON_SECRET = process.env.CRON_SECRET;
const TO = ["andrew@fuze47.com", "andrew@801inc.com"];
const HI_GOAL_CC = ["tandy@fuze47.com"];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const thisMonday = mondayOf(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const base = appUrl();

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: [...INTERNAL_ROLES, "DISTRIBUTOR_USER"] as any } },
    select: { id: true, name: true, distributorId: true },
  });
  const people: {
    name: string;
    dist: boolean;
    total: number;
    touched: number;
    cold: string[];
    notTouched: string[];
  }[] = [];
  for (const u of users) {
    const book = await getBook(u.id, new Date(thisMonday.getTime() - 1)); // as of Sunday night: checkedInThisWeek = last week
    if (!book.length) continue;
    people.push({
      name: u.name,
      dist: !!u.distributorId,
      total: book.length,
      touched: book.filter((a) => a.checkedInThisWeek).length,
      cold: book.filter((a) => a.attention === "red").map((a) => a.name),
      notTouched: book.filter((a) => !a.checkedInThisWeek).map((a) => a.name),
    });
  }
  people.sort((a, b) => b.total - b.touched - (a.total - a.touched));

  const [supers, help, changes] = await Promise.all([
    prisma.accountCheckin.findMany({
      where: { kind: "SUPER", createdAt: { gte: lastMonday, lt: thisMonday } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.helpRequest.findMany({
      where: { status: { in: ["OPEN", "ACKED", "ESCALATED"] } },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }],
      include: { requester: { select: { name: true } }, assignee: { select: { name: true } } },
    }),
    prisma.accountCheckin.findMany({
      where: {
        createdAt: { gte: lastMonday, lt: thisMonday },
        OR: [
          { stageAfter: { not: null } },
          { forecastAfter: { not: null } },
          { orderKg: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ]);
  const names = await resolveNames([...supers, ...help, ...changes]);
  const n = (x: any) => names[`${x.entityType}:${x.entityId}`] || x.entityId;

  const h2 = (s: string) =>
    `<h2 style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#003B4A;margin:18px 0 6px;border-bottom:1px solid #DDE2E4;padding-bottom:4px">${s}</h2>`;
  const peopleRows = people
    .map(
      (p) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #EEF1F3"><b>${esc(p.name)}</b>${p.dist ? ' <span style="font-size:10px;color:#6B7378">dist</span>' : ""}</td><td style="padding:4px 8px;border-bottom:1px solid #EEF1F3;text-align:right;color:${p.touched === p.total ? "#15803D" : p.touched === 0 ? "#B91C1C" : "#B45309"};font-weight:700">${p.touched}/${p.total}</td><td style="padding:4px 8px;border-bottom:1px solid #EEF1F3;font-size:12px;color:#6B7378">${p.notTouched.length ? `missed: ${esc(p.notTouched.slice(0, 6).join(", "))}${p.notTouched.length > 6 ? ` +${p.notTouched.length - 6}` : ""}` : "all touched"}</td></tr>`,
    )
    .join("");
  const superRows =
    supers
      .map(
        (s) =>
          `<div style="margin:0 0 10px;padding:10px 12px;border-left:3px solid #F59E0B;background:#FFFBEB"><div style="font-size:11px;color:#92400E">${esc(n(s))} · ${esc(s.user.name)}</div><div style="font-weight:700">${esc(s.headline || "")}</div>${s.note ? `<div style="font-size:13px;white-space:pre-wrap;margin-top:4px">${esc(s.note)}</div>` : ""}</div>`,
      )
      .join("") || `<p style="font-size:13px;color:#6B7378">None this week.</p>`;
  const helpRows =
    help
      .map(
        (h) =>
          `<div style="margin:0 0 8px;padding:8px 12px;border-left:3px solid ${h.status === "ESCALATED" ? "#B91C1C" : "#DDE2E4"};background:${h.status === "ESCALATED" ? "#FEF2F2" : "#F8FAFC"}"><div style="font-size:11px;color:#6B7378">${h.status === "ESCALATED" ? "🔺 ESCALATED · " : ""}${esc(h.requester.name)} → ${esc(h.assignee.name)} · ${esc(n(h))} · ${h.dueAt < now ? "overdue" : "due " + h.dueAt.toISOString().slice(0, 10)}</div><div style="font-size:13px">${esc(h.ask)}</div></div>`,
      )
      .join("") || `<p style="font-size:13px;color:#6B7378">Nothing open.</p>`;
  const changeRows = changes
    .map(
      (c) =>
        `<tr><td style="padding:3px 8px;border-bottom:1px solid #EEF1F3"><b>${esc(n(c))}</b></td><td style="padding:3px 8px;border-bottom:1px solid #EEF1F3;font-size:13px">${c.stageAfter ? `stage ${esc(c.stageBefore || "—")} → <b>${esc(c.stageAfter)}</b> ` : ""}${c.forecastAfter ? `forecast ${esc(c.forecastBefore || "—")} → <b>${esc(c.forecastAfter)}</b> ` : ""}${c.orderKg ? `order <b>${c.orderKg} kg ${esc(c.orderProduct || "")}</b> (${esc(c.orderMonth || "")})` : ""}</td><td style="padding:3px 8px;border-bottom:1px solid #EEF1F3;font-size:11px;color:#6B7378">${esc(c.user.name)}</td></tr>`,
    )
    .join("");
  const coldList = people.flatMap((p) =>
    p.cold.map(
      (c) => `${esc(c)} <span style="color:#6B7378">(${esc(p.name.split(" ")[0])})</span>`,
    ),
  );

  const html = `<!doctype html><html><body style="margin:0;background:#F4F7F8;font-family:Helvetica,Arial,sans-serif;color:#12181B">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
 <div style="background:#003B4A;color:#fff;padding:12px 18px;border-radius:8px 8px 0 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase">FUZE Atlas · Monday book digest · week of ${lastMonday.toISOString().slice(0, 10)}</div>
 <div style="background:#fff;padding:18px;border:1px solid #DDE2E4;border-top:0;border-radius:0 0 8px 8px">
  <p style="margin:0 0 6px;font-size:14px"><b>${people.reduce((s, p) => s + p.touched, 0)}</b> of <b>${people.reduce((s, p) => s + p.total, 0)}</b> accounts touched · <b>${supers.length}</b> super updates · <b>${help.filter((h) => h.status === "ESCALATED").length}</b> escalations · <b>${changes.filter((c) => c.orderKg).length}</b> orders logged</p>
  <p style="margin:0 0 4px"><a href="${base}/book/team" style="color:#0B6E8C">Open the team board →</a></p>
  ${h2("Check-ins")}<table style="width:100%;border-collapse:collapse;font-size:14px">${peopleRows}</table>
  ${h2("⭐ Super updates — for the exec review")}${superRows}
  ${h2("🙋 Help queue")}${helpRows}
  ${h2("Stage, forecast and order changes")}${changeRows ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${changeRows}</table>` : `<p style="font-size:13px;color:#6B7378">None.</p>`}
  ${h2("Going cold (4+ silent weeks)")}<p style="font-size:13px;line-height:1.6">${coldList.length ? coldList.join(" · ") : "None."}</p>
 </div>
</div></body></html>`;

  const cc = people.some((p) => p.dist) ? HI_GOAL_CC : undefined;
  await sendEmail({
    to: TO,
    cc,
    subject: `Book digest: ${people.reduce((s, p) => s + p.touched, 0)}/${people.reduce((s, p) => s + p.total, 0)} touched · ${supers.length} ⭐ · ${help.filter((h) => h.status === "ESCALATED").length} escalated`,
    html,
  });
  return NextResponse.json({
    ok: true,
    people: people.length,
    supers: supers.length,
    help: help.length,
    changes: changes.length,
  });
}

async function resolveNames(rows: { entityType: string; entityId: string }[]) {
  const b = [...new Set(rows.filter((r) => r.entityType === "BRAND").map((r) => r.entityId))];
  const f = [...new Set(rows.filter((r) => r.entityType === "FACTORY").map((r) => r.entityId))];
  const [bn, fn] = await Promise.all([
    b.length
      ? prisma.brand.findMany({ where: { id: { in: b } }, select: { id: true, name: true } })
      : [],
    f.length
      ? prisma.factory.findMany({ where: { id: { in: f } }, select: { id: true, name: true } })
      : [],
  ]);
  const out: Record<string, string> = {};
  for (const x of bn) out[`BRAND:${x.id}`] = x.name;
  for (const x of fn) out[`FACTORY:${x.id}`] = x.name;
  return out;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
