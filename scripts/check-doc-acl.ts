/**
 * Phase 15 IMP-5 — document ACL matrix assertion.
 *
 * Asserts canViewDocument() against a representative fixture set
 * that mirrors PHASE_15_HOLE_PLUG.md lines 172-188. Pure unit test
 * — no DB, no Prisma. Exits non-zero on any failure.
 *
 * Run: npm run check:doc-acl
 */
import { canViewDocument, type DocumentLike, type SessionUserLike } from "../src/lib/document-acl";

interface Case {
  name: string;
  doc: DocumentLike;
  user: SessionUserLike;
  expect: "ALLOW" | "EXCERPT" | "DENY";
}

const brand_A: SessionUserLike = { id: "u1", role: "BRAND_USER", brandId: "brand-A" };
const brand_A_mgr: SessionUserLike = { id: "u2", role: "BRAND_MANAGER", brandId: "brand-A" };
const brand_B_mgr: SessionUserLike = { id: "u3", role: "BRAND_MANAGER", brandId: "brand-B" };
const factory_X: SessionUserLike = { id: "u4", role: "FACTORY_USER", factoryId: "factory-X" };
const lab_Z: SessionUserLike = { id: "u5", role: "LAB_USER", labId: "lab-Z" };
const distributor: SessionUserLike = { id: "u6", role: "DISTRIBUTOR_USER", distributorId: "dist-D" };
const admin: SessionUserLike = { id: "u7", role: "ADMIN" };
const employee: SessionUserLike = { id: "u8", role: "EMPLOYEE" };

const cases: Case[] = [
  // Public compliance pack — everyone sees.
  {
    name: "EPA letter — brand user",
    doc: { audience: ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB", "PUBLIC"] },
    user: brand_A,
    expect: "ALLOW",
  },
  {
    name: "SDS — factory user",
    doc: { audience: ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB"] },
    user: factory_X,
    expect: "ALLOW",
  },
  // Brand pricing tier contract — own brand mgr sees, other brand mgr denied.
  {
    name: "Brand A pricing contract — brand A mgr",
    doc: { audience: ["BRAND_MANAGER", "ADMIN"], restrictedToBrandId: "brand-A" },
    user: brand_A_mgr,
    expect: "ALLOW",
  },
  {
    name: "Brand A pricing contract — brand B mgr (DENY — cross-brand)",
    doc: { audience: ["BRAND_MANAGER", "ADMIN"], restrictedToBrandId: "brand-A" },
    user: brand_B_mgr,
    expect: "DENY",
  },
  {
    name: "Brand A pricing contract — plain brand A user (DENY — audience tier)",
    doc: { audience: ["BRAND_MANAGER", "ADMIN"], restrictedToBrandId: "brand-A" },
    user: brand_A,
    expect: "DENY",
  },
  {
    name: "Brand A pricing contract — admin",
    doc: { audience: ["BRAND_MANAGER", "ADMIN"], restrictedToBrandId: "brand-A" },
    user: admin,
    expect: "ALLOW",
  },
  // Per-fabric test report — own brand sees, other brand denied.
  {
    name: "Brand A test report — brand A user",
    doc: { audience: ["BRAND", "FACTORY", "LAB"], restrictedToBrandId: "brand-A" },
    user: brand_A,
    expect: "ALLOW",
  },
  {
    name: "Brand A test report — brand B mgr (DENY — cross-brand)",
    doc: { audience: ["BRAND", "FACTORY", "LAB"], restrictedToBrandId: "brand-A" },
    user: brand_B_mgr,
    expect: "DENY",
  },
  // Toxicology — distributor denied.
  {
    name: "Toxicology — distributor (DENY — audience)",
    doc: { audience: ["BRAND_MANAGER", "LAB", "ADMIN"] },
    user: distributor,
    expect: "DENY",
  },
  // FUZE-only chemistry — EXCERPT for brand mgr, ALLOW for admin.
  {
    name: "Chemistry detail — brand mgr (EXCERPT)",
    doc: { audience: ["BRAND_MANAGER", "EMPLOYEE", "ADMIN"], category: "fuze_ip" },
    user: brand_A_mgr,
    expect: "EXCERPT",
  },
  {
    name: "Chemistry detail — employee (ALLOW)",
    doc: { audience: ["EMPLOYEE", "ADMIN"], category: "fuze_ip" },
    user: employee,
    expect: "ALLOW",
  },
  // Lab accreditation — own lab sees, factory sees public.
  {
    name: "Lab Z accreditation — lab Z user",
    doc: { audience: ["LAB"], restrictedToLabId: "lab-Z" },
    user: lab_Z,
    expect: "ALLOW",
  },
  {
    name: "Lab Z accreditation — different lab user (DENY)",
    doc: { audience: ["LAB"], restrictedToLabId: "lab-Z" },
    user: { id: "uX", role: "LAB_USER", labId: "lab-OTHER" },
    expect: "DENY",
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const got = canViewDocument(c.doc, c.user);
  if (got === c.expect) {
    pass++;
    console.log(`  ✓ ${c.name}`);
  } else {
    fail++;
    console.error(`  ✗ ${c.name} — expected ${c.expect}, got ${got}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed (${cases.length} total)`);
if (fail > 0) process.exit(1);
