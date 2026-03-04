"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

const CONTACT_ROLES = [
  "Primary Contact", "Technical Contact", "Approver", "Buyer",
  "Quality Manager", "Sustainability Lead", "Design", "Other",
];

export default function BrandPortalContactsPage() {
  const { user } = useAuth();
  const [brand, setBrand] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const empty = { firstName: "", lastName: "", title: "", email: "", phone: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    // Get brand info, then fetch contacts for that brand
    fetch("/api/brand-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setBrand(j.brand);
          // Fetch contacts for this brand
          return fetch(`/api/contacts?brandId=${j.brand.id}`);
        }
        throw new Error(j.error);
      })
      .then((r) => r?.json())
      .then((j) => {
        if (j?.ok) setContacts(j.contacts || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.firstName.trim() && !form.email.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, brandId: brand.id }),
      });
      const j = await res.json();
      if (j.ok) {
        setContacts([...contacts, j.contact]);
        setForm(empty);
        setShowAdd(false);
        setSuccess("Contact added");
        setTimeout(() => setSuccess(""), 3000);
      } else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        setContacts(contacts.map((c) => (c.id === id ? j.contact : c)));
        setEditingId(null);
        setSuccess("Contact updated");
        setTimeout(() => setSuccess(""), 3000);
      } else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this contact?")) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) setContacts(contacts.filter((c) => c.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const startEdit = (ct: any) => {
    setEditingId(ct.id);
    setForm({
      firstName: ct.firstName || "",
      lastName: ct.lastName || "",
      title: ct.title || "",
      email: ct.email || "",
      phone: ct.phone || "",
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading contacts...</div>;

  // Group by role
  const approvers = contacts.filter((c) => c.title?.toLowerCase().includes("approver"));
  const others = contacts.filter((c) => !c.title?.toLowerCase().includes("approver"));

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Contacts & Approvers</h1>
          <p className="text-sm text-slate-500 mt-1">
            {brand?.name || "Your brand"} — Manage contacts who interact with FUZE
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setForm(empty); setEditingId(null); }}
          className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30"
        >
          + Add Contact
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#00b4c3]/30 shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">New Contact</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="First Name" autoFocus />
            <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="Last Name" />
            <select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]">
              <option value="">Select Role...</option>
              {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="Email" />
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]" placeholder="Phone" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving}
              className="px-5 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50">
              {saving ? "Saving..." : "Add Contact"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Approvers Section */}
      {approvers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Approvers</h2>
          <div className="space-y-2">
            {approvers.map((ct) => (
              <ContactCard
                key={ct.id}
                contact={ct}
                editingId={editingId}
                form={form}
                setForm={setForm}
                saving={saving}
                onEdit={() => startEdit(ct)}
                onSave={() => handleUpdate(ct.id)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(ct.id)}
                isApprover
              />
            ))}
          </div>
        </div>
      )}

      {/* All Contacts */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          {approvers.length > 0 ? "Other Contacts" : "All Contacts"}
        </h2>
        {others.length === 0 && !showAdd ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-400">
            No contacts yet. Add your team members who work with FUZE.
          </div>
        ) : (
          <div className="space-y-2">
            {others.map((ct) => (
              <ContactCard
                key={ct.id}
                contact={ct}
                editingId={editingId}
                form={form}
                setForm={setForm}
                saving={saving}
                onEdit={() => startEdit(ct)}
                onSave={() => handleUpdate(ct.id)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(ct.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactCard({
  contact: ct, editingId, form, setForm, saving,
  onEdit, onSave, onCancel, onDelete, isApprover,
}: any) {
  if (editingId === ct.id) {
    return (
      <div className="bg-[#00b4c3]/5 border border-[#00b4c3]/20 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <input type="text" value={form.firstName} onChange={(e: any) => setForm({ ...form, firstName: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="First Name" />
          <input type="text" value={form.lastName} onChange={(e: any) => setForm({ ...form, lastName: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Last Name" />
          <input type="text" value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Role/Title" />
          <input type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Email" />
          <input type="text" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Phone" />
        </div>
        <div className="flex gap-2">
          <button onClick={onSave} className="text-xs text-[#00b4c3] font-bold hover:underline">{saving ? "..." : "Save"}</button>
          <button onClick={onCancel} className="text-xs text-slate-500 hover:underline">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-4 group hover:border-[#00b4c3]/30 transition-colors">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
        isApprover ? "bg-emerald-500" : "bg-[#00b4c3]"
      }`}>
        {(ct.firstName || ct.name || "?")[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-900">
          {ct.firstName} {ct.lastName}
          {ct.title && <span className="text-slate-500 font-normal ml-2">({ct.title})</span>}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {ct.email}{ct.phone && ` · ${ct.phone}`}
        </div>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:underline font-medium">Remove</button>
      </div>
    </div>
  );
}
