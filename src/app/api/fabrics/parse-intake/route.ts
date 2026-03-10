// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { uploadToS3, generateS3Key, isS3Configured, S3_PREFIXES } from "@/lib/s3";

const prisma = new PrismaClient();

// ─── PDF text extraction ────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

// ─── Call LLM for fabric data parsing ───────────────
async function parseFabricDataWithLLM(pdfText: string): Promise<any> {
  try {
    // Try OpenAI first
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const systemPrompt = `You are a textile expert parsing FUZE Fabric Intake Forms. Extract all fabric details into JSON.

Return ONLY valid JSON with these fields (null if not found):
{
  "brandCompanyName": string,
  "contactName": string,
  "contactEmail": string,
  "phone": string,
  "fabricName": string,
  "customerCode": string,
  "factoryCode": string,
  "batchLotNumber": string,
  "dateSubmitted": string,
  "quantity": string,
  "quantityUnit": "meters|yards",
  "endUse": string,
  "targetFuzeTier": string,
  "annualVolume": string,
  "annualVolumeUnit": "meters|yards",
  "fiberComposition": [{"fiberType": string, "percent": number, "denier": string, "stapleFilament": string}],
  "recycledContent": boolean,
  "recycledContentPercent": number,
  "recycledContentType": string,
  "yarnTwist": string,
  "fabricCategory": "woven|knit|nonwoven",
  "weavePattern": string,
  "threadCountWarp": number,
  "threadCountWeft": number,
  "knitStitchType": string,
  "gauge": string,
  "weightGsm": number,
  "widthInches": number,
  "thickness": number,
  "color": string,
  "shrinkageLength": number,
  "shrinkageWidth": number,
  "pretreatmentData": {
    "singeing": boolean,
    "singleingType": string,
    "desizing": boolean,
    "desizingMethod": string,
    "scouring": boolean,
    "scouringNaoh": number,
    "scouringTemp": number,
    "bleaching": boolean,
    "bleachingType": string,
    "bleachingConc": number,
    "bleachingTemp": number,
    "mercerization": boolean,
    "merceriationNaoh": number,
    "merceriationUnderTension": boolean,
    "heatSetting": boolean,
    "heatSettingTemp": number,
    "heatSettingTime": number
  },
  "fabricPh": number,
  "dyeApplied": boolean,
  "dyeStage": "yarn-dyed|piece-dyed|garment-dyed|greige",
  "dyeClass": ["reactive", "disperse", "acid", "vat", "sulfur", "pigment", "direct", "natural"],
  "dyeDetails": {
    "reactiveType": "vinyl-sulfone|MCT|DCT",
    "fixationTemp": number,
    "disperseEnergyLevel": "low|medium|high",
    "disperseCarrier": string,
    "dyeingMethod": "pad|exhaust|jet|package|continuous",
    "bathTemp": number,
    "bathPh": number,
    "saltConc": number,
    "postDyeingSoaping": boolean,
    "postDyeingRinsing": boolean,
    "postDyePh": number
  },
  "finishSoftener": {
    "applied": boolean,
    "type": "silicone|nonsilicone|wax",
    "siliconeType": "amino|macroEmulsion|microEmulsion|hydrophilic|polyetherModified",
    "ionicCharge": "cationic|anionic|nonionic",
    "concentration": number,
    "productName": string,
    "nonsiliconeType": "QAC|imidazoline",
    "waxType": string
  },
  "finishRepellent": {
    "applied": boolean,
    "type": "C6|C0|silicone|wax",
    "concentration": number,
    "pfoacPfosFree": boolean
  },
  "finishWicking": {
    "applied": boolean,
    "type": "polyether|polyurethane|acrylic",
    "ionicCharacter": "nonionic|anionic|cationic",
    "concentration": number
  },
  "finishWrinkleFree": {
    "applied": boolean,
    "crosslinker": "DMDHEU|BTCA|glyoxal|formaldehydeFree",
    "catalyst": "MgCl2|zinc",
    "concentration": number
  },
  "finishOther": {
    "antiPilling": boolean,
    "antiPillingType": string,
    "flameRetardant": boolean,
    "flameRetardantType": "phosphorus|halogenated",
    "uvProtection": boolean,
    "uvProtectionType": string,
    "stainRelease": boolean,
    "stainReleaseType": string,
    "antiStatic": boolean,
    "antiStaticType": string,
    "antibacterial": boolean,
    "antibacterialType": string
  },
  "specialRequirements": string,
  "chemicalIncompatibilities": string,
  "previousAntimicrobialTreatment": string,
  "submissionDate": string,
  "submittedBy": string,
  "confidence": number
}`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Parse this fabric intake form:\n\n${pdfText.substring(0, 4000)}` },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          try {
            return JSON.parse(content);
          } catch (e) {
            console.warn("Failed to parse LLM JSON response:", e);
          }
        }
      }
    }

    // Fallback to Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const systemPrompt = `You are a textile expert parsing FUZE Fabric Intake Forms. Extract all fabric details into JSON.

Return ONLY valid JSON with these fields (null if not found):
{
  "brandCompanyName": string,
  "contactName": string,
  "contactEmail": string,
  "phone": string,
  "fabricName": string,
  "customerCode": string,
  "factoryCode": string,
  "batchLotNumber": string,
  "dateSubmitted": string,
  "quantity": string,
  "quantityUnit": "meters|yards",
  "endUse": string,
  "targetFuzeTier": string,
  "annualVolume": string,
  "annualVolumeUnit": "meters|yards",
  "fiberComposition": [{"fiberType": string, "percent": number, "denier": string, "stapleFilament": string}],
  "recycledContent": boolean,
  "recycledContentPercent": number,
  "recycledContentType": string,
  "yarnTwist": string,
  "fabricCategory": "woven|knit|nonwoven",
  "weavePattern": string,
  "threadCountWarp": number,
  "threadCountWeft": number,
  "knitStitchType": string,
  "gauge": string,
  "weightGsm": number,
  "widthInches": number,
  "thickness": number,
  "color": string,
  "shrinkageLength": number,
  "shrinkageWidth": number,
  "fabricPh": number,
  "dyeApplied": boolean,
  "dyeStage": "yarn-dyed|piece-dyed|garment-dyed|greige",
  "dyeClass": ["reactive", "disperse", "acid", "vat", "sulfur", "pigment", "direct", "natural"],
  "finishSoftener": object,
  "finishRepellent": object,
  "finishWicking": object,
  "finishWrinkleFree": object,
  "finishOther": object,
  "specialRequirements": string,
  "chemicalIncompatibilities": string,
  "previousAntimicrobialTreatment": string,
  "confidence": number
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Parse this fabric intake form:\n\n${pdfText.substring(0, 4000)}`,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content?.[0]?.text;
        if (content) {
          try {
            return JSON.parse(content);
          } catch (e) {
            console.warn("Failed to parse Anthropic JSON response:", e);
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error("LLM parsing error:", err);
    return null;
  }
}

// ─── Map parsed data to Fabric model fields ─────────
function mapParsedDataToFabric(parsed: any): any {
  if (!parsed) return {};

  return {
    // Basic info (can match existing fabric or create new)
    customerCode: parsed.customerCode || undefined,
    factoryCode: parsed.factoryCode || undefined,
    color: parsed.color || undefined,
    batchLotNumber: parsed.batchLotNumber || undefined,

    // New intake form fields
    endUse: parsed.endUse || undefined,
    targetFuzeTier: parsed.targetFuzeTier || undefined,
    annualVolume: parsed.annualVolume || undefined,
    thickness: parsed.thickness ? parseFloat(parsed.thickness) : undefined,
    shrinkageLength: parsed.shrinkageLength ? parseFloat(parsed.shrinkageLength) : undefined,
    shrinkageWidth: parsed.shrinkageWidth ? parseFloat(parsed.shrinkageWidth) : undefined,
    fabricCategory: parsed.fabricCategory || undefined,
    knitStitchType: parsed.knitStitchType || undefined,
    weavePattern: parsed.weavePattern || undefined,
    gauge: parsed.gauge || undefined,
    threadCountWarp: parsed.threadCountWarp ? parseInt(parsed.threadCountWarp) : undefined,
    threadCountWeft: parsed.threadCountWeft ? parseInt(parsed.threadCountWeft) : undefined,
    weightGsm: parsed.weightGsm ? parseFloat(parsed.weightGsm) : undefined,
    widthInches: parsed.widthInches ? parseFloat(parsed.widthInches) : undefined,

    // Pretreatment (as JSON)
    pretreatment: parsed.pretreatmentData || undefined,
    fabricPh: parsed.fabricPh ? parseFloat(parsed.fabricPh) : undefined,

    // Dyeing (as JSON)
    dyeApplied: parsed.dyeApplied || undefined,
    dyeStage: parsed.dyeStage || undefined,
    dyeClass: parsed.dyeClass ? (Array.isArray(parsed.dyeClass) ? parsed.dyeClass.join(",") : parsed.dyeClass) : undefined,
    dyeDetails: parsed.dyeDetails || undefined,

    // Finishes (as JSON)
    finishSoftener: parsed.finishSoftener || undefined,
    finishRepellent: parsed.finishRepellent || undefined,
    finishWicking: parsed.finishWicking || undefined,
    finishWrinkleFree: parsed.finishWrinkleFree || undefined,
    finishOther: parsed.finishOther || undefined,

    // Metadata
    intakeParsedAt: new Date(),
  };
}

// ─── POST /api/fabrics/parse-intake ─────────────────
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

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 25MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    let pdfText = "";
    let extractError: string | null = null;
    try {
      pdfText = await extractPdfText(buffer);
    } catch (err: any) {
      extractError = `PDF text extraction failed: ${err.message}`;
    }

    // Upload to S3 if configured, otherwise fall back to base64
    let fileUrl: string;
    let s3Bucket: string | null = null;
    let s3Key: string | null = null;

    if (isS3Configured()) {
      const key = generateS3Key(S3_PREFIXES.FABRIC_INTAKE, file.name);
      const s3Result = await uploadToS3(key, buffer, file.type, {
        originalFilename: file.name,
        uploadedAt: new Date().toISOString(),
      });
      fileUrl = s3Result.url;
      s3Bucket = s3Result.bucket;
      s3Key = s3Result.key;
    } else {
      const base64 = buffer.toString("base64");
      fileUrl = `data:application/pdf;base64,${base64}`;
    }

    const document = await prisma.document.create({
      data: {
        kind: "SUBMISSION_DOC",
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        url: fileUrl,
        bucket: s3Bucket,
        key: s3Key,
      },
    });

    // Parse with LLM
    let parsed: any = null;
    let parseError: string | null = null;

    if (pdfText && !extractError) {
      try {
        parsed = await parseFabricDataWithLLM(pdfText);
      } catch (err: any) {
        parseError = `Parsing failed: ${err.message}`;
      }
    } else if (extractError) {
      parseError = extractError;
    }

    // Map to Fabric fields
    const fabricData = mapParsedDataToFabric(parsed);
    fabricData.intakeFormId = document.id;

    return NextResponse.json({
      ok: true,
      documentId: document.id,
      filename: file.name,
      sizeBytes: file.size,
      parsed,
      parseError,
      fabricData,
      confidence: parsed?.confidence || 0,
      rawText: pdfText.substring(0, 3000),
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
