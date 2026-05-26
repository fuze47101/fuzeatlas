// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LOCALES } from "@/i18n/core";
import { diffLocale } from "@/lib/i18n-diff";

/**
 * GET /api/admin/i18n/review
 * PATCH /api/admin/i18n/review { locale, reviewerEmail?, notes?, markReviewed?, markTranslated? }
 *
 * T13 phase 16 — native-speaker review routing.
 *
 * GET returns one row per supported locale (creating a placeholder
 * row on the fly for any locale that doesn't have one yet). Each
 * row carries reviewer + reviewer email + last-reviewed-at +
 * last-translated-at + notes.
 *
 * PATCH upserts a row by locale. markReviewed=true stamps
 * lastReviewedAt = now and resolves reviewerId if reviewerEmail
 * matches a Contact or User. markTranslated=true stamps
 * lastTranslatedAt = now (called from i18n translation cron later).
 *
 * Scoped to ADMIN | EMPLOYEE.
 */

async function gate() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized", code: 401 };
  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
    return { error: "Forbidden", code: 403 };
  }
  return { user };
}

export async function GET() {
  const guard = await gate();
  if ("error" in guard) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code });
  }

  const rows = await prisma.localeReviewStatus.findMany();
  const byLocale = new Map(rows.map((r) => [r.locale, r]));

  // Phase 19 — also report live coverage per locale via diffLocale.
  // English is 100% by definition; skip the API call for it.
  const result = await Promise.all(
    LOCALES.map(async (l) => {
      const row = byLocale.get(l.code);
      let coverage = 1;
      let missingKeys = 0;
      let emptyKeys = 0;
      if (l.code !== "en") {
        try {
          const d = await diffLocale(l.code as any);
          coverage = d.coverage;
          missingKeys = d.missingKeys.length;
          emptyKeys = d.emptyKeys.length;
        } catch {
          // Tolerate diff errors — render with unknown coverage.
        }
      }
      return {
        locale: l.code,
        label: l.label,
        flag: l.flag,
        reviewerId: row?.reviewerId || null,
        reviewerEmail: row?.reviewerEmail || null,
        reviewerName: row?.reviewerName || null,
        lastTranslatedAt: row?.lastTranslatedAt || null,
        lastReviewedAt: row?.lastReviewedAt || null,
        notes: row?.notes || null,
        coverage,
        missingKeys,
        emptyKeys,
      };
    }),
  );

  return NextResponse.json({ ok: true, locales: result });
}

export async function PATCH(req: Request) {
  const guard = await gate();
  if ("error" in guard) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code });
  }

  const body = await req.json().catch(() => ({} as any));
  const locale = String(body?.locale || "").trim();
  if (!locale) {
    return NextResponse.json({ ok: false, error: "locale required" }, { status: 400 });
  }
  if (!LOCALES.some((l) => l.code === locale)) {
    return NextResponse.json({ ok: false, error: "Unknown locale" }, { status: 400 });
  }

  const data: any = {};
  if (body.reviewerEmail !== undefined) {
    const email = String(body.reviewerEmail || "").trim().toLowerCase();
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true },
      });
      if (user) {
        data.reviewerId = user.id;
        data.reviewerEmail = user.email;
        data.reviewerName = user.name;
      } else {
        const contact = await prisma.contact.findFirst({
          where: { email },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
        if (contact) {
          data.reviewerId = null;
          data.reviewerEmail = contact.email;
          data.reviewerName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || email;
        } else {
          data.reviewerId = null;
          data.reviewerEmail = email;
          data.reviewerName = null;
        }
      }
    } else {
      data.reviewerId = null;
      data.reviewerEmail = null;
      data.reviewerName = null;
    }
  }
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.markReviewed === true) data.lastReviewedAt = new Date();
  if (body.markTranslated === true) data.lastTranslatedAt = new Date();

  const row = await prisma.localeReviewStatus.upsert({
    where: { locale },
    create: { locale, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, row });
}
