// @ts-nocheck
/**
 * GET /api/admin/bd/wizard/preflight?contactId=<id>&channel=email|linkedin
 *
 * Compliance + send-readiness check for the BD Wizard, run from the
 * Draft step BEFORE the rep hits Send. Returns a structured report of
 * what's configured and what's blocking.
 *
 * The old flow was: rep hits Send → Resend returns an error → UI shows
 * "email send failed" with no context. Now the wizard calls preflight,
 * renders actionable setup issues (missing API key, unverified sender,
 * blank outboundFromEmail, invalid recipient), and only enables the
 * Send button when everything checks out.
 *
 * Checks performed:
 *   - Server: RESEND_API_KEY configured?
 *   - Rep:    outboundFromEmail set on the user profile?
 *   - Rep:    sending domain has a DMARC TXT record? (soft — warn-only)
 *   - Rep:    sending domain has an SPF TXT record? (soft — warn-only)
 *   - Contact: has a usable email address?
 *   - Contact: email format parses cleanly?
 *   - Contact: no recent bounce/failure on this address in OutreachMessage?
 *   - Contact: contact-quality isn't "placeholder" (John Doe etc.)
 *
 * Response shape:
 *   {
 *     ok: true,
 *     ready: boolean,           // true iff no BLOCK-severity issues
 *     issues: [{ severity, code, title, fix, docsPath? }],
 *     config: { ... diagnostic flags ... }
 *   }
 *
 * LinkedIn channel skips the Resend checks — that path doesn't use email.
 */
import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { assessContact } from "@/lib/contact-quality";

type Severity = "block" | "warn" | "info";

interface Issue {
  severity: Severity;
  code: string;
  title: string;
  /** Short, plain-language "here's how to fix it". */
  fix: string;
  /** Optional in-app path the UI can link the rep to. */
  docsPath?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkDnsText(domain: string, prefix: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(domain);
    const flat = records
      .map((r) => r.join(""))
      .join("\n")
      .toLowerCase();
    return flat.includes(prefix);
  } catch {
    return false;
  }
}

async function checkDmarc(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    return records.some((r) => r.join("").toLowerCase().startsWith("v=dmarc1"));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");
    const channel = (searchParams.get("channel") || "email").toLowerCase();

    if (!contactId) {
      return NextResponse.json({ ok: false, error: "contactId is required" }, { status: 400 });
    }
    if (channel !== "email" && channel !== "linkedin") {
      return NextResponse.json(
        { ok: false, error: "channel must be 'email' or 'linkedin'" },
        { status: 400 },
      );
    }

    const [user, contact] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          id: true,
          name: true,
          email: true,
          outboundFromEmail: true,
          outboundFromName: true,
          outboundSignature: true,
        },
      }),
      prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          title: true,
          linkedinUrl: true,
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    const issues: Issue[] = [];
    const config = {
      channel,
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      hasOutboundFrom: Boolean(user.outboundFromEmail),
      outboundFromEmail: user.outboundFromEmail || null,
      outboundFromDomain: user.outboundFromEmail
        ? user.outboundFromEmail.split("@")[1]?.toLowerCase() || null
        : null,
      contactEmail: contact.email || null,
      contactHasEmail: Boolean(contact.email),
      contactQualityVerdict: assessContact(contact).verdict,
      dmarc: null as boolean | null,
      spf: null as boolean | null,
      recentBounce: false,
    };

    // ── Email-channel checks ──
    if (channel === "email") {
      if (!config.hasResendKey) {
        issues.push({
          severity: "block",
          code: "no_resend_key",
          title: "Email delivery is not configured on this server",
          fix: "RESEND_API_KEY is missing from the environment. Ask an admin to add it in Vercel → Settings → Environment Variables and redeploy. Until then email sends will fail or stub silently — the wizard will not let you send.",
          docsPath: "/settings/email",
        });
      }

      if (!config.hasOutboundFrom) {
        issues.push({
          severity: "block",
          code: "no_outbound_from",
          title: "Your sending address is not set",
          fix: "Open Settings → Profile and fill in your outbound email (the address replies come back to). We also recommend setting your display name and signature while you're there.",
          docsPath: "/settings/profile",
        });
      }

      if (!contact.email) {
        issues.push({
          severity: "block",
          code: "contact_no_email",
          title: "This contact has no email address",
          fix: "Add an email to the contact before sending, or switch the channel to LinkedIn DM and copy the draft into LinkedIn manually.",
        });
      } else if (!EMAIL_RE.test(contact.email.trim())) {
        issues.push({
          severity: "block",
          code: "contact_email_invalid",
          title: `Recipient email "${contact.email}" does not look valid`,
          fix: "Edit the contact to correct the email address. We're checking format only here — deliverability is separate.",
        });
      }

      if (config.contactQualityVerdict === "placeholder") {
        issues.push({
          severity: "block",
          code: "contact_is_placeholder",
          title: "This contact looks like a placeholder (John/Jane Doe, test@example.com, etc.)",
          fix: "Pick a different contact, or update this one with a real name and email before sending. The contact-quality check is the same one that filters the Step-2 list.",
        });
      }

      // ── DNS sanity on the rep's sending domain ──
      // Soft — we don't block on missing records because lots of legit
      // senders omit DMARC initially, but we surface them prominently.
      if (config.outboundFromDomain) {
        const [dmarc, spf] = await Promise.all([
          checkDmarc(config.outboundFromDomain),
          checkDnsText(config.outboundFromDomain, "v=spf1"),
        ]);
        config.dmarc = dmarc;
        config.spf = spf;
        if (!spf) {
          issues.push({
            severity: "warn",
            code: "no_spf",
            title: `Your sending domain (${config.outboundFromDomain}) has no SPF record`,
            fix: "Ask your email admin to publish a TXT record starting with v=spf1 that includes Resend. Without SPF, cold sends land in spam.",
          });
        }
        if (!dmarc) {
          issues.push({
            severity: "warn",
            code: "no_dmarc",
            title: `Your sending domain has no DMARC record at _dmarc.${config.outboundFromDomain}`,
            fix: "Start with v=DMARC1; p=none; rua=mailto:dmarc@yourdomain. We'll tighten to quarantine after two weeks of clean reports.",
          });
        }
      }

      // ── Recent bounce history on this recipient ──
      // If the last 2+ messages we sent this email all failed, treat as
      // suppressed — don't burn the sender reputation re-hitting them.
      if (contact.email) {
        const recent = await prisma.outreachMessage.findMany({
          where: { toAddress: contact.email.toLowerCase(), channel: "email" },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { status: true, createdAt: true },
        });
        const failed = recent.filter((m) => m.status === "failed" || m.status === "bounced");
        if (recent.length >= 2 && failed.length >= 2) {
          config.recentBounce = true;
          issues.push({
            severity: "warn",
            code: "recent_bounces",
            title: `Recent sends to ${contact.email} failed ${failed.length} times`,
            fix: "This address may be retired or bouncing. Consider finding a fresh email before you burn more reputation re-hitting it.",
          });
        }
      }
    }

    // ── LinkedIn-channel checks ──
    if (channel === "linkedin") {
      if (!contact.linkedinUrl) {
        issues.push({
          severity: "warn",
          code: "no_linkedin_url",
          title: "This contact has no LinkedIn URL on record",
          fix: "The draft will still be logged, but you'll need to find the right profile manually in LinkedIn to paste it into.",
        });
      }
    }

    const blocks = issues.filter((i) => i.severity === "block");
    return NextResponse.json({
      ok: true,
      ready: blocks.length === 0,
      issues,
      blockCount: blocks.length,
      warnCount: issues.filter((i) => i.severity === "warn").length,
      config,
    });
  } catch (err: any) {
    console.error("[bd/wizard/preflight] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Preflight failed" },
      { status: 500 },
    );
  }
}
