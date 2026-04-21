// @ts-nocheck
/**
 * /api/me — self-service profile read + update.
 *
 *   GET   /api/me           → { user: {...} }
 *   PATCH /api/me { ... }   → update the logged-in user's own fields
 *
 * This route is narrowly scoped: a user can only ever update THEIR OWN
 * record through here, and only a whitelist of fields (name, outboundFrom*,
 * outboundSignature). Role, email, status, brand/factory/lab/distributor
 * bindings are NOT editable here — those go through admin endpoints.
 *
 * BD Wizard (2026-04-20): added outboundFromEmail / outboundFromName /
 * outboundSignature so reps can configure the From: on their outbound.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Fields users are permitted to self-update. */
const SELF_EDITABLE = new Set([
  "name",
  "outboundFromEmail",
  "outboundFromName",
  "outboundSignature",
]);

/** Basic RFC-5322-ish email sanity — not RFC-complete, just "looks like email". */
function looksLikeEmail(s: string): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * Domains the rep's "From:" is allowed to use. We're strict here because
 * Resend will bounce anything from a domain that's not verified, and we
 * don't want reps configuring a From that spoofs a customer.
 *
 * Env override: ALLOWED_FROM_DOMAINS="801inc.com,fuze47.com"
 */
function allowedFromDomains(): string[] {
  const env = process.env.ALLOWED_FROM_DOMAINS || "801inc.com,fuze47.com,fuzeatlas.com";
  return env
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedFromDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedFromDomains().includes(domain);
}

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        outboundFromEmail: true,
        outboundFromName: true,
        outboundSignature: true,
      },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      user,
      allowedFromDomains: allowedFromDomains(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data: Record<string, any> = {};

    for (const [key, raw] of Object.entries(body || {})) {
      if (!SELF_EDITABLE.has(key)) continue;

      const val = raw === "" ? null : raw;

      if (key === "outboundFromEmail" && val != null) {
        if (!looksLikeEmail(String(val))) {
          return NextResponse.json(
            { ok: false, error: "outboundFromEmail is not a valid email" },
            { status: 400 },
          );
        }
        if (!isAllowedFromDomain(String(val))) {
          return NextResponse.json(
            {
              ok: false,
              error: `outboundFromEmail domain not allowed. Allowed domains: ${allowedFromDomains().join(", ")}`,
            },
            { status: 400 },
          );
        }
        data[key] = String(val).trim().toLowerCase();
      } else if (key === "outboundFromName" && val != null) {
        const trimmed = String(val).trim();
        if (!trimmed) { data[key] = null; continue; }
        if (trimmed.length > 120) {
          return NextResponse.json(
            { ok: false, error: "outboundFromName too long (max 120 chars)" },
            { status: 400 },
          );
        }
        data[key] = trimmed;
      } else if (key === "outboundSignature" && val != null) {
        const s = String(val);
        if (s.length > 4000) {
          return NextResponse.json(
            { ok: false, error: "outboundSignature too long (max 4000 chars)" },
            { status: 400 },
          );
        }
        data[key] = s;
      } else if (key === "name" && val != null) {
        const trimmed = String(val).trim();
        if (!trimmed) {
          return NextResponse.json({ ok: false, error: "name cannot be empty" }, { status: 400 });
        }
        data[key] = trimmed;
      } else {
        data[key] = val;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No editable fields supplied" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        outboundFromEmail: true,
        outboundFromName: true,
        outboundSignature: true,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error("[api/me] PATCH error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to update profile" },
      { status: 500 },
    );
  }
}
