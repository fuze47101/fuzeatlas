"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  canClaim?: boolean;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
  labId?: string | null;
}

interface LookupItem {
  id: string;
  name: string;
}

const ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "FABRIC_MANAGER",
  "TESTING_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_USER",
  "BRAND_USER",
  "DISTRIBUTOR_USER",
  "LAB_USER",
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Rep",
  FABRIC_MANAGER: "Fabric Mgr",
  TESTING_MANAGER: "Testing Mgr",
  FACTORY_MANAGER: "Factory Mgr",
  FACTORY_USER: "Factory User",
  BRAND_USER: "Brand User",
  DISTRIBUTOR_USER: "Distributor",
  LAB_USER: "Lab User",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  PENDING: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

// Roles that need entity assignment
const NEEDS_BRAND = ["BRAND_USER"];
const NEEDS_FACTORY = ["FACTORY_USER", "FACTORY_MANAGER"];
const NEEDS_DISTRIBUTOR = ["DISTRIBUTOR_USER"];
const NEEDS_LAB = ["LAB_USER"];

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("EMPLOYEE");
  const [newBrandId, setNewBrandId] = useState("");
  const [newFactoryId, setNewFactoryId] = useState("");
  const [newDistributorId, setNewDistributorId] = useState("");
  const [newLabId, setNewLabId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Lookup data for dropdowns
  const [brands, setBrands] = useState<LookupItem[]>([]);
  const [factories, setFactories] = useState<LookupItem[]>([]);
  const [distributors, setDistributors] = useState<LookupItem[]>([]);
  const [labs, setLabs] = useState<LookupItem[]>([]);

  // Edit form
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  // Entity-pickers shown in edit mode based on role. Tina's bug:
  // editing FACTORY_USER → DISTRIBUTOR_USER previously sent only
  // {role, status}, which left factoryId stale + distributorId null.
  // Now the form exposes the matching picker AND auto-clears stale
  // entity FKs when switching role categories.
  const [editBrandId, setEditBrandId] = useState("");
  const [editFactoryId, setEditFactoryId] = useState("");
  const [editDistributorId, setEditDistributorId] = useState("");
  const [editLabId, setEditLabId] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Action dropdown
  const [actionDropdownOpen, setActionDropdownOpen] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<
    "reset-password" | "change-role" | "suspend" | "remove" | "delete" | null
  >(null);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalUser, setModalUser] = useState<UserRecord | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [selectedNewRole, setSelectedNewRole] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      if (data.ok) setUsers(data.users);
    } catch {}
    setLoading(false);
  }, []);

  // Fetch lookup data for entity assignment.
  // Labs added Apr 2026 (Tina ticket — admin couldn't link a new user to a lab).
  const fetchLookups = useCallback(async () => {
    try {
      const [brandsRes, factoriesRes, distRes, labsRes] = await Promise.all([
        fetch("/api/brands").then((r) => r.json()),
        fetch("/api/factories").then((r) => r.json()),
        fetch("/api/distributors").then((r) => r.json()),
        fetch("/api/labs").then((r) => r.json()),
      ]);
      if (brandsRes.brands)
        setBrands(brandsRes.brands.map((b: any) => ({ id: b.id, name: b.name })));
      if (factoriesRes.factories)
        setFactories(factoriesRes.factories.map((f: any) => ({ id: f.id, name: f.name })));
      if (distRes.distributors)
        setDistributors(distRes.distributors.map((d: any) => ({ id: d.id, name: d.name })));
      if (labsRes.labs) setLabs(labsRes.labs.map((l: any) => ({ id: l.id, name: l.name })));
    } catch {}
  }, []);

  useEffect(() => {
    // Only admins can access
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }
    fetchUsers();
    fetchLookups();
  }, [currentUser, router, fetchUsers, fetchLookups]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          ...(NEEDS_BRAND.includes(newRole) && newBrandId && { brandId: newBrandId }),
          ...(NEEDS_FACTORY.includes(newRole) && newFactoryId && { factoryId: newFactoryId }),
          ...(NEEDS_DISTRIBUTOR.includes(newRole) &&
            newDistributorId && { distributorId: newDistributorId }),
          ...(NEEDS_LAB.includes(newRole) && newLabId && { labId: newLabId }),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowAdd(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("EMPLOYEE");
        setNewBrandId("");
        setNewFactoryId("");
        setNewDistributorId("");
        setNewLabId("");
        fetchUsers();
      } else {
        setFormError(data.error || "Failed to create user");
      }
    } catch {
      setFormError("Network error");
    }
    setSaving(false);
  };

  /**
   * Open the edit row for a user, seeding all FK pickers from the
   * user's current record. Without this seed, switching role
   * categories (e.g. FACTORY_USER → DISTRIBUTOR_USER) would
   * silently strand the old factoryId because the form had no
   * picker for it.
   */
  const startEdit = (u: UserRecord) => {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditBrandId(u.brandId || "");
    setEditFactoryId(u.factoryId || "");
    setEditDistributorId(u.distributorId || "");
    setEditLabId(u.labId || "");
    setEditError(null);
  };

  const handleUpdateUser = async (userId: string) => {
    setSaving(true);
    setEditError(null);
    try {
      // Build the patch body. Always send role + status. For entity
      // FKs: send the PICKER VALUE for the role's required entity
      // (so the API's role-coherence guard at /api/settings/users/[id]
      // sees a valid finalFkValue), AND null out the OTHER three
      // entity FKs so a role-category switch doesn't leave stale
      // assignments. Tina's bug: she switched Shauna FACTORY_USER →
      // DISTRIBUTOR_USER without a way to clear factoryId or set
      // distributorId.
      const body: any = { role: editRole, status: editStatus };
      const isBrand = NEEDS_BRAND.includes(editRole);
      const isFactory = NEEDS_FACTORY.includes(editRole);
      const isDistributor = NEEDS_DISTRIBUTOR.includes(editRole);
      const isLab = NEEDS_LAB.includes(editRole);
      body.brandId = isBrand ? editBrandId || null : null;
      body.factoryId = isFactory ? editFactoryId || null : null;
      body.distributorId = isDistributor ? editDistributorId || null : null;
      body.labId = isLab ? editLabId || null : null;

      const res = await fetch(`/api/settings/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingId(null);
        setEditError(null);
        fetchUsers();
      } else {
        setEditError(data.error || "Failed to update user");
      }
    } catch (e: any) {
      setEditError(e?.message || "Network error");
    }
    setSaving(false);
  };

  // Flip Business Development "can claim" permission. BD reps need this to
  // grab unclaimed LEAD brands from the BD Portal. Independent of role —
  // EMPLOYEE, SALES_REP, ADMIN, and BD_REP can all carry the flag.
  const handleToggleCanClaim = async (userId: string, next: boolean) => {
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canClaim: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionDropdownOpen(null);
        fetchUsers();
      } else {
        alert(data.error || "Failed to update BD claim permission");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleOpenActionModal = (
    type: "reset-password" | "change-role" | "suspend" | "remove" | "delete",
    userId: string,
    userData: UserRecord,
  ) => {
    setModalType(type);
    setModalUserId(userId);
    setModalUser(userData);
    setModalOpen(true);
    setActionDropdownOpen(null);

    if (type === "change-role") {
      setSelectedNewRole(userData.role);
    }
  };

  const handleExecuteAction = async () => {
    if (!modalUserId || !modalType) return;

    const action = modalType;
    const body: any = { action };

    if (modalType === "change-role" && selectedNewRole) {
      body.role = selectedNewRole;
    }

    try {
      const res = await fetch(`/api/users/${modalUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.ok) {
        if (modalType === "reset-password" && data.generatedPassword) {
          setGeneratedPassword(data.generatedPassword);
        } else {
          setModalOpen(false);
          fetchUsers();
        }
      } else {
        alert(data.error || "Action failed");
      }
    } catch (e: any) {
      alert(e.message || "Network error");
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400 text-sm">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-medium rounded-lg hover:bg-[#009ba8] transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {/* ── Unassigned-Users Alert (task #73) ────────────────────
           Active external users whose role requires an entity FK but
           don't have one set. These users sign in successfully but
           portals can't scope data for them, so they see nothing.    */}
      {(() => {
        const unassigned = users.filter((u) => {
          if (u.status !== "ACTIVE") return false;
          if (NEEDS_FACTORY.includes(u.role) && !u.factoryId) return true;
          if (NEEDS_BRAND.includes(u.role) && !u.brandId) return true;
          if (NEEDS_DISTRIBUTOR.includes(u.role) && !u.distributorId) return true;
          if (NEEDS_LAB.includes(u.role) && !u.labId) return true;
          return false;
        });
        if (unassigned.length === 0) return null;
        return (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 text-sm">
                  {unassigned.length} active user{unassigned.length !== 1 ? "s" : ""} missing entity
                  assignment
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  These users have a role that requires a brand/factory/distributor/lab link, but
                  none is set. They can sign in but their portal will be empty until you assign
                  them.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900">
                  {unassigned.map((u) => {
                    const needs = NEEDS_FACTORY.includes(u.role)
                      ? "factory"
                      : NEEDS_BRAND.includes(u.role)
                        ? "brand"
                        : NEEDS_DISTRIBUTOR.includes(u.role)
                          ? "distributor"
                          : NEEDS_LAB.includes(u.role)
                            ? "lab"
                            : "—";
                    return (
                      <li key={u.id} className="flex items-center gap-2">
                        <span className="font-mono">•</span>
                        <span className="font-semibold">{u.name}</span>
                        <span className="text-amber-700">&lt;{u.email}&gt;</span>
                        <span className="px-1.5 py-0.5 bg-amber-200 rounded font-mono text-[10px]">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        <span className="text-amber-700">— missing {needs}</span>
                        <button
                          onClick={() => startEdit(u)}
                          className="ml-auto text-blue-700 hover:underline text-xs font-semibold"
                        >
                          Fix →
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add User Form */}
      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New User</h3>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>
            {/* Entity assignment — shown based on role */}
            {NEEDS_BRAND.includes(newRole) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign to Brand
                </label>
                <select
                  value={newBrandId}
                  onChange={(e) => setNewBrandId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Select Brand —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Brand users can only see data for their assigned brand
                </p>
              </div>
            )}
            {NEEDS_FACTORY.includes(newRole) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign to Factory
                </label>
                <select
                  value={newFactoryId}
                  onChange={(e) => setNewFactoryId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Select Factory —</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {NEEDS_DISTRIBUTOR.includes(newRole) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign to Distributor
                </label>
                <select
                  value={newDistributorId}
                  onChange={(e) => setNewDistributorId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Select Distributor —</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {NEEDS_LAB.includes(newRole) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign to Lab
                </label>
                <select
                  value={newLabId}
                  onChange={(e) => setNewLabId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Select Lab —</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Lab users can upload test reports and view tests assigned to their lab
                </p>
              </div>
            )}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#00b4c3] text-white text-sm font-medium rounded-lg hover:bg-[#009ba8] disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User List — Mobile: card layout, Desktop: table */}
      {/* Mobile view (< md) */}
      <div className="md:hidden space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#00b4c3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {u.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1">
                    {u.name}
                    {u.id === currentUser?.id && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">
                        You
                      </span>
                    )}
                    {u.canClaim && (
                      <span
                        title="Can claim BD leads"
                        className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold"
                      >
                        BD
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[u.status] || "bg-slate-100 text-slate-500"}`}
              >
                {u.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                {ROLE_LABELS[u.role] || u.role}
              </span>
              <div className="relative">
                <button
                  onClick={() => setActionDropdownOpen(actionDropdownOpen === u.id ? null : u.id)}
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 min-h-[32px]"
                >
                  Actions ▼
                </button>
                {actionDropdownOpen === u.id && (
                  <div className="absolute right-0 bottom-full mb-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => {
                        startEdit(u);
                        setActionDropdownOpen(null);
                      }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                    >
                      Edit Role/Status
                    </button>
                    <button
                      onClick={() => handleOpenActionModal("reset-password", u.id, u)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 border-b border-slate-100"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => handleOpenActionModal("change-role", u.id, u)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-slate-100"
                    >
                      Change Role
                    </button>
                    {u.status !== "SUSPENDED" && (
                      <button
                        onClick={() => handleOpenActionModal("suspend", u.id, u)}
                        className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-b border-slate-100"
                      >
                        Suspend
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleCanClaim(u.id, !u.canClaim)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 border-b border-slate-100"
                    >
                      {u.canClaim ? "Revoke BD Claim" : "Grant BD Claim"}
                    </button>
                    <button
                      onClick={() => handleOpenActionModal("remove", u.id, u)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                    >
                      Deactivate
                    </button>
                    <button
                      onClick={() => handleOpenActionModal("delete", u.id, u)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-semibold"
                    >
                      Delete Permanently
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Inline edit for mobile */}
            {editingId === u.id && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                <div>
                  <label className="text-xs text-slate-500">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] || r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>

                {/* Role-aware entity picker — appears when the picked
                    role requires a brand/factory/distributor/lab. */}
                {NEEDS_BRAND.includes(editRole) && (
                  <div>
                    <label className="text-xs text-slate-500">Brand</label>
                    <select
                      value={editBrandId}
                      onChange={(e) => setEditBrandId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                    >
                      <option value="">— pick a brand —</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {NEEDS_FACTORY.includes(editRole) && (
                  <div>
                    <label className="text-xs text-slate-500">Factory</label>
                    <select
                      value={editFactoryId}
                      onChange={(e) => setEditFactoryId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                    >
                      <option value="">— pick a factory —</option>
                      {factories.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {NEEDS_DISTRIBUTOR.includes(editRole) && (
                  <div>
                    <label className="text-xs text-slate-500">Distributor</label>
                    <select
                      value={editDistributorId}
                      onChange={(e) => setEditDistributorId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                    >
                      <option value="">— pick a distributor —</option>
                      {distributors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {NEEDS_LAB.includes(editRole) && (
                  <div>
                    <label className="text-xs text-slate-500">Lab</label>
                    <select
                      value={editLabId}
                      onChange={(e) => setEditLabId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                    >
                      <option value="">— pick a lab —</option>
                      {labs.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                    {editError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateUser(u.id)}
                    disabled={saving}
                    className="flex-1 text-sm px-3 py-2 bg-[#00b4c3] text-white rounded-lg hover:bg-[#009ba8]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 text-sm px-3 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop view (>= md) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Fragment key={u.id}>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#00b4c3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-900">{u.name}</span>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium ml-1">
                            You
                          </span>
                        )}
                        {u.canClaim && (
                          <span
                            title="Can claim BD leads"
                            className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold ml-1"
                          >
                            BD
                          </span>
                        )}
                        <div className="text-xs text-slate-400 lg:hidden truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r] || r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="PENDING">Pending</option>
                      </select>
                    ) : (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[u.status] || "bg-slate-100 text-slate-500"}`}
                      >
                        {u.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === u.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdateUser(u.id)}
                          disabled={saving}
                          className="text-xs px-3 py-1 bg-[#00b4c3] text-white rounded hover:bg-[#009ba8]"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActionDropdownOpen(actionDropdownOpen === u.id ? null : u.id)
                          }
                          className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                        >
                          Actions ▼
                        </button>
                        {actionDropdownOpen === u.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <button
                              onClick={() => {
                                startEdit(u);
                                setActionDropdownOpen(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                            >
                              Edit Role/Status
                            </button>
                            <button
                              onClick={() => handleOpenActionModal("reset-password", u.id, u)}
                              className="block w-full text-left px-4 py-2 text-xs text-amber-600 hover:bg-amber-50 border-b border-slate-100"
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleOpenActionModal("change-role", u.id, u)}
                              className="block w-full text-left px-4 py-2 text-xs text-blue-600 hover:bg-blue-50 border-b border-slate-100"
                            >
                              Change Role
                            </button>
                            {u.status !== "SUSPENDED" && (
                              <button
                                onClick={() => handleOpenActionModal("suspend", u.id, u)}
                                className="block w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 border-b border-slate-100"
                              >
                                Suspend
                              </button>
                            )}
                            {u.status === "SUSPENDED" && (
                              <button
                                onClick={() => {
                                  handleExecuteAction();
                                  handleOpenActionModal("suspend", u.id, u);
                                }}
                                className="block w-full text-left px-4 py-2 text-xs text-green-600 hover:bg-green-50 border-b border-slate-100"
                              >
                                Unsuspend (Activate)
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleCanClaim(u.id, !u.canClaim)}
                              className="block w-full text-left px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 border-b border-slate-100"
                            >
                              {u.canClaim ? "Revoke BD Claim" : "Grant BD Claim"}
                            </button>
                            <button
                              onClick={() => handleOpenActionModal("remove", u.id, u)}
                              className="block w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                            >
                              Deactivate
                            </button>
                            <button
                              onClick={() => handleOpenActionModal("delete", u.id, u)}
                              className="block w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-semibold"
                            >
                              Delete Permanently
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {/* Extension row — appears under the editing row.
                    Shows the inline entity FK picker when the picked role
                    requires one (DISTRIBUTOR_USER → distributor, etc.) so
                    save doesn't fail with "missing assignment". Also surfaces
                    editError so users can see WHY a save failed. Without
                    this, the inline Save button silently 400s when the role
                    needs an FK that isn't set (Danny case, May 11 2026). */}
                {editingId === u.id && (
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex flex-wrap gap-3 items-end">
                        {NEEDS_BRAND.includes(editRole) && (
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-slate-500">Brand</label>
                            <select
                              value={editBrandId}
                              onChange={(e) => setEditBrandId(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-1"
                            >
                              <option value="">— pick a brand —</option>
                              {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {NEEDS_FACTORY.includes(editRole) && (
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-slate-500">Factory</label>
                            <select
                              value={editFactoryId}
                              onChange={(e) => setEditFactoryId(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-1"
                            >
                              <option value="">— pick a factory —</option>
                              {factories.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {NEEDS_DISTRIBUTOR.includes(editRole) && (
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-slate-500">Distributor</label>
                            <select
                              value={editDistributorId}
                              onChange={(e) => setEditDistributorId(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-1"
                            >
                              <option value="">— pick a distributor —</option>
                              {distributors.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {NEEDS_LAB.includes(editRole) && (
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-slate-500">Lab</label>
                            <select
                              value={editLabId}
                              onChange={(e) => setEditLabId(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs mt-1"
                            >
                              <option value="">— pick a lab —</option>
                              {labs.map((l) => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {editError && (
                          <div className="flex-1 min-w-[300px] text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-2">
                            {editError}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {modalOpen && modalType && modalUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            {/* Reset Password - Show Generated Password */}
            {modalType === "reset-password" && generatedPassword && (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Password Reset</h2>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-xs text-amber-700 uppercase font-semibold mb-2">
                    New Password Generated
                  </p>
                  <code className="block bg-white p-2 rounded border border-amber-200 text-sm font-mono text-slate-900 mb-3">
                    {generatedPassword}
                  </code>
                  <p className="text-xs text-amber-700 mb-2">
                    Share this password with {modalUser.name}. They can change it after login.
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      alert("Password copied to clipboard");
                    }}
                    className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 font-medium"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setGeneratedPassword("");
                    fetchUsers();
                  }}
                  className="w-full px-4 py-2 bg-[#00b4c3] text-white font-medium rounded-lg hover:bg-[#009ba8]"
                >
                  Done
                </button>
              </>
            )}

            {/* Reset Password - Confirmation */}
            {modalType === "reset-password" && !generatedPassword && (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Reset Password</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Generate a new password for{" "}
                  <span className="font-semibold">{modalUser.name}</span>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteAction}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
                  >
                    Reset
                  </button>
                </div>
              </>
            )}

            {/* Change Role */}
            {modalType === "change-role" && !generatedPassword && (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Change Role</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Current role:{" "}
                  <span className="font-semibold">
                    {ROLE_LABELS[modalUser.role] || modalUser.role}
                  </span>
                </p>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-6"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteAction}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600"
                  >
                    Change
                  </button>
                </div>
              </>
            )}

            {/* Suspend */}
            {modalType === "suspend" && !generatedPassword && (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Suspend User</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Suspend <span className="font-semibold">{modalUser.name}</span>? They will be
                  unable to access the system.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteAction}
                    className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600"
                  >
                    Suspend
                  </button>
                </div>
              </>
            )}

            {/* Remove/Deactivate */}
            {modalType === "remove" && !generatedPassword && (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Deactivate User</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Deactivate <span className="font-semibold">{modalUser.name}</span>? They will be
                  unable to access the system.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteAction}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800"
                  >
                    Deactivate
                  </button>
                </div>
              </>
            )}

            {modalType === "delete" && !generatedPassword && (
              <>
                <h2 className="text-lg font-bold text-red-600 mb-4">Permanently Delete User</h2>
                <p className="text-sm text-slate-600 mb-2">
                  This will <span className="font-semibold text-red-600">permanently delete</span>{" "}
                  <span className="font-semibold">{modalUser.name}</span> ({modalUser.email}) from
                  the system.
                </p>
                <p className="text-sm text-red-500 mb-6">
                  This action cannot be undone. All associated data (notifications, audit logs,
                  notes) will also be removed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteAction}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
                  >
                    Delete Permanently
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
