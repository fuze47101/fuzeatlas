"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/Toast";
import { CAPABILITY_GROUPS, FACTORY_COUNTRIES } from "@/lib/factory-capabilities";

export default function NewFactoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", chineseName: "", millType: "", specialty: "",
    email: "", website: "", address: "", country: "",
    secondaryCountry: "", development: "", customerType: "", brandNominated: "",
  });
  const [capabilities, setCapabilities] = useState<string[]>([]);

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));
  const toggleCap = (id: string) =>
    setCapabilities((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t.factories.nameRequired);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, capabilities }),
      });
      const j = await res.json();
      if (j.ok) {
        toast.success(`Factory "${form.name}" created`);
        router.push(`/factories/${j.factory.id}`);
      } else setError(j.error || t.factories.failedToCreateFactory);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const TEXT_FIELDS: [string, string, boolean][] = [
    [t.factories.factoryName, "name", true],
    [t.factories.chineseName, "chineseName", false],
    [t.factories.millType, "millType", false],
    [t.factories.specialty, "specialty", false],
    [t.factories.contactEmail, "email", false],
    [t.factories.websiteLabel, "website", false],
    [t.factories.development, "development", false],
    [t.factories.customerType, "customerType", false],
    [t.factories.brandNominated, "brandNominated", false],
  ];

  return (
    <div className="max-w-[800px] mx-auto">
      <button onClick={() => router.push("/factories")} className="text-sm text-blue-600 hover:underline mb-2 block">
        &larr; {t.factories.backToFactories}
      </button>
      <h1 className="text-2xl font-black text-slate-900 mb-6">{t.factories.addNewFactory}</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {TEXT_FIELDS.map(([label, field, req]) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
              <input
                type={field === "email" ? "email" : "text"}
                value={(form as any)[field]}
                onChange={(e) => set(field, e.target.value)}
                required={req}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          {/* Country — separate select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.country}</label>
            <select
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">—</option>
              {FACTORY_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.secondaryCountry}</label>
            <select
              value={form.secondaryCountry}
              onChange={(e) => set("secondaryCountry", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">—</option>
              {FACTORY_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Full address — single textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.fullAddress}</label>
          <textarea
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            rows={3}
            placeholder={t.factories.fullAddressPlaceholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Capability checkboxes grouped A–I */}
        <div className="border-t pt-4">
          <h2 className="text-sm font-bold text-slate-800 mb-1">{t.factories.capabilitiesTitle}</h2>
          <p className="text-xs text-slate-500 mb-3">{t.factories.capabilitiesHint}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAPABILITY_GROUPS.map((g) => (
              <div key={g.key} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-bold text-slate-700 mb-2">
                  {g.icon} {g.label}
                </div>
                <div className="space-y-1">
                  {g.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={capabilities.includes(o.id)}
                        onChange={() => toggleCap(o.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => router.push("/factories")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? t.common.creating : t.factories.createFactory}
          </button>
        </div>
      </form>
    </div>
  );
}
