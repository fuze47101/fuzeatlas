// @ts-nocheck
/**
 * GET /api/admin/hubspot-import/audit-duplicates
 *
 * Post-mortem audit. Walks every Brand row that came from the HubSpot
 * CSV import (Brand.hubspotImportedAt IS NOT NULL) and checks whether
 * the same name (case-insensitive) or website domain ALSO exists as a
 * Factory or Distributor row.
 *
 * If yes, that Brand is a duplicate — should have been a hubspotId
 * stamp on the Factory/Distributor instead, but the importer either
 * (a) ran on an older deploy without the cross-table check, or
 * (b) ran before `npx prisma db push` added the hubspotId column to
 *     Factory/Distributor and the stamp failed silently.
 *
 * Andrew uses this to find and merge those duplicates. The companion
 * POST /merge-duplicate endpoint does the actual cleanup:
 *  - moves the duplicate brand's contacts onto the factory/distributor
 *  - stamps hubspotId on the factory/distributor
 *  - deletes the duplicate brand
 *
 * Returns:
 *   { ok, totalImported, duplicates: [{
 *       brandId, brandName, brandWebsite, hubspotId, contactCount,
 *       matches: [{kind, id, name, via}]
 *   }] }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function extractDomain(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.trim();
  if (!cleaned) return null;
  try {
    const url = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return cleaned.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Admin / employee only" },
        { status: 403 },
      );
    }

    // Pull every brand that came from the HubSpot CSV import.
    const importedBrands = await prisma.brand.findMany({
      where: { hubspotImportedAt: { not: null } },
      select: {
        id: true,
        name: true,
        website: true,
        hubspotId: true,
        hubspotImportedAt: true,
        _count: { select: { contacts: true } },
      },
      orderBy: { hubspotImportedAt: "desc" },
    });

    // Pull every Factory + Distributor (small data sets, ~9 distributors,
    // <300 factories) into memory so we can do case-insensitive matching
    // in JS instead of N+1 Prisma queries.
    const [factories, distributors] = await Promise.all([
      prisma.factory.findMany({
        select: { id: true, name: true, website: true, hubspotId: true },
      }),
      prisma.distributor.findMany({
        select: { id: true, name: true, website: true, hubspotId: true },
      }),
    ]);

    const factoryByName = new Map<string, { id: string; name: string; hubspotId: string | null }>();
    const factoryByDomain = new Map<string, { id: string; name: string; hubspotId: string | null }>();
    for (const f of factories) {
      if (f.name) factoryByName.set(f.name.toLowerCase().trim(), f);
      const d = extractDomain(f.website);
      if (d) factoryByDomain.set(d, f);
    }
    const distByName = new Map<string, { id: string; name: string; hubspotId: string | null }>();
    const distByDomain = new Map<string, { id: string; name: string; hubspotId: string | null }>();
    for (const d of distributors) {
      if (d.name) distByName.set(d.name.toLowerCase().trim(), d);
      const dom = extractDomain(d.website);
      if (dom) distByDomain.set(dom, d);
    }

    const duplicates: any[] = [];
    for (const b of importedBrands) {
      const nameKey = b.name.toLowerCase().trim();
      const domainKey = extractDomain(b.website);
      const matches: any[] = [];

      const fByName = factoryByName.get(nameKey);
      if (fByName) {
        matches.push({
          kind: "factory",
          id: fByName.id,
          name: fByName.name,
          via: "name",
          hubspotIdAlreadyStamped: fByName.hubspotId,
        });
      }
      if (domainKey) {
        const fByDomain = factoryByDomain.get(domainKey);
        if (fByDomain && fByDomain.id !== fByName?.id) {
          matches.push({
            kind: "factory",
            id: fByDomain.id,
            name: fByDomain.name,
            via: "domain",
            hubspotIdAlreadyStamped: fByDomain.hubspotId,
          });
        }
      }
      const dByName = distByName.get(nameKey);
      if (dByName) {
        matches.push({
          kind: "distributor",
          id: dByName.id,
          name: dByName.name,
          via: "name",
          hubspotIdAlreadyStamped: dByName.hubspotId,
        });
      }
      if (domainKey) {
        const dByDomain = distByDomain.get(domainKey);
        if (dByDomain && dByDomain.id !== dByName?.id) {
          matches.push({
            kind: "distributor",
            id: dByDomain.id,
            name: dByDomain.name,
            via: "domain",
            hubspotIdAlreadyStamped: dByDomain.hubspotId,
          });
        }
      }

      if (matches.length > 0) {
        duplicates.push({
          brandId: b.id,
          brandName: b.name,
          brandWebsite: b.website,
          hubspotId: b.hubspotId,
          hubspotImportedAt: b.hubspotImportedAt,
          contactCount: b._count.contacts,
          matches,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      totalImported: importedBrands.length,
      duplicateCount: duplicates.length,
      duplicates,
    });
  } catch (e: any) {
    console.error("[hubspot-import.audit-duplicates] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
