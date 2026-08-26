// @ts-nocheck
/**
 * GET /api/cron/diag-duplicates
 *
 * Bearer-authed, READ-ONLY duplicate-entity scan. Lives under /api/cron/* so
 * the auth middleware exempts it (Vercel Cron / fzcron pattern). Returns the
 * full cluster JSON: brand clusters, factory clusters, and cross-type
 * collisions (the Welspun case). Writes nothing.
 *
 * Optional `?reallocate=1` attaches a DRY-RUN reallocation preview for the
 * first type collision (each colliding Brand → the suggested Factory) so the
 * §5 acceptance test — "preview a Welspun reallocation, confirm contacts/notes
 * map with brand-only rows flagged" — is runnable straight from fzcron. The
 * preview runs inside a transaction that is ALWAYS rolled back; nothing is
 * written.
 *
 * Run: fzcron diag-duplicates
 *      fzcron 'diag-duplicates?reallocate=1'
 */
import { NextResponse } from "next/server";
import { scanDuplicates } from "@/lib/dedupe-scan";
import { reallocateBrandToFactory, mergeEntities } from "@/lib/dedupe-merge";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const reallocateParam = url.searchParams.get("reallocate"); // "1" or a key substring
  const wantReallocate = !!reallocateParam;
  const mergeParam = url.searchParams.get("merge"); // "1" or a brand-cluster key substring

  try {
    const result = await scanDuplicates();

    let mergePreview: any = undefined;
    if (mergeParam && result.brandClusters.length) {
      const cluster =
        mergeParam === "1"
          ? result.brandClusters[0]
          : result.brandClusters.find((c) =>
              c.key.includes(mergeParam.toLowerCase()),
            ) || result.brandClusters[0];
      const loserIds = cluster.members
        .map((m: any) => m.id)
        .filter((id: string) => id !== cluster.suggestedKeeperId);
      // dryRun defaults true — rolled back.
      const preview = await mergeEntities({
        entityType: "BRAND",
        keeperId: cluster.suggestedKeeperId,
        loserIds,
        dryRun: true,
        actor: { id: "diag", email: "diag@cron" },
      });
      mergePreview = { clusterKey: cluster.key, preview };
    }

    let reallocationPreview: any = undefined;
    if (wantReallocate && result.typeCollisions.length) {
      // "1" → first collision; any other value → first collision whose key
      // contains that substring (e.g. ?reallocate=welspun).
      const collision =
        reallocateParam === "1"
          ? result.typeCollisions[0]
          : result.typeCollisions.find((c) =>
              c.key.includes(reallocateParam.toLowerCase()),
            ) || result.typeCollisions[0];
      const factoryId = collision.suggestedFactoryId;
      reallocationPreview = {
        collisionKey: collision.key,
        factoryId,
        previews: [],
      };
      for (const brand of collision.brands) {
        // dryRun defaults true — always rolled back.
        const preview = await reallocateBrandToFactory({
          brandId: brand.id,
          factoryId,
          dryRun: true,
          actor: { id: "diag", email: "diag@cron" },
        });
        reallocationPreview.previews.push({ brandId: brand.id, brandName: brand.name, preview });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        ...result,
        ...(reallocationPreview ? { reallocationPreview } : {}),
        ...(mergePreview ? { mergePreview } : {}),
        verdict:
          result.summary.totalClusters === 0
            ? "no duplicate candidates found"
            : `${result.summary.totalClusters} cluster(s): ${result.summary.brandClusterCount} brand, ${result.summary.factoryClusterCount} factory, ${result.summary.typeCollisionCount} type-collision`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code || null },
      { status: 500 },
    );
  }
}
