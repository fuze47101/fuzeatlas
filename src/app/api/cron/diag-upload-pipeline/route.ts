// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isS3Configured,
  generateS3Key,
  getPresignedUploadUrl,
  downloadFromS3,
  deleteFromS3,
  getS3Bucket,
  getS3Region,
  S3_PREFIXES,
} from "@/lib/s3";

/**
 * POST /api/cron/diag-upload-pipeline
 *
 * End-to-end probe of the presigned-S3 test-report upload pipeline
 * shipped June 2026 for Kaylee Pace's PDF-upload cluster (tickets
 * cmq5jnzyp / cmq6wonit / cmq8ipirf). Replaces the old multipart-
 * formData path that hit Vercel's ~4.5 MB request body limit.
 *
 * Stages exercised:
 *   1. /api/tests/upload-url contract — getPresignedUploadUrl()
 *      returns a usable PUT URL.
 *   2. S3 PUT — synthesizes a >5 MB PDF-shaped blob and uploads it
 *      directly to S3 via the presigned URL.
 *   3. S3 GET — downloadFromS3(key) reads the bytes back so the
 *      handler can run pdf-parse + AI vision on them.
 *   4. Document insert — runs the Document.create inside a
 *      $transaction that ALWAYS rolls back, asserting the columns
 *      the new presigned-S3 path writes (bucket, key, url, raw)
 *      stay aligned with the live schema.
 *   5. Cleanup — deletes the test S3 object so the probe is
 *      idempotent and leaves no junk.
 *
 * If any stage fails the probe surfaces a stage-labeled error so
 * the next live upload regression is caught before a customer hits
 * the cryptic "Unexpected token 'R'" JSON-parse crash.
 *
 * Bearer-authed (Vercel cron / fzcron).
 *
 * Optional ?size=<bytes> to override the synthetic blob size
 * (default 5_300_000 = just above Vercel's 4.5 MB serverless body
 * limit, which is the regression we want to keep proving).
 */
const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_BYTES = 5_300_000; // ~5.3 MB — guaranteed past the 4.5 MB Vercel cap

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      {
        ok: false,
        stage: "config",
        error:
          "S3 not configured — AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY must be set on Vercel for this probe to run.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const bytes = Math.max(
    1024,
    Math.min(20 * 1024 * 1024, Number(url.searchParams.get("size") || DEFAULT_BYTES) | 0),
  );

  const probeFilename = `diag-upload-pipeline-${Date.now()}.pdf`;
  const contentType = "application/pdf";
  const stages: { stage: string; ok: boolean; ms: number; detail?: any }[] = [];

  let s3Key = "";
  let uploadUrl = "";

  // ── Stage 1: presigned URL ──
  try {
    const t = Date.now();
    s3Key = generateS3Key(S3_PREFIXES.TEST_REPORTS, probeFilename, "diag-probe");
    uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 300);
    stages.push({ stage: "presigned-url", ok: true, ms: Date.now() - t, detail: { key: s3Key } });
  } catch (e: any) {
    stages.push({ stage: "presigned-url", ok: false, ms: 0, detail: e?.message || String(e) });
    return NextResponse.json(
      { ok: false, stage: "presigned-url", error: e?.message || String(e), stages },
      { status: 500 },
    );
  }

  // ── Stage 2: S3 PUT (the bypass-Vercel step) ──
  // Synthesize a body that's bigger than Vercel's body cap so any
  // future regression that loops the file back through the function
  // surfaces here, not on Kaylee's screen.
  const blob = Buffer.alloc(bytes, 0);
  // Minimal PDF magic bytes so a future content-type validator
  // doesn't trip the probe.
  Buffer.from("%PDF-1.4\n").copy(blob, 0);
  try {
    const t = Date.now();
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      stages.push({
        stage: "s3-put",
        ok: false,
        ms: Date.now() - t,
        detail: { status: putRes.status, body: errText.slice(0, 300) },
      });
      // Attempt cleanup even on failure in case S3 stored a partial.
      await deleteFromS3(s3Key).catch(() => {});
      return NextResponse.json(
        {
          ok: false,
          stage: "s3-put",
          error: `S3 PUT returned ${putRes.status}: ${errText.slice(0, 200)}`,
          stages,
        },
        { status: 500 },
      );
    }
    stages.push({ stage: "s3-put", ok: true, ms: Date.now() - t, detail: { bytes } });
  } catch (e: any) {
    stages.push({ stage: "s3-put", ok: false, ms: 0, detail: e?.message || String(e) });
    await deleteFromS3(s3Key).catch(() => {});
    return NextResponse.json(
      { ok: false, stage: "s3-put", error: e?.message || String(e), stages },
      { status: 500 },
    );
  }

  // ── Stage 3: S3 GET ──
  let downloaded: Buffer | null = null;
  try {
    const t = Date.now();
    downloaded = await downloadFromS3(s3Key);
    stages.push({
      stage: "s3-get",
      ok: downloaded.length === bytes,
      ms: Date.now() - t,
      detail: { bytes: downloaded.length, expected: bytes },
    });
    if (downloaded.length !== bytes) {
      await deleteFromS3(s3Key).catch(() => {});
      return NextResponse.json(
        {
          ok: false,
          stage: "s3-get",
          error: `Downloaded ${downloaded.length} bytes, expected ${bytes}`,
          stages,
        },
        { status: 500 },
      );
    }
  } catch (e: any) {
    stages.push({ stage: "s3-get", ok: false, ms: 0, detail: e?.message || String(e) });
    await deleteFromS3(s3Key).catch(() => {});
    return NextResponse.json(
      { ok: false, stage: "s3-get", error: e?.message || String(e), stages },
      { status: 500 },
    );
  }

  // ── Stage 4: Document insert inside a rolled-back tx ──
  let documentInsertOk = false;
  let documentDetail: any = null;
  try {
    const t = Date.now();
    await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          kind: "REPORT",
          filename: probeFilename,
          contentType,
          sizeBytes: bytes,
          bucket: getS3Bucket(),
          key: s3Key,
          url: `https://${getS3Bucket()}.s3.${getS3Region()}.amazonaws.com/${s3Key}`,
          raw: { scanStatus: "pending", uploadedVia: "diag-probe" },
        },
      });
      documentDetail = { id: doc.id, bucket: doc.bucket, key: doc.key };
      documentInsertOk = true;
      // Force rollback — we never persist diag rows.
      throw new Error("__diag_rollback__");
    });
  } catch (e: any) {
    if (e?.message === "__diag_rollback__") {
      stages.push({
        stage: "document-insert",
        ok: documentInsertOk,
        ms: 0,
        detail: { rolledBack: true, ...documentDetail },
      });
    } else {
      stages.push({
        stage: "document-insert",
        ok: false,
        ms: 0,
        detail: e?.message || String(e),
      });
      await deleteFromS3(s3Key).catch(() => {});
      return NextResponse.json(
        { ok: false, stage: "document-insert", error: e?.message || String(e), stages },
        { status: 500 },
      );
    }
  }

  // ── Stage 5: cleanup ──
  try {
    const t = Date.now();
    await deleteFromS3(s3Key);
    stages.push({ stage: "s3-cleanup", ok: true, ms: Date.now() - t });
  } catch (e: any) {
    stages.push({ stage: "s3-cleanup", ok: false, ms: 0, detail: e?.message || String(e) });
    // Cleanup failure isn't fatal for the probe verdict — the
    // upload itself worked. Surface as a non-blocking warning.
  }

  const failed = stages.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0 || (failed.length === 1 && failed[0].stage === "s3-cleanup"),
    bytes,
    stages,
    failed: failed.map((s) => s.stage),
    verdict:
      failed.length === 0
        ? `Presigned-S3 upload pipeline healthy (${bytes} bytes round-tripped).`
        : `${failed.length} stage(s) failed: ${failed.map((s) => s.stage).join(", ")}`,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
export const maxDuration = 120;
