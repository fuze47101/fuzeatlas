// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generatePoPdf } from "@/lib/pdf-gen";

const prisma = new PrismaClient();

/**
 * GET /api/test-requests/[id]/pdf
 * Generates and returns a Purchase Order PDF for a test request
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch test request with all relations
    const testRequest = await prisma.testRequest.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            construction: true,
            color: true,
            weightGsm: true,
            widthInches: true,
            yarnType: true,
          },
        },
        submission: {
          select: {
            id: true,
            fuzeFabricNumber: true,
            customerFabricCode: true,
            factoryFabricCode: true,
          },
        },
        lab: {
          select: {
            id: true,
            name: true,
            customerNumber: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            country: true,
            website: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lines: {
          select: {
            id: true,
            testType: true,
            testMethod: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            rush: true,
            rushPrice: true,
            estimatedDays: true,
            status: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!testRequest) {
      return NextResponse.json({ error: "Test request not found" }, { status: 404 });
    }

    // Generate PDF (HTML format that can be printed to PDF)
    const pdfBuffer = await generatePoPdf(testRequest);

    // Return as HTML that can be printed to PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="PO-${testRequest.poNumber}.html"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error generating PO PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
