import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // lightweight DB ping
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "fuzeatlas",
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "db_error", ts: new Date().toISOString() },
      { status: 500 }
    );
  }
}
