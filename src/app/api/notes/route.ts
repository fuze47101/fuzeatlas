// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyCRMActivity } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { content, noteType, brandId, factoryId, contactName } = body;

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: "Note content is required" }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        noteType: noteType || "NOTE",
        brandId: brandId || null,
        factoryId: factoryId || null,
        contactName: contactName || null,
        userId: user?.id || null,
        date: new Date(),
      },
    });

    // Fire CRM notification to all entity managers
    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
      notifyCRMActivity({
        entityType: "BRAND",
        entityId: brandId,
        entityName: brand?.name || "Unknown Brand",
        activityType: noteType || "NOTE",
        content: content.trim(),
        contactName: contactName || undefined,
        loggedByUserId: user?.id,
        loggedByName: user?.name,
      });
    }

    if (factoryId) {
      const factory = await prisma.factory.findUnique({ where: { id: factoryId }, select: { name: true } });
      notifyCRMActivity({
        entityType: "FACTORY",
        entityId: factoryId,
        entityName: factory?.name || "Unknown Factory",
        activityType: noteType || "NOTE",
        content: content.trim(),
        contactName: contactName || undefined,
        loggedByUserId: user?.id,
        loggedByName: user?.name,
      });
    }

    return NextResponse.json({ ok: true, note });
  } catch (e: any) {
    console.error("Note create error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
