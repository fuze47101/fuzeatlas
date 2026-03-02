// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/labs ── list labs with optional filters ────────── */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const country = url.searchParams.get("country");
    const capability = url.searchParams.get("capability"); // "icp", "ab", "fungal", "odor", "uv"
    const search = url.searchParams.get("search");

    const where: any = { active: true };

    if (country) {
      where.country = { equals: country, mode: "insensitive" };
    }

    if (capability) {
      const capMap: Record<string, string> = {
        icp: "icpApproved",
        ab: "abApproved",
        fungal: "fungalApproved",
        odor: "odorApproved",
        uv: "uvApproved",
      };
      const field = capMap[capability.toLowerCase()];
      if (field) where[field] = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    const labs = await prisma.lab.findMany({
      where,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
        region: true,
        website: true,
        email: true,
        phone: true,
        accreditations: true,
        icpApproved: true,
        abApproved: true,
        fungalApproved: true,
        odorApproved: true,
        uvApproved: true,
        notes: true,
        _count: { select: { testRuns: true } },
      },
      orderBy: [{ country: "asc" }, { name: "asc" }],
    });

    // Build country distribution for filter dropdown
    const allLabs = await prisma.lab.findMany({
      where: { active: true },
      select: { country: true },
    });
    const countries: Record<string, number> = {};
    allLabs.forEach((l) => {
      const c = l.country || "Unknown";
      countries[c] = (countries[c] || 0) + 1;
    });

    return NextResponse.json({
      ok: true,
      labs,
      countries: Object.entries(countries)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      total: labs.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── POST /api/labs ── create a new lab ────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name, address, city, state, country, region,
      website, email, phone, accreditations,
      icpApproved, abApproved, fungalApproved, odorApproved, uvApproved,
      notes,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: "Lab name is required" }, { status: 400 });
    }

    const lab = await prisma.lab.create({
      data: {
        name: name.trim(),
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        region: region || null,
        website: website || null,
        email: email || null,
        phone: phone || null,
        accreditations: accreditations || null,
        icpApproved: Boolean(icpApproved),
        abApproved: Boolean(abApproved),
        fungalApproved: Boolean(fungalApproved),
        odorApproved: Boolean(odorApproved),
        uvApproved: Boolean(uvApproved),
        notes: notes || null,
      },
    });

    return NextResponse.json({ ok: true, lab });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A lab with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
