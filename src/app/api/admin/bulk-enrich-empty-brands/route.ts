// @ts-nocheck
/**
 * POST /api/admin/bulk-enrich-empty-brands
 *
 * The HTTP version of scripts/bulk-enrich-empty-brands.ts. Built so
 * any admin (Andrew, Ryan, Tina) can trigger bulk Apollo enrichment
 * from the browser — anywhere, on any laptop, no shell required, no
 * APOLLO_API_KEY in their local env.
 *
 * Body:
 *   { limit?: number = 50, dryRun?: boolean = false }
 *
 * Bounded per-call so it fits under Vercel's 300s function ceiling
 * (each brand takes ~1-2s of Apollo API time + DB writes; 50 = ~60s
 * conservative, 100 = ~120s). The UI calls this in a loop or the
 * user can click again to chew through the next batch.
 *
 * Returns:
 *   {
 *     ok: true,
 *     processed: 50,
 *     contactsCreated: 312,
 *     brandsEnriched: 47,
 *     brandsApolloEmpty: 2,    // domain returned no senior people
 *     brandsSkippedNoDomain: 1, // unparseable website
 *     brandsRemainingNoContacts: 1033, // total still empty after this batch
 *   }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  extractDomain,
  searchApolloByDomain,
  apolloPersonToContactData,
} from "@/lib/apollo-people-search";

// Max wall-time we're comfortable with on Pro plan. Each brand is
// ~1-2s of Apollo work + ~100ms of DB writes. 60 leaves headroom for
// AI rate-limit pauses and DB hiccups.
const HARD_TIMEOUT_MS = 60_000;
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Admin / employee / sales manager only" },
        { status: 403 },
      );
    }

    if (!process.env.APOLLO_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "APOLLO_API_KEY not set in the runtime environment. Set it in Vercel Settings → Environment Variables.",
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body.limit || "50", 10), 1), 200);
    const dryRun = Boolean(body.dryRun);

    const candidates = await prisma.brand.findMany({
      where: {
        pipelineStage: "LEAD",
        validationStatus: { notIn: ["dead", "duplicate", "irrelevant"] },
        contacts: { none: {} },
        website: { not: null },
      },
      select: { id: true, name: true, website: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const startedAt = Date.now();
    const stats = {
      processed: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      brandsEnriched: 0,
      brandsApolloEmpty: 0,
      brandsSkippedNoDomain: 0,
      timedOut: false,
    };
    const perBrand: any[] = [];

    for (const b of candidates) {
      // Bail early if we're approaching the function timeout — better
      // to return what we've done so the UI shows progress than hard-
      // crash at the platform's 300s ceiling. Caller can click again
      // for the next batch.
      if (Date.now() - startedAt > HARD_TIMEOUT_MS) {
        stats.timedOut = true;
        break;
      }
      stats.processed++;

      const domain = extractDomain(b.website);
      if (!domain) {
        stats.brandsSkippedNoDomain++;
        perBrand.push({ id: b.id, name: b.name, status: "no_domain" });
        continue;
      }

      const people = await searchApolloByDomain(domain);
      if (people.length === 0) {
        stats.brandsApolloEmpty++;
        perBrand.push({ id: b.id, name: b.name, status: "apollo_empty", domain });
        continue;
      }

      let createdThisBrand = 0;
      let updatedThisBrand = 0;
      for (const p of people) {
        if (dryRun) {
          createdThisBrand++;
          continue;
        }
        const apolloId = p.id || null;
        try {
          const existing = apolloId
            ? await prisma.contact.findFirst({
                where: { brandId: b.id, apolloId },
                select: { id: true },
              })
            : null;
          const data = {
            brandId: b.id,
            ...apolloPersonToContactData(p, "apollo_bulk"),
          };
          if (existing) {
            await prisma.contact.update({ where: { id: existing.id }, data });
            updatedThisBrand++;
          } else {
            await prisma.contact.create({ data });
            createdThisBrand++;
          }
        } catch (e) {
          // Silently skip individual contact failures (unique constraint,
          // null email + null linkedin, etc) — they don't block the brand.
        }
      }
      stats.brandsEnriched++;
      stats.contactsCreated += createdThisBrand;
      stats.contactsUpdated += updatedThisBrand;
      perBrand.push({
        id: b.id,
        name: b.name,
        status: "enriched",
        contactsCreated: createdThisBrand,
        contactsUpdated: updatedThisBrand,
      });
    }

    // How many empty brands are still left after this batch — drives
    // the UI's "Run again" affordance and lets the user know how
    // close we are to done.
    const brandsRemainingNoContacts = await prisma.brand.count({
      where: {
        pipelineStage: "LEAD",
        validationStatus: { notIn: ["dead", "duplicate", "irrelevant"] },
        contacts: { none: {} },
        website: { not: null },
      },
    });

    return NextResponse.json({
      ok: true,
      ...stats,
      brandsRemainingNoContacts,
      durationMs: Date.now() - startedAt,
      perBrand,
    });
  } catch (e: any) {
    console.error("[bulk-enrich-empty-brands] error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Bulk enrich failed" },
      { status: 500 },
    );
  }
}
