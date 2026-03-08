"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/Toast";

export default function NewFactoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", chineseName: "", millType: "", specialty: "", purchasing: "",
    annualSales: "", address: "", city: "", state: "", country: "",
    secondaryCountry: "", development: "", customerType: "", brandNominated: "",
  });

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t.factories.nameRequired); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/factories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.ok) { toast.success(`Factory "${form.name}" created`); router.push(`/factories/${j.factory.id}`); }
      else setError(j.error || t.factories.failedToCreateFactory);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-[800px] mx-auto">
      <button onClick={() => router.push("/factories")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; {t.factories.backToFactories}</button>
      <h1 className="text-2xl font-black text-slate-900 mb-6">{t.factories.addNewFactory}</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            [t.factories.factoryName, "name", true], [t.factories.chineseName, "chineseName", false],
            [t.factories.millType, "millType", false], [t.factories.specialty, "specialty", false],
            [t.factories.purchasing, "purchasing", false], [t.factories.annualSales, "annualSales", false],
            [t.factories.address, "address", false], [t.factories.city, "city", false],
            [t.factories.state, "state", false], [t.factories.country, "country", false],
            [t.factories.secondaryCountry, "secondaryCountry", false], [t.factories.development, "development", false],
            [t.factories.customerType, "customerType", false], [t.factories.brandNominated, "brandNominated", false],
          ].map(([label, field, req]) => (
            <div key={field as string}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{label as string}</label>
              <input type="text" value={(form as any)[field as string]} onChange={e => set(field as string, e.target.value)} required={req as boolean}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => router.push("/factories")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">{t.common.cancel}</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? t.common.creating : t.factories.createFactory}
          </button>
        </div>
      </form>
    </div>
  );
}
