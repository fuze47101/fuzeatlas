// @ts-nocheck
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
  DISTRIBUTOR_DOCS: "distributor-docs",
  SAMPLE_TRIAL: "sample-trial",
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
export function generateS3Key(
  prefix: string,
  filename: string,
  entityId?: string,
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const parts = [prefix];
  if (entityId) parts.push(entityId);
  parts.push(`${timestamp}-${sanitized}`);
  return parts.join("/");
}

/* ─── HELPER: Check if S3 is configured ─── */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}
