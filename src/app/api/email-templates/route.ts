// @ts-nocheck
/**
 * /api/email-templates — list and create reusable email templates.
 *
 * Ticket #24 (Viktor 4/17): saved templates for first intro, re-engagement,
 * ICP request, etc. Templates support {firstName}, {company}, etc. — variable
 * substitution happens client-side at compose time so the renderer can pull
 * tokens from the live brand/contact context.
 *
 * Visibility rules:
 *   GET → returns templates the caller can SEE: their own PRIVATE +
 *         all SHARED + all GLOBAL. Archived ones are excluded.
 *   POST → creates a new template owned by the caller. Only ADMIN may
 *          create GLOBAL templates.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category"); // optional filter
    const includeArchived = searchParams.get("archived") === "true"; // admin tool

    const where: any = {
      OR: [
        { ownerId: me.id }, // anything I own (regardless of scope)
        { scope: "SHARED" },
        { scope: "GLOBAL" },
      ],
    };
    if (!includeArchived) where.archivedAt = null;
    if (category) where.category = category;

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [
        // Most-used first within scope; ties broken by recency.
        { useCount: "desc" },
        { updatedAt: "desc" },
      ],
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ ok: true, templates });
  } catch (e: any) {
    console.error("[email-templates GET]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, subject, bodyHtml, body: bodyText, category, scope } = body;

    // Allow either `body` or `bodyHtml` from callers — saves churn for both
    // the compose-dialog code path and the wizard.
    const finalBody: string | undefined = bodyHtml ?? bodyText;

    if (!title?.trim() || !subject?.trim() || !finalBody?.trim()) {
      return NextResponse.json(
        { ok: false, error: "title, subject, and body are required" },
        { status: 400 },
      );
    }

    const finalScope = (scope || "PRIVATE").toUpperCase();
    if (!["PRIVATE", "SHARED", "GLOBAL"].includes(finalScope)) {
      return NextResponse.json(
        { ok: false, error: "scope must be PRIVATE, SHARED, or GLOBAL" },
        { status: 400 },
      );
    }
    // Only admins may create GLOBAL — protects the org-wide picker from noise.
    if (finalScope === "GLOBAL" && !hasMinRole(me.role, "ADMIN")) {
      return NextResponse.json(
        { ok: false, error: "Only admins can create GLOBAL templates" },
        { status: 403 },
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        title: title.trim(),
        subject: subject.trim(),
        body: finalBody,
        category: category?.trim() || null,
        scope: finalScope,
        ownerId: me.id,
      },
    });

    return NextResponse.json({ ok: true, template });
  } catch (e: any) {
    console.error("[email-templates POST]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
