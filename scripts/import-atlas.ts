#!/usr/bin/env tsx
/**
 * FUZE Atlas — Full Data Import (v2)
 *
 * Imports all 12 CSV files from data/csv/ into the expanded Prisma schema.
 * Order: users → labs → distributors → factories → brands → brand↔factory links
 *        → fabrics+submissions → test reports → notes
 *
 * Run: npx tsx scripts/import-atlas.ts
 * Requires: DATABASE_URL in .env
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

function filePath(name: string) {
  return path.join(process.cwd(), "data", "csv", name);
}

function exists(name: string) {
  return fs.existsSync(filePath(name));
}

type Row = Record<string, string>;

function readCsv(name: string): Row[] {
  const raw = fs.readFileSync(filePath(name), "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row: Row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    // For fabricdatabase.csv — unnamed columns beyond the header count
    if (vals.length > headers.length) {
      for (let i = headers.length; i < vals.length; i++) {
        row[`_col${i}`] = vals[i] ?? "";
      }
    }
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function clean(s: any): string {
  if (s == null) return "";
  return String(s).trim();
}

function cleanOrNull(s: any): string | null {
  const v = clean(s);
  return v === "" ? null : v;
}

function asInt(s: any): number | null {
  const n = parseInt(clean(s), 10);
  return isNaN(n) ? null : n;
}

function asFloat(s: any): number | null {
  const v = clean(s).replace("%", "").replace(",", "");
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function asBool(s: any): boolean | null {
  const v = clean(s).toLowerCase();
  if (v === "yes" || v === "true" || v === "1") return true;
  if (v === "no" || v === "false" || v === "0") return false;
  return null;
}

function asDate(s: any): Date | null {
  const v = clean(s);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Map pipeline stage strings from brands.csv to enum values */
function mapPipelineStage(status: string): string {
  const s = clean(status).toLowerCase();
  if (s.includes("1") || s.includes("lead")) return "LEAD";
  if (s.includes("2") || s.includes("presentation")) return "PRESENTATION";
  if (s.includes("3") || s.includes("brand test")) return "BRAND_TESTING";
  if (s.includes("4") || s.includes("factory onboard")) return "FACTORY_ONBOARDING";
  if (s.includes("5") || s.includes("factory test")) return "FACTORY_TESTING";
  if (s.includes("6") || s.includes("production")) return "PRODUCTION";
  if (s.includes("7") || s.includes("brand expansion") || s.includes("expansion")) return "BRAND_EXPANSION";
  if (s.includes("archive")) return "ARCHIVE";
  if (s.includes("customer") || s.includes("won")) return "CUSTOMER_WON";
  return "LEAD"; // default
}

/** Map user role strings from CSVs to enum values */
function mapUserRole(role: string): string {
  const r = clean(role).toLowerCase();
  if (r.includes("admin")) return "ADMIN";
  if (r.includes("sales manager") || r.includes("salesmanager")) return "SALES_MANAGER";
  if (r.includes("sales rep") || r.includes("salesrep")) return "SALES_REP";
  if (r.includes("fabric")) return "FABRIC_MANAGER";
  if (r.includes("testing")) return "TESTING_MANAGER";
  if (r.includes("factory")) return "FACTORY_MANAGER";
  return "EMPLOYEE";
}

/** Determine test type from test method string */
function mapTestType(method: string): string {
  const m = clean(method).toUpperCase();
  if (m.includes("ICP")) return "ICP";
  if (m.includes("AATCC 100") || m.includes("AATCC 147") || m.includes("ASTM E2149") || m.includes("E2180")) return "ANTIBACTERIAL";
  if (m.includes("ASTM G21") || m.includes("AATCC 30")) return "FUNGAL";
  if (m.includes("AATCC 16") || m.includes("UV")) return "UV";
  if (m.includes("ODOR") || m.includes("COD")) return "ODOR";
  return "OTHER";
}

// ───────────────────────────────────────────────
// Caches for deduplication
// ───────────────────────────────────────────────

const brandCache = new Map<string, string>(); // name → id
const factoryCache = new Map<string, string>(); // name → id
const labCache = new Map<string, string>(); // name → id
const distributorCache = new Map<string, string>(); // name → id
const userCache = new Map<string, string>(); // email → id
const fabricCache = new Map<number, string>(); // fuzeNumber → id
const submissionCache = new Map<number, string>(); // fuzeNumber → submission id

// ───────────────────────────────────────────────
// Entity creation functions
// ───────────────────────────────────────────────

async function getOrCreateUser(name: string, email: string, role: string, extra: any = {}) {
  const e = clean(email).toLowerCase();
  if (!e) return null;
  if (userCache.has(e)) return userCache.get(e)!;

  const existing = await prisma.user.findUnique({ where: { email: e } });
  if (existing) {
    userCache.set(e, existing.id);
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      name: clean(name),
      email: e,
      role: mapUserRole(role) as any,
      status: clean(extra.status || "active").toUpperCase() === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      ...extra.salesManagerId ? { salesManagerId: extra.salesManagerId } : {},
    },
  });
  userCache.set(e, user.id);
  return user.id;
}

async function getOrCreateBrand(nameRaw: string, row: Row) {
  const name = clean(nameRaw);
  if (!name) return null;
  if (brandCache.has(name)) return brandCache.get(name)!;

  const existing = await prisma.brand.findUnique({ where: { name } });
  if (existing) {
    brandCache.set(name, existing.id);
    return existing.id;
  }

  const brand = await prisma.brand.create({
    data: {
      name,
      pipelineStage: mapPipelineStage(row["Status"] || "") as any,
      customerType: cleanOrNull(row["Customer Type"]),
      leadReferralSource: cleanOrNull(row["Lead Referral Source"]),
      dateOfInitialContact: asDate(row["Date of Initial Contact"]),
      website: cleanOrNull(row["Website"]),
      linkedInProfile: cleanOrNull(row["LinkedIn Profile"]),
      backgroundInfo: cleanOrNull(row["Background Info"]),
      projectType: cleanOrNull(row["Project Type"]),
      projectDescription: cleanOrNull(row["Project Description"]),
      presentationDate: asDate(row["Presentation Date"]),
      forecast: cleanOrNull(row["Forecast"]),
      deliverables: cleanOrNull(row["Deliverables"]),
      knackId: cleanOrNull(row["Record ID"]),
      raw: row as any,
    },
  });
  brandCache.set(name, brand.id);

  // Create contact if we have contact info
  const firstName = cleanOrNull(row["Contact : First"]);
  const lastName = cleanOrNull(row["Contact : Last"]);
  if (firstName || lastName) {
    await prisma.contact.create({
      data: {
        brandId: brand.id,
        title: cleanOrNull(row["Contact : Title"] || row["Title"]),
        firstName,
        middleName: cleanOrNull(row["Contact : Middle"]),
        lastName,
        name: cleanOrNull(row["Contact"]),
        email: cleanOrNull(row["Email"]),
        phone: cleanOrNull(row["Phone"]),
        address: [
          clean(row["Address : Street 1"]),
          clean(row["Address : Street 2"]),
          clean(row["Address : City"]),
          clean(row["Address : State"]),
          clean(row["Address : Zip"]),
          clean(row["Address : Country"]),
        ].filter(Boolean).join(", ") || null,
      },
    });
  }

  return brand.id;
}

async function getOrCreateFactory(nameRaw: string, row: Row) {
  const name = clean(nameRaw);
  if (!name) return null;
  if (factoryCache.has(name)) return factoryCache.get(name)!;

  const existing = await prisma.factory.findFirst({ where: { name } });
  if (existing) {
    factoryCache.set(name, existing.id);
    return existing.id;
  }

  const factory = await prisma.factory.create({
    data: {
      name,
      chineseName: cleanOrNull(row["Chinese Company Name"]),
      millType: cleanOrNull(row["Texile Mill type"]), // Note: CSV has typo "Texile"
      specialty: cleanOrNull(row["Specialty"]),
      purchasing: cleanOrNull(row["Purchasing"]),
      annualSales: cleanOrNull(row["Annual Sales"]),
      country: cleanOrNull(row["Address : Country"] || row["Country Map"]),
      secondaryCountry: cleanOrNull(row["Secondary Country"]),
      address: [
        clean(row["Address : Street 1"] || ""),
        clean(row["Address : Street 2"] || ""),
        clean(row["Address : City"] || ""),
        clean(row["Address : State"] || ""),
        clean(row["Address : Zip"] || ""),
      ].filter(Boolean).join(", ") || null,
      development: cleanOrNull(row["Development"]),
      presentationComplete: asBool(row["Presentation Complete"]),
      customerType: cleanOrNull(row["Customer Type"]),
      brandNominated: cleanOrNull(row["Brand Nominated"]),
      knackId: cleanOrNull(row["Record ID"]),
      raw: row as any,
    },
  });
  factoryCache.set(name, factory.id);

  // Create contact if available
  const firstName = cleanOrNull(row["Contact : First"]);
  const lastName = cleanOrNull(row["Contact : Last"]);
  if (firstName || lastName) {
    await prisma.contact.create({
      data: {
        factoryId: factory.id,
        title: cleanOrNull(row["Contact : Title"] || row["Title"]),
        firstName,
        middleName: cleanOrNull(row["Contact : Middle"]),
        lastName,
        name: cleanOrNull(row["Contact"]),
        email: cleanOrNull(row["Email"]),
        phone: cleanOrNull(row["Phone"]),
      },
    });
  }

  return factory.id;
}

async function getOrCreateLab(nameRaw: string, raw?: any) {
  const name = clean(nameRaw);
  if (!name) return null;
  if (labCache.has(name)) return labCache.get(name)!;

  const lab = await prisma.lab.upsert({
    where: { name },
    create: { name, raw: raw ?? {}, knackId: cleanOrNull(raw?.["Record ID"]) },
    update: {},
  });
  labCache.set(name, lab.id);
  return lab.id;
}

async function getOrCreateDistributor(nameRaw: string, row: Row) {
  const name = clean(nameRaw);
  if (!name) return null;
  if (distributorCache.has(name)) return distributorCache.get(name)!;

  const existing = await prisma.distributor.findFirst({ where: { name } });
  if (existing) {
    distributorCache.set(name, existing.id);
    return existing.id;
  }

  const dist = await prisma.distributor.create({
    data: {
      name,
      chineseName: cleanOrNull(row["Chinese Company Name"]),
      specialty: cleanOrNull(row["Specialty"]),
      agentForFuze: cleanOrNull(row["Agent for FUZE"]),
      annualSales: cleanOrNull(row["Annual Sales"]),
      country: cleanOrNull(row["Address : Country"] || row["Country"]),
      knackId: cleanOrNull(row["Record ID"]),
      raw: row as any,
    },
  });
  distributorCache.set(name, dist.id);
  return dist.id;
}

async function createSourceRecord(opts: {
  sourceTable: string;
  raw: any;
  sourceRecordId?: string | null;
  brandId?: string | null;
  factoryId?: string | null;
  labId?: string | null;
  submissionId?: string | null;
  testRunId?: string | null;
  distributorId?: string | null;
}) {
  return prisma.sourceRecord.create({
    data: {
      sourceSystem: "CSV",
      sourceTable: opts.sourceTable,
      sourceRecordId: opts.sourceRecordId ?? null,
      raw: opts.raw,
      brandId: opts.brandId ?? null,
      factoryId: opts.factoryId ?? null,
      labId: opts.labId ?? null,
      submissionId: opts.submissionId ?? null,
      testRunId: opts.testRunId ?? null,
      distributorId: opts.distributorId ?? null,
    },
  });
}

async function createUrlDoc(params: {
  url: string | null;
  kind: string;
  submissionId?: string | null;
  testRunId?: string | null;
  sowId?: string | null;
}) {
  if (!params.url) return null;
  return prisma.document.create({
    data: {
      kind: params.kind as any,
      url: params.url,
      submissionId: params.submissionId ?? null,
      testRunId: params.testRunId ?? null,
      sowId: params.sowId ?? null,
    },
  });
}

// ───────────────────────────────────────────────
// Fabric content parser
// ───────────────────────────────────────────────

function parseFabricContents(row: Row): { material: string; percent: number | null; rawText: string }[] {
  const contents: { material: string; percent: number | null; rawText: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const mat = clean(row[`Fabric Content #${i}`]);
    const pct = asFloat(row[`% Content ${i}`]);
    if (mat) {
      contents.push({ material: mat, percent: pct, rawText: `${mat} ${pct ?? ""}%`.trim() });
    }
  }
  return contents;
}

// ───────────────────────────────────────────────
// MAIN IMPORT
// ───────────────────────────────────────────────

async function main() {
  console.log("FUZE Atlas import v2 starting...");
  console.log("Data files:", fs.readdirSync(path.join(process.cwd(), "data", "csv")));

  // Clear existing data (fresh import)
  console.log("Clearing existing data...");
  await prisma.sourceRecord.deleteMany();
  await prisma.document.deleteMany();
  await prisma.icpResult.deleteMany();
  await prisma.antibacterialResult.deleteMany();
  await prisma.fungalResult.deleteMany();
  await prisma.odorResult.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.fabricSubmission.deleteMany();
  await prisma.fabricContent.deleteMany();
  await prisma.fabric.deleteMany();
  await prisma.sOWMilestone.deleteMany();
  await prisma.sOW.deleteMany();
  await prisma.note.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.brandFactory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.distributor.deleteMany();
  await prisma.factory.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.lab.deleteMany();
  await prisma.materialAlias.deleteMany();
  console.log("Data cleared.");

  // ─── 0. Seed material aliases ──────────────
  console.log("Seeding material aliases...");
  const aliases = [
    { alias: "elastane", canonicalName: "Spandex" },
    { alias: "spandex", canonicalName: "Spandex" },
    { alias: "lycra", canonicalName: "Spandex" },
    { alias: "nylon", canonicalName: "Nylon" },
    { alias: "polyamide", canonicalName: "Nylon" },
    { alias: "pet", canonicalName: "Polyester" },
    { alias: "polyester", canonicalName: "Polyester" },
    { alias: "cotton", canonicalName: "Cotton" },
    { alias: "wool", canonicalName: "Wool" },
    { alias: "silk", canonicalName: "Silk" },
    { alias: "rayon", canonicalName: "Rayon" },
    { alias: "viscose", canonicalName: "Rayon" },
    { alias: "modal", canonicalName: "Modal" },
    { alias: "tencel", canonicalName: "Lyocell" },
    { alias: "lyocell", canonicalName: "Lyocell" },
    { alias: "acrylic", canonicalName: "Acrylic" },
    { alias: "polypropylene", canonicalName: "Polypropylene" },
    { alias: "pp", canonicalName: "Polypropylene" },
    { alias: "linen", canonicalName: "Linen" },
    { alias: "hemp", canonicalName: "Hemp" },
  ];
  for (const a of aliases) {
    await prisma.materialAlias.create({ data: a });
  }
  console.log(`Material aliases: ${aliases.length}`);

  // ─── 1. Import Users ──────────────────────
  console.log("\n--- Importing Users ---");

  // Sales managers first (so we can link reps to them)
  if (exists("salesmanagers.csv")) {
    const rows = readCsv("salesmanagers.csv");
    console.log(`Sales Managers: ${rows.length}`);
    for (const r of rows) {
      await getOrCreateUser(
        clean(r["Name"]),
        clean(r["Email"]),
        "SALES_MANAGER",
        { status: r["User Status"] }
      );
    }
  }

  // Sales reps (link to sales manager)
  if (exists("salesreps.csv")) {
    const rows = readCsv("salesreps.csv");
    console.log(`Sales Reps: ${rows.length}`);
    for (const r of rows) {
      const managerName = clean(r["Sales Manager"]);
      let salesManagerId: string | undefined;
      if (managerName) {
        // Look up manager by name
        const mgr = await prisma.user.findFirst({
          where: { name: managerName, role: "SALES_MANAGER" },
        });
        if (mgr) salesManagerId = mgr.id;
      }
      await getOrCreateUser(
        clean(r["Name"]),
        clean(r["Email"]),
        "SALES_REP",
        { status: r["User Status"], salesManagerId }
      );
    }
  }

  // Fabric managers
  if (exists("fabricmanager.csv")) {
    const rows = readCsv("fabricmanager.csv");
    console.log(`Fabric Managers: ${rows.length}`);
    for (const r of rows) {
      await getOrCreateUser(clean(r["Name"]), clean(r["Email"]), "FABRIC_MANAGER", { status: r["User Status"] });
    }
  }

  // Factory managers
  if (exists("factorymanager.csv")) {
    const rows = readCsv("factorymanager.csv");
    console.log(`Factory Managers: ${rows.length}`);
    for (const r of rows) {
      await getOrCreateUser(clean(r["Name"]), clean(r["Email"]), "FACTORY_MANAGER", { status: r["User Status"] });
    }
  }

  // Testing managers
  if (exists("testingmanager.csv")) {
    const rows = readCsv("testingmanager.csv");
    console.log(`Testing Managers: ${rows.length}`);
    for (const r of rows) {
      await getOrCreateUser(clean(r["Name"]), clean(r["Email"]), "TESTING_MANAGER", { status: r["User Status"] });
    }
  }

  // ─── 2. Labs ──────────────────────────────
  console.log("\n--- Importing Labs ---");
  if (exists("labratories.csv")) {
    const rows = readCsv("labratories.csv");
    console.log(`Labs: ${rows.length}`);
    for (const r of rows) {
      const labId = await getOrCreateLab(r["Laboratory Name"] || r["Labratory Name"] || "", r);
      if (labId) {
        await createSourceRecord({
          sourceTable: "labratories.csv",
          raw: r,
          sourceRecordId: r["Record ID"],
          labId,
        });
      }
    }
  }

  // ─── 3. Distributors ──────────────────────
  console.log("\n--- Importing Distributors ---");
  if (exists("distributors.csv")) {
    const rows = readCsv("distributors.csv");
    console.log(`Distributors: ${rows.length}`);
    for (const r of rows) {
      const distId = await getOrCreateDistributor(r["Company"] || "", r);
      if (distId) {
        await createSourceRecord({
          sourceTable: "distributors.csv",
          raw: r,
          sourceRecordId: r["Record ID"],
          distributorId: distId,
        });
      }
    }
  }

  // ─── 4. Factories (Textile Mills) ─────────
  console.log("\n--- Importing Factories ---");
  if (exists("textilemills.csv")) {
    const rows = readCsv("textilemills.csv");
    console.log(`Textile Mills: ${rows.length}`);
    for (const r of rows) {
      const factoryId = await getOrCreateFactory(r["Company"] || "", r);
      if (factoryId) {
        // Link sales rep if specified
        const repName = clean(r["Sales Rep"]);
        if (repName) {
          const rep = await prisma.user.findFirst({ where: { name: repName } });
          if (rep) {
            await prisma.factory.update({
              where: { id: factoryId },
              data: { salesRepId: rep.id },
            });
          }
        }
        await createSourceRecord({
          sourceTable: "textilemills.csv",
          raw: r,
          sourceRecordId: r["Record ID"],
          factoryId,
        });
      }
    }
  }

  // ─── 5. Brands ────────────────────────────
  console.log("\n--- Importing Brands ---");
  if (exists("brands.csv")) {
    const rows = readCsv("brands.csv");
    console.log(`Brands: ${rows.length}`);
    for (const r of rows) {
      const brandId = await getOrCreateBrand(r["Company"] || "", r);
      if (brandId) {
        // Link sales rep
        const repName = clean(r["Sales Rep"]);
        if (repName) {
          const rep = await prisma.user.findFirst({ where: { name: repName } });
          if (rep) {
            await prisma.brand.update({
              where: { id: brandId },
              data: { salesRepId: rep.id },
            });
          }
        }
        await createSourceRecord({
          sourceTable: "brands.csv",
          raw: r,
          sourceRecordId: r["Record ID"],
          brandId,
        });
      }
    }
  }

  // ─── 6. Fabrics + Submissions ─────────────
  console.log("\n--- Importing Fabrics ---");
  // Track brand↔factory pairs for many-to-many
  const brandFactoryPairs = new Set<string>();

  if (exists("fabricdatabase.csv")) {
    const rows = readCsv("fabricdatabase.csv");
    console.log(`Fabric records: ${rows.length}`);

    for (const r of rows) {
      const fuzeNum = asInt(r["FUZE Fabric #"]);
      const brandName = clean(r["Brand"]);
      const factoryName = clean(r["Textile Mill (Treatment)"] || r["Textile Mill"]);

      // Get or create brand and factory
      const brandId = brandName ? await getOrCreateBrand(brandName, r) : null;
      const factoryId = factoryName ? await getOrCreateFactory(factoryName, {}) : null;

      // Track brand↔factory relationship
      if (brandId && factoryId) {
        brandFactoryPairs.add(`${brandId}::${factoryId}`);
      }

      // Create fabric
      const fabric = await prisma.fabric.create({
        data: {
          fuzeNumber: fuzeNum,
          customerCode: cleanOrNull(r["Customer Fabric Code"]),
          factoryCode: cleanOrNull(r["Factory Fabric Code"]),
          construction: cleanOrNull(r["Fabric Construction Description"]),
          color: cleanOrNull(r["Fabric Color"]),
          weightGsm: asFloat(r["Weight (gsm)"] || r["Weight"]),
          widthInches: asFloat(r["Full Width"]),
          yarnType: cleanOrNull(r["Yarn / Filament"]),
          finishNote: cleanOrNull(r["Fabric Finish Note"]),
          note: cleanOrNull(r["Note"]),
          brandId,
          factoryId,
          raw: r as any,
        },
      });

      if (fuzeNum) fabricCache.set(fuzeNum, fabric.id);

      // Create fabric contents
      const contents = parseFabricContents(r);
      for (const c of contents) {
        await prisma.fabricContent.create({
          data: {
            fabricId: fabric.id,
            material: c.material,
            percent: c.percent,
            rawText: c.rawText,
          },
        });
      }

      // Create submission with the unnamed columns mapped
      // Col31=empty, Col32-38=Yes/No booleans, Col39=Status, Col40=Program,
      // Col41=DevStage, Col42=TestStatus, Col43-49=counts, Col50=progress count,
      // Col51=progress%, Col52=progress int, Col53=Record ID
      const submission = await prisma.fabricSubmission.create({
        data: {
          fabricId: fabric.id,
          brandId,
          factoryId,
          fuzeFabricNumber: fuzeNum,
          customerFabricCode: cleanOrNull(r["Customer Fabric Code"]),
          factoryFabricCode: cleanOrNull(r["Factory Fabric Code"]),
          applicationMethod: cleanOrNull(r["Application Method"]),
          applicationRecipeRaw: cleanOrNull(r["Application Recipe"]),
          treatmentLocation: cleanOrNull(r["Fuze Treatment Location"] || r["Fuze treatment Location"]),
          applicationDate: asDate(r["Fuze Application Date"] || r["Fuze application Date"]),
          washTarget: asInt(r["Wash"]),
          // Unnamed columns — mapped from Spanx reference analysis
          status: cleanOrNull(r["_col39"]),
          programName: cleanOrNull(r["_col40"]),
          developmentStage: cleanOrNull(r["_col41"]),
          testStatus: cleanOrNull(r["_col42"]),
          // ICP flags from Col32-34
          icpSent: asBool(r["_col32"]),
          icpReceived: asBool(r["_col33"]),
          icpPassed: asBool(r["_col34"]),
          // AB flags from Col35-37
          abSent: asBool(r["_col35"]),
          abReceived: asBool(r["_col36"]),
          abPassed: asBool(r["_col37"]),
          // Progress
          progressPercent: asFloat(r["_col51"]),
          raw: r as any,
        },
      });

      if (fuzeNum) submissionCache.set(fuzeNum, submission.id);

      // Attach docs
      await createUrlDoc({
        url: cleanOrNull(r["Fabric Submission Document : URL"]),
        kind: "SUBMISSION_DOC",
        submissionId: submission.id,
      });
      await createUrlDoc({
        url: cleanOrNull(r["Fabric Submission Image : URL"]),
        kind: "IMAGE",
        submissionId: submission.id,
      });

      await createSourceRecord({
        sourceTable: "fabricdatabase.csv",
        raw: r,
        sourceRecordId: cleanOrNull(r["_col53"]) || cleanOrNull(r["Record ID"]),
        brandId,
        factoryId,
        submissionId: submission.id,
      });
    }
  }

  // ─── 6b. Create Brand↔Factory relationships ──
  console.log(`\nCreating ${brandFactoryPairs.size} brand↔factory relationships...`);
  for (const pair of brandFactoryPairs) {
    const [brandId, factoryId] = pair.split("::");
    try {
      await prisma.brandFactory.create({
        data: { brandId, factoryId },
      });
    } catch (e: any) {
      // Ignore duplicate constraint violations
      if (!e.message?.includes("Unique constraint")) throw e;
    }
  }

  // ─── 7. Test Reports ──────────────────────
  console.log("\n--- Importing Test Reports ---");
  if (exists("testreports.csv")) {
    const rows = readCsv("testreports.csv");
    console.log(`Test Reports: ${rows.length}`);

    for (const r of rows) {
      const fuzeNum = asInt(r["Fuze Fabric Number"]);
      const brandName = clean(r["Brand"]);
      const factoryName = clean(r["Textile Mill"]);
      const labName = clean(r["Labratory"] || r["Testing Labratory"]);

      // Resolve foreign keys
      const brandId = brandName ? await getOrCreateBrand(brandName, {}) : null;
      const factoryId = factoryName ? await getOrCreateFactory(factoryName, {}) : null;
      const labId = labName ? await getOrCreateLab(labName) : null;
      const submissionId = fuzeNum ? submissionCache.get(fuzeNum) ?? null : null;

      // Determine test type from method
      const methodStd = clean(r["Test Method (dropdown)"] || r["Test Method"]);
      const testType = mapTestType(methodStd);

      const testRun = await prisma.testRun.create({
        data: {
          submissionId,
          labId,
          testNumber: asInt(r["Test Number"]),
          testType: testType as any,
          testMethodRaw: cleanOrNull(r["Test Method"]),
          testMethodStd: cleanOrNull(r["Test Method (dropdown)"]) || cleanOrNull(r["Test Method"]),
          testReportNumber: cleanOrNull(r["Test Report #"]),
          fuzeInternalReportNumber: cleanOrNull(r["Fuze Internal Report #"]),
          postWashReportNumber: cleanOrNull(r["Post Wash Report #"]),
          testDate: asDate(r["Date"]),
          postWashDate: asDate(r["Date (post wash)"]),
          washCount: asInt(r["Number of Washes"]),
          washLabelRaw: cleanOrNull(r["Wash"]),
          machineType: cleanOrNull(r["Machine Type"]),
          testedMetal: cleanOrNull(r["Tested Metal"]),
          agSerialNumber: cleanOrNull(r["Ag Serial #"]),
          auSerialNumber: cleanOrNull(r["Au Serial #"]),
          fungalSerialNumber: cleanOrNull(r["Fungal Serial #"]),
          raw: r as any,
        },
      });

      // Create ICP result if we have values
      const agVal = asFloat(r["ICP (Ag) Result"]);
      const auVal = asFloat(r["ICP (Au) Result"]);
      if (agVal !== null || auVal !== null) {
        await prisma.icpResult.create({
          data: {
            testRunId: testRun.id,
            agValue: agVal,
            auValue: auVal,
            agRaw: cleanOrNull(r["ICP (Ag) Result"]),
            auRaw: cleanOrNull(r["ICP (Au) Result"]),
            unit: "ppm",
          },
        });
      }

      // Create antibacterial result if we have values
      const org1 = cleanOrNull(r["Tested Bacteria #1"]);
      const org2 = cleanOrNull(r["Tested Bacteria #2"]);
      const res1 = cleanOrNull(r["Antimicrobial Result #1"]);
      const res2 = cleanOrNull(r["Antibacterial Result #2"]);
      if (org1 || org2 || res1 || res2) {
        await prisma.antibacterialResult.create({
          data: {
            testRunId: testRun.id,
            organism1: org1,
            organism2: org2,
            result1: asFloat(r["Antimicrobial Result #1"]),
            result2: asFloat(r["Antibacterial Result #2"]),
            organism1Raw: org1,
            organism2Raw: org2,
            result1Raw: res1,
            result2Raw: res2,
          },
        });
      }

      // Create fungal result if present
      const fungalResult = cleanOrNull(r["Written Result (Fungal Testing)"]);
      if (fungalResult) {
        await prisma.fungalResult.create({
          data: {
            testRunId: testRun.id,
            writtenResult: fungalResult,
            raw: fungalResult,
          },
        });
      }

      // Create odor result if present
      const odorResult = cleanOrNull(r["Tested Odor"]);
      if (odorResult) {
        await prisma.odorResult.create({
          data: {
            testRunId: testRun.id,
            testedOdor: odorResult,
            result: odorResult,
          },
        });
      }

      // Attach report docs (up to 4 reports + 1 image)
      for (const n of [1, 2, 3, 4] as const) {
        await createUrlDoc({
          url: cleanOrNull(r[`Report ${n} : URL`]),
          kind: "REPORT",
          testRunId: testRun.id,
        });
      }
      await createUrlDoc({
        url: cleanOrNull(r["Image : URL"]),
        kind: "IMAGE",
        testRunId: testRun.id,
      });

      await createSourceRecord({
        sourceTable: "testreports.csv",
        raw: r,
        sourceRecordId: cleanOrNull(r["Record ID"]),
        brandId,
        factoryId,
        labId,
        submissionId,
        testRunId: testRun.id,
      });
    }
  }

  // ─── 8. Notes ─────────────────────────────
  console.log("\n--- Importing Notes ---");
  if (exists("notes.csv")) {
    const rows = readCsv("notes.csv");
    console.log(`Notes: ${rows.length}`);
    for (const r of rows) {
      const content = clean(r["Notes"]);
      if (!content) continue;

      // Try to find the sales rep user
      const repName = clean(r["Sales Rep"]);
      let userId: string | null = null;
      if (repName) {
        const rep = await prisma.user.findFirst({ where: { name: repName } });
        if (rep) userId = rep.id;
      }

      await prisma.note.create({
        data: {
          date: asDate(r["Date"]),
          content,
          noteType: cleanOrNull(r["Task / Meeting"]),
          contactName: cleanOrNull(r["Contact"]),
          taskStatus: cleanOrNull(r["Task Status"]),
          userId,
        },
      });

      await createSourceRecord({
        sourceTable: "notes.csv",
        raw: r,
        sourceRecordId: cleanOrNull(r["Record ID"]),
      });
    }
  }

  // ─── Summary ──────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    brands: await prisma.brand.count(),
    factories: await prisma.factory.count(),
    distributors: await prisma.distributor.count(),
    labs: await prisma.lab.count(),
    fabrics: await prisma.fabric.count(),
    fabricContents: await prisma.fabricContent.count(),
    submissions: await prisma.fabricSubmission.count(),
    testRuns: await prisma.testRun.count(),
    icpResults: await prisma.icpResult.count(),
    abResults: await prisma.antibacterialResult.count(),
    fungalResults: await prisma.fungalResult.count(),
    odorResults: await prisma.odorResult.count(),
    contacts: await prisma.contact.count(),
    brandFactories: await prisma.brandFactory.count(),
    documents: await prisma.document.count(),
    notes: await prisma.note.count(),
    sourceRecords: await prisma.sourceRecord.count(),
    materialAliases: await prisma.materialAlias.count(),
  };

  console.log("\n=== FUZE Atlas Import Complete ===");
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
