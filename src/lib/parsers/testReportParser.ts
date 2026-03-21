/**
 * ITS Taiwan (Intertek) Test Report Parser
 * Supports: AATCC TM100, ASTM E2149, JIS L 1902
 * Handles multiple tests per PDF report.
 */

// ── Types ──────────────────────────────────────────────────

export interface ParsedReportHeader {
  reportNumber: string | null;       // "TWNC01429476" or "TWNC01422483-S1"
  isRevision: boolean;               // true if "-S1", "-S2" etc.
  supersedesReport: string | null;   // original report number if revision
  dateIssued: string | null;         // "Feb 24, 2026"
  applicant: string | null;          // "Fuze Biotech, L.L.C."
  itemName: string | null;           // "8-11786A Fabric"
  material: string | null;           // "100% Polyester, Padding"
  color: string | null;              // "Arabin Spice/Fired Brick"
  quantity: string | null;           // "1 Piece" or "1 Group"
  dateSampleReceived: string | null;
  dateTestStarted: string | null;
  labName: string;                   // Always "Intertek Testing Services Taiwan"
}

export interface ParsedAntibacterialTest {
  testIndex: number;                  // 1-based index within the report
  testMethod: string | null;          // "AATCC TM100-2019" | "ASTM E2149-20" | "JIS L 1902:2015"
  testTitle: string | null;           // Full test title from report

  // Organism
  organism: string | null;            // "Staphylococcus aureus" or "Escherichia coli"
  strainNumber: string | null;        // "ATCC 6538" or "ATCC 25922"

  // Test conditions
  sterilization: string | null;
  brothMedia: string | null;
  surfactant: string | null;
  contactTime: string | null;
  incubationTemp: string | null;
  incubationPeriod: string | null;
  agarMedium: string | null;
  bufferSolution: string | null;
  wettingAgent: string | null;
  swatchesWeight: string | null;

  // Numeric results
  inoculumCFU: number | null;         // Starting concentration
  inoculumRaw: string | null;
  controlCFU: number | null;          // Control after incubation
  controlRaw: string | null;
  treatedCFU: number | null;          // Treated after incubation
  treatedRaw: string | null;
  percentReduction: number | null;
  growthValue: number | null;         // F
  activityValue: number | null;       // JIS "A"

  // AATCC-specific (D, B', B, C, A naming)
  aatccD: number | null;    // viability control at 0hr
  aatccBprime: number | null; // viability control at 24hr
  aatccB: number | null;    // untreated control at 24hr
  aatccC: number | null;    // treated at 0hr
  aatccA: number | null;    // treated at 24hr

  // JIS-specific
  jisC0: number | null;     // standard cloth at 0hr
  jisCt: number | null;     // standard cloth at 18-24hr
  jisT0: number | null;     // treated at 0hr
  jisTt: number | null;     // treated at 18-24hr
  jisC0Log: number | null;
  jisCtLog: number | null;
  jisT0Log: number | null;
  jisTtLog: number | null;

  // ASTM-specific
  astmInitialCount: number | null;
  astmControlFlask: number | null;    // (b)
  astmTreatedFlask: number | null;    // (a)

  // Pass/fail assessment
  methodPass: boolean | null;
  methodPassReason: string | null;

  // Raw section text
  rawSection: string;
  confidence: number;                  // 0-100
  warnings: string[];
}

export interface ParsedITSReport {
  header: ParsedReportHeader;
  tests: ParsedAntibacterialTest[];
  rawText: string;
}

// ── Helper: parse CFU notation like "1.6 × 10^5" ─────────

function parseCFU(text: string): number | null {
  // Match patterns like "1.6 × 10 5", "2.5 x 10^5", "6.3 x 107"
  const patterns = [
    /(\d+\.?\d*)\s*[x×]\s*10\s*[\^]?\s*(\d+)/i,
    /(\d+\.?\d*)\s*[x×]\s*10(\d+)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      return parseFloat(m[1]) * Math.pow(10, parseInt(m[2]));
    }
  }
  return null;
}

function parseCFURaw(text: string): string | null {
  const m = text.match(/(\d+\.?\d*\s*[x×]\s*10\s*[\^]?\s*\d+\s*CFU[\/\w]*)/i);
  return m ? m[1].trim() : null;
}

// ── Header Parser ──────────────────────────────────────────

function parseHeader(text: string): ParsedReportHeader {
  const reportNumberMatch = text.match(/Number\s*:\s*(TWNC\d+(?:-S\d+)?)/i);
  const reportNumber = reportNumberMatch ? reportNumberMatch[1] : null;
  const isRevision = reportNumber ? /-S\d+$/.test(reportNumber) : false;

  let supersedesReport: string | null = null;
  const supersedesMatch = text.match(/SUPERSEDE\s+REPORT\s+NO\.\s*(TWNC\d+)/i);
  if (supersedesMatch) supersedesReport = supersedesMatch[1];

  const dateIssuedMatch = text.match(/Date\s+Issued\s*:\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
  const dateIssued = dateIssuedMatch ? dateIssuedMatch[1] : null;

  const itemNameMatch = text.match(/Item\s+Name\s*:\s*(.+?)(?:\n|Color)/is);
  const itemName = itemNameMatch ? itemNameMatch[1].replace(/\n/g, ' ').trim() : null;

  const colorMatch = text.match(/Color\s*:\s*(.+?)(?:\n|Quantity)/is);
  const color = colorMatch ? colorMatch[1].trim() : null;

  const quantityMatch = text.match(/Quantity\s*:\s*(.+?)(?:\n|Date)/is);
  const quantity = quantityMatch ? quantityMatch[1].trim() : null;

  const receivedMatch = text.match(/Date\s+Sample\s+Received\s*:\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
  const dateSampleReceived = receivedMatch ? receivedMatch[1] : null;

  const startedMatch = text.match(/Date\s+Test\s+Started\s*:\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
  const dateTestStarted = startedMatch ? startedMatch[1] : null;

  // Extract material from item name area (e.g. "100% Polyester, Padding")
  let material: string | null = null;
  const materialMatch = text.match(/Item\s+Name\s*:.*?\n\s*([\d%]+\s+\w+.*?)(?:\n|Color)/is);
  if (materialMatch) material = materialMatch[1].trim();

  return {
    reportNumber,
    isRevision,
    supersedesReport,
    dateIssued,
    applicant: "Fuze Biotech, L.L.C.",
    itemName,
    material,
    color,
    quantity,
    dateSampleReceived,
    dateTestStarted,
    labName: "Intertek Testing Services Taiwan",
  };
}

// ── Detect test method from section text ───────────────────

function detectTestMethod(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("aatcc") && (lower.includes("tm100") || lower.includes("100-20"))) {
    return "AATCC TM100-2019";
  }
  if (lower.includes("astm") && lower.includes("e2149")) {
    return "ASTM E2149-20";
  }
  if (lower.includes("jis") && lower.includes("1902")) {
    return "JIS L 1902:2015";
  }
  // Broader fallback
  if (lower.includes("aatcc 100")) return "AATCC TM100";
  if (lower.includes("jis l 1902")) return "JIS L 1902:2015";
  return null;
}

// ── Split PDF text into test sections ──────────────────────

function splitTestSections(text: string): string[] {
  // ITS reports number their tests: "1. Antibacterial...", "2. Antibacterial..."
  // Also handle "1. Testing For Antibacterial..." and "1. Anti-Bacterial Activity Test"
  const sectionPattern = /(?:^|\n)\s*(\d+)\.\s+(?:Antibacterial|Anti-Bacterial|Testing\s+For\s+Antibacterial|Anti-?microbial)/gim;

  const matches: { index: number; num: number }[] = [];
  let m;
  while ((m = sectionPattern.exec(text)) !== null) {
    matches.push({ index: m.index, num: parseInt(m[1]) });
  }

  if (matches.length === 0) {
    // Single test — return the whole text as one section
    return [text];
  }

  const sections: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push(text.substring(start, end));
  }
  return sections;
}

// ── Extract organism and strain ────────────────────────────

function extractOrganism(text: string): { organism: string | null; strain: string | null } {
  // Try "Test Organism : Staphylococcus aureus (ATCC 6538)"
  // Also "Test Culture : Escherichia coli (ATCC 25922)"
  // ITS format may have labels before the colon: "Test Culture \nTest Specimen \n\n: Escherichia coli"
  let m = text.match(/Test\s+Organism\s*:\s*([A-Z][a-z]+\s+[a-z]+)/i);
  let organism = m ? m[1].trim() : null;

  // Try: "Test Culture" followed eventually by ": <organism>"
  if (!organism) {
    m = text.match(/Test\s+Culture[\s\S]*?:\s*([A-Z][a-z]+\s+[a-z]+)\s*\(/i);
    organism = m ? m[1].trim() : null;
  }

  // Fallback: look for known organism names anywhere in text
  if (!organism) {
    const knownOrganisms = [
      "Staphylococcus aureus",
      "Escherichia coli",
      "Klebsiella pneumoniae",
      "Pseudomonas aeruginosa",
      "Candida albicans",
      "Aspergillus niger",
    ];
    for (const org of knownOrganisms) {
      if (text.includes(org)) { organism = org; break; }
    }
  }

  m = text.match(/\(ATCC\s+(\d+)\)/i);
  const strain = m ? `ATCC ${m[1]}` : null;

  return { organism, strain };
}

// ── Extract test condition field ───────────────────────────

function extractField(text: string, fieldName: string): string | null {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*:\\s*(.+?)(?:\\n|$)`, 'im');
  const m = text.match(pattern);
  return m ? m[1].trim() : null;
}

// ── AATCC TM100 Parser ────────────────────────────────────

function parseAATCC_TM100(section: string, index: number): ParsedAntibacterialTest {
  const warnings: string[] = [];
  const { organism, strain } = extractOrganism(section);

  // Extract conditions
  const sterilization = extractField(section, "Sterilization Of Sample Before Test");
  const brothMedia = extractField(section, "Broth Media");
  const surfactant = extractField(section, "Concentration Of Surfactant");
  const contactTime = extractField(section, "Contact Time");
  const incubationTemp = extractField(section, "Incubation Temperature");
  const incubationPeriod = extractField(section, "Incubation Period");
  const agarMedium = extractField(section, "Agar Medium");
  const swatchesWeight = extractField(section, "Swatches Weight");

  // Extract CFU values
  // D = viability control at "0" contact time
  // B' = viability control at 24hr
  // B = untreated control at 24hr
  // C = treated at "0" contact time
  // A = treated at 24hr

  let aatccD: number | null = null;
  let aatccBprime: number | null = null;
  let aatccB: number | null = null;
  let aatccC: number | null = null;
  let aatccA: number | null = null;

  // The ITS AATCC report has a two-column layout: labels on left, values on right.
  // After PDF text extraction, the organism name appears, then ALL CFU values in order:
  //   D (viability 0hr) → B' (viability 24hr) → B (untreated 24hr) → C (treated 0hr) → A (treated 24hr)
  // Followed by growth value F and percent reduction R.

  // Strategy: find the organism/strain line, then extract CFU values in order after it
  const cfuPattern = /(\d+\.?\d*)\s*[x×]\s*10\s*[\^]?\s*(\d+)\s*CFU/gi;
  const cfuMatches: { value: number; raw: string; index: number }[] = [];
  let cfuM;
  while ((cfuM = cfuPattern.exec(section)) !== null) {
    const val = parseFloat(cfuM[1]) * Math.pow(10, parseInt(cfuM[2]));
    cfuMatches.push({ value: val, raw: cfuM[0], index: cfuM.index });
  }

  // Assign CFU values in order: D, B', B, C, A
  if (cfuMatches.length >= 5) {
    aatccD = cfuMatches[0].value;
    aatccBprime = cfuMatches[1].value;
    aatccB = cfuMatches[2].value;
    aatccC = cfuMatches[3].value;
    aatccA = cfuMatches[4].value;
  } else if (cfuMatches.length >= 3) {
    // Partial extraction
    warnings.push(`Only ${cfuMatches.length} CFU values found (expected 5 for AATCC TM100)`);
  }

  // Growth value F and Percent reduction R appear AFTER all CFU values.
  // Positional: find text after the last CFU/Sample value and extract numbers.
  let growthValue: number | null = null;
  let percentReduction: number | null = null;

  if (cfuMatches.length > 0) {
    const lastIdx = cfuMatches[cfuMatches.length - 1].index + cfuMatches[cfuMatches.length - 1].raw.length;
    const afterCFUs = section.substring(lastIdx, lastIdx + 300);
    // First standalone number = growth value F, first number with % = percent reduction R
    const firstNum = afterCFUs.match(/\n\s*(\d+\.?\d+)\s*\n/);
    if (firstNum) growthValue = parseFloat(firstNum[1]);
    const pctMatch = afterCFUs.match(/(\d+\.?\d+)\s*%/);
    if (pctMatch) percentReduction = parseFloat(pctMatch[1]);
  }

  // Confidence scoring
  let confidence = 0;
  if (organism) confidence += 15;
  if (aatccB !== null) confidence += 20;
  if (aatccA !== null) confidence += 20;
  if (percentReduction !== null) confidence += 20;
  if (brothMedia) confidence += 10;
  if (growthValue !== null) confidence += 15;

  // Warnings
  if (aatccD === null) warnings.push("Could not extract viability control at 0hr (D)");
  if (aatccB === null) warnings.push("Could not extract untreated control at 24hr (B)");

  return {
    testIndex: index,
    testMethod: "AATCC TM100-2019",
    testTitle: "Antibacterial Activity Test (AATCC TM100)",
    organism, strainNumber: strain,
    sterilization, brothMedia, surfactant, contactTime,
    incubationTemp, incubationPeriod, agarMedium,
    bufferSolution: null, wettingAgent: null, swatchesWeight,
    inoculumCFU: aatccD, inoculumRaw: cfuMatches[0]?.raw || null,
    controlCFU: aatccB, controlRaw: cfuMatches[2]?.raw || null,
    treatedCFU: aatccA, treatedRaw: cfuMatches[4]?.raw || null,
    percentReduction, growthValue,
    activityValue: null,
    aatccD, aatccBprime, aatccB, aatccC, aatccA,
    jisC0: null, jisCt: null, jisT0: null, jisTt: null,
    jisC0Log: null, jisCtLog: null, jisT0Log: null, jisTtLog: null,
    astmInitialCount: null, astmControlFlask: null, astmTreatedFlask: null,
    methodPass: percentReduction !== null ? percentReduction >= 50 : null,
    methodPassReason: percentReduction !== null
      ? `R=${percentReduction}%, threshold varies by client spec`
      : null,
    rawSection: section,
    confidence,
    warnings,
  };
}

// ── ASTM E2149 Parser ──────────────────────────────────────

function parseASTM_E2149(section: string, index: number): ParsedAntibacterialTest {
  const warnings: string[] = [];
  const { organism, strain } = extractOrganism(section);

  const sterilization = extractField(section, "Sterilization Of Sample Before Test");
  const brothMedia = extractField(section, "Broth Media");
  const bufferSolution = extractField(section, "Working Buffer Solution");
  const wettingAgent = extractField(section, "Wetting Agent");
  const contactTime = extractField(section, "Contact Time");
  const incubationTemp = extractField(section, "Incubation Temperature");
  const incubationPeriod = extractField(section, "Incubation Period");
  const agarMedium = extractField(section, "Agar Medium");

  // Initial Count
  const initialMatch = section.match(/Initial\s+Count[\s\S]*?(\d+\.?\d*\s*[x×]\s*10\s*[\^]?\s*\d+)/i);
  const astmInitialCount = initialMatch ? parseCFU(initialMatch[1]) : null;

  // Control flask (b) — "inoculum only flask"
  const controlMatch = section.match(/inoculum\s+only\s+flask[\s\S]*?(\d+\.?\d*\s*[x×]\s*10\s*[\^]?\s*\d+)/i);
  const astmControlFlask = controlMatch ? parseCFU(controlMatch[1]) : null;

  // Treated flask (a)
  const treatedMatch = section.match(/treated\s+sample[\s\S]*?(\d+\.?\d*\s*[x×]\s*10\s*[\^]?\s*\d+)/i);
  const astmTreatedFlask = treatedMatch ? parseCFU(treatedMatch[1]) : null;

  // Percent reduction — may be on its own line as "87.46%"
  let percentReduction: number | null = null;
  const pctMatch = section.match(/(?:percent\s+reduction|reduction\s+of\s+bacteria)[\s\S]*?(\d+\.?\d+)\s*%/i);
  if (pctMatch) {
    percentReduction = parseFloat(pctMatch[1]);
  } else {
    // Fallback: find a standalone percentage near the end of the result section
    const standaloneMatch = section.match(/(\d+\.?\d+)\s*%\s*\n/);
    if (standaloneMatch) percentReduction = parseFloat(standaloneMatch[1]);
  }

  let confidence = 0;
  if (organism) confidence += 15;
  if (astmControlFlask !== null) confidence += 25;
  if (astmTreatedFlask !== null) confidence += 25;
  if (percentReduction !== null) confidence += 20;
  if (brothMedia) confidence += 15;

  return {
    testIndex: index,
    testMethod: "ASTM E2149-20",
    testTitle: "Anti-Bacterial Activity Test (Quantitative) — ASTM E2149",
    organism, strainNumber: strain,
    sterilization, brothMedia, surfactant: null, contactTime,
    incubationTemp, incubationPeriod, agarMedium,
    bufferSolution, wettingAgent, swatchesWeight: null,
    inoculumCFU: astmInitialCount, inoculumRaw: initialMatch ? initialMatch[1] : null,
    controlCFU: astmControlFlask, controlRaw: controlMatch ? controlMatch[1] : null,
    treatedCFU: astmTreatedFlask, treatedRaw: treatedMatch ? treatedMatch[1] : null,
    percentReduction, growthValue: null, activityValue: null,
    aatccD: null, aatccBprime: null, aatccB: null, aatccC: null, aatccA: null,
    jisC0: null, jisCt: null, jisT0: null, jisTt: null,
    jisC0Log: null, jisCtLog: null, jisT0Log: null, jisTtLog: null,
    astmInitialCount, astmControlFlask, astmTreatedFlask,
    methodPass: percentReduction !== null ? percentReduction >= 80 : null,
    methodPassReason: percentReduction !== null
      ? `R=${percentReduction}%, typical threshold 80-90%`
      : null,
    rawSection: section,
    confidence,
    warnings,
  };
}

// ── JIS L 1902 Parser ──────────────────────────────────────

function parseJIS_L1902(section: string, index: number): ParsedAntibacterialTest {
  const warnings: string[] = [];
  const { organism, strain } = extractOrganism(section);

  const sterilization = extractField(section, "Sterilization Of Sample Before Test");
  const surfactant = extractField(section, "Concentration Of Surfactant");

  // JIS reports have a two-column layout like AATCC.
  // After text extraction, CFU values appear in order:
  //   Inoculum → C0 (standard 0hr) → Ct (standard 18-24hr) → T0 (treated 0hr) → Tt (treated 18-24hr)
  const cfuPattern = /(\d+\.?\d*)\s*[x×]\s*10\s*[\^]?\s*(\d+)\s*CFU/gi;
  const cfuMatches: { value: number; raw: string }[] = [];
  let cfuM;
  while ((cfuM = cfuPattern.exec(section)) !== null) {
    cfuMatches.push({ value: parseFloat(cfuM[1]) * Math.pow(10, parseInt(cfuM[2])), raw: cfuM[0] });
  }

  // Inoculum concentration (first CFU value, typically marked as CFU/mL)
  const inoculumCFU = cfuMatches.length > 0 ? cfuMatches[0].value : null;

  // C0 — standard cloth at 0hr (second value)
  const jisC0 = cfuMatches.length > 1 ? cfuMatches[1].value : null;

  // Ct — standard cloth at 18-24hr (third value)
  const jisCt = cfuMatches.length > 2 ? cfuMatches[2].value : null;

  // T0 — treated at 0hr (fourth value)
  const jisT0 = cfuMatches.length > 3 ? cfuMatches[3].value : null;

  // Tt — treated at 18-24hr (fifth value)
  const jisTt = cfuMatches.length > 4 ? cfuMatches[4].value : null;

  // Extract log values
  const logPattern = /\(Log\s*:\s*(\d+\.?\d*)\)/g;
  const logValues: number[] = [];
  let lm;
  while ((lm = logPattern.exec(section)) !== null) {
    logValues.push(parseFloat(lm[1]));
  }
  // Order: C0 log, Ct log, T0 log, Tt log
  const jisC0Log = logValues[0] ?? null;
  const jisCtLog = logValues[1] ?? null;
  const jisT0Log = logValues[2] ?? null;
  const jisTtLog = logValues[3] ?? null;

  // Growth value F and Activity value A appear AFTER the last (Log : X.X) values.
  // In ITS JIS reports: after last "(Log : 7.0)" comes "2.5\n-0.2\n..."
  let growthValue: number | null = null;
  let activityValue: number | null = null;
  let percentReduction: number | null = null;

  // Find the last "(Log : X.X)" occurrence and look for numbers after it
  const logMatches = [...section.matchAll(/\(Log\s*:\s*\d+\.?\d*\)/gi)];
  if (logMatches.length > 0) {
    const lastLogEnd = logMatches[logMatches.length - 1].index! + logMatches[logMatches.length - 1][0].length;
    const afterLog = section.substring(lastLogEnd, lastLogEnd + 200);
    const nums = afterLog.match(/([-]?\d+\.?\d+)/g);
    if (nums && nums.length >= 1) growthValue = parseFloat(nums[0]);
    if (nums && nums.length >= 2) activityValue = parseFloat(nums[1]);
    const pctMatch = afterLog.match(/(\d+\.?\d+)\s*%/);
    if (pctMatch) percentReduction = parseFloat(pctMatch[1]);
  } else if (cfuMatches.length > 0) {
    // Fallback: look after last CFU value
    const lastCfuEnd = section.lastIndexOf("CFU") + 10;
    const afterCFU = section.substring(lastCfuEnd, lastCfuEnd + 200);
    const nums = afterCFU.match(/([-]?\d+\.?\d+)/g);
    if (nums && nums.length >= 1) growthValue = parseFloat(nums[0]);
    if (nums && nums.length >= 2) activityValue = parseFloat(nums[1]);
  }

  // Type of sample material
  const sampleMaterial = extractField(section, "Type of sample material");
  const measuringMethod = extractField(section, "Measuring method of number of living bacteria");

  // Pass/fail per JIS: A >= 2.0 = Effect, A >= 3.0 = Full Effect
  let methodPass: boolean | null = null;
  let methodPassReason: string | null = null;
  if (activityValue !== null) {
    methodPass = activityValue >= 2.0;
    if (activityValue >= 3.0) {
      methodPassReason = `A=${activityValue}, Full Effect (A≥3.0)`;
    } else if (activityValue >= 2.0) {
      methodPassReason = `A=${activityValue}, Effect (2.0≤A<3.0)`;
    } else {
      methodPassReason = `A=${activityValue}, requires A≥2.0 for antibacterial effect`;
    }
  }

  let confidence = 0;
  if (organism) confidence += 10;
  if (jisC0 !== null) confidence += 15;
  if (jisCt !== null) confidence += 15;
  if (jisT0 !== null) confidence += 15;
  if (jisTt !== null) confidence += 15;
  if (activityValue !== null) confidence += 20;
  if (growthValue !== null) confidence += 10;

  if (cfuMatches.length < 5) warnings.push(`Only ${cfuMatches.length} CFU values found (expected 5 for JIS L 1902)`);
  if (jisTt === null) warnings.push("Could not extract Tt (treated sample after incubation)");

  return {
    testIndex: index,
    testMethod: "JIS L 1902:2015",
    testTitle: "Testing For Antibacterial Activity And Efficacy On Textile Products (Absorption Method)",
    organism, strainNumber: strain,
    sterilization, brothMedia: null, surfactant, contactTime: null,
    incubationTemp: null, incubationPeriod: null,
    agarMedium: null, bufferSolution: null, wettingAgent: null, swatchesWeight: null,
    inoculumCFU, inoculumRaw: cfuMatches[0]?.raw || null,
    controlCFU: jisCt, controlRaw: cfuMatches[2]?.raw || null,
    treatedCFU: jisTt, treatedRaw: cfuMatches[4]?.raw || null,
    percentReduction, growthValue, activityValue,
    aatccD: null, aatccBprime: null, aatccB: null, aatccC: null, aatccA: null,
    jisC0, jisCt, jisT0, jisTt,
    jisC0Log, jisCtLog, jisT0Log, jisTtLog,
    astmInitialCount: null, astmControlFlask: null, astmTreatedFlask: null,
    methodPass, methodPassReason,
    rawSection: section,
    confidence,
    warnings,
  };
}

// ── Main Orchestrator ──────────────────────────────────────

export function parseITSReport(text: string): ParsedITSReport {
  const header = parseHeader(text);
  const sections = splitTestSections(text);

  const tests: ParsedAntibacterialTest[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const method = detectTestMethod(section);
    const testIndex = i + 1;

    if (method === "AATCC TM100-2019" || method === "AATCC TM100") {
      tests.push(parseAATCC_TM100(section, testIndex));
    } else if (method === "ASTM E2149-20") {
      tests.push(parseASTM_E2149(section, testIndex));
    } else if (method === "JIS L 1902:2015") {
      tests.push(parseJIS_L1902(section, testIndex));
    } else {
      // Unknown method — try to detect from broader context
      const fullLower = section.toLowerCase();
      if (fullLower.includes("percent reduction") || fullLower.includes("colony forming")) {
        // Generic antibacterial — default to AATCC-like parsing
        const parsed = parseAATCC_TM100(section, testIndex);
        parsed.testMethod = null;
        parsed.warnings.push("Could not determine test method standard");
        tests.push(parsed);
      }
    }
  }

  return { header, tests, rawText: text };
}
