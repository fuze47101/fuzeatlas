/**
 * /press — Phase 12E public press kit.
 * Server-rendered, 10min revalidate.
 */
import Link from "next/link";
import PublicPageBeacon from "@/components/PublicPageBeacon";
import { getServerTranslations } from "@/i18n/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

interface Item {
  id: string;
  type: "LOGO" | "IMAGE" | "RELEASE" | "NEWS_LINK";
  url: string;
  caption: string | null;
  releaseDate: string | null;
}

export const revalidate = 600;

export const metadata = {
  title: "Press kit — FUZE Biotech",
  description:
    "Press kit for FUZE Biotech: logos, imagery, founders, recent press, and certifications.",
  openGraph: {
    title: "FUZE Biotech press kit",
    description:
      "Logos, imagery, press releases, and company info for FUZE Biotech.",
  },
};

async function loadPress(): Promise<Item[]> {
  try {
    const res = await fetch(`${APP_URL}/api/public/press`, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const j = await res.json();
    return j.ok ? j.items : [];
  } catch {
    return [];
  }
}

export default async function PressKitPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).pressLanding;
  const items = await loadPress();
  const logos = items.filter((i) => i.type === "LOGO");
  const images = items.filter((i) => i.type === "IMAGE");
  const releases = items.filter((i) => i.type === "RELEASE");
  const newsLinks = items.filter((i) => i.type === "NEWS_LINK");

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicPageBeacon path="/press" />
      <section className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black">{T.heroTitle}</h1>
          <p className="mt-3 text-lg text-white/90">
            {T.heroSubtitle}
          </p>
        </div>
      </section>

      {/* About */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black text-slate-900 mb-3">{T.aboutTitle}</h2>
        <p className="text-slate-700">
          {T.aboutBody1}
        </p>
        <p className="text-slate-700 mt-3">
          {T.aboutBody2}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-slate-500">{T.foundedLabel}</dt>
          <dd className="font-bold text-slate-900">{T.foundedValue}</dd>
          <dt className="text-slate-500">{T.addressLabel}</dt>
          <dd className="font-bold text-slate-900">1895 West 2100 South, SLC, UT 84119</dd>
          <dt className="text-slate-500">{T.pressContactLabel}</dt>
          <dd className="font-bold text-slate-900">
            <a href="mailto:andrew@fuze47.com" className="hover:underline">
              andrew@fuze47.com
            </a>
          </dd>
        </dl>
      </section>

      {logos.length > 0 && (
        <Section title={T.logosSection}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {logos.map((i) => (
              <a
                key={i.id}
                href={i.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-[#00b4c3] hover:shadow-md text-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.url}
                  alt={i.caption || T.logoAltFallback}
                  className="h-16 mx-auto object-contain"
                />
                {i.caption && <p className="text-xs text-slate-600 mt-2">{i.caption}</p>}
                <p className="text-[10px] text-[#00b4c3] mt-1 font-bold">{T.downloadLabel}</p>
              </a>
            ))}
          </div>
        </Section>
      )}

      {images.length > 0 && (
        <Section title={T.imagerySection}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {images.map((i) => (
              <a
                key={i.id}
                href={i.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-[#00b4c3] hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.url}
                  alt={i.caption || T.imageAltFallback}
                  className="w-full h-48 object-cover"
                />
                {i.caption && <p className="text-xs text-slate-700 p-3">{i.caption}</p>}
              </a>
            ))}
          </div>
        </Section>
      )}

      {releases.length > 0 && (
        <Section title={T.releasesSection}>
          <ul className="space-y-3">
            {releases.map((i) => (
              <li
                key={i.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <a
                  href={i.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-slate-900 hover:text-[#00b4c3]"
                >
                  {i.caption || T.releaseFallback}
                </a>
                {i.releaseDate && (
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(i.releaseDate).toLocaleDateString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {newsLinks.length > 0 && (
        <Section title={T.newsSection}>
          <ul className="space-y-2">
            {newsLinks.map((i) => (
              <li key={i.id}>
                <a
                  href={i.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#00b4c3] hover:underline"
                >
                  {i.caption || i.url}
                </a>
                {i.releaseDate && (
                  <span className="text-xs text-slate-500 ml-2">
                    {new Date(i.releaseDate).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="max-w-4xl mx-auto px-6 py-8 text-xs text-slate-500 text-center border-t border-slate-200">
        <p>
          FUZE Atlas ·{" "}
          <Link href="/claims" className="hover:underline">
            {T.claimsLink}
          </Link>{" "}
          ·{" "}
          <a href="https://fuzeatlas.com" className="hover:underline">
            fuzeatlas.com
          </a>
        </p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-black text-slate-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}
