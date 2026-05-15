// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedDownloadUrl } from "@/lib/s3";

/**
 * GET /api/admin/feedback/[id]/screenshot
 *
 * Admin-gated proxy for a FeedbackReport screenshot. Streams the
 * bytes inline so the admin page can render the image without
 * exposing a long-lived public S3 URL (which had been leaking via
 * raw `screenshotUrl` in the HTML).
 *
 * Flow:
 *   1. Auth-gate to ADMIN / EMPLOYEE.
 *   2. Load FeedbackReport.{screenshotBucket, screenshotKey,
 *      screenshotUrl}. Refuse with 404 if no screenshot at all.
 *   3. When bucket+key are set: build a short-lived presigned GET
 *      URL via s3.ts getPresignedDownloadUrl (10-min default),
 *      fetch the bytes server-side, stream back inline. The
 *      presigned URL itself never leaves the server.
 *   4. Fallback (legacy reports with only screenshotUrl set):
 *      fetch that URL and stream — covers the pre-S3-bucket rows.
 */
const ALLOWED_ROLES = new Set(["ADMIN", "EMPLOYEE"]);

function jsonErr(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonErr(401, "Unauthorized");
  if (!ALLOWED_ROLES.has(user.role)) return jsonErr(403, "Admins only");

  const { id } = await ctx.params;
  const report = await prisma.feedbackReport.findUnique({
    where: { id },
    select: { screenshotBucket: true, screenshotKey: true, screenshotUrl: true },
  });
  if (!report) return jsonErr(404, "Feedback report not found");
  if (!report.screenshotKey && !report.screenshotUrl) {
    return jsonErr(404, "No screenshot on this report");
  }

  // Prefer the bucket+key path — presigned URL is short-lived and
  // the URL itself stays server-side.
  let upstreamUrl: string | null = null;
  try {
    if (report.screenshotKey) {
      upstreamUrl = await getPresignedDownloadUrl(report.screenshotKey, 60 * 10);
    } else if (report.screenshotUrl) {
      upstreamUrl = report.screenshotUrl;
    }
  } catch (e: any) {
    return jsonErr(500, e?.message || "Failed to sign screenshot URL");
  }
  if (!upstreamUrl) return jsonErr(404, "No screenshot available");

  try {
    const upstream = await fetch(upstreamUrl);
    if (!upstream.ok) {
      return jsonErr(upstream.status, `Upstream S3 returned ${upstream.status}`);
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const arrayBuf = await upstream.arrayBuffer();
    return new Response(arrayBuf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache for 5 min — these are immutable per FeedbackReport row.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e: any) {
    return jsonErr(500, e?.message || "Failed to fetch screenshot");
  }
}
