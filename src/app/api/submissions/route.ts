import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const fabricId = typeof body.fabricId === "string" ? body.fabricId : "";

    if (!fabricId) {
      return NextResponse.json(
        { ok: false, error: "fabricId is required" },
        { status: 400 }
      );
    }

    // schema-safe: only set fields that exist on your FabricSubmission model
    const data: any = { fabricId };

    const maybeStr = (k: string) => (typeof body[k] === "string" ? body[k] : undefined);
    const maybeBool = (k: string) => (typeof body[k] === "boolean" ? body[k] : undefined);
    const maybeDate = (k: string) => {
      const v = body[k];
      if (typeof v !== "string") return undefined;
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d : undefined;
    };

    // common string fields
    for (const k of [
      "brandId","factoryId","fuzeFabricNumber","customerFabricCode","factoryFabricCode",
      "applicationMethod","applicationRecipeRaw","padRecipeRaw","treatmentLocation",
      "washTarget","category","programName"
    ]) {
      const v = maybeStr(k);
      if (v !== undefined) data[k] = v;
    }

    // booleans
    for (const k of ["icpSent","icpReceived","icpPassed","abSent","abReceived","abPassed"]) {
      const v = maybeBool(k);
      if (v !== undefined) data[k] = v;
    }

    // date
    const appDate = maybeDate("applicationDate");
    if (appDate) data.applicationDate = appDate;

    // raw passthrough
    if (body.raw !== undefined) data.raw = body.raw;

    const submission = await prisma.fabricSubmission.create({ data });
    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: 500 }
    );
  }
}
