/**
 * src/lib/upload.ts — NEED-5 canonical document upload helper.
 *
 * Before this lived: 5 separate API routes wrote files to S3 using
 * raw `uploadToS3` + ad-hoc Document row inserts in 3 different
 * prefixes with 3 different ACL stamps. Spec asked for ONE entry
 * point with consistent prefixes, consistent Document row shape,
 * and an explicit ACL stamp.
 *
 * Migration pattern for existing callers:
 *
 *   // OLD — direct s3 + manual Document.create
 *   const key = generateS3Key("test-reports", file.name, testRunId);
 *   const { url } = await uploadToS3(key, buffer, file.type);
 *   await prisma.document.create({ data: { kind: "REPORT", ... } });
 *
 *   // NEW — single call
 *   const doc = await uploadDocument({
 *     kind: "REPORT",
 *     file: { buffer, filename, contentType, sizeBytes },
 *     uploaderUserId: session.id,
 *     entity: { testRunId },
 *   });
 *
 * Prefix policy is encoded in PREFIX_BY_KIND so we stop sprinkling
 * S3 keys with one-off prefixes per caller.
 */

import { prisma } from "@/lib/prisma";
import { uploadToS3, generateS3Key, S3_PREFIXES } from "@/lib/s3";

export type UploadKind = "REPORT" | "IMAGE" | "SUBMISSION_DOC" | "SOW_DOC" | "LAB_FORM" | "OTHER";

const PREFIX_BY_KIND: Record<UploadKind, string> = {
  REPORT: S3_PREFIXES.TEST_REPORTS,
  IMAGE: "images",
  SUBMISSION_DOC: S3_PREFIXES.FABRIC_INTAKE,
  SOW_DOC: "sow-docs",
  LAB_FORM: S3_PREFIXES.LAB_DOCS,
  OTHER: "documents",
};

export interface UploadFile {
  /** Raw bytes — Buffer, Uint8Array, or base64-encoded string. */
  buffer: Buffer | Uint8Array;
  /** Original filename. Sanitized into the S3 key. */
  filename: string;
  /** MIME type. Stamped on the S3 object + Document.contentType. */
  contentType: string;
  /** Optional size hint — Document.sizeBytes is set from this if provided. */
  sizeBytes?: number;
}

export interface UploadEntity {
  /** FabricSubmission row this document belongs to. */
  submissionId?: string | null;
  /** TestRun row this document belongs to. */
  testRunId?: string | null;
  /** SOW row this document belongs to. */
  sowId?: string | null;
  /** Lab row this document belongs to. */
  labId?: string | null;
}

export interface UploadDocumentInput {
  kind: UploadKind;
  file: UploadFile;
  entity?: UploadEntity;
  /** Atlas user id of the uploader. Stamped on Document.raw for ACL. */
  uploaderUserId?: string | null;
  /** Optional ACL stamp keys. Pass any of these to scope visibility. */
  acl?: {
    factoryId?: string | null;
    brandId?: string | null;
    distributorId?: string | null;
    labId?: string | null;
  };
  /** Optional extra payload to merge into Document.raw. */
  extraRaw?: Record<string, any>;
}

export interface UploadDocumentResult {
  documentId: string;
  bucket: string;
  key: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
}

/**
 * Upload a file to S3 and create the matching Document row in one
 * call. Returns the canonical Document row + the public URL.
 *
 * AV scan stub: at runtime we mark Document.raw.scanStatus="pending"
 * so a future worker can flip it after running ClamAV / S3 Trail
 * antivirus. For now uploads are immediately readable.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const { kind, file, entity, uploaderUserId, acl, extraRaw } = input;
  const prefix = PREFIX_BY_KIND[kind] || PREFIX_BY_KIND.OTHER;

  // Pick the most specific entity id for the S3 key path so we
  // segment by tenant naturally.
  const entityIdForKey =
    entity?.testRunId || entity?.submissionId || entity?.sowId || entity?.labId || acl?.factoryId || acl?.brandId || acl?.distributorId || acl?.labId || undefined;

  const key = generateS3Key(prefix, file.filename, entityIdForKey);
  const { bucket, url } = await uploadToS3(
    key,
    Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer),
    file.contentType,
    {
      uploadedBy: uploaderUserId || "system",
      kind,
    },
  );

  const raw: Record<string, any> = {
    scanStatus: "pending",
    uploadedAt: new Date().toISOString(),
  };
  if (uploaderUserId) raw.uploaderUserId = uploaderUserId;
  if (acl?.factoryId) raw.uploaderFactoryId = acl.factoryId;
  if (acl?.brandId) raw.uploaderBrandId = acl.brandId;
  if (acl?.distributorId) raw.uploaderDistributorId = acl.distributorId;
  if (acl?.labId) raw.uploaderLabId = acl.labId;
  if (extraRaw) Object.assign(raw, extraRaw);

  const doc = await prisma.document.create({
    data: {
      kind,
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes ?? null,
      bucket,
      key,
      url,
      submissionId: entity?.submissionId || null,
      testRunId: entity?.testRunId || null,
      sowId: entity?.sowId || null,
      labId: entity?.labId || null,
      raw,
    },
  });

  return {
    documentId: doc.id,
    bucket,
    key,
    url,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes ?? null,
  };
}

/**
 * Find an existing Document by S3 key. Used by replace-in-place
 * flows so the caller doesn't double-insert when re-uploading the
 * same logical document.
 */
export async function findDocumentByKey(key: string) {
  return prisma.document.findUnique({ where: { key } });
}
