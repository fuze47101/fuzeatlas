/**
 * /education/application — Application Methods
 *
 * Andrew (2026-05-04, expert-marketer note): "Will I need new equipment?" is
 * the #1 unspoken factory question. This page answers it. Three methods,
 * standard finishing equipment, no curing oven required for F4.
 */

import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";

export const metadata = {
  title: "Application Methods",
};

export default async function ApplicationPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).educationApplication;

  const METHODS = [
    {
      id: "exhaust",
      name: T.methodExhaustName,
      icon: "🛁",
      description: T.methodExhaustDesc,
      whenToUse: T.methodExhaustWhen,
    },
    {
      id: "pdc",
      name: T.methodPdcName,
      icon: "🧻",
      description: T.methodPdcDesc,
      whenToUse: T.methodPdcWhen,
    },
    {
      id: "spray",
      name: T.methodSprayName,
      icon: "🌫️",
      description: T.methodSprayDesc,
      whenToUse: T.methodSprayWhen,
    },
  ];

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
        {METHODS.map((m) => (
          <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-3xl mb-2">{m.icon}</div>
            <h2 className="text-base font-black text-slate-900 mb-1">{m.name}</h2>
            <p className="text-sm text-slate-700 mb-3 leading-snug">{m.description}</p>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{T.whenToUseLabel}</div>
            <p className="text-xs text-slate-600 leading-snug">{m.whenToUse}</p>
          </div>
        ))}
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-emerald-900 mb-3">{T.operatorTitle}</h2>
        <ul className="space-y-2 text-sm text-emerald-800">
          <li>{T.operatorBullet1}</li>
          <li>{T.operatorBullet2}</li>
          <li>{T.operatorBullet3}</li>
          <li>{T.operatorBullet4}</li>
          <li>{T.operatorBullet5}</li>
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-xl font-black text-slate-900 mb-3">{T.runNumbersTitle}</h2>
        <p className="text-sm text-slate-700 mb-4">
          {T.runNumbersBody}
        </p>
        <Link
          href="/pricing/calculator"
          className="inline-flex items-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          {T.runNumbersCta}
        </Link>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/education" className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">{T.backBasicsBtn}</Link>
        <Link href="/pricing" className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">{T.seePricingBtn}</Link>
      </div>
    </div>
  );
}
