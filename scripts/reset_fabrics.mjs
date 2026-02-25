// scripts/reset_fabrics.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // If you later add FabricContent or FabricSubmission rows,
  // delete in FK-safe order here.
  // For now: Fabric has no required children, so this is fine.
  const r = await prisma.fabric.deleteMany({});
  console.log("deleted fabrics:", r.count);
}

main()
  .catch((e) => {
    console.error("reset error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });