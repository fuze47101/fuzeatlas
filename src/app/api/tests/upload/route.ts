// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseITSReport } from "@/lib/parsers/testReportParser";
import type { ParsedITSReport } from "@/lib/parsers/testReportParser";
import { uploadToS3, generateS3Key, isS3Configured, S3_PREFIXES } from "@/lib/s3";

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
    /CTLA\s*ID[.:\s]*([A-Z0-9][\w\-\/]*)/i,
    /(?:TWN|SGS|ITS|NOA)\s*(?:report|ref|id|no)[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /report\s*(?:no|number|#|num)[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /test\s*report[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /report\s*id[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /certificate\s*(?:no|number|#)[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /(?:COA|coa)[_\-\s]*(\d{4,})/i,
    /ref(?:erence)?[.:\s]*([A-Z0-9][\w\-\/]+)/i,
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
  const methodMatch = text.match(/(?:AATCC|ISO|ASTM|EN|JIS)\s*(?:TM\s*)?\d+[\w.-]*/i);
  if (methodMatch) testMethodStd = methodMatch[0].toUpperCase();

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

  const icpResults: { metal: string; value: number | null; unit: string }[] = [];
  if (testType === "ICP") {
    const agMatch = text.match(/(?:silver|Ag)\s*[:\-]?\s*([\d.]+)\s*(ppm|mg\/kg|mg\/l|ppb|μg\/g)/i);
    if (agMatch) icpResults.push({ metal: "Ag", value: parseFloat(agMatch[1]), unit: agMatch[2] });
    const auMatch = text.match(/(?:gold|Au)\s*[:\-]?\s*([\d.]+)\s*(ppm|mg\/kg|mg\/l|ppb|μg\/g)/i);
    if (auMatch) icpResults.push({ metal: "Au", value: parseFloat(auMatch[1]), unit: auMatch[2] });
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
  if (confidence < 50) warnings.push("Low confidence parse. Please review all fields carefully.");

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
export async function POST(req: Request) {
  try {
    // Capture uploading user (lab or admin) for attribution
    const sessionUser = await getCurrentUser().catch(() => null);
    const uploaderLabId = sessionUser?.labId || null;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "Only PDF files are accepted" },
        { status: 400 },
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 25MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3 if configured, otherwise fall back to base64
    let fileUrl: string;
    let s3Bucket: string | null = null;
    let s3Key: string | null = null;

    if (isS3Configured()) {
      const key = generateS3Key(S3_PREFIXES.TEST_REPORTS, file.name);
      const s3Result = await uploadToS3(key, buffer, file.type, {
        originalFilename: file.name,
        uploadedAt: new Date().toISOString(),
      });
      fileUrl = s3Result.url;
      s3Bucket = s3Result.bucket;
      s3Key = s3Result.key;
    } else {
      // Fallback: base64 data URL (legacy)
      const base64 = buffer.toString("base64");
      fileUrl = `data:application/pdf;base64,${base64}`;
    }

    // Extract text from PDF
    let pdfText = "";
    let parseError: string | null = null;
    try {
      pdfText = await extractPdfText(buffer);
    } catch (err: any) {
      parseError = `PDF text extraction failed: ${err.message}`;
    }

    // Store document record
    const document = await prisma.document.create({
      data: {
        kind: "REPORT",
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        url: fileUrl,
        bucket: s3Bucket,
        key: s3Key,
        labId: uploaderLabId,
      },
    });

    // Detect report type and parse accordingly
    let parsed: ParsedTestData | null = null;
    let itsReport: ParsedITSReport | null = null;
    let aiReview: any = null;

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
