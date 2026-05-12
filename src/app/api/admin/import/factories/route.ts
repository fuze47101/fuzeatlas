// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { seedFactory, SeedFactoryError } from "@/lib/seed-factory";

/**
 * POST /api/admin/import/factories
 *
 * NEED-2 — bulk factory import. Body shape mirrors the brands import:
 *   {
 *     rows:    Array<Record<string, string>>,
 *     mapping: { name, country, distributor?, brands?, city?, website? },
 *     dryRun:  boolean,
 *   }
 *
 * `brands` column is parsed as a comma-separated list per row.
 */

function pickValue(row: Record<string, any>, columnName: string | undefined | null): string {
  if (!columnName) return "";
  const v = row[columnName];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
  const mapping = body.mapping || {};
  const dryRun = body.dryRun !== false;

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Cap is 500 rows per import. Split the file." },
      { status: 400 },
    );
  }
  if (!mapping.name || !mapping.country) {
    return NextResponse.json(
      {
        ok: false,
        error: "mapping.name and mapping.country are both required column names.",
      },
      { status: 400 },
    );
  }

  const results: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = pickValue(row, mapping.name);
    const country = pickValue(row, mapping.country);
    const distributor = pickValue(row, mapping.distributor) || null;
    const brandsCsv = pickValue(row, mapping.brands);
    const city = pickValue(row, mapping.city) || null;
    const website = pickValue(row, mapping.website) || null;
    const brands = brandsCsv
      ? brandsCsv.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (!name || !country) {
      results.push({
        index: i,
        row,
        ok: false,
        error: "Missing required field (name / country).",
      });
      continue;
    }

    if (dryRun) {
      const existing = await prisma.factory.findUnique({
        where: { name },
        select: { id: true },
      });
      // Pre-flight resolve brand + distributor names so the preview
      // tells the admin which brands won't link.
      const brandsResolved = await prisma.brand.findMany({
        where: {
          OR: brands.map((b) => ({
            name: { equals: b, mode: "insensitive" },
          })),
        },
        select: { name: true },
      });
      const resolvedNames = new Set(brandsResolved.map((b) => b.name.toLowerCase()));
      const brandsMissing = brands.filter((b) => !resolvedNames.has(b.toLowerCase()));
      let distResolved: string | null = null;
      if (distributor) {
        const d = await prisma.distributor.findFirst({
          where: { name: { equals: distributor, mode: "insensitive" } },
          select: { name: true },
        });
        distResolved = d?.name || null;
      }
      results.push({
        index: i,
        row,
        ok: true,
        outcome: existing ? "exists" : "new",
        factoryId: existing?.id || null,
        factoryName: name,
        brandsWouldLink: brands.length - brandsMissing.length,
        brandsMissing,
        distributorWouldLink: distResolved,
        distributorSkipped: distributor && !distResolved ? distributor : null,
      });
    } else {
      try {
        const r = await seedFactory(prisma, {
          name,
          country,
          distributor,
          brands,
          city,
          website,
        });
        results.push({
          index: i,
          row,
          ok: true,
          outcome: r.outcome,
          factoryId: r.factoryId,
          factoryName: r.factoryName,
          filledFields: r.filledFields,
          distributorLinked: r.distributorLinked,
          distributorSkipped: r.distributorSkipped,
          brandsLinked: r.brandsLinked,
          brandsMissing: r.brandsMissing,
        });
      } catch (e: any) {
        const msg =
          e instanceof SeedFactoryError ? e.message : e?.message || "Unexpected error";
        results.push({ index: i, row, ok: false, error: msg });
      }
    }
  }

  const counts = {
    total: results.length,
    valid: results.filter((r) => r.ok).length,
    invalid: results.filter((r) => !r.ok).length,
    created: results.filter((r) => r.outcome === "created").length,
    filled: results.filter((r) => r.outcome === "filled").length,
    noop: results.filter((r) => r.outcome === "noop").length,
    exists: results.filter((r) => r.outcome === "exists").length,
    new: results.filter((r) => r.outcome === "new").length,
  };

  return NextResponse.json({ ok: true, dryRun, counts, results });
}
