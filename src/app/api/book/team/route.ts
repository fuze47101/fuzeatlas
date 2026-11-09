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
  // Two accounts can share a display name (Andrew has andrew@fuze47.com and
  // andrew@801inc.com). Disambiguate with the mail domain so the Help picker
  // never shows the same name twice.
  const list = users.filter((u) => u.id !== user.id);
  const counts = new Map<string, number>();
  for (const u of list) counts.set(u.name, (counts.get(u.name) || 0) + 1);
  const out = list.map((u) =>
    (counts.get(u.name) || 0) > 1
      ? { ...u, name: `${u.name} (${u.email.split("@")[1] || u.email})` }
      : u,
  );
  return NextResponse.json({ users: out });
}
