// @ts-nocheck
/**
 * GET /api/cron/generate-esg-snapshot — Phase 12C.
 *
 * Bearer-authed. Registered quarterly at the 1st of Jan / Apr /
 * Jul / Oct at 06:00 UTC: `0 6 1 1,4,7,10 *`.
 *
 * For every Brand whose BrandProfile.publicEnabled = true, compute
 * the snapshot for the CURRENT quarter (the one that just closed
 * when this cron runs at 06:00 UTC on the 1st). Upserts a
 * BrandEsgSnapshot row keyed on (brandId, period).
 *
 * The PDF rendering (publicPdfUrl) is left blank — admin attaches
 * a published PDF manually via /admin/brands/[id]/esg-snapshots.
 * Auto-PDF deferred until a brand asks for one.
 *
 * Idempotent: re-runs upsert the same quarter row in place. Safe
 * to invoke ad-hoc via `fzcron generate-esg-snapshot`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { CO2_AVOIDED_KG_PER_LITER } from "@/lib/esg-math";

/**
 * MB-5 — after each per-brand snapshot upsert we also fire a
 * quarterly ESG email to the brand's primary AM + brand managers.
 * Dedupe is scoped to (brandId, period) so re-running the cron in
 * the same quarter never double-sends. Recipients come from
 * EntityManager (role=ACCOUNT_MANAGER, isPrimary=true) plus any
 * active BRAND_MANAGER users on the brand. Branding pulls from
 * BrandProfile.logoUrl + primaryColor when present.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EsgEmailPayload {
  brandId: string;
  brandName: string;
  period: string;
  fabricsCertified: number;
  testsRunCount: number;
  testsPassedCount: number;
  fuzeConsumedLiters: number;
  factoryCountActive: number;
}

async function emailQuarterlyEsg(payload: EsgEmailPayload): Promise<{
  emailed: number;
  skippedAlreadySent: boolean;
  errors: any[];
}> {
  const dedupeKey = `${payload.brandId}:${payload.period}`;
  // Quarterly cadence — use a 90-day suppression window keyed on
  // (kind, scopeId) so we never re-send for the same brand+quarter.
  const since = new Date(Date.now() - 90 * 86400_000);
  const prior = await prisma.notification
    .findFirst({
      where: {
        createdAt: { gte: since },
        metadata: { path: ["kind"], equals: "esg-snapshot-quarterly" },
        AND: { metadata: { path: ["scopeId"], equals: dedupeKey } },
      },
      select: { id: true },
    })
    .catch(() => null);
  if (prior) {
    return { emailed: 0, skippedAlreadySent: true, errors: [] };
  }

  // Primary AM via EntityManager + any BRAND_MANAGER user on the brand.
  const ems = await prisma.entityManager
    .findMany({
      where: {
        entityType: "BRAND",
        entityId: payload.brandId,
        role: "ACCOUNT_MANAGER",
      },
      select: {
        userId: true,
        isPrimary: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    })
    .catch(() => []);
  const primaryAms = ems
    .filter((e: any) => e.isPrimary && e.user?.status === "ACTIVE" && e.user?.email)
    .map((e: any) => e.user);
  const fallbackAms = ems
    .filter((e: any) => e.user?.status === "ACTIVE" && e.user?.email)
    .map((e: any) => e.user);
  const amRecipients = primaryAms.length ? primaryAms : fallbackAms;

  const brandManagers = await prisma.user
    .findMany({
      where: {
        brandId: payload.brandId,
        role: "BRAND_MANAGER",
        status: "ACTIVE",
        email: { not: null },
      },
      select: { id: true, name: true, email: true },
    })
    .catch(() => []);

  const seen = new Set<string>();
  const recipients: { id: string; name: string | null; email: string }[] = [];
  for (const u of [...amRecipients, ...brandManagers]) {
    if (!u?.email || seen.has(u.id)) continue;
    seen.add(u.id);
    recipients.push({ id: u.id, name: u.name, email: u.email });
  }
  if (recipients.length === 0) {
    return { emailed: 0, skippedAlreadySent: false, errors: [] };
  }

  // BrandProfile branding (best-effort — falls back to FUZE branding).
  const profile = await prisma.brandProfile
    .findUnique({
      where: { brandId: payload.brandId },
      select: { logoUrl: true, primaryColor: true },
    })
    .catch(() => null);

  const passRate =
    payload.testsRunCount > 0
      ? Math.round((payload.testsPassedCount / payload.testsRunCount) * 100)
      : null;
  const co2AvoidedKg = Math.round(payload.fuzeConsumedLiters * CO2_AVOIDED_KG_PER_LITER);
  const accentColor = profile?.primaryColor || "#00b4c3";
  const logoBlock = profile?.logoUrl
    ? `<img src="${escapeHtml(profile.logoUrl)}" alt="${escapeHtml(payload.brandName)} logo" style="height:36px;max-width:160px;object-fit:contain;background:white;border-radius:6px;padding:4px;" />`
    : `<div style="font-weight:800;color:white;font-size:13px;letter-spacing:0.1em;">FUZE ATLAS</div>`;

  const subject = `${payload.brandName} — ${payload.period} FUZE sustainability snapshot`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">
  <div style="background:${escapeHtml(accentColor)};padding:20px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;gap:16px;">
    ${logoBlock}
    <span style="color:white;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">${escapeHtml(payload.period)} ESG</span>
  </div>
  <div style="background:white;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;">${escapeHtml(payload.brandName)} — quarterly sustainability snapshot</h1>
    <p style="margin:0 0 18px;font-size:13px;color:#64748b;">
      Auto-generated by FUZE Atlas for ${escapeHtml(payload.period)}. Numbers reflect the
      production activity across every factory linked to your supply chain over the
      quarter.
    </p>

    <table style="width:100%;border-collapse:separate;border-spacing:0 6px;font-size:13px;">
      <tr>
        <td style="padding:10px 12px;background:#ecfeff;border-radius:8px;width:50%;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#0e7490;font-weight:700;">FUZE consumed</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px;">${payload.fuzeConsumedLiters.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px 12px;background:#ecfdf5;border-radius:8px;width:50%;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#047857;font-weight:700;">CO₂e avoided vs PFAS</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px;">${co2AvoidedKg.toLocaleString()} kg</div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 12px;background:#f0f9ff;border-radius:8px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#0369a1;font-weight:700;">Fabrics certified</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px;">${payload.fabricsCertified}</div>
        </td>
        <td></td>
        <td style="padding:10px 12px;background:#fef3c7;border-radius:8px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#92400e;font-weight:700;">Active factories</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px;">${payload.factoryCountActive}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="padding:10px 12px;background:#f1f5f9;border-radius:8px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#475569;font-weight:700;">Lab tests run / passed</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:2px;">
            ${payload.testsRunCount} run · ${payload.testsPassedCount} passed${passRate != null ? ` · ${passRate}% pass rate` : ""}
          </div>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="${APP_URL}/brand-portal" style="display:inline-block;padding:11px 26px;background:${escapeHtml(accentColor)};color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
        Open ${escapeHtml(payload.brandName)} dashboard →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
      For a printable trust pack go to <a href="${APP_URL}/brand-portal/documents" style="color:${escapeHtml(accentColor)};">Documents → Generate trust pack</a>.
      Reply directly with any questions and we'll route to your account manager.
    </p>
  </div>
</div>`;

  const errors: any[] = [];
  let emailed = 0;
  for (const r of recipients) {
    try {
      const res = await sendEmail({
        to: r.email,
        subject,
        html,
        replyTo: "andrew@fuze47.com",
      });
      if (res?.ok) emailed++;
      else errors.push({ userId: r.id, error: res?.error });
    } catch (e: any) {
      errors.push({ userId: r.id, error: e?.message || String(e) });
    }
  }

  // Stamp the dedupe Notification on the first recipient so 90-day
  // suppression works for next-quarter re-runs of the same period.
  if (emailed > 0) {
    try {
      await prisma.notification.create({
        data: {
          userId: recipients[0].id,
          type: "BRAND_ACTIVITY",
          title: `${payload.brandName} — ${payload.period} ESG snapshot sent`,
          message: `Quarterly snapshot emailed to ${emailed} recipient${emailed === 1 ? "" : "s"}.`,
          link: `/brand-portal`,
          metadata: {
            kind: "esg-snapshot-quarterly",
            scopeId: dedupeKey,
            brandId: payload.brandId,
            period: payload.period,
          },
        },
      });
    } catch (e) {
      console.warn("[esg-snapshot] dedupe notification write failed:", e);
    }
  }

  return { emailed, skippedAlreadySent: false, errors };
}

function priorQuarter(now: Date = new Date()): {
  period: string;
  periodStart: Date;
  periodEnd: Date;
} {
  // The "current snapshot" is the quarter that just closed. If
  // today is Apr 1 we want Q1: Jan 1 – Mar 31.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0..11
  // Compute the quarter that just ended.
  let q: number, qYear: number;
  if (month === 0 || (month === 1 && now.getUTCDate() < 2)) {
    // Edge — Jan first half = prior year Q4
    q = 4;
    qYear = year - 1;
  } else if (month < 4) {
    q = 1;
    qYear = year;
  } else if (month < 7) {
    q = 2;
    qYear = year;
  } else if (month < 10) {
    q = 3;
    qYear = year;
  } else {
    q = 4;
    qYear = year;
  }
  const startMonth = (q - 1) * 3;
  const periodStart = new Date(Date.UTC(qYear, startMonth, 1));
  const periodEnd = new Date(Date.UTC(qYear, startMonth + 3, 1));
  periodEnd.setUTCMilliseconds(-1);
  return { period: `${qYear}-Q${q}`, periodStart, periodEnd };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const periodOverride = url.searchParams.get("period"); // optional manual: 2026-Q2

  const { period: autoPeriod, periodStart: autoStart, periodEnd: autoEnd } = priorQuarter();
  let period = autoPeriod;
  let periodStart = autoStart;
  let periodEnd = autoEnd;
  if (periodOverride) {
    const m = periodOverride.match(/^(\d{4})-Q([1-4])$/);
    if (m) {
      const yr = parseInt(m[1], 10);
      const q = parseInt(m[2], 10);
      const startMonth = (q - 1) * 3;
      periodStart = new Date(Date.UTC(yr, startMonth, 1));
      periodEnd = new Date(Date.UTC(yr, startMonth + 3, 1));
      periodEnd.setUTCMilliseconds(-1);
      period = periodOverride;
    }
  }

  const brands = await prisma.brand.findMany({
    where: {
      profile: { publicEnabled: true },
    },
    select: { id: true, name: true },
  });

  const results: any[] = [];
  for (const b of brands) {
    try {
      // fabricsCertified — distinct fabricIds in approved submissions over period
      const subs = await prisma.fabricSubmission.findMany({
        where: {
          brandId: b.id,
          brandApprovalStatus: "APPROVED",
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
        select: { fabricId: true, factoryId: true },
      });
      const fabricsCertified = new Set(subs.map((s) => s.fabricId).filter(Boolean)).size;
      const factoryCountActive = new Set(
        subs.map((s) => s.factoryId).filter(Boolean),
      ).size;

      const testsRunCount = await prisma.testRun.count({
        where: {
          submission: { brandId: b.id },
          testDate: { gte: periodStart, lte: periodEnd },
        },
      });
      const testsPassedCount = await prisma.testRun.count({
        where: {
          submission: { brandId: b.id },
          brandApprovalStatus: "APPROVED",
          testDate: { gte: periodStart, lte: periodEnd },
        },
      });

      // FUZE consumption in liters tied to this brand over period
      const consAgg = await prisma.fuzeConsumption.aggregate({
        where: {
          brandId: b.id,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { litersUsed: true },
      });
      const fuzeConsumedLiters = consAgg._sum.litersUsed || 0;

      // zeroPfasFabricCount — count of distinct fabrics on approved
      // submissions in period. FUZE is PFAS-free by chemistry, so
      // every certified fabric qualifies. (When PFAS-status becomes
      // a per-fabric column we can refine.)
      const zeroPfasFabricCount = fabricsCertified;

      const snap = await prisma.brandEsgSnapshot.upsert({
        where: { brandId_period: { brandId: b.id, period } },
        create: {
          brandId: b.id,
          period,
          periodStart,
          periodEnd,
          fabricsCertified,
          testsRunCount,
          testsPassedCount,
          fuzeConsumedLiters,
          factoryCountActive,
          zeroPfasFabricCount,
        },
        update: {
          fabricsCertified,
          testsRunCount,
          testsPassedCount,
          fuzeConsumedLiters,
          factoryCountActive,
          zeroPfasFabricCount,
          generatedAt: new Date(),
        },
      });
      // MB-5 — quarterly email to primary AM + brand managers.
      // Fire-and-forget so a notify failure can't roll back the
      // upsert. Returns per-brand stats so the cron response shows
      // who got what.
      let emailStats: any = null;
      try {
        emailStats = await emailQuarterlyEsg({
          brandId: b.id,
          brandName: b.name,
          period,
          fabricsCertified,
          testsRunCount,
          testsPassedCount,
          fuzeConsumedLiters,
          factoryCountActive,
        });
      } catch (e: any) {
        emailStats = { emailed: 0, error: e?.message || String(e) };
      }

      results.push({
        brandId: b.id,
        name: b.name,
        period,
        snapshotId: snap.id,
        fabricsCertified,
        testsRunCount,
        testsPassedCount,
        fuzeConsumedLiters,
        email: emailStats,
      });
    } catch (err: any) {
      results.push({ brandId: b.id, name: b.name, error: err?.message || String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    brandsConsidered: brands.length,
    results,
  });
}
