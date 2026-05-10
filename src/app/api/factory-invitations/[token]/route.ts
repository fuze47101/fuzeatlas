// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public-readable GET for the FactoryInvitation token landing page.
 * No auth required — just the secret token. Returns invitation
 * details + brand context (name, logo, support email when present).
 *
 * Middleware exemption: /api/factory-invitations is added to
 * PUBLIC_PATHS so anonymous browsers can hit this.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!token) return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });

  const invitation = await prisma.factoryInvitation.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      brandId: true,
      invitedFactoryName: true,
      invitedContactName: true,
      invitedContactEmail: true,
      invitedCountry: true,
      notes: true,
      status: true,
      invitedAt: true,
      respondedAt: true,
      brand: {
        select: {
          id: true,
          name: true,
          profile: {
            select: {
              logoUrl: true,
              primaryColor: true,
              supportEmail: true,
              heroHeadline: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Invitation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, invitation });
}
