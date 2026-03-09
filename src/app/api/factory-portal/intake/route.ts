// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "FACTORY_USER" && user.role !== "FACTORY_MANAGER")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const factoryId = user.factoryId;
    if (!factoryId) {
      return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const fabricName = formData.get("fabricName")?.toString() || "";
    const weight = formData.get("weight")?.toString() || null;
    const content = formData.get("content")?.toString() || null;
    const supplier = formData.get("supplier")?.toString() || null;
    const notes = formData.get("notes")?.toString() || null;

    if (!fabricName.trim()) {
      return NextResponse.json(
        { ok: false, error: "Fabric name is required" },
        { status: 400 }
      );
    }

    // Auto-increment FUZE number (Int)
    const lastFabric = await prisma.fabric.findFirst({
      where: { fuzeNumber: { not: null } },
      orderBy: { fuzeNumber: "desc" },
      select: { fuzeNumber: true },
    });
    const fuzeNumber = (lastFabric?.fuzeNumber || 1000) + 1;

    // Build note from fabric name + supplier
    const noteParts = [`Intake: ${fabricName.trim()}`];
    if (supplier?.trim()) noteParts.push(`Supplier: ${supplier.trim()}`);

    // Create fabric — map form fields to actual Prisma schema columns
    const fabric = await prisma.fabric.create({
      data: {
        fuzeNumber,
        weightGsm: weight ? parseFloat(weight) : null,
        construction: content?.trim() || null,  // fiber content → construction
        note: noteParts.join(" | "),
        factoryId,
      },
    });

    // If fiber content was provided as plain text, create a FabricContent row
    if (content?.trim()) {
      await prisma.fabricContent.create({
        data: {
          fabricId: fabric.id,
          material: content.trim(),
          rawText: content.trim(),
        },
      });
    }

    // Create initial submission
    const submission = await prisma.fabricSubmission.create({
      data: {
        fabricId: fabric.id,
        status: "SUBMITTED",
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json({
      ok: true,
      fabric,
      submission,
      message: "Fabric intake submitted successfully",
    });
  } catch (e: any) {
    console.error("Factory intake error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
