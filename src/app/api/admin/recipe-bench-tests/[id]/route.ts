// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    // Any authenticated internal user can read a bench test (read-only)
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: `Role ${user.role} not permitted` },
        { status: 403 },
      );
    }
    // Pulled in brand/factory + customerCode/factoryCode so the printable
    // bench test card and long-form report can show "what brand/factory
    // is this for, and what's their internal item number". Andrew's
    // directive (#93): the lab card is emailed to mills/brands and
    // needs to identify them and reference their own SKU codes, not
    // just the FUZE number.
    const test = await prisma.recipeBenchTest.findUnique({
      where: { id },
      include: {
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            customerReference: true,
            fabricCategory: true,
            color: true,
            construction: true,
            weightGsm: true,
            yarnType: true,
            widthInches: true,
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!test) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
