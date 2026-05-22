// @ts-nocheck
/**
 * GET /api/cron/diag-user?email=<email>
 *
 * Bearer-authed read-only diagnostic. For any email, reports user
 * state WITHOUT exposing the password hash. Tells you whether the
 * login flow will accept or reject this user.
 *
 * Built 2026-05-22 after Jany Lu (jany.lu@charmingfabrics.com)
 * reported "Invalid email or password" with credentials Andrew set.
 * Login returns that generic error for both user-not-found AND
 * password-mismatch cases, so this endpoint distinguishes them.
 *
 * Run: fzcron 'diag-user?email=jany.lu@charmingfabrics.com'
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const emailRaw = (url.searchParams.get("email") || "").trim();
  if (!emailRaw) {
    return NextResponse.json(
      { ok: false, error: "?email= required" },
      { status: 400 },
    );
  }

  const email = emailRaw.toLowerCase();

  // Find by normalized email (same lookup the login route does).
  const userExact = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      canClaim: true,
      brandId: true,
      factoryId: true,
      distributorId: true,
      labId: true,
      password: true, // for null-check only — we redact the value below
      createdAt: true,
      updatedAt: true,
    },
  });

  // Also fuzzy-search in case of similar emails (typo by caller, etc.).
  const looksLikeMatches = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: email.split("@")[0], mode: "insensitive" } },
        { email: { contains: email.split("@")[1] || "@nonexistent", mode: "insensitive" } },
      ],
      NOT: { email },
    },
    select: { id: true, email: true, name: true, role: true, status: true },
    take: 10,
  });

  if (!userExact) {
    return NextResponse.json({
      ok: true,
      exists: false,
      searchedFor: email,
      verdict: `❌ No user with email "${email}". Login will return "Invalid email or password" because user not found.`,
      similarMatches: looksLikeMatches,
      recommendation:
        looksLikeMatches.length > 0
          ? "Similar email(s) found — check if user was registered under a different domain or with a typo."
          : "User does not exist. Create via /admin/users or via the invitation flow.",
    });
  }

  const hasPassword = !!userExact.password;
  const passwordHashCost = hasPassword
    ? (userExact.password.match(/^\$2[aby]?\$(\d+)\$/)?.[1] ?? "unknown")
    : null;

  const verdicts = [];
  if (userExact.status !== "ACTIVE") {
    verdicts.push(
      `❌ User exists but status is ${userExact.status} (not ACTIVE). Login will return "Account is not active."`,
    );
  } else if (!hasPassword) {
    verdicts.push(
      `❌ User exists, status ACTIVE, but no password set. Login will return "Account has no password set."`,
    );
  } else {
    verdicts.push(
      `✓ User exists, status ACTIVE, password hash present (bcrypt cost ${passwordHashCost}). Login will accept correct password.`,
    );
  }

  // Strip the actual hash before returning — don't leak it.
  const userSafe = { ...userExact, password: hasPassword ? `[REDACTED · bcrypt cost ${passwordHashCost}]` : null };

  return NextResponse.json({
    ok: true,
    exists: true,
    user: userSafe,
    hasPassword,
    passwordHashCost,
    verdicts,
    similarMatches: looksLikeMatches,
  });
}
