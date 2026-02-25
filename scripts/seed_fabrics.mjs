// scripts/seed_fabrics.mjs
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CSV_PATH = path.resolve("data/csv/fabricdatabase.csv");

function toFloat(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function findKeys(headers, regexes) {
  const out = [];
  for (const h of headers) {
    for (const rx of regexes) {
      if (rx.test(h)) {
        out.push(h);
        break;
      }
    }
  }
  return out;
}

function firstNonEmptyString(row, keys) {
  for (const k of keys) {
    const v = toStringOrNull(row[k]);
    if (v) return v;
  }
  return null;
}

function firstNonEmptyFloat(row, keys) {
  for (const k of keys) {
    const v = toFloat(row[k]);
    if (v !== null) return v;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const doReset = args.includes("--reset");

  if (doReset) {
    const r = await prisma.fabric.deleteMany({});
    console.log("reset: deleted fabrics:", r.count);
  }

  const buf = fs.readFileSync(CSV_PATH);
  const txt = buf.toString("utf8").replace(/^\uFEFF/, ""); // strip UTF-8 BOM

  const rows = parse(txt, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });

  if (!rows.length) {
    console.log("no rows found");
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  console.log(
    "detected headers:",
    headers.slice(0, 40),
    headers.length > 40 ? `...(+${headers.length - 40})` : ""
  );

  // candidate key sets (NOT a single key)
  const constructionKeys = findKeys(headers, [
    /fabric.*construction/i,
    /construction/i,
    /weave/i,
    /knit/i,
    /structure/i,
    /description/i,
  ]);

  const colorKeys = findKeys(headers, [
    /^fabric color$/i,
    /^color$/i,
    /colour/i,
    /shade/i,
    /dyed/i,
  ]);

  const widthKeys = findKeys(headers, [
    /full width/i,          // <-- your column
    /width.*inch/i,
    /width.*in\b/i,
    /^width$/i,
    /fabric.*width/i,
  ]);

  const gsmKeys = findKeys(headers, [
    /weight.*gsm/i,         // matches "Weight (gsm)" and "Weight\n(gsm) "
    /\bgsm\b/i,
    /^weight$/i,
    /fabric.*weight/i,
  ]);

  console.log("mapped key candidates:", {
    constructionKeys,
    colorKeys,
    widthKeys,
    gsmKeys,
  });

  let created = 0;

  for (const r of rows) {
    const construction = firstNonEmptyString(r, constructionKeys);
    const color = firstNonEmptyString(r, colorKeys);

    // Width: "Full Width" might be inches or a string like '60"' or '60 in'
    const widthInches = firstNonEmptyFloat(r, widthKeys);

    // GSM: take first non-empty among all weight headers
    const weightGsm = firstNonEmptyFloat(r, gsmKeys);

    await prisma.fabric.create({
      data: {
        construction,
        color,
        widthInches,
        weightGsm,
        raw: r,
      },
    });

    created++;
    if (created % 100 === 0) console.log("created:", created);
  }

  console.log("DONE. created:", created);

  // quick stats sample
  const sample = await prisma.fabric.findFirst({
    select: { construction: true, color: true, widthInches: true, weightGsm: true },
  });
  console.log("sample:", sample);
}

main()
  .catch((e) => {
    console.error("seed error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });