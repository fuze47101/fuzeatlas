# Brand Spec Interview Template

**Purpose:** structured kickoff conversation with each brand to fill in their `/brand-portal/spec` page. After this 30-45 min meeting you should have everything needed to populate Atlas with the brand's testing requirements, ICP cadence, factory roster, fabric portfolio, and pricing tier ladder.

**Output:** filled spec page + filled fabric portfolio CSV (Brand_Fabric_Portfolio_Template.csv) + factory list to add to Atlas.

---

## Part 1 — Required FUZE tier

> "What level of FUZE protection do you need across your line — F1 Full Spectrum at 1.0 mg/kg, F2 Advanced at 0.75, F3 Core at 0.5, or F4 Foundation at 0.25?"

**Decision drivers to talk through:**
- Are you marketing the product on anti-odor / antimicrobial claims directly to consumers? → **F1** (lets you run AATCC 100, ISO 20743, JIS L 1902 for SEK Mark — opens Japan)
- Performance apparel / activewear / hospitality bedding / childcare with claims needs? → **F1 or F2**
- General durable protection without active claim positioning? → **F3**
- Cost-driven baseline protection for value tiers? → **F4**

**Capture:**
- Required tier: ____ (F1 / F2 / F3 / F4)
- Will the spec ever differ per fabric/product line? If yes, list which lines need which tier:
  ____________________________________________
  ____________________________________________

---

## Part 2 — ICP validation cadence

> "How often do you want us to run ICP validation on production batches — every N orders, or every X liters of FUZE consumed?"

**Talking points:**
- **Tighter cadence (every 2-3 orders):** higher confidence in batch consistency, more lab cost. Recommended for first 90 days of any new program until trust is built.
- **Looser cadence (every 10 orders or every 500L):** appropriate for mature programs with consistent passing ICP history.
- **Volume-based cadence:** good for high-throughput factories where order count varies wildly.

**Capture:**
- Cadence by orders: every ____ orders
  OR
- Cadence by volume: every ____ liters of FUZE consumed
- Will the cadence relax after a passing-streak threshold? (Phase 18 feature) ____________

---

## Part 3 — Factories in the supply chain

> "Walk me through every mill / factory in your supply chain that we'll be working with — name, country, what they produce for you."

**Capture for each:**
| Factory name | Country | City/region | Their internal SKU prefix | Lead contact (name + email) |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

If they don't have factory contact details handy, ask them to forward a contact list within 48 hours of the meeting.

**Atlas action after meeting:** for each factory not yet in Atlas, create it via `/admin/factories/new` AND link to brand via the BrandFactory junction.

---

## Part 4 — Fabric portfolio

> "Send me your current development fabric list — anything in trial, anything in bulk, anything we should test next. Use this template:"

**Attach** `Brand_Fabric_Portfolio_Template.csv`.

If they have an existing spreadsheet in a different format (most do — every brand has their own internal tracker), don't fight it — ask them to send it and **we'll map the columns ourselves on import**. CSV importer accepts flexible column names (Phase 18 spec — see TODO below).

**Capture during the meeting:**
- Approximate fabric portfolio size: ____ fabrics
- Format they'll send the list in: ____
- Who on their team owns the fabric list: ____ (name + email — likely the product or sourcing lead)

---

## Part 5 — Pricing tier ladder

> "Let's set up your discount tiers. Most brands use a 5-tier ladder based on lifetime FUZE volume."

**Suggested starting ladder (negotiable):**
| Tier label | Threshold (lifetime liters) | Discount off list price |
|---|---|---|
| Tier 1 — Starter | 0 L | List price |
| Tier 2 — Established | 500 L | 5% off |
| Tier 3 — Production | 2,000 L | 10% off |
| Tier 4 — Strategic | 10,000 L | 15% off |
| Tier 5 — Flagship | 50,000 L | 20% off |

**Talking points:**
- Tiers are cumulative across all factories in their supply chain (not per-factory).
- Once they hit a threshold, the discount applies to ALL future orders at any of their factories.
- They can see their progress to the next tier on `/brand-portal/pricing`.

**Capture:**
- Agreed ladder (or use default):
  Tier 1: ___ L → ___ % off
  Tier 2: ___ L → ___ % off
  Tier 3: ___ L → ___ % off
  Tier 4: ___ L → ___ % off
  Tier 5: ___ L → ___ % off

---

## Part 6 — Protocol document

> "We've published our certified testing protocol — every brand acknowledges it as part of spec setup. Take a look and tell me if there's anything you'd want me to add or change for your specific case."

**Link:** https://fuzeatlas.com/education/testing-protocol

**Capture:**
- Protocol acknowledged: Y / N
- Any brand-specific additions to the protocol? ______________________________
- Protocol doc URL (if they want a brand-specific addendum hosted in Atlas):
  ____________________

---

## Part 7 — Atlas access for their team

> "Who on your team needs Atlas access? Each person gets their own login. Brand-level admins can invite teammates themselves via `/brand-portal/team`."

**Capture (initial seed list):**
| Name | Email | Role | Notes |
|---|---|---|---|
| | | BRAND_MANAGER / BRAND_USER | |
| | | | |
| | | | |

**Atlas action after meeting:** create users via `/admin/users` for each. Pre-set the brand link. Send invitations.

---

## Part 8 — Communication preferences

> "How do you want to hear from Atlas?"

**Capture:**
- Quarterly ESG snapshot — email recipient(s): ______________________________
- Test result notifications — channel preference: Email / In-app only / Both
- Order status notifications — same
- Marketing / product updates — opt in or opt out

---

## After the meeting — admin checklist

Within 24 hours of the meeting:

- [ ] Brand spec page filled in: `/admin/brands/[id]/spec`
- [ ] Factories created + linked via `/admin/factories` + BrandFactory junction
- [ ] Pricing tier ladder configured: `/admin/brand-pricing-tiers` (or via the brand-portal pricing page)
- [ ] User accounts created + invitations sent
- [ ] Fabric portfolio CSV received from brand → seeded into Atlas (manual one-off seed endpoint per brand for v1; CSV importer is Phase 18)
- [ ] Welcome email to brand confirming everything is set up + linking them to `/brand-portal/spec` to verify
- [ ] Send the protocol page link as required reading: https://fuzeatlas.com/education/testing-protocol

---

## TODO Phase 18 — CSV importer

Right now seeding a brand's fabric portfolio requires a per-brand seed endpoint (like `/api/cron/seed-sanmar`). For every new brand, a custom endpoint has to be written. Phase 18 should generalize this:

- Bearer-authed CSV import endpoint at `/api/admin/brands/[id]/fabrics/import`
- Accepts the Brand_Fabric_Portfolio_Template.csv shape (and flexibly maps brand-specific variants — Tina's SanMar sheet, KUIU's internal format, Penfabric's spreadsheet, etc.)
- Validates each row, dry-run mode shows what would be inserted
- Imports with factory-alias awareness (matches "XinKaiSheng (New Kasum)" → existing "NK" factory, same pattern as seed-sanmar)
- Auto-assigns FUZE numbers
- Auto-creates BrandFactory + SupplyChainLink junctions

Without this, every new brand onboarding requires Andrew or Code to write a custom seed endpoint. With this, brand onboarding is: meeting → fill template → upload → done.
