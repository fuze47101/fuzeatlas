// @ts-nocheck
/**
 * notify-recipe.ts
 *
 * One job: when a recipe-bench-test reaches a milestone (ICP validated
 * or graduated to FabricRecipe), auto-notify the factory whose fabric
 * it is — both via email (with a tokenized FabricReportShare link to
 * the public /report/[token] page) and via in-app Notification rows.
 *
 * Built May 2026 in response to the Penfabric/Raihana fire — she had
 * to email Andrew asking for the recipe because graduation never
 * triggered an outbound notification. The architecture for the share
 * link and the report endpoint already exist (see
 * /api/admin/fabric-report/[fabricId]/send and /report/[token]); this
 * helper is the missing automatic trigger.
 *
 * Phase 1 of ROADMAP_v2 will replace this scoped helper with a
 * general-purpose dispatcher that uses NotificationSubscription +
 * SupplyChainLink to fan out across brand / factory / distributor /
 * AM / FUZE ops. For now this is the narrowest cut that fixes the
 * Penfabric class of bugs.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";

type Milestone = "ICP_VALIDATED" | "RECIPE_GRADUATED";

/**
 * Notify the factory associated with this bench test that a recipe
 * milestone has been hit. Idempotent-ish: a new FabricReportShare row
 * is created on each call (tokens are not reused), but failure is
 * non-fatal — graduation/ICP entry should never roll back because
 * notification couldn't be sent.
 *
 * Returns a summary object you can write into the API response so
 * the admin sees what fired.
 */
export async function notifyRecipeMilestone(
  benchTestId: string,
  milestone: Milestone,
  triggeredByUserId: string | null,
): Promise<{
  ok: boolean;
  emailedCount: number;
  notifiedCount: number;
  skippedReason?: string;
  shares?: { token: string; recipientEmail: string }[];
}> {
  try {
    const test = await prisma.recipeBenchTest.findUnique({
      where: { id: benchTestId },
      select: {
        id: true,
        testNumber: true,
        applicationMethod: true,
        pickupDryToWetPct: true,
        icpMeasuredPpm: true,
        icpExpectedPpm: true,
        affinityPct: true,
        notes: true,
        fabricId: true,
        fabric: {
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            factoryId: true,
            brandId: true,
            factory: {
              select: {
                id: true,
                name: true,
                users: {
                  where: { status: "ACTIVE" },
                  select: { id: true, name: true, email: true, locale: true },
                },
              },
            },
            brand: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!test) {
      return { ok: false, emailedCount: 0, notifiedCount: 0, skippedReason: "bench-test-not-found" };
    }
    if (!test.fabricId || !test.fabric) {
      return {
        ok: false,
        emailedCount: 0,
        notifiedCount: 0,
        skippedReason: "no-fabric-link (bench tests without a Fabric can't be shared)",
      };
    }
    const factoryUsers = test.fabric.factory?.users || [];
    if (factoryUsers.length === 0) {
      return {
        ok: false,
        emailedCount: 0,
        notifiedCount: 0,
        skippedReason: "no-factory-users (factory has no active User rows)",
      };
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fuzeatlas.com");

    const fuzeNumber = test.fabric.fuzeNumber;
    const customerCode = test.fabric.customerCode;
    const factoryCode = test.fabric.factoryCode;
    const factoryName = test.fabric.factory?.name || "your factory";
    const brandName = test.fabric.brand?.name || null;

    const milestoneLabel =
      milestone === "ICP_VALIDATED"
        ? "ICP-validated"
        : "graduated";
    const subjectLine =
      milestone === "ICP_VALIDATED"
        ? `FUZE recipe ICP-validated for FUZE-${fuzeNumber}${customerCode ? ` (${customerCode})` : ""}`
        : `FUZE recipe graduated for FUZE-${fuzeNumber}${customerCode ? ` (${customerCode})` : ""} — ready for production trial`;

    const ttlMs = 90 * 24 * 60 * 60 * 1000; // 90 days
    const shares: { token: string; recipientEmail: string }[] = [];
    let emailedCount = 0;
    let notifiedCount = 0;

    for (const u of factoryUsers) {
      // 1. Mint a FabricReportShare token specifically for this user.
      const token = randomBytes(24).toString("base64url");
      try {
        await prisma.fabricReportShare.create({
          data: {
            fabricId: test.fabricId,
            token,
            recipientEmail: u.email,
            recipientName: u.name || null,
            sentByUserId: triggeredByUserId,
            expiresAt: new Date(Date.now() + ttlMs),
            subjectLine,
            emailBody: null, // we'll populate below if email succeeds
          },
        });
        shares.push({ token, recipientEmail: u.email });
      } catch (e: any) {
        console.error("[notify-recipe] FabricReportShare create failed:", e);
        continue;
      }

      const reportUrl = `${appUrl}/report/${token}`;
      const fabricsUrl = `${appUrl}/fabrics/${test.fabricId}`;

      // 2. Email the user.
      const recipeSummaryRows = [
        ["Test #", test.testNumber],
        ["Application method", test.applicationMethod || "—"],
        ["Wet pickup", test.pickupDryToWetPct != null ? `${test.pickupDryToWetPct.toFixed(1)} %` : "—"],
        milestone === "ICP_VALIDATED" && test.icpMeasuredPpm != null
          ? ["ICP measured", `${test.icpMeasuredPpm.toFixed(2)} ppm${test.affinityPct ? ` · ${test.affinityPct.toFixed(0)}% of expected` : ""}`]
          : null,
      ]
        .filter(Boolean)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">${k}</td><td style="padding:6px 12px;font-weight:600;font-size:13px;">${v}</td></tr>`,
        )
        .join("");

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;color:#0f172a;">
          <div style="background:linear-gradient(135deg,#00b4c3,#009ba8);padding:20px 24px;border-radius:12px 12px 0 0;color:white;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.92;">FUZE Atlas — Recipe ${milestoneLabel}</div>
            <h2 style="margin:6px 0 0;font-size:20px;font-weight:800;">FUZE-${fuzeNumber}${customerCode ? ` · ${customerCode}` : ""}</h2>
            ${brandName ? `<div style="font-size:13px;opacity:0.9;margin-top:4px;">For ${brandName} at ${factoryName}</div>` : `<div style="font-size:13px;opacity:0.9;margin-top:4px;">${factoryName}</div>`}
          </div>
          <div style="padding:20px 24px;background:white;border:1px solid #e2e8f0;border-top:none;">
            <p style="margin:0 0 14px;line-height:1.5;">Hi ${u.name?.split(" ")[0] || "there"},</p>
            <p style="margin:0 0 14px;line-height:1.5;">
              The FUZE recipe for your fabric <strong>FUZE-${fuzeNumber}</strong>${customerCode ? ` (${customerCode})` : ""} has been
              <strong>${milestoneLabel}</strong>. The full application recipe — application method, pickup, drying and curing
              conditions, F1–F4 dilution ratios, and any auxiliaries — is now available in your portal.
            </p>
            <table style="border-collapse:collapse;margin-bottom:14px;width:100%;">
              ${recipeSummaryRows}
            </table>
            <div style="margin-top:18px;text-align:center;">
              <a href="${reportUrl}" style="display:inline-block;padding:11px 22px;background:#00b4c3;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;margin-right:8px;">View full report →</a>
              <a href="${fabricsUrl}" style="display:inline-block;padding:11px 22px;background:#f1f5f9;color:#0f172a;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open in Atlas</a>
            </div>
            <p style="margin:18px 0 0;font-size:12px;color:#64748b;line-height:1.5;">
              The "View full report" link above includes a 90-day access token — you can open it without signing in. The
              "Open in Atlas" link requires your portal login. Reply to this email or hit the 🐞 button in Atlas if
              anything's missing.
            </p>
            <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;">
              Sent automatically by Atlas when ${milestone === "ICP_VALIDATED" ? "an ICP validation result is recorded" : "a recipe is graduated"}.
            </p>
          </div>
        </div>
      `;

      try {
        const r = await sendEmail({
          to: u.email,
          subject: subjectLine,
          html,
          replyTo: "andrew@fuze47.com",
        });
        if (r.ok) emailedCount++;
      } catch (e) {
        console.error("[notify-recipe] sendEmail failed:", e);
      }

      // 3. In-app notification.
      try {
        await prisma.notification.create({
          data: {
            userId: u.id,
            type: "TEST_RESULTS",
            title: subjectLine,
            message: `Recipe details (method, drying, curing, F1–F4 dilutions) are now visible on your fabric. Click to open the full report.`,
            link: `/fabrics/${test.fabricId}`,
            metadata: {
              benchTestId: test.id,
              milestone,
              fuzeNumber,
              shareToken: token,
            },
          },
        });
        notifiedCount++;
      } catch (e) {
        console.error("[notify-recipe] Notification create failed:", e);
      }
    }

    return { ok: true, emailedCount, notifiedCount, shares };
  } catch (e: any) {
    console.error("[notify-recipe] top-level failure:", e);
    return {
      ok: false,
      emailedCount: 0,
      notifiedCount: 0,
      skippedReason: e?.message || String(e),
    };
  }
}
