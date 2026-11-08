import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, setSessionCookie } from "@/lib/auth";
import { appUrl, verifyBookLinkToken } from "@/lib/book";

/**
 * GET /book/go/[token] — one-click entry from the Friday email.
 * Verifies the signed link, opens a normal session for that user and lands
 * them in the wizard. Public in middleware; the token is the credential.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const userId = await verifyBookLinkToken(token);
  const base = appUrl();
  if (!userId) return NextResponse.redirect(`${base}/login?next=/book/checkin&reason=link`);
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      brandId: true,
      factoryId: true,
      distributorId: true,
      labId: true,
    },
  });
  if (!u || u.status !== "ACTIVE")
    return NextResponse.redirect(`${base}/login?next=/book/checkin&reason=inactive`);
  const jwt = await createToken({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    brandId: u.brandId,
    factoryId: u.factoryId,
    distributorId: u.distributorId,
    labId: u.labId,
  });
  await setSessionCookie(jwt);
  return NextResponse.redirect(`${base}/book/checkin?from=email`);
}
