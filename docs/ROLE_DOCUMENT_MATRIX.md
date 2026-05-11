# Role × Document visibility matrix — Phase 14B

For each FUZE document category, which roles can see it?

Legend:
- **ALLOW** — full document visible
- **DENY** — not surfaced at all
- **EXCERPT** — summary / first page only; full doc gated to a higher role

Per-brand documents (per-brand pricing contracts, per-brand
protocols) get an additional `Brand.restrictedToBrandId` scope —
brand A never sees brand B's documents even when audience would
otherwise allow it.

---

|                                  | BRAND_USER | BRAND_MGR | FACTORY_USER | FACTORY_MGR | DIST_USER | LAB_USER | LAB_MGR | EMPLOYEE | ADMIN | PUBLIC |
| -------------------------------- | ---------- | --------- | ------------ | ----------- | --------- | -------- | ------- | -------- | ----- | ------ |
| Technical Data Sheet (TDS)       | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| Safety Data Sheet (SDS)          | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| Application Guide                | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | EXCERPT|
| Toxicology study reports         | EXCERPT    | ALLOW     | DENY         | EXCERPT     | DENY      | ALLOW    | ALLOW   | ALLOW    | ALLOW | DENY   |
| EPA federal registration         | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| California EPA approval          | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| OEKO-TEX Standard 100 Class I    | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| bluesign® approved status        | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| PFAS-free declarations           | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| Per-batch CoA                    | ALLOW (own)| ALLOW (own)| ALLOW (own)  | ALLOW (own) | ALLOW     | DENY     | DENY    | ALLOW    | ALLOW | DENY   |
| Per-fabric test reports          | ALLOW (own)| ALLOW (own)| ALLOW (own)  | ALLOW (own) | DENY      | ALLOW (own)| ALLOW (own)| ALLOW | ALLOW | DENY   |
| FUZE production/lot traceability | DENY       | EXCERPT   | DENY         | EXCERPT     | ALLOW     | DENY     | DENY    | ALLOW    | ALLOW | DENY   |
| Brand-stipulated protocols       | ALLOW (own)| ALLOW (own)| ALLOW (own)  | ALLOW (own) | DENY      | ALLOW (own)| ALLOW (own)| ALLOW | ALLOW | DENY   |
| Brand pricing tier contracts     | DENY       | ALLOW (own)| DENY         | DENY        | DENY      | DENY     | DENY    | ALLOW    | ALLOW | DENY   |
| Distributor agreements           | DENY       | DENY      | DENY         | DENY        | ALLOW (own)| DENY    | DENY    | ALLOW    | ALLOW | DENY   |
| Distributor pricing matrices     | DENY       | DENY      | EXCERPT      | EXCERPT     | ALLOW (own)| DENY    | DENY    | ALLOW    | ALLOW | DENY   |
| Lab accreditation documents      | ALLOW      | ALLOW     | DENY         | EXCERPT     | DENY      | ALLOW (own)| ALLOW (own)| ALLOW | ALLOW | EXCERPT|
| Lab raw instrument data          | DENY       | EXCERPT   | DENY         | EXCERPT     | DENY      | ALLOW (own)| ALLOW (own)| ALLOW | ALLOW | DENY   |
| Sales playbooks                  | DENY       | DENY      | DENY         | DENY        | DENY      | DENY     | DENY    | ALLOW    | ALLOW | DENY   |
| Internal SOPs                    | DENY       | DENY      | DENY         | DENY        | DENY      | DENY     | DENY    | ALLOW    | ALLOW | DENY   |
| FUZE-only IP / chemistry detail  | DENY       | DENY      | DENY         | DENY        | DENY      | DENY     | DENY    | EXCERPT  | ALLOW | DENY   |
| Press releases / case studies    | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| Marketing collateral             | ALLOW      | ALLOW     | ALLOW        | ALLOW       | ALLOW     | ALLOW    | ALLOW   | ALLOW    | ALLOW | ALLOW  |
| Quarterly ESG reports            | ALLOW (own)| ALLOW (own)| EXCERPT     | EXCERPT     | DENY      | DENY     | DENY    | ALLOW    | ALLOW | ALLOW (published)|
| Sustainability calculations      | ALLOW (own)| ALLOW (own)| EXCERPT     | EXCERPT     | DENY      | DENY     | DENY    | ALLOW    | ALLOW | DENY   |

---

## Critical safety rules

1. **Per-brand documents** (rows marked "ALLOW (own)") must check
   `ProductDocument.restrictedToBrandId` against the caller's
   `User.brandId`. Brand A NEVER sees Brand B's tier contracts even
   if both are "brand-facing." Phase 14B adds this column.

2. **Per-factory documents** (per-batch CoA, brand-stipulated
   protocols delivered to a specific factory) similarly check a
   `restrictedToFactoryId` column.

3. **FUZE-only IP / chemistry detail** is the hardest line. Anyone
   below EMPLOYEE role gets DENY — not EXCERPT — to keep the
   competitive moat intact.

4. **Public ESG reports** (12C) only surface to PUBLIC after admin
   stamps `BrandEsgSnapshot.publishedAt`. Unpublished snapshots
   are draft-internal only.

5. **Brand pricing tier contracts** — these are signed legal docs.
   Brand managers see their OWN, FUZE Ops sees all, everyone else
   DENY. This is the most-sensitive row.

## Enforcement

`src/lib/document-acl.ts` exports:

```ts
export function canViewDocument(
  doc: ProductDocument,
  user: SessionUser,
): "ALLOW" | "EXCERPT" | "DENY";
```

`/api/library/[id]/route.ts` calls it on every fetch. Returns
EXCERPT → strips fileUrl, includes summary only. DENY → 404.

Schema additions (Phase 14B):
- `ProductDocument.restrictedToBrandId String?`
- `ProductDocument.restrictedToFactoryId String?`
- `ProductDocument.restrictedToDistributorId String?`
- `ProductDocument.restrictedToLabId String?`
- Existing `ProductDocument.audience String[]` now includes role
  values: BRAND_USER, BRAND_MANAGER, FACTORY_USER, FACTORY_MANAGER,
  DISTRIBUTOR_USER, LAB_USER, LAB_MANAGER, EMPLOYEE, ADMIN, PUBLIC.
  Legacy "BRAND"/"FACTORY"/"DISTRIBUTOR"/"LAB" still match BOTH role
  tiers within the entity type (back-compat).
