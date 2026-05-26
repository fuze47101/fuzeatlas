// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * GET /api/cron/weekly-suspect-email-scan
 *
 * Phase 16.6 T4 — weekly re-run of the Levenshtein-distance-2 typo
 * detector. Skips already-ignored pairs (SimilarEmailIgnore). If any
 * NEW suspect pairs surface, fires a Notification to admins +
 * emails Andrew. Silent otherwise.
 *
 * Schedule: Mondays 14:00 UTC via vercel.json.
 * Bearer-authed.
 */

const CRON_SECRET = process.env.CRON_SECRET;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return 99;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

const normalize = (s: any) => String(s || "").trim().toLowerCase();
const MAX_DISTANCE = 2;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [users, contacts, ignores] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", email: { not: null } },
      select: { id: true, email: true, name: true, role: true },
    }),
    prisma.contact.findMany({
      where: { email: { not: null } },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        brandId: true, factoryId: true, distributorId: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
    }),
    (prisma as any).similarEmailIgnore?.findMany({
      select: { userId: true, contactEmail: true },
    }).catch(() => []) ?? [],
  ]);

  const ignoreSet = new Set<string>(
    (ignores || []).map((r: any) => `${r.userId}::${normalize(r.contactEmail)}`)
  );

  const flagged: any[] = [];
  for (const u of users) {
    const ue = normalize(u.email);
    if (!ue) continue;
    for (const c of contacts) {
      const ce = normalize(c.email);
      if (!ce || ce === ue) continue;
      if (ignoreSet.has(`${u.id}::${ce}`)) continue;
      const d = levenshtein(ue, ce);
      if (d > 0 && d <= MAX_DISTANCE) {
        flagged.push({
          userId: u.id, userEmail: u.email, userName: u.name,
          contactId: c.id, contactEmail: c.email,
          source: c.brandId ? "brand" : c.factoryId ? "factory" : c.distributorId ? "distributor" : "orphan",
          sourceName: c.brand?.name || c.factory?.name || null,
          distance: d,
        });
        break; // one per user is enough for the digest
      }
    }
  }

  if (flagged.length === 0) {
    return NextResponse.json({
      ok: true,
      verdict: "No new suspect typo emails detected.",
      flagged: 0,
    });
  }

  const admins = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "EMPLOYEE"] } },
    select: { id: true, email: true },
  });

  // In-app notification fan-out
  await Promise.all(
    admins.map((a) =>
      prisma.notification.create({
        data: {
          userId: a.id,
          type: "SYSTEM",
          title: `${flagged.length} suspect email typo(s) detected`,
          message: `${flagged.length} user account(s) have an email within distance ${MAX_DISTANCE} of a known contact.`,
          link: "/admin/users/suspect-email-typos",
        },
      }).catch(() => null)
    )
  );

  const andrew = admins.find((a) => a.email === "andrew@801inc.com") || admins[0];
  if (andrew?.email) {
    const rows = flagged
      .slice(0, 20)
      .map(
        (f) =>
          `<tr><td>${f.userName || "—"} &lt;${f.userEmail}&gt;</td><td>${f.contactEmail}<br><small>${f.source}${f.sourceName ? ` — ${f.sourceName}` : ""}</small></td><td>${f.distance}</td></tr>`
      )
      .join("");
    await sendEmail({
      to: andrew.email,
      subject: `[FUZE Atlas] ${flagged.length} suspect email typo(s) — weekly scan`,
      html: `
        <h2>Suspect email typos — weekly scan</h2>
        <p>${flagged.length} active user account(s) have an email within Levenshtein distance ${MAX_DISTANCE} of a known Brand/Factory contact.</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px">
          <thead><tr><th align="left">User</th><th align="left">Possible match</th><th>Dist.</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p><a href="https://fuzeatlas.com/admin/users/suspect-email-typos">Open admin page →</a></p>
      `,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    verdict: `${flagged.length} suspect typo(s) flagged.`,
    flagged: flagged.length,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;
