# BD Wizard Overhaul — PRD / Working Doc

**Status:** Draft · Andrew vision + Claude expert additions
**Owners:** Andrew (product), Claude (implementation)
**Created:** 2026-04-20

---

## The pitch

Replace the open-scrolling BD pipeline (cherry-pick a brand, claim it, figure out
what to do) with a guided wizard. One "Start BD" button. The system picks the
next highest-confidence brand, enriches it in one pass, hands the rep a
pre-written set of LinkedIn messages and emails personalized to each contact,
asks them 2-3 human questions to de-AI the copy, sends it, then assigns the
brand to the rep with notes, follow-up tasks, and a cadence.

---

## Andrew's wishlist (verbatim intent)

1. **Start BD Wizard** button replaces the pipeline cherry-pick UX.
2. **Auto-assign next brand** — highest confidence first, in order.
3. **Single enrichment pass** — contacts + AI research, one magnificent pipeline.
   Today there are two systems: (a) the brand-development Anthropic→Gemini path
   producing `jane.doe@` placeholder emails and LinkedIn miss-steps, and (b)
   the search+enrich path that chains Anthropic → Gemini → Perplexity → Apollo
   and is higher quality. Kill one. Keep one.
4. **Personalized outbound per contact** — pre-written email narrated to each
   person's title, posts, interests. LinkedIn message + email per contact.
   Wizard asks 2-3 human-in-the-loop questions before send to customize.
   **Must not read as AI-generated.** No em-dashes, no AI tells in code either.
5. **Rep can delete worthless contacts** — (jane.doe placeholders, left company,
   wrong person). Needs to be possible mid-wizard.
6. **Auto-assign brand on completion** — once every contact is touched, the
   brand is assigned to the rep who did the work.
7. **Auto-notes + follow-up timeline** — rep gets suggested next steps and a
   reach-out cadence.
8. **Long-term funnel:** warm-reach LinkedIn → email → paid retargeting →
   trade-show push → nurture → call.
9. **Follow-up wizard v2** — secondary wizard for the nurture loop.
10. **Brand detail cards must be clickable** — today the cards are dead; only
    the small row links to CRM/Contacts work.
11. **Rename CRM → ACM (Atlas Customer Management)**, make it a prominent
    colored card on the main row. Primary focus, not afterthought.

---

## What exists today (code reality as of this commit)

### The two enrichment systems

| | (a) Apollo-only spot enrichment | (b) Multi-AI brand research |
|---|---|---|
| File | `src/app/api/admin/outreach/enrich/route.ts` | `src/app/api/brands/[id]/research/route.ts` |
| Trigger | Manual POST per contact | POST per brand, can auto-save contacts |
| Flow | Apollo People Match, 1 call | Claude + GPT-4o + Grok + Perplexity in parallel → dedupe → merge → upsert contacts |
| Output | 1 contact enriched or junk | Full company brief + decision-maker list + opportunities + objections + opening-email draft |
| Failure mode | `jane.doe@` placeholder emails when Apollo confidence is low | Occasional hallucinated titles; confidence scores help |
| Verdict | **Keep only as a verification subroutine** | **This is the magnificent one. Keep.** |

### BD pipeline UI
`/admin/brand-pipeline` — scrolling list with filter chips (actionable /
enriched / verified / all / everything), relevance sort, inline claim button,
expand-for-contacts. Hard-scoped to LEAD stage only. Claim requires
`user.canClaim=true` (shipped in #36).

### Outreach plumbing
- `ContactOutreach` model: per-user LinkedIn/Email checkboxes on pipeline.
- `POST /api/admin/outreach/send`: atomic Resend send + OutreachMessage +
  Note + `brand.lastActivityAt` stamp.
- `EmailComposeModal` on brand detail: pre-fills from AI research (relevance
  hook, description, opening paragraph).
- **No anti-AI-detection scrubbing** anywhere.

### CRM surface (blast radius for rename)
- `src/app/crm/tasks/page.tsx`
- `src/app/api/crm/tasks/route.ts`
- `src/app/api/crm/tasks/[id]/route.ts`
- Tab label `"CRM"` inside `src/app/brands/[id]/page.tsx`
- No top-level nav item — low blast radius.

### Brand detail cards
Mostly tabs, not cards. Contacts and Products rows are `<div>` without link
wrappers. Factories rows ARE clickable. Fix: wrap contacts in `<Link>` to
`/contacts/[id]`, wrap products rows where applicable, make the ACM tab a
big colored card on top of the detail page.

---

## Claude's expert additions (things you didn't name but should have)

1. **Disqualification reason codes.** "Delete contact" isn't enough. Capture
   WHY (wrong person, left company, stale data, not fit, no match found). Feed
   that back to enrichment scoring so next pass gets smarter.
2. **Brand-level disqualify.** Sometimes the whole brand is wrong (closed,
   acquired, not ICP). Wizard needs a "kill brand" exit with reason.
3. **Reply capture → timeline + alert.** When a prospect replies to a cold
   email, it must land on the brand timeline and ping the rep. Partial coverage
   exists via Outlook BCC-to-Atlas (#27, #32) — make sure the wizard-sent
   emails are threaded into that. And when a reply comes in, auto-advance the
   brand stage to `BRAND_TESTING` or flag for hand-off.
4. **Per-rep throttle + deliverability guardrails.** 200 cold emails from one
   inbox in a day = Gmail spam flag. Cap it. Show the rep their remaining
   daily budget. Warn on bounce-rate spikes. (DMARC tightening is #26 pending.)
5. **Contact-level claim, not just brand-level.** Two reps working the same
   brand at once is fine; two reps emailing the same contact is a disaster.
   Lock contact-level when an outreach is in flight.
6. **Unsubscribe / opt-out registry.** Single source of truth — if someone
   unsubscribes once, block all future outreach to that email from any rep.
   CAN-SPAM requirement, also just hygiene.
7. **Personalization proof-points surfaced in the wizard.** Don't just hand
   the rep a draft email — surface the two or three Perplexity-sourced facts
   ("spoke at Outdoor Retailer last month," "3 new SKUs in recycled nylon",
   "promoted to VP in January") so the rep can verify them AND the email has
   teeth.
8. **Stop-condition / auto-park.** After N touches with no reply, the brand
   auto-parks into a "retargeting candidate" bucket for paid ads. Doesn't
   disappear; doesn't keep draining rep time either.
9. **SLA clock on follow-ups.** If the rep was supposed to follow up on day 5
   and it's day 8, it must surface on the daily digest. (This hooks into the
   support-ticket + overdue-orders pattern we just shipped.)
10. **Per-rep performance dashboard.** Brands worked, contacts contacted,
    reply rate, meetings booked, $ influenced. Without this, commission is
    guesswork.
11. **Hand-off escalation.** When a brand hits reply / meeting-booked, does
    the BD rep keep it or hand to an AE? Wizard should ask, and the answer
    should propagate (so commission logic is deterministic).
12. **A/B tagging on email variants.** Which opening hook lands better? Tag
    each send with the angle, track reply rates per angle over time.

---

## Anti-AI-detection checklist (for email copy gen)

This is the kind of thing that gets an email auto-filtered or makes a rep
look lazy. Enforce all of it in the email generator.

**Kill in output:**
- Em-dash `—`. Use `.` or `,` or just two sentences.
- "I hope this email finds you well."
- "I wanted to reach out."
- "Just circling back." "Circling back." "Per my last email."
- "Let me know your thoughts." "Would love to hear your feedback."
- Perfect parallel structure (three-item lists with commas + "and").
- "Essentially" / "Fundamentally" / "At its core" — all AI tells.
- Bullet lists inside a cold email. Humans write paragraphs.
- "Synergy" / "leverage" / "unlock value" / "streamline."

**Require in output:**
- Contractions: `I'm`, `you're`, `don't`, `it's`. Formal-letter voice flags AI.
- One specific fact about the recipient from Perplexity (show your work).
- A minor imperfection: sentence fragment, casual tangent, parenthetical aside.
- Subject line < 7 words, lowercase-friendly (no Title Case Sentences).
- Short closing. `— Andrew` or `Thanks, Andrew`. Not "Warm regards".

**Kill in code / metadata:**
- No "Generated by Claude" / "AI-drafted" strings anywhere in the HTML or
  headers.
- No `X-AI-Generated: true`-style hints in SMTP headers.
- Resend has a `tags` field — don't tag as ai-outreach. Tag as
  `bd-cold-outbound` (already used elsewhere, consistent).
- No hidden unicode (no `\u200b` zero-width space, no smart-quote replacement).
- Make sure the rep's actual human name is the `from:` address, not a shared
  `outreach@fuze47.com` role inbox (role inboxes are inbox-placement poison).

---

## Phased shipping plan

Five phases. Each shippable and useful standalone — don't big-bang.

### Phase 0 — Quick wins (tonight or tomorrow, < 2 hrs each)
- [ ] **Rename CRM → ACM everywhere.** `/crm/tasks` → `/acm/tasks`, tab label,
      `/api/crm/*` → `/api/acm/*` (keep `/api/crm/*` as a 308 redirect shim
      for anything that still imports it).
- [ ] **Make ACM a big colored card** on `/home` + on brand/factory detail pages.
      Not a tab. Link to `/acm` or `/brands/[id]?tab=activity`.
- [ ] **Wrap contacts + products cards in `<Link>`** on brand detail. Deep link
      to `/contacts/[id]` and `/products/[id]` (or ICP submission URL).

### Phase 1 — Kill the garbage enrichment
- [ ] Deprecate `/api/admin/outreach/enrich` as a user-facing action.
      Repurpose it as an internal "verify-this-email" subroutine called from
      the research pipeline only.
- [ ] In `/api/brands/[id]/research`, add a confidence threshold: any contact
      with email confidence < MEDIUM gets flagged `needsVerification=true` and
      never gets saved with a placeholder email. We save the LinkedIn URL, the
      name, the title — but `email=null`.
- [ ] Add an "Unverified contacts" sub-queue where the rep can manually verify
      + Apollo-re-enrich.

### Phase 2 — BD Wizard MVP (the big one)
- [ ] New route `/admin/bd-wizard` — state machine UI.
- [ ] **Step 1: Assign**. Server-side picks next brand:
      `relevance=HIGH` first, then MEDIUM, filter out claimed brands,
      filter out brands with any outreach in the last 30 days from any rep.
      Auto-claims to current user.
- [ ] **Step 2: Enrich**. Run the multi-AI research if not already run in
      last 7 days. Show progress. Show confidence per contact. Flag any
      `jane.doe` / `info@` / `contact@` patterns red.
- [ ] **Step 3: Verify contacts**. Rep can delete with reason code (see
      #1 in expert additions), edit, or keep. Bad data stops here.
- [ ] **Step 4: Customize**. Wizard shows 2-3 human-in-the-loop questions
      per contact ("What caught your eye on their LinkedIn?" "Which FUZE
      angle fits them — performance, sustainability, or cost?" "Anything
      personal to lead with?"). Injects answers into email + LinkedIn copy.
- [ ] **Step 5: Review + send**. Full diff view per contact, anti-AI
      checklist runs on each draft before send (auto-rewrite em-dashes,
      flag banned phrases, require one proof-point). Rep can still edit.
- [ ] **Step 6: Cadence**. Auto-create follow-up tasks: day 3 LinkedIn
      check-reply, day 7 email followup, day 14 second email with different
      angle, day 30 move to retargeting pool if still no reply.
- [ ] **Step 7: Done**. Brand assigned, notes written, rep kicked back to
      `/admin/bd-wizard` "Start next brand?" prompt.

### Phase 3 — Follow-up wizard v2
- [ ] Separate wizard for the nurture phase (reply, no-reply, meeting-booked
      branches). Replaces `/admin/brand-pipeline` for post-first-touch work.

### Phase 4 — Paid retargeting + trade-show hooks
- [ ] Export unresponsive brands as Meta/LinkedIn Ads audience CSV (scrub to
      just emails + names). Weekly cron.
- [ ] Trade-show table + contact-to-event mapping. Pre-show warm-up flow.

### Phase 5 — Per-rep performance dashboard
- [ ] Rep-level metrics: brands worked, reply rate, meetings, $ influenced.
- [ ] Daily digest block per rep.

---

## Decisions (LOCKED by Andrew 2026-04-20)

1. **Kill `(a) /api/admin/outreach/enrich` as a user-facing path.** Only
   `/api/brands/[id]/research` (multi-AI: Claude + GPT-4o + Grok + Perplexity)
   is callable from the wizard. (a) can stay alive as an internal verification
   subroutine if needed, but no UI points at it.
2. **ACM URL path = `/acm`.** Rename `/crm/*` → `/acm/*` with redirects from
   the old paths so bookmarks don't break. Tab labels + sidebar entries
   all read "ACM" (Atlas Customer Management).
3. **Paid retargeting = CSV export** for Phase 3. Wizard produces a weekly
   CSV of targeted emails. Ops person uploads to Meta/LinkedIn Ads manually.
   Revisit integration later once volume justifies it.
4. **Tradeshow tracking = notes on the brand.** New model
   `BrandTradeshowTouch { brandId, tradeshow, date, notes, repId }` is out of
   scope. Use a simple `tradeshowNotes` text field + date on the brand record.
5. **Per-rep `from:` address configured in user settings.** Each rep sets
   their own sending address (andrew@801inc.com vs andrew@fuze47.com vs their
   personal). **BCC the rep on every outbound the wizard sends** so the rep
   sees exactly what went out and how it rendered.
6. **Hand-off to ACM = automatic on reply.** When an outbound gets a reply
   (inbound email matches open thread, or LinkedIn reply flagged manually),
   the brand moves to ACM status and the reply capture auto-pauses the
   sequence.
7. **Sourcing rep stays as account manager.** Whoever sourced the brand
   keeps the account through ACM lifecycle. Commission sticks with them
   indefinitely — no time-bound rotation.

---

## Open engineering questions (Claude will decide unless you override)

- State storage for the wizard: server-side (a `BDWizardSession` table) so
  the rep can resume on another device, vs. client-side useState.
  Recommendation: server-side.
- Email anti-AI rewriter: a post-processor function `humanize(draft: string)`
  that runs BEFORE Resend dispatch, not before the UI preview. That way the
  rep sees what they edited, but the outbound has the scrubbing applied.
- LinkedIn copy: we can't actually send LinkedIn DMs from Atlas (no API
  without LinkedIn Sales Navigator or paid LinkedIn Marketing API). Wizard
  should generate the copy and have a "Copy to clipboard + open LinkedIn
  profile" button, not claim to send it.

---

## Known dependencies

- #24 (saved email templates) becomes the template library the wizard
  pulls from.
- #26 (DMARC p=quarantine) must land before we scale outbound volume.
- #36 claim-and-work shipped — wizard builds on it.
- #54 (clickable contacts across app) overlaps Phase 0.
- #55 (CRM module card on /home) is exactly the ACM big-card work.
- #71 support tickets + overdue orders in daily digest — the same
  rolling-backlog pattern applies to wizard SLA breaches.

