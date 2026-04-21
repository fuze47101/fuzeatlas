// @ts-nocheck
/**
 * GET /api/admin/bd/sequence/step/[id]
 *
 * Return a single sequence step with enough context for the wizard to
 * preload it in "follow-up" mode. Used when the BD Wizard is opened with
 * ?stepId=<id> from /acm/tasks or the sequences dashboard.
 *
 * Returns step + parent sequence + brand (with full contacts list so the
 * wizard can render the brand header) + contact + rep.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const isBDEligible =
    user.role === "ADMIN" ||
    user.role === "EMPLOYEE" ||
    user.role === "SALES_MANAGER" ||
    user.role === "SALES_REP";
  if (!isBDEligible) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";

  const { id } = await params;
  const step = await prisma.bDSequenceStep.findUnique({
    where: { id },
    include: {
      sequence: {
        include: {
          brand: {
            include: {
              contacts: true,
            },
          },
          contact: true,
          rep: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!step) return NextResponse.json({ ok: false, error: "Step not found" }, { status: 404 });
  if (!isAdmin && step.sequence.repId !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, step });
}
