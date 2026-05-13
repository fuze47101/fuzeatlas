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
    // Internal roles get unrestricted read. External roles
    // (FACTORY_USER, FACTORY_MANAGER, BRAND_USER, BRAND_MANAGER) are
    // allowed to read a bench test ONLY for fabrics they own.
    // May 12 fix — KK Chan at Penfabric reported clicking the Report
    // button on his fabric just bounced him to /home (the previous 403
    // happened before the page render and middleware sent him home).
    // Now factory users can pull the recipe report for their own
    // fabrics, brand users can pull it for their brand's fabrics.
    const internalRoles = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "TESTING_MANAGER", "FABRIC_MANAGER", "LAB_USER", "LAB_MANAGER"];
    const externalRoles = ["FACTORY_USER", "FACTORY_MANAGER", "BRAND_USER", "BRAND_MANAGER"];
    if (!internalRoles.includes(user.role) && !externalRoles.includes(user.role)) {
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
            brandId: true,
            factoryId: true,
            submissions: { select: { factoryId: true, brandId: true } },
            brand: { select: { id: true, name: true } },
            factory: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!test) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    // External-role ownership check
    if (externalRoles.includes(user.role)) {
      const fabric = test.fabric;
      const isFactoryUser = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
      const isBrandUser = user.role === "BRAND_USER" || user.role === "BRAND_MANAGER";
      const factoryOk = isFactoryUser && (
        fabric?.factoryId === user.factoryId ||
        fabric?.submissions?.some((s) => s.factoryId === user.factoryId)
      );
      const brandOk = isBrandUser && (
        fabric?.brandId === user.brandId ||
        fabric?.submissions?.some((s) => s.brandId === user.brandId)
      );
      if (!factoryOk && !brandOk) {
        return NextResponse.json(
          { ok: false, error: "Not authorized to view this fabric's recipe" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
