import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const FUZE_NO = 2580;
const SANMAR = "SanMar";
const INTERMEDIARY = "Fountain Set";
const FACTORY = "Dongguan Shatian Lihai";

async function findBrand(nameLike: string) {
  const rows = await p.brand.findMany({ where: { name: { contains: nameLike, mode: "insensitive" } } });
  return rows;
}

async function main() {
  // 1. Resolve entities
  const sanmars = await findBrand(SANMAR);
  if (sanmars.length !== 1) throw new Error(`Expected 1 SanMar brand, found ${sanmars.length}: ${sanmars.map(b=>b.name).join(", ")}`);
  const sanmar = sanmars[0];

  const fountains = await findBrand(INTERMEDIARY);
  const fountain = fountains[0] ?? null;

  let factory = (await p.factory.findFirst({ where: { name: { contains: "Shatian Lihai", mode: "insensitive" } } }));
  if (!factory) {
    factory = await p.factory.create({ data: { name: FACTORY, country: "China", millType: "Mill" } });
    console.log(`Created factory: ${factory.name} (${factory.id})`);
  } else {
    console.log(`Found factory: ${factory.name} (${factory.id})`);
  }

  // 2. Locate the fabric(s) + submissions for FUZE 2580
  const fabrics = await p.fabric.findMany({
    where: { OR: [ { fuzeNumber: FUZE_NO }, { submissions: { some: { fuzeFabricNumber: FUZE_NO } } } ] },
    include: { brand: true, factory: true, submissions: true },
  });
  const fabricIds = fabrics.map(f => f.id);
  const subs = await p.fabricSubmission.findMany({
    where: { OR: [ { fuzeFabricNumber: FUZE_NO }, { fabricId: { in: fabricIds } } ] },
    include: { brand: true, factory: true },
  });

  console.log("\n=== BEFORE ===");
  console.log("SanMar:", sanmar.id, "| Fountain Set:", fountain?.id ?? "(none)", "| Factory:", factory.id);
  for (const f of fabrics) console.log(`Fabric ${f.fuzeNumber ?? "?"} (${f.id}) brand=${f.brand?.name} factory=${f.factory?.name}`);
  for (const s of subs) console.log(`  Submission ${s.id} brand=${s.brand?.name} factory=${s.factory?.name} lot=${s.lotNumber ?? "-"}`);

  if (fabrics.length === 0 && subs.length === 0) { console.log("\nNothing found for FUZE 2580 — aborting."); return; }

  // 3. Repoint fabrics + submissions to SanMar + Dongguan
  await p.fabric.updateMany({ where: { id: { in: fabricIds } }, data: { brandId: sanmar.id, factoryId: factory.id } });
  await p.fabricSubmission.updateMany({ where: { id: { in: subs.map(s=>s.id) } }, data: { brandId: sanmar.id, factoryId: factory.id } });

  // 4. Tag Fountain Set as intermediary (OEM)
  if (fountain) await p.brand.update({ where: { id: fountain.id }, data: { subtype: "OEM" } });

  // 5. Junctions for supply-chain rollups
  await p.brandFactory.upsert({
    where: { brandId_factoryId: { brandId: sanmar.id, factoryId: factory.id } },
    update: {}, create: { brandId: sanmar.id, factoryId: factory.id, isPrimary: false, note: "via Fountain Set (trading co.)" },
  });
  const link = async (fromType:string, fromId:string, toType:string, toId:string, notes:string) =>
    p.supplyChainLink.upsert({
      where: { supply_chain_link_unique: { fromType, fromId, toType, toId, relation: "SUPPLIES" } },
      update: { active: true, notes }, create: { fromType, fromId, toType, toId, relation: "SUPPLIES", notes },
    });
  await link("FACTORY", factory.id, "BRAND", sanmar.id, "Dongguan Shatian Lihai supplies SanMar");
  if (fountain) {
    await link("FACTORY", factory.id, "BRAND", fountain.id, "Mill ships via Fountain Set");
    await link("BRAND", fountain.id, "BRAND", sanmar.id, "Fountain Set (trading co.) supplies SanMar");
  }

  // 6. Aliases so future SanMar imports resolve these names
  for (const csvName of [FACTORY, INTERMEDIARY]) {
    await p.brandFactoryAlias.upsert({
      where: { brandId_csvName: { brandId: sanmar.id, csvName } },
      update: { factoryId: factory.id }, create: { brandId: sanmar.id, factoryId: factory.id, csvName },
    });
  }

  // 7. Verify
  const after = await p.fabric.findMany({ where: { id: { in: fabricIds } }, include: { brand: true, factory: true, submissions: { include: { brand: true, factory: true } } } });
  console.log("\n=== AFTER ===");
  for (const f of after) {
    console.log(`Fabric ${f.fuzeNumber ?? "?"} brand=${f.brand?.name} factory=${f.factory?.name}`);
    for (const s of f.submissions) console.log(`  Submission ${s.id} brand=${s.brand?.name} factory=${s.factory?.name}`);
  }
  console.log(`\nDone. ${after.length} fabric(s), ${subs.length} submission(s) → SanMar / ${FACTORY}. Fountain Set tagged OEM intermediary.`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.$disconnect());
