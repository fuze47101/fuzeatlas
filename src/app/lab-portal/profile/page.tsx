"use client";
import { useEffect, useState } from "react";
import FormField from "@/components/FormField";

export default function LabProfilePage() {
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lab-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setData(j);
          setProfile(j.lab);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/lab-portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const j = await res.json();
      if (j.ok) {
        setSuccess("Profile updated!");
        setTimeout(() => setSuccess(""), 4000);
      } else setError(j.error);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const update = (field: string, value: string) => setProfile({ ...profile, [field]: value });

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">Unable to load</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Lab Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Update your laboratory information visible to FUZE and customers.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
            Location & contact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "address", label: "Address", placeholder: "123 Lab Street" },
              { key: "city", label: "City", placeholder: "Hong Kong" },
              { key: "state", label: "State / Province", placeholder: "" },
              { key: "country", label: "Country", placeholder: "Hong Kong" },
              { key: "websiteUrl", label: "Website", placeholder: "https://..." },
              { key: "email", label: "Contact Email", placeholder: "lab@company.com" },
              { key: "phone", label: "Phone", placeholder: "+852..." },
              { key: "timezone", label: "Timezone (IANA)", placeholder: "Asia/Taipei" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={profile[field.key] || ""}
                  onChange={(e) => update(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
            Operations contact
          </h2>
          <p className="text-xs text-slate-600 mb-3">
            Day-to-day point of contact at your lab — who FUZE pings about
            specific shipments, sample status, and report uploads.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                key: "opsContactName",
                label: "Name",
                required: true,
                helper: "Person FUZE ops reaches out to first",
              },
              {
                key: "opsContactEmail",
                label: "Email",
                helper: "We CC this on every shipment + result",
                validator: (v: string) =>
                  v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Not a valid email" : null,
              },
              {
                key: "opsContactPhone",
                label: "Phone",
                helper: "Optional — used only on time-sensitive escalations",
              },
            ].map((field) => {
              const value = profile[field.key] || "";
              const err = field.validator ? field.validator(value) : null;
              return (
                <FormField
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  helperText={field.helper}
                  error={err}
                >
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => update(field.key, e.target.value)}
                    aria-invalid={!!err}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
                  />
                </FormField>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
            Capabilities & accreditations
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Accreditations (free-text — ISO 17025, TAF, CNAS, etc.)
            </label>
            <input
              type="text"
              value={profile.accreditations || ""}
              onChange={(e) => update("accreditations", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
              placeholder="ISO 17025, TAF, CNAS"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Notes
            </label>
            <textarea
              value={profile.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:outline-none"
              placeholder="Anything FUZE ops should know — capacity, busy seasons, equipment downtime windows…"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50 shadow-lg shadow-[#00b4c3]/30"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
