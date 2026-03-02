"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLES = [
  "ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP",
  "FABRIC_MANAGER", "TESTING_MANAGER", "FACTORY_MANAGER",
  "FACTORY_USER", "BRAND_USER", "DISTRIBUTOR_USER",
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
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  PENDING: "bg-amber-100 text-amber-700",
};

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
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      if (data.ok) setUsers(data.users);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    // Only admins can access
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }
    fetchUsers();
  }, [currentUser, router, fetchUsers]);

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
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowAdd(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("EMPLOYEE");
        fetchUsers();
      } else {
        setFormError(data.error || "Failed to create user");
      }
    } catch {
      setFormError("Network error");
    }
    setSaving(false);
  };

  const handleUpdateUser = async (userId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole, status: editStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingId(null);
        fetchUsers();
      }
    } catch {}
    setSaving(false);
  };

  const handleResetPassword = async (userId: string) => {
    const newPw = prompt("Enter new password for this user (min 6 chars):");
    if (!newPw || newPw.length < 6) return;

    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPw }),
      });
      const data = await res.json();
      if (data.ok) alert("Password updated successfully");
      else alert(data.error || "Failed to update password");
    } catch {
      alert("Network error");
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
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-medium rounded-lg hover:bg-[#009ba8] transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add User"}
        </button>
      </div>

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
                  <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                ))}
              </select>
            </div>
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

      {/* User List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#00b4c3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm font-medium text-slate-900">{u.name}</span>
                    {u.id === currentUser?.id && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">You</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
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
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[u.status] || "bg-slate-100 text-slate-500"}`}>
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
                    <div className="flex items-center justify-end gap-2">
                      {currentUser?.role === "ADMIN" && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(u.id);
                              setEditRole(u.role);
                              setEditStatus(u.status);
                            }}
                            className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleResetPassword(u.id)}
                            className="text-xs px-3 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100"
                          >
                            Reset PW
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
