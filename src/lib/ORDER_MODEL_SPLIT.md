# Why DistributorRestockOrder and FuzeOrder stay separate

A recurring drive-by question: "These both look like orders, why not unify?" The
two models survived a review-and-decide pass on 2026-05-16 and stay split.
Capturing the reasoning here so future spec changes don't waste a cycle.

## The two shapes have genuinely different units of measure

`DistributorRestockOrder` is **bottle-discrete**. It carries `unitType`
(CARBOY / GAYLORD / CONTAINER_20 / CONTAINER_40 / SAMPLE_500ML / SAMPLE_1L)
plus `unitQuantity`, then derives `totalLiters`. A distributor who orders
"3 gaylords" is genuinely ordering 3 physical pallets — fractional gaylords
don't exist.

`FuzeOrder` is **liter-continuous** for production orders. A factory orders
`volumeLiters: 1180` for an exhaust bath that's been sized to the fabric load.
The bottle count is a derived display, not the unit being purchased.

A unified table would need either (a) every column null-permissive enough
to model both shapes — losing schema-level safety — or (b) a polymorphic
sub-table per orderType, which is just two tables with extra joins.

## They ship from different warehouses with different fulfillment paths

| | DistributorRestockOrder | FuzeOrder |
|---|---|---|
| Ships from | FUZE Direct (Salt Lake City) OR master distributor warehouse | Factory's assigned distributor warehouse |
| QA/QC | Production batch traceability + COA per gaylord | Bath-recipe traceability + per-application ICP cadence |
| Customs / freight | International gaylord-minimum gate | Skips gate (distributor handles last mile) |
| Carrier | Container freight, port-of-export | Local courier, factory dock |

The fulfillment side is operationally different enough that unifying would
mean a hairball of `if orderType === "DISTRIBUTOR_RESTOCK"` branches every
time anyone touches the order lifecycle.

## Brand attribution exists on one and not the other

`FuzeOrder.brandAllocations` is the row's reason for being — production orders
get split across multiple brands so AM commission, brand pricing tiers, and
required-tier validation can all key off the allocation. Restocks have **no
brand**: a distributor restocking FUZE doesn't know which downstream factory
will buy from them yet, let alone which brand each factory will serve.

Forcing brand allocation onto restocks would mean either: (a) leaving the
field always null on half the rows, or (b) inventing a synthetic
"unallocated" brand row that downstream queries have to filter out.

## QR / SDS / COA scope differs

The TRACK-3 QR label / SDS / COA wiring keys off `FuzeOrder.orderNumber`
because that's the unit the factory operator scans on receipt. Restocks
get their own internal tracking inside the distributor inventory model;
they don't need a public verification page because no third party scans
them.

## Verdict

The schema split is a feature, not tech debt. Two tables, two intentional
shapes, two separate UI flows. The recurring pull toward unification comes
from pattern-matching on the word "order" — not from any actual reuse
opportunity.

Files that intentionally read both:
- `src/app/api/cron/diag-all-surfaces/route.ts` — surface coverage
- `src/app/admin/orders/page.tsx` — admin sees both for triage
- `prisma/schema.prisma` — schema source of truth

If a future spec wants to unify, the right move is to extract the small
shared rendering primitives (status badges, lifecycle timeline) into a
shared component — not to rewrite the table.
