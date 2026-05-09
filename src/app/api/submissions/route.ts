import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushNewSubmission } from "@/lib/notify-realtime";
import { sendNewSubmissionEmail } from "@/lib/email";

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

    // ── Notify admins + factory + brand of new submission (non-blocking) ──
    (async () => {
      try {
        // Look up factory and fabric names + ids for the notification
        const fabric = await prisma.fabric.findUnique({
          where: { id: fabricId },
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            brandId: true,
            factoryId: true,
            factory: { select: { name: true } },
          },
        });
        const factoryName = fabric?.factory?.name || "Unknown Factory";
        const fabricInfo = fabric?.fuzeNumber ? `FUZE-${fabric.fuzeNumber}` : fabric?.customerCode || fabricId;

        // Push real-time notification — pass through brand/factory IDs so
        // the helper fans out to those user pools, not just admins.
        await pushNewSubmission({
          factoryName,
          fabricName: fabricInfo,
          submittedBy: factoryName,
          brandId: data.brandId || fabric?.brandId || null,
          factoryId: data.factoryId || fabric?.factoryId || null,
          submissionId: submission.id,
          fabricId: fabric?.id || fabricId,
        });

        // Send email to admins
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "EMPLOYEE"] }, email: { not: "" } },
          select: { email: true },
        });
        const adminEmails = admins.map((a: any) => a.email).filter(Boolean) as string[];
        if (adminEmails.length > 0) {
          await sendNewSubmissionEmail({
            adminEmails,
            factoryName,
            fabricName: fabricInfo,
            submittedBy: factoryName,
          });
        }
      } catch (err) {
        console.error("[NOTIFY] Submission notification failed:", err);
      }
    })();

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: 500 }
    );
  }
}
