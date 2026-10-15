**To:** Robert Zyschka — Senior Application Specialist Finishing, CHT Group
**Subject:** Re: Round 1 results — reading the data, and a Round 2 that closes the gap

---

Robert,

Thank you for the thorough first round and for running ICP on both sides — the pre-wash numbers tell me the two laboratories are already reconciling, which was the hardest thing to get right.

Here is how I read the data, and what I'd like to run next.

**What Round 1 established**

1. **Deposition is correct.** You targeted 2.0 mg/kg and landed 1.6–2.2 on both fabrics. Bath, pick-up and padding all behaved; nothing to change there.
2. **The inter-laboratory ICP-MS agrees** at the pre-wash level. That was the method risk and it's retired.
3. **Retention through 30 × ISO 6330 4N is the gap** — ~5% on PES, 5–26% on CO.

**What I believe the retention result is telling us — and this is on our side, not yours**

You applied and dried exactly as we instructed. Our guidance states that FUZE bonds on contact and needs no fixation step. That is true for *attachment*. What your 30-wash data shows — and what our own recent work on polyester has confirmed with a different particle — is that a surface-bonded particle held by van der Waals interaction alone does not survive a demanding wash series on PES or CO without a fixation step. On polyester the fibre surface needs to reach its softening regime so the particle is mechanically anchored; 120 °C is below that. On cotton there is no thermoplastic to soften, so the lever is surface charge rather than heat. I should have specified both, and I will be updating our technical documentation to do so. Round 1 did its job in surfacing this cleanly.

**Three quick questions that will sharpen the diagnosis**

1. Which acid did you use to adjust the bath to pH 5.5? (If it was a chloride-bearing acid, that alone could account for a large part of the loss — silver chloride particulate washes off readily. Acetic acid is the only one we recommend, and for CO and PES we prefer no pH adjustment at all.)
2. Was the bath made up with deionised water, or softened/tap water?
3. Was the pre-wash ICP sample taken before or after a rinse? For Round 2 I'd like to define "pre-wash" as *after one DI rinse*, so we're measuring bound silver from the start.

Also — which detergent did the 4N cycles use? For Round 2 I'd suggest ECE-A (no perborate, no optical brightener) so the series isn't oxidative, and that we name it in both reports.

**Round 2 — proposed**

Same 2.0 mg/kg on both fabrics, DI water, no pH adjustment, FUZE alone in the bath. Two changes, each isolating one variable:

- **PES jersey:** after drying, a **thermofixation pass at 150–170 °C for 60–90 s** (below your heat-set conditions). Please run one set *with* and one *without* the fixation on the same bath — that single comparison answers the question.
- **CO twill:** a standard **cationic pretreatment** (CHPTAC-type pad-batch, rinsed) before the FUZE pad, again with and without, so the pretreatment's contribution is explicit.

ICP-MS at **0 (post-rinse), 10, 20 and 30 washes** rather than the two endpoints, with an untreated control of each fabric carried through the full series — the curve tells us far more than the endpoint. Digestion per FTP-100 Section 5 as before.

I'd rather you hold the AATCC 100 post-wash plates until we have Round 2 fabric — at the current post-wash loadings the static method will understate what the technology does, and I don't want a number on file that reflects the fixation gap rather than the chemistry. Pre-wash plates are worth running now.

I can turn around a Round 2 recipe sheet with the fixation and pretreatment conditions written out for your line as soon as you confirm the three points above.

Thank you again — this was a genuinely useful round.

Best regards,

Andrew Peterson
FUZE Biotech

---

### Internal review (not for CHT) — 2026-10-15

**Data:** CO pre 1.6/1.9 → post-30 0.42/0.10 (26%/5%); PES pre 2.2/1.9 → 0.11/0.11 (5%/6%). ISO 6330 4N × 30. Applied pH 5.5, 120 °C dry only, water source unknown, acid unknown.

**Ranked causes:**
1. **No fixation (primary, physics).** TDS + our own CHT letter told them "no cure." vdW-only bond is not 30-wash durable on PES/CO under ISO 6330 — same lesson as the diamond no-heat swatches. PET needs 150–170 °C embed; cotton needs cationization (no thermoplastic). **This is a TDS guidance gap, not a CHT error. Update TDS: "dry at normal conditions; for wash-durability specifications >20 cycles on PES, thermofix 150–170 °C; on CO, cationic pretreat."**
2. **Bath chemistry (if HCl / tap water).** Chloride → AgCl particulate (washes off); hardness → colloid aggregation. Explains good pre / bad post. Confirm acid + water.
3. **ICP artefact on post-wash.** Three of four post values at 0.10–0.11 = suspicious method floor; AgCl chloride trap in digest → false low. **Andrew's own ICP on the returned samples is the check.** Also: pre-wash ICP possibly on unrinsed fabric → inflated baseline.
4. pH 5.5 per se: minor on CO/PES (no amines). Only matters via the acid used.

**AATCC 100 in flight:** pre-wash should pass; post-30 at ~0.1 mg/kg will likely fail (static method, contact-kill active). Frame Round 1 = deposition + ICP validated + fixation gap identified, BEFORE the plate result lands.

**Action — pull Kaylee's Nike wash ICP (Lee Gladish; 1 & 5 ppm, 0 & 50 wash, radical-airflow fabric) and the exact application/fixation conditions.** If Fuze's own 50-wash retention was strong, the conditions that produced it are the recipe CHT should have had. If that was a hot spray-dry, it confirms the fixation conclusion.

**TDS implication:** Rev 1.2 needs a "Wash Durability / Fixation" section: PES 150–170 °C thermofix (below heat-set); CO cationic pretreat; nylon pH 4.5–5 (Rev 1.1 already). The "no cure required" line stays true for attachment but must be qualified for durability specs. Reconcile the 100-wash marketing claim against this before it's repeated to another lab.
