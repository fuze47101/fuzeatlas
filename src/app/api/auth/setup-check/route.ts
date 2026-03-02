// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — checks if any users with passwords exist (first-time setup)
// Users imported from CSV won't have passwords, so we check for password != null
export async function GET() {
  try {
    // Count users who actually have a real password set
    // (not null AND not empty string — CSV imports may have either)
    const countWithPassword = await prisma.user.count({
      where: {
        password: { not: null },
        NOT: { password: "" },
      },
    });
    return NextResponse.json({ needsSetup: countWithPassword === 0 });
  } catch (err: any) {
    return NextResponse.json({ needsSetup: false, error: err.message });
  }
}
