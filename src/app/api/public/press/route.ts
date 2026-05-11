// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.pressKitItem.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      url: true,
      caption: true,
      releaseDate: true,
    },
  });
  return NextResponse.json(
    { ok: true, items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    },
  );
}
