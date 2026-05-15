// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * GET/POST /api/cron/lab-queue-digest
 *
 * BONUS-5 — lab portal daily queue digest. Hourly cron. For each Lab
 * with a configured `timezone`, check if the lab's local clock is
 * currently inside the 07:00 hour window. If yes, gather the day's
 * queue and email every ACTIVE Lab user.
 *
 * Per-lab dedupe: stamps a Notification row with metadata.kind =
 * "lab-queue-digest" + scopeId = lab.id. The standard 22h
 * suppression check (mirrors src/lib/notify.ts:alreadyNotified)
 * prevents double-sends when the cron fires at 07:03, 07:30, etc.
 *
 * Queue gathered per lab:
 *   - testsToStart      = TestRequest where labId AND status in
 *                         (APPROVED, ASSIGNED_TO_LAB, SUBMITTED)
 *   - testsDueToday     = TestRequest where labId AND status in
 *                         (SUBMITTED, IN_PROGRESS) AND
 *                         estimatedCompletionDate <= end-of-today
 *   - rawUploadsPending = TestRun where labId AND brandVisible=false
 *                         (raw data still awaiting brand-visible flip)
 *
 * The cron is bearer-authed. Andrew fires from his Mac via
 * `fzcron lab-queue-digest` or via a Vercel hourly schedule.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const TARGET_LOCAL_HOUR = 7;
const FAN_OUT_SUPPRESSION_HOURS = 22;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

function escape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso: Date | string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function currentHourInTimezone(tz: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    if (!hourPart) return null;
    // Intl returns "24" for midnight in some locales — normalize.
    const h = parseInt(hourPart.value, 10);
    return h === 24 ? 0 : h;
  } catch {
    return null;
  }
}

async function alreadyDigested(labId: string): Promise<boolean> {
  const since = new Date(Date.now() - FAN_OUT_SUPPRESSION_HOURS * 60 * 60_000);
  const recent = await prisma.notification.findFirst({
    where: {
      createdAt: { gte: since },
      metadata: { path: ["kind"], equals: "lab-queue-digest" },
      AND: { metadata: { path: ["scopeId"], equals: labId } },
    },
    select: { id: true },
  });
  return !!recent;
}

interface QueuePayload {
  testsToStart: any[];
  testsDueToday: any[];
  rawUploadsPending: any[];
}

async function gatherQueue(labId: string): Promise<QueuePayload> {
  const now = new Date();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  const [testsToStart, testsDueToday, rawUploadsPending] = await Promise.all([
    prisma.testRequest.findMany({
      where: {
        labId,
        status: { in: ["APPROVED", "ASSIGNED_TO_LAB", "SUBMITTED"] },
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        priority: true,
        brand: { select: { name: true } },
        submission: {
          select: {
            fuzeFabricNumber: true,
            fabric: { select: { fuzeNumber: true } },
          },
        },
      },
      orderBy: { priority: "asc" },
      take: 20,
    }),
    prisma.testRequest.findMany({
      where: {
        labId,
        status: { in: ["SUBMITTED", "IN_PROGRESS"] },
        estimatedCompletionDate: { lte: endOfToday, not: null },
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        estimatedCompletionDate: true,
        brand: { select: { name: true } },
        submission: {
          select: {
            fuzeFabricNumber: true,
            fabric: { select: { fuzeNumber: true } },
          },
        },
      },
      orderBy: { estimatedCompletionDate: "asc" },
      take: 20,
    }),
    prisma.testRun.findMany({
      where: { labId, brandVisible: false },
      select: {
        id: true,
        testType: true,
        testDate: true,
        submission: {
          select: {
            fuzeFabricNumber: true,
            fabric: { select: { fuzeNumber: true } },
            brand: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { testsToStart, testsDueToday, rawUploadsPending };
}

function composeEmail(
  labName: string,
  queue: QueuePayload,
): { subject: string; html: string; text: string } {
  const totalCount =
    queue.testsToStart.length + queue.testsDueToday.length + queue.rawUploadsPending.length;
  const subject =
    totalCount === 0
      ? `${labName} — clean queue this morning ☕`
      : `${labName} — ${totalCount} item${totalCount === 1 ? "" : "s"} on today's queue`;

  const link = (path: string) => `${APP_URL}${path}`;

  const renderRow = (label: string, items: any[], colorClass: string) => {
    if (items.length === 0) {
      return `
      <div style="margin: 18px 0;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin:0 0 8px;">${label}</p>
        <p style="font-size:13px;color:#94a3b8;margin:0;">— Nothing.</p>
      </div>`;
    }
    return `
      <div style="margin: 18px 0;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin:0 0 8px;">${label} <span style="background:${colorClass};color:white;border-radius:999px;padding:1px 8px;font-size:10px;margin-left:6px;">${items.length}</span></p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${items
            .map((it: any) => {
              const fuzeNum =
                it.submission?.fabric?.fuzeNumber ??
                it.submission?.fuzeFabricNumber ??
                null;
              const brandName =
                it.brand?.name || it.submission?.brand?.name || "—";
              const label =
                it.poNumber ||
                (it.testType ? it.testType.replace(/_/g, " ") : "Test run");
              const status = it.status || "";
              const due = it.estimatedCompletionDate
                ? `due ${fmtDate(it.estimatedCompletionDate)}`
                : "";
              return `<tr>
                <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-family:monospace;font-weight:600;color:#0f172a;">${escape(label)}</span>
                  <span style="color:#94a3b8;"> · ${escape(brandName)}</span>
                  ${fuzeNum != null ? `<span style="color:#94a3b8;"> · FUZE-${escape(fuzeNum)}</span>` : ""}
                  ${status ? `<span style="color:#94a3b8;"> · ${escape(status.replace(/_/g, " "))}</span>` : ""}
                  ${due ? `<span style="color:#dc2626;"> · ${escape(due)}</span>` : ""}
                </td>
              </tr>`;
            })
            .join("")}
        </table>
      </div>`;
  };

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:12px 12px 0 0;color:white;">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#cbd5e1;margin:0 0 4px;">FUZE Atlas — Lab Queue</p>
      <h1 style="margin:0;font-size:22px;font-weight:800;">${escape(labName)}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#cbd5e1;">${
        totalCount === 0
          ? "Inbox zero. Have a clean day."
          : `${totalCount} item${totalCount === 1 ? "" : "s"} need attention today.`
      }</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:20px 24px;">
      ${renderRow("Tests to start", queue.testsToStart, "#0ea5e9")}
      ${renderRow("Tests due today", queue.testsDueToday, "#dc2626")}
      ${renderRow("Raw uploads pending review", queue.rawUploadsPending, "#f59e0b")}
      <div style="margin-top:24px;text-align:center;">
        <a href="${link("/lab-portal/queue")}" style="display:inline-block;padding:10px 22px;background:#00b4c3;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
          Open lab queue →
        </a>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center;">
        This digest fires once per day at 07:00 in your lab's local timezone.
        Adjust under Lab Profile → timezone if it lands at the wrong hour.
      </p>
    </div>
  </div>`;

  const text = [
    `FUZE Atlas — ${labName} — lab queue digest`,
    "",
    `Tests to start (${queue.testsToStart.length}):`,
    ...queue.testsToStart.map(
      (it: any) =>
        `  - ${it.poNumber || "TR-" + it.id.slice(0, 8)} (${it.brand?.name || "—"})`,
    ),
    "",
    `Tests due today (${queue.testsDueToday.length}):`,
    ...queue.testsDueToday.map(
      (it: any) =>
        `  - ${it.poNumber || "TR-" + it.id.slice(0, 8)} (${it.brand?.name || "—"}) — due ${fmtDate(it.estimatedCompletionDate)}`,
    ),
    "",
    `Raw uploads pending review (${queue.rawUploadsPending.length}):`,
    ...queue.rawUploadsPending.map(
      (it: any) =>
        `  - ${it.testType.replace(/_/g, " ")} — ${it.submission?.brand?.name || "—"}`,
    ),
    "",
    `Open the full queue: ${link("/lab-portal/queue")}`,
  ].join("\n");

  return { subject, html, text };
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Find every Lab with a configured timezone + at least one active user.
  const labs = await prisma.lab.findMany({
    where: {
      active: true,
      timezone: { not: null },
      users: { some: { status: "ACTIVE", email: { not: null } } },
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      users: {
        where: { status: "ACTIVE", email: { not: null } },
        select: { id: true, email: true, name: true },
      },
    },
  });

  const results: any[] = [];
  for (const lab of labs) {
    const localHour = currentHourInTimezone(lab.timezone!);
    if (localHour !== TARGET_LOCAL_HOUR) {
      results.push({ labId: lab.id, labName: lab.name, skipped: "not-7am", localHour });
      continue;
    }
    if (await alreadyDigested(lab.id)) {
      results.push({ labId: lab.id, labName: lab.name, skipped: "already-sent" });
      continue;
    }

    let queue: QueuePayload;
    try {
      queue = await gatherQueue(lab.id);
    } catch (e: any) {
      results.push({ labId: lab.id, labName: lab.name, error: e?.message || String(e) });
      continue;
    }

    const { subject, html, text } = composeEmail(lab.name, queue);
    let emailedCount = 0;
    const emailErrors: any[] = [];
    for (const u of lab.users) {
      try {
        const r = await sendEmail({
          to: u.email,
          subject,
          html,
          text,
          replyTo: "andrew@fuze47.com",
        });
        if (r?.ok) emailedCount++;
        else emailErrors.push({ userId: u.id, error: r?.error });
      } catch (e: any) {
        emailErrors.push({ userId: u.id, error: e?.message || String(e) });
      }
    }

    // Stamp a single Notification row scoped to the lab for the 22h
    // dedupe check above. Attribute to the first ACTIVE lab user.
    try {
      await prisma.notification.create({
        data: {
          userId: lab.users[0].id,
          type: "SYSTEM",
          title: `Lab queue digest sent — ${lab.name}`,
          message: `Daily 07:00 digest fired. ${emailedCount} recipient${emailedCount === 1 ? "" : "s"} · ${queue.testsToStart.length} start · ${queue.testsDueToday.length} due · ${queue.rawUploadsPending.length} raw.`,
          link: "/lab-portal/queue",
          metadata: {
            kind: "lab-queue-digest",
            scopeId: lab.id,
            labId: lab.id,
            counts: {
              start: queue.testsToStart.length,
              due: queue.testsDueToday.length,
              raw: queue.rawUploadsPending.length,
            },
          },
        },
      });
    } catch (e) {
      console.warn("[lab-queue-digest] dedupe notification write failed:", e);
    }

    results.push({
      labId: lab.id,
      labName: lab.name,
      sent: emailedCount,
      counts: {
        testsToStart: queue.testsToStart.length,
        testsDueToday: queue.testsDueToday.length,
        rawUploadsPending: queue.rawUploadsPending.length,
      },
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    labsConsidered: labs.length,
    targetLocalHour: TARGET_LOCAL_HOUR,
    results,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
