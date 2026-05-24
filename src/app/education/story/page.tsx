/**
 * /education/story — The FUZE Story / Origin
 *
 * Andrew (2026-05-04, expert-marketer note): brands DO NOT KNOW we
 * upcycle e-waste into antimicrobial. Multi-million-dollar ESG
 * narrative sitting unused. This page is the consumer-facing version
 * of how FUZE is actually made.
 */

import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";

export const metadata = {
  title: "The FUZE Story",
};

export default async function FuzeStoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).educationStory;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8">
        <Link href="/education" className="text-xs text-emerald-300 hover:text-emerald-200">{T.backLink}</Link>
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mt-2 mb-1">{T.kicker}</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{T.heroTitle}</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">
          {T.heroBody}
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-3xl mb-2">♻️</div>
          <h2 className="text-base font-black text-slate-900 mb-1">{T.card1Title}</h2>
          <p className="text-sm text-slate-600 leading-snug">
            {T.card1Body}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-3xl mb-2">⚡</div>
          <h2 className="text-base font-black text-slate-900 mb-1">{T.card2Title}</h2>
          <p className="text-sm text-slate-600 leading-snug">
            {T.card2Body}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-3xl mb-2">☀️</div>
          <h2 className="text-base font-black text-slate-900 mb-1">{T.card3Title}</h2>
          <p className="text-sm text-slate-600 leading-snug">
            {T.card3Body}
          </p>
        </div>
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-emerald-900 mb-3">{T.esgTitle}</h2>
        <ul className="space-y-2 text-sm text-emerald-800">
          <li>{T.esgBullet1}</li>
          <li>{T.esgBullet2}</li>
          <li>{T.esgBullet3}</li>
          <li>{T.esgBullet4}</li>
          <li>{T.esgBullet5}</li>
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-slate-900 mb-3">{T.differentTitle}</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          {T.differentBody}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/education" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">{T.backBasicsBtn}</Link>
        <Link href="/sustainability" className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">{T.seeSustainabilityBtn}</Link>
      </div>
    </div>
  );
}
