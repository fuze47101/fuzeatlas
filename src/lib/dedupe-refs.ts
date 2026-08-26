// @ts-nocheck
/**
 * Entity de-duplication — reference engine.
 *
 * This is the safety core of the `/admin/dedupe` tool. Its ONE job is to
 * know, from the ACTUAL Prisma schema (not a hand-written list), every row
 * anywhere in the database that points at a given Brand or Factory, so a
 * merge can re-point every one of them onto the keeper without ever losing
 * a child row.
 *
 * The FK map is DERIVED at runtime from `Prisma.dmmf` — every model that has
 * a relation whose scalar FK targets `Brand`/`Factory`. If a future migration
 * adds a new `brandId`/`factoryId` column, it appears here automatically; we
 * never have to remember to update a literal list (spec rule #4).
 *
 * Two reference shapes exist in this schema:
 *   1. Typed FK relations (Contact.brandId, Fabric.factoryId, …) — auto-derived.
 *   2. Polymorphic references (EntityManager.entityType/entityId,
 *      SupplyChainLink.fromType/fromId + toType/toId, OrgInvitation) — these
 *      carry no real FK, so DMMF can't see them; they're enumerated below.
 *
 * AuditLog(entity/entityId) is intentionally NOT re-pointed — it is immutable
 * history of what happened to a specific id and is allowed to reference a now-
 * deleted husk. It is likewise excluded from the "zero remaining references"
 * husk assertion.
 */
import { Prisma } from "@prisma/client";

export type EntityType = "BRAND" | "FACTORY";

const TARGET_MODEL: Record<EntityType, string> = {
  BRAND: "Brand",
  FACTORY: "Factory",
};

function delegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

export interface FkRef {
  model: string; // "Contact"
  delegate: string; // "contact"
  fk: string; // "brandId"
  label: string; // "Contact.brandId"
  required: boolean; // FK is non-nullable (informational)
  oneToOne: boolean; // the FK column itself is @unique (1:1)
  companions: string[]; // other fields of a composite @@unique that contains fk
}

const _fkMapCache: Partial<Record<EntityType, FkRef[]>> = {};

/**
 * Build the typed-FK reference list for a target entity, straight from DMMF.
 */
export function buildFkMap(type: EntityType): FkRef[] {
  if (_fkMapCache[type]) return _fkMapCache[type]!;
  const target = TARGET_MODEL[type];
  const refs: FkRef[] = [];

  for (const model of Prisma.dmmf.datamodel.models) {
    // Unique-field metadata for this model.
    const singleUnique = new Set(
      model.fields.filter((f: any) => f.isUnique).map((f: any) => f.name),
    );
    const compositeUniques: string[][] = (model.uniqueFields || []).map(
      (u: any) => [...u],
    );

    for (const field of model.fields) {
      if (
        field.kind === "object" &&
        Array.isArray(field.relationFromFields) &&
        field.relationFromFields.length === 1 &&
        field.type === target
      ) {
        const fk = field.relationFromFields[0];
        const oneToOne = singleUnique.has(fk);
        // Companion fields = the OTHER members of a composite unique that
        // includes this fk (used for collision-safe junction re-pointing).
        let companions: string[] = [];
        for (const u of compositeUniques) {
          if (u.includes(fk)) {
            companions = u.filter((c) => c !== fk);
            break; // schema has at most one composite unique per fk
          }
        }
        refs.push({
          model: model.name,
          delegate: delegateName(model.name),
          fk,
          label: `${model.name}.${fk}`,
          required: !!field.isRequired,
          oneToOne,
          companions,
        });
      }
    }
  }

  _fkMapCache[type] = refs;
  return refs;
}

/**
 * Scalar fields on Brand/Factory that are safe to fill-null-merge from a
 * loser onto a keeper. Excludes id, timestamps, and any @unique scalar
 * (name / knackId / hubspotId — copying those could collide or clobber
 * identity). Keeper identity is never overwritten.
 */
export function fillableScalars(type: EntityType): string[] {
  const target = TARGET_MODEL[type];
  const model = Prisma.dmmf.datamodel.models.find((m: any) => m.name === target);
  if (!model) return [];
  return model.fields
    .filter(
      (f: any) =>
        f.kind === "scalar" &&
        !f.isId &&
        !f.isUnique &&
        !f.isUpdatedAt &&
        f.name !== "createdAt",
    )
    .map((f: any) => f.name);
}

function isEmpty(v: any): boolean {
  return v === null || v === undefined || v === "";
}

/* ────────────────────────────────────────────────────────────────────────
 * COUNTING — used by the read-only scan and by the reallocate flag list.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Count every row (typed + polymorphic) that references a record. Returns a
 * per-model breakdown, a total, and the ids of the referencing rows for a few
 * curated models (used by reallocate's "needs manual review" list).
 */
export async function countRefsForRecord(
  client: any,
  type: EntityType,
  id: string,
): Promise<{ total: number; byModel: Record<string, number> }> {
  const refs = buildFkMap(type);
  const byModel: Record<string, number> = {};

  await Promise.all(
    refs.map(async (r) => {
      const n = await client[r.delegate].count({ where: { [r.fk]: id } });
      if (n > 0) byModel[r.model] = (byModel[r.model] || 0) + n;
    }),
  );

  // TestRun has no direct brand/factory FK — it hangs off FabricSubmission.
  // Surface it explicitly so the reviewer sees the real linked-test footprint.
  const fkField = type === "BRAND" ? "brandId" : "factoryId";
  const testRuns = await client.testRun.count({
    where: { submission: { [fkField]: id } },
  });
  if (testRuns > 0) byModel["TestRun (via submission)"] = testRuns;

  // Polymorphic references.
  const em = await client.entityManager.count({
    where: { entityType: type, entityId: id },
  });
  if (em > 0) byModel["EntityManager"] = em;

  const oi = await client.orgInvitation.count({
    where: { entityType: type, entityId: id },
  });
  if (oi > 0) byModel["OrgInvitation"] = oi;

  const scl = await client.supplyChainLink.count({
    where: {
      OR: [
        { fromType: type, fromId: id },
        { toType: type, toId: id },
      ],
    },
  });
  if (scl > 0) byModel["SupplyChainLink"] = scl;

  const total = Object.values(byModel).reduce((a, b) => a + b, 0);
  return { total, byModel };
}

/**
 * BATCHED reference counting for many records at once. Instead of N records ×
 * M models round-trips (which times out over the remote DB proxy), this runs
 * ONE groupBy per model across all ids. Returns Map<id, {total, byModel}>.
 *
 * Used by the scan, where the candidate set can be dozens of records.
 */
export async function batchCountRefs(
  client: any,
  type: EntityType,
  ids: string[],
): Promise<Map<string, { total: number; byModel: Record<string, number> }>> {
  const out = new Map<string, { total: number; byModel: Record<string, number> }>();
  for (const id of ids) out.set(id, { total: 0, byModel: {} });
  if (!ids.length) return out;

  const add = (id: string, label: string, n: number) => {
    if (!n) return;
    const rec = out.get(id);
    if (!rec) return;
    rec.byModel[label] = (rec.byModel[label] || 0) + n;
    rec.total += n;
  };

  const refs = buildFkMap(type);
  const fkField = type === "BRAND" ? "brandId" : "factoryId";

  await Promise.all([
    // Typed FK models — one groupBy each.
    ...refs.map(async (r) => {
      const groups = await client[r.delegate].groupBy({
        by: [r.fk],
        where: { [r.fk]: { in: ids } },
        _count: { _all: true },
      });
      for (const g of groups) add(g[r.fk], r.model, g._count._all);
    }),
    // TestRun via FabricSubmission (no direct FK).
    (async () => {
      const subs = await client.fabricSubmission.findMany({
        where: { [fkField]: { in: ids } },
        select: { [fkField]: true, _count: { select: { testRuns: true } } },
      });
      for (const s of subs)
        add(s[fkField], "TestRun (via submission)", s._count.testRuns);
    })(),
    // Polymorphic — EntityManager / OrgInvitation.
    (async () => {
      const groups = await client.entityManager.groupBy({
        by: ["entityId"],
        where: { entityType: type, entityId: { in: ids } },
        _count: { _all: true },
      });
      for (const g of groups) add(g.entityId, "EntityManager", g._count._all);
    })(),
    (async () => {
      const groups = await client.orgInvitation.groupBy({
        by: ["entityId"],
        where: { entityType: type, entityId: { in: ids } },
        _count: { _all: true },
      });
      for (const g of groups) add(g.entityId, "OrgInvitation", g._count._all);
    })(),
    // Polymorphic — SupplyChainLink (both sides).
    (async () => {
      const froms = await client.supplyChainLink.groupBy({
        by: ["fromId"],
        where: { fromType: type, fromId: { in: ids } },
        _count: { _all: true },
      });
      for (const g of froms) add(g.fromId, "SupplyChainLink", g._count._all);
      const tos = await client.supplyChainLink.groupBy({
        by: ["toId"],
        where: { toType: type, toId: { in: ids } },
        _count: { _all: true },
      });
      for (const g of tos) add(g.toId, "SupplyChainLink", g._count._all);
    })(),
  ]);

  return out;
}

/**
 * Count references still pointing at a record — used to assert a husk is
 * empty before deleting it. Only counts rows we consider "live child data"
 * (everything in the FK map + polymorphic refs). TestRun is excluded because
 * re-pointing its parent FabricSubmission automatically carries it.
 */
export async function countRemainingRefs(
  client: any,
  type: EntityType,
  id: string,
  nonEmpty?: Set<string> | null,
): Promise<{ total: number; byModel: Record<string, number> }> {
  const refs = buildFkMap(type);
  const byModel: Record<string, number> = {};
  const want = (model: string) => !nonEmpty || nonEmpty.has(model);

  // Sequential inside a transaction (concurrent queries on one interactive tx
  // are unsafe). When a footprint is supplied we only re-check the models that
  // had rows before the merge — the untouched ones were already empty.
  for (const r of refs) {
    if (!want(r.model)) continue;
    const n = await client[r.delegate].count({ where: { [r.fk]: id } });
    if (n > 0) byModel[r.label] = n;
  }
  if (want("EntityManager")) {
    const em = await client.entityManager.count({
      where: { entityType: type, entityId: id },
    });
    if (em > 0) byModel["EntityManager.entityId"] = em;
  }
  if (want("OrgInvitation")) {
    const oi = await client.orgInvitation.count({
      where: { entityType: type, entityId: id },
    });
    if (oi > 0) byModel["OrgInvitation.entityId"] = oi;
  }
  if (want("SupplyChainLink")) {
    const scl = await client.supplyChainLink.count({
      where: {
        OR: [
          { fromType: type, fromId: id },
          { toType: type, toId: id },
        ],
      },
    });
    if (scl > 0) byModel["SupplyChainLink"] = scl;
  }

  const total = Object.values(byModel).reduce((a, b) => a + b, 0);
  return { total, byModel };
}

/* ────────────────────────────────────────────────────────────────────────
 * RE-POINTING — all mutate `tx` inside the caller's $transaction.
 * `moved` accumulates a per-label count so the report is exact.
 * ──────────────────────────────────────────────────────────────────────── */

function bump(moved: Record<string, number>, label: string, n: number) {
  if (n > 0) moved[label] = (moved[label] || 0) + n;
}

async function repointSimple(
  tx: any,
  r: FkRef,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
) {
  const u = await tx[r.delegate].updateMany({
    where: { [r.fk]: loserId },
    data: { [r.fk]: keeperId },
  });
  bump(moved, r.label, u.count);
}

async function repointOneToOne(
  tx: any,
  r: FkRef,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
) {
  const keeperHas = await tx[r.delegate].findFirst({
    where: { [r.fk]: keeperId },
    select: { id: true },
  });
  if (keeperHas) {
    // Keeper already has its 1:1 row — keeper's wins, drop the loser's.
    const d = await tx[r.delegate].deleteMany({ where: { [r.fk]: loserId } });
    bump(moved, `${r.label} (dup removed)`, d.count);
  } else {
    const u = await tx[r.delegate].updateMany({
      where: { [r.fk]: loserId },
      data: { [r.fk]: keeperId },
    });
    bump(moved, r.label, u.count);
  }
}

async function repointComposite(
  tx: any,
  r: FkRef,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
) {
  const select: Record<string, boolean> = { id: true };
  for (const c of r.companions) select[c] = true;
  const rows = await tx[r.delegate].findMany({
    where: { [r.fk]: loserId },
    select,
  });
  const toRepoint: string[] = [];
  const toDelete: string[] = [];
  for (const row of rows) {
    const where: Record<string, any> = { [r.fk]: keeperId };
    for (const c of r.companions) where[c] = row[c];
    const clash = await tx[r.delegate].findFirst({ where, select: { id: true } });
    if (clash) toDelete.push(row.id);
    else toRepoint.push(row.id);
  }
  if (toRepoint.length) {
    await tx[r.delegate].updateMany({
      where: { id: { in: toRepoint } },
      data: { [r.fk]: keeperId },
    });
    bump(moved, r.label, toRepoint.length);
  }
  if (toDelete.length) {
    // These rows would violate the keeper's unique constraint — the keeper
    // already links the same partner. Union-of-links semantics: drop the
    // now-redundant duplicate junction row (no child data is on it).
    await tx[r.delegate].deleteMany({ where: { id: { in: toDelete } } });
    bump(moved, `${r.label} (dup removed)`, toDelete.length);
  }
}

async function repointEntityManager(
  tx: any,
  type: EntityType,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
) {
  // unique(entityType, entityId, userId, role) — companions userId, role.
  const rows = await tx.entityManager.findMany({
    where: { entityType: type, entityId: loserId },
    select: { id: true, userId: true, role: true },
  });
  const toRepoint: string[] = [];
  const toDelete: string[] = [];
  for (const row of rows) {
    const clash = await tx.entityManager.findFirst({
      where: {
        entityType: type,
        entityId: keeperId,
        userId: row.userId,
        role: row.role,
      },
      select: { id: true },
    });
    if (clash) toDelete.push(row.id);
    else toRepoint.push(row.id);
  }
  if (toRepoint.length) {
    await tx.entityManager.updateMany({
      where: { id: { in: toRepoint } },
      data: { entityId: keeperId },
    });
    bump(moved, "EntityManager", toRepoint.length);
  }
  if (toDelete.length) {
    await tx.entityManager.deleteMany({ where: { id: { in: toDelete } } });
    bump(moved, "EntityManager (dup removed)", toDelete.length);
  }
}

async function repointOrgInvitation(
  tx: any,
  type: EntityType,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
) {
  const u = await tx.orgInvitation.updateMany({
    where: { entityType: type, entityId: loserId },
    data: { entityId: keeperId },
  });
  bump(moved, "OrgInvitation", u.count);
}

async function repointSupplyChainLink(
  tx: any,
  type: EntityType,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
) {
  // unique(fromType, fromId, toType, toId, relation). Re-point both sides.
  // FROM side.
  const fromRows = await tx.supplyChainLink.findMany({
    where: { fromType: type, fromId: loserId },
    select: { id: true, toType: true, toId: true, relation: true },
  });
  {
    const toRepoint: string[] = [];
    const toDelete: string[] = [];
    for (const row of fromRows) {
      const clash = await tx.supplyChainLink.findFirst({
        where: {
          fromType: type,
          fromId: keeperId,
          toType: row.toType,
          toId: row.toId,
          relation: row.relation,
        },
        select: { id: true },
      });
      if (clash) toDelete.push(row.id);
      else toRepoint.push(row.id);
    }
    if (toRepoint.length) {
      await tx.supplyChainLink.updateMany({
        where: { id: { in: toRepoint } },
        data: { fromId: keeperId },
      });
      bump(moved, "SupplyChainLink (from)", toRepoint.length);
    }
    if (toDelete.length) {
      await tx.supplyChainLink.deleteMany({ where: { id: { in: toDelete } } });
      bump(moved, "SupplyChainLink (dup removed)", toDelete.length);
    }
  }
  // TO side.
  const toRows = await tx.supplyChainLink.findMany({
    where: { toType: type, toId: loserId },
    select: { id: true, fromType: true, fromId: true, relation: true },
  });
  {
    const toRepoint: string[] = [];
    const toDelete: string[] = [];
    for (const row of toRows) {
      const clash = await tx.supplyChainLink.findFirst({
        where: {
          toType: type,
          toId: keeperId,
          fromType: row.fromType,
          fromId: row.fromId,
          relation: row.relation,
        },
        select: { id: true },
      });
      if (clash) toDelete.push(row.id);
      else toRepoint.push(row.id);
    }
    if (toRepoint.length) {
      await tx.supplyChainLink.updateMany({
        where: { id: { in: toRepoint } },
        data: { toId: keeperId },
      });
      bump(moved, "SupplyChainLink (to)", toRepoint.length);
    }
    if (toDelete.length) {
      await tx.supplyChainLink.deleteMany({ where: { id: { in: toDelete } } });
      bump(moved, "SupplyChainLink (dup removed)", toDelete.length);
    }
  }
}

/**
 * Re-point EVERY reference from a single loser onto the keeper. Mutates `tx`.
 * Records per-model counts in `moved`. Safe against unique-constraint clashes
 * on junction / 1:1 rows.
 */
export async function repointAllReferences(
  tx: any,
  type: EntityType,
  keeperId: string,
  loserId: string,
  moved: Record<string, number>,
  nonEmpty?: Set<string> | null,
) {
  const refs = buildFkMap(type);
  const want = (model: string) => !nonEmpty || nonEmpty.has(model);
  // Sequential (not parallel) — a single interactive transaction can't run
  // concurrent queries reliably, and re-point order doesn't matter. When a
  // footprint is supplied we skip models that had zero loser rows (huge
  // round-trip saving over a remote DB — the difference between a merge that
  // fits in the transaction window and one that times out).
  for (const r of refs) {
    if (!want(r.model)) continue;
    if (r.oneToOne) {
      await repointOneToOne(tx, r, keeperId, loserId, moved);
    } else if (r.companions.length) {
      await repointComposite(tx, r, keeperId, loserId, moved);
    } else {
      await repointSimple(tx, r, keeperId, loserId, moved);
    }
  }
  if (want("EntityManager")) await repointEntityManager(tx, type, keeperId, loserId, moved);
  if (want("OrgInvitation")) await repointOrgInvitation(tx, type, keeperId, loserId, moved);
  if (want("SupplyChainLink")) await repointSupplyChainLink(tx, type, keeperId, loserId, moved);
}

/**
 * Fill-null scalar merge: copy scalar fields from loser onto keeper ONLY where
 * the keeper's field is empty. Never overwrites a populated keeper field.
 * Returns the list of field names actually filled.
 */
export async function fillNullScalars(
  tx: any,
  type: EntityType,
  keeper: any,
  loser: any,
): Promise<string[]> {
  const fields = fillableScalars(type);
  const data: Record<string, any> = {};
  const filled: string[] = [];
  for (const f of fields) {
    if (isEmpty(keeper[f]) && !isEmpty(loser[f])) {
      data[f] = loser[f];
      filled.push(f);
    }
  }
  if (filled.length) {
    const delegate = delegateName(TARGET_MODEL[type]);
    await tx[delegate].update({ where: { id: keeper.id }, data });
  }
  return filled;
}
