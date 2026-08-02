// @ts-nocheck
/**
 * GET /api/admin/red-rover/network — nodes + edges for the relationship
 * graph. Nodes = targets + people (contacts, incl. FUZE-side owners/
 * connectors). Edges = contact-of (person ↔ target); a person on multiple
 * targets naturally becomes a connector (Paul Cowell → Transfar + Archroma,
 * etc.). getRealUser gate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

export async function GET() {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const targets = await prisma.redRoverTarget.findMany({
    select: {
      id: true,
      name: true,
      tier: true,
      stage: true,
      contacts: { select: { name: true, side: true, role: true, title: true } },
    },
  });

  const nodes: any[] = [];
  const edges: any[] = [];
  const personIndex = new Map<string, any>();

  for (const t of targets) {
    const tid = `t:${t.id}`;
    nodes.push({ id: tid, label: t.name, kind: "target", tier: t.tier, stage: t.stage, degree: 0 });
    for (const c of t.contacts) {
      const key = c.name.trim().toLowerCase();
      const pid = `p:${key}`;
      let person = personIndex.get(pid);
      if (!person) {
        person = {
          id: pid,
          label: c.name,
          kind: "person",
          isFuze: c.side === "FUZE",
          role: c.role,
          title: c.title || null,
          degree: 0,
        };
        personIndex.set(pid, person);
        nodes.push(person);
      }
      // Any FUZE-side appearance flags the person as a FUZE owner/connector.
      if (c.side === "FUZE") person.isFuze = true;
      edges.push({ source: pid, target: tid, role: c.role });
    }
  }

  // Degree (targets connected per person, and contacts per target).
  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  for (const n of nodes) n.degree = deg.get(n.id) || 0;
  // A person touching >1 target is a connector.
  for (const n of nodes) if (n.kind === "person") n.connector = n.degree > 1;

  return NextResponse.json({ ok: true, nodes, edges });
}
