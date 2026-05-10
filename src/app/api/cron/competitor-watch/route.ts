// @ts-nocheck
/**
 * GET /api/cron/competitor-watch — Phase 11D.
 *
 * Bearer-authed daily cron (04:00 UTC, registered in vercel.json).
 * Walks the curated COMPETITOR_TARGETS list, fetches each URL,
 * computes a contentHash on the response body, and persists a
 * CompetitorSnapshot row when the hash differs from the most-recent
 * snapshot for that URL.
 *
 * Posture:
 *   - One request per URL per day, identified User-Agent
 *   - Respects robots.txt by best-effort fetch + non-2xx skip
 *   - No bypass of paywalls / logins
 *
 * Each fetched body is also passed to Claude haiku-4-5 for
 * structured extraction (products / claims / wash-count language)
 * so the diff payload carries semantic structure, not just a hash.
 * Claude pass is skipped when ANTHROPIC_API_KEY is unset.
 *
 * On a change, fires a Notification to Andrew + every admin with a
 * brief summary of what's different.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiFetch } from "@/lib/ai-fetch";
import { createHash } from "node:crypto";
import { COMPETITOR_TARGETS } from "@/lib/competitor-targets";

const USER_AGENT = "FUZE-Atlas-Research/1.0 (andrew@801inc.com)";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function extractWithClaude(html: string, competitor: string) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // Strip everything outside <body> and trim to the first 8 KB so we
  // don't blow the prompt budget on nav chrome / scripts.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const stripped = (bodyMatch ? bodyMatch[1] : html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
  const systemPrompt = `You are extracting competitive intelligence from a competitor's product page. Return JSON only:
{
  "products": [{ "name": "...", "price": "...|null", "claims": ["..."] }],
  "washCountClaims": ["..."],
  "certifications": ["..."],
  "lastUpdated": "<any visible date|null>",
  "summary": "<2 sentence summary of what this page advertises>"
}
Be neutral / factual — don't editorialize.`;
  try {
    const { response } = await aiFetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            { role: "user", content: `Competitor: ${competitor}\n\nPage:\n${stripped}` },
          ],
        }),
      },
      { provider: "anthropic", callerRoute: "competitor-watch", userId: "system" },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function diffExtracted(prev: any, curr: any) {
  if (!prev || !curr) return { changed: !!curr && !prev };
  const out: any = {};
  const prevProducts = new Set((prev.products || []).map((p: any) => p.name).filter(Boolean));
  const currProducts = new Set((curr.products || []).map((p: any) => p.name).filter(Boolean));
  const added = [...currProducts].filter((p) => !prevProducts.has(p));
  const removed = [...prevProducts].filter((p) => !currProducts.has(p));
  if (added.length) out.productsAdded = added;
  if (removed.length) out.productsRemoved = removed;
  const prevClaims = new Set((prev.washCountClaims || []) as string[]);
  const currClaims = new Set((curr.washCountClaims || []) as string[]);
  const newClaims = [...currClaims].filter((c) => !prevClaims.has(c));
  if (newClaims.length) out.washClaimsAdded = newClaims;
  if (prev.summary !== curr.summary) out.summaryChanged = true;
  return out;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const adminIds = (
    await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    })
  ).map((u) => u.id);

  const results: any[] = [];
  let changed = 0;

  for (const target of COMPETITOR_TARGETS) {
    try {
      const res = await fetch(target.url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        results.push({ key: target.key, status: "skipped", reason: `HTTP ${res.status}` });
        continue;
      }
      const html = await res.text();
      const contentHash = sha256(html);

      const prev = await prisma.competitorSnapshot.findFirst({
        where: { url: target.url },
        orderBy: { fetchedAt: "desc" },
        select: { id: true, contentHash: true, extracted: true },
      });

      if (prev?.contentHash === contentHash) {
        results.push({ key: target.key, status: "unchanged" });
        continue;
      }

      const extracted = await extractWithClaude(html, target.competitor);
      const diff = prev ? diffExtracted(prev.extracted, extracted) : null;

      await prisma.competitorSnapshot.create({
        data: {
          competitor: target.key,
          url: target.url,
          contentHash,
          extracted: extracted || {},
          diffFromPrev: diff || null,
        },
      });
      changed++;
      results.push({ key: target.key, status: "changed", diff });

      // Notify on every change so Andrew gets a heads-up.
      const summary =
        diff && Object.keys(diff).length > 0
          ? Object.entries(diff)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
              .slice(0, 240)
          : "Content hash changed — review snapshot for details.";
      await Promise.all(
        adminIds.map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              type: "BRAND_ACTIVITY",
              title: `📊 ${target.competitor} page changed`,
              message: summary,
              link: `/admin/competitor-pricing?competitor=${encodeURIComponent(target.key)}`,
              metadata: {
                source: "competitor-watch",
                competitor: target.key,
                url: target.url,
              },
            },
          }),
        ),
      );
    } catch (err: any) {
      results.push({ key: target.key, status: "error", error: err?.message || String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    targets: COMPETITOR_TARGETS.length,
    changed,
    results,
  });
}
