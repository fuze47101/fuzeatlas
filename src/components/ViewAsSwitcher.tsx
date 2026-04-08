"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Rep",
  FABRIC_MANAGER: "Fabric Manager",
  TESTING_MANAGER: "Testing Manager",
  FACTORY_MANAGER: "Factory Manager",
  FACTORY_USER: "Factory",
  BRAND_USER: "Brand",
  DISTRIBUTOR_USER: "Distributor",
  LAB_USER: "Lab",
  PUBLIC: "Public",
};

const ROLE_ICONS: Record<string, string> = {
  BRAND_USER: "🏷️",
  FACTORY_USER: "🏭",
  FACTORY_MANAGER: "🏭",
  DISTRIBUTOR_USER: "🌍",
  LAB_USER: "🔬",
  EMPLOYEE: "👤",
  SALES_MANAGER: "💼",
  SALES_REP: "💼",
  ADMIN: "👑",
};

// Group order for the dropdown
const ROLE_GROUP_ORDER = [
  "BRAND_USER",
  "FACTORY_USER",
  "FACTORY_MANAGER",
  "DISTRIBUTOR_USER",
  "LAB_USER",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
];

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  entityName: string | null;
}

export default function ViewAsSwitcher() {
  const { impersonation, startImpersonating, stopImpersonating } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch users when dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/admin/impersonate")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setUsers(d.users);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleSelect = async (userId: string) => {
    setSwitching(true);
    const result = await startImpersonating(userId);
    setSwitching(false);
    if (result.ok) {
      setIsOpen(false);
      setSearch("");
      // Navigate to the appropriate dashboard
      window.location.href = "/dashboard";
    }
  };

  const handleStop = async () => {
    setSwitching(true);
    await stopImpersonating();
    setSwitching(false);
    window.location.href = "/dashboard";
  };

  // Filter users
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.entityName || "").toLowerCase().includes(q) ||
      (ROLE_LABELS[u.role] || "").toLowerCase().includes(q)
    );
  });

  // Group by role
  const grouped: Record<string, UserOption[]> = {};
  for (const u of filtered) {
    if (!grouped[u.role]) grouped[u.role] = [];
    grouped[u.role].push(u);
  }

  // Sort groups
  const sortedRoles = Object.keys(grouped).sort((a, b) => {
    const ai = ROLE_GROUP_ORDER.indexOf(a);
    const bi = ROLE_GROUP_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toggle button */}
      {impersonation?.active ? (
        <button
          onClick={handleStop}
          disabled={switching}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors border border-red-500/30"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="truncate">
            {switching ? "Switching..." : "Exit View As"}
          </span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={switching}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border border-dashed border-slate-700"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>View As...</span>
          <svg
            className={`w-3 h-3 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden z-50 max-h-[400px] flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-slate-700">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full px-3 py-2 rounded-md bg-slate-900 text-sm text-white placeholder-slate-500 border border-slate-600 focus:border-[#00b4c3] focus:outline-none focus:ring-1 focus:ring-[#00b4c3]"
            />
          </div>

          {/* User list */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-slate-500 text-sm">Loading users...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">No users found</div>
            ) : (
              sortedRoles.map((role) => (
                <div key={role}>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-900/50 sticky top-0">
                    {ROLE_ICONS[role] || "👤"} {ROLE_LABELS[role] || role}
                  </div>
                  {grouped[role].map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelect(u.id)}
                      disabled={switching}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{u.name}</div>
                        {u.entityName && (
                          <div className="truncate text-[11px] text-slate-500">{u.entityName}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
