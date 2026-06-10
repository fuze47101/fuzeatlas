// @ts-nocheck
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/* ─────────────────────────────────────────────
 * FUZE Atlas — S3 Storage Utility
 * Bucket: fuzeatlas
 * ───────────────────────────────────────────── */

const BUCKET = process.env.S3_BUCKET || "fuzeatlas";
const REGION = process.env.AWS_REGION || "us-west-2";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

/* ─── KEY PREFIXES ─── */
export const S3_PREFIXES = {
  TEST_REPORTS: "test-reports",
  FABRIC_INTAKE: "fabric-intake",
  LAB_DOCS: "lab-docs",
  COMPLIANCE_DOCS: "compliance-docs",
  PRODUCT_DOCUMENTS: "product-documents",
  FABRIC_PHOTOS: "fabric-photos",
  DISTRIBUTOR_DOCS: "distributor-docs",
  SAMPLE_TRIAL: "sample-trial",
  FEEDBACK: "feedback-screenshots",
} as const;

/* ─── UPLOAD FILE ─── */
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<{ bucket: string; key: string; url: string }> {
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata || {},
    }),
  );

  return {
    bucket: BUCKET,
    key,
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
  };
}

/* ─── GENERATE PRESIGNED DOWNLOAD URL ─── */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600, // 1 hour default
  filename?: string,
): Promise<string> {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(filename && {
      ResponseContentDisposition: `inline; filename="${filename}"`,
    }),
  });

  return getSignedUrl(client, command, { expiresIn });
}

/* ─── GENERATE PRESIGNED UPLOAD URL ─── */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 600, // 10 minutes default
): Promise<string> {
  const client = getClient();

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/* ─── DOWNLOAD FILE TO BUFFER ─── */
// Used by /api/tests/upload after the client PUTs a >4.5MB PDF to S3
// via presigned URL — handler needs the bytes back for pdf-parse +
// AI vision. Streams the body via the AWS SDK rather than fetching
// the public URL, since the bucket is private.
export async function downloadFromS3(key: string): Promise<Buffer> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await client.send(command);
  const body = response.Body;
  if (!body) throw new Error(`S3 object body empty for key ${key}`);
  // @ts-ignore — SDK returns ReadableStream in Node 22+
  if (typeof (body as any).transformToByteArray === "function") {
    // @ts-ignore
    const bytes: Uint8Array = await (body as any).transformToByteArray();
    return Buffer.from(bytes);
  }
  // Fallback for stream-typed bodies
  const chunks: Buffer[] = [];
  for await (const chunk of body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/* ─── CONFIG ACCESSORS ─── */
// Exposed for diag probes + upload-url endpoint so callers don't
// re-import the env vars and can show a consistent bucket/region.
export function getS3Bucket(): string {
  return BUCKET;
}
export function getS3Region(): string {
  return REGION;
}

/* ─── DELETE FILE ─── */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}

/* ─── HELPER: Generate unique S3 key ─── */
export function generateS3Key(prefix: string, filename: string, entityId?: string): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const parts = [prefix];
  if (entityId) parts.push(entityId);
  parts.push(`${timestamp}-${sanitized}`);
  return parts.join("/");
}

/* ─── HELPER: Check if S3 is configured ─── */
export function isS3Configured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}
