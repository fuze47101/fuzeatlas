import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INTERNAL_ROLES } from "@/lib/book";

/** GET /api/book/team → people the current user may ask for help / assign to. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const where: any = user.distributorId
    ? {
        status: "ACTIVE",
        OR: [{ distributorId: user.distributorId }, { role: { in: ["ADMIN", "EMPLOYEE"] } }],
      }
    : { status: "ACTIVE", role: { in: INTERNAL_ROLES as any } };
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, distributorId: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ users: users.filter((u) => u.id !== user.id) });
}
