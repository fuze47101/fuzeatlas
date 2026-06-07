// @ts-nocheck
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/cron/email-tina-silvadur-audit
 *
 * One-shot — sends Tina the preliminary answer for ticket
 * cmp21cxdf0003l3046ym14iqj (Silvadur formaldehyde binder). Pulled
 * from the DuPont TDS 101-TD 07.02.19 read verbatim 2026-06-06.
 *
 * Bearer-authed. Idempotent in practice (mail provider drops dupes
 * within a short window, and the audit doc has the same content
 * persisted).
 */
const CRON_SECRET = process.env.CRON_SECRET;
const TINA_EMAIL = "tina@fuze47.com";

const BODY_HTML = `
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:680px;color:#0f172a;line-height:1.45">
  <p>Tina —</p>
  <p>Quick preliminary answer on your Silvadur formaldehyde question while we wait on the
    mill's SDS to land. I pulled DuPont's published <strong>SILVADUR 930 FLEX TDS
    (Form 101-TD 07.02.19)</strong> end-to-end + the EPA Master Label
    (Reg 464-785, 2017-02-06) and audited what they specify for the
    application chemistry.</p>

  <h3 style="margin-top:18px;margin-bottom:6px">Short answer</h3>
  <p><strong>No, the Silvadur application step itself does not use formaldehyde or any
    formaldehyde-releasing binder.</strong> Your mill's reply is consistent with what
    DuPont publishes.</p>
  <p>The reason: Silvadur 930 Flex IS its own binder. DuPont's TDS calls it a
    "patented, polymer-based delivery system" and "Smart control polymer" — the
    polymer is what fixes the silver to the fiber. The published application recipe
    calls only for acetic-acid pH adjustment + acetate buffer + drying not above
    180°C. <strong>No DMDHEU. No melamine-formaldehyde. No external crosslinker.</strong>
    Exhaustion happens at room temperature.</p>

  <h3 style="margin-top:18px;margin-bottom:6px">Where formaldehyde COULD still show up (and it's not Silvadur's fault)</h3>
  <p>The TDS says Silvadur is "compatible with… antiwrinkle resins." If a mill is
    running an easy-care / wrinkle-free / durable-press finish on the same fabric,
    that anti-wrinkle resin is <strong>typically DMDHEU</strong> — which is the
    industry-standard durable-press crosslinker and IS formaldehyde-releasing. The
    two chemistries can co-exist on the fabric; the formaldehyde in that scenario
    comes from the easy-care line, not from Silvadur.</p>
  <p>So if you want to close the loop with the mill, ask them this specific
    follow-up:</p>
  <blockquote style="border-left:3px solid #cbd5e1;padding-left:12px;color:#334155;margin:10px 0">
    "Does your finishing line run any easy-care, durable-press, or anti-wrinkle
    resin on the same fabric you're treating with Silvadur? If yes, what's the
    crosslinker chemistry — DMDHEU? Glyoxal? Polycarboxylic acid?"
  </blockquote>
  <p>That question cleanly separates the antimicrobial chemistry (Silvadur, no
    formaldehyde) from the easy-care chemistry (where formaldehyde would live, if
    it's there at all).</p>

  <h3 style="margin-top:18px;margin-bottom:6px">What I corrected in Atlas</h3>
  <p>Our <code>src/lib/competitors.ts</code> row for Silvadur 930 had it wrong —
    it had <code>binderRequired:true</code>, <code>binderType:"acrylic co-polymer
    with crosslinker"</code>, and <code>binderFormaldehyde:true</code>. Those
    were Phase 19.5 archetype defaults that hadn't been checked against the
    published TDS. Today's audit flipped all three to the right values per
    the DuPont document. The full transcript is in
    <code>deliverables/Competitor_SDS_Audit_2026-06.md</code> under the
    2026-06-06 entry.</p>

  <h3 style="margin-top:18px;margin-bottom:6px">The competitive lever that survives</h3>
  <p>Silvadur 930 Flex still has real liabilities — they're just different ones
    from the formaldehyde angle:</p>
  <ol>
    <li><strong>99.902% Other Ingredients undisclosed</strong> on EPA Reg 464-785.
      The polymer carrier composition isn't published. Brands can't independently
      assess polymer breakdown products, microplastic shedding, or end-of-life
      recoverability. FUZE publishes its full composition (DI water +
      metamaterial).</li>
    <li><strong>50-wash marketing claim with no third-party validation.</strong>
      EPA doesn't certify wash counts. LANXESS/DuPont doesn't publish independent
      AATCC 100 reports through the durability window. FUZE shares its
      AATCC 100 / ISO 20743 reports through 100 washes on request — the asymmetry
      we've used with KUIU and others.</li>
    <li><strong>Silver leaching by design.</strong> Even without a separate
      binder, the silver active is ion-leaching chemistry — that's how it scores
      on AATCC 100. FUZE is non-leaching contact-kill (the ASTM E2149 vs AATCC 100
      story we've built out).</li>
    <li><strong>Mill-side formaldehyde from co-applied easy-care finishes.</strong>
      If the brand wants both antimicrobial and wrinkle-free, DMDHEU enters the
      chain via the easy-care resin. FUZE applied alone has no formaldehyde at any
      step; if the brand also wants easy-care, that decision becomes a brand-level
      chemistry choice independent of FUZE.</li>
  </ol>

  <p>When you do get the mill's SDS, forward it and I'll do the full Phase 19.5
    pass — but the bottom line on your formaldehyde question is already in good
    shape per DuPont's own published TDS.</p>

  <p>— Andrew (via FUZE Atlas auto-audit, 2026-06-06)</p>
</div>
`;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await sendEmail({
      to: TINA_EMAIL,
      cc: ["andrew@fuze47.com"],
      subject: "[FUZE Atlas] Preliminary answer — Silvadur 930 Flex formaldehyde audit",
      html: BODY_HTML,
    });
    return NextResponse.json({
      ok: true,
      sentTo: TINA_EMAIL,
      cc: ["andrew@fuze47.com"],
      verdict: "Preliminary Silvadur audit emailed to Tina (cc Andrew).",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "send failed" }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;
