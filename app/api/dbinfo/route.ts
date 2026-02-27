import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ db: process.env.DATABASE_URL || "NOT_SET" });
}
