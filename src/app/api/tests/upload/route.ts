// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── PDF text extraction (lightweight, no native deps) ────────── */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Use pdf-parse for text extraction
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

/* ── Pattern-based parser for lab test reports ────────────────── */
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
  confidence: number; // 0-100 how confident the parse is
  rawText: string;
  warnings: string[];
}

function parseTestReport(text: string): ParsedTestData {
  const warnings: string[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // ── Detect test type ──────────────────────────────────
  let testType: string | null = null;
  if (fullText.includes("antibacterial") || fullText.includes("aatcc 100") || fullText.includes("aatcc 147") || fullText.includes("iso 20743")) {
    testType = "ANTIBACTERIAL";
  } else if (fullText.includes("icp") || fullText.includes("inductively coupled") || fullText.includes("icp-ms") || fullText.includes("icp-oes")) {
    testType = "ICP";
  } else if (fullText.includes("antifungal") || fullText.includes("fungal") || fullText.includes("aatcc 30") || fullText.includes("iso 13629")) {
    testType = "FUNGAL";
  } else if (fullText.includes("odor") || fullText.includes("smell") || fullText.includes("aatcc 199")) {
    testType = "ODOR";
  } else if (fullText.includes("uv ") || fullText.includes("ultraviolet") || fullText.includes("upf")) {
    testType = "UV";
  }

  if (!testType) {
    warnings.push("Could not auto-detect test type. Please select manually.");
  }

  // ── Extract report number ──────────────────────────────
  let testReportNumber: string | null = null;
  const reportPatterns = [
    // Lab-specific ID patterns (most specific first)
    /CTLA\s*ID[.:\s]*([A-Z0-9][\w\-\/]*)/i,
    /(?:TWN|SGS|ITS|NOA)\s*(?:report|ref|id|no)[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    // Generic patterns
    /report\s*(?:no|number|#|num)[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /test\s*report[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /report\s*id[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /certificate\s*(?:no|number|#)[.:\s]*([A-Z0-9][\w\-\/]+)/i,
    /(?:COA|coa)[_\-\s]*(\d{4,})/i,
    /ref(?:erence)?[.:\s]*([A-Z0-9][\w\-\/]+)/i,
  ];
  for (const pat of reportPatterns) {
    const m = text.match(pat);
    if (m) { testReportNumber = m[1]; break; }
  }
  // If still no report number, try extracting from the filename
  // (the upload page can pass the filename as context later)

  // ── Extract lab name ───────────────────────────────────
  // Order matters: longer / more specific names first to avoid
  // false positives (e.g. "UL" matching "result", "should", etc.)
  let labName: string | null = null;
  const knownLabs = [
    // Multi-word labs first
    "Antimicrobial Test Laboratories", "EMSL Analytical",
    "Microchem Laboratory", "Nelson Labs", "Bureau Veritas",
    "Contract Testing Laboratories", "CTLA",
    // Medium-length names
    "Intertek", "Eurofins", "Hohenstein", "OEKO-TEX", "Testex",
    "Vartest", "Silliker",
    // Short acronyms — use word-boundary matching to avoid false positives
    "SGS", "TÜV", "TUV", "NSF", "AATCC",
    "NOA", "ITS", "CTC", "ACTS", "ATL",
  ];
  // Short labs (<=3 chars) need word-boundary matching to avoid false hits
  for (const lab of knownLabs) {
    if (lab.length <= 3) {
      // Use word boundary regex so "UL" doesn't match "result"
      const re = new RegExp(`\\b${lab}\\b`, "i");
      if (re.test(text)) { labName = lab; break; }
    } else {
      if (text.toLowerCase().includes(lab.toLowerCase())) {
        labName = lab;
        break;
      }
    }
  }

  // ── Extract test date ──────────────────────────────────
  let testDate: string | null = null;
  const datePatterns = [
    /(?:date\s*(?:of\s*)?(?:test|report|issue|analysis))[.:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(?:date\s*(?:of\s*)?(?:test|report|issue|analysis))[.:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) { testDate = m[1]; break; }
  }

  // ── Extract test method ────────────────────────────────
  let testMethodStd: string | null = null;
  const methodPatterns = [
    /(?:AATCC|ISO|ASTM|EN|JIS)\s*(?:TM\s*)?\d+[\w.-]*/i,
  ];
  for (const pat of methodPatterns) {
    const m = text.match(pat);
    if (m) { testMethodStd = m[0].toUpperCase(); break; }
  }

  // ── Extract wash count ─────────────────────────────────
  let washCount: number | null = null;
  const washMatch = text.match(/(\d+)\s*(?:wash(?:es)?|washes|launder(?:ing)?|cycle)/i);
  if (washMatch) washCount = parseInt(washMatch[1], 10);

  // ── Extract fabric info ────────────────────────────────
  let fabricInfo: string | null = null;
  const fabricMatch = text.match(/(?:fabric|sample|material|substrate)[.:\s]*([^\n]{5,80})/i);
  if (fabricMatch) fabricInfo = fabricMatch[1].trim();

  // ── Antibacterial results ──────────────────────────────
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
      if (m) {
        organisms.push({ name: op.name, result: `${m[1]}% reduction`, reduction: parseFloat(m[1]) });
      }
    }
    // Also look for generic "reduction" values
    if (organisms.length === 0) {
      const reductionMatch = text.match(/([\d.]+)\s*%\s*(?:reduction|kill)/i);
      if (reductionMatch) {
        organisms.push({ name: "Unknown organism", result: `${reductionMatch[1]}% reduction`, reduction: parseFloat(reductionMatch[1]) });
        warnings.push("Could not identify specific organism names. Please verify.");
      }
    }
  }

  // ── ICP results ────────────────────────────────────────
  const icpResults: { metal: string; value: number | null; unit: string }[] = [];
  if (testType === "ICP") {
    const agMatch = text.match(/(?:silver|Ag)\s*[:\-]?\s*([\d.]+)\s*(ppm|mg\/kg|mg\/l|ppb|μg\/g)/i);
    if (agMatch) {
      icpResults.push({ metal: "Ag", value: parseFloat(agMatch[1]), unit: agMatch[2] });
    }
    const auMatch = text.match(/(?:gold|Au)\s*[:\-]?\s*([\d.]+)\s*(ppm|mg\/kg|mg\/l|ppb|μg\/g)/i);
    if (auMatch) {
      icpResults.push({ metal: "Au", value: parseFloat(auMatch[1]), unit: auMatch[2] });
    }
    // Generic metals
    const metalPattern = /(\w+)\s*[:\-]?\s*([\d.]+)\s*(ppm|mg\/kg|ppb)/gi;
    let mm;
    while ((mm = metalPattern.exec(text)) !== null) {
      const metalName = mm[1];
      if (!["Ag", "Au", "silver", "gold"].includes(metalName.toLowerCase()) && icpResults.length < 10) {
        icpResults.push({ metal: metalName, value: parseFloat(mm[2]), unit: mm[3] });
      }
    }
  }

  // ── Fungal result ──────────────────────────────────────
  let fungalResult: { result: string; pass: boolean | null } | null = null;
  if (testType === "FUNGAL") {
    const fungalPassMatch = text.match(/(?:result|assessment|grade)[.:\s]*(pass|fail|no\s*growth|growth|zone\s*of\s*inhibition)/i);
    if (fungalPassMatch) {
      const val = fungalPassMatch[1].toLowerCase();
      fungalResult = {
        result: fungalPassMatch[1],
        pass: val.includes("pass") || val.includes("no growth") || val.includes("zone"),
      };
    }
  }

  // ── Odor result ────────────────────────────────────────
  let odorResult: { result: string; pass: boolean | null } | null = null;
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

  // ── Overall pass/fail ──────────────────────────────────
  let overallPass: boolean | null = null;
  const passMatch = text.match(/(?:overall|final|conclusion|result)[.:\s]*(pass|fail|compliant|non-compliant|meets|does not meet)/i);
  if (passMatch) {
    const val = passMatch[1].toLowerCase();
    overallPass = val.includes("pass") || val.includes("compliant") || val.includes("meets");
  }

  // ── Confidence scoring ─────────────────────────────────
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

/* ── POST /api/tests/upload ─────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "Only PDF files are accepted" }, { status: 400 });
    }

    // Max 25MB
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 25MB)" }, { status: 400 });
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store as base64 data URL
    const base64 = buffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;

    // Extract text from PDF
    let pdfText = "";
    let parseError: string | null = null;
    try {
      pdfText = await extractPdfText(buffer);
    } catch (err: any) {
      parseError = `PDF text extraction failed: ${err.message}`;
    }

    // Parse test data from extracted text
    let parsed: ParsedTestData | null = null;
    if (pdfText && !parseError) {
      try {
        parsed = parseTestReport(pdfText);
      } catch (err: any) {
        parseError = `Report parsing failed: ${err.message}`;
      }
    }

    // Store document record
    const document = await prisma.document.create({
      data: {
        kind: "REPORT",
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        url: dataUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      documentId: document.id,
      filename: file.name,
      sizeBytes: file.size,
      parsed,
      parseError,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
