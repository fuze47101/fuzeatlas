// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/search?q=...
 *
 * NICE-5 — global ⌘K palette backend. Fans the query across the
 * heaviest entity tables and returns top 5 from each in one round-
 * trip. The palette UI client-side merges + ranks for display.
 *
 * Scope:
 *   - Brand by name / website / hubspotId
 *   - Factory by name / city / country
 *   - Contact by name / email
 *   - Fabric by FUZE number / customer code / factory code
 *   - TestRequest by poNumber
 *   - FuzeOrder by orderNumber
 *
 * Admin + sales-shaped roles only. The query runs in parallel so
 * even a slow shard doesn't block the whole palette.
 */

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
]);

const TAKE = 5;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ ok: true, q, groups: [] });
  }

  // FUZE number — purely numeric search short-circuits to a fabric
  // lookup so "1234" hits the right fabric instantly.
  const fuzeNum = /^[0-9]{1,7}$/.test(q) ? parseInt(q, 10) : null;

  const [brands, factories, contacts, fabrics, testRequests, orders] = await Promise.all([
    prisma.brand
      .findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { website: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, website: true, pipelineStage: true },
        orderBy: [{ updatedAt: "desc" }],
        take: TAKE,
      })
      .catch(() => []),

    prisma.factory
      .findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { country: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, city: true, country: true },
        orderBy: [{ updatedAt: "desc" }],
        take: TAKE,
      })
      .catch(() => []),

    prisma.contact
      .findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          brand: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: TAKE,
      })
      .catch(() => []),

    prisma.fabric
      .findMany({
        where: fuzeNum
          ? { fuzeNumber: fuzeNum }
          : {
              OR: [
                { customerCode: { contains: q, mode: "insensitive" } },
                { factoryCode: { contains: q, mode: "insensitive" } },
                { construction: { contains: q, mode: "insensitive" } },
              ],
            },
        select: {
          id: true,
          fuzeNumber: true,
          customerCode: true,
          factoryCode: true,
          brand: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
        },
        orderBy: [{ fuzeNumber: "desc" }],
        take: TAKE,
      })
      .catch(() => []),

    prisma.testRequest
      .findMany({
        where: {
          poNumber: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          poNumber: true,
          status: true,
          brand: { select: { id: true, name: true } },
          lab: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: TAKE,
      })
      .catch(() => []),

    prisma.fuzeOrder
      .findMany({
        where: {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { quoteNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          volumeLiters: true,
          factory: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: TAKE,
      })
      .catch(() => []),
  ]);

  const groups: any[] = [];

  if (brands.length) {
    groups.push({
      group: "Brands",
      items: brands.map((b: any) => ({
        id: `brand:${b.id}`,
        kind: "brand",
        href: `/brands/${b.id}`,
        title: b.name,
        subtitle: [b.pipelineStage, b.website].filter(Boolean).join(" · "),
      })),
    });
  }
  if (factories.length) {
    groups.push({
      group: "Factories",
      items: factories.map((f: any) => ({
        id: `factory:${f.id}`,
        kind: "factory",
        href: `/factories/${f.id}`,
        title: f.name,
        subtitle: [f.city, f.country].filter(Boolean).join(", "),
      })),
    });
  }
  if (contacts.length) {
    groups.push({
      group: "Contacts",
      items: contacts.map((c: any) => ({
        id: `contact:${c.id}`,
        kind: "contact",
        href: `/contacts/${c.id}`,
        title:
          c.name ||
          [c.firstName, c.lastName].filter(Boolean).join(" ") ||
          c.email ||
          "Unnamed contact",
        subtitle: [c.jobTitle, c.brand?.name, c.email].filter(Boolean).join(" · "),
      })),
    });
  }
  if (fabrics.length) {
    groups.push({
      group: "Fabrics",
      items: fabrics.map((f: any) => ({
        id: `fabric:${f.id}`,
        kind: "fabric",
        href: `/fabrics/${f.id}`,
        title: `FUZE-${f.fuzeNumber ?? "?"}${f.customerCode ? ` · ${f.customerCode}` : ""}`,
        subtitle: [f.brand?.name, f.factory?.name].filter(Boolean).join(" · "),
      })),
    });
  }
  if (testRequests.length) {
    groups.push({
      group: "Test requests",
      items: testRequests.map((r: any) => ({
        id: `testreq:${r.id}`,
        kind: "testRequest",
        href: `/test-requests/${r.id}`,
        title: r.poNumber || r.id.slice(0, 10),
        subtitle: [r.status, r.brand?.name, r.lab?.name].filter(Boolean).join(" · "),
      })),
    });
  }
  if (orders.length) {
    groups.push({
      group: "Orders",
      items: orders.map((o: any) => ({
        id: `order:${o.id}`,
        kind: "order",
        href: `/admin/orders-dashboard`,
        title: o.orderNumber || o.id.slice(0, 10),
        subtitle: [
          o.status,
          o.factory?.name,
          o.volumeLiters ? `${o.volumeLiters} L` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    });
  }

  return NextResponse.json({ ok: true, q, groups });
}
