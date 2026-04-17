// @ts-nocheck
/**
 * GET /api/how-to?q=...&path=/factory-portal/request-test
 *
 * Returns ranked HowToEntry[] from the curated KB at `src/lib/how-to-kb.ts`.
 *
 * The user's role is inferred from the session cookie — clients don't need to
 * pass it. Anonymous callers still get results (role-less ranking), since the
 * button can appear briefly before the session is resolved client-side.
 *
 * This endpoint is deliberately read-only and deterministic: there is no LLM
 * in the loop. All instructions come from the hand-reviewed KB so we never
 * hallucinate a workflow.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { HOW_TO_ENTRIES, rankHowTo } from "@/lib/how-to-kb";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const path = url.searchParams.get("path") || "";

    const user = await getCurrentUser();
    const role = user?.role || null;

    const matches = rankHowTo(q, role, path);

    // If no query at all, cap the "browse" view to top 6 so it doesn't look like a wall
    const limited = q.trim().length > 0 ? matches.slice(0, 8) : matches.slice(0, 6);

    return NextResponse.json({
      ok: true,
      total: matches.length,
      results: limited,
      // Include the full catalog size so the UI can say "X more answers available — try searching"
      catalogSize: HOW_TO_ENTRIES.length,
    });
  } catch (err: any) {
    console.error("[how-to] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to search how-to KB" },
      { status: 500 },
    );
  }
}
