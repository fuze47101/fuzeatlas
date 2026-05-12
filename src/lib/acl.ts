/**
 * Access-control helpers for customer-portal data scoping.
 *
 * Phase 4 of ROADMAP_v2 — consolidates the scoping logic that
 * currently lives inline across `/api/factory-portal/*`,
 * `/api/brand-portal/*`, and `/api/distributor-portal/*`. Repeating
 * those `where` clauses in every route is the same bug shape that
 * bit Tina (Fabric.factoryId vs FabricSubmission.factoryId — see
 * commit c0f67e6).
 *
 * NOTE: ROADMAP_v2 specifies these helpers should ultimately be
 * backed by a SupplyChainLink model that doesn't exist yet. Until
 * the schema lands and the existing BrandFactory rows migrate, the
 * helpers below mirror the *de facto* scoping pattern derived from
 * the existing relations:
 *
 *   - Fabric.brandId          (brand-side scope)
 *   - Fabric.factoryId        (factory-side scope, sometimes null)
 *   - FabricSubmission.factoryId (factory-side scope, fallback)
 *   - Factory.distributorId   (distributor-side scope)
 *
 * The helpers return Prisma `where` fragments — caller spreads them
 * into the larger query so we never lose the ability to add other
 * filters at the call site.
 *
 * Future migration: when SupplyChainLink ships, swap the bodies
 * here without changing any call sites.
 */

export type Scope =
  | { factoryId: string }
  | { brandId: string }
  | { distributorId: string }
  | { admin: true };

/** Where fragment to scope a TestRun query to a specific factory. */
export function testRunScopeForFactory(factoryId: string) {
  return {
    OR: [{ fabric: { factoryId } }, { submission: { factoryId } }],
  } as const;
}

/** Where fragment to scope a TestRun query to a specific brand. */
export function testRunScopeForBrand(brandId: string) {
  return {
    OR: [{ fabric: { brandId } }, { submission: { fabric: { brandId } } }],
  } as const;
}

/** Where fragment to scope a TestRun query to a specific distributor. */
export function testRunScopeForDistributor(distributorId: string) {
  return {
    OR: [
      { fabric: { factory: { distributorId } } },
      { submission: { factory: { distributorId } } },
    ],
  } as const;
}

/** Where fragment to scope a FabricSubmission query to a specific factory. */
export function submissionScopeForFactory(factoryId: string) {
  return {
    OR: [{ factoryId }, { fabric: { factoryId } }],
  } as const;
}

/** Where fragment to scope a FabricSubmission query to a specific brand. */
export function submissionScopeForBrand(brandId: string) {
  return {
    fabric: { brandId },
  } as const;
}

/** Where fragment to scope a Fabric query to a specific factory. */
export function fabricScopeForFactory(factoryId: string) {
  return {
    OR: [{ factoryId }, { submissions: { some: { factoryId } } }],
  } as const;
}

/** Where fragment to scope a Fabric query to a specific brand. */
export function fabricScopeForBrand(brandId: string) {
  return { brandId } as const;
}

/**
 * Where fragment to scope a Fabric query to a specific distributor.
 *
 * Phase 15 hole-plug — Angela Tsai / Tina Distributor tickets
 * (cmp26kl5q / cmp1u9irr). The previous inline scope on
 * `/api/distributor-portal/fabric-search` only matched on
 * `fabric.factoryId` and `fabric.brandId`, missing two valid
 * paths: (a) fabrics whose direct `distributorId` matches but
 * the factory link is null, (b) fabrics linked to a factory
 * under this distributor only via a FabricSubmission row.
 *
 * The helper covers all four cases. Tag rows with a Prisma
 * `OR` at the call site:
 *
 *   prisma.fabric.findMany({ where: fabricScopeForDistributor(id), ... })
 */
export function fabricScopeForDistributor(
  distributorId: string,
  opts?: { brandIds?: string[] },
) {
  const brandIds = opts?.brandIds || [];
  return {
    OR: [
      { distributorId },
      { factory: { distributorId } },
      { submissions: { some: { factory: { distributorId } } } },
      ...(brandIds.length > 0 ? [{ brandId: { in: brandIds } }] : []),
    ],
  } as const;
}

/** Where fragment to scope a FuzeOrder query to a specific factory. */
export function orderScopeForFactory(factoryId: string) {
  return { factoryId } as const;
}

/** Where fragment to scope a FuzeOrder query to a specific brand. */
export function orderScopeForBrand(brandId: string) {
  return {
    OR: [{ brandId }, { brandAllocations: { some: { brandId } } }],
  } as const;
}

/**
 * Resolve the appropriate scope for a session user.
 *
 * Returns null if the user is a plain authenticated user without
 * any portal-side scoping (i.e. an admin without an explicit role
 * filter — admins should not be auto-scoped, the caller decides).
 */
export interface UserScopeInput {
  role: string;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
}

export function deriveUserScope(user: UserScopeInput): Scope | null {
  if (!user) return null;
  if (user.role === "ADMIN" || user.role === "EMPLOYEE") return { admin: true };
  if (user.factoryId) return { factoryId: user.factoryId };
  if (user.brandId) return { brandId: user.brandId };
  if (user.distributorId) return { distributorId: user.distributorId };
  return null;
}
