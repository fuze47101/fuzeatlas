import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const FUZE_NUMBERS = [2580, 2581, 2582];
const SANMAR = "SanMar";
const INTERMEDIARY = "Fountain Set";
const FACTORY_NAME_HINT = "Shatian Lihai";

async function findBrand(nameLike: string) {
  return p.brand.findMany({ where: { name: { contains: nameLike, mode: "insensitive" } } });
}

async function main() {
  const sanmars = await findBrand(SANMAR);
  if (sanmars.length !== 1) throw new Error(`Expected 1 SanMar, found ${sanmars.length}`);
  const sanmar = sanmars[0];
  const fountain = (await findBrand(INTERMEDIARY))[0] ?? null;

  let factory = await p.factory.findFirst({ where: { name: { contains: FACTORY_NAME_HINT, mode: "insensitive" } } });
  if (!factory) throw new Error("Dongguan Shatian Lihai factory not found");
  console.log(`SanMar=${sanmar.id} | Fountain Set=${fountain?.id ?? "(none)"} | Factory=${factory.id} (${factory.name})`);

  for (const FUZE_NO of FUZE_NUMBERS) {
    console.log(`\n──── FUZE ${FUZE_NO} ────`);
    const fabrics = await p.fabric.findMany({
      where: { OR: [{ fuzeNumber: FUZE_NO }, { submissions: { some: { fuzeFabricNumber: FUZE_NO } } }] },
      include: { brand: true, factory: true, submissions: true },
    });
    const fabricIds = fabrics.map(f => f.id);
    const subs = await p.fabricSubmission.findMany({
      where: { OR: [{ fuzeFabricNumber: FUZE_NO }, { fabricId: { in: fabricIds } }] },
      include: { brand: true, factory: true },
    });

    console.log("BEFORE:");
    for (const f of fabrics) console.log(`  Fabric ${f.fuzeNumber} (${f.id}) brand=${f.brand?.name} factory=${f.factory?.name}`);
    for (const s of subs) console.log(`    Sub ${s.id} brand=${s.brand?.name} factory=${s.factory?.name}`);
    if (fabrics.length === 0 && subs.length === 0) { console.log("  (nothing found — skipping)"); continue; }

    await p.fabric.updateMany({ where: { id: { in: fabricIds } }, data: { brandId: sanmar.id, factoryId: factory.id } });
    await p.fabricSubmission.updateMany({ where: { id: { in: subs.map(s=>s.id) } }, data: { brandId: sanmar.id, factoryId: factory.id } });

    const after = await p.fabric.findMany({ where: { id: { in: fabricIds } }, include: { brand: true, factory: true, submissions: { include: { brand: true, factory: true } } } });
    console.log("AFTER:");
    for (const f of after) {
      console.log(`  Fabric ${f.fuzeNumber} brand=${f.brand?.name} factory=${f.factory?.name}`);
      for (const s of f.submissions) console.log(`    Sub ${s.id} brand=${s.brand?.name} factory=${s.factory?.name}`);
    }
  }

  if (fountain) await p.brand.update({ where: { id: fountain.id }, data: { subtype: "OEM" } });

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
  for (const csvName of [factory.name, INTERMEDIARY, "Dongguan Shatian Lihai"]) {
    await p.brandFactoryAlias.upsert({
      where: { brandId_csvName: { brandId: sanmar.id, csvName } },
      update: { factoryId: factory.id }, create: { brandId: sanmar.id, factoryId: factory.id, csvName },
    });
  }

  console.log(`\nDone. ${FUZE_NUMBERS.length} FUZE number(s) processed → SanMar / ${factory.name}.`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.$disconnect());
