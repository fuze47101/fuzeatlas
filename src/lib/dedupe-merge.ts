// @ts-nocheck
/**
 * Entity de-duplication — merge + cross-type reallocation engine.
 *
 * Safety contract (spec §Non-negotiable):
 *   • Never lose data — every child row is re-pointed, only the empty husk is
 *     removed.
 *   • Dry-run first — the SAME code path runs for preview and commit; on
 *     dry-run we do the real re-points inside the transaction (so counts are
 *     exact) then throw a sentinel to roll everything back.
 *   • Transactional — one $transaction; any error rolls back everything.
 *   • Fill-null scalar merge — keeper identity is never overwritten.
 *   • Idempotent — a missing loser is a no-op; merging a record into itself is
 *     refused.
 *
 * The audit trail is a Note written on the keeper (BRAND → note.brandId,
 * FACTORY → note.factoryId) with noteType "DEDUPE_MERGE" / "DEDUPE_REALLOCATE".
 */
import { prisma } from "@/lib/prisma";
import {
  buildFkMap,
  repointAllReferences,
  fillNullScalars,
  countRemainingRefs,
  countRefsForRecord,
} from "@/lib/dedupe-refs";

const TX_OPTS = { timeout: 60_000, maxWait: 20_000 };

function delegateOf(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

class DryRunRollback extends Error {
  payload: any;
  constructor(payload: any) {
    super("dedupe dry-run rollback");
    this.name = "DryRunRollback";
    this.payload = payload;
  }
}

export interface MergeInput {
  entityType: "BRAND" | "FACTORY";
  keeperId: string;
  loserIds: string[];
  dryRun?: boolean;
  actor: { id: string; name?: string | null; email?: string | null };
}

/**
 * Same-type merge. Re-points every reference from each loser onto the keeper,
 * fills null keeper scalars, preserves loser names as aliases (factories), and
 * removes the empty husks.
 */
export async function mergeEntities(input: MergeInput) {
  const { entityType, keeperId } = input;
  const dryRun = input.dryRun !== false; // default TRUE (safety)
  const delegate = entityType === "BRAND" ? "brand" : "factory";

  // Guard: refuse merging a record into itself.
  const loserIds = Array.from(new Set(input.loserIds || [])).filter(Boolean);
  if (loserIds.includes(keeperId)) {
    return {
      ok: false,
      error: "keeperId cannot be one of loserIds (cannot merge a record into itself)",
    };
  }

  const keeper = await prisma[delegate].findUnique({ where: { id: keeperId } });
  if (!keeper) {
    return { ok: false, error: `Keeper ${entityType} ${keeperId} not found` };
  }

  // Load losers; silently skip ones that no longer exist (idempotent re-run).
  const losers = [];
  for (const id of loserIds) {
    const l = await prisma[delegate].findUnique({ where: { id } });
    if (l) losers.push(l);
  }

  if (!losers.length) {
    return {
      ok: true,
      dryRun,
      keeperId,
      keeperName: keeper.name,
      merged: [],
      moved: {},
      aliasesAdded: 0,
      husksRemoved: 0,
      scalarsFilled: [],
      note: "No live losers to merge — idempotent no-op.",
    };
  }

  // Pre-compute each loser's reference footprint OUTSIDE the transaction
  // (fast, parallel counts). Inside the tx we then only touch the tables that
  // actually hold loser rows — keeping the merge inside the transaction window
  // even over a remote DB proxy.
  const footprints = new Map<string, Set<string>>();
  await Promise.all(
    losers.map(async (l) => {
      const { byModel } = await countRefsForRecord(prisma, entityType, l.id);
      footprints.set(l.id, new Set(Object.keys(byModel)));
    }),
  );

  const run = async (tx: any) => {
    const moved: Record<string, number> = {};
    const merged: { id: string; name: string }[] = [];
    const scalarsFilled: string[] = [];
    let aliasesAdded = 0;
    let husksRemoved = 0;

    for (const loser of losers) {
      const footprint = footprints.get(loser.id) || null;
      // 1. Re-point every referencing row onto the keeper.
      await repointAllReferences(tx, entityType, keeperId, loser.id, moved, footprint);

      // 2. Fill-null scalar merge (never overwrites populated keeper fields).
      const filled = await fillNullScalars(tx, entityType, keeper, loser);
      for (const f of filled) if (!scalarsFilled.includes(f)) scalarsFilled.push(f);

      // 3. Preserve the losing name so future CSV imports still resolve it.
      //    The alias mechanism (BrandFactoryAlias) is a brand→factory mill-name
      //    map, so it applies to FACTORY merges: for every brand that now
      //    sources from the keeper, record loser.name → keeper. For BRAND
      //    merges there is no brand-name alias table; the loser name is
      //    preserved in the audit Note (§below) instead.
      if (entityType === "FACTORY") {
        const brandLinks = await tx.brandFactory.findMany({
          where: { factoryId: keeperId },
          select: { brandId: true },
        });
        const brandIds = Array.from(new Set(brandLinks.map((b) => b.brandId)));
        for (const brandId of brandIds) {
          const exists = await tx.brandFactoryAlias.findFirst({
            where: { brandId, csvName: loser.name },
            select: { id: true },
          });
          if (!exists) {
            await tx.brandFactoryAlias.create({
              data: { brandId, csvName: loser.name, factoryId: keeperId },
            });
            aliasesAdded++;
          }
        }
      }

      // 4. Assert the husk is empty, then remove it. If anything still points
      //    at the loser, something wasn't re-pointed — throw to roll back.
      const remaining = await countRemainingRefs(tx, entityType, loser.id, footprint);
      if (remaining.total > 0) {
        throw new Error(
          `Refusing to delete ${entityType} husk ${loser.id} — ${remaining.total} references remain: ${JSON.stringify(remaining.byModel)}`,
        );
      }
      await tx[delegate].delete({ where: { id: loser.id } });
      husksRemoved++;
      merged.push({ id: loser.id, name: loser.name });
    }

    // 5. Audit Note on the keeper (real commits only).
    if (!dryRun) {
      const content =
        `[DEDUPE MERGE] ${entityType} — kept "${keeper.name}" (${keeperId}). ` +
        `Merged ${merged.length}: ${merged.map((m) => `"${m.name}" (${m.id})`).join(", ")}. ` +
        `Moved: ${JSON.stringify(moved)}. Aliases added: ${aliasesAdded}. ` +
        `Scalars filled: ${scalarsFilled.join(", ") || "none"}. ` +
        `By ${input.actor.email || input.actor.name || input.actor.id} at ${new Date().toISOString()}.`;
      await tx.note.create({
        data: {
          content,
          noteType: "DEDUPE_MERGE",
          date: new Date(),
          userId: input.actor.id,
          ...(entityType === "BRAND"
            ? { brandId: keeperId }
            : { factoryId: keeperId }),
        },
      });
    }

    const payload = {
      ok: true,
      dryRun,
      entityType,
      keeperId,
      keeperName: keeper.name,
      merged,
      moved,
      aliasesAdded,
      husksRemoved,
      scalarsFilled,
    };

    if (dryRun) throw new DryRunRollback(payload);
    return payload;
  };

  try {
    return await prisma.$transaction(run, TX_OPTS);
  } catch (e: any) {
    if (e instanceof DryRunRollback) return e.payload;
    return { ok: false, error: e?.message || String(e), code: e?.code || null };
  }
}

export interface ReallocateInput {
  brandId: string;
  factoryId: string;
  dryRun?: boolean;
  actor: { id: string; name?: string | null; email?: string | null };
}

/**
 * Cross-type reallocation (spec §4 — the Welspun case). A mis-typed Brand's
 * cleanly-mappable rows (contacts + CRM notes/activity) move onto the correct
 * Factory. Rows whose brand semantics are genuinely a brand attribute (fabrics,
 * pricing tiers, engagement, pipeline, orders, …) are NOT guessed — they are
 * returned as "needs manual review" and left untouched. The Brand husk is
 * deleted only if it becomes truly empty.
 */
export async function reallocateBrandToFactory(input: ReallocateInput) {
  const dryRun = input.dryRun !== false; // default TRUE

  const [brand, factory] = await Promise.all([
    prisma.brand.findUnique({ where: { id: input.brandId } }),
    prisma.factory.findUnique({ where: { id: input.factoryId } }),
  ]);
  if (!brand) return { ok: false, error: `Brand ${input.brandId} not found` };
  if (!factory) return { ok: false, error: `Factory ${input.factoryId} not found` };

  const run = async (tx: any) => {
    const moved: Record<string, number> = {};

    // ── Cleanly-mappable: contacts ────────────────────────────────
    // Contacts with no existing factory move onto the factory; contacts
    // already tied to a factory keep it, we just clear the stale brandId.
    const cMoved = await tx.contact.updateMany({
      where: { brandId: input.brandId, factoryId: null },
      data: { factoryId: input.factoryId, brandId: null },
    });
    if (cMoved.count) moved["Contact → Factory"] = cMoved.count;
    const cCleared = await tx.contact.updateMany({
      where: { brandId: input.brandId, NOT: { factoryId: null } },
      data: { brandId: null },
    });
    if (cCleared.count) moved["Contact (brandId cleared, kept own factory)"] = cCleared.count;

    // ── Cleanly-mappable: CRM notes / activity ────────────────────
    const nMoved = await tx.note.updateMany({
      where: { brandId: input.brandId, factoryId: null },
      data: { factoryId: input.factoryId, brandId: null },
    });
    if (nMoved.count) moved["Note → Factory"] = nMoved.count;
    const nCleared = await tx.note.updateMany({
      where: { brandId: input.brandId, NOT: { factoryId: null } },
      data: { brandId: null },
    });
    if (nCleared.count) moved["Note (brandId cleared, kept own factory)"] = nCleared.count;

    // ── Needs manual review: every OTHER brand reference ──────────
    // Do NOT guess brand-semantic rows. Enumerate them (ids + counts).
    const needsReview: {
      model: string;
      field: string;
      count: number;
      ids: string[];
    }[] = [];
    const refs = buildFkMap("BRAND").filter(
      (r) => r.model !== "Contact" && r.model !== "Note",
    );
    for (const r of refs) {
      const rows = await tx[r.delegate].findMany({
        where: { [r.fk]: input.brandId },
        select: { id: true },
        take: 50,
      });
      const count = await tx[r.delegate].count({
        where: { [r.fk]: input.brandId },
      });
      if (count > 0) {
        needsReview.push({
          model: r.model,
          field: r.fk,
          count,
          ids: rows.map((x) => x.id),
        });
      }
    }
    // Polymorphic brand references.
    for (const poly of [
      { model: "EntityManager", where: { entityType: "BRAND", entityId: input.brandId } },
      { model: "OrgInvitation", where: { entityType: "BRAND", entityId: input.brandId } },
    ]) {
      const delegate = delegateOf(poly.model);
      const count = await tx[delegate].count({ where: poly.where });
      if (count > 0) {
        const rows = await tx[delegate].findMany({
          where: poly.where,
          select: { id: true },
          take: 50,
        });
        needsReview.push({
          model: poly.model,
          field: "entityId",
          count,
          ids: rows.map((x) => x.id),
        });
      }
    }
    const sclCount = await tx.supplyChainLink.count({
      where: {
        OR: [
          { fromType: "BRAND", fromId: input.brandId },
          { toType: "BRAND", toId: input.brandId },
        ],
      },
    });
    if (sclCount > 0) {
      const rows = await tx.supplyChainLink.findMany({
        where: {
          OR: [
            { fromType: "BRAND", fromId: input.brandId },
            { toType: "BRAND", toId: input.brandId },
          ],
        },
        select: { id: true },
        take: 50,
      });
      needsReview.push({
        model: "SupplyChainLink",
        field: "from/toId",
        count: sclCount,
        ids: rows.map((x) => x.id),
      });
    }

    const flaggedTotal = needsReview.reduce((a, b) => a + b.count, 0);
    let huskRemoved = false;

    // ── Husk: delete only if the brand is now truly empty ─────────
    if (flaggedTotal === 0) {
      const remaining = await countRemainingRefs(tx, "BRAND", input.brandId);
      if (remaining.total === 0) {
        await tx.brand.delete({ where: { id: input.brandId } });
        huskRemoved = true;
      }
    }

    // ── Audit Note on the Factory (real commits only) ─────────────
    if (!dryRun) {
      const content =
        `[DEDUPE REALLOCATE] Brand "${brand.name}" (${input.brandId}) → Factory "${factory.name}" (${input.factoryId}). ` +
        `Moved automatically: ${JSON.stringify(moved)}. ` +
        `Needs manual review: ${needsReview.map((n) => `${n.model}(${n.count})`).join(", ") || "none"}. ` +
        `Brand husk ${huskRemoved ? "deleted (empty)" : "kept (flagged rows remain)"}. ` +
        `By ${input.actor.email || input.actor.name || input.actor.id} at ${new Date().toISOString()}.`;
      await tx.note.create({
        data: {
          content,
          noteType: "DEDUPE_REALLOCATE",
          date: new Date(),
          userId: input.actor.id,
          factoryId: input.factoryId,
        },
      });
    }

    const payload = {
      ok: true,
      dryRun,
      brandId: input.brandId,
      brandName: brand.name,
      factoryId: input.factoryId,
      factoryName: factory.name,
      moved,
      needsReview,
      flaggedTotal,
      huskRemoved,
    };

    if (dryRun) throw new DryRunRollback(payload);
    return payload;
  };

  try {
    return await prisma.$transaction(run, TX_OPTS);
  } catch (e: any) {
    if (e instanceof DryRunRollback) return e.payload;
    return { ok: false, error: e?.message || String(e), code: e?.code || null };
  }
}
