"use client";
import { useState } from "react";

interface CreateInlineFormProps {
  entityType: "brand" | "factory" | "fabric";
  prefillName?: string;
  onCreated: (entity: { id: string; name: string }) => void;
  onCancel: () => void;
}

export default function CreateInlineForm({
  entityType,
  prefillName = "",
  onCreated,
  onCancel,
}: CreateInlineFormProps) {
  const [name, setName] = useState(prefillName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type-specific optional fields
  const [country, setCountry] = useState("");
  const [millType, setMillType] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [construction, setConstruction] = useState("");
  const [color, setColor] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let endpoint = "";
      let payload: Record<string, any> = {};

      if (entityType === "brand") {
        endpoint = "/api/brands";
        payload = {
          name: name.trim(),
          customerType: customerType || undefined,
          pipelineStage: "LEAD",
        };
      } else if (entityType === "factory") {
        endpoint = "/api/factories";
        payload = {
          name: name.trim(),
          country: country || undefined,
          millType: millType || undefined,
        };
      } else {
        endpoint = "/api/fabrics";
        payload = {
          customerCode: name.trim(),
          construction: construction || undefined,
          color: color || undefined,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to create");
        return;
      }

      // Extract the created entity — API patterns vary slightly
      const created = data.brand || data.factory || data.fabric || data;
      onCreated({
        id: created.id,
        name: entityType === "fabric"
          ? (created.customerCode || created.fuzeNumber || name.trim())
          : (created.name || name.trim()),
      });
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setSaving(false);
    }
  };

  const titles: Record<string, string> = {
    brand: "Create New Brand",
    factory: "Create New Factory",
    fabric: "Create New Fabric",
  };

  const themeColors: Record<string, { bg: string; border: string; title: string }> = {
    brand: { bg: "bg-purple-50", border: "border-purple-200", title: "text-purple-900" },
    factory: { bg: "bg-amber-50", border: "border-amber-200", title: "text-amber-900" },
    fabric: { bg: "bg-cyan-50", border: "border-cyan-200", title: "text-cyan-900" },
  };

  const theme = themeColors[entityType];

  return (
    <div className={`mt-3 p-4 rounded-lg border ${theme.bg} ${theme.border}`}>
      <h4 className={`text-sm font-semibold ${theme.title} mb-3`}>
        {titles[entityType]}
      </h4>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Name — always shown */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {entityType === "fabric" ? "Fabric Code / Name" : "Name"} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={entityType === "fabric" ? "e.g. FZ-1234 or Jersey Knit" : `Enter ${entityType} name`}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Type-specific fields */}
        {entityType === "brand" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Customer Type
            </label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="Brand">Brand</option>
              <option value="Retailer">Retailer</option>
              <option value="Distributor">Distributor</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}

        {entityType === "factory" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. China, Taiwan"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mill Type
              </label>
              <input
                type="text"
                value={millType}
                onChange={(e) => setMillType(e.target.value)}
                placeholder="e.g. Knit, Woven"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {entityType === "fabric" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Construction
              </label>
              <input
                type="text"
                value={construction}
                onChange={(e) => setConstruction(e.target.value)}
                placeholder="e.g. Jersey, Twill"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Color
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. White, Navy"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Creating..." : `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
