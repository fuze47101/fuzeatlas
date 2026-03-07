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

    // Generate FUZE number
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const fuzeNumber = `FUZE-${timestamp}-${random}`;

    // Create fabric
    const fabric = await prisma.fabric.create({
      data: {
        fuzeNumber,
        fabricName: fabricName.trim(),
        weight: weight ? parseInt(weight) : null,
        content: content?.trim() || null,
        supplier: supplier?.trim() || null,
        factoryId,
        status: "ACTIVE",
      },
    });

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
