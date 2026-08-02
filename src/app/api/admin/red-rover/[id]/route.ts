// @ts-nocheck
/**
 * GET    /api/admin/red-rover/[id] — full dossier (target + contacts +
 *   activities reverse-chron + owner roster).
 * PATCH  /api/admin/red-rover/[id] — update header + questionnaire fields.
 *   A stage change auto-logs a STATUS_CHANGE activity and bumps
 *   lastActivityAt (accountability trail).
 * DELETE /api/admin/red-rover/[id] — delete target (cascades contacts +
 *   activities).
 *
 * Next.js 15: params is a Promise — awaited. Admin-gated on getRealUser().
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

const VALID_TIER = new Set(["TIER1", "TIER2", "PARKED"]);
const VALID_STAGE = new Set([
  "IDENTIFIED",
  "CONTACTED",
  "PRESENTATION",
  "TESTING",
  "AGREEMENT",
  "ACTIVE",
  "STALLED",
  "PARKED",
]);

const TEXT_FIELDS = [
  "initialContact",
  "keyMeetings",
  "currentAgreements",
  "currentStatus",
  "nextStep",
  "whoDroveIt",
  "intel",
];

async function gate() {
  const user = await getRealUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (!ADMIN_ROLES.has(user.role))
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  const target = await prisma.redRoverTarget.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { orderBy: { createdAt: "asc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 200 },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, filename: true, contentType: true, sizeBytes: true, url: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!target) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const owners = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, target, owners });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  const existing = await prisma.redRoverTarget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, any> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("rank" in body) data.rank = body.rank == null || body.rank === "" ? null : Math.trunc(Number(body.rank));
  if (body.tier && VALID_TIER.has(body.tier)) data.tier = body.tier;
  if (body.stage && VALID_STAGE.has(body.stage)) data.stage = body.stage;
  if ("companyClass" in body) data.companyClass = body.companyClass?.trim() || null;
  if ("geo" in body) data.geo = body.geo?.trim() || null;
  if ("ownerId" in body) data.ownerId = body.ownerId || null;
  for (const f of TEXT_FIELDS) {
    if (f in body) data[f] = body[f] === "" ? null : (body[f] ?? null);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "No changes" }, { status: 400 });
  }

  const stageChanged = data.stage && data.stage !== existing.stage;
  if (stageChanged) data.lastActivityAt = new Date();

  const updated = await prisma.redRoverTarget.update({ where: { id }, data });

  // Auto-log a STATUS_CHANGE activity so the accountability trail records
  // who moved the target and when.
  if (stageChanged) {
    await prisma.redRoverActivity.create({
      data: {
        targetId: id,
        userId: g.user.id,
        type: "STATUS_CHANGE",
        body: `Stage moved ${existing.stage} → ${data.stage} by ${g.user.name}.`,
      },
    });
  }

  return NextResponse.json({ ok: true, target: updated, stageChanged: !!stageChanged });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  const existing = await prisma.redRoverTarget.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  await prisma.redRoverTarget.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: id });
}
