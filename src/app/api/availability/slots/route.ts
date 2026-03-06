// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Slot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { ok: false, error: "Missing date parameter (format: YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Get availability config
    let config = await prisma.availabilityConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      config = await prisma.availabilityConfig.create({
        data: {
          id: "default",
          availableDays: [2, 4],
          startHour: 9,
          endHour: 17,
          slotDurationMinutes: 60,
          timezone: "Asia/Taipei",
          blockedDates: [],
          maxBookingsPerDay: 3,
        },
      });
    }

    const availableDays = Array.isArray(config.availableDays)
      ? config.availableDays
      : JSON.parse(config.availableDays as any);
    const blockedDates = Array.isArray(config.blockedDates)
      ? config.blockedDates
      : JSON.parse(config.blockedDates as any);

    // Check if date is valid and not blocked
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid date format" },
        { status: 400 }
      );
    }

    const dayOfWeek = date.getDay();
    const dateIso = date.toISOString().split("T")[0];

    // Check if day is available and not blocked
    if (!availableDays.includes(dayOfWeek) || blockedDates.includes(dateIso)) {
      return NextResponse.json({
        ok: true,
        slots: [],
        reason: blockedDates.includes(dateIso) ? "blocked" : "not_available",
      });
    }

    // Generate time slots
    const slots: Slot[] = [];
    const startHour = config.startHour;
    const endHour = config.endHour;
    const slotDuration = config.slotDurationMinutes;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        if (hour * 60 + min >= endHour * 60) break;

        const slotStart = new Date(date);
        slotStart.setHours(hour, min, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          available: true, // Will be set below
        });
      }
    }

    // Check for double bookings
    const bookedMeetings = await prisma.meeting.findMany({
      where: {
        AND: [
          { startTime: { gte: new Date(dateStr) } },
          { startTime: { lt: new Date(new Date(dateStr).getTime() + 86400000) } },
          { status: { not: "CANCELLED" } },
        ],
      },
      select: { startTime: true, endTime: true },
    });

    const slotsWithAvailability = slots.map((slot) => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);

      const isBooked = bookedMeetings.some((meeting) => {
        const meetingStart = new Date(meeting.startTime);
        const meetingEnd = new Date(meeting.endTime);
        // Check for overlap
        return slotStart < meetingEnd && slotEnd > meetingStart;
      });

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: !isBooked,
      };
    });

    return NextResponse.json({
      ok: true,
      slots: slotsWithAvailability,
      config: {
        timezone: config.timezone,
        maxBookingsPerDay: config.maxBookingsPerDay,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
