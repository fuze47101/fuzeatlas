// @ts-nocheck
/**
 * Compat shim — /api/crm/tasks/[id] → /api/acm/tasks/[id] with 308.
 * Delete after 2 clean weeks.
 */
import { NextRequest, NextResponse } from "next/server";

async function redirectToAcm(req: NextRequest, params: Promise<{ id: string }>) {
  const { id } = await params;
  const url = new URL(req.url);
  const acmUrl = new URL(`/api/acm/tasks/${id}${url.search}`, url.origin);
  return NextResponse.redirect(acmUrl, 308);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return redirectToAcm(req, ctx.params);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return redirectToAcm(req, ctx.params);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return redirectToAcm(req, ctx.params);
}
