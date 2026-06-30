# Phase 19.5 Follow-up — Misclassification fixes + FreshTX add + standing-rule lock

**Created:** 2026-05-26
**Author:** Andrew (relayed via Cowork)
**Status:** Self-sufficient — run end-to-end, do not pause for Andrew between tracks.

This spec executes the 3 Phase 19.5 escalations + Andrew's new standing rule
about competitor research persistence + a new IFTNA FreshTX competitor entry
that closes out the IFTNA product-line audit.

**Standing rules in effect (per CLAUDE.md "NON-NEGOTIABLE WORKFLOW RULES"):**
- NEVER ask Andrew to manually edit a file. Every change is in this spec.
- Run own `fzcron` verification commands sourcing `.env.local` for `$CRON_SECRET`.
- Run own `diag-all-surfaces` checks between tracks.
- Never pause and wait for Andrew between tracks. 300-second auto-resume.
- Push commits without check-ins between tracks.
- Only escalate to Andrew on (a) genuine ambiguity that can't be resolved by
  reading the codebase, (b) unrecoverable error blocking all forward progress.

---

## Track 1 — Five `chemistryType` misclassification fixes (`src/lib/competitors.ts`)

Phase 19.5 audit transcript at `deliverables/Competitor_SDS_Audit_2026-05.md`
identified 5 competitor entries whose `chemistryType` pointer routes
sustainability math through the wrong archetype. Andrew has signed off on
all 5 fixes — ship them.

For each, edit ONLY the `chemistryType` field on the entry in
`src/lib/competitors.ts`. Do NOT touch `name`, `category`, `description`,
or any other field. Preserve existing string formatting.

| Competitor id | Old `chemistryType` | New `chemistryType` | Source |
|---|---|---|---|
| `polygiene-viraloff` | `zinc_pyrithione` | `silver_chloride` | Polygiene's own product page — ViralOff active is silver chloride |
| `sanitized-zinc-pyrithione` | `zinc_pyrithione` | `qac_silane` | NICNAS Public Report STD/1230 — Sanitized T 99-19 is silane-QAC |
| `heiq-hyprotecht` | `zinc_nano` | `silver_chloride` | HeiQ's own product page — HyProTecht is silver tech; "Crescoating zinc" came from an academic paper |
| `microban-additive-gs` | `qac_silane` | `organic_acid` | EPA Reg 42182-14 — 100% benzoic acid |
| `ultrafresh-dw56` | `qac_silane` | `zinc_pyrithione` | EPA Reg 10466-46 — 15% ZPT + 15% thiabendazole |

**Important nuance on `heiq-hyprotecht`:** the audit transcript flagged the
ideal new value as "`silver_chloride` (or new `silver_misc`)". We do NOT have
a `silver_misc` archetype and adding one for a single entry isn't worth it.
Use `silver_chloride` — it's the dominant silver-textile-finishing archetype
in `UPSTREAM_MANUFACTURING` and HyProTecht (silver salt deposited on fiber)
fits cleanly within its math envelope. Document the routing decision in the
commit body.

**For `microban-additive-gs` → `organic_acid`:** verify that the
chemistry-archetype-to-UPSTREAM mapping in `src/lib/sustainability.ts`
(around line 1013–1021, the `upstreamKey` fallback ladder) actually routes
`chemistryType === "organic_acid"` to the `organic_acid` archetype. If the
ladder currently lacks an `organic_acid` branch and would fall through to
`silver_chloride` (the default fallback), add the missing branch:

```typescript
: chemType === "organic_acid" ? "organic_acid"
```

Same check for `zinc_pyrithione` → `zinc_pyrithione` (should already route
correctly via `chemType.includes("zinc")`), `silver_chloride` (should already
route directly), and `qac_silane` (should already route directly). Confirm
each in code; only add a branch if missing.

Run `npx tsc --noEmit` after edits to confirm typecheck clean.

**Commit:** one commit, message:

```
fix(competitors): correct 5 chemistryType misclassifications (phase 19.5 escalation)

Per deliverables/Competitor_SDS_Audit_2026-05.md, 5 competitor entries had
chemistryType pointers that routed sustainability math through the wrong
UPSTREAM_MANUFACTURING archetype:

- polygiene-viraloff: zinc_pyrithione → silver_chloride
  Source: Polygiene's own ViralOff product page lists silver chloride
  as active. ~0.2% w/w estimated.

- sanitized-zinc-pyrithione (T 99-19): zinc_pyrithione → qac_silane
  Source: NICNAS Public Report STD/1230 names dimethyltetradecyl-[3-
  (trimethoxysilyl)propyl]-ammonium chloride. ~5% w/w.

- heiq-hyprotecht: zinc_nano → silver_chloride
  Source: HeiQ's own HyProTecht page describes "silver technology."
  The "Crescoating zinc" reference came from a 2022 PMC academic paper,
  not a HeiQ commercial product. Routed to silver_chloride (dominant
  silver-textile-finishing archetype) rather than introducing a single-
  entry silver_misc archetype.

- microban-additive-gs: qac_silane → organic_acid
  Source: EPA Reg 42182-14 — 100% benzoic acid powder additive.

- ultrafresh-dw56: qac_silane → zinc_pyrithione
  Source: EPA Reg 10466-46 — 15% zinc pyrithione + 15% thiabendazole.

Andrew sign-off received 2026-05-26. tsc clean.
```

---

## Track 2 — Add IFTNA FreshTX to `src/lib/competitors.ts`

Andrew asked for a deep-dive on IFTNA FreshTX (https://www.iftna.com/freshtx)
and made it a STANDING RULE that any competitive deep-dive ends with the
product persisted to `src/lib/competitors.ts`. Track 4 below locks the rule
into CLAUDE.md; this track ships the FreshTX entry.

### Research inputs already gathered (do not re-fetch)

From iftna.com/freshtx page text:

- **Product:** FreshTX, "odour-neutralizing technology" — antimicrobial-adjacent
  textile finish for fiber-level odor control.
- **Manufacturer:** Intelligent Fabric Technologies N.A. (IFTNA), a division
  of iFabric Corp. 525 Denison Street, Unit 1, Markham, Ontario L3R1B8, Canada.
- **Mechanism claimed:** "positive and negative ion technology" that
  "attracts, isolates and neutralizes" odor-causing bacteria. Marketing
  language is consistent with **zwitterionic / amphoteric chemistry**
  (silane-quat is the most common amphoteric textile chemistry making
  this exact marketing claim). No active-ingredient % w/w disclosed.
- **Antimicrobial claims:** "captures, prevents and neutralizes growth
  and fungal buildup." This is an antimicrobial efficacy claim under FIFRA.
- **EPA Registration:** **NONE shown anywhere on the FreshTX product page.**
  Critical competitive intel — iFabric Corp's other antimicrobial products
  (PROTX2 = EPA Reg 87246-13, BioACTIV AM = EPA Reg 87246-12) display
  their EPA registration prominently. FreshTX page omits it. Two possible
  scenarios:
  1. FreshTX is EPA-EXEMPT under FIFRA Section 25(b) — chemistries on
     the minimum-risk list (citric acid, lactic acid, plant essential
     oils, chitosan, etc.) qualify. Marketing language doesn't support
     this — the "positive/negative ion" language doesn't match any 25(b)-
     eligible chemistry.
  2. FreshTX is an UNREGISTERED product making federally-regulated
     antimicrobial claims — a FIFRA Section 12(a)(1)(A) violation.
     Per the EPA's enforcement framework, marketing claims of
     antibacterial / antifungal efficacy require federal pesticide
     registration regardless of dose.

  Also possible: FreshTX is sold as a non-public-claims OEM finish
  to brands who then make their own (registered or unregistered) claims
  downstream. iFabric's footer disclaimer ("Due to worldwide regulatory
  differences, not all information found on our website can be applied
  and are valid in all countries or regions") suggests this routing.

- **Target market:** chefs, healthcare workers, athletes, runners,
  parents, pet owners. Apparel + bedding + towels + kitchen textiles +
  footwear. Positioned as a sustainable laundering-reduction story.

### Research Code SHOULD do as part of this track

Before writing the FreshTX entry, Code should attempt to verify whether
an EPA registration exists by querying:

1. EPA PPLS search for "FreshTX": `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1`
2. EPA registrant 87246 product list: search for additional 87246-NN
   product numbers beyond -12 and -13 via WebFetch on
   `https://www3.epa.gov/pesticides/chem_search/reg_actions/registration/`
   or Pomerix mirror equivalents.
3. CFR / Federal Register search for "FreshTX iFabric" to surface any
   recent notification or enforcement action.

If a registration is found, use that as the canonical source. If no
registration is found after a reasonable search, document the FreshTX
entry as "**no EPA registration discoverable as of 2026-05-26**" with a
note that this is itself a customer-positioning finding.

### Where to insert FreshTX in `src/lib/competitors.ts`

Right after the existing `iftna-protx2` entry (or wherever the IFTNA
product line is grouped). Use the same structural pattern as
`iftna-protx2` for field consistency. The entry should include:

- `id: "iftna-freshtx"`
- `name: "FreshTX"`
- `manufacturer: "Intelligent Fabric Technologies (IFTNA) / iFabric Corp."`
- `category: "Antimicrobial / Odor-Neutralizing Textile Finish"`
- `chemistryType:` — best estimate given marketing language. Given the
  amphoteric "positive/negative ion" claim and no disclosed % w/w, route
  to `qac_silane` as the closest commercial chemistry archetype, but
  flag as `confidenceLevel: "low"` (or whatever the existing entry shape
  calls the equivalent uncertainty field — read iftna-protx2 to confirm
  field naming) and add a `note` documenting the uncertainty.
- `epaRegNote:` — verbatim language: "No EPA registration discoverable
  on the FreshTX product page (iftna.com/freshtx) as of 2026-05-26
  despite explicit antimicrobial efficacy claims ('captures, prevents
  and neutralizes growth and fungal buildup'). iFabric's other anti-
  microbial products (PROTX2 = EPA Reg 87246-13, BioACTIV AM = EPA
  Reg 87246-12) display their registration prominently — FreshTX omits
  it. Either EPA-EXEMPT under FIFRA Section 25(b) (marketing language
  doesn't fit any 25(b)-eligible chemistry) or unregistered product
  making federally-regulated antimicrobial claims (FIFRA Section
  12(a)(1)(A) violation) or sold as a private-label OEM finish where
  the brand customer carries the registration obligation downstream."
- `marketingClaimVsRegDiscrepancy: true` (or equivalent existing field
  — read iftna-protx2 for the canonical field name; do NOT invent
  new fields, reuse what's already in the type).
- `sources:` array with the iftna.com/freshtx URL and verifiedDate
  2026-05-26.
- A `note` capturing the "amphoteric / silane-quat suspected, not
  manufacturer-disclosed" assumption.

If during Code's EPA hunt a registration IS found, swap the chemistryType
to the EPA-disclosed active ingredient and update epaRegNote with the
actual reg number — the "marketing-vs-EPA discrepancy" angle drops away
in that case.

### Audit transcript append

Append a new section to `deliverables/Competitor_SDS_Audit_2026-05.md`
under a new heading "## 2026-05-26 follow-up — FreshTX addition" with:

- The same EPA-registration analysis from above.
- The chemistryType routing decision + confidence level.
- Whatever Code's EPA hunt found (or didn't find).
- Sources used.

### Commit

```
feat(competitors): add IFTNA FreshTX + audit-transcript follow-up

IFTNA FreshTX is the 4th product in iFabric Corp's antimicrobial textile
line (after PROTX2, PROTX2AV, BioACTIV AM). Andrew asked for a deep-dive
and made it a standing rule that every competitive research session ends
with a persisted entry in competitors.ts.

Key finding: NO EPA registration discoverable on the FreshTX product
page despite explicit antimicrobial efficacy claims. iFabric's other
products display their EPA registrations prominently. Three scenarios
documented in epaRegNote: 25(b) exemption, FIFRA Section 12(a)(1)(A)
violation, or OEM private-label downstream registration.

Mechanism: "positive and negative ion technology" — marketing language
consistent with amphoteric silane-quat. Routed to qac_silane archetype
at low confidence pending manufacturer disclosure.

Audit transcript appended at deliverables/Competitor_SDS_Audit_2026-05.md
under "## 2026-05-26 follow-up — FreshTX addition".

tsc clean.
```

---

## Track 3 — Lock the "every competitive deep-dive ends in competitors.ts" rule into CLAUDE.md

Andrew's standing rule, verbatim from his 2026-05-26 message:

> "Anytime we do research and deep dive. make sure that product and
> competitor are added to our competitor fuze atlas research with all the
> others."

Add a new subsection to CLAUDE.md inside the existing "Sustainability
Citations (Phase 19.5+)" section (or as a standalone "Competitive
Intelligence Persistence Rule" right below it — read CLAUDE.md to
decide which placement reads more naturally). Content:

```markdown
## Competitive Intelligence Persistence Rule

Every competitive deep-dive — every time Cowork pulls EPA data, SDS
data, manufacturer marketing pages, or third-party LCA on a competitor
product — MUST end with that product persisted to `src/lib/competitors.ts`
with a corresponding entry in the audit transcript at
`deliverables/Competitor_SDS_Audit_<YYYY-MM>.md`.

This is a no-exceptions rule. The research is worthless if it doesn't
land in the platform's canonical competitor catalog — it just lives in
chat scrollback until the session ends.

**The four required artifacts for every competitive deep-dive:**

1. **Competitor entry** in `src/lib/competitors.ts` with `chemistryType`,
   `epaRegNote`, `sources`, and (where relevant) `marketingClaimVsRegDiscrepancy`.
2. **Archetype entry** in `UPSTREAM_MANUFACTURING` in `src/lib/sustainability.ts`
   IF the competitor's chemistry doesn't already have one — wrap every
   numeric input in `sourced()` with full citation.
3. **Audit transcript row** appended to `deliverables/Competitor_SDS_Audit_<YYYY-MM>.md`
   with the source URL(s), verifiedDate, and any escalations.
4. **Customer-facing comparison doc** at `deliverables/<Product>_Comparison_FUZE_vs_<Competitor>.md`
   IF the competitor is being raised by a customer in real sales conversations.
   Otherwise skip — only build comparison docs when a real brand has
   asked.

**Why this rule exists:** Andrew has caught two cases (PROTX2 marketing-
vs-EPA discrepancy, FreshTX missing-EPA-registration) where the
competitive lever was significant and would have stayed buried if the
research hadn't landed in the catalog. The catalog is also what powers
`/admin/competitor-pricing` and `/sustainability`, so research that
doesn't persist literally doesn't show up to sales reps.
```

**Commit:**

```
docs(claude.md): lock standing rule — every competitive deep-dive ends in competitors.ts

Andrew's 2026-05-26 standing rule: "Anytime we do research and deep
dive. make sure that product and competitor are added to our competitor
fuze atlas research with all the others."

Adds a "Competitive Intelligence Persistence Rule" section under the
Sustainability Citations (Phase 19.5+) block in CLAUDE.md documenting
the four required artifacts for every deep-dive (competitors.ts entry,
sustainability archetype if needed, audit transcript row, optional
customer-facing comparison doc).

This is a process rule, not a code change. It locks the discipline
that surfaced the PROTX2 marketing-vs-EPA finding and the FreshTX
missing-registration finding so future competitive intel doesn't
stay buried in chat scrollback.
```

---

## Track 4 — Verification + push

After each track's commit, do:

1. `git push origin main` (no waiting between commits)
2. Verify Vercel deploy goes READY (curl the deployment status or
   use the Vercel MCP)
3. Run `fzcron diag-all-surfaces` and confirm all 50 surfaces remain
   healthy. The 5 chemistryType changes will route through different
   archetypes in `/sustainability` page math; verify no panel 500s.
4. Specifically curl `https://fuzeatlas.com/sustainability` and grep
   for one of the changed competitors (e.g., "Polygiene ViralOff") to
   confirm the page still renders.
5. Specifically curl `https://fuzeatlas.com/admin/competitor-pricing`
   (with bearer auth or via the diag pattern) to confirm the new
   FreshTX entry appears in the admin pricing comparison.

**If `diag-all-surfaces` reports a regression** that traces back to one
of the chemistryType changes (most likely candidate: the `organic_acid`
or `zinc_pyrithione` archetype route differs in CO2 magnitude from the
old one, breaking a chart's y-axis assumption), do NOT roll back. Fix
forward — the new routing is correct; if a chart looks weird the chart
needs updating. Open the file, fix the rendering, push the fix.

**If Vercel ERRORs on any of the 3 commits**, pull the inspector URL
via the Vercel MCP, surface the actual error in the commit body of a
follow-up fix-forward commit. Do NOT pause and wait for Andrew.

---

## Done criteria

- 3 commits on `main`, all deploying green to Vercel.
- `/sustainability` page renders without 500s.
- `/admin/competitor-pricing` lists IFTNA FreshTX alongside PROTX2.
- `deliverables/Competitor_SDS_Audit_2026-05.md` has the new
  "## 2026-05-26 follow-up — FreshTX addition" section.
- `CLAUDE.md` has the new "Competitive Intelligence Persistence Rule"
  section.
- `diag-all-surfaces` green.

Report back to Andrew with one summary message listing the 3 commit
SHAs, the deploy URLs, and any FreshTX EPA-registration findings from
the research step in Track 2 (especially if a registration WAS found —
that changes the customer-positioning angle materially).
