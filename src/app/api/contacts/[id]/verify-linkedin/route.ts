// @ts-nocheck
/**
 * POST /api/contacts/[id]/verify-linkedin — "Confirm LinkedIn"
 *
 * Normalises the LinkedIn URL on the contact via normaliseLinkedIn() so
 * a stripped/mwlite/protocol-less variant still resolves to the
 * canonical /in/ or /company/ path, then HEAD-fetches that URL with a
 * desktop User-Agent and an ~8 second timeout. Persists the verdict to
 * Contact.linkedinValidity and stamps Contact.raw.linkedinCheckedAt.
 *
 * Status mapping:
 *   404 / 410         → invalid (profile doesn't exist)
 *   200 / 999 / 403 / 429 → valid (LinkedIn returns 999 to bots; profile resolves)
 *   timeout / network → unknown (don't brand a contact bad on a network blip)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { normaliseLinkedIn } from "@/lib/enrich-cross-validate";

const ALLOWED_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me || !ALLOWED_ROLES.includes(me.role)) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to verify contacts" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, linkedinUrl: true, raw: true },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    const norm = normaliseLinkedIn(contact.linkedinUrl);
    if (!norm) {
      return NextResponse.json(
        { ok: false, error: "Contact has no LinkedIn URL to verify" },
        { status: 400 },
      );
    }
    // Shape gate — anything that doesn't look like a real profile/company
    // page isn't worth the network round-trip; mark it shape-invalid.
    if (!/^[a-z0-9.-]*linkedin\.com\/(in|company)\//.test(norm)) {
      await persist(contact.id, "invalid", contact.raw, "bad-shape", norm);
      return NextResponse.json({
        ok: true,
        linkedinValidity: "invalid",
        reason: "bad-shape",
      });
    }

    const fullUrl = `https://${norm}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    let validity: "valid" | "invalid" | "unknown";
    let httpStatus: number | null = null;
    let reason: string;
    try {
      // Use GET — LinkedIn frequently returns 999 to HEAD requests AND
      // sometimes serves a different response code than the equivalent
      // browser load. fetch() in node 22 follows redirects by default.
      const res = await fetch(fullUrl, {
        method: "GET",
        redirect: "follow",
        signal: ac.signal,
        headers: { "User-Agent": DESKTOP_UA, Accept: "text/html,*/*" },
      });
      httpStatus = res.status;
      // Drain the body so the connection releases — but don't actually
      // need the HTML.
      try { await res.text(); } catch {}
      if (res.status === 404 || res.status === 410) {
        validity = "invalid"; reason = `http-${res.status}`;
      } else if ([200, 999, 403, 429].includes(res.status)) {
        // 999 = LinkedIn's "you're a bot but the page exists" code.
        // 403 / 429 = same family — they don't return those for nonexistent URLs.
        validity = "valid"; reason = `http-${res.status}`;
      } else {
        validity = "unknown"; reason = `http-${res.status}`;
      }
    } catch (e: any) {
      validity = "unknown";
      reason = e?.name === "AbortError" ? "timeout" : `fetch-err-${e?.code || e?.message || "unknown"}`;
    } finally {
      clearTimeout(timer);
    }

    await persist(contact.id, validity, contact.raw, reason, norm);
    return NextResponse.json({
      ok: true,
      linkedinValidity: validity,
      httpStatus,
      reason,
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[verify-linkedin] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

async function persist(
  contactId: string,
  validity: "valid" | "invalid" | "unknown",
  rawIn: any,
  reason: string,
  norm: string,
) {
  const raw = (rawIn && typeof rawIn === "object" && !Array.isArray(rawIn)) ? rawIn : {};
  raw.linkedinCheckedAt = new Date().toISOString();
  raw.linkedinCheckedReason = reason;
  raw.linkedinNormalised = norm;
  await prisma.contact.update({
    where: { id: contactId },
    data: { linkedinValidity: validity, raw },
  });
}
