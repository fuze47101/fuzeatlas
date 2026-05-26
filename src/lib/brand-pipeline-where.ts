// @ts-nocheck

/**
 * Brand Pipeline shared where-clause builder.
 *
 * Single source of truth for translating the brand-pipeline URL filter
 * params (view, mode, stage, relevance, search) into a Prisma where
 * object. Both the JSON read route and the CSV export route call
 * this so the two endpoints can't drift.
 *
 * Behavior mirrors the historical inline logic in
 * /api/admin/brand-pipeline/route.ts verbatim.
 */
export function buildBrandPipelineWhere(searchParams: URLSearchParams): any {
  const stage = searchParams.get("stage");
  const relevance = searchParams.get("relevance");
  const search = searchParams.get("search");
  const view = searchParams.get("view") || "actionable";
  const mode = searchParams.get("mode"); // "pipeline" | "accounts" | null

  const conditions: any[] = [];

  if (mode === "pipeline") {
    conditions.push({ pipelineStage: "LEAD" });
  } else if (mode === "accounts") {
    conditions.push({
      pipelineStage: {
        in: [
          "PRESENTATION",
          "BRAND_TESTING",
          "FACTORY_ONBOARDING",
          "FACTORY_TESTING",
          "PRODUCTION",
          "BRAND_EXPANSION",
          "CUSTOMER_WON",
        ],
      },
    });
  }

  if (view === "actionable") {
    conditions.push({ pipelineStage: { not: "ARCHIVE" } });
    conditions.push({ validationStatus: { notIn: ["irrelevant", "dead"] } });
    conditions.push({
      OR: [
        { contacts: { some: {} } },
        { pipelineStage: { notIn: ["LEAD"] } },
        { fuzeRelevance: { in: ["high", "medium"] } },
      ],
    });
  } else if (view === "enriched") {
    conditions.push({ pipelineStage: { not: "ARCHIVE" } });
    conditions.push({
      contacts: {
        some: {
          OR: [
            { email: { not: null } },
            { linkedinUrl: { not: null } },
          ],
        },
      },
    });
  } else if (view === "verified") {
    conditions.push({ validationStatus: "verified" });
    conditions.push({ pipelineStage: { not: "ARCHIVE" } });
  } else if (view === "all") {
    conditions.push({ pipelineStage: { not: "ARCHIVE" } });
    conditions.push({
      OR: [
        { validationStatus: { notIn: ["irrelevant", "dead"] } },
        { validationStatus: null },
      ],
    });
  }
  // view === "everything" has no conditions

  if (stage && stage !== "all") {
    conditions.push({ pipelineStage: stage });
  }

  if (relevance && relevance !== "all") {
    conditions.push({ fuzeRelevance: relevance });
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { contacts: { some: { name: { contains: search, mode: "insensitive" } } } },
        { contacts: { some: { email: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
