# FTP F1 — Nylon Application Protocol (pH-Assisted Deposition)
Internal engineering note + TDS language. Author: Andrew Peterson / Claude · 2026-09-24 · Added to TDS-FTP-F1-002 Rev 1.1

## Why nylon under-exhausts at neutral pH
FTP F1 is 99.997% 18 MΩ DI water carrying 0.003% metallic silver allotrope — non-ionic, non-reactive, no ligand. In water the particle surface carries a modest **negative charge**, which is what the fiber-side pH adjustment exploits. Nylon (polyamide) at neutral pH sits near its isoelectric point — little net surface charge — so deposition relies on van der Waals + polarity differential alone, and part of the dose rinses off. Observed: ICP 0.85 mg/kg vs 1.0 mg/kg F1 target on nylon.

**Below ~pH 5 nylon's amine end groups protonate → fiber surface goes POSITIVE → electrostatic attraction to the negative active.** This is the same chemistry acid dyes use on nylon; every nylon mill already runs these conditions.

## Fiber rule
| Fiber | Bath pH | Reason |
|---|---|---|
| **Nylon / polyamide** | **4.5–5.0 (acetic acid)** | amines protonate → positive fiber → electrostatic deposition |
| Polyester | neutral (~7) | no ionizable groups; acid gives no attraction, only colloid risk |
| Cotton / cellulosics | neutral; use cationic pretreatment (CHPTAC-type) if uptake is low | cotton is anionic and never goes positive with acid |

## Protocol (mill-facing — this is the TDS text)
1. Prepare the bath with DI or softened water **free of chloride**. Do not use untreated tap water (chloride precipitates the active as AgCl).
2. Add FTP F1 at the dosage for the target tier and expected pickup (TDS tables).
3. Adjust bath to **pH 4.5–5.0 with acetic acid only** (typically 0.3–0.5 mL/L of 10% acetic acid; verify with meter or strips). **Never use hydrochloric acid or any chloride-containing acid. Do not go below pH 4.0.** Do not add salts.
4. **Apply within 60 minutes** of acidification. Pad, exhaust, or spray and dry under standard mill conditions. No curing step required.
5. Fabric must be scoured and free of softeners / spin-finish lubricants before treatment.
6. Verify loading by ICP against the tier target.

## Rules that protect the product
- **Do NOT pre-acidify FTP F1 stock or store the product at reduced pH.** pH is adjusted in the application bath at point of use only. Reasons: (a) a ligand-free Ag colloid at pH 4.5 slowly releases Ag⁺ in storage → product drifts toward ionic, contradicting the metallic (CAS 7440-22-4), non-ionic identity; (b) reduced surface charge → slow aggregation in the bottle (plasmon broadening, lost efficacy); (c) reformulating the product = new SDS / regulatory paperwork, whereas acidifying a mill bath is routine.
- Heat + acid together accelerates Ag oxidation. If exhausting warm (60–80 °C), keep pH ≥ 4.5 and time short.
- In 18 MΩ water, 0.3–0.5 mM acetic acid barely raises ionic strength — the colloid tolerates it for the application window. It is NOT a storage condition.

## If a pre-acidified "F1-N" SKU is ever demanded — gate it
Bottle at pH 4.5 and run 0 / 30 / 90-day stability before any release:
1. Plasmon peak ~400 nm (UV-vis) — shift or broadening = aggregation
2. Free Ag⁺ (ion-selective electrode or ICP on 10 kDa filtrate) — rise = ionic drift
3. Zeta potential
Ship only if all three hold at 90 days. Expectation: Ag⁺ fails.

## Validation experiment (one afternoon)
Pad nylon at pH 7 vs 4.5 (same dosage). Read bath absorbance at ~400 nm before/after each pad → % exhausted onto fiber. Send both swatches for ICP (target 1.0 mg/kg). Then rinse/sonicate and re-read. Expected: pH 4.5 exhausts more and retains more. Run polyester in parallel to confirm pH does nothing there (fiber logic check).

## Distribution
- TDS-FTP-F1-002 **Rev 1.1** (EN) regenerated with the "Nylon Application Protocol" section — `Product_Documents/FUZE_FTP_F1_TDS.pdf` (v1.0 kept as `_v1.0.pdf`).
- VI / ZH translations of Rev 1.1: PENDING (translate the new section; do not ship mixed-revision language sets).
- fuzeatlas.com: upload Rev 1.1 via /admin/product-documents (docType TDS, productLine F1, language EN, version "1.1") — the site serves ProductDocument records from the DB, not from the repo.
