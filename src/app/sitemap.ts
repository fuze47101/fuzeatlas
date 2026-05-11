import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Dynamic sitemap for FUZE Atlas.
 *
 * Phase 12F — extended to include every public verification surface:
 *   - /verified/[publicSlug] for every publicly-enabled BrandProfile
 *   - /verified/[publicSlug]/esg for the same
 *   - /claims and /press
 *   - PUBLIC-audience ProductDocument fileUrls
 *
 * Internal dashboard / admin pages are intentionally excluded —
 * robots.ts disallows them.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const baseEntries: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "monthly", priority: 1 },
    {
      url: `${APP_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${APP_URL}/request-access`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${APP_URL}/fabric-library`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${APP_URL}/claims`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/press`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  try {
    const [profiles, docs] = await Promise.all([
      prisma.brandProfile.findMany({
        where: { publicEnabled: true, publicSlug: { not: null } },
        select: { publicSlug: true, updatedAt: true },
      }),
      prisma.productDocument.findMany({
        where: { audience: { has: "PUBLIC" } },
        select: { fileUrl: true, updatedAt: true },
      }),
    ]);

    for (const p of profiles) {
      baseEntries.push({
        url: `${APP_URL}/verified/${p.publicSlug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.9,
      });
      baseEntries.push({
        url: `${APP_URL}/verified/${p.publicSlug}/esg`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
    for (const d of docs) {
      if (!d.fileUrl?.startsWith("http")) continue;
      baseEntries.push({
        url: d.fileUrl,
        lastModified: d.updatedAt,
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
  } catch (err) {
    // DB unreachable at build time — return base set only.
    console.warn("[sitemap] dynamic fetch failed:", err);
  }

  return baseEntries;
}
