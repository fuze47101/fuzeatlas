// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateSowPdf } from "@/lib/pdf-gen";

const prisma = new PrismaClient();

/**
 * GET /api/sow/[id]/pdf
 * Generates and returns a Statement of Work PDF
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch SOW with all relations
    const sow = await prisma.sOW.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
              },
            },
          },
        },
        milestones: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            dueDate: true,
            completedAt: true,
            sortOrder: true,
          },
        },
        documents: {
          select: {
            id: true,
            filename: true,
            kind: true,
            url: true,
            createdAt: true,
          },
        },
      },
    });

    if (!sow) {
      return NextResponse.json({ error: "SOW not found" }, { status: 404 });
    }

    // Generate PDF (HTML format that can be printed to PDF)
    const pdfBuffer = await generateSowPdf(sow);

    // Return as HTML that can be printed to PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="SOW-${sow.id.substring(0, 8)}.html"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error generating SOW PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
