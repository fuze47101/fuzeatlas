// @ts-nocheck
/**
 * Root route. We want the user's default landing experience to be the
 * module-cards home at /home (for internal roles) or a role-scoped portal
 * (for external roles — handled by middleware.ts before this page runs).
 *
 * Historically this file was the fabrics-search homepage from the very
 * first Atlas prototype. It's been superseded by /home (six module cards)
 * and by the role portals. Keeping it as the landing page left
 * ADMIN/EMPLOYEE users staring at a bare fabrics table when they visited
 * fuzeatlas.com — confusing and nothing worked on click.
 *
 * This is now a thin server-side redirect. Middleware has already handled
 * unauthenticated users (→ /login) and external-role users (→ their
 * portal) by the time this runs, so internal users hit /home.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}
