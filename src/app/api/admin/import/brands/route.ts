// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { seedBrand, SeedBrandError } from "@/lib/seed-brand";

/**
 * POST /api/admin/import/brands
 *
 * NEED-2 — bulk brand import. Body:
 *   {
 *     rows:    Array<Record<string, string>>,   // raw rows from CSV/paste
 *     mapping: { name, domain, repEmail, tier?, cadenceBatches?, country?, website? },
 *     dryRun:  boolean,                          // true = preview only
 *   }
 *
 * `mapping` values are column names in `rows`. We pluck them out per
 * row, validate, and (if !dryRun) call seedBrand() — the same
 * idempotent helper the CLI + smoke endpoint use.
 *
 * Response:
 *   {
 *     ok: true,
 *     dryRun,
 *     total,
 *     results: [
 *       { row, ok, outcome?, error?, brandId?, brandName? }
 *     ]
 *   }
 */

const ALLOWED_TIERS = new Set(["F1", "F2", "F3", "F4"]);

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
  const dryRun = body.dryRun !== false; // default to dry-run for safety

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Cap is 500 rows per import. Split the file." },
      { status: 400 },
    );
  }
  if (!mapping.name || !mapping.domain || !mapping.repEmail) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "mapping.name, mapping.domain, and mapping.repEmail are all required column names.",
      },
      { status: 400 },
    );
  }

  const results: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = pickValue(row, mapping.name);
    const domain = pickValue(row, mapping.domain);
    const repEmail = pickValue(row, mapping.repEmail);
    const tier = (pickValue(row, mapping.tier) || "F2").toUpperCase();
    const cadenceRaw = pickValue(row, mapping.cadenceBatches);
    const country = pickValue(row, mapping.country) || null;
    const website = pickValue(row, mapping.website) || null;

    if (!name || !domain || !repEmail) {
      results.push({
        index: i,
        row,
        ok: false,
        error: "Missing required field (name / domain / repEmail).",
      });
      continue;
    }
    if (!ALLOWED_TIERS.has(tier)) {
      results.push({
        index: i,
        row,
        ok: false,
        error: `Invalid tier "${tier}" — must be F1|F2|F3|F4`,
      });
      continue;
    }
    let cadence: number | undefined = undefined;
    if (cadenceRaw) {
      const n = parseInt(cadenceRaw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        results.push({
          index: i,
          row,
          ok: false,
          error: `Invalid cadenceBatches "${cadenceRaw}" — must be positive integer`,
        });
        continue;
      }
      cadence = n;
    }

    if (dryRun) {
      // Validate the rep exists before claiming the row is ready.
      const rep = await prisma.user.findUnique({
        where: { email: repEmail.toLowerCase() },
        select: { id: true },
      });
      if (!rep) {
        results.push({
          index: i,
          row,
          ok: false,
          error: `Primary rep ${repEmail} not found. Add the user first.`,
        });
        continue;
      }
      const existing = await prisma.brand.findUnique({
        where: { name },
        select: { id: true },
      });
      results.push({
        index: i,
        row,
        ok: true,
        outcome: existing ? "exists" : "new",
        brandId: existing?.id || null,
        brandName: name,
      });
    } else {
      try {
        const r = await seedBrand(prisma, {
          name,
          domain,
          repEmail,
          tier: tier as any,
          cadenceBatches: cadence,
          country,
          website,
        });
        results.push({
          index: i,
          row,
          ok: true,
          outcome: r.outcome,
          brandId: r.brandId,
          brandName: r.brandName,
          filledFields: r.filledFields,
        });
      } catch (e: any) {
        const msg =
          e instanceof SeedBrandError
            ? e.message
            : e?.message || "Unexpected error";
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
