// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    let config = await prisma.availabilityConfig.findUnique({
      where: { id: "default" },
    });

    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.availabilityConfig.create({
        data: {
          id: "default",
          availableDays: [2, 4], // Tuesday, Thursday
          startHour: 9,
          endHour: 17,
          slotDurationMinutes: 60,
          timezone: "Asia/Taipei",
          blockedDates: [],
          maxBookingsPerDay: 3,
        },
      });
    }

    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    if (userRole !== "ADMIN" && userRole !== "EMPLOYEE") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Admin or Employee role required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      availableDays,
      startHour,
      endHour,
      slotDurationMinutes,
      timezone,
      blockedDates,
      maxBookingsPerDay,
    } = body;

    const config = await prisma.availabilityConfig.upsert({
      where: { id: "default" },
      update: {
        ...(availableDays !== undefined && { availableDays }),
        ...(startHour !== undefined && { startHour }),
        ...(endHour !== undefined && { endHour }),
        ...(slotDurationMinutes !== undefined && { slotDurationMinutes }),
        ...(timezone !== undefined && { timezone }),
        ...(blockedDates !== undefined && { blockedDates }),
        ...(maxBookingsPerDay !== undefined && { maxBookingsPerDay }),
      },
      create: {
        id: "default",
        availableDays: availableDays || [2, 4],
        startHour: startHour ?? 9,
        endHour: endHour ?? 17,
        slotDurationMinutes: slotDurationMinutes ?? 60,
        timezone: timezone || "Asia/Taipei",
        blockedDates: blockedDates || [],
        maxBookingsPerDay: maxBookingsPerDay ?? 3,
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
