// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getUserIdFromHeaders } from "@/lib/ai-fetch";
import {
  callAnthropic,
  callOpenAI,
  callGrok,
  callPerplexity,
} from "@/lib/brand-research-callers";
import { apolloPeopleMatch } from "@/lib/apollo-match";
import {
  buildCandidates,
  shouldWriteEmail,
  shouldWriteLinkedIn,
  emailStatusFromVerdict,
  slugName,
  normaliseEmail,
  normaliseLinkedIn,
  type ContactClaim,
  type SourceName,
  type CandidateRecord,
} from "@/lib/enrich-cross-validate";
import { computeHygieneSnapshot } from "@/lib/contact-quality";

/**
 * POST /api/admin/bd/enrich-brand/[id]
 *
 * Ticket 3 — Enrich button with multi-model cross-validation.
 *
 * Fans out five sources in parallel:
 *   1. Apollo People Match (one call per existing Contact on the brand)
 *   2. Anthropic Claude Sonnet 4
 *   3. OpenAI GPT-4o
 *   4. Grok 3
 *   5. Perplexity Sonar Pro
 *
 * Gemini is intentionally excluded — Andrew's call 2026-04-23.
 *
 * Groups all contact claims by name slug, scores per-field agreement (email,
 * linkedin, title, phone), and writes back conservatively:
 *   - Fills empty fields when ≥2 sources agree, or Apollo alone offers it
 *   - Overwrites non-empty fields only when verdict is "verified"
 *     (Apollo + 1 AI, or 3+ AIs agreeing)
 *   - Stamps Contact.emailStatus with the vocabulary used elsewhere in Atlas
 *     (verified / cross_validated / extrapolated / disputed / unknown)
 *   - Refreshes hygiene snapshot (reuses ticket-2 scanner) so the brand's
 *     hygiene badges update immediately
 *   - Drops one Note per enriched contact describing WHICH sources agreed
 *     on WHICH fields, for the audit timeline
 *
 * The brand's `researchData` JSON gets the full cross-validation report so
 * the UI can render "Confirmed by: Apollo + Anthropic + Perplexity (3/5)"
 * chips without re-running everything.
 *
 * Body: { autoCreateContacts?: boolean = true }
 *   - If false, only existing Contacts get enriched; AI-discovered people
 *     not already on the brand are reported in the response but not written.
 *
 * Admin + EMPLOYEE + SALES_MANAGER + BD_REP only.
 */

export const maxDuration = 300; // 5 min — four AIs + N Apollo calls can be slow

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const started = Date.now();
  try {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "BD_REP"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin, manager, or BD rep only" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { autoCreateContacts?: boolean };
    const autoCreateContacts = body.autoCreateContacts !== false;

    // 1) Load brand + existing contacts.
    const brand = await prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        website: true,
        linkedInProfile: true,
        backgroundInfo: true,
        customerType: true,
        projectType: true,
        projectDescription: true,
        pipelineStage: true,
        researchData: true,
      },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    const existingContacts = await prisma.contact.findMany({
      where: { brandId: id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        title: true,
        jobTitle: true,
        email: true,
        phone: true,
        linkedinUrl: true,
        apolloId: true,
        emailStatus: true,
        seniority: true,
      },
    });

    // 2) Build user message for the AI models.
    let userMessage = `Research this brand/company for FUZE Technologies sales outreach: "${brand.name}"`;
    if (brand.website) userMessage += `\nKnown website: ${brand.website}`;
    if (brand.linkedInProfile) userMessage += `\nKnown LinkedIn: ${brand.linkedInProfile}`;
    if (brand.backgroundInfo) userMessage += `\nExisting notes: ${brand.backgroundInfo}`;
    if (brand.customerType) userMessage += `\nCustomer type: ${brand.customerType}`;
    if (brand.projectType) userMessage += `\nProject type: ${brand.projectType}`;
    if (brand.projectDescription) userMessage += `\nProject description: ${brand.projectDescription}`;
    if (existingContacts.length > 0) {
      userMessage += `\n\nKnown contacts we already have (please verify their info, find emails/LinkedIn profiles if missing, and add any other key decision-makers):`;
      for (const c of existingContacts.slice(0, 15)) {
        const nm = c.name || [c.firstName, c.lastName].filter(Boolean).join(" ");
        const t = c.title || c.jobTitle || "";
        userMessage += `\n  - ${nm}${t ? ` (${t})` : ""}${c.email ? ` — ${c.email}` : ""}${c.linkedinUrl ? ` — ${c.linkedinUrl}` : ""}`;
      }
    }
    userMessage += `\n\nReturn the FULL JSON intelligence brief. The enrich pipeline will cross-validate your contacts against Apollo + three other AI models. NEVER fabricate emails or LinkedIn URLs — if you don't know, return null.`;

    const auditUserId = getUserIdFromHeaders(req.headers);

    // 3) Fire AI models + Apollo calls IN PARALLEL. One promise tree.
    const apolloTargets = existingContacts.filter(
      (c) =>
        c.name || c.firstName || c.lastName || c.email || c.linkedinUrl || c.apolloId,
    );

    const apolloPromise = Promise.all(
      apolloTargets.map((c) =>
        apolloPeopleMatch({
          firstName: c.firstName || null,
          lastName: c.lastName || null,
          name: c.name || null,
          email: c.email || null,
          linkedinUrl: c.linkedinUrl || null,
          apolloId: c.apolloId || null,
          brandName: brand.name,
          brandWebsite: brand.website || null,
        })
          .then((r) => ({ contactId: c.id, result: r }))
          .catch((e) => ({
            contactId: c.id,
            result: { matched: false, source: "apollo" as const, error: e?.message || "exception" },
          })),
      ),
    );

    const [apolloResults, anthropic, openai, grok, perplexity] = await Promise.all([
      apolloPromise,
      callAnthropic(userMessage, auditUserId, "enrich-brand"),
      callOpenAI(userMessage, auditUserId, "enrich-brand"),
      callGrok(userMessage, auditUserId, "enrich-brand-grok"),
      callPerplexity(userMessage, auditUserId, "enrich-brand-perplexity"),
    ]);

    const sourcesResponded: SourceName[] = [];
    if (apolloResults.some((r) => r.result.matched)) sourcesResponded.push("apollo");
    if (anthropic) sourcesResponded.push("anthropic");
    if (openai) sourcesResponded.push("openai");
    if (grok) sourcesResponded.push("grok");
    if (perplexity) sourcesResponded.push("perplexity");

    if (sourcesResponded.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "All five enrichment sources failed (Apollo + 4 AIs). Check API keys and upstream status.",
        },
        { status: 502 },
      );
    }

    // 4) Build per-source ContactClaim lists.
    const apolloClaimsByContactId = new Map<string, ContactClaim>();
    const apolloClaims: ContactClaim[] = [];
    for (const a of apolloResults) {
      if (!a.result.matched) continue;
      const r = a.result;
      const claim: ContactClaim = {
        source: "apollo",
        name: r.name || null,
        title: r.title || null,
        email: r.email || null,
        emailStatus: r.emailStatus || null,
        linkedin: r.linkedin || null,
        phone: r.phone || null,
        seniority: r.seniority || null,
        apolloId: r.apolloId || null,
      };
      apolloClaimsByContactId.set(a.contactId, claim);
      apolloClaims.push(claim);
    }

    const aiToClaims = (aiResult: any, source: SourceName): ContactClaim[] => {
      if (!aiResult?.contacts) return [];
      return aiResult.contacts.map((c: any) => ({
        source,
        name: c.name || null,
        title: c.title || null,
        email: c.email || null,
        linkedin: c.linkedin || null,
        phone: c.phone || null,
        priority: typeof c.priority === "number" ? c.priority : null,
        relevance: c.relevance || null,
        emailConfidence: c.emailConfidence || null,
      }));
    };

    const candidates = buildCandidates({
      apollo: apolloClaims,
      anthropic: aiToClaims(anthropic, "anthropic"),
      openai: aiToClaims(openai, "openai"),
      grok: aiToClaims(grok, "grok"),
      perplexity: aiToClaims(perplexity, "perplexity"),
    });

    // 5) Map candidates to existing contacts where possible — by slug.
    const existingBySlug = new Map<string, typeof existingContacts[number]>();
    for (const c of existingContacts) {
      const nm = c.name || [c.firstName, c.lastName].filter(Boolean).join(" ");
      const s = slugName(nm);
      if (s) existingBySlug.set(s, c);
    }

    // 6) Write loop.
    const perContactReport: Array<any> = [];
    let contactsUpdated = 0;
    let emailsVerified = 0;
    let linkedinsVerified = 0;
    let contactsCreated = 0;

    for (const cand of candidates) {
      const existing = existingBySlug.get(cand.key);

      // Decide write actions.
      const emailDecision = shouldWriteEmail(existing?.email, cand.email);
      const linkedinDecision = shouldWriteLinkedIn(existing?.linkedinUrl, cand.linkedin);

      const patch: any = {};
      if (emailDecision.write && cand.email.value) {
        patch.email = cand.email.value;
      }
      if (linkedinDecision.write && cand.linkedin.value) {
        patch.linkedinUrl = cand.linkedin.value;
      }

      // Always refresh these status tags, even if we don't overwrite the value:
      if (cand.email.value && (!existing?.emailStatus || existing.emailStatus === "extrapolated")) {
        patch.emailStatus = emailStatusFromVerdict(cand.email.verdict);
      } else if (cand.email.value && cand.email.verdict === "verified") {
        patch.emailStatus = "verified";
      }

      // Fill title if empty.
      if (!existing?.title && !existing?.jobTitle && cand.title.value) {
        patch.title = cand.title.value;
        patch.jobTitle = cand.title.value;
      }
      // Fill phone if empty.
      if (!existing?.phone && cand.phone.value) {
        patch.phone = cand.phone.value;
      }
      // Seniority from Apollo or derived.
      if (!existing?.seniority && cand.seniority) {
        patch.seniority = cand.seniority;
      }
      // Apollo ID if we got one and don't have one.
      if (!existing?.apolloId && cand.apolloId) {
        patch.apolloId = cand.apolloId;
      }
      // Record multi-source enrichment.
      const sourcesStr = cand.mentionedBy.join(",");
      patch.enrichmentSource = sourcesStr.includes(",") ? `multi:${sourcesStr}` : sourcesStr;
      patch.enrichedAt = new Date();

      const decisions: string[] = [
        `email: ${emailDecision.reason}`,
        `linkedin: ${linkedinDecision.reason}`,
      ];

      let contactId: string | null = existing?.id || null;

      if (existing) {
        // Refresh hygiene snapshot — uses the ticket-2 library so verdicts
        // line up with the scanner's.
        const hygieneInput = {
          name: cand.displayName || existing.name,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: (patch.email ?? existing.email) || null,
          jobTitle: patch.jobTitle ?? existing.jobTitle,
          title: patch.title ?? existing.title,
          linkedinUrl: (patch.linkedinUrl ?? existing.linkedinUrl) || null,
        };
        const snap = computeHygieneSnapshot(hygieneInput);
        patch.hygieneScore = snap.hygieneScore;
        patch.hygieneVerdict = snap.hygieneVerdict;
        patch.hygieneFlags = snap.hygieneFlags;
        patch.hygieneCheckedAt = snap.hygieneCheckedAt;
        patch.emailValidity = snap.emailValidity;
        patch.linkedinValidity = snap.linkedinValidity;

        await prisma.contact.update({ where: { id: existing.id }, data: patch });
        contactsUpdated += 1;
        if (emailDecision.write) emailsVerified += 1;
        if (linkedinDecision.write) linkedinsVerified += 1;
      } else if (autoCreateContacts && cand.email.verdict !== "none" && cand.mentionedBy.length > 0) {
        // Auto-create — but ONLY if at least one non-empty identifying field exists.
        // We don't want to write phantom rows off a single AI source's single null row.
        // Gate: either cross_agreed+ on email, OR Apollo matched, OR 2+ sources mentioned the person by name.
        const shouldCreate =
          cand.email.verdict === "verified" ||
          cand.email.verdict === "cross_agreed" ||
          cand.linkedin.verdict === "verified" ||
          cand.linkedin.verdict === "cross_agreed" ||
          cand.mentionedBy.includes("apollo") ||
          cand.mentionedBy.length >= 2;
        if (shouldCreate) {
          const nameParts = (cand.displayName || "").split(/\s+/);
          const firstName = nameParts[0] || null;
          const lastName = nameParts.slice(1).join(" ") || null;
          const baseEmail =
            cand.email.verdict === "verified" || cand.email.verdict === "cross_agreed"
              ? cand.email.value
              : cand.mentionedBy.includes("apollo") && cand.email.value
              ? cand.email.value
              : null;
          const hygiene = computeHygieneSnapshot({
            name: cand.displayName,
            firstName,
            lastName,
            email: baseEmail || null,
            title: cand.title.value || null,
            jobTitle: cand.title.value || null,
            linkedinUrl:
              cand.linkedin.verdict === "verified" ||
              cand.linkedin.verdict === "cross_agreed" ||
              cand.mentionedBy.includes("apollo")
                ? cand.linkedin.value
                : null,
          });
          const created = await prisma.contact.create({
            data: {
              brandId: id,
              name: cand.displayName,
              firstName,
              lastName,
              title: cand.title.value || null,
              jobTitle: cand.title.value || null,
              email: baseEmail || null,
              emailStatus: baseEmail ? emailStatusFromVerdict(cand.email.verdict) : null,
              phone: cand.phone.value || null,
              linkedinUrl:
                cand.linkedin.verdict === "verified" ||
                cand.linkedin.verdict === "cross_agreed" ||
                cand.mentionedBy.includes("apollo")
                  ? cand.linkedin.value
                  : null,
              apolloId: cand.apolloId || null,
              seniority: cand.seniority || null,
              decisionMaker: cand.priority !== null && cand.priority <= 2,
              enrichmentSource: `multi:${cand.mentionedBy.join(",")}`,
              enrichedAt: new Date(),
              outreachStatus: "not_contacted",
              hygieneScore: hygiene.hygieneScore,
              hygieneVerdict: hygiene.hygieneVerdict,
              hygieneFlags: hygiene.hygieneFlags,
              hygieneCheckedAt: hygiene.hygieneCheckedAt,
              emailValidity: hygiene.emailValidity,
              linkedinValidity: hygiene.linkedinValidity,
            },
          });
          contactId = created.id;
          contactsCreated += 1;
          decisions.push(`auto-created contact (${cand.mentionedBy.length} sources agreed person exists)`);
        } else {
          decisions.push(`not created — insufficient signal (${cand.mentionedBy.length} sources, no Apollo / no email agreement)`);
        }
      }

      // Audit note — who agreed on what, per contact.
      if (contactId) {
        const lines: string[] = [];
        lines.push(`🔀 BD Enrich — cross-validated by ${cand.mentionedBy.join(", ")} (${cand.mentionedBy.length}/5 sources)`);
        if (cand.email.value) {
          lines.push(
            `📧 Email: ${cand.email.value} — ${cand.email.verdict}${
              cand.email.alternatives.length > 1
                ? ` (⚠ ${cand.email.alternatives.length} variants seen)`
                : ""
            } · sources: ${cand.email.sources.join(", ")}`,
          );
        }
        if (cand.linkedin.value) {
          lines.push(
            `🔗 LinkedIn: ${cand.linkedin.value} — ${cand.linkedin.verdict} · sources: ${cand.linkedin.sources.join(", ")}`,
          );
        }
        if (cand.title.value) {
          lines.push(`💼 Title: ${cand.title.value} · sources: ${cand.title.sources.join(", ")}`);
        }
        for (const d of decisions) lines.push(`  · ${d}`);

        await prisma.note.create({
          data: {
            brandId: id,
            contactId,
            contactName: cand.displayName,
            userId: user.id,
            noteType: "ENRICH_VALIDATION",
            date: new Date(),
            content: lines.join("\n"),
          },
        }).catch((e) => {
          console.error("[enrich-brand] note write failed:", e?.message);
        });
      }

      perContactReport.push({
        name: cand.displayName,
        existingContactId: existing?.id || null,
        newContactId: !existing ? contactId : null,
        mentionedBy: cand.mentionedBy,
        email: cand.email,
        linkedin: cand.linkedin,
        title: cand.title,
        phone: cand.phone,
        priority: cand.priority,
        seniority: cand.seniority,
        relevance: cand.relevance,
        decisions,
      });
    }

    // 7) Merge AI research into Brand.researchData. Pull simple-merge helpers
    // inline (we're not sharing w/ V1 merge logic so we don't step on it).
    const aiResults = [anthropic, openai, grok, perplexity].filter(Boolean);
    const pick = (field: string) => {
      for (const r of aiResults) {
        const v = r?.company?.[field];
        if (v) return v;
      }
      return null;
    };
    const companySummary = aiResults.length
      ? {
          name: pick("name") || brand.name,
          legalName: pick("legalName"),
          website: pick("website"),
          linkedin: pick("linkedin"),
          headquarters: pick("headquarters"),
          founded: pick("founded"),
          employeeCount: pick("employeeCount"),
          revenue: pick("revenue"),
          ticker: pick("ticker"),
          description: pick("description"),
          parentCompany: pick("parentCompany"),
          industry: pick("industry"),
        }
      : null;

    // Fill empty brand fields.
    const brandPatch: any = {
      researchDate: new Date(),
      researchData: {
        _version: 2,
        _enrichedAt: new Date().toISOString(),
        _sources: sourcesResponded,
        _durationMs: Date.now() - started,
        company: companySummary,
        contacts: perContactReport,
        anthropic: anthropic || null,
        openai: openai || null,
        grok: grok || null,
        perplexity: perplexity || null,
        apolloResults: apolloResults.map((a) => ({
          contactId: a.contactId,
          matched: a.result.matched,
          error: a.result.error || null,
          apolloId: a.result.apolloId || null,
        })),
      },
    };
    if (!brand.backgroundInfo && companySummary?.description) {
      brandPatch.backgroundInfo = companySummary.description;
    }
    if (!brand.website && companySummary?.website) {
      brandPatch.website = companySummary.website;
    }
    if (!brand.linkedInProfile && companySummary?.linkedin) {
      brandPatch.linkedInProfile = companySummary.linkedin;
    }

    await prisma.brand.update({ where: { id }, data: brandPatch });

    // Brand-level audit note.
    await prisma.note.create({
      data: {
        brandId: id,
        userId: user.id,
        noteType: "ENRICH_VALIDATION",
        date: new Date(),
        content: `🔀 BD Enrich run — sources: ${sourcesResponded.join(", ")} · contacts updated: ${contactsUpdated} · created: ${contactsCreated} · emails verified: ${emailsVerified} · LinkedIn verified: ${linkedinsVerified} · took ${Math.round((Date.now() - started) / 100) / 10}s`,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      brandId: id,
      durationMs: Date.now() - started,
      sources: {
        apollo: apolloResults.filter((a) => a.result.matched).length,
        apolloAttempted: apolloResults.length,
        anthropic: !!anthropic,
        openai: !!openai,
        grok: !!grok,
        perplexity: !!perplexity,
      },
      summary: {
        candidatesDiscovered: candidates.length,
        contactsUpdated,
        contactsCreated,
        emailsVerified,
        linkedinsVerified,
      },
      contacts: perContactReport,
    });
  } catch (e: any) {
    console.error("[enrich-brand] fatal:", e);
    return NextResponse.json(
      { ok: false, error: e.message, durationMs: Date.now() - started },
      { status: 500 },
    );
  }
}
