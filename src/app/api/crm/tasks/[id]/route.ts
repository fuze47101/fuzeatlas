// @ts-nocheck
/**
 * Compat shim — /api/crm/tasks/[id] → /api/acm/tasks/[id] with 308.
 * Delete after 2 clean weeks.
 */
import { NextRequest, NextResponse } from "next/server";

function redirectToAcm(req: NextRequest, params: { id: string }) {
  const url = new URL(req.url);
  const acmUrl = new URL(`/api/acm/tasks/${params.id}${url.search}`, url.origin);
  return NextResponse.redirect(acmUrl, 308);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return redirectToAcm(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return redirectToAcm(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return redirectToAcm(req, params);
}
