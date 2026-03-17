// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateSalesContract,
  generateInvoice,
  generatePackingList,
  generateCofA,
} from "@/lib/shipping-docs";
import type { ShippingDocData } from "@/lib/shipping-docs";

export const runtime = "nodejs";
export const maxDuration = 30;

/* ── POST /api/shipping-docs/generate ──
 *  Generates a PDF for the given shipping document type.
 *  Returns the PDF as a downloadable file.
 * ────────────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only internal users can generate shipping docs
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Not authorized to generate shipping documents" }, { status: 403 });
    }

    const data: ShippingDocData = await req.json();

    let pdfBuffer: Buffer;
    let filename: string;

    switch (data.docType) {
      case "sales_contract":
        pdfBuffer = await generateSalesContract(data);
        filename = `FUZE_Sales_Contract_${data.invoiceNumber}.pdf`;
        break;
      case "invoice":
        pdfBuffer = await generateInvoice(data);
        filename = `FUZE_Invoice_${data.invoiceNumber}.pdf`;
        break;
      case "packing_list":
        pdfBuffer = await generatePackingList(data);
        filename = `FUZE_Packing_List_${data.invoiceNumber}.pdf`;
        break;
      case "cofa":
        pdfBuffer = await generateCofA(data);
        filename = `FUZE_CofA_${data.lotNumber}.pdf`;
        break;
      default:
        return NextResponse.json({ ok: false, error: "Invalid document type" }, { status: 400 });
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    console.error("Error generating shipping doc:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
