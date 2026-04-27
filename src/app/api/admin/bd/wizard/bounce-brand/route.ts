// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/bounce-brand
 *
 * Kill a brand from the BD queue when the rep has confirmed its website
 * is dead. Andrew's observation (2026-04-23, #101): "the domain check is
 * working for activelinecorp.com → it's dead. The problem is every
 * contact was enriched off that same domain, so all of those emails are
 * probably bad too. We should just bounce the whole brand."
 *
 * This endpoint does four things as a single transaction:
 *
 *   1. Flip Brand.validationStatus to "dead" (already in next-brand's
 *      exclusion list, so the brand stops surfacing in the queue).
 *   2. Invalidate every contact on this brand whose email hostname
 *      matches the brand's dead website hostname. We don't nuke ALL
 *      emails on the brand — sometimes a rep has a personalEmail
 *      entered that lives on gmail.com/outlook.com and that's still
 *      reachable. We only touch emails that share the dead domain.
 *   3. Clear salesRepId + any active reservation (nobody owns a dead
 *      brand; the queue should be clean).
 *   4. Drop a Note on the brand documenting who bounced it and why,
 *      so the timeline shows the reasoning if we revisit later.
 *
 * Body:
 *   {
 *     brandId: string,
 *     reason?: string,     // optional free text the rep typed
 *     domainProbe?: any,   // optional — the DomainCheckResult we already
 *                          // have on the client so we don't re-probe
 *   }
 *
 * Returns:
 *   {
 *     ok,
 *     brandId,
 *     validationStatus,
 *     contactsInvalidated,    // how many contacts got emailStatus=invalid
 *     deadHost,               // the hostname we invalidated emails against
 *     note: { id },
 *   }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Lowercase the hostname out of a URL/host string. Returns null if unparseable. */
function hostOf(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return h && h.includes(".") ? h : null;
  } catch {
    return null;
  }
}

/** Strip leading "www." so activelinecorp.com and www.activelinecorp.com match. */
function stripWww(h: string): string {
  return h.startsWith("www.") ? h.slice(4) : h;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isBDEligible =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP" ||
      user.role === "BD_REP" ||
      user.role === "DISTRIBUTOR_USER";
    if (!isBDEligible) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const brandId: string | undefined = body?.brandId;
    const reason: string = String(body?.reason || "").trim();
    const domainProbe = body?.domainProbe || null;

    if (!brandId) {
      return NextResponse.json({ ok: false, error: "brandId is required" }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        contacts: {
          select: { id: true, email: true, name: true, firstName: true, lastName: true },
        },
      },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Only the rep who currently holds the brand (via salesRepId OR
    // reservation) can bounce it, plus any admin. Prevents a random rep
    // from killing someone else's active deal if they happen to land on
    // the brand detail page.
    const isAdmin = user.role === "ADMIN";
    const holdsIt =
      brand.salesRepId === user.id || brand.reservedBy === user.id || brand.salesRepId === null;
    if (!isAdmin && !holdsIt) {
      return NextResponse.json(
        {
          ok: false,
          error: "This brand is assigned to another rep. Ask them to bounce it, or an admin.",
        },
        { status: 403 },
      );
    }

    const deadHost = hostOf(brand.website);
    const deadHostBare = deadHost ? stripWww(deadHost) : null;

    // Find the contacts whose email lives on the dead domain. We match
    // on the bare host (stripping www) so foo@activelinecorp.com AND
    // foo@www.activelinecorp.com AND foo@sub.activelinecorp.com all
    // invalidate together.
    const contactsToInvalidate: string[] = [];
    if (deadHostBare) {
      for (const c of brand.contacts || []) {
        const email = (c.email || "").toLowerCase();
        const at = email.lastIndexOf("@");
        if (at < 0) continue;
        const emailHost = stripWww(email.slice(at + 1));
        if (!emailHost) continue;
        if (emailHost === deadHostBare || emailHost.endsWith(`.${deadHostBare}`)) {
          contactsToInvalidate.push(c.id);
        }
      }
    }

    const probeStatus = domainProbe?.status || "unknown";
    const probeMessage = domainProbe?.message || "";
    const note = [
      `[BD Wizard — Brand bounced]`,
      `Domain: ${brand.website || "(none set)"}`,
      `Probe: ${probeStatus}${probeMessage ? ` — ${probeMessage}` : ""}`,
      reason ? `Rep reason: ${reason}` : null,
      contactsToInvalidate.length > 0
        ? `Invalidated ${contactsToInvalidate.length} contact email${contactsToInvalidate.length === 1 ? "" : "s"} on ${deadHostBare}.`
        : "No contacts on the dead domain — nothing invalidated.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Kill the brand in the queue
      await tx.brand.update({
        where: { id: brandId },
        data: {
          validationStatus: "dead",
          validationReason: probeMessage || reason || "Bounced from BD Wizard (dead domain)",
          validationDate: new Date(),
          // Release ownership so it doesn't sit on anyone's list
          salesRepId: null,
          reservedBy: null,
          reservedUntil: null,
          lastActivityAt: new Date(),
        },
      });

      // 2. Invalidate every contact email on the dead hostname
      let contactsUpdated = 0;
      if (contactsToInvalidate.length > 0) {
        const r = await tx.contact.updateMany({
          where: { id: { in: contactsToInvalidate } },
          data: {
            emailStatus: "invalid",
            outreachStatus: "skipped",
          },
        });
        contactsUpdated = r.count;
      }

      // 3. Timeline note
      const createdNote = await tx.note.create({
        data: {
          content: note,
          noteType: "NOTE",
          date: new Date(),
          brandId,
          userId: user.id,
        },
        select: { id: true },
      });

      return { contactsUpdated, noteId: createdNote.id };
    });

    return NextResponse.json({
      ok: true,
      brandId,
      validationStatus: "dead",
      contactsInvalidated: result.contactsUpdated,
      deadHost: deadHostBare,
      note: { id: result.noteId },
    });
  } catch (err: any) {
    console.error("[bd/wizard/bounce-brand] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to bounce brand" },
      { status: 500 },
    );
  }
}
