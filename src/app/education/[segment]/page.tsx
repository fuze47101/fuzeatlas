import Link from "next/link";
import { notFound } from "next/navigation";
import { getSegmentConfig, listSegments } from "@/lib/education-segments";

/**
 * /education/[segment] — segment-specific FUZE education landing.
 *
 * Phase 2 of ROADMAP_v2 (Andrew, May 2026). The /education page is
 * the universal science primer. These segment pages are pitch tools:
 * one paragraph of context, the right tier ladder for the audience,
 * the test stack that matters, regulatory checkmarks, and an outreach
 * hook the AM can paste into an email.
 *
 * Page-per-segment was rejected as duplicative. This route plus
 * src/lib/education-segments.ts drives every segment off one config.
 *
 * Next.js 15 — params are Promises. Don't forget the await.
 */

export async function generateStaticParams() {
  return listSegments().map((s) => ({ segment: s.slug }));
}

export default async function EducationSegmentPage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;
  const cfg = getSegmentConfig(segment);
  if (!cfg) notFound();

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Crumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/education" className="hover:text-emerald-700">
          Education
        </Link>
        <span>›</span>
        <span className="text-slate-700 font-semibold">{cfg.title}</span>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-emerald-900 text-white rounded-2xl p-6 md:p-8">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
          FUZE for {cfg.title}
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{cfg.hero}</h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 max-w-3xl">{cfg.audience}</p>
      </div>

      {/* Body */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Why FUZE for {cfg.title}
        </h2>
        <div className="space-y-4 text-sm md:text-base text-slate-700 leading-relaxed">
          {cfg.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* Recommended tiers */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Recommended FUZE tiers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cfg.recommendedTiers.map((rt) => (
            <div
              key={rt.tier}
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
            >
              <div className="flex items-baseline gap-2">
                <span className="inline-flex w-10 h-10 rounded-lg bg-emerald-600 text-white text-base font-black items-center justify-center shadow">
                  {rt.tier}
                </span>
                <span className="text-sm font-bold text-emerald-900">{rt.tier}</span>
              </div>
              <p className="text-sm text-emerald-900 mt-3 leading-snug">{rt.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tests */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Tests that matter for this segment
        </h2>
        <div className="space-y-3">
          {cfg.primaryTests.map((t) => (
            <div key={t.test} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-base font-black text-slate-900">{t.test}</div>
              <p className="text-sm text-slate-700 mt-1 leading-snug">{t.why}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          See <Link href="/education#testing" className="text-emerald-700 underline">the full test methodology breakdown</Link> for context on how each test works mechanically.
        </p>
      </section>

      {/* Proof points */}
      {cfg.proofPoints.length > 0 ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Proof points
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cfg.proofPoints.map((p) => (
              <div key={p.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  {p.label}
                </div>
                <div className="text-base font-black text-slate-900 mt-0.5">{p.value}</div>
                {p.blurb ? (
                  <p className="text-[11px] text-slate-500 leading-snug mt-1">{p.blurb}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Regulatory */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Regulatory checkmarks
        </h2>
        <div className="flex flex-wrap gap-2">
          {cfg.primaryRegulatory.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 text-xs font-semibold"
            >
              ✓ {r}
            </span>
          ))}
        </div>
      </section>

      {/* Outreach hook */}
      <section className="bg-slate-900 text-white rounded-2xl p-6 md:p-8">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
          Outreach hook
        </div>
        <p className="text-sm md:text-base leading-relaxed">{cfg.outreachHook}</p>
        <p className="text-xs text-slate-400 mt-3">
          Sales reps: paste into your outreach as-is, or tailor the first sentence to the recipient.
        </p>
      </section>

      {/* CTAs + cross-segment links */}
      <section className="space-y-4">
        {cfg.ctas && cfg.ctas.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {cfg.ctas.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="inline-flex items-center px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow"
              >
                {c.label}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Other segments
          </div>
          <div className="flex flex-wrap gap-2">
            {listSegments()
              .filter((s) => s.slug !== cfg.slug)
              .map((s) => (
                <Link
                  key={s.slug}
                  href={`/education/${s.slug}`}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-800"
                >
                  {s.title}
                </Link>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
