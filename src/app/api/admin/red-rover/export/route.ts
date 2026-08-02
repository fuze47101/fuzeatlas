// @ts-nocheck
/**
 * GET /api/admin/red-rover/export — CSV of the whole Red Rover book,
 * ordered tier→rank→name. Admin-gated on getRealUser().
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const TIER_ORDER: Record<string, number> = { TIER1: 0, TIER2: 1, PARKED: 2 };
const DAY = 86_400_000;

function csvCell(v: any): string {
  const s = v == null ? "" : String(v);
  // RFC 4180 quoting.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const rows = await prisma.redRoverTarget.findMany({
    include: {
      owner: { select: { name: true } },
      contacts: { select: { name: true, title: true, side: true, role: true, email: true } },
      _count: { select: { activities: true } },
    },
  });

  const sorted = rows.sort((a, b) => {
    const to = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
    if (to !== 0) return to;
    const ra = a.rank ?? 9999;
    const rb = b.rank ?? 9999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const now = Date.now();
  const header = [
    "Rank",
    "Tier",
    "Target",
    "Class",
    "Geo",
    "Stage",
    "Owner",
    "Key Contact (Negotiation)",
    "Technical Gatekeeper",
    "Activities",
    "Last Activity",
    "Days Since Activity",
    "Next Step",
    "Current Status",
    "Current Agreements",
    "Intel",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const t of sorted) {
    const neg = t.contacts.find((c) => c.role === "NEGOTIATION");
    const gk = t.contacts.find((c) => c.role === "TECHNICAL_GATEKEEPER");
    const daysSince =
      t.lastActivityAt != null ? Math.floor((now - new Date(t.lastActivityAt).getTime()) / DAY) : "";
    lines.push(
      [
        t.rank ?? "",
        t.tier,
        t.name,
        t.companyClass ?? "",
        t.geo ?? "",
        t.stage,
        t.owner?.name ?? "",
        neg ? `${neg.name}${neg.title ? ` (${neg.title})` : ""}${neg.email ? ` <${neg.email}>` : ""}` : "",
        gk ? `${gk.name}${gk.title ? ` (${gk.title})` : ""}` : "",
        t._count.activities,
        t.lastActivityAt ? new Date(t.lastActivityAt).toISOString() : "",
        daysSince,
        t.nextStep ?? "",
        t.currentStatus ?? "",
        t.currentAgreements ?? "",
        t.intel ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM for Excel UTF-8
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="red_rover_${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
