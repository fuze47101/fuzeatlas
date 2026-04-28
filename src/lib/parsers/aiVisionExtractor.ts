// @ts-nocheck
/**
 * AI vision fallback for image-based test report PDFs.
 *
 * Tina's complaint: VL Shanghai (and other Chinese-lab) ICP reports
 * arrive as scanned PDFs with no text layer. pdf-parse extracts <100
 * chars from them, the regex parser scores 0%, and the file lands in
 * "Pending review" with nothing extracted.
 *
 * Anthropic's Claude API natively reads PDFs (no separate OCR step
 * needed) — we just base64 the file and ask for a structured
 * extraction. This module wraps that call and returns the same shape
 * the regex parser produces, so the upload route can swap one for
 * the other when text extraction yields too little to work with.
 *
 * Cost: each call is ~3-5K input tokens (a typical 2-3 page lab
 * report) plus ~500 output tokens. At Sonnet 4.x pricing this is
 * a few cents per upload — fine for one-off pending uploads.
 */

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export type AIExtractedTestData = {
  testType: string | null;          // ANTIBACTERIAL | ICP | FUNGAL | ODOR | UV
  testReportNumber: string | null;
  labName: string | null;
  testDate: string | null;
  testMethodStd: string | null;
  washCount: number | null;
  fabricInfo: string | null;
  organisms: Array<{ name: string; result: string; reduction: number | null }>;
  icpResults: Array<{ metal: string; value: number | null; unit: string }>;
  fungalResult: { result: string; pass: boolean } | null;
  odorResult: { result: string; pass: boolean } | null;
  overallPass: boolean | null;
  confidence: number;               // 0-100, AI's self-assessment
  rawText: string;                  // empty for AI-extracted (no source text)
  warnings: string[];
  source: "ai_vision";              // marker so callers know it's AI-derived
};

const EXTRACTION_PROMPT = `You are extracting structured data from a textile-industry lab test report PDF.
The PDF may be a scan of a printed report, possibly in Chinese, Korean, Japanese, or English.
Common labs: VL Shanghai, Bureau Veritas, Intertek (ITS), SGS, Eurofins, TÜV, CTLA, ITS Taiwan.

Return ONLY a JSON object with these fields. Use null when the field is not present or unclear.
Do NOT make up values — null is always preferred over a guess.

{
  "testType": "ANTIBACTERIAL" | "ICP" | "FUNGAL" | "ODOR" | "UV" | null,
  "testReportNumber": string | null,    // e.g. "VLS-2026-001234", "TWNC01429476", "EPA-6020-0815"
  "labName": string | null,             // e.g. "VL Shanghai", "Intertek Taiwan"
  "testDate": string | null,            // ISO date YYYY-MM-DD if extractable
  "testMethodStd": string | null,       // e.g. "AATCC 100", "EPA 6020A", "ICP-OES", "GB/T 26371-2010"
  "washCount": number | null,           // wash cycles for durability tests
  "fabricInfo": string | null,          // brief description of fabric tested
  "organisms": [                         // antibacterial organisms (only for ANTIBACTERIAL)
    { "name": "S. aureus" | "K. pneumoniae" | "E. coli" | "MRSA" | "P. aeruginosa" | string,
      "result": string,                 // e.g. "99.9% reduction"
      "reduction": number | null }       // numeric percent reduction
  ],
  "icpResults": [                        // metals (only for ICP reports)
    { "metal": "Ag" | "Pb" | "Cd" | "As" | "Hg" | "Cu" | "Zn" | "Ni" | "Sb" | "Ba" | "Cr" | "Co" | "Sn" | "Fe" | "Mn" | "Al" | "Au" | string,
      "value": number | null,
      "unit": "ppm" | "ppb" | "mg/kg" | "mg/L" | "μg/g" | "wt%" | "%" | string }
  ],
  "fungalResult": { "result": string, "pass": boolean } | null,
  "odorResult": { "result": string, "pass": boolean } | null,
  "overallPass": boolean | null,
  "confidence": number,                 // 0-100, your self-assessed confidence in the extraction
  "warnings": string[]                  // any caveats — e.g. "report number partially obscured", "labName inferred from header"
}

For ICP reports: extract EVERY metal that appears with a numeric value. Pay attention to detection-limit
markers like "<0.5 ppm" — record those as value: 0.5 with a warning that it's a detection limit.

For multi-page reports, scan all pages — the report number is usually on page 1 but element data
might be on a results table on page 2 or later.

Confidence rubric:
  90-100: every key field clear and unambiguous
  60-89:  most fields clear, 1-2 had to be inferred or are partially obscured
  30-59:  several fields are guesses or the document quality is poor
  0-29:   you couldn't read most of the document, very low confidence

Output ONLY the JSON. No preamble, no postamble, no markdown code fences.`;

/**
 * Send a PDF buffer to Claude and parse the structured response.
 * Throws if ANTHROPIC_API_KEY is missing or the API errors.
 */
export async function extractTestDataWithAIVision(
  buffer: Buffer,
  filename: string,
): Promise<AIExtractedTestData> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — AI vision fallback unavailable");
  }

  const base64Pdf = buffer.toString("base64");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
              // Helps Claude attribute info to the file when it
              // produces warnings.
              title: filename,
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 500)}`);
  }

  const json = await res.json();
  const text: string = json?.content?.[0]?.text || "";
  if (!text) {
    throw new Error("Anthropic returned empty content");
  }

  // Strip any accidental markdown code fences / preamble. Claude is
  // usually well-behaved here but defensively handle ```json ... ```.
  let jsonText = text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  // If Claude wrapped the JSON in some prose, find the first {…} block.
  if (!jsonText.startsWith("{")) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start >= 0 && end > start) {
      jsonText = jsonText.slice(start, end + 1);
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e: any) {
    throw new Error(
      `Failed to parse Claude JSON: ${e?.message}. First 200 chars: ${jsonText.slice(0, 200)}`,
    );
  }

  // Normalise to our shape — coerce types and fill missing arrays.
  const result: AIExtractedTestData = {
    testType: parsed.testType || null,
    testReportNumber: parsed.testReportNumber || null,
    labName: parsed.labName || null,
    testDate: parsed.testDate || null,
    testMethodStd: parsed.testMethodStd || null,
    washCount:
      typeof parsed.washCount === "number" ? parsed.washCount : null,
    fabricInfo: parsed.fabricInfo || null,
    organisms: Array.isArray(parsed.organisms) ? parsed.organisms : [],
    icpResults: Array.isArray(parsed.icpResults) ? parsed.icpResults : [],
    fungalResult: parsed.fungalResult || null,
    odorResult: parsed.odorResult || null,
    overallPass:
      typeof parsed.overallPass === "boolean" ? parsed.overallPass : null,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : 50,
    rawText: "",
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    source: "ai_vision",
  };

  return result;
}
