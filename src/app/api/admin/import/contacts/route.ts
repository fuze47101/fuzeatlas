// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/import/contacts
 *
 * NEED-2 — bulk contact import. Body:
 *   {
 *     rows:    Array<Record<string, string>>,
 *     mapping: { firstName, lastName, email, brandName?, jobTitle?,
 *                phone?, linkedinUrl?, title? },
 *     dryRun:  boolean,
 *   }
 *
 * Pattern matches /api/admin/import/brands + /factories. Contacts
 * are upserted by email (case-insensitive); rows with no email and
 * no LinkedIn URL are flagged invalid (no natural key).
 *
 * Apollo enrichment for email-less rows is a follow-up — we accept
 * those rows when a LinkedIn URL is present, mark them
 * `emailStatus="missing"`, and stamp `enrichmentSource="csv_import"`
 * so the existing enrichment job can pick them up later.
 */

function pickValue(row: Record<string, any>, columnName: string | undefined | null): string {
  if (!columnName) return "";
  const v = row[columnName];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  if (!mapping.firstName || !mapping.lastName) {
    return NextResponse.json(
      {
        ok: false,
        error: "mapping.firstName and mapping.lastName are both required column names.",
      },
      { status: 400 },
    );
  }

  // Cache resolved brand lookups so we don't re-query the same name
  // for every row from the same brand.
  const brandCache = new Map<string, { id: string; name: string } | null>();
  async function resolveBrand(name: string) {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (brandCache.has(key)) return brandCache.get(key) || null;
    const b = await prisma.brand.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    brandCache.set(key, b || null);
    return b;
  }

  const results: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = pickValue(row, mapping.firstName);
    const lastName = pickValue(row, mapping.lastName);
    const email = pickValue(row, mapping.email).toLowerCase();
    const brandName = pickValue(row, mapping.brandName);
    const jobTitle = pickValue(row, mapping.jobTitle);
    const phone = pickValue(row, mapping.phone);
    const linkedinUrl = pickValue(row, mapping.linkedinUrl);
    const titleField = pickValue(row, mapping.title);

    if (!firstName && !lastName) {
      results.push({
        index: i,
        row,
        ok: false,
        error: "Missing required field (firstName / lastName).",
      });
      continue;
    }
    if (!email && !linkedinUrl) {
      results.push({
        index: i,
        row,
        ok: false,
        error: "Need either email or LinkedIn URL — no natural key without one.",
      });
      continue;
    }
    if (email && !emailLooksValid(email)) {
      results.push({
        index: i,
        row,
        ok: false,
        error: `Invalid email "${email}".`,
      });
      continue;
    }

    const brand = brandName ? await resolveBrand(brandName) : null;
    const brandMissing = !!(brandName && !brand);

    if (dryRun) {
      const existing = email
        ? await prisma.contact.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          })
        : null;
      results.push({
        index: i,
        row,
        ok: true,
        outcome: existing ? "exists" : "new",
        contactId: existing?.id || null,
        brandLink: brand?.name || null,
        brandMissing,
        warnings: brandMissing ? [`Brand "${brandName}" not found — contact will be unlinked.`] : [],
      });
    } else {
      try {
        const data: any = {
          firstName: firstName || null,
          lastName: lastName || null,
          name: [firstName, lastName].filter(Boolean).join(" ") || null,
          title: titleField || null,
          email: email || null,
          phone: phone || null,
          jobTitle: jobTitle || null,
          linkedinUrl: linkedinUrl || null,
          brandId: brand?.id || null,
          enrichmentSource: "csv_import",
          emailStatus: email
            ? null
            : linkedinUrl
              ? "missing"
              : null,
        };
        // Upsert by email when present (case-insensitive lookup, then
        // create-or-update). When there's no email we always insert —
        // LinkedIn-only contacts can dedupe later via enrichment.
        let contact: any;
        if (email) {
          const existing = await prisma.contact.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          });
          contact = existing
            ? await prisma.contact.update({ where: { id: existing.id }, data })
            : await prisma.contact.create({ data });
        } else {
          contact = await prisma.contact.create({ data });
        }
        results.push({
          index: i,
          row,
          ok: true,
          outcome: contact ? (email ? "upserted" : "created") : "noop",
          contactId: contact.id,
          brandLink: brand?.name || null,
          brandMissing,
        });
      } catch (e: any) {
        results.push({ index: i, row, ok: false, error: e?.message || "Unexpected error" });
      }
    }
  }

  const counts = {
    total: results.length,
    valid: results.filter((r) => r.ok).length,
    invalid: results.filter((r) => !r.ok).length,
    new: results.filter((r) => r.outcome === "new" || r.outcome === "created").length,
    exists: results.filter((r) => r.outcome === "exists" || r.outcome === "upserted").length,
    brandMissing: results.filter((r) => r.brandMissing).length,
  };

  return NextResponse.json({ ok: true, dryRun, counts, results });
}
