import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------- CLI ----------------
// Usage:
//   node scripts/seed_fabric_submissions.mjs --file data/csv/fabricdatabase.csv --reset
//
// If --reset is NOT provided, it will NOT delete anything.

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

const FILE_ARG = argValue("--file");
const DO_RESET = process.argv.includes("--reset");

const CSV_PATH = FILE_ARG
  ? path.resolve(process.cwd(), FILE_ARG)
  : path.join(process.cwd(), "data", "csv", "fabricdatabase.csv");

// ---- Canonical normalization helpers ----
function normStr(s) {
  if (s === null || s === undefined) return "";
  return String(s).trim();
}

function toFloat(x) {
  const s = normStr(x);
  if (!s) return null;
  const cleaned = s.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toInt(x) {
  const f = toFloat(x);
  return f === null ? null : Math.trunc(f);
}

function parseDate(x) {
  const s = normStr(x);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function canonicalMaterial(raw) {
  const s0 = normStr(raw);
  if (!s0) return null;

  const s = s0
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Spandex / Elastane / Lycra
  if (/(^| )spandex( |$)/.test(s) || /elastane/.test(s) || /lycra/.test(s)) {
    return "Elastane (Spandex)";
  }

  // Nylon / Polyamide / PA / Nylon 6/66
  if (
    /(^| )nylon( |$)/.test(s) ||
    /polyamide/.test(s) ||
    /(^| )pa( |$)/.test(s) ||
    /pa6/.test(s) ||
    /pa66/.test(s) ||
    /nylon ?6/.test(s) ||
    /nylon ?66/.test(s)
  ) {
    return "Polyamide (Nylon)";
  }

  // Polyester
  if (/(^| )polyester( |$)/.test(s) || /(^| )pet( |$)/.test(s) || /(^| )pes( |$)/.test(s)) {
    return "Polyester";
  }

  // Cotton
  if (/(^| )cotton( |$)/.test(s) || /(^| )co( |$)/.test(s)) return "Cotton";

  // Viscose / Rayon
  if (/(^| )viscose( |$)/.test(s) || /(^| )rayon( |$)/.test(s)) return "Viscose/Rayon";

  // Wool / Silk / Linen
  if (/(^| )wool( |$)/.test(s)) return "Wool";
  if (/(^| )silk( |$)/.test(s)) return "Silk";
  if (/(^| )linen( |$)/.test(s) || /flax/.test(s)) return "Linen";

  return s0.trim();
}

function pick(row, keys) {
  for (const k of keys) {
    if (k in row && normStr(row[k])) return row[k];
  }
  return null;
}

function stripUtf8Bom(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3);
  }
  return buf;
}

function mustHaveAny(headers, candidates) {
  const set = new Set(headers);
  return candidates.some((c) => set.has(c));
}

async function resetAll() {
  const delSub = await prisma.fabricSubmission.deleteMany({});
  const delContent = await prisma.fabricContent.deleteMany({});
  const delFabric = await prisma.fabric.deleteMany({});
  console.log("reset:", {
    deletedSubmissions: delSub.count,
    deletedContents: delContent.count,
    deletedFabrics: delFabric.count,
  });
}

async function main() {
  console.log("seed: reading", CSV_PATH);
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const rawBuf = stripUtf8Bom(fs.readFileSync(CSV_PATH));
  const txt = rawBuf.toString("utf8");

  const records = parse(txt, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });

  if (!records.length) {
    console.log("seed: no rows");
    return;
  }

  const headers = Object.keys(records[0] || {});
  console.log("detected headers:", headers.slice(0, 40), headers.length > 40 ? `...(+${headers.length - 40})` : "");

  // -------- HARD GUARD: refuse to run on wrong sheet --------
  const fabricHeaderSignals = [
    "FUZE Fabric #",
    "Customer Fabric Code",
    "Factory Fabric Code",
    "Fabric Construction Description",
    "Fabric Content #1",
    "Weight (gsm)",
    "Full Width",
  ];

  if (!mustHaveAny(headers, fabricHeaderSignals)) {
    throw new Error(
      `This CSV does NOT look like fabric data.\n` +
        `Expected one of: ${fabricHeaderSignals.join(", ")}\n` +
        `But saw: ${headers.slice(0, 12).join(", ")} ...\n` +
        `Aborting to prevent nuking your DB.\n` +
        `Use: node scripts/seed_fabric_submissions.mjs --file data/csv/fabricdatabase.csv --reset`
    );
  }

  // ---- Header mapping priorities ----
  const H = {
    fuzeFabricNumber: ["FUZE Fabric #", "Fuze Fabric #", "FUZE Fabric Number", "Fuze Fabric Number"],
    customerFabricCode: ["Customer Fabric Code", "Customer Code", "Customer Fabric"],
    factoryFabricCode: ["Factory Fabric Code", "Factory Code", "Factory Fabric"],
    construction: ["Fabric Construction Description", "Construction", "Fabric Construction", "Fabric Construction Desc"],
    color: ["Fabric Color", "Color", "Fabric colour"],
    widthInches: ["Full Width", "Width", "Width (in)", "Width (inches)"],
    weightGsm: ["Weight (gsm)", "Weight\n(gsm) ", "Weight GSM", "GSM", "weight_gsm"],
    applicationMethod: ["Application Method", "Method"],
    applicationRecipe: ["Application Recipe", "Recipe"],
    padRecipe: ["Pad Recipe"],
    treatmentLocation: ["Fuze Treatment Location", "Fuze treatment Location", "Treatment Location"],
    applicationDate: ["Fuze Application Date", "Fuze application Date", "Application Date"],
  };

  const contentCols = [
    { mat: ["Fabric Content #1", "Content 1", "Fabric Content 1"], pct: ["% Content 1", "Percent 1", "% 1"] },
    { mat: ["Fabric Content #2", "Content 2", "Fabric Content 2"], pct: ["% Content 2", "Percent 2", "% 2"] },
    { mat: ["Fabric Content #3", "Content 3", "Fabric Content 3"], pct: ["% Content 3", "Percent 3", "% 3"] },
  ];

  if (DO_RESET) {
    await resetAll();
  } else {
    console.log("NOTE: --reset not provided, so NO deletes were performed.");
  }

  let created = 0;

  for (const r of records) {
    const construction = pick(r, H.construction);
    const color = pick(r, H.color);
    const widthInches = toFloat(pick(r, H.widthInches));
    const weightGsm = toFloat(pick(r, H.weightGsm));

    const fabric = await prisma.fabric.create({
      data: {
        construction: construction ? normStr(construction) : null,
        color: color ? normStr(color) : null,
        widthInches,
        weightGsm,
        raw: r,
      },
      select: { id: true },
    });

    for (const cc of contentCols) {
      const matRaw = pick(r, cc.mat);
      const pctRaw = pick(r, cc.pct);

      const mat = canonicalMaterial(matRaw);
      const pct = toFloat(pctRaw);

      if (!mat) continue;

      await prisma.fabricContent.create({
        data: {
          fabricId: fabric.id,
          material: mat,
          percent: pct,
          rawText: matRaw ? normStr(matRaw) : null,
        },
      });
    }

    const fuzeFabricNumber = toInt(pick(r, H.fuzeFabricNumber));
    const customerFabricCode = pick(r, H.customerFabricCode);
    const factoryFabricCode = pick(r, H.factoryFabricCode);

    await prisma.fabricSubmission.create({
      data: {
        fabricId: fabric.id,
        fuzeFabricNumber,
        customerFabricCode: customerFabricCode ? normStr(customerFabricCode) : null,
        factoryFabricCode: factoryFabricCode ? normStr(factoryFabricCode) : null,
        applicationMethod: pick(r, H.applicationMethod) ? normStr(pick(r, H.applicationMethod)) : null,
        applicationRecipeRaw: pick(r, H.applicationRecipe) ? normStr(pick(r, H.applicationRecipe)) : null,
        padRecipeRaw: pick(r, H.padRecipe) ? normStr(pick(r, H.padRecipe)) : null,
        treatmentLocation: pick(r, H.treatmentLocation) ? normStr(pick(r, H.treatmentLocation)) : null,
        applicationDate: parseDate(pick(r, H.applicationDate)),
        raw: r,
      },
    });

    created++;
    if (created % 100 === 0) console.log("created:", created);
  }

  console.log("DONE. created fabrics:", created);
}

main()
  .catch((e) => {
    console.error("seed error:", e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });