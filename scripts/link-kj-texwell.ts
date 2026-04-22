/**
 * link-kj-texwell.ts
 *
 * One-off: link KJ Tang's user record to the TexWell distributor so
 * his Distributor Portal pulls the right pricing tiers, coverage
 * countries, and assigned factories. Without this link the API now
 * degrades gracefully (returns full factory list + unlinkedUser flag)
 * but pricing won't auto-apply — this fixes that properly.
 *
 * Why a script: the /settings/users PATCH endpoint currently doesn't
 * accept distributorId for DISTRIBUTOR_USER role — that admin gap
 * lives as one of Tina's 4 open tickets. This script is the tactical
 * fix for KJ ahead of the Hi-Goal Shanghai demo today.
 *
 * Run from fuzeatlas root:
 *   npx tsx scripts/link-kj-texwell.ts
 *
 * Behaviour:
 *   • Finds the user matching kj_tang@texwell.com.cn (exact email).
 *   • Finds the distributor matching "TexWell" (case-insensitive).
 *   • If multiples exist, prints all and exits — Andrew picks manually.
 *   • Sets user.distributorId = <texwell.id> and user.role = "DISTRIBUTOR_USER"
 *     (only upgrades role — never downgrades from DISTRIBUTOR_MANAGER).
 *   • Idempotent: safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const KJ_EMAIL = "kj_tang@texwell.com.cn";

  // 1. Find KJ.
  const users = await prisma.user.findMany({
    where: { email: { equals: KJ_EMAIL, mode: "insensitive" } },
    select: { id: true, name: true, email: true, role: true, distributorId: true },
  });

  if (users.length === 0) {
    console.error(`❌ No user with email ${KJ_EMAIL}. Create him first at /settings/users.`);
    process.exit(1);
  }
  if (users.length > 1) {
    console.error(`❌ ${users.length} users matched ${KJ_EMAIL} — pick one manually:`);
    users.forEach((u) =>
      console.error(
        `  - ${u.id}  ${u.name}  <${u.email}>  role=${u.role}  distributorId=${u.distributorId}`,
      ),
    );
    process.exit(1);
  }
  const kj = users[0];
  console.log(`✓ User: ${kj.name} <${kj.email}> (id=${kj.id}, role=${kj.role})`);

  // 2. Find TexWell distributor.
  const distributors = await prisma.distributor.findMany({
    where: { name: { contains: "TexWell", mode: "insensitive" } },
    select: { id: true, name: true, country: true, region: true },
  });

  if (distributors.length === 0) {
    console.error("❌ No distributor matches 'TexWell'. Create it first at /distributors.");
    process.exit(1);
  }
  if (distributors.length > 1) {
    console.error(`❌ ${distributors.length} distributors matched 'TexWell' — pick one manually:`);
    distributors.forEach((d) =>
      console.error(`  - ${d.id}  ${d.name}  (${d.country || "—"} / ${d.region || "—"})`),
    );
    process.exit(1);
  }
  const texwell = distributors[0];
  console.log(
    `✓ Distributor: ${texwell.name} (id=${texwell.id}, country=${texwell.country || "—"}, region=${texwell.region || "—"})`,
  );

  // 3. Short-circuit if already linked.
  const alreadyDistributorRole =
    kj.role === "DISTRIBUTOR_USER" || kj.role === "DISTRIBUTOR_MANAGER";
  if (kj.distributorId === texwell.id && alreadyDistributorRole) {
    console.log(`\n✓ Already linked. Nothing to do.`);
    return;
  }

  // 4. Apply — only upgrade role, never downgrade an existing manager.
  const nextRole = kj.role === "DISTRIBUTOR_MANAGER" ? "DISTRIBUTOR_MANAGER" : "DISTRIBUTOR_USER";
  const updated = await prisma.user.update({
    where: { id: kj.id },
    data: {
      distributorId: texwell.id,
      role: nextRole,
    },
    select: { id: true, name: true, email: true, role: true, distributorId: true },
  });

  console.log(`\n✓ Updated:`);
  console.log(`   ${updated.name} <${updated.email}>`);
  console.log(`   role: ${kj.role} → ${updated.role}`);
  console.log(`   distributorId: ${kj.distributorId || "null"} → ${updated.distributorId}`);
  console.log(
    `\nKJ can now sign in and the Distributor Portal will scope pricing/factories/coverage to ${texwell.name}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
