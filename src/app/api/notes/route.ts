// @ts-nocheck
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyCRMActivity } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { content, noteType, brandId, factoryId, contactId, contactName } = body;

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: "Note content is required" }, { status: 400 });
    }

    // If the caller supplied only contactId (e.g. posting from /contacts/[id]),
    // resolve the parent brand/factory so activity still rolls up to the
    // account, the way the rest of Atlas expects it.
    let resolvedBrandId: string | null = brandId || null;
    let resolvedFactoryId: string | null = factoryId || null;
    let resolvedContactName: string | null = contactName || null;
    if (contactId && !resolvedBrandId && !resolvedFactoryId) {
      const c = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { brandId: true, factoryId: true, name: true },
      });
      if (c) {
        resolvedBrandId = resolvedBrandId || c.brandId || null;
        resolvedFactoryId = resolvedFactoryId || c.factoryId || null;
        resolvedContactName = resolvedContactName || c.name;
      }
    }

    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        noteType: noteType || "NOTE",
        brandId: resolvedBrandId,
        factoryId: resolvedFactoryId,
        contactId: contactId || null,
        contactName: resolvedContactName,
        userId: user?.id || null,
        date: new Date(),
      },
    });

    // BD Portal #36: any note/call/email on a brand = activity. Keeps the rep
    // "warm" so the 90-day inactivity cron doesn't auto-release them. Also
    // clears inactivityWarnedAt so the warn-email flow resets.
    if (resolvedBrandId) {
      await prisma.brand
        .update({
          where: { id: resolvedBrandId },
          data: { lastActivityAt: new Date(), inactivityWarnedAt: null },
        })
        .catch(() => {});
    }

    // Fire CRM notification to all entity managers
    if (resolvedBrandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: resolvedBrandId },
        select: { name: true },
      });
      notifyCRMActivity({
        entityType: "BRAND",
        entityId: resolvedBrandId,
        entityName: brand?.name || "Unknown Brand",
        activityType: noteType || "NOTE",
        content: content.trim(),
        contactName: resolvedContactName || undefined,
        loggedByUserId: user?.id,
        loggedByName: user?.name,
      });
    }

    if (resolvedFactoryId) {
      const factory = await prisma.factory.findUnique({
        where: { id: resolvedFactoryId },
        select: { name: true },
      });
      notifyCRMActivity({
        entityType: "FACTORY",
        entityId: resolvedFactoryId,
        entityName: factory?.name || "Unknown Factory",
        activityType: noteType || "NOTE",
        content: content.trim(),
        contactName: resolvedContactName || undefined,
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
