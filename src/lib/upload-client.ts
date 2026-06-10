/**
 * src/lib/upload-client.ts
 *
 * Client-side helper for uploading test reports through the
 * presigned-S3 flow. Replaces the old `FormData → POST /api/tests/upload`
 * pattern that hit Vercel's ~4.5 MB request-body limit and surfaced
 * as the cryptic "Unexpected token 'R', \"Request En\"..." JSON-parse
 * crash whenever a PDF was bigger than that.
 *
 * 3 steps:
 *   1. POST /api/tests/upload-url → presigned PUT URL + key
 *   2. PUT file directly to S3 (no Vercel body-size limit)
 *   3. POST /api/tests/upload (JSON metadata) → Document + parse
 *
 * Errors at any stage are returned as `{ ok: false, error }`
 * rather than thrown, so the calling component can show the real
 * message ("File too large", "S3 upload failed (HTTP 403)", etc.)
 * instead of a JSON-parse exception bubbling up.
 *
 * Tickets cmq5jnzyp / cmq6wonit / cmq8ipirf — June 2026.
 */

export interface UploadTestReportResult {
  ok: boolean;
  data?: any;
  error?: string;
}

/**
 * Safe-parse a fetch response. The previous `res.json()` blindly
 * parsed whatever came back — when Vercel rejected a >4.5 MB upload
 * it returned plain-text "Request Entity Too Large", which
 * `res.json()` crashed with "Unexpected token 'R'". Now we check
 * status + content-type before parsing.
 */
export async function safeJson(res: Response, label = "request"): Promise<any> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch (e: any) {
      return {
        ok: false,
        error: `Invalid JSON from server for ${label}: ${e?.message || e}`,
      };
    }
  }
  const text = await res.text().catch(() => "");
  if (res.status === 413) {
    return {
      ok: false,
      error: `Upload failed (HTTP 413): file too large for the server. Try a smaller file or contact support.`,
    };
  }
  const snippet = text.slice(0, 200).trim();
  return {
    ok: false,
    error: snippet
      ? `Upload failed (HTTP ${res.status}): ${snippet}`
      : `Upload failed (HTTP ${res.status}) for ${label}.`,
  };
}

/**
 * Upload a test-report PDF via the presigned-S3 flow.
 *
 * Returns `{ ok: true, data }` with the same shape as the old
 * `/api/tests/upload` response (documentId, parsed, itsReport,
 * aiReview, parseError, duplicateWarning, etc.), or
 * `{ ok: false, error }` on any failure with a human-readable
 * message.
 */
export async function uploadTestReport(file: File): Promise<UploadTestReportResult> {
  // ── Step 1: request presigned URL ──
  let urlRes: Response;
  try {
    urlRes = await fetch("/api/tests/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/pdf",
        fileSize: file.size,
      }),
    });
  } catch (e: any) {
    return { ok: false, error: `Could not reach upload-URL endpoint: ${e?.message || e}` };
  }
  const urlData = await safeJson(urlRes, "presigned URL");
  if (!urlRes.ok || !urlData?.ok) {
    return { ok: false, error: urlData?.error || `Could not get upload URL (HTTP ${urlRes.status})` };
  }

  // ── Step 2: PUT file directly to S3 ──
  let putRes: Response;
  try {
    putRes = await fetch(urlData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/pdf" },
      body: file,
    });
  } catch (e: any) {
    return { ok: false, error: `S3 PUT failed: ${e?.message || e}` };
  }
  if (!putRes.ok) {
    // S3 returns XML/text on error — never JSON.
    const errText = await putRes.text().catch(() => "");
    return {
      ok: false,
      error: `S3 upload failed (HTTP ${putRes.status}). ${errText.slice(0, 200)}`,
    };
  }

  // ── Step 3: commit metadata to /api/tests/upload ──
  let commitRes: Response;
  try {
    commitRes = await fetch("/api/tests/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: urlData.key,
        bucket: urlData.bucket,
        filename: file.name,
        fileSize: file.size,
        contentType: file.type || "application/pdf",
      }),
    });
  } catch (e: any) {
    return { ok: false, error: `Could not reach upload-commit endpoint: ${e?.message || e}` };
  }
  const data = await safeJson(commitRes, "upload commit");

  if (!commitRes.ok || !data?.ok) {
    return { ok: false, error: data?.error || `Upload failed (HTTP ${commitRes.status})` };
  }

  return { ok: true, data };
}
