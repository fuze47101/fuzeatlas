import { prisma } from "@/lib/prisma";

/**
 * NEED-4 — audit log write helpers.
 *
 * Two entry points:
 *   - logAudit(params): low-level write, used by the early LOGIN /
 *     EXPORT call sites that don't have a before/after pair.
 *   - recordChange(): high-level auto-diff. Caller passes the
 *     entity name, id, an actor user id, and the before/after row
 *     snapshots; we compute the changed-fields delta and write a
 *     single AuditLog row. No-op if nothing actually changed.
 *
 * AuditLog model (existing schema, untouched):
 *   id, userId?, action, entity, entityId?, description, changes? (Json),
 *   ipAddress?, createdAt
 *
 * 90-day retention is handled by /api/cron/audit-log-prune.
 */

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

export interface RecordChangeInput {
  /** Atlas user id of the actor (null for system writes — cron, etc.). */
  actorUserId?: string | null;
  /** Entity name — Brand / BrandPricingTier / SupplyChainLink / FactoryInvitation / etc. */
  entity: string;
  entityId: string;
  /** Optional human-readable description; auto-filled from changed fields otherwise. */
  description?: string;
  /** Optional IP for compliance trails. */
  ipAddress?: string | null;
  /** Before-snapshot of the row. Pass `null` on CREATE. */
  before?: Record<string, any> | null;
  /** After-snapshot of the row. Pass `null` on DELETE. */
  after?: Record<string, any> | null;
  /** Override the action verb; defaults are CREATE/UPDATE/DELETE based on before/after. */
  action?: string;
}

/**
 * Diff two row snapshots and write an AuditLog row if anything
 * actually changed. Skipped silently on a no-op so we don't
 * spam the log with PATCH calls that left every field untouched.
 */
export async function recordChange(input: RecordChangeInput): Promise<{ written: boolean }> {
  const { before, after, entity, entityId } = input;
  const action =
    input.action ||
    (before == null && after != null
      ? "CREATE"
      : before != null && after == null
        ? "DELETE"
        : "UPDATE");

  const changes: Record<string, { old: any; new: any }> = {};
  if (before && after) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      // Skip identity + timestamps + internal join fields.
      if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
      const oldVal = (before as any)[k];
      const newVal = (after as any)[k];
      if (!shallowEqual(oldVal, newVal)) {
        changes[k] = { old: oldVal, new: newVal };
      }
    }
    if (Object.keys(changes).length === 0) {
      // No-op update; don't pollute the log.
      return { written: false };
    }
  } else if (after) {
    for (const [k, v] of Object.entries(after)) {
      if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
      if (v !== null && v !== undefined && v !== "") {
        changes[k] = { old: null, new: v };
      }
    }
  } else if (before) {
    for (const [k, v] of Object.entries(before)) {
      if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
      changes[k] = { old: v, new: null };
    }
  }

  const description =
    input.description ||
    (action === "UPDATE"
      ? `Updated ${entity}: ${Object.keys(changes).join(", ")}`
      : action === "CREATE"
        ? `Created ${entity}`
        : `Deleted ${entity}`);

  try {
    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId || null,
        action,
        entity,
        entityId,
        description,
        changes: Object.keys(changes).length > 0 ? changes : undefined,
        ipAddress: input.ipAddress || null,
      },
    });
    return { written: true };
  } catch (e) {
    console.error("[audit.recordChange] failed:", e);
    return { written: false };
  }
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Pull audit logs scoped to a specific entity (or set of entities)
 * for the per-portal activity-log pages. Each portal page passes
 * the entity name (Brand / Factory / Distributor / Lab) + the
 * caller's own id so they only see their own org's audit trail.
 *
 * NEED-4 surfaces this through /api/<portal>/activity-log.
 */
export interface PortalActivityFilter {
  /** Primary entity scope — e.g. Brand id for /brand-portal. */
  entity: string;
  entityId: string;
  /** Optional auxiliary scopes — e.g. brand-pricing tiers also showing under a brand. */
  alsoEntities?: { entity: string; entityId: string }[];
  /** Max rows. Default 100. */
  take?: number;
}

export async function listPortalActivity(filter: PortalActivityFilter) {
  const orConditions: any[] = [{ entity: filter.entity, entityId: filter.entityId }];
  for (const aux of filter.alsoEntities || []) {
    orConditions.push({ entity: aux.entity, entityId: aux.entityId });
  }
  const rows = await prisma.auditLog.findMany({
    where: { OR: orConditions },
    orderBy: { createdAt: "desc" },
    take: filter.take || 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    description: r.description,
    changes: r.changes,
    createdAt: r.createdAt.toISOString(),
    actor: r.user
      ? { id: r.user.id, name: r.user.name, email: r.user.email }
      : null,
  }));
}
