/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

type Row = Record<string, string>;

function filePath(name: string) {
  return path.join(process.cwd(), "data", name);
}

function exists(name: string) {
  return fs.existsSync(filePath(name));
}

function readCsv(name: string): Row[] {
  const fp = filePath(name);
  const raw = fs.readFileSync(fp, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row: Row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cols[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

// Handles commas inside quotes + escaped quotes ("")
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function clean(s: any): string {
  return String(s ?? "").trim();
}

function asInt(s: any): number | null {
  const t = clean(s).replace(/[^\d-]/g, "");
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function asFloat(s: any): number | null {
  const t = clean(s).replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function asBool(s: any): boolean | null {
  const t = clean(s).toLowerCase();
  if (!t) return null;
  if (["1", "true", "yes", "y", "sent", "passed", "rcvd", "received"].includes(t)) return true;
  if (["0", "false", "no", "n"].includes(t)) return false;
  return null;
}

function asDate(s: any): Date | null {
  const t = clean(s);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getOrCreateBrand(nameRaw: string, raw?: any) {
  const name = clean(nameRaw);
  if (!name) return null;
  const existing = await prisma.brand.findUnique({ where: { name } });
  if (existing) return existing;
  return prisma.brand.create({ data: { name, raw: raw ?? {} } });
}

async function getOrCreateLab(nameRaw: string, raw?: any) {
  const name = clean(nameRaw);
  if (!name) return null;
  return prisma.lab.upsert({
    where: { name },
    update: { raw: raw ?? {} },
    create: { name, raw: raw ?? {} },
  });
}

async function getOrCreateFactory(nameRaw: string, raw?: any) {
  const name = clean(nameRaw);
  if (!name) return null;

  // Factory isn't unique in schema; best-effort dedupe by name.
  const existing = await prisma.factory.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.factory.create({ data: { name, raw: raw ?? {} } });
}

async function getOrCreateDistributor(nameRaw: string, raw?: any) {
  const name = clean(nameRaw);
  if (!name) return null;
  // Not unique; best-effort dedupe by name.
  const existing = await prisma.distributor.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.distributor.create({ data: { name, raw: raw ?? {} } });
}

async function createSourceRecord(opts: {
  sourceTable: string;
  recordId?: string | null;
  raw: any;
  brandId?: string | null;
  factoryId?: string | null;
  labId?: string | null;
  submissionId?: string | null;
  testRunId?: string | null;
}) {
  await prisma.sourceRecord.create({
    data: {
      sourceSystem: "CSV",
      sourceTable: opts.sourceTable,
      sourceRecordId: opts.recordId ?? null,
      raw: opts.raw,
      brandId: opts.brandId ?? null,
      factoryId: opts.factoryId ?? null,
      labId: opts.labId ?? null,
      submissionId: opts.submissionId ?? null,
      testRunId: opts.testRunId ?? null,
    },
  });
}

async function createUrlDoc(params: {
  kind: "REPORT" | "IMAGE" | "OTHER";
  url: string;
  filename?: string | null;
  submissionId?: string | null;
  testRunId?: string | null;
  raw?: any;
}) {
  const url = clean(params.url);
  if (!url) return;

  await prisma.document.create({
    data: {
      kind: params.kind,
      url,
      filename: params.filename ?? null,
      submissionId: params.submissionId ?? null,
      testRunId: params.testRunId ?? null,
      raw: params.raw ?? {},
    },
  });
}

async function main() {
  console.log("FUZE Atlas import starting…");
  console.log("Data files:", fs.readdirSync(path.join(process.cwd(), "data")));

  // Build lookup maps for linking TestReports -> Submissions
  const submissionIdByRecordId = new Map<string, string>();
  const submissionIdByFuzeFabricNumber = new Map<number, string>();

  // -------------------------
  // 1) Labs
  // -------------------------
  if (exists("labratories.csv")) {
    const rows = readCsv("labratories.csv");
    console.log(`Labs: ${rows.length}`);
    for (const r of rows) {
      const labName = r["Labratory Name"] || r["Laboratory Name"] || r["Lab"] || "";
      const lab = await getOrCreateLab(labName, r);
      if (!lab) continue;
      await createSourceRecord({
        sourceTable: "labratories.csv",
        recordId: r["Record ID"] || null,
        raw: r,
        labId: lab.id,
      });
    }
  }

  // -------------------------
  // 2) Distributors
  // -------------------------
  if (exists("distributors.csv")) {
    const rows = readCsv("distributors.csv");
    console.log(`Distributors: ${rows.length}`);
    for (const r of rows) {
      const name = r["Company"] || r["Distributor"] || r["Distributor "] || r["Name"] || "";
      const dist = await getOrCreateDistributor(name, r);
      if (!dist) continue;

      await createSourceRecord({
        sourceTable: "distributors.csv",
        recordId: r["Record ID"] || null,
        raw: r,
      });
    }
  }

  // -------------------------
  // 3) Textile mills (Factories)
  // -------------------------
  if (exists("textilemills.csv")) {
    const rows = readCsv("textilemills.csv");
    console.log(`Textile mills: ${rows.length}`);
    for (const r of rows) {
      const name = r["Company"] || r["Textile Mill"] || r["Name"] || "";
      const factory = await getOrCreateFactory(name, r);
      if (!factory) continue;

      await createSourceRecord({
        sourceTable: "textilemills.csv",
        recordId: r["Record ID"] || null,
        raw: r,
        factoryId: factory.id,
      });
    }
  }

  // -------------------------
  // 4) Brands (best-effort; schema expects unique name)
  // -------------------------
  if (exists("brands.csv")) {
    const rows = readCsv("brands.csv");
    console.log(`Brands: ${rows.length}`);
    for (const r of rows) {
      const name = r["Brand"] || r["Brand Name"] || r["Name"] || r["Company"] || "";
      const brand = await getOrCreateBrand(name, r);
      if (!brand) continue;

      await createSourceRecord({
        sourceTable: "brands.csv",
        recordId: r["Record ID"] || null,
        raw: r,
        brandId: brand.id,
      });
    }
  } else {
    console.log("brands.csv not found (skipping brand table import; will link brands from other CSVs)");
  }

  // -------------------------
  // 5) Fabric Submissions (fabricdatabase.csv)
  // -------------------------
  if (exists("fabricdatabase.csv")) {
    const rows = readCsv("fabricdatabase.csv");
    console.log(`Fabric submissions: ${rows.length}`);

    for (const r of rows) {
      const brandName = r["Brand"] || "";
      const millName = r["Textile Mill"] || r["Textile Mill (Treatment)"] || "";
      const recordId = r["Record ID"] || null;

      const brand = await getOrCreateBrand(brandName, { importedFrom: "fabricdatabase.csv" });
      const factory = await getOrCreateFactory(millName, { importedFrom: "fabricdatabase.csv" });

      // Create a Fabric record (simple: one per submission for now)
      const fabric = await prisma.fabric.create({
        data: {
          construction: r["Fabric Construction Description"] || null,
          color: r["Fabric Color"] || null,
          widthInches: asFloat(r["Full Width"]) ?? null,
          weightGsm: asFloat(r["Weight (gsm)"] || r["Weight\n(gsm) " || "") ?? null,
          raw: r,
        },
      });

      // Fabric contents (up to 3)
      const contents: Array<{ material: string; percent: number | null; rawText: string }> = [];
      for (let i = 1; i <= 3; i++) {
        const mat = clean(r[`Fabric Content #${i}`]);
        const pct = asFloat(r[`% Content ${i}`]);
        if (mat) contents.push({ material: mat, percent: pct, rawText: `${mat} ${pct ?? ""}`.trim() });
      }
      for (const c of contents) {
        await prisma.fabricContent.create({
          data: {
            fabricId: fabric.id,
            material: c.material,
            percent: c.percent,
            rawText: c.rawText || null,
          },
        });
      }

      const submission = await prisma.fabricSubmission.create({
        data: {
          brandId: brand?.id ?? null,
          factoryId: factory?.id ?? null,
          fabricId: fabric.id,

          fuzeFabricNumber: asInt(r["FUZE Fabric #"]),
          washTarget: asInt(r["Wash"]),

          customerFabricCode: r["Customer Fabric Code"] || null,
          factoryFabricCode: r["Factory Fabric Code"] || null,

          applicationMethod: r["Application Method"] || null,
          applicationRecipeRaw: r["Application Recipe"] || null,
          padRecipeRaw: r["Pad Recipe"] || null,

          treatmentLocation: r["Fuze Treatment Location"] || r["Fuze treatment Location"] || null,
          applicationDate: asDate(r["Fuze Application Date"] || r["Fuze application Date"]) ?? null,

          icpSent: asBool(r["ICP Sent"]),
          icpReceived: asBool(r["ICP RCVD"]),
          icpPassed: asBool(r["ICP Passed"]),
          abSent: asBool(r["AMB Sent"]),
          abReceived: asBool(r["AMB RCVD"]),
          abPassed: asBool(r["AMB Pass"]),

          category: r["Category"] || null,
          programName: r["Program Name"] || null,

          raw: r,
        },
      });

      // Document URLs from Fabric Submission Document/Image
      const docUrl = r["Fabric Submission Document : URL"] || "";
      const imgUrl = r["Fabric Submission Image : URL"] || "";
      if (docUrl) {
        await createUrlDoc({
          kind: "REPORT",
          url: docUrl,
          filename: clean(r["Fabric Submission Document"]) || "Fabric Submission Document",
          submissionId: submission.id,
          raw: { source: "fabricdatabase.csv" },
        });
      }
      if (imgUrl) {
        await createUrlDoc({
          kind: "IMAGE",
          url: imgUrl,
          filename: clean(r["Fabric Submission Image"]) || "Fabric Submission Image",
          submissionId: submission.id,
          raw: { source: "fabricdatabase.csv" },
        });
      }

      await createSourceRecord({
        sourceTable: "fabricdatabase.csv",
        recordId,
        raw: r,
        brandId: brand?.id ?? null,
        factoryId: factory?.id ?? null,
        submissionId: submission.id,
      });

      // Build linking maps
      if (recordId) submissionIdByRecordId.set(recordId, submission.id);
      if (submission.fuzeFabricNumber != null) submissionIdByFuzeFabricNumber.set(submission.fuzeFabricNumber, submission.id);
    }
  }

  // -------------------------
  // 6) Notes (stored as SourceRecord for now)
  // -------------------------
  if (exists("notes.csv")) {
    const rows = readCsv("notes.csv");
    console.log(`Notes: ${rows.length}`);
    for (const r of rows) {
      await createSourceRecord({
        sourceTable: "notes.csv",
        recordId: r["Record ID"] || null,
        raw: r,
      });
    }
  }

  // -------------------------
  // 7) Test Reports (testreports.csv)
  // -------------------------
  if (exists("testreports.csv")) {
    const rows = readCsv("testreports.csv");
    console.log(`Test reports: ${rows.length}`);

    for (const r of rows) {
      const recordId = r["Record ID"] || null;

      const brand = await getOrCreateBrand(r["Brand"] || "", { importedFrom: "testreports.csv" });
      const factory = await getOrCreateFactory(r["Textile Mill"] || "", { importedFrom: "testreports.csv" });

      const lab = await getOrCreateLab(r["Labratory"] || r["Testing Labratory"] || r["Testing Labratory"] || "", {
        importedFrom: "testreports.csv",
      });

      // Link to a FabricSubmission if possible
      const fabricDbId = clean(r["Fabric Database"]);
      const fuzeNum = asInt(r["Fuze Fabric Number"] || r["Fuze Fabric Number "] || "");
      let submissionId: string | null = null;

      if (fabricDbId && submissionIdByRecordId.has(fabricDbId)) {
        submissionId = submissionIdByRecordId.get(fabricDbId)!;
      } else if (fuzeNum != null && submissionIdByFuzeFabricNumber.has(fuzeNum)) {
        submissionId = submissionIdByFuzeFabricNumber.get(fuzeNum)!;
      }

      const testMethod = r["Test Method"] || r["Test Method (dropdown)"] || null;

      const ag = r["ICP (Ag) Result"] || "";
      const au = r["ICP (Au) Result"] || "";
      const hasIcp = Boolean(clean(ag) || clean(au));

      const testType = hasIcp ? "ICP" : "ANTIBACTERIAL";

      const testRun = await prisma.testRun.create({
        data: {
          submissionId,
          labId: lab?.id ?? null,

          testType,
          testMethodRaw: testMethod,
          testMethodStd: testMethod,
          testReportNumber: r["Test Report #"] || null,

          testDate: asDate(r["Date"]) ?? null,
          postWashDate: asDate(r["Date (post wash)"]) ?? null,

          washCount: asInt(r["Number of Washes"]) ?? asInt(r["Wash"]) ?? null,
          washLabelRaw: r["Wash"] || null,

          machineType: r["Machine Type"] || null,
          testedMetal: r["Tested Metal"] || null,

          raw: r,
        },
      });

      // Results
      if (testType === "ICP") {
        await prisma.icpResult.create({
          data: {
            testRunId: testRun.id,
            agValue: asFloat(ag),
            auValue: asFloat(au),
            agRaw: clean(ag) || null,
            auRaw: clean(au) || null,
            unit: null,
          },
        });
      } else {
        await prisma.antibacterialResult.create({
          data: {
            testRunId: testRun.id,
            organism1: clean(r["Tested Bacteria #1"] || r["Tested Bacteria"] || "") || null,
            organism2: clean(r["Tested Bacteria #2"] || "") || null,
            result1Raw: clean(r["Antimicrobial Result #1"] || "") || null,
            result2Raw: clean(r["Antibacterial Result #2"] || "") || null,
            organism1Raw: r["Tested Bacteria #1"] || r["Tested Bacteria"] || null,
            organism2Raw: r["Tested Bacteria #2"] || null,
          },
        });
      }

      // Attach report/image URLs as Documents
      for (const n of [1, 2, 3, 4] as const) {
        const url = r[`Report ${n} : URL`];
        const name = r[`Report ${n}`];
        if (clean(url)) {
          await createUrlDoc({
            kind: "REPORT",
            url,
            filename: clean(name) || `Report ${n}`,
            testRunId: testRun.id,
            submissionId,
            raw: { source: "testreports.csv", which: `Report ${n}` },
          });
        }
      }
      if (clean(r["Image : URL"])) {
        await createUrlDoc({
          kind: "IMAGE",
          url: r["Image : URL"],
          filename: clean(r["Image"]) || "Image",
          testRunId: testRun.id,
          submissionId,
          raw: { source: "testreports.csv", which: "Image" },
        });
      }

      await createSourceRecord({
        sourceTable: "testreports.csv",
        recordId,
        raw: r,
        brandId: brand?.id ?? null,
        factoryId: factory?.id ?? null,
        labId: lab?.id ?? null,
        submissionId,
        testRunId: testRun.id,
      });
    }
  }

  // Done
  console.log("FUZE Atlas import complete.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
