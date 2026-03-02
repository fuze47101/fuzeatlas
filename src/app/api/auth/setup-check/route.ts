// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — checks if any users with passwords exist (first-time setup)
// Users imported from CSV won't have passwords, so we check for password != null
export async function GET() {
  try {
    const countWithPassword = await prisma.user.count({
      where: { password: { not: null } },
    });
    return NextResponse.json({ needsSetup: countWithPassword === 0 });
  } catch (err: any) {
    return NextResponse.json({ needsSetup: false, error: err.message });
  }
}
