// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadToS3, generateS3Key, isS3Configured, S3_PREFIXES } from "@/lib/s3";

/**
 * POST /api/feedback
 *
 * Accepts a feedback submission from the floating "Something's off?" button.
 * Payload is JSON; screenshot (optional) is a data-URL string (the widget captures
 * paste + drag-drop into a canvas and sends base64). We upload to S3 if configured,
 * otherwise we store the data URL directly.
 *
 * Everything is optional except `category`, `title`, and `description`.
 */
const VALID_CATEGORIES = new Set([
  "PROBLEM",
  "CONFUSING",
  "MISSING",
  "SUGGESTION",
  "BROKEN_LINK",
  "ERROR",
  "OTHER",
]);

function portalFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const first = u.pathname.split("/").filter(Boolean)[0];
    if (!first) return "home";
    if (first === "lab-portal") return "lab-portal";
    if (first === "brand-portal") return "brand-portal";
    if (first === "factory-portal") return "factory-portal";
    if (first === "distributor-portal") return "distributor-portal";
    if (first === "admin") return "admin";
    if (first === "settings") return "settings";
    return first;
  } catch {
    return null;
  }
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const m = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    return { contentType: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getCurrentUser().catch(() => null);

    const body = await req.json();
    const category = String(body.category || "").toUpperCase();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();

    if (!category || !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing category" },
        { status: 400 },
      );
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ ok: false, error: "Description is required" }, { status: 400 });
    }
    if (title.length > 250) {
      return NextResponse.json(
        { ok: false, error: "Title too long (max 250 chars)" },
        { status: 400 },
      );
    }
    if (description.length > 10_000) {
      return NextResponse.json(
        { ok: false, error: "Description too long (max 10,000 chars)" },
        { status: 400 },
      );
    }

    // Screenshot handling (optional)
    let screenshotUrl: string | null = null;
    let screenshotBucket: string | null = null;
    let screenshotKey: string | null = null;

    if (body.screenshotDataUrl && typeof body.screenshotDataUrl === "string") {
      const parsed = parseDataUrl(body.screenshotDataUrl);
      if (parsed) {
        // Cap at ~5 MB to prevent abuse; screenshots are usually 100–500 KB
        if (parsed.buffer.length > 5 * 1024 * 1024) {
          return NextResponse.json(
            { ok: false, error: "Screenshot too large (max 5 MB)" },
            { status: 400 },
          );
        }

        if (isS3Configured()) {
          const ext =
            parsed.contentType === "image/png"
              ? "png"
              : parsed.contentType === "image/jpeg"
                ? "jpg"
                : parsed.contentType === "image/webp"
                  ? "webp"
                  : "bin";
          const key = generateS3Key(
            S3_PREFIXES.FEEDBACK,
            `screenshot-${Date.now()}.${ext}`,
            sessionUser?.id,
          );
          const up = await uploadToS3(key, parsed.buffer, parsed.contentType, {
            reporterId: sessionUser?.id || "anonymous",
            reporterEmail: sessionUser?.email || "",
          });
          screenshotUrl = up.url;
          screenshotBucket = up.bucket;
          screenshotKey = up.key;
        } else {
          // Fallback: keep the data URL. Only usable from the admin page of this session.
          screenshotUrl = body.screenshotDataUrl;
        }
      }
    }

    const url = typeof body.url === "string" ? body.url : null;
    const headerUA = req.headers.get("user-agent") || null;
    const headerRef = req.headers.get("referer") || null;

    const created = await prisma.feedbackReport.create({
      data: {
        userId: sessionUser?.id || null,
        userEmail: sessionUser?.email || null,
        userName: sessionUser?.name || null,
        userRole: sessionUser?.role || null,

        category,
        title,
        description,

        url,
        portal: body.portal || portalFromUrl(url),
        userAgent: typeof body.userAgent === "string" ? body.userAgent : headerUA,
        viewport: typeof body.viewport === "string" ? body.viewport : null,
        referer: typeof body.referer === "string" ? body.referer : headerRef,

        screenshotUrl,
        screenshotBucket,
        screenshotKey,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, id: created.id, createdAt: created.createdAt });
  } catch (err: any) {
    console.error("Feedback submission error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to submit feedback" },
      { status: 500 },
    );
  }
}
