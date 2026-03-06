// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateTeamsLink } from "@/lib/meeting-templates";
import { sendBookingNotification, sendBookingConfirmation } from "@/lib/email";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { date, startTime, brandId, title, description } = body;

    if (!date || !startTime) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: date, startTime" },
        { status: 400 }
      );
    }

    // Get availability config to validate
    const config = await prisma.availabilityConfig.findUnique({
      where: { id: "default" },
    });

    const blockedDates = config?.blockedDates
      ? Array.isArray(config.blockedDates)
        ? config.blockedDates
        : JSON.parse(config.blockedDates)
      : [];
    const availableDays = config?.availableDays
      ? Array.isArray(config.availableDays)
        ? config.availableDays
        : JSON.parse(config.availableDays)
      : [2, 4];

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const dateIso = dateObj.toISOString().split("T")[0];

    // Validate date is available
    if (!availableDays.includes(dayOfWeek) || blockedDates.includes(dateIso)) {
      return NextResponse.json(
        { ok: false, error: "Selected date is not available for booking" },
        { status: 400 }
      );
    }

    // Parse start time (ISO format)
    const startTimeObj = new Date(startTime);
    const slotDuration = config?.slotDurationMinutes || 60;
    const endTimeObj = new Date(startTimeObj);
    endTimeObj.setMinutes(endTimeObj.getMinutes() + slotDuration);

    // Check for double booking
    const existingMeeting = await prisma.meeting.findFirst({
      where: {
        AND: [
          { startTime: { lt: endTimeObj } },
          { endTime: { gt: startTimeObj } },
          { status: { not: "CANCELLED" } },
        ],
      },
    });

    if (existingMeeting) {
      return NextResponse.json(
        { ok: false, error: "This time slot is no longer available" },
        { status: 409 }
      );
    }

    // Get user for organizer info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Generate Teams link
    const teamsLink = generateTeamsLink({
      title: title || "FUZE Meeting",
      startTime: startTimeObj.toISOString(),
      endTime: endTimeObj.toISOString(),
      attendees: [user.email],
    });

    // Create the meeting
    const meeting = await prisma.meeting.create({
      data: {
        title: title || `Meeting with ${user.name}`,
        description: description || undefined,
        startTime: startTimeObj,
        endTime: endTimeObj,
        timezone: config?.timezone || "Asia/Taipei",
        teamsLink,
        organizerId: userId,
        ...(brandId && { brandId }),
        meetingType: "CUSTOM",
        status: "SCHEDULED",
        location: "Microsoft Teams",
      },
    });

    // ── Send email notifications (fire-and-forget) ──
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: config?.timezone || "Asia/Taipei",
      });
    const formatTime = (d: Date) =>
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: config?.timezone || "Asia/Taipei",
      });

    // Get brand name if applicable
    let brandName: string | undefined;
    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });
      brandName = brand?.name;
    }

    // Find admin/owner to notify (first ADMIN user, or fallback to SALES_MANAGER)
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true },
    });

    const dateStr = formatDate(startTimeObj);
    const startStr = formatTime(startTimeObj);
    const endStr = formatTime(endTimeObj);

    // Notify admin
    if (adminUser?.email) {
      sendBookingNotification({
        adminEmail: adminUser.email,
        bookerName: user.name || user.email,
        bookerEmail: user.email,
        brandName,
        meetingTitle: meeting.title,
        date: dateStr,
        startTime: startStr,
        endTime: endStr,
        teamsLink: teamsLink || undefined,
        meetingId: meeting.id,
      }).catch((e) => console.warn("Booking notification failed:", e));
    }

    // Confirm to booker
    sendBookingConfirmation({
      bookerEmail: user.email,
      bookerName: user.name || "there",
      meetingTitle: meeting.title,
      date: dateStr,
      startTime: startStr,
      endTime: endStr,
      teamsLink: teamsLink || undefined,
    }).catch((e) => console.warn("Booking confirmation failed:", e));

    return NextResponse.json({ ok: true, meeting });
  } catch (e: any) {
    console.error("Booking error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
