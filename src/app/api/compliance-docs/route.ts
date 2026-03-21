// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedDownloadUrl, isS3Configured } from "@/lib/s3";

/* ── GET /api/compliance-docs ── List compliance documents (role-gated) ──── */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where: any = {};
    if (category) {
      where.category = category;
    }

    const docs = await prisma.complianceDocument.findMany({
      where,
      orderBy: [{ category: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        version: true,
        filename: true,
        contentType: true,
        sizeBytes: true,
        url: true,
        s3Key: true,
        // Exclude 'data' from list query — large base64 blobs kill performance
        visibleTo: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    // Filter by role visibility
    const userRole = user.role;
    const visible = docs.filter((doc: any) => {
      const roles = doc.visibleTo as string[];
      return Array.isArray(roles) && roles.includes(userRole);
    });

    // Generate presigned download URLs for S3 docs
    const s3Ready = isS3Configured();
    const enriched = await Promise.all(
      visible.map(async (doc: any) => {
        if (doc.s3Key && s3Ready) {
          try {
            const downloadUrl = await getPresignedDownloadUrl(doc.s3Key, 3600, doc.filename || undefined);
            return { ...doc, downloadUrl };
          } catch {
            return { ...doc, downloadUrl: null };
          }
        }
        return { ...doc, downloadUrl: doc.url || null };
      }),
    );

    // Build category summary
    const categories: Record<string, number> = {};
    enriched.forEach((doc: any) => {
      categories[doc.category] = (categories[doc.category] || 0) + 1;
    });

    return NextResponse.json({
      ok: true,
      documents: enriched,
      categories,
      total: enriched.length,
    });
  } catch (err: any) {
    console.error("Error fetching compliance docs:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── POST /api/compliance-docs ── Create new compliance document record (admin only) ──── */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Only admins can upload compliance documents" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      description,
      category,
      version,
      filename,
      contentType,
      sizeBytes,
      url,
      data,       // legacy base64 (small files only)
      s3Key,      // S3 key from presigned upload flow
      visibleTo,
    } = body;

    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    const doc = await prisma.complianceDocument.create({
      data: {
        title,
        description: description || null,
        category: category || "OTHER",
        version: version || null,
        filename: filename || null,
        contentType: contentType || null,
        sizeBytes: sizeBytes ? parseInt(String(sizeBytes)) : null,
        url: url || null,
        data: data || null,
        s3Key: s3Key || null,
        visibleTo: visibleTo || ["ADMIN", "EMPLOYEE", "BRAND_USER", "FACTORY_USER", "FACTORY_MANAGER"],
        uploadedById: user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating compliance doc:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
