import { redirect } from "next/navigation";

/**
 * /admin/brands → /admin/brand-pipeline.
 *
 * NEED-5 redundancy elimination — the legacy brand index lived here
 * before Phase 8 split out /admin/brand-pipeline as the canonical
 * filterable view. Detail pages at /admin/brands/[id] still resolve
 * (those are the brand detail surface and are still in active use).
 */
export default function AdminBrandsRedirect() {
  redirect("/admin/brand-pipeline");
}
