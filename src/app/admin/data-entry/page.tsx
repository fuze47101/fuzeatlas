"use client";

/**
 * /admin/data-entry — Phase 14D.
 *
 * Single page with focused mini-forms that each do one thing fast.
 * Replaces clicking through 5 different pages to wire up a new
 * brand + spec + supply chain + pricing tier + factory invite.
 *
 * Each section is intentionally minimal — the goal is one happy
 * path per task. For richer editing the user still goes to the
 * per-entity page.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/i18n";

interface BrandLite {
  id: string;
  name: string;
}
interface FactoryLite {
  id: string;
  name: string;
}
interface LabLite {
  id: string;
  name: string;
}

export default function DataEntryHubPage() {
  const { t } = useI18n();
  const T = t.dataEntryAdmin;
  const { success, error: toastErr } = useToast();
  const [brands, setBrands] = useState<BrandLite[]>([]);
  const [factories, setFactories] = useState<FactoryLite[]>([]);
  const [labs, setLabs] = useState<LabLite[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/brand-pipeline?view=all&limit=500")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/factories?limit=500")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/labs")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([bp, fac, lab]) => {
      if (bp?.brands) setBrands(bp.brands);
      else if (Array.isArray(bp?.rows)) setBrands(bp.rows);
      if (Array.isArray(fac?.factories)) setFactories(fac.factories);
      else if (Array.isArray(fac)) setFactories(fac);
      if (Array.isArray(lab?.labs)) setLabs(lab.labs);
      else if (Array.isArray(lab)) setLabs(lab);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[{ label: T.crumbAdmin }, { label: T.crumbCurrent }]}
      />
      <h1 className="text-2xl font-black text-slate-900">{T.title}</h1>
      <p className="text-sm text-slate-600 mt-1 mb-6">
        {T.subtitle}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BrandSpecCard brands={brands} onDone={(name) => success(T.toastSpecSavedTpl.replace("{name}", name))} onError={(m) => toastErr(m)} />
        <PricingTierCard brands={brands} onDone={(label) => success(T.toastPricingSavedTpl.replace("{label}", label))} onError={(m) => toastErr(m)} />
        <SupplyChainLinkCard brands={brands} factories={factories} onDone={(b, f) => success(T.toastLinkedTpl.replace("{brand}", b).replace("{factory}", f))} onError={(m) => toastErr(m)} />
        <LabTestCatalogCard labs={labs} onDone={(test) => success(T.toastCatalogSavedTpl.replace("{test}", test))} onError={(m) => toastErr(m)} />
      </div>

      <div className="mt-8 text-xs text-slate-500">
        <p className="font-bold mb-1">{T.cliHeader}</p>
        <pre className="bg-slate-900 text-slate-200 p-3 rounded text-[11px] overflow-x-auto">
{`npm run seed:brand-spec        -- --brand "KUIU" --tier F2 --cadence-batches 5
npm run seed:pricing-tier      -- --brand "KUIU" --threshold 1000 --discount 5 --label Bronze
npm run seed:supply-chain-link -- --brand "KUIU" --factory "BesTex"
npm run seed:factory-invitation -- --brand "KUIU" --factory-name "X" --email Y
npm run seed:lab-test-catalog  -- --lab "ITS Taiwan" --test AATCC_100 --protocol "AATCC 100" --fuze-cost 87 --published 120`}
        </pre>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold text-slate-900 mb-1">{title}</h2>
      {hint && <p className="text-xs text-slate-600 mb-3">{hint}</p>}
      {children}
    </div>
  );
}

function BrandSpecCard({
  brands,
  onDone,
  onError,
}: {
  brands: BrandLite[];
  onDone: (name: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useI18n();
  const T = t.dataEntryAdmin;
  const [brandId, setBrandId] = useState("");
  const [tier, setTier] = useState("F2");
  const [cadenceBatches, setCadenceBatches] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!brandId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiredFuzeTier: tier,
          icpCadenceEveryNBatches: cadenceBatches ? Number(cadenceBatches) : null,
          protocolDocUrl: protocolUrl || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || T.errSave);
      onDone(brands.find((b) => b.id === brandId)?.name || T.fallbackBrand);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={T.secSpecTitle}
      hint={T.secSpecHint}
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option value="">{T.pickBrand}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option>F1</option>
          <option>F2</option>
          <option>F3</option>
          <option>F4</option>
        </select>
        <input
          type="number"
          placeholder={T.cadenceBatchesPlaceholder}
          value={cadenceBatches}
          onChange={(e) => setCadenceBatches(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <input
          type="url"
          placeholder={T.protocolDocUrlPlaceholder}
          value={protocolUrl}
          onChange={(e) => setProtocolUrl(e.target.value)}
          className="sm:col-span-3 px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <button
          onClick={save}
          disabled={saving || !brandId}
          className="px-3 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold disabled:opacity-50 focus-ring"
        >
          {saving ? T.savingDots : T.saveBtn}
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">
        {T.secSpecDeepLinkPrefix}<Link href="/brand-portal/spec" className="text-[#00b4c3] hover:underline">/brand-portal/spec</Link>
      </p>
    </Section>
  );
}

function PricingTierCard({
  brands,
  onDone,
  onError,
}: {
  brands: BrandLite[];
  onDone: (label: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useI18n();
  const T = t.dataEntryAdmin;
  const [brandId, setBrandId] = useState("");
  const [threshold, setThreshold] = useState("");
  const [discount, setDiscount] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!brandId || !threshold || !discount || !label) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/brand-pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          thresholdLiters: Number(threshold),
          discountPct: Number(discount),
          label,
          active: true,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || T.errSave);
      onDone(label);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={T.secPricingTitle} hint={T.secPricingHint}>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option value="">{T.pickBrand}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder={T.thresholdPlaceholder}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <input
          type="number"
          placeholder={T.discountPlaceholder}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <input
          type="text"
          placeholder={T.pricingLabelPlaceholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="sm:col-span-3 px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold disabled:opacity-50 focus-ring"
        >
          {saving ? T.savingDots : T.saveBtn}
        </button>
      </div>
    </Section>
  );
}

function SupplyChainLinkCard({
  brands,
  factories,
  onDone,
  onError,
}: {
  brands: BrandLite[];
  factories: FactoryLite[];
  onDone: (b: string, f: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useI18n();
  const T = t.dataEntryAdmin;
  const [brandId, setBrandId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!brandId || !factoryId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/supply-chain-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromType: "BRAND",
          fromId: brandId,
          toType: "FACTORY",
          toId: factoryId,
          relationship: "SUPPLIES",
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || T.errSave);
      const b = brands.find((x) => x.id === brandId)?.name || T.fallbackBrand;
      const f = factories.find((x) => x.id === factoryId)?.name || T.fallbackFactory;
      onDone(b, f);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={T.secLinkTitle} hint={T.secLinkHint}>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option value="">{T.pickBrandShort}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={factoryId}
          onChange={(e) => setFactoryId(e.target.value)}
          className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option value="">{T.pickFactory}</option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold disabled:opacity-50 focus-ring"
        >
          {saving ? T.savingDots : T.linkBtn}
        </button>
      </div>
    </Section>
  );
}

function LabTestCatalogCard({
  labs,
  onDone,
  onError,
}: {
  labs: LabLite[];
  onDone: (testType: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useI18n();
  const T = t.dataEntryAdmin;
  const [labId, setLabId] = useState("");
  const [testType, setTestType] = useState("AATCC_100");
  const [protocolName, setProtocolName] = useState("");
  const [fuzeCost, setFuzeCost] = useState("");
  const [published, setPublished] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!labId || !protocolName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/lab-portal/lab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          testType,
          protocolName,
          fuzeCostUsd: fuzeCost ? Number(fuzeCost) : null,
          publishedPriceUsd: published ? Number(published) : null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || T.errSave);
      onDone(testType);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={T.secLabTitle} hint={T.secLabHint}>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <select
          value={labId}
          onChange={(e) => setLabId(e.target.value)}
          className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option value="">{T.pickLab}</option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          value={testType}
          onChange={(e) => setTestType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        >
          <option>ICP_MS</option>
          <option>AATCC_100</option>
          <option>ASTM_E2149</option>
          <option>AATCC_30</option>
          <option>ISO_18184</option>
          <option>ISO_20743</option>
        </select>
        <input
          type="text"
          placeholder={T.protocolNamePlaceholder}
          value={protocolName}
          onChange={(e) => setProtocolName(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold disabled:opacity-50 focus-ring"
        >
          {saving ? T.savingDots : T.saveBtn}
        </button>
        <input
          type="number"
          placeholder={T.fuzeCostPlaceholder}
          value={fuzeCost}
          onChange={(e) => setFuzeCost(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <input
          type="number"
          placeholder={T.publishedPricePlaceholder}
          value={published}
          onChange={(e) => setPublished(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
      </div>
    </Section>
  );
}
