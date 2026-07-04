// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyRawDataReceived } from "@/lib/notify";
import { parseITSReport } from "@/lib/parsers/testReportParser";
import type { ParsedITSReport } from "@/lib/parsers/testReportParser";
import { extractTestDataWithAIVision } from "@/lib/parsers/aiVisionExtractor";
import type { AIExtractedTestData } from "@/lib/parsers/aiVisionExtractor";
import { isS3Configured, downloadFromS3, getS3Bucket, getS3Region } from "@/lib/s3";
import { uploadDocument } from "@/lib/upload";

/* ── PDF text extraction (lightweight, no native deps) ────────── */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

/* ── Call AI review endpoint internally ───────────────────────── */
async function callAIReview(parsed: ParsedITSReport): Promise<any> {
  try {
    // Build the base URL from environment or default
    const baseUrl =
      process.env.NEXTAUTH_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/tests/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tests: parsed.tests,
        rawText: parsed.rawText,
      }),
    });

    if (!response.ok) {
      console.error("AI review call failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.ok ? data.review : null;
  } catch (err) {
    console.error("AI review call error:", err);
    return null;
  }
}

/* ── Legacy flat parser (kept for non-ITS reports) ────────────── */
interface ParsedTestData {
  testType: string | null;
  testReportNumber: string | null;
  labName: string | null;
  testDate: string | null;
  testMethodStd: string | null;
  fabricInfo: string | null;
  washCount: number | null;
  organisms: { name: string; result: string; reduction: number | null }[];
  icpResults: { metal: string; value: number | null; unit: string }[];
  fungalResult: { result: string; pass: boolean | null } | null;
  odorResult: { result: string; pass: boolean | null } | null;
  overallPass: boolean | null;
  confidence: number;
  rawText: string;
  warnings: string[];
}

function parseTestReport(text: string): ParsedTestData {
  const warnings: string[] = [];
  const fullText = text.toLowerCase();

  let testType: string | null = null;
  if (
    fullText.includes("antibacterial") ||
    fullText.includes("aatcc 100") ||
    fullText.includes("aatcc 147") ||
    fullText.includes("iso 20743")
  ) {
    testType = "ANTIBACTERIAL";
  } else if (
    fullText.includes("icp") ||
    fullText.includes("inductively coupled") ||
    fullText.includes("icp-ms") ||
    fullText.includes("icp-oes")
  ) {
    testType = "ICP";
  } else if (
    fullText.includes("antifungal") ||
    fullText.includes("fungal") ||
    fullText.includes("aatcc 30") ||
    fullText.includes("iso 13629")
  ) {
    testType = "FUNGAL";
  } else if (
    fullText.includes("odor") ||
    fullText.includes("smell") ||
    fullText.includes("aatcc 199")
  ) {
    testType = "ODOR";
  } else if (
    fullText.includes("uv ") ||
    fullText.includes("ultraviolet") ||
    fullText.includes("upf")
  ) {
    testType = "UV";
  }

  if (!testType) warnings.push("Could not auto-detect test type. Please select manually.");

  let testReportNumber: string | null = null;
  const reportPatterns = [
    // Specific lab prefixes
    /CTLA\s*ID[.:\s]*([A-Z0-9][\w\-\/]*)/i,
    /(?:TWN|SGS|ITS|NOA|VLS|VL)\s*(?:report|ref|id|no|number|cert)?[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    // VL Shanghai pattern: VLS-2026-001234 / VL/2026/CN/0001
    /\b(VLS?[\-\/][\w\-\/]+)/i,
    // Chinese-lab-friendly: "Sample No.", "Lab No.", "Cert No.", "Test No.", "Project No."
    /(?:sample|lab|cert(?:ificate)?|test|project|analysis|file)\s*(?:no|number|#|num|id)[.:\s]+([A-Z0-9][\w\-\/]+)/i,
    // Generic "report no" variants
    /report\s*(?:no|number|#|num)[.:\s]+([A-Z0-9][\w\-\/]+)/i,
    /test\s*report[.:\s]+([A-Z0-9][\w\-\/]+)/i,
    /report\s*id[.:\s]+([A-Z0-9][\w\-\/]+)/i,
    /certificate\s*(?:no|number|#)[.:\s]+([A-Z0-9][\w\-\/]+)/i,
    /(?:COA|coa)[_\-\s]*(\d{4,})/i,
    /ref(?:erence)?[.:\s]+([A-Z0-9][\w\-\/]+)/i,
    // Chinese: 报告编号 / 检测编号
    /(?:报告编号|检测编号|检验编号|样品编号)[.:\s]*([A-Z0-9][\w\-\/]+)/,
  ];
  for (const pat of reportPatterns) {
    const m = text.match(pat);
    if (m) {
      testReportNumber = m[1];
      break;
    }
  }

  let labName: string | null = null;
  // Apr 2026 (Tina ticket): expanded to include the labs TexWell + Hi-Goal
  // actually use (VL Shanghai, Bureau Veritas HK, ITS TW, US Lab) plus the
  // common Asian/EU labs we keep seeing in uploads. Order matters — longest
  // / most specific names first so "Intertek Taiwan" wins over "Intertek"
  // and "Bureau Veritas Hong Kong" wins over "Bureau Veritas".
  const knownLabs = [
    // Long / specific names first (multi-word, region-qualified)
    "Antimicrobial Test Laboratories",
    "Bureau Veritas Hong Kong",
    "Bureau Veritas Shanghai",
    "Bureau Veritas Consumer Products",
    "Centre Testing International",
    "Contract Testing Laboratories",
    "EMSL Analytical",
    "Eurofins Product Testing",
    "Hohenstein Institute",
    "Intertek Taiwan",
    "Intertek Shanghai",
    "Intertek Hong Kong",
    "Intertek Testing Services",
    "Microchem Laboratory",
    "Nelson Laboratories",
    "Nelson Labs",
    "QIMA Testing",
    "QTEC Quality Testing",
    "SGS Hong Kong",
    "SGS Shanghai",
    "SGS Taiwan",
    "STR Testing Services",
    "Taiwan Textile Research Institute",
    "TTRI",
    "TÜV Rheinland",
    "TUV Rheinland",
    "TÜV SÜD",
    "TUV SUD",
    "VL Shanghai",
    "VL Testing", // TexWell uses VL Shanghai
    // Single-name labs (>3 chars — substring match)
    "Bureau Veritas",
    "Intertek",
    "Eurofins",
    "Hohenstein",
    "OEKO-TEX",
    "Testex",
    "Vartest",
    "Silliker",
    "AATCC",
    "QIMA",
    "MTL",
    "GBT",
    "CITF",
    // Short codes (>=3 chars, word-boundary match to avoid false positives)
    "CTLA",
    "SGS",
    "TÜV",
    "TUV",
    "NSF",
    "NOA",
    "ITS",
    "CTC",
    "CTI",
    "ACTS",
    "ATL",
    "BSI",
    "TWN",
    "MTL",
  ];
  for (const lab of knownLabs) {
    if (lab.length <= 4) {
      // Word-boundary match for short acronyms — avoids matching inside other words
      const re = new RegExp(`\\b${lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) {
        labName = lab;
        break;
      }
    } else {
      if (text.toLowerCase().includes(lab.toLowerCase())) {
        labName = lab;
        break;
      }
    }
  }

  // Apr 2026 (Tina ticket): Many more date formats. Old parser only caught
  // dates with an explicit "date of test/report" prefix, so most reports
  // came through with empty testDate forcing manual entry. Patterns are
  // ordered most-specific → least-specific so prefixed matches win over
  // bare numeric matches.
  let testDate: string | null = null;
  const datePatterns = [
    // "Date of Test/Report/Issue/Analysis/Sampling: 03/15/2026" or "March 15, 2026"
    /(?:date\s*(?:of\s*)?(?:test|report|issue|issued?|analysis|sampling|testing|completion))[.:\s]+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:date\s*(?:of\s*)?(?:test|report|issue|issued?|analysis|sampling|testing|completion))[.:\s]+(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i,
    /(?:date\s*(?:of\s*)?(?:test|report|issue|issued?|analysis|sampling|testing|completion))[.:\s]+(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /(?:date\s*(?:of\s*)?(?:test|report|issue|issued?|analysis|sampling|testing|completion))[.:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    // "Test Date / Report Date / Issued / Issue Date / Sample Received / Date Received / Date Reported / Date Performed"
    /(?:test\s+date|report\s+date|issue\s+date|date\s+received|date\s+reported|sample\s+received|date\s+performed|reporting\s+date)[.:\s]+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:test\s+date|report\s+date|issue\s+date|date\s+received|date\s+reported|sample\s+received|date\s+performed|reporting\s+date)[.:\s]+(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i,
    /(?:test\s+date|report\s+date|issue\s+date|date\s+received|date\s+reported|sample\s+received|date\s+performed|reporting\s+date)[.:\s]+(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /(?:test\s+date|report\s+date|issue\s+date|date\s+received|date\s+reported|sample\s+received|date\s+performed|reporting\s+date)[.:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    // Bare "Issued: 15 March 2026" / "Issued on 2026-03-15"
    /\bissued?\s*(?:on)?[.:\s]+(\d{1,2}\s+\w+\s+\d{2,4})/i,
    /\bissued?\s*(?:on)?[.:\s]+(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i,
    /\bissued?\s*(?:on)?[.:\s]+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    // CJK format: 2026年3月15日 (Chinese / Japanese)
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
    // Generic ISO 2026-03-15 (4-digit year first)
    /(\d{4}-\d{1,2}-\d{1,2})/,
    // Generic mm/dd/yyyy or dd/mm/yyyy with 4-digit year (last-resort)
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) {
      // Special-case CJK: rebuild as ISO so downstream new Date(...) works
      if (m.length >= 4 && pat.source.includes("年")) {
        testDate = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
      } else {
        testDate = m[1];
      }
      break;
    }
  }

  let testMethodStd: string | null = null;
  // Order matters — try the most-specific method patterns first.
  const methodPatterns = [
    // EPA ICP methods (very common on US/VL/Chinese ICP reports)
    /\b(EPA\s*(?:method\s*)?(?:6020[A-D]?|200\.[78]|3050[B]?|3051[A]?|3052))/i,
    // GB/T (Chinese national standard) — e.g. GB/T 26371-2010
    /\b(GB[\/\s]?T\s*\d+(?:[\-\.]\d+)?)/i,
    // ICP technique callouts that act as a method when no formal std cited
    /\b(ICP[\-\s]?(?:OES|MS|AES))/i,
    // AATCC / ISO / ASTM / EN / JIS — original pattern
    /(AATCC|ISO|ASTM|EN|JIS)\s*(?:TM\s*)?\d+[\w.-]*/i,
    // OEKO-TEX (sometimes embedded in compliance notes)
    /\b(OEKO[\-\s]?TEX\s*(?:Standard\s*)?100)/i,
  ];
  for (const pat of methodPatterns) {
    const m = text.match(pat);
    if (m) {
      testMethodStd = (m[1] || m[0]).toUpperCase().replace(/\s+/g, " ").trim();
      break;
    }
  }

  let washCount: number | null = null;
  const washMatch = text.match(/(\d+)\s*(?:wash(?:es)?|washes|launder(?:ing)?|cycle)/i);
  if (washMatch) washCount = parseInt(washMatch[1], 10);

  let fabricInfo: string | null = null;
  const fabricMatch = text.match(/(?:fabric|sample|material|substrate)[.:\s]*([^\n]{5,80})/i);
  if (fabricMatch) fabricInfo = fabricMatch[1].trim();

  const organisms: { name: string; result: string; reduction: number | null }[] = [];
  if (testType === "ANTIBACTERIAL") {
    const orgPatterns = [
      { name: "S. aureus", regex: /s\.?\s*aureus[^%\d]*?([\d.]+)\s*%/i },
      { name: "K. pneumoniae", regex: /k\.?\s*pneumoniae[^%\d]*?([\d.]+)\s*%/i },
      { name: "E. coli", regex: /e\.?\s*coli[^%\d]*?([\d.]+)\s*%/i },
      { name: "MRSA", regex: /mrsa[^%\d]*?([\d.]+)\s*%/i },
      { name: "P. aeruginosa", regex: /p\.?\s*aeruginosa[^%\d]*?([\d.]+)\s*%/i },
    ];
    for (const op of orgPatterns) {
      const m = text.match(op.regex);
      if (m)
        organisms.push({
          name: op.name,
          result: `${m[1]}% reduction`,
          reduction: parseFloat(m[1]),
        });
    }
    if (organisms.length === 0) {
      const reductionMatch = text.match(/([\d.]+)\s*%\s*(?:reduction|kill)/i);
      if (reductionMatch) {
        organisms.push({
          name: "Unknown organism",
          result: `${reductionMatch[1]}% reduction`,
          reduction: parseFloat(reductionMatch[1]),
        });
        warnings.push("Could not identify specific organism names. Please verify.");
      }
    }
  }

  // ICP element extraction.
  // Apr 2026 (Tina + VL Lab ticket): expanded from just Ag + Au to
  // the full set of metals labs typically run on textile finishes.
  // VL Shanghai's typical ICP panel returns 8-12 elements per sample;
  // the old parser only caught silver, scoring 0% on every other
  // result line. The unit list now also accepts μg/L, μg/kg, μg/m²
  // and the bare unit "<0.X" range markers labs sometimes print.
  const icpResults: { metal: string; value: number | null; unit: string }[] = [];
  if (testType === "ICP") {
    const ICP_ELEMENTS: Array<{ name: string; symbol: string; aliases: string[] }> = [
      { name: "silver", symbol: "Ag", aliases: ["silver", "Ag"] },
      { name: "gold", symbol: "Au", aliases: ["gold", "Au"] },
      { name: "lead", symbol: "Pb", aliases: ["lead", "Pb"] },
      { name: "cadmium", symbol: "Cd", aliases: ["cadmium", "Cd"] },
      { name: "arsenic", symbol: "As", aliases: ["arsenic", "As"] },
      { name: "mercury", symbol: "Hg", aliases: ["mercury", "Hg"] },
      { name: "copper", symbol: "Cu", aliases: ["copper", "Cu"] },
      { name: "zinc", symbol: "Zn", aliases: ["zinc", "Zn"] },
      { name: "nickel", symbol: "Ni", aliases: ["nickel", "Ni"] },
      { name: "antimony", symbol: "Sb", aliases: ["antimony", "Sb"] },
      { name: "barium", symbol: "Ba", aliases: ["barium", "Ba"] },
      { name: "chromium", symbol: "Cr", aliases: ["chromium", "Cr"] },
      { name: "cobalt", symbol: "Co", aliases: ["cobalt", "Co"] },
      { name: "tin", symbol: "Sn", aliases: ["tin", "Sn"] },
      { name: "iron", symbol: "Fe", aliases: ["iron", "Fe"] },
      { name: "manganese", symbol: "Mn", aliases: ["manganese", "Mn"] },
      { name: "aluminum", symbol: "Al", aliases: ["aluminum", "aluminium", "Al"] },
      { name: "selenium", symbol: "Se", aliases: ["selenium", "Se"] },
      { name: "platinum", symbol: "Pt", aliases: ["platinum", "Pt"] },
      { name: "palladium", symbol: "Pd", aliases: ["palladium", "Pd"] },
    ];
    const unitGroup =
      "(ppm|ppb|mg\\/kg|mg\\/l|mg\\/L|μg\\/g|μg\\/kg|μg\\/L|ug\\/g|ug\\/kg|ug\\/L|wt%|%|mg\\/m2|mg\\/m²)";
    for (const el of ICP_ELEMENTS) {
      // Try each alias separately so we match either "silver" or "Ag"
      // (case-insensitive for the word, exact-case for the symbol so
      // "AS" in a sentence doesn't match arsenic).
      let matched = false;
      for (const alias of el.aliases) {
        // For a 1-2 char symbol (Ag, Pb, etc.) require word boundaries
        // to avoid false positives like "Pb" inside an unrelated word.
        const pattern =
          alias.length <= 2
            ? new RegExp(`\\b${alias}\\b\\s*[:\\-]?\\s*(<?\\s*[\\d.]+)\\s*${unitGroup}`)
            : new RegExp(`\\b${alias}\\b\\s*[:\\-]?\\s*(<?\\s*[\\d.]+)\\s*${unitGroup}`, "i");
        const m = text.match(pattern);
        if (m) {
          const rawValue = m[1].replace(/[<\s]/g, "");
          const numeric = parseFloat(rawValue);
          if (!isNaN(numeric)) {
            icpResults.push({
              metal: el.symbol,
              value: numeric,
              unit: m[2].toLowerCase(),
            });
            matched = true;
            break;
          }
        }
      }
      // Don't double-count if matched
      if (matched) continue;
    }
    if (icpResults.length === 0) {
      // Heuristic: lab clearly says ICP but we extracted nothing —
      // probably an image-based PDF or a format we don't recognise yet.
      warnings.push(
        "Detected ICP report but could not extract any element values. " +
          "PDF may be image-based (try OCR re-export from the lab) or use a format the parser hasn't seen yet.",
      );
    }
  }

  let fungalResult = null;
  if (testType === "FUNGAL") {
    const fungalPassMatch = text.match(
      /(?:result|assessment|grade)[.:\s]*(pass|fail|no\s*growth|growth|zone\s*of\s*inhibition)/i,
    );
    if (fungalPassMatch) {
      const val = fungalPassMatch[1].toLowerCase();
      fungalResult = {
        result: fungalPassMatch[1],
        pass: val.includes("pass") || val.includes("no growth") || val.includes("zone"),
      };
    }
  }

  let odorResult = null;
  if (testType === "ODOR") {
    const odorMatch = text.match(/(?:result|rating|grade|score)[.:\s]*([^\n]{3,60})/i);
    if (odorMatch) {
      const val = odorMatch[1].toLowerCase();
      odorResult = {
        result: odorMatch[1].trim(),
        pass: val.includes("pass") || val.includes("acceptable") || val.includes("good"),
      };
    }
  }

  let overallPass: boolean | null = null;
  const passMatch = text.match(
    /(?:overall|final|conclusion|result)[.:\s]*(pass|fail|compliant|non-compliant|meets|does not meet)/i,
  );
  if (passMatch) {
    const val = passMatch[1].toLowerCase();
    overallPass = val.includes("pass") || val.includes("compliant") || val.includes("meets");
  }

  let confidence = 0;
  if (testType) confidence += 25;
  if (testReportNumber) confidence += 15;
  if (labName) confidence += 15;
  if (testDate) confidence += 10;
  if (testMethodStd) confidence += 10;
  if (organisms.length > 0 || icpResults.length > 0 || fungalResult || odorResult) confidence += 25;

  // Image-based PDF detection — when pdf-parse extracts < 200 chars
  // of meaningful text from a multi-page report, the source PDF was
  // almost certainly a scan or image-only export. Tina hits this on
  // VL Shanghai reports the lab emails as scanned PDFs. Tell the
  // user explicitly so they don't blame the parser, and floor the
  // confidence at a small non-zero so the upload still surfaces in
  // "Pending review" with context.
  const meaningfulText = text.replace(/\s+/g, " ").trim();
  if (meaningfulText.length < 200) {
    warnings.unshift(
      `Only ${meaningfulText.length} characters of text extracted from this PDF — ` +
        "it's likely an image-based scan, not a true text PDF. Ask the lab to " +
        "re-export with text layer enabled, or run an OCR pass before upload.",
    );
    // Cap confidence — even if a couple regex patterns happened to
    // match scanner noise, we don't trust the parse.
    confidence = Math.min(confidence, 5);
  }

  if (confidence < 50) {
    warnings.push("Low confidence parse. Please review all fields carefully.");
  }

  return {
    testType,
    testReportNumber,
    labName,
    testDate,
    testMethodStd,
    fabricInfo,
    washCount,
    organisms,
    icpResults,
    fungalResult,
    odorResult,
    overallPass,
    confidence,
    rawText: text.substring(0, 5000),
    warnings,
  };
}

/* ── Detect if text is an ITS Taiwan report ───────────────────── */
function isITSReport(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    (lower.includes("intertek") || lower.includes("its taiwan") || lower.includes("twnc")) &&
    (lower.includes("antibacterial") ||
      lower.includes("anti-bacterial") ||
      lower.includes("antimicrobial"))
  );
}

/* ── POST /api/tests/upload ─────────────────────────────────── */
/**
 * Two supported request shapes:
 *
 *  A) JSON body (preferred, no size limit) — client first POSTs to
 *     /api/tests/upload-url, PUTs the file to S3, then sends:
 *     {
 *       key, bucket?, filename, fileSize, contentType,
 *       // (any other metadata fields — currently advisory only,
 *       //  Document is created here; downstream /api/tests/confirm
 *       //  attaches brand/factory/fabric linkage.)
 *     }
 *     Handler downloads bytes from S3 to run pdf-parse + AI vision,
 *     creates the Document row pointing at the existing S3 object
 *     (no duplicate upload).
 *
 *  B) multipart/form-data (legacy small-file path) — `file` field.
 *     Kept so the lab-portal / distributor-portal / factory-portal
 *     pages don't regress while they migrate to (A). Vercel's
 *     ~4.5 MB body limit applies on this path — anything bigger
 *     MUST go through (A) or it 413s before the handler runs.
 */
export async function POST(req: Request) {
  try {
    // Capture uploading user (lab or admin) for attribution
    const sessionUser = await getCurrentUser().catch(() => null);
    const uploaderLabId = sessionUser?.labId || null;

    const contentTypeHeader = (req.headers.get("content-type") || "").toLowerCase();
    const isJsonBody = contentTypeHeader.includes("application/json");

    let file: { name: string; type: string; size: number; buffer: Buffer };
    let prefetchedS3: {
      bucket: string;
      key: string;
      url: string;
    } | null = null;

    if (isJsonBody) {
      // (A) Presigned-S3 path. File is already in S3; we read the
      // bytes back to parse, and skip the second upload to S3 since
      // the object key is the same one we'll record on Document.
      const body = await req.json().catch(() => ({}));
      const key = String(body?.key || "").trim();
      const filename = String(body?.filename || "").trim();
      const fileSize = Number(body?.fileSize ?? 0);
      const contentType = String(body?.contentType || "application/pdf").trim();
      const bucket = String(body?.bucket || getS3Bucket()).trim();

      if (!key || !filename) {
        return NextResponse.json(
          { ok: false, error: "key and filename are required in JSON body" },
          { status: 400 },
        );
      }
      if (contentType !== "application/pdf") {
        return NextResponse.json(
          { ok: false, error: "Only PDF files are accepted" },
          { status: 400 },
        );
      }
      if (Number.isFinite(fileSize) && fileSize > 25 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: "File too large (max 25MB)" },
          { status: 400 },
        );
      }

      let buffer: Buffer;
      try {
        buffer = await downloadFromS3(key);
      } catch (e: any) {
        return NextResponse.json(
          {
            ok: false,
            error: `Could not retrieve uploaded file from S3 (key=${key}): ${e?.message || e}`,
          },
          { status: 502 },
        );
      }

      file = {
        name: filename,
        type: contentType,
        size: buffer.length,
        buffer,
      };
      prefetchedS3 = {
        bucket,
        key,
        url: `https://${bucket}.s3.${getS3Region()}.amazonaws.com/${key}`,
      };
    } else {
      // (B) Legacy multipart path — capped by Vercel at ~4.5 MB.
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch (e: any) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Could not read multipart body. For files >4MB, use the presigned-URL flow (POST /api/tests/upload-url first).",
          },
          { status: 400 },
        );
      }
      const rawFile = formData.get("file") as File | null;

      if (!rawFile) {
        return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
      }

      if (rawFile.type !== "application/pdf") {
        return NextResponse.json(
          { ok: false, error: "Only PDF files are accepted" },
          { status: 400 },
        );
      }

      if (rawFile.size > 25 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "File too large (max 25MB)" }, { status: 400 });
      }

      const arrayBuffer = await rawFile.arrayBuffer();
      file = {
        name: rawFile.name,
        type: rawFile.type,
        size: rawFile.size,
        buffer: Buffer.from(arrayBuffer),
      };
    }

    const buffer = file.buffer;

    // Extract text from PDF first so we have the parse error / text
    // ready before we write the Document row.
    let pdfText = "";
    let parseError: string | null = null;
    try {
      pdfText = await extractPdfText(buffer);
    } catch (err: any) {
      parseError = `PDF text extraction failed: ${err.message}`;
    }

    // NEED-5 migration — funnel through uploadDocument(). The helper
    // stamps uploader ACL bits in Document.raw automatically; the
    // extra uploaderRole field stays in raw via extraRaw. Non-S3
    // base64 fallback is preserved for dev environments.
    const uploaderUserId = sessionUser?.id || null;
    const uploaderDistributorId = (sessionUser as any)?.distributorId || null;
    const uploaderFactoryId = (sessionUser as any)?.factoryId || null;
    const uploaderBrandId = (sessionUser as any)?.brandId || null;
    let document: any;
    if (prefetchedS3) {
      // Presigned-S3 path — file is already at prefetchedS3.key, so
      // skip the second uploadToS3() and just create the Document row
      // pointing at the existing object.
      const raw: Record<string, any> = {
        scanStatus: "pending",
        uploadedAt: new Date().toISOString(),
        uploadedVia: "presigned-s3",
      };
      if (uploaderUserId) raw.uploaderUserId = uploaderUserId;
      if (uploaderBrandId) raw.uploaderBrandId = uploaderBrandId;
      if (uploaderFactoryId) raw.uploaderFactoryId = uploaderFactoryId;
      if (uploaderDistributorId) raw.uploaderDistributorId = uploaderDistributorId;
      if (uploaderLabId) raw.uploaderLabId = uploaderLabId;
      raw.uploaderRole = sessionUser?.role || null;
      const doc = await prisma.document.create({
        data: {
          kind: "REPORT",
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          bucket: prefetchedS3.bucket,
          key: prefetchedS3.key,
          url: prefetchedS3.url,
          labId: uploaderLabId,
          raw,
        },
      });
      document = {
        id: doc.id,
        bucket: prefetchedS3.bucket,
        key: prefetchedS3.key,
        url: prefetchedS3.url,
      };
    } else if (isS3Configured()) {
      const result = await uploadDocument({
        kind: "REPORT",
        file: {
          buffer,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        },
        entity: { labId: uploaderLabId || null },
        uploaderUserId,
        acl: {
          brandId: uploaderBrandId,
          factoryId: uploaderFactoryId,
          distributorId: uploaderDistributorId,
          labId: uploaderLabId || null,
        },
        extraRaw: { uploaderRole: sessionUser?.role || null },
      });
      document = {
        id: result.documentId,
        bucket: result.bucket,
        key: result.key,
        url: result.url,
      };
    } else {
      // Dev fallback: base64 data URL in Document.url.
      const base64 = buffer.toString("base64");
      document = await prisma.document.create({
        data: {
          kind: "REPORT",
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          url: `data:application/pdf;base64,${base64}`,
          labId: uploaderLabId,
          raw: {
            uploaderUserId,
            uploaderDistributorId,
            uploaderFactoryId,
            uploaderBrandId,
            uploaderRole: sessionUser?.role || null,
            uploadedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Phase 15 IMP-6 — internal-only ping to admin + lab manager
    // when raw test data lands, BEFORE the brand-visible stamp.
    // Fire-and-forget so a notify failure can't block the upload.
    // D3 (Bureau Veritas) — always notify FUZE admins on any lab
    // upload, not only when the uploader has a labId. Lab managers
    // are still only pinged when a labId is present.
    {
      const labRow = uploaderLabId
        ? await prisma.lab
            .findUnique({ where: { id: uploaderLabId }, select: { name: true } })
            .catch(() => null)
        : null;
      notifyRawDataReceived({
        testRunId: document.id,
        labId: uploaderLabId || null,
        labName: labRow?.name || null,
        testType: "Lab upload",
      }).catch((e) => console.warn("[raw-data-received] notify failed:", e));
    }

    // Detect report type and parse accordingly
    let parsed: ParsedTestData | null = null;
    let itsReport: ParsedITSReport | null = null;
    let aiReview: any = null;
    let aiVision: AIExtractedTestData | null = null;

    // Threshold below which we suspect the PDF is image-based and
    // worth sending to Claude vision. ~200 chars is roughly 1 page
    // of pure metadata (headers/footers extracted but no body text).
    const meaningfulText = (pdfText || "").replace(/\s+/g, " ").trim();
    const isLikelyImagePdf = meaningfulText.length < 200;

    if (pdfText && !parseError) {
      try {
        if (isITSReport(pdfText)) {
          // ── ITS Taiwan report → use rich method-specific parser
          itsReport = parseITSReport(pdfText);

          // Auto-call AI review (non-blocking — don't fail upload if AI fails)
          try {
            aiReview = await callAIReview(itsReport);
          } catch (err) {
            console.error("AI review failed (non-critical):", err);
          }
        } else {
          // ── Other lab reports → use legacy flat parser
          parsed = parseTestReport(pdfText);
        }
      } catch (err: any) {
        parseError = `Report parsing failed: ${err.message}`;
      }
    }

    // ── AI vision fallback for image-based PDFs ──────────────────
    // Tina's Chinese-lab scans (VL Shanghai etc.) lose all text in
    // pdf-parse and score 0% on the regex parser. Send the PDF
    // straight to Claude — it natively reads scanned PDFs without a
    // separate OCR step.
    //
    // Trigger when:
    //   - pdf-parse extracted essentially nothing (<200 chars), OR
    //   - the regex parser scored very low (<25), AND we're not on
    //     an ITS report (those have their own dedicated parser)
    const lowConfidenceFlat = parsed && parsed.confidence < 25 && !itsReport;
    if ((isLikelyImagePdf || lowConfidenceFlat) && !itsReport) {
      try {
        aiVision = await extractTestDataWithAIVision(buffer, file.name);
        // If the AI extraction beats the flat parser, swap the flat
        // parsed result for the AI's. We keep the AI output in a
        // separate field too so the UI can show "extracted via AI
        // vision" provenance.
        if (aiVision && (!parsed || aiVision.confidence > (parsed.confidence || 0))) {
          parsed = {
            testType: aiVision.testType,
            testReportNumber: aiVision.testReportNumber,
            labName: aiVision.labName,
            testDate: aiVision.testDate,
            testMethodStd: aiVision.testMethodStd,
            fabricInfo: aiVision.fabricInfo,
            washCount: aiVision.washCount,
            organisms: aiVision.organisms || [],
            icpResults: aiVision.icpResults || [],
            fungalResult: aiVision.fungalResult,
            odorResult: aiVision.odorResult,
            overallPass: aiVision.overallPass,
            confidence: aiVision.confidence,
            rawText: "",
            warnings: [
              `Extracted via AI vision (image-based PDF, ${meaningfulText.length} chars text).`,
              ...(aiVision.warnings || []),
            ],
          };
        }
      } catch (err: any) {
        console.error("AI vision fallback failed:", err);
        // Don't fail the upload — the document is already saved and
        // an admin can review manually.
      }
    }

    // ── Duplicate Detection ─────────────────────────────────────
    // Check if a test with the same report number already exists
    let duplicateWarning: string | null = null;
    let existingTestIds: string[] = [];
    const reportNum = itsReport?.header?.reportNumber || parsed?.testReportNumber || null;

    if (reportNum) {
      const existingTests = await prisma.testRun.findMany({
        where: { testReportNumber: reportNum },
        select: { id: true, testType: true, testDate: true, createdAt: true },
      });
      if (existingTests.length > 0) {
        existingTestIds = existingTests.map((t) => t.id);
        duplicateWarning = `A test report with number "${reportNum}" already exists (${existingTests.length} record${existingTests.length > 1 ? "s" : ""}). Confirming will create a duplicate.`;
      }
    }

    // Also check by filename — same PDF uploaded before
    const existingDocs = await prisma.document.findMany({
      where: {
        filename: file.name,
        testRunId: { not: null },
        id: { not: document.id },
      },
      select: { id: true, testRunId: true, createdAt: true },
    });
    if (existingDocs.length > 0 && !duplicateWarning) {
      duplicateWarning = `A file named "${file.name}" has already been uploaded and linked to ${existingDocs.length} test(s). This may be a duplicate.`;
      existingTestIds = existingDocs.map((d) => d.testRunId).filter(Boolean) as string[];
    }

    // Fire-and-forget admin notification for low-confidence uploads.
    // Triggers if confidence is < 50, AI vision was used, or text
    // extraction errored. Doesn't block the response — wrapped in
    // void so the user gets their answer immediately.
    const notifyConfidence = parsed?.confidence ?? itsReport?.tests?.[0]?.confidence ?? 0;
    const shouldNotify =
      !!parseError || !!aiVision || (notifyConfidence < 50 && (parsed || itsReport));
    if (shouldNotify) {
      const reason = parseError
        ? "PDF text extraction failed"
        : aiVision
          ? "AI vision used (image-based PDF)"
          : `Parser confidence ${notifyConfidence}% — manual review needed`;
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fuzeatlas.com");
      const uploaderEmail = sessionUser?.email || null;
      const uploaderLabName = uploaderLabId
        ? await prisma.lab
            .findUnique({ where: { id: uploaderLabId }, select: { name: true } })
            .then((l) => l?.name || null)
            .catch(() => null)
        : null;
      void notifyAdminOfPendingUpload({
        documentId: document.id,
        filename: file.name,
        uploaderEmail,
        uploaderLabName,
        confidence: Math.round(notifyConfidence),
        reason,
        testType: parsed?.testType || itsReport?.tests?.[0]?.testMethod || null,
        reportNumber: parsed?.testReportNumber || itsReport?.header?.reportNumber || null,
        appUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      documentId: document.id,
      filename: file.name,
      sizeBytes: file.size,
      // Legacy flat result (for non-ITS reports)
      parsed: itsReport ? null : parsed,
      // Rich ITS result (header + tests array)
      itsReport: itsReport
        ? {
            header: itsReport.header,
            tests: itsReport.tests.map((t) => ({
              ...t,
              rawSection: undefined, // Don't send raw section text to client
            })),
          }
        : null,
      // AI review results
      aiReview,
      // AI vision fallback (when text extraction was insufficient)
      aiVision: aiVision
        ? {
            confidence: aiVision.confidence,
            testType: aiVision.testType,
            warnings: aiVision.warnings,
            usedAsPrimary: parsed?.warnings?.[0]?.startsWith("Extracted via AI vision") || false,
          }
        : null,
      parseError,
      // Duplicate detection
      duplicateWarning,
      existingTestIds,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * Async fire-and-forget admin notification for pending-review
 * uploads. Called after the upload returns OK (so the user
 * isn't waiting on Resend). Triggers when:
 *   - parser confidence is below 50, OR
 *   - AI vision was used as primary (image PDF), OR
 *   - parseError was non-null (text extraction failed entirely)
 *
 * Wrapped in a top-level try/catch so a failed email never breaks
 * the upload path. The handler that calls this should `void` it
 * — don't await.
 */
async function notifyAdminOfPendingUpload(payload: {
  documentId: string;
  filename: string;
  uploaderEmail: string | null;
  uploaderLabName: string | null;
  confidence: number;
  reason: string;
  testType: string | null;
  reportNumber: string | null;
  appUrl: string;
}) {
  try {
    const { sendEmail } = await import("@/lib/email");
    const adminEmails = (process.env.ADMIN_EMAILS || "andrew@fuze47.com")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (adminEmails.length === 0) return;

    const subject = `🔬 Pending review — ${payload.filename}`;
    const reviewUrl = `${payload.appUrl}/tests/review`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px;">
        <h2 style="margin: 0 0 8px; color: #0f172a;">Test report needs review</h2>
        <p style="margin: 0 0 16px; color: #475569;">
          Confidence too low for auto-confirmation. Please review and link to a brand/fabric.
        </p>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
          <tr><td style="padding: 4px 8px; color: #64748b;">File</td><td style="padding: 4px 8px;"><strong>${payload.filename}</strong></td></tr>
          <tr><td style="padding: 4px 8px; color: #64748b;">Uploaded by</td><td style="padding: 4px 8px;">${payload.uploaderEmail || "(unknown)"}${payload.uploaderLabName ? ` · ${payload.uploaderLabName}` : ""}</td></tr>
          <tr><td style="padding: 4px 8px; color: #64748b;">Confidence</td><td style="padding: 4px 8px;"><strong>${payload.confidence}%</strong> — ${payload.reason}</td></tr>
          ${payload.testType ? `<tr><td style="padding: 4px 8px; color: #64748b;">Test type</td><td style="padding: 4px 8px;">${payload.testType}</td></tr>` : ""}
          ${payload.reportNumber ? `<tr><td style="padding: 4px 8px; color: #64748b;">Report #</td><td style="padding: 4px 8px;">${payload.reportNumber}</td></tr>` : ""}
        </table>
        <a href="${reviewUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 18px; background: #00b4c3; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Open review queue →</a>
        <p style="margin-top: 16px; font-size: 12px; color: #94a3b8;">
          Auto-sent from Atlas. Adjust recipients in <code>ADMIN_EMAILS</code> env var.
        </p>
      </div>
    `;
    await sendEmail({ to: adminEmails, subject, html });
  } catch (e) {
    console.error("notifyAdminOfPendingUpload failed:", e);
  }
}
