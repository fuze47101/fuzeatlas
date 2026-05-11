/**
 * Phase 14B — document access control.
 *
 * Single source of truth for "can this user see this ProductDocument?"
 * Mirrors docs/ROLE_DOCUMENT_MATRIX.md. Imported from
 * /api/library/[id] and the library list endpoint.
 */

export interface SessionUserLike {
  id: string;
  role: string;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
  labId?: string | null;
}

export interface DocumentLike {
  audience: string[];
  restrictedToBrandId?: string | null;
  restrictedToFactoryId?: string | null;
  restrictedToDistributorId?: string | null;
  restrictedToLabId?: string | null;
  category?: string | null;
}

type Verdict = "ALLOW" | "EXCERPT" | "DENY";

const PRIVILEGED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "TESTING_MANAGER",
  "SALES_MANAGER",
]);

/**
 * Map a role to the audience tags that match it. The legacy
 * audience values ("BRAND", "FACTORY", etc.) match BOTH the user
 * and manager tier within an entity type. The new fine-grained
 * tags ("BRAND_USER", "BRAND_MANAGER") are exact.
 */
function audienceTagsForRole(role: string): string[] {
  switch (role) {
    case "BRAND_USER":
      return ["BRAND", "BRAND_USER"];
    case "BRAND_MANAGER":
      return ["BRAND", "BRAND_USER", "BRAND_MANAGER"];
    case "FACTORY_USER":
      return ["FACTORY", "FACTORY_USER"];
    case "FACTORY_MANAGER":
      return ["FACTORY", "FACTORY_USER", "FACTORY_MANAGER"];
    case "DISTRIBUTOR_USER":
      return ["DISTRIBUTOR", "DISTRIBUTOR_USER"];
    case "LAB_USER":
      return ["LAB", "LAB_USER"];
    case "LAB_MANAGER":
      return ["LAB", "LAB_USER", "LAB_MANAGER"];
    case "EMPLOYEE":
      return ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB", "EMPLOYEE", "ADMIN"];
    case "ADMIN":
      return ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB", "EMPLOYEE", "ADMIN", "PUBLIC"];
    default:
      return ["PUBLIC"];
  }
}

export function canViewDocument(
  doc: DocumentLike,
  user: SessionUserLike,
): Verdict {
  // Privileged roles bypass everything.
  if (PRIVILEGED_ROLES.has(user.role)) return "ALLOW";

  const myTags = audienceTagsForRole(user.role);
  const docTags = doc.audience || [];

  // Audience overlap check.
  const overlap = docTags.some((t) => myTags.includes(t));
  if (!overlap) return "DENY";

  // Per-entity restriction check. If the doc is scoped to a brand
  // and the user's brandId doesn't match, deny.
  if (doc.restrictedToBrandId) {
    if (!user.brandId || user.brandId !== doc.restrictedToBrandId) return "DENY";
  }
  if (doc.restrictedToFactoryId) {
    if (!user.factoryId || user.factoryId !== doc.restrictedToFactoryId) return "DENY";
  }
  if (doc.restrictedToDistributorId) {
    if (!user.distributorId || user.distributorId !== doc.restrictedToDistributorId) return "DENY";
  }
  if (doc.restrictedToLabId) {
    if (!user.labId || user.labId !== doc.restrictedToLabId) return "DENY";
  }

  // FUZE-only IP / chemistry detail category — even with audience
  // overlap, only EXCERPT for non-privileged roles. (PRIVILEGED_ROLES
  // already returned ALLOW above.)
  if (doc.category === "fuze_ip" || doc.category === "chemistry_internal") {
    return "EXCERPT";
  }

  return "ALLOW";
}

/**
 * Apply DENY/EXCERPT verdicts to a list of docs returned from
 * Prisma. DENY rows are filtered out; EXCERPT rows have fileUrl
 * stripped.
 */
export function filterDocumentsForUser<T extends DocumentLike & { fileUrl?: string | null }>(
  docs: T[],
  user: SessionUserLike,
): T[] {
  const out: T[] = [];
  for (const d of docs) {
    const v = canViewDocument(d, user);
    if (v === "DENY") continue;
    if (v === "EXCERPT") {
      out.push({ ...d, fileUrl: null });
    } else {
      out.push(d);
    }
  }
  return out;
}

// ─── IMP-5 — unified document repository helper ───────────────

export type DocumentCategory =
  | "compliance"
  | "testing"
  | "commercial"
  | "operations";

export interface DocumentRow {
  id: string;
  kind: string;
  category: DocumentCategory;
  title: string;
  sourceEntity: {
    kind: "brand" | "factory" | "distributor" | "lab" | "system";
    id: string | null;
    name: string;
  } | null;
  fileUrl: string | null;
  createdAt: Date | string | null;
}

function categorizeDocKind(
  kind: string | null | undefined,
  filename?: string | null,
): DocumentCategory {
  const k = String(kind || "").toUpperCase();
  const f = String(filename || "").toLowerCase();
  if (
    k === "CERT" ||
    k === "CERTIFICATE" ||
    k === "SDS" ||
    k === "EPA" ||
    f.includes("epa") ||
    f.includes("oeko") ||
    f.includes("bluesign") ||
    f.includes("pfas") ||
    f.includes("sds")
  ) {
    return "compliance";
  }
  if (
    k === "REPORT" ||
    k === "ICP_RAW" ||
    k === "ICP_RESULT" ||
    k === "AB_RESULT" ||
    k === "FUNGAL_RESULT" ||
    k === "ODOR_RESULT"
  ) {
    return "testing";
  }
  if (
    k === "INVOICE" ||
    k === "PO" ||
    k === "QUOTE" ||
    k === "CONTRACT" ||
    k === "PRICING_SHEET"
  ) {
    return "commercial";
  }
  return "operations";
}

interface ListFilter {
  category?: DocumentCategory;
  q?: string;
}

/**
 * Walk every doc-bearing table, normalize to DocumentRow, filter
 * by per-user ACL + per-entity scope, return newest-first.
 *
 * Imports Prisma lazily inside the function so the module stays
 * cheap to import from places that just want the verdict helpers.
 */
export async function listDocumentsForUser(
  user: SessionUserLike,
  filter: ListFilter = {},
): Promise<DocumentRow[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows: DocumentRow[] = [];
  const isPriv = PRIVILEGED_ROLES.has(user.role);

  // 1) ProductDocument (compliance pack + role-scoped)
  try {
    const pd = await prisma.productDocument.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        docType: true,
        title: true,
        category: true,
        audience: true,
        fileUrl: true,
        createdAt: true,
        restrictedToBrandId: true,
        restrictedToFactoryId: true,
        restrictedToDistributorId: true,
        restrictedToLabId: true,
      },
    });
    for (const d of pd) {
      const verdict = canViewDocument(d, user);
      if (verdict === "DENY") continue;
      const url = verdict === "EXCERPT" ? null : d.fileUrl;
      const cat: DocumentCategory =
        d.category === "claims_compliance" || d.category === "tds_sds" || d.category === "sustainability"
          ? "compliance"
          : d.category === "pricing"
            ? "commercial"
            : "operations";
      rows.push({
        id: d.id,
        kind: d.docType,
        category: cat,
        title: d.title,
        sourceEntity: { kind: "system", id: null, name: "FUZE Atlas" },
        fileUrl: url,
        createdAt: d.createdAt,
      });
    }
  } catch (err) {
    console.warn("[listDocumentsForUser] productDocument:", err);
  }

  // 2) Document table (per-submission / test / lab uploads)
  try {
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        submission: { select: { brandId: true, factoryId: true, fuzeFabricNumber: true } },
        testRun: { select: { testReportNumber: true } },
        lab: { select: { id: true, name: true } },
      },
    });
    for (const d of docs as any[]) {
      const brandId = d.submission?.brandId || null;
      const factoryId = d.submission?.factoryId || null;
      const labId = d.labId || d.lab?.id || null;
      if (!isPriv) {
        if (user.brandId && brandId && user.brandId !== brandId) continue;
        if (user.factoryId && factoryId && user.factoryId !== factoryId) continue;
        if (user.labId && labId && user.labId !== labId) continue;
        // Drop docs that have no scope match at all for non-privileged users.
        const noScopeForMe =
          (!brandId || user.brandId !== brandId) &&
          (!factoryId || user.factoryId !== factoryId) &&
          (!labId || user.labId !== labId);
        if (noScopeForMe) continue;
      }
      rows.push({
        id: d.id,
        kind: String(d.kind || "REPORT"),
        category: categorizeDocKind(String(d.kind || ""), d.filename),
        title: d.filename || d.testRun?.testReportNumber || `Document ${String(d.id).slice(-6)}`,
        sourceEntity: brandId
          ? { kind: "brand", id: brandId, name: "Brand" }
          : factoryId
            ? { kind: "factory", id: factoryId, name: "Factory" }
            : labId
              ? { kind: "lab", id: labId, name: d.lab?.name || "Lab" }
              : null,
        fileUrl: d.url || (d.bucket && d.key ? `/api/documents/${d.id}/download` : null),
        createdAt: d.createdAt,
      });
    }
  } catch (err) {
    console.warn("[listDocumentsForUser] document:", err);
  }

  // 3) Brand.protocolDocUrl (per-brand protocol PDFs)
  try {
    const where: any = { protocolDocUrl: { not: null } };
    if (!isPriv && user.brandId) where.id = user.brandId;
    const brands = await prisma.brand.findMany({
      where,
      select: { id: true, name: true, protocolDocUrl: true, brandSpecUpdatedAt: true },
      take: 200,
    });
    for (const b of brands) {
      if (!b.protocolDocUrl) continue;
      // Factory: only surface protocols for brands they supply.
      if (!isPriv && user.factoryId) {
        const link = await prisma.supplyChainLink.findFirst({
          where: {
            fromType: "BRAND",
            fromId: b.id,
            toType: "FACTORY",
            toId: user.factoryId,
            active: true,
          },
          select: { id: true },
        });
        if (!link) continue;
      } else if (!isPriv && user.brandId && user.brandId !== b.id) {
        continue;
      } else if (!isPriv && !user.brandId && !user.factoryId) {
        continue;
      }
      rows.push({
        id: `brand-protocol-${b.id}`,
        kind: "PROTOCOL",
        category: "operations",
        title: `${b.name} testing protocol`,
        sourceEntity: { kind: "brand", id: b.id, name: b.name },
        fileUrl: b.protocolDocUrl,
        createdAt: b.brandSpecUpdatedAt || null,
      });
    }
  } catch (err) {
    console.warn("[listDocumentsForUser] brand protocol:", err);
  }

  // Filter + sort
  let out = rows;
  if (filter.category) {
    out = out.filter((r) => r.category === filter.category);
  }
  if (filter.q) {
    const q = filter.q.toLowerCase();
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q) ||
        (r.sourceEntity?.name || "").toLowerCase().includes(q),
    );
  }
  out.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return out;
}
