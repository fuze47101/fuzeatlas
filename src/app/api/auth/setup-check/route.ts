// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — checks if any users exist (first-time setup)
export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ needsSetup: count === 0 });
  } catch (err: any) {
    return NextResponse.json({ needsSetup: false, error: err.message });
  }
}
