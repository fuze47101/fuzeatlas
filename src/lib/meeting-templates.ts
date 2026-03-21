/**
 * Meeting templates tied to pipeline stages.
 * When a brand/project moves to a new stage, the corresponding meeting is auto-suggested.
 */

export interface MeetingTemplate {
  meetingType: string;
  title: string;
  description: string;
  durationMinutes: number;
  suggestedAttendees: string[]; // role-based
  agenda: string[];
}

export const PIPELINE_MEETING_TEMPLATES: Record<string, MeetingTemplate> = {
  PRESENTATION: {
    meetingType: "BRAND_PRESENTATION",
    title: "FUZE Technology Presentation",
    description:
      "Introduction of FUZE antimicrobial technology, product tiers, and partnership model to the brand team.",
    durationMinutes: 60,
    suggestedAttendees: ["SALES_REP", "SALES_MANAGER"],
    agenda: [
      "Company overview & introductions",
      "FUZE antimicrobial technology deep-dive",
      "Product tier presentation (F1–F4)",
      "Case studies & performance data",
      "Brand requirements discussion",
      "Next steps & timeline",
    ],
  },
  BRAND_TESTING: {
    meetingType: "TESTING_REVIEW",
    title: "Brand Testing Kickoff",
    description:
      "Align on test plan, lab selection, fabric submissions, and SOW requirements before testing begins.",
    durationMinutes: 45,
    suggestedAttendees: ["SALES_REP", "TESTING_MANAGER", "FABRIC_MANAGER"],
    agenda: [
      "Review SOW & testing requirements",
      "Confirm fabric submissions & FUZE tier",
      "Lab selection & pricing review",
      "Test request / PO walkthrough",
      "Timeline & expected results date",
      "Q&A",
    ],
  },
  FACTORY_ONBOARDING: {
    meetingType: "FACTORY_KICKOFF",
    title: "Factory Onboarding Meeting",
    description:
      "Kick off factory integration — process alignment, chemical handling, QC protocols, and production timeline.",
    durationMinutes: 60,
    suggestedAttendees: [
      "SALES_REP",
      "FACTORY_MANAGER",
      "TESTING_MANAGER",
      "FABRIC_MANAGER",
    ],
    agenda: [
      "Factory introduction & capabilities review",
      "FUZE application process overview",
      "Chemical handling & storage requirements",
      "QC protocol alignment",
      "Production trial scheduling",
      "Support & communication channels",
    ],
  },
  FACTORY_TESTING: {
    meetingType: "TESTING_REVIEW",
    title: "Factory Testing Progress Review",
    description:
      "Review factory-level test results, address issues, and align on next steps for production approval.",
    durationMinutes: 30,
    suggestedAttendees: ["SALES_REP", "TESTING_MANAGER", "FACTORY_MANAGER"],
    agenda: [
      "Review factory test submissions",
      "Results analysis (ICP, AB, fungal)",
      "Issue resolution if needed",
      "Production approval criteria check",
      "Timeline to production readiness",
    ],
  },
  PRODUCTION: {
    meetingType: "PRODUCTION_REVIEW",
    title: "Production Launch Review",
    description:
      "Final review before full production — confirm volumes, logistics, pricing, and ongoing QC schedule.",
    durationMinutes: 45,
    suggestedAttendees: [
      "SALES_REP",
      "SALES_MANAGER",
      "FACTORY_MANAGER",
      "FABRIC_MANAGER",
    ],
    agenda: [
      "Confirm production volumes & schedule",
      "FUZE chemical supply logistics",
      "Pricing & invoicing confirmation",
      "Ongoing QC testing calendar",
      "Brand communication plan",
      "Escalation procedures",
    ],
  },
  BRAND_EXPANSION: {
    meetingType: "BRAND_PRESENTATION",
    title: "Brand Expansion Strategy Session",
    description:
      "Discuss expansion opportunities — new product lines, additional tiers, new factories, or geographic markets.",
    durationMinutes: 60,
    suggestedAttendees: ["SALES_REP", "SALES_MANAGER"],
    agenda: [
      "Current partnership performance review",
      "New product line opportunities",
      "Additional FUZE tier applications",
      "New factory or market expansion",
      "Volume & revenue projections",
      "Action items & next steps",
    ],
  },
};

/**
 * Generate a Microsoft Teams meeting deep link.
 * This creates a link that opens the Teams app to schedule a meeting.
 */
export function generateTeamsLink(params: {
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  attendees?: string[]; // email addresses
}): string {
  const { title, startTime, endTime, attendees = [] } = params;
  const attendeeStr = attendees.join(",");
  // Teams deep link for scheduling
  return `https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent(title)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&attendees=${encodeURIComponent(attendeeStr)}`;
}

/**
 * Generate an .ics calendar file content for universal calendar integration.
 */
export function generateIcsContent(params: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  organizer?: { name: string; email: string };
  attendees?: { name: string; email: string }[];
}): string {
  const { title, description, startTime, endTime, location, organizer, attendees = [] } = params;

  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const uid = `fuze-atlas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fuzeatlas.com`;

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FUZE Atlas//Meeting//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${formatDate(startTime)}`,
    `DTEND:${formatDate(endTime)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
  ];

  if (location) ics.push(`LOCATION:${location}`);
  if (organizer) ics.push(`ORGANIZER;CN=${organizer.name}:mailto:${organizer.email}`);
  for (const a of attendees) {
    ics.push(`ATTENDEE;CN=${a.name};RSVP=TRUE:mailto:${a.email}`);
  }

  ics.push(
    `DTSTAMP:${formatDate(new Date())}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  );

  return ics.join("\r\n");
}

/**
 * Auto-schedule a meeting when a brand moves to a new pipeline stage.
 * This is a standalone function (not in a route file) so it can be imported anywhere.
 */
export async function autoScheduleMeeting(params: {
  brandId: string;
  projectId?: string;
  pipelineStage: string;
  organizerId: string;
}) {
  // Dynamic import to avoid circular deps with prisma
  const { prisma } = await import("@/lib/prisma");

  const template = PIPELINE_MEETING_TEMPLATES[params.pipelineStage];
  if (!template) return null;

  // Schedule 2 business days from now at 10 AM
  const startTime = new Date();
  let daysToAdd = 2;
  while (daysToAdd > 0) {
    startTime.setDate(startTime.getDate() + 1);
    const day = startTime.getDay();
    if (day !== 0 && day !== 6) daysToAdd--;
  }
  startTime.setHours(10, 0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + template.durationMinutes);

  // Get brand name for title
  const brand = await prisma.brand.findUnique({
    where: { id: params.brandId },
    select: { name: true },
  });

  const title = `${brand?.name || "Brand"} — ${template.title}`;

  const teamsLink = generateTeamsLink({
    title,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  });

  const meeting = await prisma.meeting.create({
    data: {
      title,
      description: template.description + "\n\nAgenda:\n" + template.agenda.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n"),
      meetingType: template.meetingType,
      startTime,
      endTime,
      timezone: "Asia/Taipei",
      location: "Microsoft Teams",
      teamsLink,
      brandId: params.brandId,
      projectId: params.projectId || null,
      pipelineStage: params.pipelineStage,
      autoScheduled: true,
      organizerId: params.organizerId,
      status: "SCHEDULED",
    },
  });

  return meeting;
}
