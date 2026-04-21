/**
 * assign-shauna-factory.ts
 *
 * One-off: assign Shauna Ge to the Shanghai Runhe factory so she can
 * order sample product through the Factory Portal.
 *
 * Why a script: the /settings/users PATCH endpoint currently only
 * accepts role/status/name/email/canClaim — it drops factoryId.
 * Closing that gap for the general case is task #73 (role-change
 * flow with factory prompt). This script is the tactical fix for
 * Shauna specifically.
 *
 * Run from fuzeatlas root:
 *   npx tsx scripts/assign-shauna-factory.ts
 *
 * Behaviour:
 *   • Finds the user matching "Shauna Ge" (first+last OR name field).
 *   • Finds the factory matching "Shanghai Runhe".
 *   • If multiples exist, prints all and exits — Andrew picks manually.
 *   • Sets user.factoryId = <runhe.id> and user.role = "FACTORY_USER"
 *     (unless role is already FACTORY_MANAGER — preserved).
 *   • Idempotent: safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1. Find Shauna.
  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          AND: [
            { name: { contains: "Shauna", mode: "insensitive" } },
            { name: { contains: "Ge", mode: "insensitive" } },
          ],
        },
        { email: { startsWith: "shauna", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, role: true, factoryId: true },
  });

  if (users.length === 0) {
    console.error("❌ No user matches 'Shauna Ge'. Create her first at /settings/users.");
    process.exit(1);
  }
  if (users.length > 1) {
    console.error(`❌ ${users.length} users matched 'Shauna Ge' — pick one manually:`);
    users.forEach((u) => console.error(`  - ${u.id}  ${u.name}  <${u.email}>  role=${u.role}  factoryId=${u.factoryId}`));
    process.exit(1);
  }
  const shauna = users[0];
  console.log(`✓ User: ${shauna.name} <${shauna.email}> (id=${shauna.id}, role=${shauna.role})`);

  // 2. Find Shanghai Runhe factory.
  const factories = await prisma.factory.findMany({
    where: { name: { contains: "Runhe", mode: "insensitive" } },
    select: { id: true, name: true, country: true },
  });

  if (factories.length === 0) {
    console.error("❌ No factory matches 'Runhe'. Create it first at /factories.");
    process.exit(1);
  }
  if (factories.length > 1) {
    console.error(`❌ ${factories.length} factories matched 'Runhe' — pick one manually:`);
    factories.forEach((f) => console.error(`  - ${f.id}  ${f.name}  (${f.country || "—"})`));
    process.exit(1);
  }
  const runhe = factories[0];
  console.log(`✓ Factory: ${runhe.name} (id=${runhe.id}, country=${runhe.country || "—"})`);

  // 3. Short-circuit if already assigned.
  if (shauna.factoryId === runhe.id && (shauna.role === "FACTORY_USER" || shauna.role === "FACTORY_MANAGER")) {
    console.log(`\n✓ Already assigned. Nothing to do.`);
    return;
  }

  // 4. Apply.
  const nextRole = shauna.role === "FACTORY_MANAGER" ? "FACTORY_MANAGER" : "FACTORY_USER";
  const updated = await prisma.user.update({
    where: { id: shauna.id },
    data: {
      factoryId: runhe.id,
      role: nextRole,
    },
    select: { id: true, name: true, email: true, role: true, factoryId: true },
  });

  console.log(`\n✓ Updated:`);
  console.log(`   ${updated.name} <${updated.email}>`);
  console.log(`   role: ${shauna.role} → ${updated.role}`);
  console.log(`   factoryId: ${shauna.factoryId || "null"} → ${updated.factoryId}`);
  console.log(`\nShauna can now sign in and order sample product against ${runhe.name}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
