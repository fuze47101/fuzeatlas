// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const INTERNAL_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
]);

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden — FUZE internal only" }, { status: 403 });
}

/**
 * GET /api/meeting-notes
 *   ?seriesId / ?brandId / ?factoryId / ?status filters.
 * POST /api/meeting-notes
 *   Body: { title, meetingDate?, seriesId?, brandId?, factoryId?, status?, notesMd? }
 *
 * Both routes require an internal FUZE role.
 */

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const url = new URL(req.url);
  const where: any = {};
  const seriesId = url.searchParams.get("seriesId");
  const brandId = url.searchParams.get("brandId");
  const factoryId = url.searchParams.get("factoryId");
  const status = url.searchParams.get("status");
  if (seriesId) where.seriesId = seriesId;
  if (brandId) where.brandId = brandId;
  if (factoryId) where.factoryId = factoryId;
  if (status) where.status = status;

  const notes = await (prisma as any).meetingNote.findMany({
    where,
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      series: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { entries: true, actionItems: true } },
    },
  });
  return NextResponse.json({ ok: true, notes });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
  }
  const meetingDate = body?.meetingDate ? new Date(body.meetingDate) : new Date();

  // Inherit brand/factory from series when present.
  let inheritedBrand: string | null = body?.brandId || null;
  let inheritedFactory: string | null = body?.factoryId || null;
  if (body?.seriesId) {
    const s = await (prisma as any).meetingSeries.findUnique({
      where: { id: body.seriesId },
      select: { brandId: true, factoryId: true, templateMd: true },
    });
    if (s) {
      inheritedBrand = inheritedBrand || s.brandId;
      inheritedFactory = inheritedFactory || s.factoryId;
      if (!body?.notesMd && s.templateMd) body.notesMd = s.templateMd;
    }
  }

  const note = await (prisma as any).meetingNote.create({
    data: {
      title: String(body.title),
      meetingDate,
      seriesId: body?.seriesId || null,
      brandId: inheritedBrand,
      factoryId: inheritedFactory,
      status: body?.status || "DRAFT",
      notesMd: body?.notesMd || "",
      createdById: user.id,
    },
    select: {
      id: true,
      title: true,
      meetingDate: true,
      status: true,
      seriesId: true,
      brandId: true,
      factoryId: true,
    },
  });

  return NextResponse.json({ ok: true, meetingNote: note });
}
