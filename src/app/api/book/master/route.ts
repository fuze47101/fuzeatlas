import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MANAGER_ROLES, getBook, getUnassigned, visibleBookOwners } from "@/lib/book";

export const maxDuration = 60;

/**
 * GET /api/book/master → every book the viewer may see, grouped by owner,
 * plus the accounts nobody owns (managers only).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isManager = MANAGER_ROLES.includes(user.role);
  const people = await visibleBookOwners(user);
  if (!isManager && people.length <= 1)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const owners: { id: string; name: string; accounts: Awaited<ReturnType<typeof getBook>> }[] = [];
  const now = new Date();
  for (let i = 0; i < people.length; i += 6) {
    const chunk = people.slice(i, i + 6);
    const books = await Promise.all(chunk.map((p) => getBook(p.id, now)));
    chunk.forEach((p, j) => {
      if (books[j].length) owners.push({ id: p.id, name: p.name, accounts: books[j] });
    });
  }
  // Two logins can share a display name; tell them apart by mail domain.
  const seen = new Map<string, number>();
  for (const o of owners) seen.set(o.name, (seen.get(o.name) || 0) + 1);
  for (const o of owners)
    if ((seen.get(o.name) || 0) > 1) {
      const p = people.find((x) => x.id === o.id);
      if (p?.email) o.name = `${o.name} (${p.email.split("@")[1]})`;
    }
  owners.sort((a, b) => b.accounts.length - a.accounts.length || a.name.localeCompare(b.name));

  const unassigned = isManager
    ? await getUnassigned()
    : { accounts: [], hiddenLeads: 0, hiddenMills: 0 };
  return NextResponse.json({ owners, unassigned });
}
