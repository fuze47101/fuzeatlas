// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeHygieneSnapshot } from "@/lib/contact-quality";

/**
 * POST /api/admin/contact-hygiene/scan
 *
 * Run the hygiene pass across all contacts (or a scoped subset), persist
 * the verdict onto each Contact row, and return a summary.
 *
 * Body (all optional):
 *   - brandId:     scope to one brand (wizard opens a brand → run scan on
 *                  that brand's contacts only, fast + targeted)
 *   - onlyStale:   default true — skip contacts whose hygieneCheckedAt is
 *                  newer than `staleHours` hours ago. Set to false to
 *                  force-re-scan everything.
 *   - staleHours:  default 24. How old a snapshot has to be before we
 *                  re-run.
 *   - autoHide:    default false — when true, the scan flips
 *                  `hiddenFromWizard: true` for any contact the snapshot
 *                  suggests hiding. When false (the default), we store
 *                  the verdict but don't touch the visibility flag, so
 *                  admins can preview before committing.
 *
 * Admin + EMPLOYEE + SALES_MANAGER only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin or manager only" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      brandId?: string;
      onlyStale?: boolean;
      staleHours?: number;
      autoHide?: boolean;
    };
    const onlyStale = body.onlyStale !== false;
    const staleHours = typeof body.staleHours === "number" ? body.staleHours : 24;
    const autoHide = body.autoHide === true;

    // Build scoped query. Stale filter is optional so the admin page can
    // force-re-run at will.
    const where: any = {};
    if (body.brandId) where.brandId = body.brandId;
    if (onlyStale) {
      const cutoff = new Date(Date.now() - staleHours * 3600_000);
      where.OR = [{ hygieneCheckedAt: null }, { hygieneCheckedAt: { lt: cutoff } }];
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        title: true,
        linkedinUrl: true,
        hiddenFromWizard: true,
      },
    });

    // Bucket counters so the scan returns a useful summary even without
    // iterating the per-row results on the client.
    const buckets = {
      real: 0,
      suspicious: 0,
      placeholder: 0,
      role_account: 0,
    };
    let hidden = 0;
    let scanned = 0;

    // Writes are small (one field set per row) and chunked so we don't
    // blow out a single giant transaction against the DB. 50 rows per
    // chunk is plenty — scans for a single brand almost always finish
    // in one chunk.
    const CHUNK = 50;
    for (let i = 0; i < contacts.length; i += CHUNK) {
      const slice = contacts.slice(i, i + CHUNK);
      await prisma.$transaction(
        slice.map((c: any) => {
          const snap = computeHygieneSnapshot(c);
          buckets[snap.hygieneVerdict] = (buckets[snap.hygieneVerdict] || 0) + 1;
          const data: any = {
            hygieneScore: snap.hygieneScore,
            hygieneVerdict: snap.hygieneVerdict,
            hygieneFlags: snap.hygieneFlags,
            hygieneCheckedAt: snap.hygieneCheckedAt,
            emailValidity: snap.emailValidity,
            linkedinValidity: snap.linkedinValidity,
          };
          // Only flip hiddenFromWizard when autoHide is on. The scan in
          // preview mode (default) stores the verdict but leaves
          // visibility alone so an admin can review before committing.
          // We also NEVER flip a contact that's been explicitly unflagged
          // by an admin — that's respected until the admin re-hides it
          // manually. (We can't detect "explicitly unflagged" today
          // because hiddenFromWizard is just a bool, but we avoid
          // auto-flipping the `false` → `true` direction unless the
          // contact's suggestedHidden is true AND it's currently false.)
          if (autoHide && snap.suggestedHidden && !c.hiddenFromWizard) {
            data.hiddenFromWizard = true;
            hidden++;
          }
          return prisma.contact.update({ where: { id: c.id }, data });
        }),
      );
      scanned += slice.length;
    }

    return NextResponse.json({
      ok: true,
      scanned,
      totalCandidates: contacts.length,
      buckets,
      hiddenThisRun: hidden,
      autoHide,
      onlyStale,
      staleHours,
    });
  } catch (e: any) {
    console.error("[contact-hygiene/scan] failed:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
