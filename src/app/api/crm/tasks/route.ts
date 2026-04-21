// @ts-nocheck
/**
 * Compat shim — /api/crm/tasks was renamed to /api/acm/tasks with the
 * CRM → ACM rebrand. Any client still pointed at the old URL gets a
 * 308 (permanent, method-preserving) redirect. Delete after 2 clean
 * weeks of no /api/crm hits in Vercel logs.
 */
import { NextRequest, NextResponse } from "next/server";

function redirectToAcm(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.search;
  const acmUrl = new URL(`/api/acm/tasks${search}`, url.origin);
  return NextResponse.redirect(acmUrl, 308);
}

export async function GET(req: NextRequest) {
  return redirectToAcm(req);
}

export async function POST(req: NextRequest) {
  return redirectToAcm(req);
}
