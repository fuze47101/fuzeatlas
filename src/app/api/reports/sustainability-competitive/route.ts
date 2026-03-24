// @ts-nocheck
import { NextResponse } from "next/server";
import {
  generateSustainabilityCompetitiveReport,
  type ReportParams,
} from "@/lib/pdf-sustainability-competitive";
import { COMPETITORS } from "@/lib/competitors";

/**
 * POST /api/reports/sustainability-competitive
 *
 * Generate a combined Sustainability + Competitive Intelligence report.
 * Returns full HTML document optimized for browser print-to-PDF.
 *
 * Body (JSON):
 *   gsm: number                    - fabric GSM
 *   widthInches: number            - fabric width in inches
 *   targetWashes: number           - wash durability target
 *   metersPerGarment: number       - meters of fabric per garment
 *   annualMeters: number           - annual production meters
 *   competitorIds: string[]|"all"  - competitor IDs or "all"
 *   brandName?: string             - optional brand name
 *   preparedFor?: string           - optional person name
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      gsm,
      widthInches,
      targetWashes,
      metersPerGarment,
      annualMeters,
      competitorIds = "all",
      brandName,
      preparedFor,
    } = body;

    // Validate required fields
    if (!gsm || !widthInches || !targetWashes || !metersPerGarment || !annualMeters) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["gsm", "widthInches", "targetWashes", "metersPerGarment", "annualMeters"],
        },
        { status: 400 }
      );
    }

    const params: ReportParams = {
      gsm: Number(gsm),
      widthInches: Number(widthInches),
      targetWashes: Number(targetWashes),
      metersPerGarment: Number(metersPerGarment),
      annualMeters: Number(annualMeters),
      competitorIds,
      brandName,
      preparedFor,
    };

    const html = generateSustainabilityCompetitiveReport(params);

    // Return as HTML document for browser rendering / print-to-PDF
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[sustainability-competitive report]", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/sustainability-competitive?format=json
 * Returns available competitors for the UI dropdown
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  if (format === "competitors") {
    const list = COMPETITORS.map((c) => ({
      id: c.id,
      company: c.company,
      product: c.product,
      chemistryType: c.chemistryType,
      chemistryLabel: c.chemistryLabel,
    }));
    return NextResponse.json({ competitors: list });
  }

  return NextResponse.json({
    endpoint: "/api/reports/sustainability-competitive",
    methods: ["POST", "GET"],
    description: "Combined Sustainability + Competitive Intelligence PDF Report",
    getParams: { format: "competitors - returns available competitor list" },
    postBody: {
      gsm: "number (fabric GSM)",
      widthInches: "number (fabric width in inches)",
      targetWashes: "number (wash durability target)",
      metersPerGarment: "number (meters per garment)",
      annualMeters: "number (annual production volume)",
      competitorIds: "string[] | 'all' (competitor IDs)",
      brandName: "string? (optional brand name)",
      preparedFor: "string? (optional person name)",
    },
  });
}
