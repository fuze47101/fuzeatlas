// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/inbound/email
 *
 * Inbound email webhook for BCC-to-Atlas logging (HubSpot pattern).
 *
 * Provider-agnostic. Accepts:
 *   • CloudMailin JSON        ({ headers, envelope, plain, html, ... })
 *   • Postmark Inbound JSON   ({ From, To, Cc, Subject, TextBody, HtmlBody, MessageID })
 *   • SendGrid Inbound Parse  (form-encoded — not handled here, POST JSON only)
 *   • Generic shape           ({ from, to, cc, subject, text, html, messageId })
 *
 * Auth: X-Webhook-Secret header must match env INBOUND_EMAIL_SECRET.
 *
 * Flow:
 *   1. Parse payload into a canonical envelope
 *   2. Determine direction: if `from` address matches a User.email → OUTBOUND, else INBOUND
 *   3. Collect candidate contact emails (INBOUND: from; OUTBOUND: to + cc)
 *   4. Find Contact records matching those emails
 *   5. Create a Note (noteType = "EMAIL") on each matched contact, bubbling
 *      the contact's brand/factory relation so it shows on those timelines too
 *   6. Dedup on emailMessageId via @@unique index
 *
 * Setup for Andrew (Outlook BCC pattern):
 *   • Sign up for CloudMailin or Postmark Inbound, get a dedicated address
 *     (e.g. log@em.fuzeatlas.com if MX'd, or the provider-assigned address)
 *   • Point it at https://fuzeatlas.com/api/inbound/email with the secret header
 *   • Create an Outlook Rule: "After sending, BCC log@em.fuzeatlas.com"
 *   • Every outbound email is silently BCC'd to the logger and landed on the
 *     matching Contact's timeline automatically
 */
export async function POST(req: Request) {
  // ─── Auth ─────────────────────────────────────────────
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) {
    console.error("[inbound-email] INBOUND_EMAIL_SECRET not set — rejecting");
    return NextResponse.json({ ok: false, error: "Inbound email not configured" }, { status: 503 });
  }
  const provided =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("x-atlas-secret") ||
    new URL(req.url).searchParams.get("secret");
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ─── Parse ────────────────────────────────────────────
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const env = normalize(payload);
  if (!env.from) {
    return NextResponse.json({ ok: false, error: "Missing From address" }, { status: 400 });
  }

  // ─── Dedup check ──────────────────────────────────────
  if (env.messageId) {
    const existing = await prisma.note.findUnique({
      where: { emailMessageId: env.messageId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        deduped: true,
        noteId: existing.id,
      });
    }
  }

  // ─── Direction: outbound if `from` matches a User ─────
  const sender = await prisma.user.findFirst({
    where: { email: { equals: env.from, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const direction = sender ? "OUTBOUND" : "INBOUND";

  // ─── Figure out which emails to match against Contact records ─
  // For OUTBOUND: recipients are the contacts.
  // For INBOUND:  sender is the contact.
  const contactEmails: string[] =
    direction === "OUTBOUND"
      ? dedup([...env.to, ...env.cc]).filter((e) => e.toLowerCase() !== env.from.toLowerCase())
      : [env.from];

  // Exclude any addresses that belong to known users (staff don't get CRM'd)
  const allUserEmails = await prisma.user.findMany({
    where: {
      email: { in: contactEmails, mode: "insensitive" },
    },
    select: { email: true },
  });
  const staffSet = new Set(allUserEmails.map((u: any) => (u.email || "").toLowerCase()));
  const candidateEmails = contactEmails.filter((e) => !staffSet.has(e.toLowerCase()));

  if (candidateEmails.length === 0) {
    // Nothing to link — log a no-op note for visibility but return 200
    return NextResponse.json({
      ok: true,
      matched: 0,
      note: "No non-staff recipients matched",
    });
  }

  // ─── Match to Contacts ────────────────────────────────
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { email: { in: candidateEmails, mode: "insensitive" } },
        { personalEmail: { in: candidateEmails, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      personalEmail: true,
      name: true,
      brandId: true,
      factoryId: true,
      distributorId: true,
    },
  });

  if (contacts.length === 0) {
    return NextResponse.json({
      ok: true,
      matched: 0,
      candidateEmails,
      note: "No Contact records matched — email not logged",
    });
  }

  // ─── Build note content ───────────────────────────────
  const body = (env.text || stripHtml(env.html) || "").trim();
  const preview = body.slice(0, 2000);
  const truncated = body.length > 2000 ? "\n\n… [truncated]" : "";
  const prefix =
    direction === "OUTBOUND"
      ? `📤 Sent: ${env.subject || "(no subject)"}`
      : `📥 Received: ${env.subject || "(no subject)"}`;
  const content = `${prefix}\n\n${preview}${truncated}`.trim();

  // ─── Create one Note per matched contact ──────────────
  const created: any[] = [];
  for (const c of contacts) {
    try {
      // Unique index on emailMessageId means only ONE of these creates can
      // win per messageId — if multiple contacts matched, we append a suffix
      // so the unique constraint doesn't block subsequent inserts.
      const messageIdForNote =
        env.messageId && contacts.length > 1 ? `${env.messageId}#${c.id}` : env.messageId || null;

      const note = await prisma.note.create({
        data: {
          content,
          noteType: "EMAIL",
          date: env.date || new Date(),
          contactId: c.id,
          contactName: c.name || null,
          brandId: c.brandId || null,
          factoryId: c.factoryId || null,
          userId: sender?.id || null,
          emailDirection: direction,
          emailSubject: env.subject || null,
          emailFrom: env.from,
          emailTo: env.to.join(", ") || null,
          emailCc: env.cc.join(", ") || null,
          emailMessageId: messageIdForNote,
        },
        select: { id: true, brandId: true, factoryId: true, contactId: true },
      });
      created.push(note);
    } catch (err: any) {
      console.error("[inbound-email] note create failed:", err?.message || err);
    }
  }

  // BD Portal #36: bump lastActivityAt on every brand touched by this email.
  // Sent/received email to a contact = BD activity, keeps the rep "warm" against
  // the 90-day auto-release cron.
  const brandIds = Array.from(
    new Set(created.map((n: any) => n.brandId).filter(Boolean)),
  ) as string[];
  if (brandIds.length > 0) {
    await prisma.brand
      .updateMany({
        where: { id: { in: brandIds } },
        data: { lastActivityAt: new Date(), inactivityWarnedAt: null },
      })
      .catch(() => {});
  }

  // ─── BD Wizard Phase 4: auto-detect replies ───────────
  // When an INBOUND email lands on a contact with an active BDSequence,
  // fire the same logic as /api/admin/bd/sequence/[id]/mark-replied —
  // exit the sequence (reason=replied), drop a CrmTask + Notification on
  // the rep linking to the reply wizard. Idempotent: if the sequence is
  // already exited, no-op.
  const autoRepliedSequences: any[] = [];
  if (direction === "INBOUND") {
    const contactIds = contacts.map((c: any) => c.id);
    const activeSequences = await prisma.bDSequence.findMany({
      where: {
        status: "active",
        contactId: { in: contactIds },
      },
      include: {
        brand: { select: { id: true, name: true } },
        contact: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    for (const seq of activeSequences) {
      try {
        const contactName =
          seq.contact?.name ||
          [seq.contact?.firstName, seq.contact?.lastName].filter(Boolean).join(" ") ||
          seq.contact?.email ||
          "contact";
        const brandName = seq.brand?.name || "brand";
        const replyWizardLink = `/admin/bd/wizard/reply?sequenceId=${seq.id}`;
        const snippet = (env.text || stripHtml(env.html) || "").trim().slice(0, 500);

        await prisma.bDSequence.update({
          where: { id: seq.id },
          data: {
            status: "exited",
            exitReason: "replied",
            completedAt: new Date(),
          },
        });

        await prisma.crmTask.create({
          data: {
            title: `Reply from ${contactName} at ${brandName}`,
            notes: [
              snippet ? `What they said: ${snippet}` : null,
              `Respond via wizard: ${replyWizardLink}`,
              "(auto-detected from BCC-to-Atlas)",
            ]
              .filter(Boolean)
              .join("\n\n"),
            dueAt: new Date(),
            status: "OPEN",
            priority: "HIGH",
            ownerId: seq.repId,
            createdById: seq.repId,
            brandId: seq.brandId,
          },
        });

        await prisma.notification.create({
          data: {
            userId: seq.repId,
            type: "BRAND_ACTIVITY",
            title: `Reply from ${contactName}`,
            message: snippet
              ? `${contactName} (${brandName}): "${snippet.slice(0, 140)}${snippet.length > 140 ? "…" : ""}"`
              : `${contactName} at ${brandName} replied. Open the reply wizard to draft a response.`,
            link: replyWizardLink,
            metadata: {
              sequenceId: seq.id,
              brandId: seq.brandId,
              contactId: seq.contactId,
              source: "bcc",
              replySnippet: snippet || null,
              emailSubject: env.subject || null,
              emailMessageId: env.messageId || null,
            },
          },
        });

        autoRepliedSequences.push({ sequenceId: seq.id, repId: seq.repId });
      } catch (err: any) {
        console.error("[inbound-email] auto-mark-replied failed:", err?.message || err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    matched: contacts.length,
    created: created.length,
    direction,
    notes: created,
    autoRepliedSequences,
  });
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function normalize(p: any): {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string;
  messageId: string;
  date: Date | null;
} {
  // CloudMailin
  if (p && p.envelope && p.headers) {
    return {
      from: extractEmail(p.envelope?.from || p.headers?.From || ""),
      to: extractAll(p.headers?.To),
      cc: extractAll(p.headers?.Cc),
      subject: (p.headers?.Subject || "").toString(),
      text: (p.plain || "").toString(),
      html: (p.html || "").toString(),
      messageId: (p.headers?.["Message-ID"] || p.headers?.["Message-Id"] || "").toString().trim(),
      date: parseDate(p.headers?.Date),
    };
  }

  // Postmark Inbound
  if (p && (p.From || p.FromFull) && (p.MessageID || p.HtmlBody || p.TextBody)) {
    const toArr: string[] = Array.isArray(p.ToFull)
      ? p.ToFull.map((t: any) => t.Email).filter(Boolean)
      : extractAll(p.To);
    const ccArr: string[] = Array.isArray(p.CcFull)
      ? p.CcFull.map((c: any) => c.Email).filter(Boolean)
      : extractAll(p.Cc);
    return {
      from: extractEmail(p.FromFull?.Email || p.From || ""),
      to: toArr,
      cc: ccArr,
      subject: (p.Subject || "").toString(),
      text: (p.TextBody || "").toString(),
      html: (p.HtmlBody || "").toString(),
      messageId: (p.MessageID || "").toString().trim(),
      date: parseDate(p.Date),
    };
  }

  // Generic
  return {
    from: extractEmail(p.from || ""),
    to: extractAll(p.to),
    cc: extractAll(p.cc),
    subject: (p.subject || "").toString(),
    text: (p.text || "").toString(),
    html: (p.html || "").toString(),
    messageId: (p.messageId || p.messageID || p["message-id"] || "").toString().trim(),
    date: parseDate(p.date),
  };
}

/** Extract a single email address from a "Name <email@x>" string */
function extractEmail(s: string): string {
  if (!s) return "";
  const str = s.toString().trim();
  const m = str.match(/<([^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  const m2 = str.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  return m2 ? m2[0].toLowerCase() : "";
}

/** Extract every email address from a string or array */
function extractAll(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return dedup(v.flatMap((item) => extractAll(item)));
  }
  const str = v.toString();
  const matches = str.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g);
  return dedup((matches || []).map((e: string) => e.toLowerCase()));
}

function dedup<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

// Quick reachability check / setup sanity probe
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "inbound-email",
    configured: Boolean(process.env.INBOUND_EMAIL_SECRET),
  });
}
