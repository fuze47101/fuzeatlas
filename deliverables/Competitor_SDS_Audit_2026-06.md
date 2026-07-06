# Competitor SDS Audit — 2026-06

Append-only audit transcript per CLAUDE.md "Competitive Intelligence Persistence Rule."

---

## 2026-06-06 — Silvadur 930 Flex binder/formaldehyde audit (Tina ticket cmp21cxdf0003l3046ym14iqj)

### The question

Tina Hong reported: "I checked the Silvadur information and it says that Silvadur does not require formaldehyde-releasing agents or extra binders during application. The mills reply back that Silvadur does not require extra binder during application as well. Do you think they use Formaldehyde Binder during production?"

The `src/lib/competitors.ts` row for `silvadur-930` had `binderRequired: true`, `binderType: "Acrylic co-polymer with crosslinker"`, and `binderFormaldehyde: true`. Phase 19.5 audit (2026-05) tagged this row with the generic silver-ion archetype defaults without auditing against the actual DuPont published TDS — exactly the failure mode the persistence rule is supposed to catch.

### Primary source pulled

DuPont **SILVADUR™ 930 FLEX Antimicrobial — Technical Data Sheet, Form Number 101-TD 07.02.19** (publicly available, English-language PDF). Verbatim extracts:

> "SILVADUR™ 930FLEX Antimicrobial uses a patented, polymer-based delivery system to transport and secure silver ions to textile goods efficiently. This novel system binds silver to avoid discoloration and early exhaustion."

> "Smart control polymer: binds silver sufficiently to enable at least 50 home launderings, longer-term efficacy, and improved cost-to-treat"

> Application (Exhaust): "Add SILVADUR™ 930FLEX gradually to the water with constant stirring at room temperature… Add acid to achieve pH between 4.5 and 8.5 in exhaust bath with optimal pH of 5.0 for natural fibers and 6.0 for synthetic fibers. Preferably use buffer to control the pH… Buffer A contains 79% of 0.1M sodium acetate and 21% of 0.1M acetic acid."

> "Efficient exhaustion has been observed at room temperature. If needed, the exhaust process could be conducted for 5-60 minutes with bath temperatures no higher than 130°C depending on other process conditions."

> "Dry treated goods using standard procedures depending on the fabric type; not to exceed 180°C."

> "Compatible with a broad range of woven and non-woven textile additives, including fluorocarbon chemicals, softeners, antiwrinkle resins, etc."

### What the TDS rules in vs out

- **No external binder required** — the polymer carrier in 930 Flex IS the binder. The TDS explicitly calls it the "Smart control polymer" responsible for the 50-wash durability claim.
- **No crosslinker required** — the only chemistries mentioned in the application recipe are acetic acid + sodium acetate buffer. No DMDHEU. No melamine-formaldehyde. No glyoxal. No urea-formaldehyde.
- **No thermal cure required** — the TDS specifies a drying ceiling of 180°C; this is fabric-type drying, not a chemical cure. Exhaustion happens at room temperature.
- **No formaldehyde-releasing chemistry called for** anywhere in the application recipe.

### Where formaldehyde COULD still enter the mill's process (not Silvadur's fault)

The TDS says Silvadur 930 Flex is "compatible with… antiwrinkle resins." Many anti-wrinkle / easy-care / durable-press resins on the textile market ARE formaldehyde-releasing (DMDHEU is the industry-standard durable-press crosslinker). If a mill is running an easy-care finish on the same fabric as Silvadur, **the formaldehyde comes from the easy-care chemistry, not from Silvadur**. The two chemistries can co-exist on the fabric without the formaldehyde being attributable to the antimicrobial product.

This means:
1. LANXESS/DuPont's marketing claim "Silvadur does not require formaldehyde-releasing agents" is **technically accurate** per their published TDS.
2. The mill's "Silvadur does not require extra binder during application" claim is **also accurate**.
3. To answer the actual question "do they use Formaldehyde Binder during production?", Tina needs to ask the mill specifically about their **easy-care / wrinkle-free finishing line**, not their antimicrobial step. If the fabric is also DP-finished, DMDHEU is almost certainly in the chain — but that's the customer's specification, not Silvadur's requirement.

### EPA Reg 464-785 — what the label does and doesn't say

The EPA Master Label for Silvadur 930 (PDF dated 2017-02-06, registrant Dow Chemical / now LANXESS) lists silver ion (Ag1+) at 0.098% w/w + Other Ingredients at 99.902%. The Other Ingredients line is the proprietary polymer carrier and water — composition not publicly published. EPA registration covers the active ingredient as a treated-article preservative; it does not specify or require any particular binder, fixing agent, or crosslinker chemistry, and it does not validate the wash count.

### Updated competitors.ts state

`src/lib/competitors.ts` row `silvadur-930` updated this session:

| Field | Before | After | Source |
| --- | --- | --- | --- |
| `binderRequired` | `true` | `false` | DuPont TDS 101-TD 07.02.19 application section |
| `binderType` | "Acrylic co-polymer with crosslinker" | "Self-binding via proprietary polymer carrier (no external resin)" | DuPont TDS |
| `binderGPerKg` | 15 | 0 | DuPont TDS — none required |
| `binderPricePerKg` | 3.50 | 0 | n/a |
| `binderLeachPctLifetime` | 12 | 0 | n/a |
| `binderVOC` | `true` | `false` | DuPont TDS |
| `binderFormaldehyde` | `true` | `false` | DuPont TDS |
| `curingRequired` | `true` | `false` | DuPont TDS — exhaustion is room-temperature |
| `endOfLifeNote` | "99%+ ingredients undisclosed on EPA label" | "99.902% Other Ingredients undisclosed on EPA Reg 464-785 — polymer carrier composition not published." | EPA PPLS PDF |

### The competitive lever that survives

Silvadur 930 Flex still has real liabilities — they're just different ones from what we had recorded:

1. **99.902% Other Ingredients undisclosed.** The polymer carrier is proprietary. Brands can't independently assess polymer breakdown products, microplastic shedding, or end-of-life recoverability. FUZE publishes its full composition (DI water + metamaterial).
2. **50-wash marketing claim with no third-party validation.** EPA does not certify wash counts. LANXESS/DuPont does not publish independent AATCC 100 reports through the durability window. FUZE shares its AATCC 100 / ISO 20743 reports through 100 washes on request.
3. **Silver leaching by design.** Even without a separate binder, the silver active is ion-leaching chemistry — that's how it kills bacteria in the AATCC 100 test geometry. FUZE is non-leaching contact-kill (see CLAUDE.md AATCC 100 vs ASTM E2149 deep dive).
4. **Mill-side formaldehyde from co-applied easy-care finishes.** If the brand wants both antimicrobial and wrinkle-free, DMDHEU enters the chain via the easy-care resin. FUZE applied alone has no formaldehyde at any step; if the brand also wants easy-care, that decision becomes a brand-level chemistry choice independent of FUZE.

### Files touched

- `src/lib/competitors.ts` — Silvadur 930 row corrected.
- This audit transcript.

### Sources

- DuPont SILVADUR 930 FLEX TDS, Form 101-TD 07.02.19 (publicly available, https://proextintor.es/wp-content/uploads/2020/10/SILVADUR-930-FLEX_TDS-2.pdf via PDF text extraction)
- EPA PPLS Master Label, EPA Reg 464-785, dated 2017-02-06 (https://www3.epa.gov/pesticides/chem_search/ppls/000464-00785-20170206.pdf)
- DuPont Silvadur 930 MSDS, ID 0901b80380956752 (UndershirtGuy mirror — confirms registrant, active ingredient, no formaldehyde components in the product itself)

### Verification status

- DuPont TDS — VERIFIED (read verbatim this session)
- EPA Reg 464-785 — VERIFIED (canonical PDF on file from prior 19.5 audit)
- Mill statement Tina received — CONSISTENT with TDS

### Open follow-up for Tina

Ask the mill specifically: "Does your finishing line run any easy-care, durable-press, or anti-wrinkle resin on the same fabric we're treating with Silvadur? If yes, what's the crosslinker chemistry — DMDHEU? Glyoxal? Polycarboxylic acid?" That question separates the antimicrobial chemistry (Silvadur, no formaldehyde) from the easy-care chemistry (possibly DMDHEU), which is where the formaldehyde lives in a textile finishing line if it's present at all.
