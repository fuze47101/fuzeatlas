/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

type Row = Record<string, string>;

function readCsv(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
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

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"'; i++; continue;
    }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function p(file: string) {
  return path.join(process.cwd(), "data", file);
}

async function main() {
  console.log("FUZE Atlas import starting…");

  if (!fs.existsSync("data")) {
    throw new Error("data/ directory missing");
  }

  console.log("Files found:", fs.readdirSync("data"));

  // Placeholder: confirms pipeline works
  console.log("Import scaffold ready. Next step: full dataset mapping.");

  console.log("FUZE Atlas import complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
