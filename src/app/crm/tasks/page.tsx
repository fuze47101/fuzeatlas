// @ts-nocheck
/**
 * Redirect stub — /crm/tasks was renamed to /acm/tasks as part of the
 * CRM → ACM (Atlas Customer Management) rebrand. This file exists so
 * existing bookmarks and any stale notification deep-links keep working.
 * Remove in a cleanup pass once analytics confirm no /crm traffic.
 */
import { redirect } from "next/navigation";

export default function CrmTasksRedirect() {
  redirect("/acm/tasks");
}
