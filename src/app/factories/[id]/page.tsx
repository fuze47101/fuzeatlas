"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import {
  ALL_TAG_CATEGORIES,
  parseTags,
  getTagLabel,
  calcProfileCompleteness,
} from "@/lib/factoryDiscovery";
import {
  CAPABILITY_GROUPS,
  FACTORY_COUNTRIES,
  parseCapabilities,
  groupCapabilities,
} from "@/lib/factory-capabilities";
import ActivityFeed from "@/components/ActivityFeed";

const NOTE_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING", "TASK", "FOLLOW_UP"];

// Item 11b — coarse factory category display labels.
const CATEGORY_LABELS: Record<string, string> = {
  GARMENT: "Garment",
  DYE_FINISH: "Dye & Finish",
  KNIT_WEAVE: "Knit / Weave",
};

export default function FactoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  // Item 11a — brand viewers see a customer-safe detail page: no internal
  // count cards, no edit/delete, a prominent Contact Us action instead.
  const isBrandViewer = user?.role === "BRAND_USER";
  const [factory, setFactory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<any>({});
  const [tab, setTab] = useState<
    | "details"
    | "discovery"
    | "activity"
    | "brands"
    | "fabrics"
    | "submissions"
    | "tests"
    | "contacts"
  >("details");
  const [users, setUsers] = useState<any[]>([]);
  // Tests state
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  // Brand linking
  const [allBrands, setAllBrands] = useState<any[]>([]);
  const [showLinkBrand, setShowLinkBrand] = useState(false);
  const [linkBrandId, setLinkBrandId] = useState("");
  // Delete
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminCode, setAdminCode] = useState("");

  useEffect(() => {
    fetch(`/api/factories/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setFactory(j.factory);
          const f = j.factory;
          setForm({
            name: f.name || "",
            chineseName: f.chineseName || "",
            millType: f.millType || "",
            specialty: f.specialty || "",
            email: f.email || "",
            website: f.website || "",
            address: f.address || "",
            country: f.country || "",
            secondaryCountry: f.secondaryCountry || "",
            development: f.development || "",
            customerType: f.customerType || "",
            brandNominated: f.brandNominated || "",
            salesRepId: f.salesRepId || "",
            capabilities: parseCapabilities(f.capabilities),
          });
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/users")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setUsers(j.users);
      })
      .catch(() => {});
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/factories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        setFactory({ ...factory, ...j.factory });
        setEditing(false);
        setSuccess(t.factories.factoryUpdated);
        setTimeout(() => setSuccess(""), 3000);
      } else setError(j.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/factories/${id}?code=${encodeURIComponent(adminCode)}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (j.ok) {
        router.push("/factories");
      } else {
        setError(j.error || "Failed to delete factory");
        setShowDeleteConfirm(false);
      }
    } catch (e: any) {
      setError(e.message);
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const res = await fetch(`/api/tests/by-entity?factoryId=${id}`);
      const j = await res.json();
      if (j.ok) setTestRuns(j.testRuns);
    } catch {
    } finally {
      setTestsLoading(false);
    }
  };

  const loadBrands = async () => {
    if (allBrands.length > 0) return;
    try {
      const res = await fetch("/api/brands");
      const j = await res.json();
      if (j.ok) setAllBrands(j.brands);
    } catch {}
  };

  useEffect(() => {
    if (tab === "tests" && testRuns.length === 0) loadTests();
    if (tab === "brands") loadBrands();
  }, [tab]);

  const handleLinkBrand = async () => {
    if (!linkBrandId) return;
    try {
      const res = await fetch("/api/brand-factory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: linkBrandId, factoryId: id }),
      });
      const j = await res.json();
      if (j.ok) {
        setFactory({
          ...factory,
          brands: [...factory.brands, j.link],
          _count: { ...factory._count, brands: factory._count.brands + 1 },
        });
        setShowLinkBrand(false);
        setLinkBrandId("");
      } else setError(j.error);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUnlinkBrand = async (linkId: string) => {
    if (!confirm("Remove this brand link?")) return;
    try {
      const res = await fetch(`/api/brand-factory?id=${linkId}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) {
        setFactory({
          ...factory,
          brands: (factory.brands || []).filter((bf: any) => bf.id !== linkId),
          _count: { ...factory._count, brands: factory._count.brands - 1 },
        });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {t.factories.loadingFactory}
      </div>
    );
  if (!factory)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {t.factories.factoryNotFound}
      </div>
    );

  const c = factory._count;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/factories")}
            className="text-sm text-blue-600 hover:underline mb-1 block"
          >
            &larr; {t.factories.backToFactories}
          </button>
          <h1 className="text-2xl font-black text-slate-900">{factory.name}</h1>
          {factory.chineseName && <p className="text-sm text-slate-500">{factory.chineseName}</p>}
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            {factory.country && (
              <span>
                📍 {factory.city ? `${factory.city}, ` : ""}
                {factory.country}
              </span>
            )}
            {factory.millType && <span>· {factory.millType}</span>}
            {factory.category && CATEGORY_LABELS[factory.category] && (
              <span>· {CATEGORY_LABELS[factory.category]}</span>
            )}
            {!isBrandViewer && factory.salesRep && <span>· Rep: {factory.salesRep.name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {isBrandViewer ? (
            <Link
              href="/brand-portal/contacts"
              className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8] shadow-sm"
            >
              {t.factories.contactUs}
            </Link>
          ) : !editing ? (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100"
              >
                {t.common.delete}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                {t.common.edit}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? t.common.saving : t.common.save}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Item 11a — brand viewers get a Contact Us panel with the customer-safe
          facts (specialty, category, website) instead of internal count cards. */}
      {isBrandViewer ? (
        <div className="rounded-2xl border-2 border-[#00b4c3]/40 bg-[#00b4c3]/5 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">{t.factories.interestedTitle}</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">{t.factories.interestedBlurb}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
                {factory.specialty && (
                  <div><span className="text-slate-500">{t.factories.specialty}:</span> <span className="font-medium text-slate-800">{factory.specialty}</span></div>
                )}
                {factory.category && CATEGORY_LABELS[factory.category] && (
                  <div><span className="text-slate-500">{t.factories.categoryLabel}:</span> <span className="font-medium text-slate-800">{CATEGORY_LABELS[factory.category]}</span></div>
                )}
                {factory.website && (
                  <a href={factory.website.startsWith("http") ? factory.website : `https://${factory.website}`} target="_blank" rel="noopener noreferrer" className="text-[#00b4c3] hover:underline font-medium">
                    {t.factories.websiteLabel} ↗
                  </a>
                )}
              </div>
            </div>
            <Link
              href="/brand-portal/contacts"
              className="px-5 py-3 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8] whitespace-nowrap text-center"
            >
              {t.factories.contactUs}
            </Link>
          </div>
        </div>
      ) : (
        /* Stats row */
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            [t.factories.brands, c.brands, "🎯"],
            [t.factories.fabrics, c.fabrics, "🧵"],
            [t.dashboard.submissions, c.submissions, "📋"],
            [t.contacts.title, c.contacts, "👤"],
            [t.nav.testResults || "Tests", testRuns.length || 0, "🧪"],
          ].map(([l, v, i]) => (
            <div key={l as string} className="bg-white rounded-xl p-3 shadow-sm border text-center">
              <div className="text-lg">{i}</div>
              <div className="text-xl font-black text-slate-900">{v as number}</div>
              <div className="text-xs text-slate-500">{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
        {(
          [
            "details",
            "activity",
            "discovery",
            "brands",
            "fabrics",
            "submissions",
            "tests",
            "contacts",
          ] as const
        ).map((tabName) => {
          const tabLabels: Record<string, string> = {
            details: t.brandTabs.details,
            activity: "CRM",
            discovery: "Discovery Profile",
            brands: t.factories.brands,
            fabrics: t.factories.fabrics,
            submissions: t.dashboard.submissions || "Submissions",
            tests: t.nav.testResults || "Tests",
            contacts: t.contacts.title,
          };
          return (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === tabName ? "border-amber-600 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {tabLabels[tabName]}
            </button>
          );
        })}
      </div>

      {/* ── Details Tab ── */}
      {tab === "details" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Plain text fields */}
            {[
              [t.factories.factoryName, "name"],
              [t.factories.chineseName, "chineseName"],
              [t.factories.millType, "millType"],
              [t.factories.specialty, "specialty"],
              [t.factories.development, "development"],
              [t.factories.customerType, "customerType"],
              [t.factories.brandNominated, "brandNominated"],
            ].map(([label, field]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                {editing ? (
                  <input
                    type="text"
                    value={form[field] || ""}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="text-sm text-slate-900">{factory[field] || "—"}</div>
                )}
              </div>
            ))}

            {/* Contact Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.contactEmail}</label>
              {editing ? (
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : factory.email ? (
                <a href={`mailto:${factory.email}`} className="text-sm text-[#00b4c3] hover:underline break-all">{factory.email}</a>
              ) : (
                <div className="text-sm text-slate-900">—</div>
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.websiteLabel}</label>
              {editing ? (
                <input
                  type="text"
                  value={form.website || ""}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : factory.website ? (
                <a href={factory.website.startsWith("http") ? factory.website : `https://${factory.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#00b4c3] hover:underline break-all">{factory.website} ↗</a>
              ) : (
                <div className="text-sm text-slate-900">—</div>
              )}
            </div>

            {/* Country + secondary country as selects */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.country}</label>
              {editing ? (
                <select
                  value={form.country || ""}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {FACTORY_COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              ) : (
                <div className="text-sm text-slate-900">{factory.country || "—"}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.secondaryCountry}</label>
              {editing ? (
                <select
                  value={form.secondaryCountry || ""}
                  onChange={(e) => setForm({ ...form, secondaryCountry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {FACTORY_COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              ) : (
                <div className="text-sm text-slate-900">{factory.secondaryCountry || "—"}</div>
              )}
            </div>

            {/* Sales rep selector (internal) */}
            {!isBrandViewer && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t.brands.salesRep || "Sales Rep"}
                </label>
                {editing ? (
                  <select
                    value={form.salesRepId || ""}
                    onChange={(e) => setForm({ ...form, salesRepId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-900">{factory.salesRep?.name || "—"}</div>
                )}
              </div>
            )}
          </div>

          {/* Full address — single textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t.factories.fullAddress}</label>
            {editing ? (
              <textarea
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="text-sm text-slate-900 whitespace-pre-line">{factory.address || "—"}</div>
            )}
          </div>

          {/* Capabilities */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-bold text-slate-800 mb-1">{t.factories.capabilitiesTitle}</h3>
            {editing ? (
              <>
                <p className="text-xs text-slate-500 mb-3">{t.factories.capabilitiesHint}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CAPABILITY_GROUPS.map((g) => (
                    <div key={g.key} className="rounded-lg border border-slate-200 p-3">
                      <div className="text-xs font-bold text-slate-700 mb-2">{g.icon} {g.label}</div>
                      <div className="space-y-1">
                        {g.options.map((o) => {
                          const checked = (form.capabilities || []).includes(o.id);
                          return (
                            <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm({
                                    ...form,
                                    capabilities: checked
                                      ? (form.capabilities || []).filter((x: string) => x !== o.id)
                                      : [...(form.capabilities || []), o.id],
                                  })
                                }
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              {o.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              (() => {
                const grouped = groupCapabilities(parseCapabilities(factory.capabilities));
                if (grouped.length === 0) return <div className="text-sm text-slate-500">{t.factories.noCapabilities}</div>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {grouped.map((g) => (
                      <div key={g.key}>
                        <div className="text-xs font-bold text-slate-700 mb-1">{g.icon} {g.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.options.map((o) => (
                            <span key={o.id} className="px-2 py-0.5 rounded-full bg-[#00b4c3]/10 text-[#00b4c3] text-xs font-medium">{o.label}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── Discovery Profile Tab ── */}
      {tab === "discovery" && (
        <FactoryDiscoveryTab
          factory={factory}
          onSave={async (data: any) => {
            setSaving(true);
            setError("");
            setSuccess("");
            try {
              const res = await fetch(`/api/factories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              const j = await res.json();
              if (j.ok) {
                setFactory({ ...factory, ...j.factory });
                setSuccess("Discovery profile updated");
                setTimeout(() => setSuccess(""), 3000);
              } else setError(j.error);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setSaving(false);
            }
          }}
          saving={saving}
        />
      )}

      {/* ── Brands Tab (Enhanced with link/unlink) ── */}
      {tab === "brands" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.factories.brands}</h3>
            <button
              onClick={() => {
                setShowLinkBrand(!showLinkBrand);
                loadBrands();
              }}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
            >
              + Link Brand
            </button>
          </div>
          {showLinkBrand && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Brand
              </label>
              <div className="flex gap-2">
                <select
                  value={linkBrandId}
                  onChange={(e) => setLinkBrandId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Choose a brand...</option>
                  {allBrands
                    .filter(
                      (b: any) => !(factory.brands || []).some((bf: any) => bf.brand?.id === b.id),
                    )
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleLinkBrand}
                  disabled={!linkBrandId}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  Link
                </button>
                <button
                  onClick={() => setShowLinkBrand(false)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}
          {(factory.brands?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.factories.noBrandsLinked}</p>
          ) : (
            <div className="space-y-2">
              {(factory.brands || []).map((bf: any) => (
                <div
                  key={bf.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-amber-50 group"
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => router.push(`/brands/${bf.brand.id}`)}
                  >
                    <span className="text-lg">🔥</span>
                    <div>
                      <div className="font-semibold text-sm">{bf.brand.name}</div>
                      <span className="text-xs text-slate-500">{bf.brand.pipelineStage}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkBrand(bf.id)}
                    className="text-xs text-red-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Fabrics Tab ── */}
      {tab === "fabrics" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.factories.fabrics}</h3>
            <button
              onClick={() => router.push(`/fabrics/new?factoryId=${id}`)}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
            >
              + New Fabric
            </button>
          </div>
          {(factory.fabrics?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.factories.noFabrics}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="pb-2">{t.fabrics.fuzeNumber}</th>
                  <th className="pb-2">{t.fabrics.construction}</th>
                  <th className="pb-2">{t.fabrics.color}</th>
                  <th className="pb-2">{t.fabrics.gsm}</th>
                </tr>
              </thead>
              <tbody>
                {(factory.fabrics || []).map((f: any) => (
                  <tr
                    key={f.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => router.push(`/fabrics/${f.id}`)}
                  >
                    <td className="py-2 font-bold text-blue-600">
                      {t.fabrics.fuzeLabel} {f.fuzeNumber}
                    </td>
                    <td className="py-2">{f.construction}</td>
                    <td className="py-2">{f.color}</td>
                    <td className="py-2">{f.weightGsm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Submissions Tab (NEW) ── */}
      {tab === "submissions" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-4">
            {t.dashboard.submissions || "Submissions"}
          </h3>
          {(factory.submissions?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">
              No submissions linked to this factory yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="pb-2">Fabric #</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Test Status</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {(factory.submissions || []).map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 font-bold">FUZE {s.fuzeFabricNumber}</td>
                    <td className="py-2">{s.status || "—"}</td>
                    <td className="py-2">{s.testStatus || "—"}</td>
                    <td className="py-2 text-slate-500">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tests Tab (NEW) ── */}
      {tab === "tests" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">{t.nav.testResults || "Test Results"}</h3>
            <button onClick={loadTests} className="text-xs text-amber-600 hover:underline">
              Refresh
            </button>
          </div>
          {testsLoading ? (
            <p className="text-slate-400 text-sm text-center py-8">{t.common.loading}</p>
          ) : testRuns.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">
              No test results linked to this factory yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Fabric</th>
                  <th className="pb-2">Lab</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Result</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {testRuns.map((tr: any) => {
                  const pass = tr.icpResult
                    ? true
                    : (tr.abResult?.methodPass ??
                      tr.abResult?.pass ??
                      tr.fungalResult?.pass ??
                      tr.odorResult?.pass);
                  const typeColors: Record<string, string> = {
                    ICP: "bg-violet-100 text-violet-700",
                    ANTIBACTERIAL: "bg-blue-100 text-blue-700",
                    FUNGAL: "bg-emerald-100 text-emerald-700",
                    ODOR: "bg-amber-100 text-amber-700",
                    UV: "bg-pink-100 text-pink-700",
                  };
                  return (
                    <tr
                      key={tr.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/tests/${tr.id}`)}
                    >
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColors[tr.testType] || "bg-slate-100 text-slate-600"}`}
                        >
                          {tr.testType}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {tr.submission?.fuzeFabricNumber
                          ? `FUZE ${tr.submission.fuzeFabricNumber}`
                          : "—"}
                      </td>
                      <td className="py-2 text-xs">{tr.lab?.name || "—"}</td>
                      <td className="py-2 text-xs text-slate-600">
                        {tr.testMethodStd || tr.testMethodRaw || "—"}
                      </td>
                      <td className="py-2">
                        {pass === true && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                            PASS
                          </span>
                        )}
                        {pass === false && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
                            FAIL
                          </span>
                        )}
                        {(pass === null || pass === undefined) && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-slate-500">
                        {tr.testDate
                          ? new Date(tr.testDate).toLocaleDateString()
                          : tr.createdAt
                            ? new Date(tr.createdAt).toLocaleDateString()
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Contacts Tab ── */}
      {tab === "contacts" && (
        <FactoryContactsTab
          factoryId={id as string}
          contacts={factory.contacts}
          onUpdate={(contacts: any[]) =>
            setFactory({
              ...factory,
              contacts,
              _count: { ...factory._count, contacts: contacts.length },
            })
          }
          t={t}
        />
      )}

      {/* ── CRM Activity Tab ── */}
      {tab === "activity" && <ActivityFeed entityType="factory" entityId={id as string} />}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Factory</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete <strong>{factory.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 mb-4">
              This action cannot be undone. All linked records must be removed first.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Code</label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && adminCode) handleDelete();
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter admin code"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setAdminCode("");
                }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !adminCode}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── FactoryContactsTab — inline CRUD ──────────── */
function FactoryContactsTab({
  factoryId,
  contacts: initial,
  onUpdate,
  t,
}: {
  factoryId: string;
  contacts: any[];
  onUpdate: (c: any[]) => void;
  t: any;
}) {
  // Local router so contact rows can navigate to /contacts/[id] on click —
  // matches the brand ContactsTab behavior (ticket #54).
  const router = useRouter();
  const [contacts, setContacts] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = { firstName: "", lastName: "", title: "", email: "", phone: "", linkedinUrl: "" };
  const [form, setForm] = useState(empty);

  const sync = (updated: any[]) => {
    setContacts(updated);
    onUpdate(updated);
  };

  const handleAdd = async () => {
    if (!form.firstName.trim() && !form.email.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, factoryId }),
      });
      const j = await res.json();
      if (j.ok) {
        sync([...contacts, j.contact]);
        setForm(empty);
        setShowAdd(false);
      } else setError(j.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        sync(contacts.map((c) => (c.id === id ? j.contact : c)));
        setEditingId(null);
      } else setError(j.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) sync(contacts.filter((c) => c.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEdit = (ct: any) => {
    setEditingId(ct.id);
    setForm({
      firstName: ct.firstName || "",
      lastName: ct.lastName || "",
      title: ct.title || "",
      email: ct.email || "",
      phone: ct.phone || "",
      linkedinUrl: ct.linkedinUrl || "",
    });
  };

  /**
   * Provision an Atlas user from this contact (ticket #39). Server picks the
   * role from the contact's entity FK (factoryId here → FACTORY_USER) and emails
   * a temp password. We surface both the success message AND the temp password
   * locally so admins can read it back to the user if the welcome email bounces.
   */
  const [creatingUserFor, setCreatingUserFor] = useState<string | null>(null);
  const handleCreateAtlasUser = async (ct: any) => {
    if (!ct.email) {
      alert("Contact needs an email before you can create an Atlas user.");
      return;
    }
    if (
      !confirm(
        `Create an Atlas FACTORY_USER account for ${ct.firstName || ""} ${ct.lastName || ""} (${ct.email})?\n\nThis will email them a temporary password and require them to change it on first login.`,
      )
    ) {
      return;
    }
    setCreatingUserFor(ct.id);
    setError("");
    try {
      const res = await fetch(`/api/contacts/${ct.id}/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Failed to create user");
        return;
      }
      // Show both the message and the temp password so admin has fallback
      // if email delivery fails (and as a quick read-back even when it works).
      alert(
        j.emailSent
          ? `Atlas user created. Welcome email sent.\n\nTemp password (in case they ask): ${j.tempPassword}`
          : `Atlas user created BUT welcome email failed (${j.emailError}).\n\nShare this temp password manually:\n\n${j.tempPassword}`,
      );
    } catch (e: any) {
      setError(e.message || "Network error creating Atlas user");
    } finally {
      setCreatingUserFor(null);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-900">{t.contacts.title}</h3>
        <button
          onClick={() => {
            setShowAdd(!showAdd);
            setForm(empty);
            setEditingId(null);
          }}
          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
        >
          + {t.contacts.addContact}
        </button>
      </div>
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}
      {showAdd && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="First name"
              autoFocus
            />
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Last name"
            />
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Title/Role"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Email"
            />
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Phone"
            />
          </div>
          <div className="mb-3">
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
              LinkedIn profile URL
              <span className="ml-2 text-slate-400 normal-case font-normal">
                (paste if you found it during research)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">in</span>
              <input
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                placeholder="https://www.linkedin.com/in/jane-smith/"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? t.common.saving : t.contacts.addContact}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
      {contacts.length === 0 && !showAdd ? (
        <p className="text-slate-400 text-sm text-center py-8">{t.factories.noContacts}</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((ct: any) =>
            editingId === ct.id ? (
              <div key={ct.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="First name"
                  />
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Last name"
                  />
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Title"
                  />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Email"
                  />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Phone"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                    LinkedIn profile URL
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-sm">in</span>
                    <input
                      type="url"
                      value={form.linkedinUrl}
                      onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                      placeholder="https://www.linkedin.com/in/jane-smith/"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(ct.id)}
                    className="text-xs text-green-600 hover:underline font-semibold"
                  >
                    {saving ? "..." : t.common.save}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={ct.id}
                className="flex items-center gap-4 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg group cursor-pointer transition"
                onClick={() => router.push(`/contacts/${ct.id}`)}
                title="View contact details"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">
                  {(ct.firstName || ct.name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>
                      {ct.firstName} {ct.lastName}{" "}
                      {ct.title && <span className="text-slate-500 font-normal">({ct.title})</span>}
                    </span>
                    {/* Subtle "view contact" affordance — only visible on hover. */}
                    <span className="text-[10px] text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity font-normal">
                      View →
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {ct.email}
                    {ct.phone && ` · ${ct.phone}`}
                  </div>
                  {ct.linkedinUrl && (
                    <div className="mt-0.5">
                      <a
                        href={ct.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 hover:underline font-medium"
                        title={ct.linkedinUrl}
                      >
                        <span className="text-[10px] font-bold">in</span>
                        LinkedIn profile
                      </a>
                    </div>
                  )}
                </div>
                {/* stopPropagation keeps inline edit/delete from triggering the
                   card's navigate-to-detail click handler. */}
                <div
                  className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* "Create Atlas user" — only show when contact has an email
                     and isn't already linked to a user (we can't tell from the
                     row payload, so server returns 409 with USER_ALREADY_EXISTS
                     and we'll show that error). Ticket #39. */}
                  {ct.email && (
                    <button
                      onClick={() => handleCreateAtlasUser(ct)}
                      disabled={creatingUserFor === ct.id}
                      className="text-xs text-emerald-700 hover:underline disabled:opacity-50"
                      title={`Create Atlas factory account for ${ct.email}`}
                    >
                      {creatingUserFor === ct.id ? "Creating…" : "+ Atlas user"}
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(ct)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {t.common.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(ct.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ── FactoryDiscoveryTab — structured tags for search/discovery ── */
function FactoryDiscoveryTab({
  factory,
  onSave,
  saving,
}: {
  factory: any;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState(() => ({
    productTypes: parseTags(factory.productTypes),
    capabilities: parseTags(factory.capabilities),
    certifications: parseTags(factory.certifications),
    fabricTypes: parseTags(factory.fabricTypes),
    fuzeApplications: parseTags(factory.fuzeApplications),
    fuzeEnabled: factory.fuzeEnabled || false,
    moqMeters: factory.moqMeters || "",
    leadTimeDays: factory.leadTimeDays || "",
    capacityMtMonth: factory.capacityMtMonth || "",
    yearEstablished: factory.yearEstablished || "",
    employeeCount: factory.employeeCount || "",
    website: factory.website || "",
    description: factory.description || "",
  }));

  const toggleTag = (category: string, value: string) => {
    setForm((prev: any) => {
      const current = prev[category] || [];
      const next = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  const handleSave = () => {
    const data: any = {
      productTypes: JSON.stringify(form.productTypes),
      capabilities: JSON.stringify(form.capabilities),
      certifications: JSON.stringify(form.certifications),
      fabricTypes: JSON.stringify(form.fabricTypes),
      fuzeApplications: JSON.stringify(form.fuzeApplications),
      fuzeEnabled: form.fuzeEnabled,
      moqMeters: form.moqMeters || null,
      leadTimeDays: form.leadTimeDays || null,
      capacityMtMonth: form.capacityMtMonth || null,
      yearEstablished: form.yearEstablished || null,
      employeeCount: form.employeeCount || null,
      website: form.website || null,
      description: form.description || null,
      profileComplete:
        calcProfileCompleteness({
          ...factory,
          ...form,
          productTypes: JSON.stringify(form.productTypes),
          capabilities: JSON.stringify(form.capabilities),
          certifications: JSON.stringify(form.certifications),
          fabricTypes: JSON.stringify(form.fabricTypes),
        }) >= 50,
    };
    onSave(data);
  };

  const completeness = calcProfileCompleteness({
    ...factory,
    productTypes: JSON.stringify(form.productTypes),
    capabilities: JSON.stringify(form.capabilities),
    certifications: JSON.stringify(form.certifications),
    fabricTypes: JSON.stringify(form.fabricTypes),
    moqMeters: form.moqMeters,
    leadTimeDays: form.leadTimeDays,
    description: form.description,
    fuzeEnabled: form.fuzeEnabled,
  });

  return (
    <div className="space-y-6">
      {/* Completeness bar */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900">Discovery Profile Completeness</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill out this profile so brands can find this factory when searching
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-2xl font-black ${completeness >= 80 ? "text-emerald-600" : completeness >= 50 ? "text-amber-500" : "text-red-500"}`}
            >
              {completeness}%
            </span>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completeness >= 80 ? "bg-emerald-500" : completeness >= 50 ? "bg-amber-500" : "bg-red-400"}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      {/* Description & Basic Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <h3 className="font-bold text-slate-900 mb-4">Factory Description</h3>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] mb-4"
          placeholder="Describe this factory's strengths, specialties, and what makes them unique..."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">MOQ (meters)</label>
            <input
              type="number"
              value={form.moqMeters}
              onChange={(e) => setForm({ ...form, moqMeters: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              placeholder="e.g. 3000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Lead Time (days)
            </label>
            <input
              type="number"
              value={form.leadTimeDays}
              onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              placeholder="e.g. 45"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Capacity (MT/month)
            </label>
            <input
              type="number"
              value={form.capacityMtMonth}
              onChange={(e) => setForm({ ...form, capacityMtMonth: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Year Established
            </label>
            <input
              type="number"
              value={form.yearEstablished}
              onChange={(e) => setForm({ ...form, yearEstablished: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              placeholder="e.g. 1998"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Employees</label>
            <input
              type="number"
              value={form.employeeCount}
              onChange={(e) => setForm({ ...form, employeeCount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              placeholder="e.g. 350"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.fuzeEnabled}
              onChange={(e) => setForm({ ...form, fuzeEnabled: e.target.checked })}
              className="rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3] w-5 h-5"
            />
            <div>
              <span className="text-sm font-semibold text-slate-700">FUZE Treatment Enabled</span>
              <p className="text-xs text-slate-500">
                This factory has active FUZE antimicrobial treatment capability
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Tag Sections */}
      {ALL_TAG_CATEGORIES.map((cat) => (
        <div key={cat.key} className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-1">
            {cat.icon} {cat.label}
          </h3>
          <p className="text-xs text-slate-500 mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {cat.tags.map((tag) => {
              const active = ((form[cat.key as keyof typeof form] as string[]) || []).includes(
                tag.value,
              );
              return (
                <button
                  key={tag.value}
                  onClick={() => toggleTag(cat.key, tag.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "bg-[#00b4c3] text-white border-[#00b4c3] shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#00b4c3] hover:text-[#00b4c3]"
                  }`}
                >
                  {active && "✓ "}
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50 shadow-lg shadow-[#00b4c3]/30 transition-all"
        >
          {saving ? "Saving..." : "Save Discovery Profile"}
        </button>
      </div>
    </div>
  );
}

/* ── FactoryNotesTab — standalone CRUD (notes aren't in factory model) ── */
function FactoryNotesTab({ factoryId, t }: { factoryId: string; t: any }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const empty = { content: "", noteType: "NOTE", contactName: "" };
  const [form, setForm] = useState(empty);

  // Notes are attached to brands in the schema, but we show a simple local note log
  // For now, notes are loaded empty and can be added
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleAdd = async () => {
    if (!form.content.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const j = await res.json();
      if (j.ok) {
        setNotes([j.note, ...notes]);
        setForm(empty);
        setShowAdd(false);
      } else setError(j.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) setNotes(notes.filter((n) => n.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const typeColors: Record<string, string> = {
    NOTE: "bg-slate-100 text-slate-700",
    CALL: "bg-blue-100 text-blue-700",
    EMAIL: "bg-violet-100 text-violet-700",
    MEETING: "bg-green-100 text-green-700",
    TASK: "bg-amber-100 text-amber-700",
    FOLLOW_UP: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-900">{t.brandTabs.notes || "Notes"}</h3>
        <button
          onClick={() => {
            setShowAdd(!showAdd);
            setForm(empty);
          }}
          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
        >
          + Add Note
        </button>
      </div>
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}
      {showAdd && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select
                value={form.noteType}
                onChange={(e) => setForm({ ...form, noteType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {NOTE_TYPES.map((nt) => (
                  <option key={nt} value={nt}>
                    {nt.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Who was this with?"
              />
            </div>
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3"
            placeholder="Write your note..."
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.content.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? t.common.saving : "Save Note"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">{t.common.loading}</p>
      ) : notes.length === 0 && !showAdd ? (
        <p className="text-slate-400 text-sm text-center py-8">
          No notes for this factory yet. Add one above.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n: any) => (
            <div key={n.id} className="p-3 bg-slate-50 rounded-lg group">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColors[n.noteType] || typeColors.NOTE}`}
                  >
                    {(n.noteType || "NOTE").replace("_", " ")}
                  </span>
                  {n.contactName && (
                    <span className="text-xs text-slate-600 font-semibold">{n.contactName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {n.date
                      ? new Date(n.date).toLocaleDateString()
                      : new Date(n.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-xs text-red-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-700">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
