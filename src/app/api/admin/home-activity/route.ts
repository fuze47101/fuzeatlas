// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/home-activity
 *
 * Real-time activity feed for /home and /dashboard. Returns the 30
 * most-recent events from the last 7 days across:
 *   - FabricSubmission (factory submitted fabric for treatment)
 *   - FuzeOrder         (factory placed FUZE order)
 *   - TestRequest       (test request submitted)
 *   - User              (account registered)
 *   - SampleTrialRequest (factory requested FUZE sample)
 *   - OutreachMessage   (BD email/LinkedIn sent)
 *   - Meeting           (meeting booked via Calendly/etc.)
 *
 * Each row has: { id, type, actorName, actorRole, action, timestamp,
 * link, entityName }. Built from raw model rows so the UI can render
 * compact action strings ("Tina@Penfabric submitted FUZE-2510").
 *
 * Tina ACCEPTED ticket cmp3e0sip0003lb04fljjb6k4 — she wanted this
 * on her dashboard so she can manage projects + get back to people
 * promptly. RBAC: ADMIN / EMPLOYEE / SALES_MANAGER only.
 */
const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TAKE_PER_TYPE = 30;
const LIMIT = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const events: Array<{
    id: string;
    type: string;
    actorName: string;
    actorRole: string | null;
    action: string;
    timestamp: Date;
    link: string;
    entityName?: string | null;
  }> = [];

  // Per-model isolation: a schema-drift bug in one query no longer
  // erases the entire activity feed. We capture each model's error
  // separately and surface them in the response so the next failure
  // is visible without grepping Vercel logs.
  const modelErrors: Array<{ model: string; message: string; code: string | null; meta: any }> = [];
  async function safeQuery<T>(model: string, fn: () => Promise<T>): Promise<T | []> {
    try {
      return await fn();
    } catch (e: any) {
      console.error(`[home-activity] ${model} query failed:`, e?.message, e?.code, e?.meta);
      modelErrors.push({
        model,
        message: e?.message || String(e),
        code: e?.code || null,
        meta: e?.meta || null,
      });
      return [] as any;
    }
  }

  const [fabricSubs, orders, testRequests, users, sampleTrials, outreach, meetings] =
    await Promise.all([
      safeQuery("fabricSubmission", () =>
        prisma.fabricSubmission.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            createdAt: true,
            fuzeFabricNumber: true,
            fabric: { select: { fuzeNumber: true } },
            brand: { select: { name: true } },
            factory: { select: { name: true } },
          },
        }),
      ),
      safeQuery("fuzeOrder", () =>
        prisma.fuzeOrder.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            createdAt: true,
            orderNumber: true,
            orderType: true,
            volumeLiters: true,
            factory: { select: { name: true } },
            brand: { select: { name: true } },
            orderedBy: { select: { name: true, role: true } },
          },
        }),
      ),
      safeQuery("testRequest", () =>
        prisma.testRequest.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            createdAt: true,
            poNumber: true,
            requestedBy: { select: { name: true, role: true } },
            lab: { select: { name: true } },
            fabric: { select: { fuzeNumber: true } },
          },
        }),
      ),
      safeQuery("user", () =>
        prisma.user.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            createdAt: true,
            name: true,
            email: true,
            role: true,
            brand: { select: { name: true } },
            factory: { select: { name: true } },
            distributor: { select: { name: true } },
          },
        }),
      ),
      safeQuery("sampleTrialRequest", () =>
        prisma.sampleTrialRequest.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            createdAt: true,
            brand: { select: { name: true } },
            factory: { select: { name: true } },
            fabric: { select: { fuzeNumber: true } },
            requestedBy: { select: { name: true, role: true } },
          },
        }),
      ),
      safeQuery("outreachMessage", () =>
        prisma.outreachMessage.findMany({
          where: { sentAt: { gte: since } },
          orderBy: { sentAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            sentAt: true,
            channel: true,
            subject: true,
            sentBy: { select: { name: true, role: true } },
            contact: { select: { name: true, brand: { select: { name: true } } } },
          },
        }),
      ),
      safeQuery("meeting", () =>
        prisma.meeting.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: TAKE_PER_TYPE,
          select: {
            id: true,
            createdAt: true,
            title: true,
            startTime: true,
            bookedByUser: { select: { name: true, role: true } },
            brand: { select: { name: true } },
          },
        }),
      ),
    ]);

  for (const f of fabricSubs) {
    const fz = f.fabric?.fuzeNumber || f.fuzeFabricNumber;
    events.push({
      id: `fs-${f.id}`,
      type: "FABRIC_SUBMISSION",
      actorName: f.factory?.name || "Factory",
      actorRole: "FACTORY",
      action: `submitted ${fz ? `FUZE-${fz}` : "a fabric"}${f.brand?.name ? ` for ${f.brand.name}` : ""}`,
      timestamp: f.createdAt,
      link: `/submissions/${f.id}`,
      entityName: fz ? `FUZE-${fz}` : null,
    });
  }
  for (const o of orders) {
    events.push({
      id: `fo-${o.id}`,
      type: "FUZE_ORDER",
      actorName: o.orderedBy?.name || o.factory?.name || "Someone",
      actorRole: o.orderedBy?.role || "FACTORY",
      action: `placed ${o.orderType?.toLowerCase() || "an"} order ${o.orderNumber}${o.volumeLiters ? ` · ${o.volumeLiters}L` : ""}${o.brand?.name ? ` · ${o.brand.name}` : ""}`,
      timestamp: o.createdAt,
      link: `/admin/orders`,
      entityName: o.orderNumber,
    });
  }
  for (const r of testRequests) {
    events.push({
      id: `tr-${r.id}`,
      type: "TEST_REQUEST",
      actorName: r.requestedBy?.name || "Requester",
      actorRole: r.requestedBy?.role || null,
      action: `requested testing on ${r.fabric?.fuzeNumber ? `FUZE-${r.fabric.fuzeNumber}` : "a fabric"}${r.lab?.name ? ` at ${r.lab.name}` : ""}`,
      timestamp: r.createdAt,
      link: `/test-requests`,
      entityName: r.poNumber,
    });
  }
  for (const u of users) {
    const org = u.brand?.name || u.factory?.name || u.distributor?.name || "";
    events.push({
      id: `u-${u.id}`,
      type: "USER_REGISTERED",
      actorName: u.name || u.email || "New user",
      actorRole: u.role,
      action: `registered${org ? ` (${org})` : ""}`,
      timestamp: u.createdAt,
      link: `/settings/users`,
      entityName: u.email,
    });
  }
  for (const t of sampleTrials) {
    events.push({
      id: `st-${t.id}`,
      type: "SAMPLE_TRIAL",
      actorName: t.requestedBy?.name || t.factory?.name || "Factory",
      actorRole: t.requestedBy?.role || "FACTORY",
      action: `requested FUZE sample${t.fabric?.fuzeNumber ? ` for FUZE-${t.fabric.fuzeNumber}` : ""}${t.brand?.name ? ` (${t.brand.name})` : ""}`,
      timestamp: t.createdAt,
      link: `/factory-portal/sample-trial/${t.id}`,
      entityName: null,
    });
  }
  for (const m of outreach) {
    const label = m.channel === "EMAIL" ? "email" : m.channel === "LINKEDIN" ? "LinkedIn DM" : (m.channel || "message").toLowerCase();
    events.push({
      id: `om-${m.id}`,
      type: "OUTREACH",
      actorName: m.sentBy?.name || "BD rep",
      actorRole: m.sentBy?.role || null,
      action: `sent ${label} to ${m.contact?.name || "a contact"}${m.contact?.brand?.name ? ` (${m.contact.brand.name})` : ""}${m.subject ? ` — “${m.subject.slice(0, 60)}”` : ""}`,
      timestamp: m.sentAt,
      link: `/admin/bd/scoreboard`,
      entityName: null,
    });
  }
  for (const mt of meetings) {
    events.push({
      id: `mt-${mt.id}`,
      type: "MEETING",
      actorName: mt.bookedByUser?.name || "Someone",
      actorRole: mt.bookedByUser?.role || null,
      action: `booked meeting ${mt.title ? `“${mt.title}”` : ""}${mt.brand?.name ? ` with ${mt.brand.name}` : ""}${mt.startTime ? ` (${new Date(mt.startTime).toLocaleDateString()})` : ""}`,
      timestamp: mt.createdAt,
      link: `/meetings`,
      entityName: null,
    });
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return NextResponse.json({
    ok: true,
    events: events.slice(0, LIMIT),
    generatedAt: new Date(),
    // Surface any per-model failures explicitly so a silent prisma
    // drift no longer hides behind an empty feed + 200 OK.
    modelErrors,
    partial: modelErrors.length > 0,
  });
}
