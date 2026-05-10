/**
 * Phase 11A — one-shot entity geocoder.
 *
 * Walks Factory / Brand / Lab / Distributor rows with a populated
 * city+country but missing lat+lng, hits Nominatim with a strict
 * 1-request-per-second rate limit, persists the result. Re-runs
 * skip already-coded rows.
 *
 * Usage:
 *   npx tsx scripts/geocode-entities.ts
 *   npx tsx scripts/geocode-entities.ts --only=Factory
 *   npx tsx scripts/geocode-entities.ts --limit=50
 *
 * Nominatim ToS:
 *   - Max 1 request per second
 *   - Identify yourself via User-Agent
 *   - No bulk geocoding (we cap with --limit per run)
 *   - Cache results (we persist to DB, so re-runs skip done rows)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "FUZE-Atlas-Geocoder/1.0 (andrew@801inc.com)";
const RATE_LIMIT_MS = 1100;

interface GeocodeArgs {
  only?: "Factory" | "Brand" | "Lab" | "Distributor";
  limit?: number;
}

function parseArgs(): GeocodeArgs {
  const out: GeocodeArgs = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    if (m[1] === "only") out.only = m[2] as any;
    if (m[1] === "limit") out.limit = parseInt(m[2], 10);
  }
  return out;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocode(
  city: string | null,
  state: string | null,
  country: string | null,
  address: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const q = [address, city, state, country].filter(Boolean).join(", ").trim();
  if (!q) return null;
  const url = `${NOMINATIM_BASE}?format=json&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[geocode] ${q} → HTTP ${res.status}`);
      return null;
    }
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) {
      console.warn(`[geocode] ${q} → no result`);
      return null;
    }
    const lat = parseFloat(arr[0].lat);
    const lng = parseFloat(arr[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err: any) {
    console.warn(`[geocode] ${q} → ${err?.message || String(err)}`);
    return null;
  }
}

type EntityKind = "Factory" | "Brand" | "Lab" | "Distributor";

async function geocodeKind(kind: EntityKind, limit?: number) {
  console.log(`\n=== ${kind} ===`);
  const where: any = {
    lat: null,
    OR: [
      { city: { not: null } },
      { country: { not: null } },
      { address: { not: null } },
    ],
  };
  const select: any = {
    id: true,
    name: true,
    city: true,
    state: true,
    country: true,
    address: true,
  };
  let rows: any[];
  switch (kind) {
    case "Factory":
      rows = await prisma.factory.findMany({ where, select, take: limit });
      break;
    case "Brand":
      rows = await prisma.brand.findMany({ where, select, take: limit });
      break;
    case "Lab":
      rows = await prisma.lab.findMany({ where, select, take: limit });
      break;
    case "Distributor":
      rows = await prisma.distributor.findMany({ where, select, take: limit });
      break;
    default:
      rows = [];
  }
  console.log(`  ${rows.length} candidate(s) to geocode`);

  let coded = 0;
  for (const r of rows) {
    await sleep(RATE_LIMIT_MS);
    const result = await geocode(r.city, r.state || null, r.country, r.address);
    if (!result) continue;
    try {
      switch (kind) {
        case "Factory":
          await prisma.factory.update({ where: { id: r.id }, data: result });
          break;
        case "Brand":
          await prisma.brand.update({ where: { id: r.id }, data: result });
          break;
        case "Lab":
          await prisma.lab.update({ where: { id: r.id }, data: result });
          break;
        case "Distributor":
          await prisma.distributor.update({ where: { id: r.id }, data: result });
          break;
      }
      coded++;
      console.log(`  ✓ ${r.name} → (${result.lat.toFixed(3)}, ${result.lng.toFixed(3)})`);
    } catch (err: any) {
      console.warn(`  ✗ ${r.name} → update failed: ${err?.message}`);
    }
  }
  console.log(`  done: coded ${coded}/${rows.length}`);
}

async function main() {
  const args = parseArgs();
  const kinds: EntityKind[] = args.only
    ? [args.only]
    : ["Factory", "Brand", "Lab", "Distributor"];
  for (const k of kinds) {
    try {
      await geocodeKind(k, args.limit);
    } catch (err: any) {
      console.error(`[${k}] failed:`, err?.message || err);
    }
  }
  await prisma.$disconnect();
}

main();
