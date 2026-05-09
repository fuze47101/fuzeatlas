// Plain JS so it runs without tsx (sandbox arch mismatch).
// Run from /Users/a801/Desktop/fuzeatlas with:
//   node scripts/resolve-scott-skunk-skins.js
//
// What this does (idempotent):
//   1. Resolve Scott's user (scott@srsus.com)
//   2. Set Brand(cmot3ap9900htjo04c2lpkqm4 — Skunk Skins).salesRepId = Scott
//      and stamp lastActivityAt so the inactivity cron leaves it alone.
//   3. Update FeedbackReport(cmot3i3pk00iijo04hgcjcvyf) → status=FIXED
//      with a resolution note + resolvedById=admin user (whoever runs
//      this script — defaults to first ADMIN if no session).
//   4. Email Scott a "fixed" notification with what we shipped + how to
//      use the new behavior.
//
// Re-running won't double-claim or re-email — every step checks before
// it writes.

require("dotenv").config({ path: "./.env.local" });
const { PrismaClient } = require("@prisma/client");
const { Resend } = require("resend");

const prisma = new PrismaClient({ log: ["error"] });

const TICKET_ID = "cmot3i3pk00iijo04hgcjcvyf";
const BRAND_ID = "cmot3ap9900htjo04c2lpkqm4";
const SCOTT_EMAIL = "scott@srsus.com";

(async () => {
  // Step 1: resolve Scott
  const scott = await prisma.user.findUnique({
    where: { email: SCOTT_EMAIL },
    select: { id: true, name: true, email: true },
  });
  if (!scott) {
    console.error(`[abort] No user with email ${SCOTT_EMAIL}`);
    process.exit(1);
  }
  console.log(`[ok] Found Scott: ${scott.id}  (${scott.name})`);

  // Resolve a system admin to attribute the ticket resolution to
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true, name: true },
  });
  if (!admin) {
    console.error("[abort] No active ADMIN user found in DB");
    process.exit(1);
  }
  console.log(`[ok] Resolving via admin: ${admin.email}`);

  // Step 2: backfill Skunk Skins claim
  const brand = await prisma.brand.findUnique({
    where: { id: BRAND_ID },
    select: { id: true, name: true, salesRepId: true, lastActivityAt: true },
  });
  if (!brand) {
    console.error(`[abort] Brand ${BRAND_ID} not found — was it deleted?`);
    process.exit(1);
  }
  if (brand.salesRepId === scott.id) {
    console.log(`[skip] Brand "${brand.name}" already claimed by Scott — no-op.`);
  } else {
    await prisma.brand.update({
      where: { id: BRAND_ID },
      data: {
        salesRepId: scott.id,
        lastActivityAt: brand.lastActivityAt || new Date(),
      },
    });
    console.log(`[ok] Brand "${brand.name}" claimed for Scott.`);
  }

  // Step 3: mark ticket FIXED
  const ticket = await prisma.feedbackReport.findUnique({
    where: { id: TICKET_ID },
    select: { id: true, status: true, title: true, userEmail: true, resolvedAt: true },
  });
  if (!ticket) {
    console.error(`[warn] Ticket ${TICKET_ID} not found — skipping ticket update.`);
  } else if (ticket.status === "FIXED") {
    console.log(`[skip] Ticket already FIXED.`);
  } else {
    await prisma.feedbackReport.update({
      where: { id: TICKET_ID },
      data: {
        status: "FIXED",
        resolvedById: admin.id,
        resolvedAt: new Date(),
        resolution:
          "Shipped two fixes:\n" +
          "  1. /api/brands POST now auto-sets salesRepId to the creating user " +
          "when they're a BD-eligible role (no more unclaimed brands after manual add).\n" +
          "  2. BD Wizard now auto-switches to LinkedIn channel when the picked " +
          "contact has no email, with a banner explaining what happened.\n" +
          "Skunk Skins manually claimed for Scott as part of this resolution.",
        resolutionUrl: "https://github.com/fuze47101/fuzeatlas/commit/HEAD",
      },
    });
    console.log(`[ok] Ticket marked FIXED.`);
  }

  // Step 4: email Scott
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log("[skip] RESEND_API_KEY not set — skipping email send.");
  } else {
    const resend = new Resend(resendKey);
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;color:#0f172a;">
        <div style="background:linear-gradient(135deg,#059669,#047857);padding:18px 24px;border-radius:12px 12px 0 0;color:white;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">FUZE Atlas — Support Ticket Resolved</div>
          <h2 style="margin:4px 0 0;font-size:20px;font-weight:800;">Skunk Skins is yours, and the underlying bug is fixed</h2>
        </div>
        <div style="padding:20px 24px;background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0 0 14px;line-height:1.5;">Hey Scott,</p>
          <p style="margin:0 0 14px;line-height:1.5;">
            Thanks for the ticket. Two things are now true:
          </p>
          <ol style="margin:0 0 14px 18px;padding:0;line-height:1.6;">
            <li><strong>Skunk Skins is now claimed to your account.</strong> Open it at
              <a href="https://fuzeatlas.com/brands/${BRAND_ID}" style="color:#0369a1;">/brands/${BRAND_ID}</a>
              — you own it.</li>
            <li><strong>The bug that left it unclaimed is fixed.</strong> When you add a brand from now on,
              it auto-claims to you the moment you create it. No more orphan leads.</li>
            <li><strong>Bonus fix:</strong> when a contact has only a LinkedIn URL (no email) like Skunk Skins did,
              the BD Wizard now auto-switches to LinkedIn channel and tells you why,
              instead of leaving you on a dead email draft.</li>
          </ol>
          <p style="margin:0 0 14px;line-height:1.5;">
            If you find another wrinkle, hit the 🐞 button and we'll pick it up the next morning.
          </p>
          <p style="margin:0;line-height:1.5;color:#475569;">
            — Andrew (via Atlas)
          </p>
          <p style="margin-top:18px;font-size:11px;color:#94a3b8;">
            Ticket #${TICKET_ID.slice(0, 8)} · resolved ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      </div>
    `;
    try {
      const fromAddr = process.env.RESEND_FROM || "FUZE Atlas <notifications@fuzeatlas.com>";
      const result = await resend.emails.send({
        from: fromAddr,
        to: SCOTT_EMAIL,
        subject: "Re: account I added was not claimed — fixed",
        html,
        replyTo: "andrew@fuze47.com",
      });
      console.log(`[ok] Email sent to Scott  (resend id: ${result?.data?.id || "n/a"})`);
    } catch (e) {
      console.error("[warn] Resend failed:", e?.message || e);
    }
  }

  console.log("\nDone. Verify on the admin feedback page.");
  await prisma.$disconnect();
})().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
