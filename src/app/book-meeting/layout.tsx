import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Book a Meeting",
  description: "Schedule a meeting with FUZE Biotech to discuss antimicrobial textile treatments, testing programs, and partnership opportunities.",
};
export default function BookMeetingLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
