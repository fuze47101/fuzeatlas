// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const query = q.toLowerCase();

    // Run all searches in parallel
    const [brands, factories, fabrics, labs, contacts, testRuns] =
      await Promise.all([
        // BRANDS
        prisma.brand.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { website: { contains: query, mode: "insensitive" } },
              { projectDescription: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            pipelineStage: true,
            website: true,
          },
          take: 8,
        }),

        // FACTORIES
        prisma.factory.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { chineseName: { contains: query, mode: "insensitive" } },
              { country: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
              { specialty: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
            specialty: true,
          },
          take: 8,
        }),

        // FABRICS
        prisma.fabric.findMany({
          where: {
            OR: [
              { customerCode: { contains: query, mode: "insensitive" } },
              { factoryCode: { contains: query, mode: "insensitive" } },
              { construction: { contains: query, mode: "insensitive" } },
              { color: { contains: query, mode: "insensitive" } },
              { yarnType: { contains: query, mode: "insensitive" } },
              // Also search numeric fuzeNumber if query is a number
              ...(isNaN(Number(query))
                ? []
                : [{ fuzeNumber: { equals: parseInt(query) } }]),
            ],
          },
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            construction: true,
            brand: { select: { name: true } },
          },
          take: 8,
        }),

        // LABS
        prisma.lab.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { country: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
              { accreditations: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
          },
          take: 5,
        }),

        // CONTACTS
        prisma.contact.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
          },
          take: 5,
        }),

        // TEST RUNS
        prisma.testRun.findMany({
          where: {
            OR: [
              { testReportNumber: { contains: query, mode: "insensitive" } },
              { fuzeInternalReportNumber: { contains: query, mode: "insensitive" } },
              { testMethodStd: { contains: query, mode: "insensitive" } },
              { lab: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            testReportNumber: true,
            testMethodStd: true,
            testType: true,
            lab: { select: { name: true } },
          },
          take: 5,
        }),
      ]);

    const results = [];

    // Format brands
    for (const b of brands) {
      results.push({
        type: "brand",
        id: b.id,
        title: b.name,
        subtitle: b.pipelineStage?.replace(/_/g, " ") || "",
        url: `/brands/${b.id}`,
      });
    }

    // Format factories
    for (const f of factories) {
      results.push({
        type: "factory",
        id: f.id,
        title: f.name,
        subtitle: [f.city, f.country].filter(Boolean).join(", ") || f.specialty || "",
        url: `/factories/${f.id}`,
      });
    }

    // Format fabrics
    for (const f of fabrics) {
      const label =
        f.customerCode || (f.fuzeNumber ? `FUZE-${f.fuzeNumber}` : f.factoryCode || f.id);
      results.push({
        type: "fabric",
        id: f.id,
        title: label,
        subtitle: [f.construction, f.brand?.name].filter(Boolean).join(" · "),
        url: `/fabrics/${f.id}`,
      });
    }

    // Format labs
    for (const l of labs) {
      results.push({
        type: "lab",
        id: l.id,
        title: l.name,
        subtitle: [l.city, l.country].filter(Boolean).join(", "),
        url: `/labs`,
      });
    }

    // Format contacts
    for (const c of contacts) {
      const displayName = c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
      const parent = c.brand?.name || c.factory?.name || "";
      const parentUrl = c.brand ? `/brands/${c.brand.id}` : c.factory ? `/factories/${c.factory.id}` : null;
      results.push({
        type: "contact",
        id: c.id,
        title: displayName,
        subtitle: [c.email, parent].filter(Boolean).join(" · "),
        url: parentUrl || `/brands`,
      });
    }

    // Format test runs
    for (const t of testRuns) {
      results.push({
        type: "test",
        id: t.id,
        title: t.testReportNumber || t.testType || "Test",
        subtitle: [t.testMethodStd, t.lab?.name].filter(Boolean).join(" · "),
        url: `/tests/${t.id}`,
      });
    }

    return NextResponse.json({ results, query: q });
  } catch (err: any) {
    console.error("Search error:", err);
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}
