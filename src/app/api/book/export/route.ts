import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MANAGER_ROLES,
  canReadBook,
  getBook,
  visibleBookOwners,
  type BookAccount,
} from "@/lib/book";

/**
 * GET /api/book/export            → my book as CSV
 * GET /api/book/export?userId=X   → X's book (managers / distributor lead)
 * GET /api/book/export?all=1      → every book I may see, one row per account per owner
 *
 * UTF-8 with BOM so Excel opens Chinese notes correctly.
 */
function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

const HEAD = [
  "Book owner",
  "Account",
  "Type",
  "Role",
  "Team",
  "Country",
  "Stage",
  "Forecast quarter",
  "Primary contact",
  "Last touch",
  "Silent weeks",
  "Touched this week",
  "Last note",
  "Next step",
  "Next step date",
  "Open help",
  "Gala lead",
];

function rows(owner: string, book: BookAccount[]): string[] {
  return book.map((a) =>
    [
      owner,
      a.name,
      a.entityType === "FACTORY" ? "Mill" : a.entityType === "BRAND" ? "Brand" : "Distributor",
      a.isPrimary ? "Owner" : "Support",
      a.team.map((t) => (t.isPrimary ? t.name : `${t.name} (support)`)).join("; "),
      a.country,
      a.stage ? a.stage.replace(/_/g, " ") : "",
      a.forecastQuarter,
      a.primaryContact,
      day(a.lastRealTouchAt),
      a.silentWeeks >= 99 ? "" : a.silentWeeks,
      a.checkedInThisWeek ? "Yes" : "No",
      a.lastNote,
      a.nextStep,
      day(a.nextStepAt),
      a.openHelp || "",
      a.galaLead ? "Yes" : "",
    ]
      .map(cell)
      .join(","),
  );
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const lines: string[] = [HEAD.map(cell).join(",")];
  let label = "My_Book";

  if (url.searchParams.get("all")) {
    const owners = await visibleBookOwners(user);
    if (!MANAGER_ROLES.includes(user.role) && owners.length <= 1)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    for (const o of owners) {
      const book = await getBook(o.id);
      lines.push(...rows(o.name, book));
    }
    label = "All_Books";
  } else {
    const targetId = url.searchParams.get("userId") || user.id;
    if (!(await canReadBook(user, targetId)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const owner = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true } });
    const book = await getBook(targetId, new Date(), { includeSupport: true });
    lines.push(...rows(owner?.name || "", book));
    label = `Book_${(owner?.name || "me").replace(/[^A-Za-z0-9]+/g, "_")}`;
  }

  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="FUZE_${label}_${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
