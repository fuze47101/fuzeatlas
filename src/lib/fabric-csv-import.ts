/**
 * Phase 18 — Brand Fabric Portfolio CSV importer parser + validator.
 *
 * Pure function. Takes raw CSV text + brandId, returns a ParseResult
 * with rows / errors / warnings / summary. NO database writes — that
 * lives in the API route. This file is the canonical "what does this
 * CSV mean" interpreter.
 *
 * Canonical schema (deliverables/Brand_Fabric_Portfolio_Template.csv):
 *   Mill, Mill Fabric #, Type, Content, Weight (gsm), Brand Article #,
 *   Customer Code, Fabric Trial Completed (Y/N), ICP Result Available
 *   (Y/N), Antimicrobial Result Available (Y/N), ICP Value (mg/kg),
 *   ICP Notes, Report Date (YYYY-MM-DD), Workflow Status, Notes
 *
 * Fuzzy column-name resolution (T3): COLUMN_ALIASES maps common
 * variants (e.g. "Factory" → "Mill"). Headers are normalized
 * (lowercase, trim, strip punctuation) before lookup.
 */

import {
  FABRIC_DEV_STATUSES,
  mapTinaStatusToEnum,
  isValidFabricDevStatus,
  type FabricDevStatus,
} from "./fabric-development-status";

export type QuantityType = "ACTUAL" | "DEVELOPMENT" | "FORECAST" | "RD";

export interface ParsedRow {
  rowNumber: number; // 1-indexed, including header
  mill: string;
  millFabricNumber: string;
  type: QuantityType | null;
  content: string | null;
  weightGsm: number | null;
  brandArticleNumber: string | null;
  customerCode: string | null;
  fabricTrialCompleted: boolean;
  hasIcpResult: boolean;
  hasAmResult: boolean;
  icpValue: number | null;
  icpNotes: string | null;
  reportDate: Date | null;
  workflowStatus: FabricDevStatus | null;
  notes: string | null;
  /** Original column → value pairs for any header we couldn't map. */
  unmappedColumns: Record<string, string>;
}

export interface ParseError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ParseWarning {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
  /** Distinct mill names across all valid rows — for factory alias resolution. */
  millNames: string[];
  /** Header map actually used (canonical → original column index). */
  headerMap: Record<string, number>;
  /** Headers that didn't match any canonical column. */
  unknownHeaders: string[];
  summary: {
    totalRows: number;
    validRows: number;
    distinctMills: number;
  };
}

/* ─── COLUMN ALIASES (T3) ─────────────────────────────────────── */

export const CANONICAL_COLUMNS = [
  "mill",
  "millFabricNumber",
  "type",
  "content",
  "weightGsm",
  "brandArticleNumber",
  "customerCode",
  "fabricTrialCompleted",
  "hasIcpResult",
  "hasAmResult",
  "icpValue",
  "icpNotes",
  "reportDate",
  "workflowStatus",
  "notes",
] as const;
export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number];

/** Header variants per canonical column. All compared after normalize(). */
export const COLUMN_ALIASES: Record<CanonicalColumn, string[]> = {
  mill: ["mill", "factory", "manufacturer", "vendor", "supplier", "mill name", "factory name"],
  millFabricNumber: [
    "mill fabric",
    "mill fabric number",
    "factory code",
    "factory sku",
    "factory style",
    "factory style number",
    "article",
    "mill style",
    "mill sku",
    "factory fabric",
  ],
  type: ["type", "category", "status type", "sample type", "quantity type"],
  content: ["content", "fiber content", "composition", "material", "blend"],
  weightGsm: ["weight gsm", "gsm", "weight", "fabric weight", "mass"],
  brandArticleNumber: [
    "brand article",
    "brand article number",
    "sku",
    "style number",
    "brand sku",
    "internal code",
    "product code",
  ],
  customerCode: [
    "customer code",
    "brand code",
    "internal reference",
    "brand reference",
    "customer reference",
  ],
  fabricTrialCompleted: [
    "fabric trial completed",
    "fabric trial complete",
    "trial complete",
    "trial completed",
    "trial done",
    "fabric trial",
  ],
  hasIcpResult: [
    "icp result available",
    "icp result",
    "icp available",
    "icp done",
    "has icp",
  ],
  hasAmResult: [
    "antimicrobial result available",
    "antimicrobial result",
    "am result",
    "am result available",
    "antimicrobial test",
    "am test",
  ],
  icpValue: ["icp value", "icp value mg kg", "icp", "icp mg kg", "icp result mg kg"],
  icpNotes: ["icp notes", "icp note"],
  reportDate: ["report date", "report date yyyy mm dd", "date", "test date"],
  workflowStatus: ["workflow status", "status", "stage", "phase", "development stage", "dev status"],
  notes: ["notes", "note", "comment", "comments", "remarks"],
};

function normalize(s: string): string {
  // Strip parenthetical hints like "(Y/N)", "(gsm)", "(YYYY-MM-DD)",
  // "(mg/kg)" first so the canonical alias map stays short.
  const stripped = s.replace(/\([^)]*\)/g, " ");
  return stripped
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}_\-\/\\.,:;!?#%@*+=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderMap(headers: string[]): {
  headerMap: Record<string, number>;
  unknown: string[];
} {
  const headerMap: Record<string, number> = {};
  const unknown: string[] = [];
  const usedIndexes = new Set<number>();
  headers.forEach((raw, idx) => {
    const norm = normalize(raw);
    if (!norm) return;
    let matched: CanonicalColumn | null = null;
    for (const col of CANONICAL_COLUMNS) {
      if (COLUMN_ALIASES[col].includes(norm)) {
        matched = col;
        break;
      }
    }
    if (matched && !(matched in headerMap)) {
      headerMap[matched] = idx;
      usedIndexes.add(idx);
    } else if (!matched) {
      unknown.push(raw);
    }
  });
  return { headerMap, unknown };
}

/* ─── CSV PARSING ─────────────────────────────────────────────── */

/**
 * Minimal CSV parser. Handles quoted fields with embedded commas + escaped
 * double quotes ("") inside. No external dep needed for the scale we're at.
 */
export function parseCsvText(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const len = csv.length;
  while (i < len) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && csv[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  // Last cell + row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ─── VALUE COERCION ──────────────────────────────────────────── */

const TRUTHY = new Set(["y", "yes", "true", "1", "✓", "✔", "checked"]);
const FALSY = new Set(["n", "no", "false", "0", "", "✗", "✘", "unchecked"]);

function parseBool(
  raw: string | undefined,
  rowNumber: number,
  field: string,
  warnings: ParseWarning[],
): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  warnings.push({
    rowNumber,
    field,
    message: `Unrecognized Y/N value "${raw}" — treating as N`,
  });
  return false;
}

function parseNumber(raw: string | undefined): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): Date | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // ISO YYYY-MM-DD, also accept slashed YYYY/MM/DD and MM/DD/YYYY heuristically.
  const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isNaN(d.getTime()) ? null : d;
  }
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const d = new Date(Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2])));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const VALID_QUANTITY_TYPES: QuantityType[] = ["ACTUAL", "DEVELOPMENT", "FORECAST", "RD"];

function parseQuantityType(
  raw: string | undefined,
  rowNumber: number,
  warnings: ParseWarning[],
): QuantityType {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return "DEVELOPMENT";
  if (VALID_QUANTITY_TYPES.includes(v as QuantityType)) return v as QuantityType;
  // Fuzzy fallback for legacy spreadsheet values
  if (v.includes("DEV") || v.includes("TRIAL")) return "DEVELOPMENT";
  if (v.includes("PROD") || v.includes("BULK") || v.includes("ACTUAL")) return "ACTUAL";
  if (v.includes("FORECAST") || v.includes("PROJ")) return "FORECAST";
  if (v.includes("R&D") || v === "RD" || v.includes("RESEARCH")) return "RD";
  warnings.push({
    rowNumber,
    field: "type",
    message: `Unrecognized Type "${raw}" — defaulting to DEVELOPMENT`,
  });
  return "DEVELOPMENT";
}

function parseWorkflowStatus(
  raw: string | undefined,
  rowNumber: number,
  warnings: ParseWarning[],
): FabricDevStatus | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const upper = v.toUpperCase().replace(/\s+/g, "_");
  if (isValidFabricDevStatus(upper)) return upper as FabricDevStatus;
  const fuzzy = mapTinaStatusToEnum(v);
  if (fuzzy) return fuzzy;
  warnings.push({
    rowNumber,
    field: "workflowStatus",
    message: `Unrecognized Workflow Status "${raw}" — left blank. Valid: ${FABRIC_DEV_STATUSES.join(", ")}`,
  });
  return null;
}

/* ─── MAIN PARSE ENTRY ────────────────────────────────────────── */

export function parseFabricCsv(csvText: string, brandId: string): ParseResult {
  const _ = brandId; // brandId is for the consumer; parser is stateless

  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  if (!csvText || !csvText.trim()) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: "Empty CSV" }],
      warnings,
      millNames: [],
      headerMap: {},
      unknownHeaders: [],
      summary: { totalRows: 0, validRows: 0, distinctMills: 0 },
    };
  }

  const raw = parseCsvText(csvText);
  // Drop trailing empty rows
  while (raw.length && raw[raw.length - 1].every((c) => !c || !c.trim())) raw.pop();
  if (raw.length < 1) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: "No rows in CSV" }],
      warnings,
      millNames: [],
      headerMap: {},
      unknownHeaders: [],
      summary: { totalRows: 0, validRows: 0, distinctMills: 0 },
    };
  }

  const headers = raw[0];
  const { headerMap, unknown } = buildHeaderMap(headers);

  // Required columns
  if (!("mill" in headerMap)) {
    errors.push({ rowNumber: 1, field: "mill", message: "Missing required column: Mill" });
  }
  if (!("millFabricNumber" in headerMap)) {
    errors.push({
      rowNumber: 1,
      field: "millFabricNumber",
      message: "Missing required column: Mill Fabric # (or Factory Code)",
    });
  }

  if (errors.length > 0) {
    return {
      rows: [],
      errors,
      warnings,
      millNames: [],
      headerMap,
      unknownHeaders: unknown,
      summary: { totalRows: 0, validRows: 0, distinctMills: 0 },
    };
  }

  const cell = (line: string[], col: CanonicalColumn): string | undefined => {
    const idx = headerMap[col];
    return idx === undefined ? undefined : (line[idx] ?? "").trim();
  };

  const rows: ParsedRow[] = [];
  const millSet = new Set<string>();
  const seenMillFabricKeys = new Set<string>();

  for (let lineIdx = 1; lineIdx < raw.length; lineIdx++) {
    const line = raw[lineIdx];
    const rowNumber = lineIdx + 1;

    // Skip wholly-empty rows silently
    if (line.every((c) => !c || !c.trim())) continue;

    const mill = cell(line, "mill") || "";
    const millFabricNumber = cell(line, "millFabricNumber") || "";

    if (!mill) {
      errors.push({ rowNumber, field: "mill", message: "Mill is required" });
      continue;
    }
    if (!millFabricNumber) {
      errors.push({
        rowNumber,
        field: "millFabricNumber",
        message: "Mill Fabric # is required",
      });
      continue;
    }

    // Within-CSV duplicate detection (per brand the millFabricNumber should be unique)
    const dupKey = `${mill.toLowerCase()}::${millFabricNumber.toLowerCase()}`;
    if (seenMillFabricKeys.has(dupKey)) {
      warnings.push({
        rowNumber,
        field: "millFabricNumber",
        message: `Duplicate of an earlier row with same Mill + Mill Fabric # — second occurrence will overwrite.`,
      });
    }
    seenMillFabricKeys.add(dupKey);

    const weightRaw = cell(line, "weightGsm");
    let weightGsm: number | null = null;
    if (weightRaw) {
      weightGsm = parseNumber(weightRaw);
      if (weightGsm == null) {
        warnings.push({
          rowNumber,
          field: "weightGsm",
          message: `Could not parse Weight (gsm) "${weightRaw}" — left blank`,
        });
      }
    }

    const icpRaw = cell(line, "icpValue");
    let icpValue: number | null = null;
    if (icpRaw) {
      icpValue = parseNumber(icpRaw);
      if (icpValue == null) {
        warnings.push({
          rowNumber,
          field: "icpValue",
          message: `Could not parse ICP Value "${icpRaw}" — left blank`,
        });
      }
    }

    const reportRaw = cell(line, "reportDate");
    let reportDate: Date | null = null;
    if (reportRaw) {
      reportDate = parseDate(reportRaw);
      if (!reportDate) {
        warnings.push({
          rowNumber,
          field: "reportDate",
          message: `Could not parse Report Date "${reportRaw}" — left blank`,
        });
      }
    }

    const fabricTrialCompleted = parseBool(
      cell(line, "fabricTrialCompleted"),
      rowNumber,
      "fabricTrialCompleted",
      warnings,
    );
    const hasIcpResult = parseBool(cell(line, "hasIcpResult"), rowNumber, "hasIcpResult", warnings);
    const hasAmResult = parseBool(cell(line, "hasAmResult"), rowNumber, "hasAmResult", warnings);

    // Collect any header that didn't get mapped — preserve as unmappedColumns.
    const unmappedColumns: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const norm = normalize(h);
      const mapped = Object.entries(headerMap).find(([, i]) => i === idx);
      if (mapped) return;
      if (!norm) return;
      const v = (line[idx] ?? "").trim();
      if (v) unmappedColumns[h] = v;
    });

    rows.push({
      rowNumber,
      mill,
      millFabricNumber,
      type: parseQuantityType(cell(line, "type"), rowNumber, warnings),
      content: cell(line, "content") || null,
      weightGsm,
      brandArticleNumber: cell(line, "brandArticleNumber") || null,
      customerCode: cell(line, "customerCode") || null,
      fabricTrialCompleted,
      hasIcpResult,
      hasAmResult,
      icpValue,
      icpNotes: cell(line, "icpNotes") || null,
      reportDate,
      workflowStatus: parseWorkflowStatus(cell(line, "workflowStatus"), rowNumber, warnings),
      notes: cell(line, "notes") || null,
      unmappedColumns,
    });
    millSet.add(mill);
  }

  return {
    rows,
    errors,
    warnings,
    millNames: Array.from(millSet).sort(),
    headerMap,
    unknownHeaders: unknown,
    summary: {
      totalRows: raw.length - 1,
      validRows: rows.length,
      distinctMills: millSet.size,
    },
  };
}
