"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type CompanyType = "BRAND" | "FACTORY" | "LAB" | "DISTRIBUTOR";

interface Props {
  open: boolean;
  onClose: () => void;
  initialType?: CompanyType;
  onCreated?: (type: CompanyType, record: { id: string; name: string }) => void;
}

const TYPE_META: Record<
  CompanyType,
  {
    label: string;
    emoji: string;
    description: string;
    apiPath: string;
    detailPath: (id: string) => string;
  }
> = {
  BRAND: {
    label: "Brand",
    emoji: "🏷️",
    description: "Customer buying FUZE-treated fabric",
    apiPath: "/api/brands",
    detailPath: (id) => `/brands/${id}`,
  },
  FACTORY: {
    label: "Factory / Mill",
    emoji: "🏭",
    description: "Manufacturing partner",
    apiPath: "/api/factories",
    detailPath: (id) => `/factories/${id}`,
  },
  LAB: {
    label: "Lab",
    emoji: "🧪",
    description: "Testing partner (ITS, Bureau Veritas, etc.)",
    apiPath: "/api/labs",
    detailPath: (id) => `/labs/${id}`,
  },
  DISTRIBUTOR: {
    label: "Distributor",
    emoji: "🌍",
    description: "Regional reseller / agent",
    apiPath: "/api/distributors",
    detailPath: (id) => `/distributor-portal?distributorId=${id}`,
  },
};

const BRAND_STAGES = [
  "LEAD",
  "PRESENTATION",
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
];

export default function AddCompanyModal({ open, onClose, initialType, onCreated }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [type, setType] = useState<CompanyType | null>(initialType || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Record<string, any>>({});
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setType(initialType || null);
      setForm({});
      setError(null);
    }
  }, [open, initialType]);

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    const name = (form.name || "").toString().trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(TYPE_META[type].apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || `Failed to create ${TYPE_META[type].label}`);
        setSaving(false);
        return;
      }
      const record = j.brand || j.factory || j.lab || j.distributor || { id: "", name };
      toast.success(`${TYPE_META[type].label} "${record.name || name}" created`);
      if (onCreated) onCreated(type, { id: record.id, name: record.name || name });
      onClose();
      if (record.id) router.push(TYPE_META[type].detailPath(record.id));
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl my-4 sm:my-12"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {type ? `New ${TYPE_META[type].label}` : "Add Company"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {type
                ? "Fill in the basics — you can edit the rest later."
                : "Pick what kind of company you're adding."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Type picker */}
        {!type && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(TYPE_META) as CompanyType[]).map((k) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className="text-left p-4 rounded-lg border-2 border-slate-200 hover:border-cyan-500 hover:bg-cyan-50 transition"
              >
                <div className="text-2xl mb-2">{TYPE_META[k].emoji}</div>
                <div className="font-bold text-slate-900">{TYPE_META[k].label}</div>
                <div className="text-xs text-slate-500 mt-1">{TYPE_META[k].description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        {type && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {!initialType && (
              <button
                type="button"
                onClick={() => setType(null)}
                className="text-xs text-cyan-700 hover:underline"
              >
                ← change type
              </button>
            )}

            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {error}
              </div>
            )}

            {/* Common: name */}
            <Field
              label={`${TYPE_META[type].label} name`}
              required
              value={form.name || ""}
              onChange={(v) => set("name", v)}
              autoFocus
            />

            {/* BRAND-specific */}
            {type === "BRAND" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Website"
                    value={form.website || ""}
                    onChange={(v) => set("website", v)}
                    placeholder="https://..."
                  />
                  <Select
                    label="Pipeline stage"
                    value={form.pipelineStage || "LEAD"}
                    onChange={(v) => set("pipelineStage", v)}
                    options={BRAND_STAGES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Customer type"
                    value={form.customerType || ""}
                    onChange={(v) => set("customerType", v)}
                    placeholder="Apparel, Hospitality…"
                  />
                  <Field
                    label="Referral source"
                    value={form.leadReferralSource || ""}
                    onChange={(v) => set("leadReferralSource", v)}
                  />
                </div>
              </>
            )}

            {/* FACTORY-specific */}
            {type === "FACTORY" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Country"
                    value={form.country || ""}
                    onChange={(v) => set("country", v)}
                  />
                  <Field label="City" value={form.city || ""} onChange={(v) => set("city", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Mill type"
                    value={form.millType || ""}
                    onChange={(v) => set("millType", v)}
                    placeholder="Knit, Woven, Non-woven…"
                  />
                  <Field
                    label="Specialty"
                    value={form.specialty || ""}
                    onChange={(v) => set("specialty", v)}
                  />
                </div>
              </>
            )}

            {/* LAB-specific */}
            {type === "LAB" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Country"
                    value={form.country || ""}
                    onChange={(v) => set("country", v)}
                  />
                  <Field label="City" value={form.city || ""} onChange={(v) => set("city", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Email"
                    value={form.email || ""}
                    onChange={(v) => set("email", v)}
                    type="email"
                  />
                  <Field label="Phone" value={form.phone || ""} onChange={(v) => set("phone", v)} />
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs pt-1">
                  {[
                    { k: "icpApproved", label: "ICP" },
                    { k: "abApproved", label: "AM" },
                    { k: "fungalApproved", label: "Fungal" },
                    { k: "odorApproved", label: "Odor" },
                    { k: "uvApproved", label: "UV" },
                  ].map((c) => (
                    <label
                      key={c.k}
                      className="flex items-center gap-1.5 bg-slate-50 border rounded px-2 py-1.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form[c.k])}
                        onChange={(e) => set(c.k, e.target.checked)}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* DISTRIBUTOR-specific */}
            {type === "DISTRIBUTOR" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Country"
                    value={form.country || ""}
                    onChange={(v) => set("country", v)}
                  />
                  <Field
                    label="Region"
                    value={form.region || ""}
                    onChange={(v) => set("region", v)}
                    placeholder="South Asia, MENA…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Email"
                    value={form.email || ""}
                    onChange={(v) => set("email", v)}
                    type="email"
                  />
                  <Field label="Phone" value={form.phone || ""} onChange={(v) => set("phone", v)} />
                </div>
                <Field
                  label="Coverage countries (comma-separated)"
                  value={form.coverageCountries || ""}
                  onChange={(v) => set("coverageCountries", v)}
                  placeholder="India, Bangladesh, Sri Lanka"
                />
              </>
            )}

            <Textarea
              label="Notes"
              value={form.notes || form.backgroundInfo || ""}
              onChange={(v) => {
                if (type === "BRAND") set("backgroundInfo", v);
                else set("notes", v);
              }}
              rows={2}
            />

            <div className="flex items-center gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 hover:bg-slate-50"
                disabled={saving}
              >
                Cancel
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                disabled={saving || !(form.name || "").trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-bold bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Creating…" : `Create ${TYPE_META[type].label}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Tiny field helpers ──────────────────────────────────
function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700 block mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700 block mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows || 3}
        className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700 block mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
