// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedBrand, SeedBrandError } from "@/lib/seed-brand";

/**
 * GET/POST /api/cron/seed-brand-smoke
 *
 * Bearer-authed end-to-end verification of the NEED-1 seed-brand
 * helper against the live production DB. Sequence per run:
 *
 *   1. Generate a deterministic-but-unique throwaway brand name
 *      (`FUZE-SMOKE-<unix>-<rand4>`) so no real brand can collide.
 *   2. Run seedBrand() once and assert `outcome === "created"`.
 *   3. Run seedBrand() again with the same args and assert
 *      `outcome === "noop"` — idempotency holds.
 *   4. Verify the EntityManager row + isPrimary uniqueness.
 *   5. Clean up: delete the EntityManager + the Brand row.
 *
 * Returns:
 *   {
 *     ok: true,
 *     scenario: { brandName, repEmail },
 *     run1: { ms, result },
 *     run2: { ms, result, idempotent: true },
 *     verify: { entityManagerCount, isPrimaryAfter, ... },
 *     cleanup: { brandDeleted, entityManagersDeleted }
 *   }
 *
 * On any deviation from expected idempotency or shape, returns
 * { ok: false, error, ...partial } with HTTP 500 so the cron caller
 * can flag NEED-1 as broken.
 *
 * Runs against the same DB as production reads/writes. The smoke
 * brand name pattern is excluded by the brand-pipeline default
 * filters (LEAD stage with no contacts) so it won't pollute the
 * pipeline if a cleanup ever fails — but cleanup always runs in a
 * finally block.
 */

const CRON_SECRET = process.env.CRON_SECRET;

const SMOKE_REP_FALLBACKS = [
  "andrew@801inc.com",
  "andrew@fuze47.com",
] as const;

async function pickSmokeRep(): Promise<{ id: string; email: string } | null> {
  for (const email of SMOKE_REP_FALLBACKS) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (u) return u;
  }
  // Last resort — any active ADMIN.
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  return admin || null;
}

async function runSmoke() {
  const started = new Date();
  const stamp = `${Math.floor(Date.now() / 1000)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const brandName = `FUZE-SMOKE-${stamp}`;
  const domain = `smoke-${stamp}.fuze47.example`;

  const rep = await pickSmokeRep();
  if (!rep) {
    return NextResponse.json(
      {
        ok: false,
        error: "No suitable smoke rep found (need andrew@801inc.com or andrew@fuze47.com or any active ADMIN)",
        startedAt: started.toISOString(),
      },
      { status: 500 },
    );
  }

  const partial: any = {
    scenario: { brandName, repEmail: rep.email },
    startedAt: started.toISOString(),
  };

  let brandId: string | null = null;
  let entityManagerId: string | null = null;

  try {
    // ── Run 1: should CREATE ───────────────────────────────────────
    const t1 = Date.now();
    const run1 = await seedBrand(prisma, {
      name: brandName,
      domain,
      repEmail: rep.email,
      tier: "F2",
      cadenceBatches: 5,
    });
    const t1ms = Date.now() - t1;
    brandId = run1.brandId;
    entityManagerId = run1.entityManagerId;
    partial.run1 = { ms: t1ms, result: run1 };

    if (run1.outcome !== "created") {
      return NextResponse.json(
        {
          ok: false,
          error: `Run 1 expected outcome=created, got outcome=${run1.outcome}`,
          ...partial,
        },
        { status: 500 },
      );
    }

    // ── Run 2: should NOOP ─────────────────────────────────────────
    const t2 = Date.now();
    const run2 = await seedBrand(prisma, {
      name: brandName,
      domain,
      repEmail: rep.email,
      tier: "F2",
      cadenceBatches: 5,
    });
    const t2ms = Date.now() - t2;
    partial.run2 = { ms: t2ms, result: run2, idempotent: run2.outcome === "noop" };

    if (run2.outcome !== "noop") {
      return NextResponse.json(
        {
          ok: false,
          error: `Run 2 expected outcome=noop (idempotency), got outcome=${run2.outcome}`,
          ...partial,
        },
        { status: 500 },
      );
    }
    if (run2.brandId !== run1.brandId) {
      return NextResponse.json(
        {
          ok: false,
          error: `Run 2 returned a different brandId — upsert is not actually idempotent`,
          ...partial,
        },
        { status: 500 },
      );
    }
    if (run2.entityManagerId !== run1.entityManagerId) {
      return NextResponse.json(
        {
          ok: false,
          error: `Run 2 returned a different EntityManager id — manager upsert is not actually idempotent`,
          ...partial,
        },
        { status: 500 },
      );
    }

    // ── Verify isPrimary uniqueness on the EntityManager set ──────
    const primaries = await prisma.entityManager.count({
      where: {
        entityType: "BRAND",
        entityId: brandId,
        role: "ACCOUNT_MANAGER",
        isPrimary: true,
      },
    });
    partial.verify = {
      primaryAccountManagers: primaries,
      primaryUniquenessHolds: primaries === 1,
    };
    if (primaries !== 1) {
      return NextResponse.json(
        {
          ok: false,
          error: `Expected exactly 1 primary ACCOUNT_MANAGER for the smoke brand; got ${primaries}`,
          ...partial,
        },
        { status: 500 },
      );
    }

    // Verify the brand-spec defaults landed on the create path.
    const brandRow = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        requiredFuzeTier: true,
        icpCadenceEveryNBatches: true,
        salesRepId: true,
        pipelineStage: true,
      },
    });
    partial.verify.brand = brandRow;
    if (
      brandRow?.requiredFuzeTier !== "F2" ||
      brandRow?.icpCadenceEveryNBatches !== 5 ||
      brandRow?.salesRepId !== rep.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Brand spec defaults didn't land — got tier=${brandRow?.requiredFuzeTier}, cadence=${brandRow?.icpCadenceEveryNBatches}, salesRep=${brandRow?.salesRepId}`,
          ...partial,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      verdict:
        "NEED-1 seed-brand shipped — create + idempotent upsert + primary uniqueness all verified end-to-end.",
      ...partial,
    });
  } finally {
    // ── Cleanup: always run, even on assertion failure ────────────
    try {
      const cleanup: any = { brandDeleted: false, entityManagersDeleted: 0 };
      if (brandId) {
        const emDel = await prisma.entityManager.deleteMany({
          where: { entityType: "BRAND", entityId: brandId },
        });
        cleanup.entityManagersDeleted = emDel.count;
        await prisma.brand.delete({ where: { id: brandId } });
        cleanup.brandDeleted = true;
      }
      partial.cleanup = cleanup;
    } catch (e) {
      console.error("[seed-brand-smoke] cleanup failed:", e);
      partial.cleanupError =
        e instanceof Error ? e.message : String(e);
    }
  }
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runSmoke();
  } catch (e: any) {
    if (e instanceof SeedBrandError) {
      return NextResponse.json(
        { ok: false, error: e.message, code: e.code },
        { status: 500 },
      );
    }
    console.error("[seed-brand-smoke] unhandled:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
