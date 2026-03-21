// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadToS3, isS3Configured, S3_PREFIXES } from "@/lib/s3";

/* ── POST /api/admin/migrate-s3 ──
 *  Migrates legacy base64-stored documents to S3.
 *
 *  Handles three models:
 *    1. Document      — base64 in raw.base64 JSON field
 *    2. ComplianceDocument — base64 in data field
 *    3. DistributorDocument — base64 data URL in url field
 *
 *  Body: { dryRun?: boolean, model?: "document" | "compliance" | "distributor" | "all", batchSize?: number }
 * ────────────────────────────────────────── */

function base64ToBuffer(base64String: string): { buffer: Buffer; contentType: string } {
  // Handle data URLs like "data:application/pdf;base64,JVBERi0..."
  if (base64String.startsWith("data:")) {
    const match = base64String.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        contentType: match[1],
        buffer: Buffer.from(match[2], "base64"),
      };
    }
  }
  // Plain base64 string — assume PDF
  return {
    contentType: "application/pdf",
    buffer: Buffer.from(base64String, "base64"),
  };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    if (!isS3Configured()) {
      return NextResponse.json({ ok: false, error: "S3 is not configured. Check AWS env vars." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    const model = body.model || "all";
    const batchSize = body.batchSize || 50;

    const results = {
      dryRun,
      documents: { found: 0, migrated: 0, errors: [] as string[] },
      compliance: { found: 0, migrated: 0, errors: [] as string[] },
      distributor: { found: 0, migrated: 0, errors: [] as string[] },
    };

    // ─── 1. DOCUMENT MODEL ───
    // base64 stored in raw JSON blob as { base64: "..." }
    if (model === "all" || model === "document") {
      const docs = await prisma.document.findMany({
        where: {
          key: null, // Not yet migrated to S3
          raw: { not: null },
        },
        select: {
          id: true,
          filename: true,
          contentType: true,
          raw: true,
          kind: true,
          testRunId: true,
          submissionId: true,
          labId: true,
        },
        take: batchSize,
      });

      // Filter to only docs that actually have base64 data in raw
      const docsWithBase64 = docs.filter((d) => {
        const raw = d.raw as any;
        return raw && (raw.base64 || raw.data);
      });

      results.documents.found = docsWithBase64.length;

      if (!dryRun) {
        for (const doc of docsWithBase64) {
          try {
            const raw = doc.raw as any;
            const base64Data = raw.base64 || raw.data;
            if (!base64Data || typeof base64Data !== "string") continue;

            const { buffer, contentType } = base64ToBuffer(base64Data);

            // Determine prefix based on document kind
            let prefix = S3_PREFIXES.LAB_DOCS;
            if (doc.kind === "REPORT") prefix = S3_PREFIXES.TEST_REPORTS;
            else if (doc.kind === "SUBMISSION_DOC") prefix = S3_PREFIXES.FABRIC_INTAKE;

            const entityId = doc.testRunId || doc.submissionId || doc.labId || doc.id;
            const filename = doc.filename || `document-${doc.id}.pdf`;
            const key = `${prefix}/${entityId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

            const result = await uploadToS3(key, buffer, doc.contentType || contentType, {
              migratedFrom: "base64",
              originalDocId: doc.id,
            });

            // Update record: set S3 key/bucket, clear base64 from raw
            const cleanedRaw = { ...raw };
            delete cleanedRaw.base64;
            delete cleanedRaw.data;

            await prisma.document.update({
              where: { id: doc.id },
              data: {
                bucket: result.bucket,
                key: result.key,
                url: result.url,
                raw: Object.keys(cleanedRaw).length > 0 ? cleanedRaw : undefined,
              },
            });

            results.documents.migrated++;
          } catch (err: any) {
            results.documents.errors.push(`Doc ${doc.id}: ${err.message}`);
          }
        }
      }
    }

    // ─── 2. COMPLIANCE DOCUMENT MODEL ───
    // base64 stored in data field as data URL string
    if (model === "all" || model === "compliance") {
      const compDocs = await prisma.complianceDocument.findMany({
        where: {
          data: { not: null },
          OR: [
            { url: null },
            { url: { startsWith: "data:" } },
          ],
        },
        select: {
          id: true,
          title: true,
          filename: true,
          contentType: true,
          data: true,
          category: true,
        },
        take: batchSize,
      });

      // Filter to only those with actual base64 data
      const compWithBase64 = compDocs.filter((d) => d.data && d.data.length > 100);
      results.compliance.found = compWithBase64.length;

      if (!dryRun) {
        for (const doc of compWithBase64) {
          try {
            const { buffer, contentType } = base64ToBuffer(doc.data!);

            const filename = doc.filename || `${doc.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
            const key = `${S3_PREFIXES.COMPLIANCE_DOCS}/${doc.id}/${Date.now()}-${filename}`;

            const result = await uploadToS3(key, buffer, doc.contentType || contentType, {
              migratedFrom: "base64",
              category: doc.category,
              title: doc.title,
            });

            await prisma.complianceDocument.update({
              where: { id: doc.id },
              data: {
                url: result.url,
                data: null, // Clear base64 data
              },
            });

            results.compliance.migrated++;
          } catch (err: any) {
            results.compliance.errors.push(`Compliance ${doc.id}: ${err.message}`);
          }
        }
      }
    }

    // ─── 3. DISTRIBUTOR DOCUMENT MODEL ───
    // base64 stored as data URL in url field
    if (model === "all" || model === "distributor") {
      const distDocs = await prisma.distributorDocument.findMany({
        where: {
          key: null, // Not yet migrated
          url: { startsWith: "data:" },
        },
        select: {
          id: true,
          title: true,
          filename: true,
          contentType: true,
          url: true,
          distributorId: true,
          docType: true,
        },
        take: batchSize,
      });

      results.distributor.found = distDocs.length;

      if (!dryRun) {
        for (const doc of distDocs) {
          try {
            const { buffer, contentType } = base64ToBuffer(doc.url!);

            const filename = doc.filename || `${doc.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
            const key = `${S3_PREFIXES.DISTRIBUTOR_DOCS}/${doc.distributorId}/${Date.now()}-${filename}`;

            const result = await uploadToS3(key, buffer, doc.contentType || contentType, {
              migratedFrom: "base64",
              distributorId: doc.distributorId,
              docType: doc.docType,
            });

            await prisma.distributorDocument.update({
              where: { id: doc.id },
              data: {
                bucket: result.bucket,
                key: result.key,
                url: result.url,
              },
            });

            results.distributor.migrated++;
          } catch (err: any) {
            results.distributor.errors.push(`Distributor ${doc.id}: ${err.message}`);
          }
        }
      }
    }

    const totalFound = results.documents.found + results.compliance.found + results.distributor.found;
    const totalMigrated = results.documents.migrated + results.compliance.migrated + results.distributor.migrated;
    const totalErrors = results.documents.errors.length + results.compliance.errors.length + results.distributor.errors.length;

    return NextResponse.json({
      ok: true,
      summary: {
        dryRun,
        totalFound,
        totalMigrated,
        totalErrors,
        message: dryRun
          ? `Dry run complete. Found ${totalFound} documents to migrate. POST again with { "dryRun": false } to execute.`
          : `Migration complete. Migrated ${totalMigrated}/${totalFound} documents. ${totalErrors} errors.`,
      },
      results,
    });
  } catch (e: any) {
    console.error("S3 migration error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── GET /api/admin/migrate-s3 ──
 *  Returns current migration status — how many docs still need migrating
 * ────────────────────────────────────────── */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Count documents with base64 data that haven't been migrated
    const docsWithRaw = await prisma.document.count({
      where: { key: null, raw: { not: null } },
    });

    const complianceWithData = await prisma.complianceDocument.count({
      where: {
        data: { not: null },
        OR: [{ url: null }, { url: { startsWith: "data:" } }],
      },
    });

    const distributorWithBase64 = await prisma.distributorDocument.count({
      where: { key: null, url: { startsWith: "data:" } },
    });

    // Count already migrated
    const docsMigrated = await prisma.document.count({ where: { key: { not: null } } });
    const compMigrated = await prisma.complianceDocument.count({
      where: { url: { not: null }, data: null },
    });
    const distMigrated = await prisma.distributorDocument.count({ where: { key: { not: null } } });

    return NextResponse.json({
      ok: true,
      s3Configured: isS3Configured(),
      pending: {
        documents: docsWithRaw,
        compliance: complianceWithData,
        distributor: distributorWithBase64,
        total: docsWithRaw + complianceWithData + distributorWithBase64,
      },
      migrated: {
        documents: docsMigrated,
        compliance: compMigrated,
        distributor: distMigrated,
        total: docsMigrated + compMigrated + distMigrated,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
