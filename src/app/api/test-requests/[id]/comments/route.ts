// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pushCustomNotification } from "@/lib/notify-realtime";

/**
 * /api/test-requests/[id]/comments
 *
 * Internal-staff-only threaded remarks on a TestRequest. Never exposed
 * to lab-external partners (BRAND_USER / FACTORY_USER / DISTRIBUTOR_USER
 * / lab partner staff). Gated to INTERNAL_STAFF_ROLES on both GET + POST.
 *
 * POST fans out a real-time SYSTEM notification to the request's
 * requestedBy and approvedBy (when distinct from the author) so
 * approvers see the remark without having to reopen the row.
 */
const INTERNAL_STAFF_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "FABRIC_MANAGER",
  "TESTING_MANAGER",
  "LAB_USER",
]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await getCurrentUser();
    if (!me || !INTERNAL_STAFF_ROLES.has(me.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    const { id } = await params;
    const comments = await prisma.testRequestComment.findMany({
      where: { testRequestId: id },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    return NextResponse.json({ ok: true, comments });
  } catch (e: any) {
    console.error("[test-request comments GET]", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load comments" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await getCurrentUser();
    if (!me || !INTERNAL_STAFF_ROLES.has(me.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.body === "string" ? body.body : "";
    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: "Remark body is required" },
        { status: 400 },
      );
    }

    const comment = await prisma.testRequestComment.create({
      data: {
        testRequestId: id,
        authorId: me.id,
        body: text.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Best-effort notification fan-out: ping requestedBy + approvedBy
    // (when distinct from the author). A notify failure must not fail
    // the write.
    try {
      const parent = await prisma.testRequest.findUnique({
        where: { id },
        select: {
          poNumber: true,
          requestedById: true,
          approvedById: true,
        },
      });
      if (parent) {
        const recipientIds = new Set<string>();
        if (parent.requestedById && parent.requestedById !== me.id) {
          recipientIds.add(parent.requestedById);
        }
        if (parent.approvedById && parent.approvedById !== me.id) {
          recipientIds.add(parent.approvedById);
        }
        const preview = text.trim().slice(0, 140);
        await Promise.all(
          Array.from(recipientIds).map((uid) =>
            pushCustomNotification(
              uid,
              "SYSTEM",
              `New remark on ${parent.poNumber}`,
              preview,
              `/test-requests`,
              {
                kind: "test_request_comment",
                testRequestId: id,
              },
            ).catch(() => null),
          ),
        );
      }
    } catch (notifyErr: any) {
      console.error("[test-request comments notify]", notifyErr?.message);
    }

    return NextResponse.json({ ok: true, comment });
  } catch (e: any) {
    console.error("[test-request comments POST]", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to add remark" },
      { status: 500 },
    );
  }
}
