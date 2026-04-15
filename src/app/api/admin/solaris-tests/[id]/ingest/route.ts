// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Sensor ingest endpoint — the Raspberry Pi in the Solaris bench posts
 * time-series data here. Protected by a simple bearer-token header so the
 * Pi doesn't need full user auth.
 *
 * POST /api/admin/solaris-tests/[id]/ingest
 * Header: Authorization: Bearer <SOLARIS_INGEST_TOKEN>
 * Body:   {
 *   run: "baseline" | "treated",
 *   series: [{ t_sec, plateA, plateB, air, humidity? }, ...],
 *   startedAt?: ISO, completedAt?: ISO,
 * }
 */

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token || token !== process.env.SOLARIS_INGEST_TOKEN) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    if (!["baseline", "treated"].includes(body.run)) {
      return NextResponse.json({ ok: false, error: "run must be 'baseline' or 'treated'" }, { status: 400 });
    }
    const data: any = {};
    const prefix = body.run as "baseline" | "treated";
    if (body.series) data[`${prefix}Series`] = body.series;
    if (body.startedAt) data[`${prefix}StartedAt`] = new Date(body.startedAt);
    if (body.completedAt) data[`${prefix}CompletedAt`] = new Date(body.completedAt);

    const test = await prisma.solarisTest.update({ where: { id }, data });
    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    console.error("Solaris ingest error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
