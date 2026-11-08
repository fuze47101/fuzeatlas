import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canReadBook, getBook, visibleBookOwners } from "@/lib/book";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/book            → my book
 * GET /api/book?userId=X   → X's book (managers / distributor lead)
 * GET /api/book?owners=1   → the people whose books I may open
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);

  if (url.searchParams.get("owners")) {
    const owners = await visibleBookOwners(user);
    return NextResponse.json({ owners });
  }

  const targetId = url.searchParams.get("userId") || user.id;
  if (!(await canReadBook(user, targetId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [accounts, help] = await Promise.all([
    getBook(targetId),
    prisma.helpRequest.findMany({
      where: {
        OR: [{ assigneeId: targetId }, { requesterId: targetId }],
        status: { in: ["OPEN", "ACKED", "ESCALATED"] },
      },
      orderBy: { dueAt: "asc" },
      include: {
        requester: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
  ]);
  return NextResponse.json({ userId: targetId, accounts, help });
}
