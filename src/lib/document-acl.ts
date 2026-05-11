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
