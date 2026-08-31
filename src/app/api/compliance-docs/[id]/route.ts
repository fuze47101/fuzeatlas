// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getRealUser } from "@/lib/auth";
import { deleteFromS3, isS3Configured } from "@/lib/s3";

/* ── GET /api/compliance-docs/[id] ── Get single document ──── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doc = await prisma.complianceDocument.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // Check role visibility
    const roles = doc.visibleTo as string[];
    if (!Array.isArray(roles) || !roles.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Not authorized to view this document" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, document: doc });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── PUT /api/compliance-docs/[id] ── Update document (admin only) ──── */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Only admins can update compliance documents" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.category !== undefined) data.category = body.category;
    if (body.version !== undefined) data.version = body.version || null;
    if (body.filename !== undefined) data.filename = body.filename || null;
    if (body.contentType !== undefined) data.contentType = body.contentType || null;
    if (body.sizeBytes !== undefined) data.sizeBytes = body.sizeBytes ? parseInt(body.sizeBytes) : null;
    if (body.url !== undefined) data.url = body.url || null;
    if (body.data !== undefined) data.data = body.data || null;
    // File replacement (FIX 4): a new s3Key swaps the stored file. shareToken
    // is intentionally NOT touched here, so links already sent keep resolving
    // — now to the new version.
    if (body.s3Key !== undefined) data.s3Key = body.s3Key || null;
    if (body.visibleTo !== undefined) data.visibleTo = body.visibleTo;
    if (body.libraryType !== undefined)
      data.libraryType = body.libraryType === "MARKETING" ? "MARKETING" : "COMPLIANCE";

    // If the file is being replaced, capture the old key to clean up after.
    let oldS3Key: string | null = null;
    if (body.s3Key) {
      const existing = await prisma.complianceDocument.findUnique({
        where: { id },
        select: { s3Key: true },
      });
      oldS3Key = existing?.s3Key || null;
    }

    const doc = await prisma.complianceDocument.update({
      where: { id },
      data,
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    // Best-effort delete of the now-orphaned previous file (non-fatal).
    if (oldS3Key && oldS3Key !== body.s3Key && isS3Configured()) {
      try {
        await deleteFromS3(oldS3Key);
      } catch (e) {
        console.warn("Failed to delete replaced S3 object:", e);
      }
    }

    return NextResponse.json({ ok: true, document: doc });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── PATCH /api/compliance-docs/[id] ── Move a doc between library partitions
 * (COMPLIANCE ↔ MARKETING). Admin/Employee only, gated on getRealUser(). ──── */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRealUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Only admins can move documents" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    if (body.libraryType !== "COMPLIANCE" && body.libraryType !== "MARKETING") {
      return NextResponse.json(
        { ok: false, error: "libraryType must be COMPLIANCE or MARKETING" },
        { status: 400 },
      );
    }
    const doc = await prisma.complianceDocument.update({
      where: { id },
      data: { libraryType: body.libraryType },
      select: { id: true, libraryType: true },
    });
    return NextResponse.json({ ok: true, document: doc });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── DELETE /api/compliance-docs/[id] ── Delete document (admin only) ──── */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Only administrators can delete compliance documents" }, { status: 403 });
    }

    const { id } = await params;

    // Clean up S3 file if present
    const doc = await prisma.complianceDocument.findUnique({
      where: { id },
      select: { s3Key: true },
    });

    if (doc?.s3Key && isS3Configured()) {
      try {
        await deleteFromS3(doc.s3Key);
      } catch (e) {
        console.warn("Failed to delete S3 object:", e);
      }
    }

    await prisma.complianceDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
