// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const distributors = await prisma.distributor.findMany({
      select: { id: true, name: true, country: true, specialty: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ok: true, distributors });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
