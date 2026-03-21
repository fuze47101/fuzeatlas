// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateComplianceCert } from "@/lib/pdf-gen";

const prisma = new PrismaClient();

/**
 * GET /api/tests/[id]/certificate
 * Generates and returns a Compliance Certificate for a passed test
 * Only generates if test has passing result
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch test run with all relations
    const testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        lab: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            country: true,
            email: true,
            phone: true,
            website: true,
          },
        },
        submission: {
          select: {
            id: true,
            customerFabricCode: true,
            factoryFabricCode: true,
            applicationMethod: true,
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
            fabric: {
              select: {
                id: true,
                construction: true,
                color: true,
                weightGsm: true,
                yarnType: true,
              },
            },
          },
        },
        icpResult: true,
        abResult: true,
        fungalResult: true,
        odorResult: true,
      },
    });

    if (!testRun) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Check if test has passed
    let isPassed = false;

    if (testRun.testType === "ICP" && testRun.icpResult) {
      // ICP tests are considered passed if they have results
      isPassed = !!(testRun.icpResult.agValue || testRun.icpResult.auValue);
    } else if (testRun.testType === "ANTIBACTERIAL" && testRun.abResult) {
      isPassed = testRun.abResult.methodPass !== false;
    } else if (testRun.testType === "FUNGAL" && testRun.fungalResult) {
      isPassed = testRun.fungalResult.pass === true;
    } else if (testRun.testType === "ODOR" && testRun.odorResult) {
      isPassed = testRun.odorResult.pass === true;
    }

    if (!isPassed) {
      return NextResponse.json(
        { error: "Test did not pass. Cannot generate certificate for failed tests." },
        { status: 400 }
      );
    }

    // Generate certificate
    const pdfBuffer = await generateComplianceCert(testRun);

    // Return as HTML that can be printed to PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="Certificate-${testRun.id.substring(0, 8)}.html"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error generating certificate:", error);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    );
  }
}
