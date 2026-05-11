# Redundancy audit — Phase 14F

Walked every nav surface (Sidebar.tsx, /home module picker,
portal landing quick links, brand-detail tabs) and surfaced
duplicates / overlapping pages.

## Auto-fixable (one canonical destination + redirect / sidebar drop)

| Duplicate | Canonical | Action |
| --- | --- | --- |
| `/admin/orders` + `/admin/orders-dashboard` | `/admin/orders-dashboard` | `/admin/orders` redirects to `/admin/orders-dashboard` |
| `/distributor-portal/orders` + `/distributor-portal/incoming-orders` | `/distributor-portal/incoming` | Drop the dupe from sidebar; routes stay alive for back-compat |
| `/lab-portal/catalog` (legacy LabService) + `/lab-portal/lab-tests` (Phase 10B) | `/lab-portal/lab-tests` | Add deprecation banner to legacy; mark for deletion next cycle |
| `/distributor-portal/documents` + `/distributor-portal/library` | `/distributor-portal/library` | Drop /documents from sidebar |
| `/admin/accounts` + `/admin/brand-pipeline` partial overlap | `/admin/brand-pipeline` | Surface `/admin/accounts` as a Tab inside Brand Pipeline rather than a separate sidebar item (already done in Phase 13E consolidation) |

## Surface to Andrew (ambiguous)

| Pages | Question | Note |
| --- | --- | --- |
| `/tests` vs `/admin/test-repository` | User-facing tests list vs admin search? | Keep both — different purposes. Update copy. |
| `/fabric-library` (public) vs `/factory-portal/library` (factory-only) vs `/lab-portal/library` (lab-only) | Single library with role scoping or three? | Phase 14B ACL helper now in place — consider collapsing in a follow-up. |
| `/admin/sample-trials` vs `/admin/icp-sample-prep` | Both lab-prep workflows but different scopes. | Keep both. Add cross-links. |
| `/admin/recipe-calculator` vs `/admin/recipe-calculator/sop` | The calculator + the SOP docs page. | Keep both; SOP is a sibling doc, not a duplicate. |

## Stale / coming-soon (delete or finish)

None found in this pass — Phase 13E consolidation already pruned
the "Coming Soon" stubs.

## Sidebar nav health

After Phase 13E consolidation:
- 6 deduplicated groups (Sales & Pipeline, Operations, Quality &
  Labs, Partners, Resources, Admin)
- No duplicate link to the same route
- Old `business-development` hint normalized to `sales-pipeline`

## Routes that hard-404 today

Per the build log, `/admin` 404 closed in Phase 13N (redirects to
`/admin/command-center`). No other known 404s on first-class
sidebar routes.
