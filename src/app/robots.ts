/**
 * /robots.txt — Phase 12F.
 *
 * Allow crawling of every public surface:
 *   /verified/*, /claims, /press, /docs, /education, /fabric-library
 * Disallow everything authenticated.
 */
import type { MetadataRoute } from "next";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/login",
          "/request-access",
          "/verified/",
          "/claims",
          "/press",
          "/docs/",
          "/education",
          "/fabric-library",
        ],
        disallow: [
          "/admin/",
          "/api/",
          "/brand-portal/",
          "/factory-portal/",
          "/distributor-portal/",
          "/lab-portal/",
          "/dashboard",
          "/home",
          "/settings/",
          "/contacts/",
          "/brands/",
          "/factories/",
          "/fabrics/",
          "/test-results/",
          "/orders/",
          "/invoices/",
          "/pipeline",
          "/calendar/",
          "/acm/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
