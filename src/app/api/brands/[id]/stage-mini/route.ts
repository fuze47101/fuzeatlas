// @ts-nocheck
/**
 * GET /api/brands/[id]/stage-mini
 *
 * Tiny endpoint the sidebar hits when on /brands/[id] so it can pick the
 * right module context (BD vs Partners) based on pipeline stage.
 *
 * Kept deliberately minimal — no auth check, no relations, no PII. Just the
 * stage + name so the sidebar can scope itself and (optionally) show the
 * brand name in a future breadcrumb.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    if (!id || id === "new") {
      return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
    }
    const brand = await prisma.brand.findUnique({
      where: { id },
      select: { id: true, name: true, pipelineStage: true },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...brand });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
