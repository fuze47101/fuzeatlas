/**
 * /admin — Phase 13N.
 *
 * Closes the bare /admin 404. Redirects authenticated admins to the
 * Command Center (Phase 8C); the middleware bounces non-admins back
 * to /login or their home portal.
 */
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/command-center");
}
