// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;

    const users = await prisma.user.findMany({
      where: { brandId: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        brandId: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
